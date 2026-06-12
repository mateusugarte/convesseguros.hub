export function SectionHeading({
  eyebrow,
  title,
  description,
  actions = null,
  className = '',
}) {
  return (
    <div className={`ops-section-heading ${className}`}>
      <div>
        {eyebrow && <div className="ops-kicker mb-3">{eyebrow}</div>}
        <h2 className="section-title">{title}</h2>
        {description && <p className="section-lead mt-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
