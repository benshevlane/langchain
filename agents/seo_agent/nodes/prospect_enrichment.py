"""Prospect enrichment node — adds context and contact data to raw prospects.

For each new prospect, summarises the page, extracts contact patterns,
pulls DR/traffic from Ahrefs data, and checks competitor link overlap.

Contact discovery uses a multi-source pipeline:
1. Check article page for author/email.
2. Crawl /contact, /about, /write-for-us pages for emails.
3. Hunter.io lookup (domain search + email finder).
4. LLM extraction as final fallback.
"""

from __future__ import annotations

import logging
import re
from typing import Any
from urllib.parse import urlparse

import httpx

from agents.seo_agent.state import SEOAgentState
from agents.seo_agent.tools import llm_router, supabase_tools

logger = logging.getLogger(__name__)

_EMAIL_REGEX = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}",
)

_CONTACT_PATHS = ("/contact", "/about", "/write-for-us", "/advertise", "/contact-us")

_FETCH_TIMEOUT = 12
_USER_AGENT = "Mozilla/5.0 (compatible; RalfSEOBot/1.0; +https://ralfseo.com/bot)"

# Generic addresses to deprioritise
_GENERIC_PREFIXES = frozenset({
    "noreply", "no-reply", "mailer-daemon", "postmaster",
    "abuse", "spam", "unsubscribe",
})


def _is_useless_email(email: str) -> bool:
    """Check if an email is a no-reply or system address."""
    prefix = email.split("@")[0].lower()
    return prefix in _GENERIC_PREFIXES


def _extract_domain(url: str) -> str:
    """Extract root domain from a URL."""
    try:
        return urlparse(url).netloc.lower().removeprefix("www.")
    except Exception:
        return ""


def _scrape_emails_from_url(url: str) -> list[str]:
    """Fetch a URL and extract email addresses from the HTML.

    Args:
        url: The page URL to scrape.

    Returns:
        List of unique email addresses found.
    """
    try:
        resp = httpx.get(
            url,
            follow_redirects=True,
            timeout=_FETCH_TIMEOUT,
            headers={"User-Agent": _USER_AGENT},
        )
        if resp.status_code >= 400:
            return []
        emails = _EMAIL_REGEX.findall(resp.text)
        # Deduplicate and filter useless addresses
        seen: set[str] = set()
        clean: list[str] = []
        for e in emails:
            lower = e.lower()
            if lower not in seen and not _is_useless_email(lower):
                seen.add(lower)
                clean.append(e)
        return clean
    except Exception:
        return []


def _crawl_contact_pages(domain: str) -> dict[str, Any]:
    """Crawl common contact pages on a domain for email addresses.

    Tries /contact, /about, /write-for-us, /advertise in order.

    Args:
        domain: The target domain (e.g. ``realhomes.com``).

    Returns:
        Dict with ``email``, ``source_path``, and ``all_emails`` fields.
    """
    base_url = f"https://{domain}"
    all_emails: list[str] = []
    source_path = ""

    for path in _CONTACT_PATHS:
        url = f"{base_url}{path}"
        emails = _scrape_emails_from_url(url)
        if emails:
            all_emails.extend(emails)
            if not source_path:
                source_path = path

    # Deduplicate preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for e in all_emails:
        if e.lower() not in seen:
            seen.add(e.lower())
            unique.append(e)

    return {
        "email": unique[0] if unique else "",
        "source_path": source_path,
        "all_emails": unique,
    }


def _discover_contact(
    domain: str,
    page_url: str,
    author_name: str,
    *,
    weekly_spend: float,
    site: str,
) -> dict[str, Any]:
    """Multi-source contact discovery pipeline.

    Tries four strategies in order of reliability:
    1. Scrape emails from the article page itself.
    2. Crawl /contact, /about, /write-for-us pages.
    3. Hunter.io lookup (domain search + email finder).
    4. LLM-based extraction as fallback.

    Args:
        domain: The prospect domain.
        page_url: The prospect page URL.
        author_name: Author name if known from prior extraction.
        weekly_spend: Current weekly LLM spend in USD.
        site: Target site name for cost logging.

    Returns:
        Dict with ``email``, ``author_name``, ``contact_source``,
        ``confidence``, and ``cost_usd`` fields.
    """
    result: dict[str, Any] = {
        "email": "",
        "author_name": author_name,
        "contact_source": "",
        "confidence": "low",
        "cost_usd": 0.0,
    }

    # Strategy 1: scrape the article page itself
    article_emails = _scrape_emails_from_url(page_url)
    if article_emails:
        result["email"] = article_emails[0]
        result["contact_source"] = "article_page"
        result["confidence"] = "medium"
        logger.debug("Found email on article page %s: %s", page_url, article_emails[0])
        return result

    # Strategy 2: crawl contact pages
    contact_result = _crawl_contact_pages(domain)
    if contact_result["email"]:
        result["email"] = contact_result["email"]
        result["contact_source"] = f"contact_page:{contact_result['source_path']}"
        result["confidence"] = "medium"
        logger.debug("Found email on contact page for %s: %s", domain, contact_result["email"])
        return result

    # Strategy 3: Hunter.io
    try:
        from agents.seo_agent.tools.hunter_tools import get_best_contact

        hunter_result = get_best_contact(domain, author_name)
        if hunter_result.get("email") and hunter_result.get("confidence", 0) >= 30:
            result["email"] = hunter_result["email"]
            result["contact_source"] = hunter_result.get("source", "hunter")
            result["confidence"] = "high" if hunter_result["confidence"] >= 70 else "medium"
            if hunter_result.get("name"):
                result["author_name"] = hunter_result["name"]
            logger.debug("Found email via Hunter.io for %s: %s", domain, hunter_result["email"])
            return result
    except Exception:
        logger.debug("Hunter.io lookup failed for %s", domain, exc_info=True)

    # Strategy 4: LLM extraction fallback
    try:
        contact_resp = _extract_contact(
            domain, page_url, weekly_spend=weekly_spend, site=site,
        )
        contact_data = _parse_contact_response(contact_resp["text"])
        result["cost_usd"] = contact_resp.get("cost_usd", 0.0)
        if contact_data.get("email_pattern"):
            result["email"] = contact_data["email_pattern"]
            result["contact_source"] = "llm_guess"
            result["confidence"] = contact_data.get("confidence", "low")
        if contact_data.get("author_name") and contact_data["author_name"] != "unknown":
            result["author_name"] = contact_data["author_name"]
    except Exception:
        logger.debug("LLM contact extraction failed for %s", domain, exc_info=True)

    return result


def _summarise_page(
    page_url: str,
    page_title: str,
    *,
    weekly_spend: float,
    site: str,
) -> dict[str, Any]:
    """Use an LLM to generate a short summary of a prospect page.

    Args:
        page_url: The URL of the page to summarise.
        page_title: The title of the page, if known.
        weekly_spend: Current weekly LLM spend in USD.
        site: Target site name for cost logging.

    Returns:
        The LLM response dict including `text` and `cost_usd`.
    """
    return llm_router.call_llm(
        task="summarise_page",
        messages=[
            {
                "role": "user",
                "content": (
                    f"Summarise this web page in 2-3 sentences for a link-building "
                    f"outreach specialist. Focus on the topic, audience, and whether "
                    f"it links out to external resources.\n\n"
                    f"URL: {page_url}\n"
                    f"Title: {page_title}"
                ),
            },
        ],
        system="You are an SEO analyst. Be concise and factual.",
        weekly_spend=weekly_spend,
        site=site,
        log_fn=supabase_tools.log_llm_cost,
    )


def _extract_contact(
    domain: str,
    page_url: str,
    *,
    weekly_spend: float,
    site: str,
) -> dict[str, Any]:
    """Use an LLM to guess contact email patterns for a domain.

    Args:
        domain: The prospect domain.
        page_url: The prospect page URL.
        weekly_spend: Current weekly LLM spend in USD.
        site: Target site name for cost logging.

    Returns:
        The LLM response dict including `text` and `cost_usd`.
    """
    return llm_router.call_llm(
        task="extract_contact_email",
        messages=[
            {
                "role": "user",
                "content": (
                    f"Given this domain and page URL, suggest the most likely "
                    f"contact email pattern (e.g. editor@, hello@, firstname@). "
                    f"If you can identify the author name, include it.\n\n"
                    f"Domain: {domain}\n"
                    f"Page URL: {page_url}\n\n"
                    f"Respond in this exact format:\n"
                    f"email_pattern: <pattern>\n"
                    f"author_name: <name or unknown>\n"
                    f"confidence: <high/medium/low>"
                ),
            },
        ],
        system="You are an email research specialist. Be concise.",
        weekly_spend=weekly_spend,
        site=site,
        log_fn=supabase_tools.log_llm_cost,
    )


def _parse_contact_response(text: str) -> dict[str, str]:
    """Parse the structured LLM response for contact extraction.

    Args:
        text: The raw LLM response text.

    Returns:
        Dict with `email_pattern`, `author_name`, and `confidence`.
    """
    result: dict[str, str] = {
        "email_pattern": "",
        "author_name": "",
        "confidence": "low",
    }
    for line in text.strip().splitlines():
        line = line.strip()
        if line.lower().startswith("email_pattern:"):
            result["email_pattern"] = line.split(":", 1)[1].strip()
        elif line.lower().startswith("author_name:"):
            result["author_name"] = line.split(":", 1)[1].strip()
        elif line.lower().startswith("confidence:"):
            result["confidence"] = line.split(":", 1)[1].strip().lower()
    return result


def _get_prospects_from_state_or_db(
    state: SEOAgentState,
) -> list[dict[str, Any]]:
    """Get prospects to enrich from state or fall back to Supabase query.

    Args:
        state: The current SEO agent state.

    Returns:
        List of prospect dicts with status ``new``.
    """
    prospects = state.get("backlink_prospects", [])
    if prospects:
        return [p for p in prospects if p.get("status") == "new"]

    return supabase_tools.query_table(
        "seo_backlink_prospects",
        filters={"status": "new"},
        limit=200,
        order_by="created_at",
        order_desc=False,
    )


def run_prospect_enrichment(state: SEOAgentState) -> dict[str, Any]:
    """Enrich backlink prospects with page summaries, contacts, and metrics.

    Takes prospects from state or queries Supabase for prospects with status
    ``new``. For each prospect, summarises the page via LLM, extracts
    contact email patterns, and augments with DR/traffic data. Updates
    records in Supabase and sets status to ``enriched``.

    Args:
        state: The current SEO agent state.

    Returns:
        State update with `enriched_prospects`, `errors`, and `next_node`.
    """
    errors: list[str] = list(state.get("errors", []))
    target_site = state["target_site"]
    weekly_spend = state.get("llm_spend_this_week", 0.0)
    enriched: list[dict[str, Any]] = []

    prospects = _get_prospects_from_state_or_db(state)
    if not prospects:
        logger.info("No new prospects to enrich for %s", target_site)
        return {
            "enriched_prospects": [],
            "errors": errors,
            "next_node": "END",
        }

    logger.info("Enriching %d prospects for %s", len(prospects), target_site)

    for prospect in prospects:
        prospect_id = prospect.get("id", "")
        domain = prospect.get("domain", "")
        page_url = prospect.get("page_url", "")
        page_title = prospect.get("page_title", "")

        enrichment: dict[str, Any] = {}

        # Summarise the page
        try:
            summary_resp = _summarise_page(
                page_url,
                page_title,
                weekly_spend=weekly_spend,
                site=target_site,
            )
            enrichment["page_summary"] = summary_resp["text"]
            weekly_spend += summary_resp.get("cost_usd", 0.0)
        except Exception:
            msg = f"Failed to summarise page {page_url}"
            logger.warning(msg, exc_info=True)
            errors.append(msg)
            enrichment["page_summary"] = ""

        # Discover contact email via multi-source pipeline
        try:
            contact_result = _discover_contact(
                domain,
                page_url,
                prospect.get("author_name", ""),
                weekly_spend=weekly_spend,
                site=target_site,
            )
            enrichment["contact_email"] = contact_result["email"]
            enrichment["author_name"] = contact_result["author_name"]
            enrichment["contact_source"] = contact_result["contact_source"]
            weekly_spend += contact_result.get("cost_usd", 0.0)
        except Exception:
            msg = f"Failed to discover contact for {domain}"
            logger.warning(msg, exc_info=True)
            errors.append(msg)
            enrichment["contact_email"] = ""
            enrichment["author_name"] = ""
            enrichment["contact_source"] = ""

        # Fetch DR from Ahrefs if not already known
        existing_dr = prospect.get("dr", 0)
        if not existing_dr or existing_dr == 0:
            try:
                from agents.seo_agent.tools.ahrefs_tools import get_domain_rating
                dr_data = get_domain_rating(prospect.get("domain", ""))
                if isinstance(dr_data, dict):
                    enrichment["dr"] = dr_data.get("domain_rating", 0)
                elif isinstance(dr_data, (int, float)):
                    enrichment["dr"] = dr_data
                else:
                    enrichment["dr"] = 0
                logger.info("Fetched DR for %s: %s", prospect.get("domain"), enrichment["dr"])
            except Exception:
                logger.warning("Failed to fetch DR for %s", prospect.get("domain"), exc_info=True)
                enrichment["dr"] = 0
        else:
            enrichment["dr"] = existing_dr
        enrichment["monthly_traffic"] = prospect.get("monthly_traffic", 0)

        # Check if the prospect links to competitors (preserve existing data)
        enrichment["links_to_competitor"] = prospect.get(
            "links_to_competitor", False
        )
        enrichment["competitor_names"] = prospect.get("competitor_names", [])

        # Update the record in Supabase
        update_data = {
            **enrichment,
            "status": "enriched",
        }

        if prospect_id:
            update_data["id"] = prospect_id

        try:
            if prospect_id:
                updated = supabase_tools.upsert_record(
                    "seo_backlink_prospects", update_data
                )
            else:
                updated = {**prospect, **update_data}
            enriched.append(updated)
        except Exception:
            msg = f"Failed to update enrichment data for prospect {domain}"
            logger.warning(msg, exc_info=True)
            errors.append(msg)
            enriched.append({**prospect, **enrichment, "status": "enriched"})

    logger.info(
        "Enrichment complete for %s: %d prospects enriched",
        target_site,
        len(enriched),
    )

    return {
        "enriched_prospects": enriched,
        "errors": errors,
        "next_node": "END",
    }
