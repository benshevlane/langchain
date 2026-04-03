import { supabase, isConfigured } from './supabase'
import type { BacklinkProspect } from '../types/database'

/**
 * Derive a human-readable company name from a domain string.
 *
 * Strips common TLD suffixes, replaces separators with spaces, and
 * title-cases each word.
 *
 * Args:
 *     domain: Raw domain string (e.g. "my-kitchen-co.com").
 *
 * Returns:
 *     Title-cased company name (e.g. "My Kitchen Co").
 */
function companyNameFromDomain(domain: string): string {
  return domain
    .replace(/^www\./, '')
    .replace(/\.(com|co\.uk|org|net|io|co)$/i, '')
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export interface PromoteResult {
  success: boolean
  contactId?: string
  error?: string
}

/**
 * Promote a scored backlink prospect into the CRM contacts table.
 *
 * Maps available prospect fields to CrmContact columns and sets sensible
 * defaults for fields that have no source data. Also marks the prospect
 * as "promoted" so it cannot be promoted a second time.
 *
 * Args:
 *     prospect: The backlink prospect record to promote.
 *
 * Returns:
 *     A `PromoteResult` indicating success or failure.
 */
export async function promoteToCrm(prospect: BacklinkProspect): Promise<PromoteResult> {
  if (!isConfigured || !supabase) {
    return { success: false, error: 'Supabase is not configured' }
  }

  // Build notes from outreach context
  const notesParts: string[] = []
  if (prospect.outreach_angle) notesParts.push(`Outreach angle: ${prospect.outreach_angle}`)
  if (prospect.personalisation_notes) notesParts.push(`Notes: ${prospect.personalisation_notes}`)

  const tags: string[] = []
  if (prospect.discovery_method) tags.push(prospect.discovery_method)
  if (prospect.target_site) tags.push(prospect.target_site)

  const payload = {
    company_name: companyNameFromDomain(prospect.domain),
    contact_name: prospect.author_name ?? null,
    email: prospect.contact_email ?? null,
    website: prospect.domain,
    category: prospect.prospect_type ?? 'backlink_prospect',
    outreach_status: 'not_contacted',
    score: prospect.score,
    tier: prospect.tier ?? null,
    source: `prospect:${prospect.id}`,
    tags,
    notes: notesParts.length > 0 ? notesParts.join('\n') : null,
    country: 'GB',
  }

  const { data, error } = await supabase
    .from('crm_contacts')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Mark the prospect as promoted
  await supabase
    .from('seo_backlink_prospects')
    .update({ status: 'promoted' })
    .eq('id', prospect.id)

  return { success: true, contactId: data.id }
}
