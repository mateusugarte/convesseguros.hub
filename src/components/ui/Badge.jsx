const VARIANTS = {
  success:    'badge-success',
  danger:     'badge-danger',
  warning:    'badge-warning',
  info:       'badge-info',
  purple:     'badge-purple',
  muted:      'badge-muted',
  blue:       'badge-blue',
  default:    'badge-muted',
}

const SIZES = {
  sm: 'text-[10px] px-1.5 py-px',
  md: '',
}

export function Badge({ variant = 'default', size = 'md', icon: Icon, children, className = '' }) {
  return (
    <span className={`badge ${VARIANTS[variant]} ${SIZES[size]} ${className}`}>
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </span>
  )
}
