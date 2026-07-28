import {
  ArrowLeft,
  ChevronRight,
  LoaderCircle,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'

const TONE_CLASS = {
  neutral: 'is-neutral',
  info: 'is-info',
  new: 'is-new',
  renewal: 'is-renewal',
  endorsement: 'is-endorsement',
  success: 'is-success',
  warning: 'is-warning',
  danger: 'is-danger',
}

export function AutoPageHeader({
  title,
  description,
  context = 'Seguro Auto',
  onBack,
  backLabel = 'Voltar',
  actions,
  meta,
}) {
  return (
    <header className="auto-v2-header auto-v2-enter">
      <div className="auto-v2-header-glow" aria-hidden="true" />
      <div className="auto-v2-header-main">
        <div className="auto-v2-header-copy">
          {onBack && (
            <button type="button" onClick={onBack} className="auto-v2-back">
              <ArrowLeft aria-hidden="true" />
              <span>{backLabel}</span>
            </button>
          )}
          <div className="auto-v2-context">
            <span className="auto-v2-context-mark">
              <Sparkles aria-hidden="true" />
            </span>
            <span>{context}</span>
          </div>
          <h1>{title}</h1>
          {description && <p className="auto-v2-description">{description}</p>}
          {meta && <div className="auto-v2-header-meta">{meta}</div>}
        </div>
        {actions && <div className="auto-v2-header-actions">{actions}</div>}
      </div>
    </header>
  )
}

export function AutoStatStrip({ items = [], className = '' }) {
  return (
    <section className={`auto-v2-stat-strip auto-v2-stagger ${className}`} style={{ '--auto-stat-count': Math.min(items.length || 1, 5) }} aria-label="Indicadores">
      {items.map(item => {
        const Icon = item.icon
        return (
          <div key={item.key || item.label} className={`auto-v2-stat ${TONE_CLASS[item.tone] || TONE_CLASS.neutral}`}>
            <div className="auto-v2-stat-copy">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              {item.hint && <small>{item.hint}</small>}
            </div>
            {Icon && (
              <span className="auto-v2-stat-icon-wrap">
                <Icon className="auto-v2-stat-icon" aria-hidden="true" />
              </span>
            )}
          </div>
        )
      })}
    </section>
  )
}

export function AutoTabs({ items = [], value, onChange, ariaLabel = 'Seções' }) {
  return (
    <div className="auto-v2-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map(item => {
        const Icon = item.icon
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={active ? 'is-active' : ''}
            onClick={() => onChange(item.value)}
          >
            {Icon && <Icon aria-hidden="true" />}
            <span>{item.label}</span>
            {item.count !== undefined && <small>{item.count}</small>}
          </button>
        )
      })}
    </div>
  )
}

export function AutoPanel({ title, description, actions, children, className = '' }) {
  return (
    <section className={`auto-v2-panel auto-v2-enter ${className}`}>
      {(title || description || actions) && (
        <header>
          <div className="auto-v2-panel-heading">
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
          {actions && <div className="auto-v2-panel-actions">{actions}</div>}
        </header>
      )}
      <div className="auto-v2-panel-body">{children}</div>
    </section>
  )
}

export function AutoBadge({ children, tone = 'neutral', icon: Icon }) {
  return (
    <span className={`auto-v2-badge ${TONE_CLASS[tone] || TONE_CLASS.neutral}`}>
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </span>
  )
}

export function AutoTypeBadge({ type }) {
  const normalized = String(type || 'novo').toLowerCase()
  const config = normalized === 'renovacao'
    ? { label: 'Renovação', tone: 'renewal' }
    : normalized === 'endosso'
      ? { label: 'Endosso', tone: 'endorsement' }
      : { label: 'Seguro novo', tone: 'new' }
  return <AutoBadge tone={config.tone}>{config.label}</AutoBadge>
}

export function AutoMoneyDelta({ current = 0, previous = 0, format }) {
  const currentValue = Number(current) || 0
  const previousValue = Number(previous) || 0
  const delta = currentValue - previousValue
  const positive = delta > 0
  const negative = delta < 0
  const formatter = format || (value => String(value))

  return (
    <div className={`auto-v2-money-delta ${positive ? 'is-positive' : negative ? 'is-negative' : 'is-neutral'}`}>
      <strong>{formatter(currentValue)}</strong>
      <span>
        {positive && <TrendingUp aria-hidden="true" />}
        {negative && <TrendingDown aria-hidden="true" />}
        {delta === 0 ? 'Sem variação' : `${positive ? '+' : ''}${formatter(delta)}`}
      </span>
      <small>Anterior: {formatter(previousValue)}</small>
    </div>
  )
}

export function AutoListRow({ title, subtitle, meta, leading, badges, onClick, disabled = false }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      className="auto-v2-list-row"
    >
      {leading && <div className="auto-v2-list-leading">{leading}</div>}
      <div className="auto-v2-list-copy">
        <strong>{title}</strong>
        {subtitle && <span>{subtitle}</span>}
        {badges && <div className="auto-v2-list-badges">{badges}</div>}
      </div>
      {meta && <div className="auto-v2-list-meta">{meta}</div>}
      {onClick && <ChevronRight className="auto-v2-list-arrow" aria-hidden="true" />}
    </Tag>
  )
}

export function AutoInfoGrid({ items = [] }) {
  return (
    <dl className="auto-v2-info-grid">
      {items.map(item => (
        <div key={item.key || item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value || '—'}</dd>
          {item.hint && <small>{item.hint}</small>}
        </div>
      ))}
    </dl>
  )
}

export function AutoLoading({ label = 'Carregando...' }) {
  return (
    <div className="auto-v2-loading" role="status">
      <LoaderCircle aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function AutoInlineAlert({ title, description, tone = 'warning', icon: Icon, actions }) {
  return (
    <section className={`auto-v2-alert ${TONE_CLASS[tone] || TONE_CLASS.warning}`} role="status">
      {Icon && <Icon className="auto-v2-alert-icon" aria-hidden="true" />}
      <div>
        <strong>{title}</strong>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="auto-v2-alert-actions">{actions}</div>}
    </section>
  )
}

export function AutoStickyActions({ children }) {
  return <div className="auto-v2-sticky-actions">{children}</div>
}
export function AutoActionCard({
  icon: Icon,
  eyebrow,
  title,
  description,
  value,
  tone = 'info',
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`auto-v2-action-card ${TONE_CLASS[tone] || TONE_CLASS.info}`}
    >
      <span className="auto-v2-action-icon">
        {Icon && <Icon aria-hidden="true" />}
      </span>
      <span className="auto-v2-action-copy">
        {eyebrow && <small>{eyebrow}</small>}
        <strong>{title}</strong>
        {description && <span>{description}</span>}
      </span>
      {value !== undefined && <b>{value}</b>}
      <ChevronRight className="auto-v2-action-arrow" aria-hidden="true" />
    </button>
  )
}