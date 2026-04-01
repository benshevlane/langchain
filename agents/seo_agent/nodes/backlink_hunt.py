"""Backlink hunt orchestrator — runs the full backlink-hunting workflow.

Accepts a proposition (link-worthy angle) and keyword cluster, then
chains: roundup discovery -> competitor backlink research -> broken link
detection -> enrichment -> scoring -> email generation as a single
invocation.
"""

from __future__ import annotations

import logging
from typing import Any

from agents.seo_agent.state import SEOAgentState

logger = logging.getLogger(__name__)


def run_backlink_hunt(state: SEOAgentState) -> dict[str, Any]:
    """Run the end-to-end backlink hunting workflow.

    Orchestrates the full pipeline in sequence:
    1. Discover prospects (including roundup search with keyword cluster).
    2. Enrich prospects (multi-source contact discovery).
    3. Score prospects.
    4. Generate outreach emails.

    The proposition and keyword cluster from state are passed through to
    each step. Results accumulate across steps.

    Args:
        state: The current SEO agent state with ``proposition`` and
            ``keyword_cluster`` fields populated.

    Returns:
        State update with all pipeline outputs.
    """
    from agents.seo_agent.nodes.backlink_prospector import run_backlink_prospector
    from agents.seo_agent.nodes.email_generator import run_email_generator
    from agents.seo_agent.nodes.prospect_enrichment import run_prospect_enrichment
    from agents.seo_agent.nodes.prospect_scorer import run_prospect_scorer

    errors: list[str] = list(state.get("errors", []))
    target_site = state["target_site"]
    proposition = state.get("proposition", "")
    keyword_cluster = state.get("keyword_cluster", [])

    logger.info(
        "Starting backlink hunt for %s | proposition: %s | keywords: %s",
        target_site,
        proposition[:80] if proposition else "(none)",
        ", ".join(keyword_cluster[:5]) if keyword_cluster else "(from profile)",
    )

    # Step 1: Discover prospects
    logger.info("Backlink hunt step 1/4: Discovering prospects")
    discovery_result = run_backlink_prospector(state)
    errors.extend(discovery_result.get("errors", []))
    prospects = discovery_result.get("backlink_prospects", [])
    logger.info("Discovery found %d prospects", len(prospects))

    if not prospects:
        return {
            "backlink_prospects": [],
            "enriched_prospects": [],
            "scored_prospects": [],
            "emails_generated": [],
            "errors": errors,
            "report": "Backlink hunt: no prospects found during discovery.",
            "next_node": "END",
        }

    # Step 2: Enrich prospects
    logger.info("Backlink hunt step 2/4: Enriching %d prospects", len(prospects))
    enrich_state = {**state, "backlink_prospects": prospects}
    enrich_result = run_prospect_enrichment(enrich_state)
    errors.extend(enrich_result.get("errors", []))
    enriched = enrich_result.get("enriched_prospects", [])
    logger.info("Enriched %d prospects", len(enriched))

    # Step 3: Score prospects
    logger.info("Backlink hunt step 3/4: Scoring %d prospects", len(enriched))
    score_state = {**state, "enriched_prospects": enriched}
    score_result = run_prospect_scorer(score_state)
    errors.extend(score_result.get("errors", []))
    scored = score_result.get("scored_prospects", [])

    tier1 = [p for p in scored if p.get("tier") == "tier1"]
    tier2 = [p for p in scored if p.get("tier") == "tier2"]
    logger.info("Scored: %d tier1, %d tier2", len(tier1), len(tier2))

    # Step 4: Generate emails for scored prospects
    outreach_ready = [p for p in scored if p.get("status") == "scored"]
    logger.info("Backlink hunt step 4/4: Generating emails for %d prospects", len(outreach_ready))
    email_state = {**state, "scored_prospects": outreach_ready}
    email_result = run_email_generator(email_state)
    errors.extend(email_result.get("errors", []))
    emails = email_result.get("emails_generated", [])
    logger.info("Generated %d outreach emails", len(emails))

    # Build summary report
    report_lines = [
        f"Backlink hunt complete for {target_site}:",
        f"  Proposition: {proposition}" if proposition else "",
        f"  Keywords: {', '.join(keyword_cluster)}" if keyword_cluster else "",
        f"  Prospects discovered: {len(prospects)}",
        f"  Prospects enriched: {len(enriched)}",
        f"  Tier 1 (score 65+): {len(tier1)}",
        f"  Tier 2 (score 35-64): {len(tier2)}",
        f"  Emails generated: {len(emails)}",
    ]
    report = "\n".join(line for line in report_lines if line)

    return {
        "backlink_prospects": prospects,
        "enriched_prospects": enriched,
        "scored_prospects": scored,
        "emails_generated": emails,
        "errors": errors,
        "report": report,
        "next_node": "END",
    }
