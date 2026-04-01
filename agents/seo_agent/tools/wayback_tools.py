"""Wayback Machine client — retrieves archived snapshots of dead pages.

Uses the Wayback CDX API (free, no auth required) to find the most recent
snapshot of a URL, then fetches the archived page to extract title and a
short summary of what it covered.
"""

from __future__ import annotations

import logging
import re
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_CDX_URL = "https://web.archive.org/cdx/search/cdx"
_TIMEOUT = 20
_USER_AGENT = (
    "Mozilla/5.0 (compatible; RalfSEOBot/1.0; +https://ralfseo.com/bot)"
)


def get_archived_snapshot(url: str) -> dict[str, Any]:
    """Fetch the most recent Wayback Machine snapshot of a URL.

    Queries the CDX API for the latest archived version, then fetches the
    archived page to extract the title and a text excerpt.

    Args:
        url: The (dead) URL to look up in the Wayback Machine.

    Returns:
        Dict with ``archived_url``, ``timestamp``, ``title``, ``excerpt``,
        and ``found`` fields.
    """
    result: dict[str, Any] = {
        "found": False,
        "archived_url": "",
        "timestamp": "",
        "title": "",
        "excerpt": "",
        "error": "",
    }

    # Query CDX API for the most recent successful snapshot
    try:
        cdx_resp = httpx.get(
            _CDX_URL,
            params={
                "url": url,
                "output": "json",
                "limit": 1,
                "fl": "timestamp,original,statuscode,mimetype",
                "filter": "statuscode:200",
                "sort": "reverse",
            },
            timeout=_TIMEOUT,
            headers={"User-Agent": _USER_AGENT},
        )
        cdx_resp.raise_for_status()
    except Exception as exc:
        result["error"] = f"CDX API request failed: {exc}"
        logger.warning("Wayback CDX lookup failed for %s: %s", url, exc)
        return result

    rows = cdx_resp.json()

    # CDX returns a header row + data rows
    if len(rows) < 2:
        result["error"] = "No archived snapshots found"
        return result

    # First row is headers, second is the most recent snapshot
    header = rows[0]
    data = rows[1]

    # Build a dict from header + data
    snapshot = dict(zip(header, data))
    timestamp = snapshot.get("timestamp", "")
    original = snapshot.get("original", url)

    archived_url = f"https://web.archive.org/web/{timestamp}/{original}"
    result["archived_url"] = archived_url
    result["timestamp"] = timestamp
    result["found"] = True

    # Fetch the archived page to extract title and excerpt
    try:
        page_resp = httpx.get(
            archived_url,
            follow_redirects=True,
            timeout=_TIMEOUT,
            headers={"User-Agent": _USER_AGENT},
        )
        page_resp.raise_for_status()
        html = page_resp.text

        # Extract title
        title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
        if title_match:
            title = re.sub(r"\s+", " ", title_match.group(1)).strip()
            result["title"] = title[:200]

        # Extract text excerpt from body
        # Remove script and style blocks first
        clean = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", html, flags=re.IGNORECASE | re.DOTALL)
        # Remove Wayback Machine toolbar injection
        clean = re.sub(r"<!-- BEGIN WAYBACK TOOLBAR INSERT -->.*?<!-- END WAYBACK TOOLBAR INSERT -->", "", clean, flags=re.DOTALL)
        # Strip remaining HTML tags
        text = re.sub(r"<[^>]+>", " ", clean)
        # Collapse whitespace
        text = re.sub(r"\s+", " ", text).strip()

        # Take first ~300 chars as excerpt
        if text:
            result["excerpt"] = text[:300].strip()

    except Exception as exc:
        logger.warning("Failed to fetch archived page %s: %s", archived_url, exc)
        # We still have the URL and timestamp, just no content

    return result


def summarise_dead_page(
    url: str,
    *,
    weekly_spend: float = 0.0,
    site: str = "",
) -> dict[str, Any]:
    """Look up a dead URL in Wayback and generate a short topic summary.

    Combines Wayback archive lookup with LLM summarisation to produce a
    2-sentence description of what the dead page covered.

    Args:
        url: The dead URL to research.
        weekly_spend: Current weekly LLM spend for budget tracking.
        site: Target site name for cost logging.

    Returns:
        Dict with ``dead_page_topic``, ``wayback_url``, ``title``, and
        ``found`` fields.
    """
    snapshot = get_archived_snapshot(url)

    if not snapshot["found"]:
        return {
            "dead_page_topic": "",
            "wayback_url": "",
            "title": "",
            "found": False,
        }

    # If we have enough context from title + excerpt, summarise with LLM
    title = snapshot.get("title", "")
    excerpt = snapshot.get("excerpt", "")

    if title or excerpt:
        try:
            from agents.seo_agent.tools import llm_router, supabase_tools

            context = f"Title: {title}\nExcerpt: {excerpt[:200]}" if excerpt else f"Title: {title}"
            resp = llm_router.call_llm(
                task="summarise_page",
                messages=[
                    {
                        "role": "user",
                        "content": (
                            f"This web page is now dead (404). Based on the archived "
                            f"version, describe in one sentence what it covered.\n\n"
                            f"URL: {url}\n{context}"
                        ),
                    },
                ],
                system="You are an SEO analyst. Be concise and factual. One sentence only.",
                weekly_spend=weekly_spend,
                site=site,
                log_fn=supabase_tools.log_llm_cost,
            )
            topic = resp.get("text", "").strip()
        except Exception:
            logger.warning("LLM summarisation failed for dead page %s", url, exc_info=True)
            # Fall back to title
            topic = title if title else ""
    else:
        topic = ""

    return {
        "dead_page_topic": topic,
        "wayback_url": snapshot["archived_url"],
        "title": title,
        "found": True,
    }
