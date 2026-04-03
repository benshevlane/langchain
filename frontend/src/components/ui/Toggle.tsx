interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
}

export function Toggle({ checked, onChange, disabled = false, label }: ToggleProps) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50 ${
          checked ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-surface-hover)]'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
          }`}
        />
      </button>
      {label && (
        <span className="text-sm text-[var(--color-text-muted)]">{label}</span>
      )}
    </label>
  )
}
