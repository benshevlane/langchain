import { useGoals } from '../../hooks/useGoals'
import { useStrategyConfig } from '../../hooks/useStrategyConfig'
import { Spinner } from '../ui/Spinner'
import { GoalCard } from './GoalCard'
import { ConfigGroup } from './ConfigGroup'
import { BlockedListEditor } from './BlockedListEditor'

const CATEGORY_ORDER = ['general', 'content', 'prospecting', 'outreach']

export function StrategyDashboard() {
  const { goals, loading: goalsLoading, updateGoal, savingGoal } = useGoals()
  const { grouped, loading: configLoading, error, updateConfig, savingKey } = useStrategyConfig()

  if (goalsLoading && configLoading) return <Spinner />

  // Extract blocked lists for dedicated editors
  const blockedKeywords = grouped['content']?.find((c) => c.key === 'blocked_keywords')
  const blockedDomains = grouped['outreach']?.find((c) => c.key === 'blocked_domains')

  // Filter blocked items out of the regular config groups
  const filteredGrouped = Object.fromEntries(
    Object.entries(grouped).map(([cat, configs]) => [
      cat,
      configs.filter((c) => c.key !== 'blocked_keywords' && c.key !== 'blocked_domains'),
    ])
  )

  return (
    <div className="space-y-8">
      {/* Section: Campaign Goals */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">Campaign Goals</h2>
        {goals.length === 0 && !goalsLoading ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            No goals configured yet. Goals are seeded automatically when the worker runs.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onUpdate={updateGoal}
                saving={savingGoal === goal.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* Section: Strategy Config */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">Strategy Config</h2>
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {CATEGORY_ORDER.map((cat) => {
            const configs = filteredGrouped[cat]
            if (!configs || configs.length === 0) return null
            return (
              <ConfigGroup
                key={cat}
                category={cat}
                configs={configs}
                onUpdate={updateConfig}
                savingKey={savingKey}
              />
            )
          })}
        </div>
      </section>

      {/* Section: Blocked Lists */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">Blocked Lists</h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <BlockedListEditor
            label="Blocked Keywords"
            description="Keywords that the agent will never target for content or SEO"
            value={blockedKeywords?.value ?? ''}
            onUpdate={(val) => updateConfig('blocked_keywords', val)}
            saving={savingKey === 'blocked_keywords'}
          />
          <BlockedListEditor
            label="Blocked Domains"
            description="Domains that the agent will never contact for outreach"
            value={blockedDomains?.value ?? ''}
            onUpdate={(val) => updateConfig('blocked_domains', val)}
            saving={savingKey === 'blocked_domains'}
          />
        </div>
      </section>
    </div>
  )
}
