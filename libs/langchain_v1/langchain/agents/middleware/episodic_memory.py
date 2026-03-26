"""Episodic memory middleware for agents.

Stores completed conversation episodes in a vector store and retrieves
semantically similar past interactions to provide context for future runs.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Literal

from langchain_core.documents import Document
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.messages.utils import get_buffer_string
from typing_extensions import override

from langchain.agents.middleware.types import (
    AgentMiddleware,
    AgentState,
    ContextT,
    ModelCallResult,
    ModelRequest,
    ModelResponse,
    ResponseT,
)

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

    from langchain_core.vectorstores import VectorStore
    from langgraph.runtime import Runtime

_DEFAULT_K = 3
_DEFAULT_MAX_EPISODE_CHARS = 2000
_DEFAULT_MAX_EPISODE_PREVIEW_CHARS = 500


def _default_episode_formatter(docs: list[Document]) -> str:
    """Format retrieved episodes as a numbered list.

    Args:
        docs: Retrieved episode documents.

    Returns:
        Formatted string with numbered episodes.
    """
    parts = ["Relevant context from past interactions:"]
    for i, doc in enumerate(docs, 1):
        text = doc.page_content
        if len(text) > _DEFAULT_MAX_EPISODE_PREVIEW_CHARS:
            text = text[:_DEFAULT_MAX_EPISODE_PREVIEW_CHARS] + "..."
        parts.append(f"\n[{i}] {text}")
    return "\n".join(parts)


def _get_query_from_messages(
    messages: list[Any],
    strategy: Literal["last_human", "all_human"],
) -> str | None:
    """Extract a retrieval query from conversation messages.

    Args:
        messages: List of conversation messages.
        strategy: Which human messages to use as the query.

    Returns:
        The query string, or `None` if no human messages found.
    """
    human_messages = [m for m in messages if isinstance(m, HumanMessage)]
    if not human_messages:
        return None
    if strategy == "last_human":
        return human_messages[-1].text
    # all_human
    return " ".join(m.text for m in human_messages)


class EpisodicMemoryMiddleware(AgentMiddleware[AgentState[ResponseT], ContextT, ResponseT]):
    """Retrieve relevant past interactions from a vector store to enrich agent context.

    This middleware stores completed conversation episodes in a vector store after
    each agent run and retrieves semantically similar past episodes before model
    calls, injecting them as additional context. This enables agents to learn from
    and reference past interactions across different threads.

    Example:
        ```python
        from langchain_core.vectorstores import InMemoryVectorStore
        from langchain_core.embeddings import OpenAIEmbeddings
        from langchain.agents import create_agent
        from langchain.agents.middleware import EpisodicMemoryMiddleware

        vector_store = InMemoryVectorStore(OpenAIEmbeddings())

        agent = create_agent(
            "openai:gpt-4o",
            middleware=[
                EpisodicMemoryMiddleware(vector_store=vector_store),
            ],
        )
        ```

        Use a namespace to isolate episodes per agent or user:

        ```python
        agent = create_agent(
            "openai:gpt-4o",
            middleware=[
                EpisodicMemoryMiddleware(
                    vector_store=vector_store,
                    namespace="user_123",
                    k=5,
                    score_threshold=0.3,
                ),
            ],
        )
        ```
    """

    def __init__(
        self,
        vector_store: VectorStore,
        *,
        k: int = _DEFAULT_K,
        score_threshold: float | None = None,
        namespace: str | None = None,
        episode_formatter: Callable[[list[Document]], str] | None = None,
        query_strategy: Literal["last_human", "all_human"] = "last_human",
        max_episode_chars: int = _DEFAULT_MAX_EPISODE_CHARS,
    ) -> None:
        """Initialize episodic memory middleware.

        Args:
            vector_store: The vector store to use for storing and retrieving episodes.
                Must be initialized with an embedding model.
            k: Number of past episodes to retrieve per model call.
            score_threshold: Minimum similarity score (0-1) to include an episode.
                If `None`, all retrieved episodes are included.
            namespace: Optional namespace for isolating episodes. When set, only
                episodes stored with the same namespace are retrieved. Useful for
                multi-agent or multi-user setups.
            episode_formatter: Custom function to format retrieved episodes into a
                string for injection into the system message. Receives a list of
                `Document` objects and returns a formatted string.
            query_strategy: Strategy for constructing the retrieval query from
                conversation messages. `"last_human"` uses the most recent human
                message, `"all_human"` concatenates all human messages.
            max_episode_chars: Maximum character length for stored episode text.
                Longer conversations are truncated to avoid bloating the vector store.
        """
        if k < 1:
            msg = "k must be >= 1"
            raise ValueError(msg)
        if score_threshold is not None and not 0 <= score_threshold <= 1:
            msg = "score_threshold must be between 0 and 1"
            raise ValueError(msg)
        if max_episode_chars < 1:
            msg = "max_episode_chars must be >= 1"
            raise ValueError(msg)

        self._vector_store = vector_store
        self._k = k
        self._score_threshold = score_threshold
        self._namespace = namespace
        self._episode_formatter = episode_formatter or _default_episode_formatter
        self._query_strategy = query_strategy
        self._max_episode_chars = max_episode_chars

    @override
    def wrap_model_call(
        self,
        request: ModelRequest[ContextT],
        handler: Callable[[ModelRequest[ContextT]], ModelResponse[ResponseT]],
    ) -> ModelCallResult[ResponseT]:
        """Retrieve relevant past episodes and inject them into the model request.

        Args:
            request: The model request containing messages and configuration.
            handler: The next handler in the middleware chain.

        Returns:
            The model response, with past episodes injected into the system message
            if relevant episodes were found.
        """
        query = _get_query_from_messages(request.messages, self._query_strategy)
        if query is None:
            return handler(request)

        episodes = self._retrieve_episodes(query)
        if not episodes:
            return handler(request)

        request = self._inject_episodes(request, episodes)
        return handler(request)

    @override
    async def awrap_model_call(
        self,
        request: ModelRequest[ContextT],
        handler: Callable[[ModelRequest[ContextT]], Awaitable[ModelResponse[ResponseT]]],
    ) -> ModelCallResult[ResponseT]:
        """Async version of wrap_model_call.

        Args:
            request: The model request containing messages and configuration.
            handler: The next async handler in the middleware chain.

        Returns:
            The model response, with past episodes injected into the system message
            if relevant episodes were found.
        """
        query = _get_query_from_messages(request.messages, self._query_strategy)
        if query is None:
            return await handler(request)

        episodes = await self._aretrieve_episodes(query)
        if not episodes:
            return await handler(request)

        request = self._inject_episodes(request, episodes)
        return await handler(request)

    @override
    def after_agent(
        self, state: AgentState[ResponseT], runtime: Runtime[ContextT]
    ) -> dict[str, Any] | None:
        """Store the completed conversation as an episode in the vector store.

        Args:
            state: The final agent state containing all messages.
            runtime: The runtime context.

        Returns:
            `None` — no state modification needed.
        """
        self._store_episode(state)
        return None

    @override
    async def aafter_agent(
        self, state: AgentState[ResponseT], runtime: Runtime[ContextT]
    ) -> dict[str, Any] | None:
        """Async version of after_agent.

        Args:
            state: The final agent state containing all messages.
            runtime: The runtime context.

        Returns:
            `None` — no state modification needed.
        """
        await self._astore_episode(state)
        return None

    def _retrieve_episodes(self, query: str) -> list[Document]:
        """Retrieve relevant past episodes from the vector store.

        Args:
            query: The retrieval query string.

        Returns:
            List of relevant episode documents, filtered by score threshold
            and namespace.
        """
        results: list[tuple[Document, float]] = (
            self._vector_store.similarity_search_with_score(query, k=self._k)
        )
        return self._filter_results(results)

    async def _aretrieve_episodes(self, query: str) -> list[Document]:
        """Async version of _retrieve_episodes.

        Args:
            query: The retrieval query string.

        Returns:
            List of relevant episode documents.
        """
        results: list[tuple[Document, float]] = (
            await self._vector_store.asimilarity_search_with_score(query, k=self._k)
        )
        return self._filter_results(results)

    def _filter_results(
        self, results: list[tuple[Document, float]]
    ) -> list[Document]:
        """Filter search results by score threshold and namespace.

        Args:
            results: List of (document, score) tuples from vector store search.

        Returns:
            Filtered list of documents.
        """
        filtered: list[Document] = []
        for doc, score in results:
            if self._score_threshold is not None and score < self._score_threshold:
                continue
            if self._namespace is not None:
                doc_ns = doc.metadata.get("namespace")
                if doc_ns != self._namespace:
                    continue
            filtered.append(doc)
        return filtered

    def _inject_episodes(
        self,
        request: ModelRequest[ContextT],
        episodes: list[Document],
    ) -> ModelRequest[ContextT]:
        """Inject retrieved episodes into the model request's system message.

        Args:
            request: The original model request.
            episodes: Retrieved episode documents to inject.

        Returns:
            A new model request with episodes prepended to the system message.
        """
        episode_text = self._episode_formatter(episodes)
        existing = request.system_message
        new_content = (
            f"{episode_text}\n\n{existing.text}" if existing is not None else episode_text
        )
        return request.override(system_message=SystemMessage(content=new_content))

    def _store_episode(self, state: AgentState[ResponseT]) -> None:
        """Store the conversation as an episode document.

        Args:
            state: The agent state containing messages.
        """
        document = self._build_episode_document(state)
        if document is not None:
            self._vector_store.add_documents([document])

    async def _astore_episode(self, state: AgentState[ResponseT]) -> None:
        """Async version of _store_episode.

        Args:
            state: The agent state containing messages.
        """
        document = self._build_episode_document(state)
        if document is not None:
            await self._vector_store.aadd_documents([document])

    def _build_episode_document(
        self, state: AgentState[ResponseT]
    ) -> Document | None:
        """Build a Document from the conversation state.

        Args:
            state: The agent state containing messages.

        Returns:
            A Document with the serialized conversation, or `None` if
            the conversation is empty.
        """
        messages = state.get("messages", [])
        if not messages:
            return None

        text = get_buffer_string(messages)
        if len(text) > self._max_episode_chars:
            text = text[: self._max_episode_chars]

        metadata: dict[str, Any] = {
            "message_count": len(messages),
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        }
        if self._namespace is not None:
            metadata["namespace"] = self._namespace

        return Document(page_content=text, metadata=metadata)
