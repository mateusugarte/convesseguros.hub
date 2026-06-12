export function PageHeader({
  eyebrow,
  title,
  description,
  actions = null,
  stats = null,
  className = '',
}) {
  return (
    <section className={`ops-page-header p-6 md:p-8 ${className}`}>
      <div className="relative z-[1] flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          {eyebrow && <div className="ops-kicker mb-4">{eyebrow}</div>}
          <h1 className="title-display text-dark-text">{title}</h1>
          {description && <p className="mt-3 text-sm md:text-base text-dark-muted max-w-2xl leading-relaxed">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>

      {stats && (
        <div className="relative z-[1] mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats}
        </div>
      )}
    </section>
  )
}
