"""Link verifier node — checks that acquired backlinks are still live.

Queries ``outreach_links`` and ``seo_backlink_prospects`` for links due
for verification, fetches each target page, and updates the ``is_live``,
``anchor_text``, ``do_follow``, and ``last_checked_at`` fields.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from agents.seo_agent.config import SITE_PROFILES
from agents.seo_agent.state import SEOAgentState
from agents.seo_agent.tools import supabase_tools
from agents.seo_agent.tools.link_checker import verify_link

logger = logging.getLogger(__name__)

# Re-check links that haven't been verified in the last 7 days
_RECHECK_DAYS = 7


def _get_links_to_verify(target_site: str) -> list[dict[str, Any]]:
    """Fetch links from ``outreach_links`` that need verification.

    Returns links where ``last_checked_at`` is older than 7 days, plus any
    prospects with status ``link_acquired`` that don't yet have an
    ``outreach_links`` record.

    Args:
        target_site: The target site key to filter by.

    Returns:
        List of dicts with ``id``, ``target_url``, ``our_domain``, ``source_table``.
    """
    links_to_check: list[dict[str, Any]] = []
    cutoff = (datetime.now(tz=timezone.utc) - timedelta(days=_RECHECK_DAYS)).isoformat()

    profile = SITE_PROFILES.get(target_site, {})
    our_domain = profile.get("domain", "")
    if not our_domain:
        logger.warning("No domain found for target_site %s", target_site)
        return []

    # 1. Existing outreach_links records due for re-check
    filters: dict[str, Any] = {}
    if target_site != "all":
        filters["site_id"] = target_site

    existing_links = supabase_tools.query_table(
        "outreach_links",
        filters=filters,
        limit=200,
        order_by="last_checked_at",
        order_desc=False,
    )

    for link in existing_links:
        last_checked = link.get("last_checked_at", "")
        if not last_checked or str(last_checked) < cutoff:
            links_to_check.append({
                "id": link.get("id", ""),
                "target_url": link.get("target_url", ""),
                "link_url": link.get("link_url", ""),
                "our_domain": our_domain,
                "source_table": "outreach_links",
            })

    # 2. Prospects with status=link_acquired that may not have an outreach_links record
    prospect_filters: dict[str, Any] = {"status": "link_acquired"}
    if target_site != "all":
        prospect_filters["target_site"] = target_site

    acquired_prospects = supabase_tools.query_table(
        "seo_backlink_prospects",
        filters=prospect_filters,
        limit=200,
    )

    # Find prospects not already covered by outreach_links
    existing_target_urls = {link.get("target_url", "") for link in existing_links}
    for prospect in acquired_prospects:
        page_url = prospect.get("page_url", "")
        if page_url and page_url not in existing_target_urls:
            links_to_check.append({
                "id": prospect.get("id", ""),
                "target_url": page_url,
                "link_url": "",
                "our_domain": our_domain,
                "source_table": "seo_backlink_prospects",
                "prospect_domain": prospect.get("domain", ""),
            })

    return links_to_check


def run_link_verifier(state: SEOAgentState) -> dict[str, Any]:
    """Verify that acquired backlinks are still live on target pages.

    For each link due for verification, fetches the target page and checks
    for a link to our domain. Updates ``outreach_links`` with current status.
    If a link is found on a prospect that didn't have an ``outreach_links``
    record, creates one.

    Args:
        state: The current SEO agent state.

    Returns:
        State update with ``report``, ``errors``, and ``next_node``.
    """
    errors: list[str] = list(state.get("errors", []))
    target_site = state["target_site"]

    links = _get_links_to_verify(target_site)
    if not links:
        logger.info("No links to verify for %s", target_site)
        return {
            "report": "No links due for verification.",
            "errors": errors,
            "next_node": "END",
        }

    logger.info("Verifying %d links for %s", len(links), target_site)

    verified_count = 0
    live_count = 0
    dead_count = 0
    new_records = 0

    now = datetime.now(tz=timezone.utc).isoformat()

    for link in links:
        target_url = link["target_url"]
        our_domain = link["our_domain"]

        try:
            result = verify_link(target_url, our_domain)
        except Exception:
            msg = f"Failed to verify link on {target_url}"
            logger.warning(msg, exc_info=True)
            errors.append(msg)
            continue

        verified_count += 1
        is_live = result["found"]

        if is_live:
            live_count += 1
        else:
            dead_count += 1

        if link["source_table"] == "outreach_links":
            # Update existing outreach_links record
            try:
                supabase_tools.update_record(
                    "outreach_links",
                    link["id"],
                    {
                        "is_live": is_live,
                        "anchor_text": result.get("anchor_text", ""),
                        "do_follow": result.get("do_follow", True),
                        "last_checked_at": now,
                    },
                )
            except Exception:
                msg = f"Failed to update outreach_links for {target_url}"
                logger.warning(msg, exc_info=True)
                errors.append(msg)

        elif link["source_table"] == "seo_backlink_prospects" and is_live:
            # Create a new outreach_links record for this confirmed link
            try:
                site_id = target_site if target_site != "all" else ""
                supabase_tools.insert_record(
                    "outreach_links",
                    {
                        "site_id": site_id,
                        "target_url": target_url,
                        "link_url": result.get("href", ""),
                        "anchor_text": result.get("anchor_text", ""),
                        "do_follow": result.get("do_follow", True),
                        "is_live": True,
                        "last_checked_at": now,
                    },
                )
                new_records += 1
            except Exception:
                msg = f"Failed to create outreach_links record for {target_url}"
                logger.warning(msg, exc_info=True)
                errors.append(msg)

        elif link["source_table"] == "seo_backlink_prospects" and not is_live:
            # Link not found — flag prospect for re-outreach
            try:
                supabase_tools.upsert_record(
                    "seo_backlink_prospects",
                    {
                        "id": link["id"],
                        "status": "link_lost",
                    },
                )
            except Exception:
                logger.warning(
                    "Failed to update prospect status for %s", target_url,
                    exc_info=True,
                )

    report_lines = [
        f"Link verification complete for {target_site}:",
        f"  Checked: {verified_count}",
        f"  Live: {live_count}",
        f"  Dead/missing: {dead_count}",
        f"  New records created: {new_records}",
    ]
    report = "\n".join(report_lines)
    logger.info(report)

    return {
        "report": report,
        "errors": errors,
        "next_node": "END",
    }
