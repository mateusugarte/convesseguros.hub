function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

export default function CrmPageHeader({
  eyebrow,
  title,
  description,
  aside,
  actions,
  className = '',
}) {
  return (
    <header
      className={cx(
        'relative overflow-hidden rounded-[32px] border border-dark-border/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(243,247,255,0.92)_46%,rgba(231,242,255,0.92))] p-6 shadow-[0_28px_80px_rgba(37,99,235,0.10)]',
        className
      )}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          {eyebrow && (
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-status-info">
              {eyebrow}
            </p>
          )}
          <h1 className="text-3xl font-black tracking-tight text-dark-text md:text-4xl">{title}</h1>
          {description && <p className="mt-3 max-w-2xl text-sm leading-6 text-dark-muted md:text-base">{description}</p>}
        </div>
        {(aside || actions) && (
          <div className="flex w-full flex-col gap-4 xl:w-auto xl:min-w-[280px] xl:items-end">
            {aside}
            {actions && <div className="flex flex-wrap items-center gap-2 xl:justify-end">{actions}</div>}
          </div>
        )}
      </div>
    </header>
  )
}
