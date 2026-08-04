export function DataCard({
  title,
  subtitle,
  actions = null,
  children,
  className = '',
  bodyClassName = '',
}) {
  return (
    <section className={`ops-data-card ${className}`}>
      {(title || subtitle || actions) && (
        <header className="relative z-[1] flex flex-col gap-3 border-b border-dark-border/60 px-5 py-4 md:flex-row md:items-start md:justify-between">
          <div>
            {title && <h2 className="title-section text-dark-text">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm text-dark-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={`relative z-[1] px-5 py-5 ${bodyClassName}`}>
        {children}
      </div>
    </section>
  )
}
