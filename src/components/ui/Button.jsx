import { Loader2 } from 'lucide-react'

const VARIANTS = {
  primary:     'btn-primary',
  secondary:   'btn-secondary',
  ghost:       'btn-ghost',
  destructive: 'btn-danger',
}

const SIZES = {
  sm: 'text-xs px-3 py-1.5 gap-1.5',
  md: '',
  lg: 'text-base px-5 py-3 gap-2.5',
}

export function Button({
  variant  = 'primary',
  size     = 'md',
  loading  = false,
  iconLeft = null,
  iconRight= null,
  children,
  className = '',
  disabled,
  ...props
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`${VARIANTS[variant]} ${SIZES[size]} cursor-pointer ${className}`}
    >
      {loading
        ? <Loader2 className="w-4 h-4 animate-spin" />
        : iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  )
}
