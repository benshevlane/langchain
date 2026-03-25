"""Telegram bot interface for the SEO agent.

Usage::

    python -m agents.seo_agent.telegram_bot

Requires ``TELEGRAM_BOT_TOKEN`` in the environment (create a bot via
@BotFather on Telegram). Uses polling mode — no webhook server needed.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
import textwrap

from dotenv import load_dotenv
from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

# Ensure the repo root is on sys.path
_repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _repo_root not in sys.path:
    sys.path.insert(0, _repo_root)

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("seo_agent.telegram")

# Maximum Telegram message length
_TG_MAX_LEN = 4096


def _truncate(text: str, limit: int = _TG_MAX_LEN) -> str:
    """Truncate text to fit within Telegram's message limit."""
    if len(text) <= limit:
        return text
    return text[: limit - 20] + "\n\n… (truncated)"


def _run_graph_sync(task_type: str, **kwargs: object) -> dict:
    """Thin wrapper around the CLI's ``_run_graph`` — runs in a thread."""
    from agents.seo_agent.run import _run_graph

    return _run_graph(task_type, **kwargs)


# ---------------------------------------------------------------------------
# Formatters — turn graph results into readable Telegram messages
# ---------------------------------------------------------------------------


def _fmt_keywords(result: dict) -> str:
    opportunities = result.get("keyword_opportunities", [])
    if not opportunities:
        return "No keyword opportunities found."
    lines = [f"Found {len(opportunities)} keyword opportunities:\n"]
    for kw in opportunities[:15]:
        lines.append(
            f"• {kw.get('keyword', 'N/A')}  "
            f"vol={kw.get('volume', '?')}  "
            f"KD={kw.get('kd', '?')}  "
            f"intent={kw.get('intent', '?')}"
        )
    if len(opportunities) > 15:
        lines.append(f"\n… and {len(opportunities) - 15} more")
    return "\n".join(lines)


def _fmt_content_gaps(result: dict) -> str:
    gaps = result.get("content_gaps", [])
    if not gaps:
        return "No content gaps found."
    lines = [f"Found {len(gaps)} content gaps:\n"]
    for gap in gaps[:15]:
        lines.append(
            f"• {gap.get('keyword', 'N/A')}  "
            f"vol={gap.get('volume', '?')}  "
            f"stage={gap.get('funnel_stage', '?')}"
        )
    return "\n".join(lines)


def _fmt_brief(result: dict) -> str:
    brief = result.get("content_brief")
    if not brief:
        return "Failed to generate content brief."
    import json

    return f"Content brief generated:\n\n{json.dumps(brief, indent=2, default=str)}"


def _fmt_draft(result: dict) -> str:
    draft = result.get("content_draft")
    if not draft:
        return "Failed to generate content draft."
    return f"Content draft ({len(draft)} chars):\n\n{draft}"


def _fmt_prospects(result: dict) -> str:
    prospects = result.get("backlink_prospects", [])
    if not prospects:
        return "No prospects discovered."
    lines = [f"Discovered {len(prospects)} prospects:\n"]
    for p in prospects[:15]:
        lines.append(
            f"• [{p.get('discovery_method', '?')}] "
            f"DR={p.get('dr', '?')}  "
            f"{p.get('domain', '?')}"
        )
    if len(prospects) > 15:
        lines.append(f"\n… and {len(prospects) - 15} more")
    return "\n".join(lines)


def _fmt_rank(result: dict) -> str:
    data = result.get("rank_data", [])
    if not data:
        return "No rank data available."
    lines = [f"Rank data for {len(data)} keywords:\n"]
    for row in data[:15]:
        pos = row.get("position", "?")
        prev = row.get("previous_position")
        change = ""
        if isinstance(pos, (int, float)) and isinstance(prev, (int, float)):
            diff = prev - pos
            if diff > 0:
                change = f" (+{diff:.0f})"
            elif diff < 0:
                change = f" ({diff:.0f})"
        lines.append(f"• {row.get('keyword', '?')}  pos={pos}{change}")
    return "\n".join(lines)


def _fmt_report(result: dict) -> str:
    report = result.get("report", "")
    return report if report else "No report generated."


def _fmt_scored(result: dict) -> str:
    scored = result.get("scored_prospects", [])
    if not scored:
        return "No scored prospects."
    tier1 = sum(1 for p in scored if p.get("tier") == "tier1")
    tier2 = sum(1 for p in scored if p.get("tier") == "tier2")
    rejected = sum(1 for p in scored if p.get("status") == "rejected")
    return (
        f"Scored {len(scored)} prospects:\n"
        f"• Tier 1: {tier1}\n"
        f"• Tier 2: {tier2}\n"
        f"• Rejected: {rejected}"
    )


def _fmt_emails(result: dict) -> str:
    emails = result.get("emails_generated", [])
    if not emails:
        return "No emails generated."
    lines = [f"Generated {len(emails)} outreach emails:\n"]
    for e in emails[:10]:
        lines.append(
            f"• To: {e.get('contact_email', '?')}  "
            f"Tier {e.get('tier', '?')}  "
            f"| {e.get('subject', '?')[:50]}"
        )
    return "\n".join(lines)


def _fmt_cost(result: dict) -> str:
    """Format cost report (runs outside the graph)."""
    return result.get("text", "No cost data.")


# ---------------------------------------------------------------------------
# Command → graph task mapping
# ---------------------------------------------------------------------------

# Maps command name to (task_type, formatter, description)
COMMANDS: dict[str, dict] = {
    "keywords": {
        "task": "keyword_research",
        "fmt": _fmt_keywords,
        "usage": "/keywords <site> <seed>",
        "help": "Run keyword research",
        "args": ["target_site", "seed_keyword"],
    },
    "gaps": {
        "task": "content_gap",
        "fmt": _fmt_content_gaps,
        "usage": "/gaps <site>",
        "help": "Find content gaps vs competitors",
        "args": ["target_site"],
    },
    "brief": {
        "task": "content_brief",
        "fmt": _fmt_brief,
        "usage": "/brief <site> <keyword phrase>",
        "help": "Generate a content brief",
        "args": ["target_site", "selected_keyword"],
    },
    "write": {
        "task": "write_content",
        "fmt": _fmt_draft,
        "usage": "/write <site> <brief_id>",
        "help": "Write content from a brief",
        "args": ["target_site", "brief_id"],
    },
    "prospects": {
        "task": "discover_prospects",
        "fmt": _fmt_prospects,
        "usage": "/prospects <site>",
        "help": "Discover backlink prospects",
        "args": ["target_site"],
    },
    "enrich": {
        "task": "enrich_prospects",
        "fmt": lambda r: f"Enriched {len(r.get('enriched_prospects', []))} prospects",
        "usage": "/enrich",
        "help": "Enrich prospect data",
        "args": [],
    },
    "score": {
        "task": "score_prospects",
        "fmt": _fmt_scored,
        "usage": "/score",
        "help": "Score enriched prospects",
        "args": [],
    },
    "emails": {
        "task": "generate_emails",
        "fmt": _fmt_emails,
        "usage": "/emails",
        "help": "Generate outreach emails",
        "args": [],
    },
    "rank": {
        "task": "rank_report",
        "fmt": _fmt_rank,
        "usage": "/rank <site>",
        "help": "Generate rank tracking report",
        "args": ["target_site"],
    },
    "report": {
        "task": "weekly_report",
        "fmt": _fmt_report,
        "usage": "/report",
        "help": "Generate weekly SEO report",
        "args": [],
    },
    "outreach_report": {
        "task": "outreach_report",
        "fmt": _fmt_report,
        "usage": "/outreach_report",
        "help": "Generate outreach report",
        "args": [],
    },
}


# ---------------------------------------------------------------------------
# Telegram handlers
# ---------------------------------------------------------------------------


async def _start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start command."""
    sites = "kitchensdirectory, freeroomplanner, kitchen_estimator"
    help_lines = ["SEO Agent Bot\n", "Available commands:\n"]
    for name, cmd in COMMANDS.items():
        help_lines.append(f"/{name} — {cmd['help']}")
        help_lines.append(f"  Usage: {cmd['usage']}\n")
    help_lines.append(f"/cost — Show LLM cost report")
    help_lines.append(f"\nAvailable sites: {sites}")
    await update.message.reply_text("\n".join(help_lines))


async def _help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /help command."""
    await _start(update, context)


async def _cost_command(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> None:
    """Handle /cost command — runs outside the graph."""
    await update.message.reply_text("Generating cost report...")

    def _cost_sync() -> dict:
        from agents.seo_agent.tools import supabase_tools

        supabase_tools.ensure_tables()
        spend = supabase_tools.get_weekly_spend()
        cap = float(os.getenv("MAX_WEEKLY_SPEND_USD", "50.00"))
        remaining = max(0.0, cap - spend)
        pct = (spend / cap * 100) if cap > 0 else 0

        lines = [
            "LLM Cost Report",
            "=" * 30,
            f"  Spent:     ${spend:.4f}",
            f"  Budget:    ${cap:.2f}",
            f"  Remaining: ${remaining:.4f} ({100 - pct:.1f}%)",
        ]
        if pct >= 80:
            lines.append("  Warning: Budget >80% — models will be downgraded")

        logs = supabase_tools.query_table("llm_cost_log", limit=500)
        if logs:
            by_task: dict[str, float] = {}
            for row in logs:
                task = row.get("task_type", "unknown")
                by_task[task] = by_task.get(task, 0.0) + row.get("cost_usd", 0.0)
            lines.append("\nBreakdown by task:")
            for task, cost in sorted(by_task.items(), key=lambda x: -x[1]):
                lines.append(f"  {task}: ${cost:.4f}")

        return {"text": "\n".join(lines)}

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _cost_sync)
    await update.message.reply_text(_fmt_cost(result))


async def _handle_command(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> None:
    """Generic handler for all SEO agent commands."""
    text = update.message.text or ""
    parts = text.strip().split()
    cmd_name = parts[0].lstrip("/").split("@")[0]  # strip bot username suffix
    user_args = parts[1:]

    cmd = COMMANDS.get(cmd_name)
    if not cmd:
        await update.message.reply_text(
            f"Unknown command: /{cmd_name}\nSend /help for available commands."
        )
        return

    # Build kwargs from positional args
    kwargs: dict[str, object] = {}
    expected_args = cmd["args"]

    if len(expected_args) == 0:
        # No args needed — commands like /enrich, /score, /report
        kwargs["target_site"] = "all"
    elif len(expected_args) == 1:
        # Single arg: site
        if not user_args:
            await update.message.reply_text(f"Usage: {cmd['usage']}")
            return
        kwargs[expected_args[0]] = user_args[0]
    elif len(expected_args) == 2:
        # Two args: site + keyword/seed/brief_id
        if len(user_args) < 2:
            await update.message.reply_text(f"Usage: {cmd['usage']}")
            return
        kwargs[expected_args[0]] = user_args[0]
        # Join remaining args for keyword phrases like "bespoke kitchens"
        kwargs[expected_args[1]] = " ".join(user_args[1:])

    task_type = cmd["task"]
    await update.message.reply_text(f"Running {cmd['help'].lower()}...")

    # Run the graph in a thread to avoid blocking the event loop
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(
            None, lambda: _run_graph_sync(task_type, **kwargs)
        )
    except Exception as exc:
        logger.exception("Graph execution failed")
        await update.message.reply_text(f"Error: {exc}")
        return

    # Format and send result
    errors = result.get("errors", [])
    if errors:
        err_text = "\n".join(f"• {e}" for e in errors)
        await update.message.reply_text(
            _truncate(f"Completed with errors:\n{err_text}")
        )

    formatted = cmd["fmt"](result)
    await update.message.reply_text(_truncate(formatted))


async def _unknown_text(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> None:
    """Handle plain text messages."""
    await update.message.reply_text(
        "Send /help to see available commands.\n"
        "Example: /keywords kitchensdirectory bespoke kitchens"
    )


def main() -> None:
    """Start the Telegram bot with polling."""
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        logger.error("TELEGRAM_BOT_TOKEN not set in environment")
        sys.exit(1)

    app = Application.builder().token(token).build()

    # Register handlers
    app.add_handler(CommandHandler("start", _start))
    app.add_handler(CommandHandler("help", _help))
    app.add_handler(CommandHandler("cost", _cost_command))

    # Register all SEO commands
    for cmd_name in COMMANDS:
        app.add_handler(CommandHandler(cmd_name, _handle_command))

    # Catch-all for plain text
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, _unknown_text))

    logger.info("Starting Telegram bot (polling mode)...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
