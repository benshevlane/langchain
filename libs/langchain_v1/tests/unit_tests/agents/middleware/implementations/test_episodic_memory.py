"""Tests for the EpisodicMemoryMiddleware."""

from __future__ import annotations

from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock

import pytest
from langchain_core.documents import Document
from langchain_core.embeddings.fake import DeterministicFakeEmbedding
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.vectorstores import InMemoryVectorStore

from langchain.agents.middleware.episodic_memory import (
    EpisodicMemoryMiddleware,
    _default_episode_formatter,
    _get_query_from_messages,
)
from langchain.agents.middleware.types import AgentState, ModelRequest, ModelResponse


def _fake_runtime() -> Any:
    """Create a fake runtime for testing."""
    return cast("Any", None)


def _make_request(
    messages: list[Any],
    *,
    system_message: SystemMessage | None = None,
) -> ModelRequest[None]:
    """Create a ModelRequest for testing."""
    return ModelRequest(
        model=MagicMock(),
        messages=messages,
        system_message=system_message,
        state=cast("AgentState[Any]", {"messages": messages}),
    )


def _make_handler(
    response_content: str = "Hello!",
) -> tuple[MagicMock, ModelResponse[Any]]:
    """Create a mock handler that returns a ModelResponse."""
    response = ModelResponse[Any](result=[AIMessage(content=response_content)])
    handler = MagicMock(return_value=response)
    return handler, response


def _make_async_handler(
    response_content: str = "Hello!",
) -> tuple[AsyncMock, ModelResponse[Any]]:
    """Create a mock async handler that returns a ModelResponse."""
    response = ModelResponse[Any](result=[AIMessage(content=response_content)])
    handler = AsyncMock(return_value=response)
    return handler, response


def _make_vector_store() -> InMemoryVectorStore:
    """Create an InMemoryVectorStore with deterministic embeddings."""
    return InMemoryVectorStore(embedding=DeterministicFakeEmbedding(size=10))


# --- Helper function tests ---


class TestGetQueryFromMessages:
    def test_last_human_strategy(self) -> None:
        messages = [
            HumanMessage(content="first question"),
            AIMessage(content="answer"),
            HumanMessage(content="second question"),
        ]
        result = _get_query_from_messages(messages, "last_human")
        assert result == "second question"

    def test_all_human_strategy(self) -> None:
        messages = [
            HumanMessage(content="first"),
            AIMessage(content="answer"),
            HumanMessage(content="second"),
        ]
        result = _get_query_from_messages(messages, "all_human")
        assert result == "first second"

    def test_no_human_messages(self) -> None:
        messages = [AIMessage(content="only ai")]
        result = _get_query_from_messages(messages, "last_human")
        assert result is None

    def test_empty_messages(self) -> None:
        result = _get_query_from_messages([], "last_human")
        assert result is None


class TestDefaultEpisodeFormatter:
    def test_formats_single_episode(self) -> None:
        docs = [Document(page_content="User asked about Python")]
        result = _default_episode_formatter(docs)
        assert "Relevant context from past interactions:" in result
        assert "[1] User asked about Python" in result

    def test_formats_multiple_episodes(self) -> None:
        docs = [
            Document(page_content="Episode one"),
            Document(page_content="Episode two"),
        ]
        result = _default_episode_formatter(docs)
        assert "[1] Episode one" in result
        assert "[2] Episode two" in result

    def test_truncates_long_episodes(self) -> None:
        docs = [Document(page_content="x" * 1000)]
        result = _default_episode_formatter(docs)
        assert result.endswith("...")
        # Should be truncated to 500 chars + "..."
        assert len(result.split("[1] ")[1]) == 503


# --- Initialization tests ---


class TestEpisodicMemoryInit:
    def test_invalid_k(self) -> None:
        store = _make_vector_store()
        with pytest.raises(ValueError, match="k must be >= 1"):
            EpisodicMemoryMiddleware(store, k=0)

    def test_invalid_score_threshold_low(self) -> None:
        store = _make_vector_store()
        with pytest.raises(ValueError, match="score_threshold must be between 0 and 1"):
            EpisodicMemoryMiddleware(store, score_threshold=-0.1)

    def test_invalid_score_threshold_high(self) -> None:
        store = _make_vector_store()
        with pytest.raises(ValueError, match="score_threshold must be between 0 and 1"):
            EpisodicMemoryMiddleware(store, score_threshold=1.5)

    def test_invalid_max_episode_chars(self) -> None:
        store = _make_vector_store()
        with pytest.raises(ValueError, match="max_episode_chars must be >= 1"):
            EpisodicMemoryMiddleware(store, max_episode_chars=0)

    def test_valid_init(self) -> None:
        store = _make_vector_store()
        middleware = EpisodicMemoryMiddleware(
            store, k=5, score_threshold=0.5, namespace="test"
        )
        assert middleware._k == 5
        assert middleware._score_threshold == 0.5
        assert middleware._namespace == "test"


# --- after_agent tests (episode storage) ---


class TestAfterAgent:
    def test_stores_episode(self) -> None:
        store = _make_vector_store()
        middleware = EpisodicMemoryMiddleware(store)
        state = cast(
            "AgentState[Any]",
            {
                "messages": [
                    HumanMessage(content="What is Python?"),
                    AIMessage(content="A programming language."),
                ]
            },
        )

        result = middleware.after_agent(state, _fake_runtime())

        assert result is None
        # Verify document was stored
        docs = store.similarity_search("Python", k=1)
        assert len(docs) == 1
        assert "Python" in docs[0].page_content

    def test_stores_with_namespace(self) -> None:
        store = _make_vector_store()
        middleware = EpisodicMemoryMiddleware(store, namespace="agent_1")
        state = cast(
            "AgentState[Any]",
            {"messages": [HumanMessage(content="Hello")]},
        )

        middleware.after_agent(state, _fake_runtime())

        docs = store.similarity_search("Hello", k=1)
        assert len(docs) == 1
        assert docs[0].metadata["namespace"] == "agent_1"

    def test_stores_with_metadata(self) -> None:
        store = _make_vector_store()
        middleware = EpisodicMemoryMiddleware(store)
        state = cast(
            "AgentState[Any]",
            {
                "messages": [
                    HumanMessage(content="msg1"),
                    AIMessage(content="msg2"),
                ]
            },
        )

        middleware.after_agent(state, _fake_runtime())

        docs = store.similarity_search("msg1", k=1)
        assert docs[0].metadata["message_count"] == 2
        assert "timestamp" in docs[0].metadata

    def test_truncates_long_episodes(self) -> None:
        store = _make_vector_store()
        middleware = EpisodicMemoryMiddleware(store, max_episode_chars=50)
        state = cast(
            "AgentState[Any]",
            {"messages": [HumanMessage(content="x" * 200)]},
        )

        middleware.after_agent(state, _fake_runtime())

        docs = store.similarity_search("x", k=1)
        assert len(docs[0].page_content) <= 50

    def test_empty_messages_skips_storage(self) -> None:
        store = _make_vector_store()
        middleware = EpisodicMemoryMiddleware(store)
        state = cast("AgentState[Any]", {"messages": []})

        middleware.after_agent(state, _fake_runtime())

        docs = store.similarity_search("anything", k=1)
        assert len(docs) == 0


# --- wrap_model_call tests (episode retrieval) ---


class TestWrapModelCall:
    def test_retrieves_and_injects_episodes(self) -> None:
        store = _make_vector_store()
        # Pre-populate the store with a past episode
        store.add_documents(
            [Document(page_content="User asked about Python. AI explained it.")]
        )

        middleware = EpisodicMemoryMiddleware(store, k=1)
        request = _make_request([HumanMessage(content="Tell me about Python")])
        handler, response = _make_handler()

        result = middleware.wrap_model_call(request, handler)

        assert result == response
        handler.assert_called_once()
        # Verify the request passed to handler has an enriched system message
        called_request = handler.call_args[0][0]
        assert called_request.system_message is not None
        assert "past interactions" in called_request.system_message.text.lower()

    def test_no_human_message_skips_retrieval(self) -> None:
        store = _make_vector_store()
        store.add_documents([Document(page_content="some episode")])

        middleware = EpisodicMemoryMiddleware(store)
        request = _make_request([AIMessage(content="only ai message")])
        handler, response = _make_handler()

        result = middleware.wrap_model_call(request, handler)

        assert result == response
        # Handler should be called with the original request (no modification)
        handler.assert_called_once_with(request)

    def test_empty_store_skips_injection(self) -> None:
        store = _make_vector_store()
        middleware = EpisodicMemoryMiddleware(store)
        request = _make_request([HumanMessage(content="Hello")])
        handler, response = _make_handler()

        result = middleware.wrap_model_call(request, handler)

        assert result == response
        handler.assert_called_once_with(request)

    def test_preserves_existing_system_message(self) -> None:
        store = _make_vector_store()
        store.add_documents([Document(page_content="Past episode about code")])

        middleware = EpisodicMemoryMiddleware(store, k=1)
        existing_system = SystemMessage(content="You are a helpful assistant.")
        request = _make_request(
            [HumanMessage(content="Help me with code")],
            system_message=existing_system,
        )
        handler, _ = _make_handler()

        middleware.wrap_model_call(request, handler)

        called_request = handler.call_args[0][0]
        sys_text = called_request.system_message.text
        assert "You are a helpful assistant." in sys_text
        assert "past interactions" in sys_text.lower()

    def test_namespace_filtering(self) -> None:
        store = _make_vector_store()
        # Add episodes with different namespaces
        store.add_documents(
            [
                Document(
                    page_content="Episode for agent A",
                    metadata={"namespace": "agent_a"},
                ),
                Document(
                    page_content="Episode for agent B",
                    metadata={"namespace": "agent_b"},
                ),
            ]
        )

        middleware = EpisodicMemoryMiddleware(store, k=2, namespace="agent_a")
        request = _make_request([HumanMessage(content="Episode")])
        handler, _ = _make_handler()

        middleware.wrap_model_call(request, handler)

        called_request = handler.call_args[0][0]
        if called_request.system_message is not None:
            sys_text = called_request.system_message.text
            assert "agent A" in sys_text
            assert "agent B" not in sys_text

    def test_custom_formatter(self) -> None:
        store = _make_vector_store()
        store.add_documents([Document(page_content="Past episode")])

        def custom_formatter(docs: list[Document]) -> str:
            return f"CUSTOM: {len(docs)} episodes found"

        middleware = EpisodicMemoryMiddleware(
            store, k=1, episode_formatter=custom_formatter
        )
        request = _make_request([HumanMessage(content="Query")])
        handler, _ = _make_handler()

        middleware.wrap_model_call(request, handler)

        called_request = handler.call_args[0][0]
        assert "CUSTOM: 1 episodes found" in called_request.system_message.text


# --- Async tests ---


class TestAsyncAfterAgent:
    @pytest.mark.anyio
    async def test_stores_episode(self) -> None:
        store = _make_vector_store()
        middleware = EpisodicMemoryMiddleware(store)
        state = cast(
            "AgentState[Any]",
            {
                "messages": [
                    HumanMessage(content="Async question"),
                    AIMessage(content="Async answer"),
                ]
            },
        )

        result = await middleware.aafter_agent(state, _fake_runtime())

        assert result is None
        docs = store.similarity_search("Async", k=1)
        assert len(docs) == 1
        assert "Async" in docs[0].page_content


class TestAsyncWrapModelCall:
    @pytest.mark.anyio
    async def test_retrieves_and_injects_episodes(self) -> None:
        store = _make_vector_store()
        store.add_documents([Document(page_content="Past async episode")])

        middleware = EpisodicMemoryMiddleware(store, k=1)
        request = _make_request([HumanMessage(content="async query")])
        handler, response = _make_async_handler()

        result = await middleware.awrap_model_call(request, handler)

        assert result == response
        handler.assert_called_once()
        called_request = handler.call_args[0][0]
        assert called_request.system_message is not None

    @pytest.mark.anyio
    async def test_no_human_message_skips_retrieval(self) -> None:
        store = _make_vector_store()
        store.add_documents([Document(page_content="episode")])

        middleware = EpisodicMemoryMiddleware(store)
        request = _make_request([AIMessage(content="ai only")])
        handler, response = _make_async_handler()

        result = await middleware.awrap_model_call(request, handler)

        assert result == response
        handler.assert_called_once_with(request)


# --- Integration test (end-to-end with create_agent) ---


class TestEpisodicMemoryEndToEnd:
    def test_stores_then_retrieves(self) -> None:
        """Simulates two agent runs: first stores, second retrieves."""
        store = _make_vector_store()
        middleware = EpisodicMemoryMiddleware(store, k=1)

        # First run: store an episode via after_agent
        state_1 = cast(
            "AgentState[Any]",
            {
                "messages": [
                    HumanMessage(content="How do I deploy to AWS?"),
                    AIMessage(content="Use terraform or CloudFormation."),
                ]
            },
        )
        middleware.after_agent(state_1, _fake_runtime())

        # Second run: retrieve the episode via wrap_model_call
        request = _make_request(
            [HumanMessage(content="Help me deploy my application")]
        )
        handler, _ = _make_handler()

        middleware.wrap_model_call(request, handler)

        called_request = handler.call_args[0][0]
        assert called_request.system_message is not None
        sys_text = called_request.system_message.text
        assert "deploy" in sys_text.lower() or "AWS" in sys_text
