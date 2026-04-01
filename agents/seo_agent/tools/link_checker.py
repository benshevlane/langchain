"""Link verification tool — checks whether a backlink exists on a target page.

Fetches the page HTML and searches for ``<a>`` tags pointing to our domain.
Extracts anchor text, rel attributes, and surrounding context.
"""

from __future__ import annotations

import logging
import re
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_TIMEOUT = 20
_USER_AGENT = (
    "Mozilla/5.0 (compatible; RalfSEOBot/1.0; +https://ralfseo.com/bot)"
)


def _normalise_domain(url: str) -> str:
    """Extract and normalise the domain from a URL.

    Args:
        url: A fully-qualified URL.

    Returns:
        Lowercased domain without ``www.`` prefix.
    """
    try:
        return urlparse(url).netloc.lower().removeprefix("www.")
    except Exception:
        return ""


def verify_link(
    target_page_url: str, our_domain: str
) -> dict[str, Any]:
    """Check whether a page contains a link to our domain.

    Fetches the page, parses all ``<a>`` tags, and checks if any ``href``
    points to the specified domain. Returns details about the first match.

    Args:
        target_page_url: The URL of the page to check.
        our_domain: Our domain to search for (e.g. ``freeroomplanner.com``).

    Returns:
        Dict with ``found``, ``anchor_text``, ``href``, ``rel``,
        ``do_follow``, ``context``, and ``error`` fields.
    """
    result: dict[str, Any] = {
        "found": False,
        "anchor_text": "",
        "href": "",
        "rel": "",
        "do_follow": True,
        "context": "",
        "all_matches": [],
        "error": "",
    }

    our_domain_clean = our_domain.lower().removeprefix("www.").removeprefix("https://").removeprefix("http://")

    try:
        resp = httpx.get(
            target_page_url,
            follow_redirects=True,
            timeout=_TIMEOUT,
            headers={"User-Agent": _USER_AGENT},
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        result["error"] = f"HTTP {exc.response.status_code}"
        return result
    except Exception as exc:
        result["error"] = str(exc)
        return result

    html = resp.text

    # Parse <a> tags using regex (avoids heavy dependency on lxml/bs4)
    # Pattern matches <a ...href="..."...>...</a>
    link_pattern = re.compile(
        r'<a\s[^>]*href=["\']([^"\']*)["\'][^>]*>(.*?)</a>',
        re.IGNORECASE | re.DOTALL,
    )

    matches: list[dict[str, Any]] = []

    for match in link_pattern.finditer(html):
        href = match.group(1).strip()
        anchor_html = match.group(2).strip()
        full_tag = match.group(0)

        # Check if the href points to our domain
        href_domain = _normalise_domain(href)
        href_clean = href.lower().removeprefix("www.").removeprefix("https://").removeprefix("http://")

        if our_domain_clean not in href_domain and not href_clean.startswith(our_domain_clean):
            continue

        # Strip HTML tags from anchor text
        anchor_text = re.sub(r"<[^>]+>", "", anchor_html).strip()

        # Extract rel attribute
        rel_match = re.search(r'rel=["\']([^"\']*)["\']', full_tag, re.IGNORECASE)
        rel = rel_match.group(1) if rel_match else ""
        do_follow = "nofollow" not in rel.lower()

        # Get surrounding context (50 chars before and after the tag)
        tag_start = match.start()
        tag_end = match.end()
        context_start = max(0, tag_start - 80)
        context_end = min(len(html), tag_end + 80)
        context = re.sub(r"<[^>]+>", "", html[context_start:context_end]).strip()
        # Collapse whitespace
        context = re.sub(r"\s+", " ", context)

        link_data = {
            "anchor_text": anchor_text,
            "href": href,
            "rel": rel,
            "do_follow": do_follow,
            "context": context[:200],
        }
        matches.append(link_data)

    if matches:
        best = matches[0]
        result["found"] = True
        result["anchor_text"] = best["anchor_text"]
        result["href"] = best["href"]
        result["rel"] = best["rel"]
        result["do_follow"] = best["do_follow"]
        result["context"] = best["context"]
        result["all_matches"] = matches

    return result


def verify_links_batch(
    links: list[dict[str, str]],
) -> list[dict[str, Any]]:
    """Verify multiple links in sequence.

    Args:
        links: List of dicts, each with ``target_page_url`` and ``our_domain``.

    Returns:
        List of verification results, one per input link.
    """
    results: list[dict[str, Any]] = []
    for link in links:
        target_url = link.get("target_page_url", link.get("target_url", ""))
        our_domain = link.get("our_domain", "")
        if not target_url or not our_domain:
            results.append({"found": False, "error": "missing target_page_url or our_domain"})
            continue
        result = verify_link(target_url, our_domain)
        result["target_page_url"] = target_url
        result["our_domain"] = our_domain
        results.append(result)
    return results
