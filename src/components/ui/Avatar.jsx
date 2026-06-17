import { useEffect, useState } from 'react'

const PALETTE = ['#F5582A','#10B981','#F97316','#8B5CF6','#EC4899','#06B6D4','#2B5BA8']

function nameToColor(str) {
  let h = 0
  for (let i = 0; i < (str || '').length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return PALETTE[Math.abs(h) % PALETTE.length]
}

function initials(name) {
  if (!name) return ''
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

const SIZES = {
  sm: 'w-6 h-6 text-[9px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
}

export function Avatar({ name, src, size = 'md', className = '' }) {
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    setImageError(false)
  }, [src])

  return (
    <div
      className={`${SIZES[size]} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 overflow-hidden ${className}`}
      style={!src  { background: nameToColor(name) } : undefined}
    >
      {src && !imageError
         <img src={src} alt={name} className="w-full h-full object-cover" onError={() => setImageError(true)} />
        : initials(name)
      }
    </div>
  )
}
