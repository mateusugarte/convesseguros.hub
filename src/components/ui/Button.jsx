import { Loader2 } from 'lucide-react'

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  destructive: 'btn-danger',
}

const SIZES = {
  sm: 'min-h-[36px] px-3 py-1.5 text-xs gap-1.5',
  md: 'min-h-[42px] px-4 py-2 text-sm gap-2',
  lg: 'min-h-[48px] px-5 py-3 text-base gap-2.5',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  iconLeft = null,
  iconRight = null,
  children,
  className = '',
  fullWidth = false,
  disabled,
  type = 'button',
  ...props
}) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      className={[
        VARIANTS[variant] || VARIANTS.primary,
        SIZES[size] || SIZES.md,
        fullWidth ? 'w-full' : '',
        'inline-flex items-center justify-center font-semibold cursor-pointer',
        className,
      ].filter(Boolean).join(' ')}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  )
}
