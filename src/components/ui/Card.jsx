export function Card({ children, className = '', onClick, ...props }) {
  return (
    <div
      {...props}
      onClick={onClick}
      className={`card p-4 ${onClick ? 'cursor-pointer card-hover' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
