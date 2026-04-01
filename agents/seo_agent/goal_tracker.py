"""Goal tracker — shared goal state with progress tracking.

Reads and writes campaign goals from Supabase so that agents can make
goal-aware decisions. Goals are seeded from ``strategy.GOALS`` on first boot,
then live in the database and can be edited via Telegram.

Usage::

    from agents.seo_agent.goal_tracker import GoalTracker

    tracker = GoalTracker()
    tracker.sync_goals()                 # Seed on first boot
    tracker.update_progress("content_library", 18)  # 18 posts published
    gaps = tracker.get_goal_gaps()       # Sorted by urgency
    context = tracker.get_prompt_context()  # For system prompt injection
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


def sync_goals() -> int:
    """Seed ``campaign_goals`` from ``strategy.GOALS`` if the table is empty.

    Returns:
        Number of rows inserted (0 if already seeded).
    """
    from agents.seo_agent.strategy import GOALS
    from agents.seo_agent.tools.supabase_tools import insert_record, query_table

    existing = query_table("campaign_goals", limit=1)
    if existing:
        return 0

    count = 0
    for goal in GOALS:
        targets = goal.get("targets", {})
        insert_record("campaign_goals", {
            "goal_id": goal["id"],
            "description": goal["description"],
            "metric": goal["metric"],
            "current_value": 0,
            "target_3m": targets.get("3_month", ""),
            "target_6m": targets.get("6_month", ""),
            "target_12m": targets.get("12_month", ""),
            "notes": "",
        })
        count += 1

    logger.info("Seeded campaign_goals with %d goals", count)
    return count


def get_all_goals() -> list[dict[str, Any]]:
    """Return all campaign goals from the database.

    Seeds defaults on first call if the table is empty.

    Returns:
        List of goal dicts.
    """
    from agents.seo_agent.tools.supabase_tools import query_table

    rows = query_table("campaign_goals", limit=50)
    if not rows:
        sync_goals()
        rows = query_table("campaign_goals", limit=50)
    return rows


def update_progress(goal_id: str, current_value: float) -> dict[str, Any]:
    """Update the current value for a goal and log a snapshot.

    Args:
        goal_id: The goal identifier (e.g. ``content_library``).
        current_value: The new measured value.

    Returns:
        The updated goal record.
    """
    from agents.seo_agent.tools.supabase_tools import insert_record, query_table, update_record

    goals = query_table("campaign_goals", filters={"goal_id": goal_id}, limit=1)
    if not goals:
        logger.warning("Goal %s not found in campaign_goals", goal_id)
        return {}

    goal = goals[0]
    now = datetime.now(timezone.utc).isoformat()

    result = update_record("campaign_goals", goal["id"], {
        "current_value": current_value,
        "last_measured_at": now,
        "updated_at": now,
    })

    # Log snapshot for trend tracking
    try:
        insert_record("goal_snapshots", {
            "goal_id": goal_id,
            "value": current_value,
            "snapshot_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        })
    except Exception:
        logger.debug("Snapshot insert failed (non-fatal)", exc_info=True)

    return result


def measure_goals_from_dashboard() -> dict[str, float]:
    """Read current metrics from the dashboard and update all measurable goals.

    Returns:
        Dict of goal_id to measured value.
    """
    from agents.seo_agent.tools.crm_tools import get_dashboard_summary

    try:
        dash = get_dashboard_summary()
    except Exception:
        logger.warning("Dashboard unavailable for goal measurement", exc_info=True)
        return {}

    measurements: dict[str, float] = {}

    # Map dashboard fields to goal IDs
    mapping = {
        "content_library": dash.get("content_pieces", 0),
        "keyword_rankings": dash.get("rankings_tracked", 0),
        "backlink_pipeline": dash.get("prospects_total", 0),
    }

    for goal_id, value in mapping.items():
        if value is not None:
            try:
                update_progress(goal_id, float(value))
                measurements[goal_id] = float(value)
            except Exception:
                logger.debug("Failed to update goal %s", goal_id, exc_info=True)

    return measurements


def _parse_target_number(target_str: str) -> float | None:
    """Extract the first number from a target string.

    Handles formats like ``"15 posts across all sites"``, ``"DR 10+ for all sites"``,
    ``"5,000 sessions/month"``, ``"5 keywords in top 10"``.

    Args:
        target_str: The raw target string from the goals table.

    Returns:
        The extracted number, or None if no number found.
    """
    import re

    if not target_str:
        return None

    # Remove commas from numbers like "5,000"
    cleaned = target_str.replace(",", "")

    match = re.search(r"(\d+(?:\.\d+)?)", cleaned)
    if match:
        return float(match.group(1))
    return None


def get_goal_gaps() -> list[dict[str, Any]]:
    """Calculate the gap between current values and 3-month targets.

    Returns goals sorted by urgency (largest gap relative to target first).

    Returns:
        List of dicts with ``goal_id``, ``description``, ``current``,
        ``target``, ``gap``, ``pct_complete``, and ``priority``.
    """
    goals = get_all_goals()
    gaps: list[dict[str, Any]] = []

    for goal in goals:
        current = float(goal.get("current_value", 0) or 0)
        target = _parse_target_number(goal.get("target_3m", ""))

        if target is None or target == 0:
            gaps.append({
                "goal_id": goal["goal_id"],
                "description": goal["description"],
                "metric": goal.get("metric", ""),
                "current": current,
                "target_3m": goal.get("target_3m", ""),
                "target": None,
                "gap": None,
                "pct_complete": None,
                "priority": "low",
            })
            continue

        gap = max(0, target - current)
        pct = min(100, (current / target) * 100) if target > 0 else 0

        if pct >= 100:
            priority = "achieved"
        elif pct >= 75:
            priority = "on_track"
        elif pct >= 40:
            priority = "behind"
        else:
            priority = "critical"

        gaps.append({
            "goal_id": goal["goal_id"],
            "description": goal["description"],
            "metric": goal.get("metric", ""),
            "current": current,
            "target_3m": goal.get("target_3m", ""),
            "target": target,
            "gap": gap,
            "pct_complete": round(pct, 1),
            "priority": priority,
        })

    # Sort: critical first, then behind, on_track, achieved, low
    priority_order = {"critical": 0, "behind": 1, "on_track": 2, "achieved": 3, "low": 4}
    gaps.sort(key=lambda g: (priority_order.get(g["priority"], 5), -(g.get("gap") or 0)))

    return gaps


def get_goal_skill_boosts() -> dict[str, int]:
    """Map goal gaps to skill priority boosts.

    When a goal is behind or critical, the skills that serve it get
    a priority boost so the worker focuses on what matters most.

    Returns:
        Dict of skill_name to priority boost amount.
    """
    gaps = get_goal_gaps()
    boosts: dict[str, int] = {}

    # Map goals to the skills that move them
    goal_skill_map: dict[str, list[str]] = {
        "content_library": ["publish_blog", "keyword_research", "keyword_refresh"],
        "keyword_rankings": ["track_rankings", "publish_blog"],
        "backlink_pipeline": ["discover_prospects", "score_prospects", "promote_to_crm"],
        "domain_authority": ["discover_prospects", "score_prospects"],
        "organic_traffic": ["publish_blog", "keyword_research", "internal_linking"],
    }

    for gap in gaps:
        goal_id = gap["goal_id"]
        priority = gap["priority"]
        skills = goal_skill_map.get(goal_id, [])

        if priority == "critical":
            boost = 25
        elif priority == "behind":
            boost = 15
        elif priority == "on_track":
            boost = 5
        else:
            boost = 0

        for skill in skills:
            boosts[skill] = max(boosts.get(skill, 0), boost)

    return boosts


def get_prompt_context() -> str:
    """Build a goal-state context block for injection into the system prompt.

    Returns:
        Formatted string showing current progress vs targets, or empty
        string if goals can't be loaded.
    """
    try:
        gaps = get_goal_gaps()
    except Exception:
        logger.debug("Could not load goals for prompt context", exc_info=True)
        return ""

    if not gaps:
        return ""

    lines = ["\n--- Current Goal Progress ---"]

    for g in gaps:
        goal_id = g["goal_id"]
        current = g["current"]
        target_str = g.get("target_3m", "")
        pct = g.get("pct_complete")
        priority = g["priority"]

        if pct is not None:
            icon = {
                "achieved": "done",
                "on_track": "ok",
                "behind": "BEHIND",
                "critical": "CRITICAL",
            }.get(priority, "?")
            lines.append(
                f"[{icon}] {g['description']}: {current:.0f} "
                f"(target: {target_str}, {pct:.0f}% complete)"
            )
        else:
            lines.append(f"[?] {g['description']}: {current:.0f} (target: {target_str})")

    # Identify the #1 priority
    top_gap = next((g for g in gaps if g["priority"] in ("critical", "behind")), None)
    if top_gap:
        lines.append(
            f"\nTop priority: {top_gap['description']} — "
            f"need {top_gap['gap']:.0f} more {top_gap['metric']} to hit the 3-month target."
        )

    lines.append("--- End Goals ---\n")
    return "\n".join(lines)


def format_goals_for_display() -> str:
    """Format goals for Telegram display.

    Returns:
        Human-readable goals summary.
    """
    gaps = get_goal_gaps()
    if not gaps:
        return "No goals configured yet."

    lines: list[str] = []
    for g in gaps:
        pct = g.get("pct_complete")
        priority = g["priority"]
        icon = {
            "achieved": "\u2705",
            "on_track": "\U0001f7e2",
            "behind": "\U0001f7e1",
            "critical": "\U0001f534",
        }.get(priority, "\u2753")

        if pct is not None:
            lines.append(
                f"{icon} {g['description']}\n"
                f"   {g['current']:.0f} / {g['target_3m']} ({pct:.0f}%)"
            )
        else:
            lines.append(
                f"{icon} {g['description']}\n"
                f"   Current: {g['current']:.0f} | Target: {g['target_3m']}"
            )

    return "\n".join(lines)
