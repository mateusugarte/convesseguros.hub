export function MetricCard({
  label,
  value,
  hint,
  icon = null,
  tone = 'accent',
  className = '',
}) {
  const toneClasses = {
    accent: 'text-status-info bg-brand-accent/10 border-brand-accent/15',
    secondary: 'text-status-info bg-brand-secondary/10 border-brand-secondary/15',
    success: 'text-status-success bg-status-success/10 border-status-success/15',
    warning: 'text-status-warning bg-status-warning/10 border-status-warning/15',
  }

  return (
    <article className={`ops-metric-card p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="metric-label">{label}</p>
          <p className="stat-number text-dark-text mt-3">{value}</p>
        </div>
        {icon && (
          <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center ${toneClasses[tone] || toneClasses.accent}`}>
            {icon}
          </div>
        )}
      </div>
      {hint && <p className="metric-sub mt-3">{hint}</p>}
    </article>
  )
}
