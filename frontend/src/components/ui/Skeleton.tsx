interface SkeletonProps {
  className?: string
}

export function SkeletonLine({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-[var(--color-surface-hover)] ${className}`}
      style={{ height: '0.75rem' }}
    />
  )
}

export function SkeletonCard({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-[var(--color-surface-hover)]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/3 rounded bg-[var(--color-surface-hover)]" />
          <div className="h-3 w-2/3 rounded bg-[var(--color-surface-hover)]" />
        </div>
      </div>
      <div className="mt-4 border-t border-[var(--color-border)] pt-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="h-3 w-16 rounded bg-[var(--color-surface-hover)]" />
            <div className="h-4 w-24 rounded bg-[var(--color-surface-hover)]" />
          </div>
          <div className="space-y-1">
            <div className="h-3 w-16 rounded bg-[var(--color-surface-hover)]" />
            <div className="h-4 w-12 rounded bg-[var(--color-surface-hover)]" />
          </div>
          <div className="space-y-1">
            <div className="h-3 w-16 rounded bg-[var(--color-surface-hover)]" />
            <div className="h-4 w-20 rounded bg-[var(--color-surface-hover)]" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function SkeletonChart({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 ${className}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="h-5 w-24 rounded bg-[var(--color-surface-hover)]" />
        <div className="h-4 w-20 rounded bg-[var(--color-surface-hover)]" />
      </div>
      <div className="flex h-[240px] items-end gap-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-[var(--color-surface-hover)]"
            style={{ height: `${30 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    </div>
  )
}

export function SkeletonList({ rows = 5, className = '' }: SkeletonProps & { rows?: number }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-3">
          <div className="h-4 w-4 rounded-full bg-[var(--color-surface-hover)]" />
          <div className="flex-1 space-y-1">
            <div className="h-3.5 w-2/5 rounded bg-[var(--color-surface-hover)]" />
            <div className="h-3 w-3/5 rounded bg-[var(--color-surface-hover)]" />
          </div>
          <div className="h-3 w-16 rounded bg-[var(--color-surface-hover)]" />
        </div>
      ))}
    </div>
  )
}
