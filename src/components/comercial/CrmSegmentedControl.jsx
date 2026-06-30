function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

export default function CrmSegmentedControl({ options, value, onChange, className = '' }) {
  return (
    <div className={cx('inline-flex flex-wrap rounded-2xl border border-dark-border/60 bg-dark-surface/70 p-1 shadow-sm', className)}>
      {options.map(option => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cx(
              'rounded-xl px-3.5 py-2 text-xs font-semibold transition-all',
              active ? 'bg-dark-text text-white shadow-sm' : 'text-dark-muted hover:text-dark-text'
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
