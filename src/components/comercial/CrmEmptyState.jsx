export default function CrmEmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-[24px] border border-dashed border-dark-border/70 bg-dark-surface/50 text-center ${
        compact ? 'px-4 py-8' : 'px-6 py-12'
      }`}
    >
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-status-info/10 text-status-info">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-dark-text">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm text-dark-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
