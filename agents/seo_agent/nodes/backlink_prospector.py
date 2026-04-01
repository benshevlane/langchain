"""Backlink prospector node — discovers link-building opportunities.

Runs nine discovery methods (competitor backlink mining, content explorer,
unlinked mentions, resource pages, broken links, HARO requests, blogger
discovery, company/provider discovery, and roundup/listicle search) and
persists all prospects to Supabase with ``discovery_method`` and ``segment``
tags. Broken link prospects are enriched with Wayback Machine context.
"""

from __future__ import annotations

import logging
from collections import Counter
from typing import Any
from urllib.parse import urlparse

from agents.seo_agent.config import SITE_PROFILES
from agents.seo_agent.state import SEOAgentState
from agents.seo_agent.tools import ahrefs_tools, supabase_tools, web_search_tools

logger = logging.getLogger(__name__)

# Domains that look like link farms or PBNs — reject on sight
_LINK_FARM_SIGNALS = frozenset({
    "blogspot.com",
    "wordpress.com",
    "weebly.com",
    "wixsite.com",
    "tumblr.com",
    "medium.com",
})


def _extract_domain(url: str) -> str:
    """Extract the root domain from a URL.

    Args:
        url: A fully-qualified URL string.

    Returns:
        The netloc portion of the URL, lowercased.
    """
    try:
        return urlparse(url).netloc.lower().removeprefix("www.")
    except Exception:
        return ""


def _is_link_farm(domain: str) -> bool:
    """Check whether a domain belongs to a known link farm platform.

    Args:
        domain: The domain to check.

    Returns:
        True if the domain matches a known link farm host.
    """
    return any(domain.endswith(sig) for sig in _LINK_FARM_SIGNALS)


def _deduplicate_prospects(
    prospects: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Remove duplicate prospects by page URL.

    Args:
        prospects: Raw list of prospect dicts.

    Returns:
        Deduplicated list preserving first occurrence.
    """
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for p in prospects:
        url = p.get("page_url", "")
        if url and url not in seen:
            seen.add(url)
            unique.append(p)
    return unique


def _mine_competitor_backlinks(
    competitors: list[str],
) -> list[dict[str, Any]]:
    """Run competitor backlink mining across all competitor domains.

    Args:
        competitors: List of competitor domain strings.

    Returns:
        List of prospect dicts tagged with ``discovery_method``.
    """
    prospects: list[dict[str, Any]] = []
    for competitor in competitors:
        try:
            backlinks = ahrefs_tools.get_backlinks.invoke(competitor)
        except Exception:
            logger.warning(
                "Failed to get backlinks for competitor %s",
                competitor,
                exc_info=True,
            )
            continue

        for bl in backlinks:
            domain = _extract_domain(bl.get("page_url", ""))
            if _is_link_farm(domain):
                logger.debug("Filtered link farm domain: %s", domain)
                continue

            prospects.append({
                "domain": domain or bl.get("referring_domain", ""),
                "page_url": bl.get("page_url", ""),
                "page_title": "",
                "dr": bl.get("dr", 0),
                "monthly_traffic": bl.get("traffic", 0),
                "discovery_method": "competitor_backlink",
                "links_to_competitor": True,
                "competitor_names": [competitor],
                "dofollow": bl.get("dofollow", False),
            })

    return prospects


def _explore_content(target_site: str) -> list[dict[str, Any]]:
    """Search Ahrefs Content Explorer for site-relevant pages.

    Args:
        target_site: The target site key used to look up the profile.

    Returns:
        List of prospect dicts from content explorer results.
    """
    profile = SITE_PROFILES.get(target_site, {})
    queries = [
        profile.get("primary_topic", ""),
        *profile.get("seed_keywords", [])[:3],
    ]
    queries = [q for q in queries if q]

    prospects: list[dict[str, Any]] = []
    for query in queries:
        try:
            results = ahrefs_tools.search_content_explorer.invoke(query)
        except Exception:
            logger.warning(
                "Content explorer failed for query '%s'",
                query,
                exc_info=True,
            )
            continue

        for r in results:
            domain = _extract_domain(r.get("url", ""))
            prospects.append({
                "domain": domain,
                "page_url": r.get("url", ""),
                "page_title": r.get("title", ""),
                "dr": r.get("dr", 0),
                "monthly_traffic": r.get("traffic", 0),
                "discovery_method": "content_explorer",
            })

    return prospects


def _find_unlinked_mentions(domain: str) -> list[dict[str, Any]]:
    """Search for unlinked brand mentions across the web.

    Args:
        domain: The target domain to find mentions of.

    Returns:
        List of prospect dicts for pages mentioning the domain without linking.
    """
    try:
        results = web_search_tools.find_unlinked_mentions(domain)
    except Exception:
        logger.warning(
            "Unlinked mentions search failed for %s", domain, exc_info=True
        )
        return []

    prospects: list[dict[str, Any]] = []
    for r in results:
        source_domain = _extract_domain(r.get("url", ""))
        prospects.append({
            "domain": source_domain,
            "page_url": r.get("url", ""),
            "page_title": r.get("title", ""),
            "discovery_method": "unlinked_mention",
            "has_link": r.get("has_link", False),
        })

    return prospects


def _find_resource_pages(niche: str) -> list[dict[str, Any]]:
    """Search for resource and links pages in the target niche.

    Args:
        niche: The niche topic to search for resource pages in.

    Returns:
        List of prospect dicts from resource page discovery.
    """
    try:
        results = web_search_tools.search_resource_pages(niche)
    except Exception:
        logger.warning(
            "Resource page search failed for niche '%s'", niche, exc_info=True
        )
        return []

    prospects: list[dict[str, Any]] = []
    for r in results:
        domain = _extract_domain(r.get("url", ""))
        prospects.append({
            "domain": domain,
            "page_url": r.get("url", ""),
            "page_title": r.get("title", ""),
            "discovery_method": "resource_page",
        })

    return prospects


def _find_broken_links(competitors: list[str]) -> list[dict[str, Any]]:
    """Find broken backlinks pointing to competitor domains.

    Args:
        competitors: List of competitor domain strings.

    Returns:
        List of prospect dicts for broken link replacement opportunities.
    """
    prospects: list[dict[str, Any]] = []
    for competitor in competitors:
        try:
            broken = ahrefs_tools.get_broken_backlinks.invoke(competitor)
        except Exception:
            logger.warning(
                "Broken backlinks check failed for %s",
                competitor,
                exc_info=True,
            )
            continue

        for bl in broken:
            domain = _extract_domain(bl.get("referring_page", ""))
            prospects.append({
                "domain": domain,
                "page_url": bl.get("referring_page", ""),
                "page_title": "",
                "dr": bl.get("dr", 0),
                "monthly_traffic": bl.get("traffic", 0),
                "discovery_method": "broken_link",
                "dead_url": bl.get("dead_url", ""),
                "anchor": bl.get("anchor", ""),
            })

    return prospects


def _search_haro() -> list[dict[str, Any]]:
    """Search for HARO (Help A Reporter Out) journalist requests.

    Returns:
        List of prospect dicts for HARO opportunities.
    """
    try:
        results = web_search_tools.search_haro_requests()
    except Exception:
        logger.warning("HARO search failed", exc_info=True)
        return []

    prospects: list[dict[str, Any]] = []
    for r in results:
        prospects.append({
            "domain": _extract_domain(r.get("url", "")),
            "page_url": r.get("url", ""),
            "page_title": r.get("title", ""),
            "discovery_method": "haro",
            "topic": r.get("topic", ""),
            "deadline": r.get("deadline", ""),
        })

    return prospects


def _discover_bloggers(target_site: str) -> list[dict[str, Any]]:
    """Discover home interior and renovation bloggers via web search.

    Targets bloggers for content collaboration — guest posts, tool features,
    cost data sharing. NOT for companies (those use _discover_companies).
    """
    profile = SITE_PROFILES.get(target_site, {})

    # Build search queries targeting blogs and content sites in our niche
    domain = profile.get("domain", "")
    queries = [
        "best home renovation blogs UK",
        "kitchen design blog UK",
        "bathroom planning tips blog",
        "interior design bloggers UK home",
        "room planning tips blog homeowner",
        "property renovation blog UK",
        "home improvement advice blog",
    ]

    prospects: list[dict[str, Any]] = []
    seen_domains: set[str] = set()

    try:
        from agents.seo_agent.tools.web_search_tools import search
        for query in queries[:4]:  # Limit to 4 queries to manage API spend
            results = search(query, max_results=5)
            for r in results:
                result_domain = _extract_domain(r.get("url", ""))
                # Skip our own sites, link farms, and duplicates
                if result_domain in seen_domains:
                    continue
                if result_domain == domain or _is_link_farm(result_domain):
                    continue
                seen_domains.add(result_domain)

                prospects.append({
                    "domain": result_domain,
                    "page_url": r.get("url", ""),
                    "page_title": r.get("title", ""),
                    "dr": 0,  # Will be fetched during enrichment
                    "monthly_traffic": 0,
                    "discovery_method": "niche_blog_search",
                    "segment": "blogger",
                })
    except Exception:
        logger.warning("Blogger discovery search failed", exc_info=True)

    # Fetch DR for the top prospects (limit Ahrefs calls)
    from agents.seo_agent.tools.ahrefs_tools import get_domain_rating
    for p in prospects[:10]:  # Only check DR for first 10
        try:
            dr_data = get_domain_rating(p["domain"])
            if isinstance(dr_data, dict):
                p["dr"] = dr_data.get("domain_rating", 0)
            elif isinstance(dr_data, (int, float)):
                p["dr"] = dr_data
        except Exception:
            pass  # DR stays at 0, will be retried during enrichment

    logger.info("Blogger discovery found %d prospects", len(prospects))
    return prospects


def _search_roundups(
    target_site: str,
    keyword_cluster: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Search for roundup/listicle pages that mention competitor tools.

    Generates queries like "best {kw} tools", "top {kw} software", and
    checks results for competitor mentions. Tags prospects with
    ``mentions_competitors`` and ``already_lists_us``.

    Args:
        target_site: The target site key from SITE_PROFILES.
        keyword_cluster: Optional list of keywords to search. Falls back
            to seed_keywords from the site profile.

    Returns:
        List of prospect dicts with ``discovery_method: 'roundup_search'``.
    """
    profile = SITE_PROFILES.get(target_site, {})
    our_domain = profile.get("domain", "")
    competitors = profile.get("competitors", [])

    # Build keyword list from cluster or seed keywords
    keywords = keyword_cluster or profile.get("seed_keywords", [])[:5]
    if not keywords:
        logger.info("No keywords for roundup search on %s", target_site)
        return []

    # Generate roundup-style search queries
    query_templates = [
        "best {kw} tools",
        "top {kw} software",
        "best free {kw}",
        "{kw} roundup",
        "{kw} alternatives",
    ]

    search_queries: list[str] = []
    for kw in keywords[:3]:  # Limit to 3 keywords to manage API spend
        for template in query_templates[:3]:  # 3 templates per keyword
            search_queries.append(template.format(kw=kw))

    prospects: list[dict[str, Any]] = []
    seen_domains: set[str] = set()

    for query in search_queries:
        try:
            results = web_search_tools.search(query, max_results=5)
        except Exception:
            logger.warning("Roundup search failed for '%s'", query, exc_info=True)
            continue

        for r in results:
            result_url = r.get("url", "")
            result_domain = _extract_domain(result_url)

            if result_domain in seen_domains:
                continue
            if _is_link_farm(result_domain):
                continue
            if result_domain == our_domain:
                continue
            seen_domains.add(result_domain)

            title = r.get("title", "")
            content = r.get("content", "")
            combined_text = f"{title} {content}".lower()

            # Check if the page title/snippet looks like a listicle
            listicle_signals = ["best", "top", "roundup", "compared", "review",
                                "alternatives", "vs", "tools", "software"]
            is_listicle = any(signal in combined_text for signal in listicle_signals)

            if not is_listicle:
                continue

            # Check for competitor mentions
            mentioned_competitors: list[str] = []
            for competitor in competitors:
                comp_name = competitor.replace(".com", "").replace(".co.uk", "")
                if comp_name.lower() in combined_text:
                    mentioned_competitors.append(competitor)

            # Check if our site is already listed
            already_lists_us = our_domain.lower() in combined_text

            prospects.append({
                "domain": result_domain,
                "page_url": result_url,
                "page_title": title,
                "dr": 0,
                "monthly_traffic": 0,
                "discovery_method": "roundup_search",
                "links_to_competitor": len(mentioned_competitors) > 0,
                "competitor_names": mentioned_competitors,
                "mentions_competitors": mentioned_competitors,
                "already_lists_us": already_lists_us,
            })

    # Fetch DR for top prospects
    from agents.seo_agent.tools.ahrefs_tools import get_domain_rating
    for p in prospects[:10]:
        try:
            dr_data = get_domain_rating(p["domain"])
            if isinstance(dr_data, dict):
                p["dr"] = dr_data.get("domain_rating", 0)
            elif isinstance(dr_data, (int, float)):
                p["dr"] = dr_data
        except Exception:
            pass

    logger.info(
        "Roundup search found %d listicle prospects (%d mentioning competitors)",
        len(prospects),
        sum(1 for p in prospects if p.get("mentions_competitors")),
    )
    return prospects


def _discover_companies(target_site: str) -> list[dict[str, Any]]:
    """Discover kitchen and bathroom companies for embed partnerships.

    Targets companies that would benefit from embedding a room planner link
    on their website. Different approach from bloggers — we're offering them
    a free tool for their customers, not asking for editorial links.
    """
    profile = SITE_PROFILES.get(target_site, {})
    domain = profile.get("domain", "")

    queries = [
        "kitchen showroom UK website",
        "fitted kitchen company UK",
        "bathroom fitters UK website",
        "kitchen design company UK",
        "bespoke kitchen makers UK website",
        "bathroom renovation company UK",
        "kitchen installation company UK",
    ]

    prospects: list[dict[str, Any]] = []
    seen_domains: set[str] = set()

    try:
        from agents.seo_agent.tools.web_search_tools import search
        for query in queries[:5]:
            results = search(query, max_results=5)
            for r in results:
                result_domain = _extract_domain(r.get("url", ""))
                if result_domain in seen_domains:
                    continue
                if result_domain == domain or _is_link_farm(result_domain):
                    continue
                # Skip major retailers and directories (we want independent companies)
                skip_domains = {
                    "bq.co.uk", "diy.com", "ikea.com", "wickes.co.uk",
                    "howdens.com", "magnet.co.uk", "wren.co.uk",
                    "checkatrade.com", "mybuilder.com", "trustatrader.com",
                    "yell.com", "google.com", "facebook.com", "instagram.com",
                    "pinterest.com", "houzz.co.uk", "bark.com",
                }
                if any(result_domain.endswith(d) for d in skip_domains):
                    continue
                seen_domains.add(result_domain)

                prospects.append({
                    "domain": result_domain,
                    "page_url": r.get("url", ""),
                    "page_title": r.get("title", ""),
                    "dr": 0,
                    "monthly_traffic": 0,
                    "discovery_method": "company_search",
                    "segment": "provider",
                })
    except Exception:
        logger.warning("Company search failed", exc_info=True)

    logger.info("Company search found %d prospects", len(prospects))
    return prospects


def run_backlink_prospector(state: SEOAgentState) -> dict[str, Any]:
    """Discover backlink prospects using eight complementary methods.

    Runs competitor backlink mining, content explorer, unlinked mentions,
    resource pages, broken links, HARO searches, blogger discovery, and
    company/provider discovery. Deduplicates results, filters link farms,
    and saves all prospects to Supabase.

    Args:
        state: The current SEO agent state.

    Returns:
        State update with `backlink_prospects`, `errors`, and `next_node`.
    """
    errors: list[str] = list(state.get("errors", []))
    target_site = state["target_site"]

    profile = SITE_PROFILES.get(target_site)
    if profile is None:
        msg = f"No site profile found for '{target_site}'"
        logger.error(msg)
        errors.append(msg)
        return {
            "backlink_prospects": [],
            "errors": errors,
            "next_node": "END",
        }

    domain = profile.get("domain", "")
    competitors = profile.get("competitors", [])
    primary_topic = profile.get("primary_topic", "kitchen")
    # Extract a simple niche word from the primary topic for resource search
    niche = primary_topic.split()[0] if primary_topic else "kitchen"

    # ------------------------------------------------------------------
    # Load backlink target config from Supabase (falls back to state,
    # then to permissive defaults so existing behaviour is preserved).
    # ------------------------------------------------------------------
    _ALL_METHODS = [
        "competitor_backlink", "content_explorer", "unlinked_mention",
        "resource_page", "broken_link", "haro", "niche_blog_search",
        "company_search", "roundup_search",
    ]
    try:
        _bl_configs = supabase_tools.query_table(
            "backlink_target_config",
            filters={"target_site": target_site},
            limit=1,
        )
        _bl_config: dict[str, Any] = _bl_configs[0] if _bl_configs else {}
    except Exception:
        logger.debug(
            "Could not load backlink_target_config for %s, using defaults",
            target_site,
            exc_info=True,
        )
        _bl_config = {}

    min_dr: int = _bl_config.get(
        "min_dr", state.get("backlink_min_dr", 0)
    )
    enabled_methods: list[str] = _bl_config.get(
        "enabled_methods", state.get("backlink_enabled_methods", _ALL_METHODS)
    )
    excluded_domains: set[str] = set(
        _bl_config.get(
            "excluded_domains",
            state.get("backlink_excluded_domains", []),
        )
    )
    max_per_method: int = _bl_config.get(
        "max_prospects_per_method",
        state.get("backlink_max_per_method", 50),
    )

    logger.info(
        "Backlink config for %s: min_dr=%d, methods=%s, excluded=%d domains",
        target_site, min_dr, enabled_methods, len(excluded_domains),
    )

    all_prospects: list[dict[str, Any]] = []

    # 1. Competitor Backlink Mining
    if "competitor_backlink" in enabled_methods:
        logger.info("Step 1/9: Mining competitor backlinks for %s", target_site)
        try:
            competitor_prospects = _mine_competitor_backlinks(competitors)
            all_prospects.extend(competitor_prospects)
            logger.info("Found %d competitor backlink prospects", len(competitor_prospects))
        except Exception as exc:
            msg = f"Competitor backlink mining failed: {exc}"
            logger.error(msg, exc_info=True)
            errors.append(msg)

    # 2. Content Explorer
    if "content_explorer" in enabled_methods:
        logger.info("Step 2/9: Searching content explorer for %s", target_site)
        try:
            content_prospects = _explore_content(target_site)
            all_prospects.extend(content_prospects)
            logger.info("Found %d content explorer prospects", len(content_prospects))
        except Exception as exc:
            msg = f"Content explorer search failed: {exc}"
            logger.error(msg, exc_info=True)
            errors.append(msg)

    # 3. Unlinked Mentions
    if "unlinked_mention" in enabled_methods:
        logger.info("Step 3/9: Finding unlinked mentions for %s", domain)
        try:
            mention_prospects = _find_unlinked_mentions(domain)
            all_prospects.extend(mention_prospects)
            logger.info("Found %d unlinked mention prospects", len(mention_prospects))
        except Exception as exc:
            msg = f"Unlinked mentions search failed: {exc}"
            logger.error(msg, exc_info=True)
            errors.append(msg)

    # 4. Resource Pages
    if "resource_page" in enabled_methods:
        logger.info("Step 4/9: Searching resource pages for niche '%s'", niche)
        try:
            resource_prospects = _find_resource_pages(niche)
            all_prospects.extend(resource_prospects)
            logger.info("Found %d resource page prospects", len(resource_prospects))
        except Exception as exc:
            msg = f"Resource page search failed: {exc}"
            logger.error(msg, exc_info=True)
            errors.append(msg)

    # 5. Broken Links
    if "broken_link" in enabled_methods:
        logger.info("Step 5/9: Checking broken links for competitors")
        try:
            broken_prospects = _find_broken_links(competitors)
            all_prospects.extend(broken_prospects)
            logger.info("Found %d broken link prospects", len(broken_prospects))
        except Exception as exc:
            msg = f"Broken link search failed: {exc}"
            logger.error(msg, exc_info=True)
            errors.append(msg)

    # 5b. Enrich broken link prospects with Wayback Machine context
    broken_with_dead_urls = [
        p for p in all_prospects
        if p.get("discovery_method") == "broken_link" and p.get("dead_url")
    ]
    if broken_with_dead_urls:
        logger.info(
            "Enriching %d broken link prospects with Wayback context",
            len(broken_with_dead_urls),
        )
        try:
            from agents.seo_agent.tools.wayback_tools import summarise_dead_page

            weekly_spend = state.get("llm_spend_this_week", 0.0)
            for prospect in broken_with_dead_urls[:10]:  # Cap at 10 lookups
                dead_url = prospect.get("dead_url", "")
                if not dead_url:
                    continue
                try:
                    wb_result = summarise_dead_page(
                        dead_url,
                        weekly_spend=weekly_spend,
                        site=target_site,
                    )
                    if wb_result.get("found"):
                        prospect["dead_page_topic"] = wb_result.get("dead_page_topic", "")
                        prospect["wayback_url"] = wb_result.get("wayback_url", "")
                        logger.debug(
                            "Wayback context for %s: %s",
                            dead_url,
                            wb_result.get("dead_page_topic", "")[:80],
                        )
                except Exception:
                    logger.debug("Wayback lookup failed for %s", dead_url, exc_info=True)
        except ImportError:
            logger.warning("wayback_tools not available, skipping Wayback enrichment")

    # 6. HARO Requests
    if "haro" in enabled_methods:
        logger.info("Step 6/9: Searching HARO requests")
        try:
            haro_prospects = _search_haro()
            all_prospects.extend(haro_prospects)
            logger.info("Found %d HARO prospects", len(haro_prospects))
        except Exception as exc:
            msg = f"HARO search failed: {exc}"
            logger.error(msg, exc_info=True)
            errors.append(msg)

    # 7. Blogger Discovery (web search)
    if "niche_blog_search" in enabled_methods:
        logger.info("Step 7/9: Searching for niche bloggers relevant to %s", target_site)
        try:
            blog_prospects = _discover_bloggers(target_site)
            all_prospects.extend(blog_prospects)
            logger.info("Found %d blogger prospects", len(blog_prospects))
        except Exception as exc:
            msg = f"Blogger discovery failed: {exc}"
            logger.error(msg, exc_info=True)
            errors.append(msg)

    # 8. Company/Provider Discovery (web search)
    if "company_search" in enabled_methods:
        logger.info("Step 8/9: Searching for kitchen/bathroom companies for partnerships")
        try:
            company_prospects = _discover_companies(target_site)
            all_prospects.extend(company_prospects)
            logger.info("Found %d company prospects", len(company_prospects))
        except Exception as exc:
            msg = f"Company discovery failed: {exc}"
            logger.error(msg, exc_info=True)
            errors.append(msg)

    # 9. Roundup/Listicle Discovery (web search)
    if "roundup_search" in enabled_methods:
        keyword_cluster = state.get("keyword_cluster", [])
        logger.info("Step 9/9: Searching for roundup/listicle pages for %s", target_site)
        try:
            roundup_prospects = _search_roundups(target_site, keyword_cluster or None)
            all_prospects.extend(roundup_prospects)
            logger.info("Found %d roundup/listicle prospects", len(roundup_prospects))
        except Exception as exc:
            msg = f"Roundup discovery failed: {exc}"
            logger.error(msg, exc_info=True)
            errors.append(msg)

    # Deduplicate across all methods
    unique_prospects = _deduplicate_prospects(all_prospects)
    logger.info(
        "Total prospects after deduplication: %d (from %d raw)",
        len(unique_prospects),
        len(all_prospects),
    )

    # Apply min_dr filter
    if min_dr > 0:
        pre_filter_count = len(unique_prospects)
        unique_prospects = [
            p for p in unique_prospects if p.get("dr", 0) >= min_dr
        ]
        logger.info(
            "DR filter (min_dr=%d): %d -> %d prospects",
            min_dr, pre_filter_count, len(unique_prospects),
        )

    # Apply excluded domains filter
    if excluded_domains:
        pre_filter_count = len(unique_prospects)
        unique_prospects = [
            p for p in unique_prospects
            if p.get("domain", "") not in excluded_domains
        ]
        logger.info(
            "Excluded domains filter: %d -> %d prospects",
            pre_filter_count, len(unique_prospects),
        )

    # Cap results per discovery method
    method_counts: Counter[str] = Counter()
    capped_prospects: list[dict[str, Any]] = []
    for p in unique_prospects:
        method = p.get("discovery_method", "unknown")
        if method_counts[method] < max_per_method:
            capped_prospects.append(p)
            method_counts[method] += 1
    unique_prospects = capped_prospects

    # Save each prospect to Supabase
    saved_prospects: list[dict[str, Any]] = []
    for prospect in unique_prospects:
        record = {
            "domain": prospect.get("domain", ""),
            "page_url": prospect.get("page_url", ""),
            "page_title": prospect.get("page_title", ""),
            "dr": prospect.get("dr", 0),
            "monthly_traffic": prospect.get("monthly_traffic", 0),
            "discovery_method": prospect.get("discovery_method", "unknown"),
            "segment": prospect.get("segment", ""),
            "links_to_competitor": prospect.get("links_to_competitor", False),
            "competitor_names": prospect.get("competitor_names", []),
            "status": "new",
            "target_site": target_site,
        }
        # Include broken link context if available (Wayback enrichment)
        if prospect.get("dead_url"):
            record["dead_url"] = prospect["dead_url"]
        if prospect.get("dead_page_topic"):
            record["dead_page_topic"] = prospect["dead_page_topic"]
        if prospect.get("wayback_url"):
            record["wayback_url"] = prospect["wayback_url"]
        if prospect.get("anchor"):
            record["anchor"] = prospect["anchor"]
        # Include roundup-specific fields
        if prospect.get("mentions_competitors") is not None:
            record["mentions_competitors"] = prospect["mentions_competitors"]
        if prospect.get("already_lists_us") is not None:
            record["already_lists_us"] = prospect["already_lists_us"]
        try:
            saved = supabase_tools.insert_record(
                "seo_backlink_prospects", record
            )
            saved_prospects.append(saved)
        except Exception:
            msg = (
                f"Failed to save prospect '{prospect.get('page_url', '')}' "
                f"to Supabase"
            )
            logger.warning(msg, exc_info=True)
            errors.append(msg)

    # Save HARO requests with pending_review status
    for prospect in unique_prospects:
        if prospect.get("discovery_method") == "haro":
            try:
                supabase_tools.insert_record(
                    "haro_responses",
                    {
                        "request_topic": prospect.get("topic", ""),
                        "target_publication": prospect.get("page_title", ""),
                        "status": "pending_review",
                    },
                )
            except Exception:
                msg = f"Failed to save HARO response for '{prospect.get('topic', '')}'"
                logger.warning(msg, exc_info=True)
                errors.append(msg)

    logger.info(
        "Backlink prospecting complete for %s: %d prospects saved",
        target_site,
        len(saved_prospects),
    )

    return {
        "backlink_prospects": saved_prospects,
        "errors": errors,
        "next_node": "END",
    }
