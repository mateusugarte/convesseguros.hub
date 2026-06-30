export function EmptyState({
  icon = null,
  title,
  description,
  actions = null,
  className = '',
}) {
  return (
    <div className={`ops-empty-state flex flex-col items-center justify-center gap-4 px-6 py-12 text-center ${className}`}>
      {icon && (
        <div className="w-14 h-14 rounded-3xl border border-brand-accent/15 bg-brand-accent/10 text-status-info flex items-center justify-center">
          {icon}
        </div>
      )}
      <div className="space-y-2 max-w-md">
        <h3 className="title-section text-dark-text">{title}</h3>
        {description && <p className="text-sm text-dark-muted leading-relaxed">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center justify-center gap-3">{actions}</div>}
    </div>
  )
}
