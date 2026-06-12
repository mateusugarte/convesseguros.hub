export function FilterBar({
  children,
  actions = null,
  className = '',
}) {
  return (
    <div className={`ops-filter-bar p-4 ${className}`}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {children}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
