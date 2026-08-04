const SURFACES = {
  default: 'card',
  data: 'ops-data-card',
  metric: 'ops-metric-card',
  empty: 'ops-empty-state',
}

const PADDING = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
}

export function Card({
  children,
  className = '',
  onClick,
  surface = 'default',
  padding = 'md',
  hoverable,
  ...props
}) {
  const isHoverable = hoverable ?? Boolean(onClick)

  return (
    <div
      {...props}
      onClick={onClick}
      className={[
        SURFACES[surface] || SURFACES.default,
        PADDING[padding] || PADDING.md,
        isHoverable ? 'cursor-pointer card-hover' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  )
}
