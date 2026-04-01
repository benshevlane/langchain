"""Runtime-editable strategy configuration.

Reads key-value pairs from the ``strategy_config`` Supabase table and
injects them into the agent's system prompt. Falls back to hardcoded
defaults when the table is empty or unreachable.

Usage::

    from agents.seo_agent.strategy_config import get_config, get_all_config

    content_target = int(get_config("content_target"))
    all_cfg = get_all_config()
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Fallback defaults — used when the table is empty or unreachable
# ---------------------------------------------------------------------------

DEFAULTS: dict[str, dict[str, str]] = {
    "dr_min_threshold": {
        "value": "10",
        "category": "prospecting",
        "label": "Min DR Threshold",
        "description": "Minimum Ahrefs Domain Rating for prospect scoring",
        "value_type": "number",
    },
    "dr_max_threshold": {
        "value": "75",
        "category": "prospecting",
        "label": "Max DR Threshold",
        "description": "Maximum DR — prospects above this are likely unreachable",
        "value_type": "number",
    },
    "content_target": {
        "value": "30",
        "category": "content",
        "label": "Content Target",
        "description": "Total blog posts target across all sites",
        "value_type": "number",
    },
    "content_diversity_cooldown_days": {
        "value": "7",
        "category": "content",
        "label": "Topic Cooldown (days)",
        "description": "Days before revisiting a topic cluster",
        "value_type": "number",
    },
    "contact_cooldown_days": {
        "value": "90",
        "category": "outreach",
        "label": "Contact Cooldown (days)",
        "description": "Days before re-contacting a domain",
        "value_type": "number",
    },
    "max_email_word_count": {
        "value": "150",
        "category": "outreach",
        "label": "Max Email Words",
        "description": "Maximum word count for outreach emails",
        "value_type": "number",
    },
    "blocked_keywords": {
        "value": "",
        "category": "content",
        "label": "Blocked Keywords",
        "description": "Comma-separated keywords to never target",
        "value_type": "textarea",
    },
    "blocked_domains": {
        "value": "",
        "category": "outreach",
        "label": "Blocked Domains",
        "description": "Comma-separated domains to never contact",
        "value_type": "textarea",
    },
    "outreach_monthly_targets": {
        "value": json.dumps({
            "kitchen_bathroom_providers": 20,
            "home_interior_bloggers": 15,
            "home_improvement_influencers": 5,
            "resource_page_targets": 10,
            "pr_journalists": 5,
            "interior_designers": 15,
        }),
        "category": "outreach",
        "label": "Monthly Outreach Targets",
        "description": "Per-segment monthly outreach targets (JSON)",
        "value_type": "json",
    },
    "budget_tiers": {
        "value": json.dumps({
            "normal": {"threshold": 0.8, "behavior": "full speed"},
            "cautious": {"threshold": 0.2, "behavior": "switch to cheaper models"},
            "paused": {"threshold": 0.05, "behavior": "pause non-essential tasks"},
        }),
        "category": "general",
        "label": "Budget Tiers",
        "description": "Budget threshold behavior rules (JSON)",
        "value_type": "json",
    },
    "site_priorities": {
        "value": json.dumps({
            "freeroomplanner": "active",
            "kitchensdirectory": "upcoming",
            "ralf_seo": "active",
        }),
        "category": "general",
        "label": "Site Priorities",
        "description": "Site status and priority (JSON)",
        "value_type": "json",
    },
}


def get_config(key: str) -> str:
    """Read a single config value from Supabase, falling back to defaults.

    Args:
        key: The config key to look up.

    Returns:
        The config value as a string.
    """
    try:
        from agents.seo_agent.tools.supabase_tools import query_table

        rows = query_table("strategy_config", filters={"key": key}, limit=1)
        if rows:
            return rows[0].get("value", DEFAULTS.get(key, {}).get("value", ""))
    except Exception:
        logger.debug("Could not read strategy_config for key=%s", key, exc_info=True)

    default = DEFAULTS.get(key)
    if default:
        return default["value"]
    return ""


def get_config_json(key: str) -> Any:
    """Read a config value and parse it as JSON.

    Args:
        key: The config key to look up.

    Returns:
        The parsed JSON value, or an empty dict on parse failure.
    """
    raw = get_config(key)
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        logger.warning("Invalid JSON for strategy_config key=%s", key)
        return {}


def get_all_config() -> dict[str, dict[str, Any]]:
    """Read all config rows, merging with defaults for any missing keys.

    Returns:
        Dict keyed by config key, each value is the full row dict.
    """
    result: dict[str, dict[str, Any]] = {}

    # Start with defaults
    for key, default in DEFAULTS.items():
        result[key] = {
            "key": key,
            "value": default["value"],
            "category": default["category"],
            "label": default["label"],
            "description": default["description"],
            "value_type": default["value_type"],
        }

    # Overlay with DB values
    try:
        from agents.seo_agent.tools.supabase_tools import query_table

        rows = query_table("strategy_config", limit=200)
        for row in rows:
            k = row.get("key", "")
            if k:
                result[k] = row
    except Exception:
        logger.debug("Could not read strategy_config table", exc_info=True)

    return result


def set_config(key: str, value: str) -> dict[str, Any]:
    """Upsert a config value.

    Args:
        key: The config key.
        value: The new value.

    Returns:
        The upserted record.
    """
    from agents.seo_agent.tools.supabase_tools import upsert_record

    default = DEFAULTS.get(key, {})
    return upsert_record(
        "strategy_config",
        {
            "key": key,
            "value": value,
            "category": default.get("category", "general"),
            "label": default.get("label", key),
            "description": default.get("description", ""),
            "value_type": default.get("value_type", "text"),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        on_conflict="key",
    )


def seed_defaults() -> int:
    """Insert any missing default rows into ``strategy_config``. Idempotent.

    Returns:
        Number of rows inserted.
    """
    from agents.seo_agent.tools.supabase_tools import query_table, upsert_record

    try:
        existing = query_table("strategy_config", limit=200)
    except Exception:
        logger.warning("Could not read strategy_config for seeding", exc_info=True)
        return 0

    existing_keys = {row.get("key") for row in existing}
    count = 0

    for key, default in DEFAULTS.items():
        if key not in existing_keys:
            try:
                upsert_record(
                    "strategy_config",
                    {
                        "key": key,
                        "value": default["value"],
                        "category": default["category"],
                        "label": default["label"],
                        "description": default["description"],
                        "value_type": default["value_type"],
                    },
                    on_conflict="key",
                )
                count += 1
            except Exception:
                logger.warning("Failed to seed strategy_config key=%s", key, exc_info=True)

    if count:
        logger.info("Seeded %d strategy_config defaults", count)
    return count


def get_prompt_context() -> str:
    """Format strategy config for injection into the system prompt.

    Returns:
        Formatted string with current config values, or empty string
        if config can't be loaded.
    """
    try:
        config = get_all_config()
    except Exception:
        return ""

    if not config:
        return ""

    lines = ["\n--- Active Strategy Config ---"]

    # Group by category
    categories: dict[str, list[tuple[str, str, str]]] = {}
    for key, entry in sorted(config.items()):
        cat = entry.get("category", "general")
        label = entry.get("label", key)
        value = entry.get("value", "")
        categories.setdefault(cat, []).append((key, label, value))

    for cat in ["general", "content", "prospecting", "outreach"]:
        entries = categories.get(cat, [])
        if not entries:
            continue
        lines.append(f"\n[{cat.upper()}]")
        for key, label, value in entries:
            # Truncate long JSON values for prompt readability
            display = value if len(value) <= 100 else value[:97] + "..."
            lines.append(f"  {label}: {display}")

    lines.append("--- End Config ---\n")
    return "\n".join(lines)
