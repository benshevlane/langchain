"""Hunter.io API client for email discovery.

Provides domain search and email finder endpoints. Set ``HUNTER_MOCK=true``
for fixture data during development, or it will auto-mock when
``HUNTER_API_KEY`` is not set.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_BASE_URL = "https://api.hunter.io/v2"
_TIMEOUT = 15

# ---------------------------------------------------------------------------
# Mock data
# ---------------------------------------------------------------------------

_MOCK_DOMAIN_SEARCH: dict[str, Any] = {
    "emails": [
        {
            "value": "editor@example.com",
            "type": "generic",
            "confidence": 90,
            "first_name": "",
            "last_name": "",
            "position": "Editor",
            "department": "communication",
        },
        {
            "value": "james@example.com",
            "type": "personal",
            "confidence": 85,
            "first_name": "James",
            "last_name": "Smith",
            "position": "Content Manager",
            "department": "communication",
        },
    ],
    "pattern": "{first}@example.com",
    "organization": "Example Blog",
}

_MOCK_EMAIL_FINDER: dict[str, Any] = {
    "email": "james@example.com",
    "score": 85,
    "position": "Content Manager",
    "first_name": "James",
    "last_name": "Smith",
}


def _is_mock() -> bool:
    explicit = os.getenv("HUNTER_MOCK")
    if explicit is not None:
        return explicit.lower() in ("true", "1", "yes")
    return not bool(os.getenv("HUNTER_API_KEY"))


def _get_api_key() -> str:
    key = os.environ.get("HUNTER_API_KEY", "")
    if not key:
        msg = "HUNTER_API_KEY environment variable is not set"
        raise RuntimeError(msg)
    return key


def domain_search(domain: str, limit: int = 10) -> dict[str, Any]:
    """Search for email addresses associated with a domain.

    Args:
        domain: The domain to search (e.g. ``realhomes.com``).
        limit: Maximum number of emails to return.

    Returns:
        Dict with ``emails`` list, ``pattern``, and ``organization``.
    """
    if _is_mock():
        return _MOCK_DOMAIN_SEARCH

    api_key = _get_api_key()
    try:
        resp = httpx.get(
            f"{_BASE_URL}/domain-search",
            params={"domain": domain, "limit": limit, "api_key": api_key},
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json().get("data", {})
        return {
            "emails": data.get("emails", []),
            "pattern": data.get("pattern", ""),
            "organization": data.get("organization", ""),
        }
    except httpx.HTTPStatusError:
        logger.warning("Hunter domain search failed for %s", domain, exc_info=True)
        return {"emails": [], "pattern": "", "organization": ""}
    except Exception:
        logger.warning("Hunter domain search error for %s", domain, exc_info=True)
        return {"emails": [], "pattern": "", "organization": ""}


def find_email(
    domain: str, first_name: str, last_name: str
) -> dict[str, Any]:
    """Find a specific person's email at a domain.

    Args:
        domain: The domain to search.
        first_name: The person's first name.
        last_name: The person's last name.

    Returns:
        Dict with ``email``, ``score``, ``position``, ``first_name``, ``last_name``.
    """
    if _is_mock():
        return _MOCK_EMAIL_FINDER

    api_key = _get_api_key()
    try:
        resp = httpx.get(
            f"{_BASE_URL}/email-finder",
            params={
                "domain": domain,
                "first_name": first_name,
                "last_name": last_name,
                "api_key": api_key,
            },
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json().get("data", {})
        return {
            "email": data.get("email", ""),
            "score": data.get("score", 0),
            "position": data.get("position", ""),
            "first_name": data.get("first_name", ""),
            "last_name": data.get("last_name", ""),
        }
    except httpx.HTTPStatusError:
        logger.warning(
            "Hunter email finder failed for %s %s @ %s",
            first_name, last_name, domain, exc_info=True,
        )
        return {"email": "", "score": 0, "position": "", "first_name": "", "last_name": ""}
    except Exception:
        logger.warning(
            "Hunter email finder error for %s %s @ %s",
            first_name, last_name, domain, exc_info=True,
        )
        return {"email": "", "score": 0, "position": "", "first_name": "", "last_name": ""}


def get_best_contact(
    domain: str, author_name: str = ""
) -> dict[str, Any]:
    """Find the best contact email for a domain, trying multiple strategies.

    Strategy order:
    1. If author name is known, try email finder for that person.
    2. Fall back to domain search and pick the best personal email.
    3. If no personal emails, return the highest-confidence generic one.

    Args:
        domain: The target domain.
        author_name: The author's full name, if known.

    Returns:
        Dict with ``email``, ``confidence``, ``source``, ``name``, ``position``.
    """
    result: dict[str, Any] = {
        "email": "",
        "confidence": 0,
        "source": "",
        "name": "",
        "position": "",
    }

    # Strategy 1: try email finder if we have an author name
    if author_name and " " in author_name:
        parts = author_name.strip().split(None, 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ""
        if first_name and last_name:
            finder_result = find_email(domain, first_name, last_name)
            if finder_result.get("email") and finder_result.get("score", 0) >= 50:
                return {
                    "email": finder_result["email"],
                    "confidence": finder_result["score"],
                    "source": "hunter_finder",
                    "name": author_name,
                    "position": finder_result.get("position", ""),
                }

    # Strategy 2: domain search
    search_result = domain_search(domain, limit=10)
    emails = search_result.get("emails", [])

    # Prefer personal emails over generic
    personal = [e for e in emails if e.get("type") == "personal"]
    generic = [e for e in emails if e.get("type") == "generic"]

    best_list = personal if personal else generic
    if best_list:
        best = max(best_list, key=lambda e: e.get("confidence", 0))
        name_parts = []
        if best.get("first_name"):
            name_parts.append(best["first_name"])
        if best.get("last_name"):
            name_parts.append(best["last_name"])

        result = {
            "email": best.get("value", ""),
            "confidence": best.get("confidence", 0),
            "source": "hunter_domain_search",
            "name": " ".join(name_parts) if name_parts else "",
            "position": best.get("position", ""),
        }

    return result
