function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

export default function CrmSectionCard({
  title,
  subtitle,
  action,
  children,
  className = '',
  contentClassName = 'p-5',
  headerClassName = '',
}) {
  return (
    <section
      className={cx(
        'overflow-hidden rounded-[28px] border border-dark-border/60 bg-dark-surface/70 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm',
        className
      )}
    >
      {(title || subtitle || action) && (
        <div className={cx('flex items-start justify-between gap-4 border-b border-dark-border/50 px-5 py-4', headerClassName)}>
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-dark-text">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm text-dark-muted">{subtitle}</p>}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      <div className={contentClassName}>{children}</div>
    </section>
  )
}
