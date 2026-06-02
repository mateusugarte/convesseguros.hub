// Paleta de cores consistente para seguradoras (hash-based)
const PALETTE = [
  { bg: '#1D4ED8', fg: '#DBEAFE' }, // blue
  { bg: '#B45309', fg: '#FEF3C7' }, // amber
  { bg: '#065F46', fg: '#D1FAE5' }, // emerald
  { bg: '#7C3AED', fg: '#EDE9FE' }, // violet
  { bg: '#DC2626', fg: '#FEE2E2' }, // red
  { bg: '#0E7490', fg: '#CFFAFE' }, // cyan
  { bg: '#BE185D', fg: '#FCE7F3' }, // pink
  { bg: '#4338CA', fg: '#E0E7FF' }, // indigo
]

function paleta(nome) {
  let h = 0
  for (let i = 0; i < (nome || '').length; i++) h = nome.charCodeAt(i) + ((h << 5) - h)
  return PALETTE[Math.abs(h) % PALETTE.length]
}

const SKIP = new Set(['de','da','do','seguros','seguro','s/a','sa','ltda','cia'])

function iniciais(nome) {
  if (!nome) return '?'
  const words = nome.trim().split(/\s+/).filter(w => !SKIP.has(w.toLowerCase()))
  if (!words.length) return nome.slice(0, 2).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

const SIZE = {
  xs: { circle: 'w-4 h-4 text-[7px] rounded', text: 'text-[9px]' },
  sm: { circle: 'w-5 h-5 text-[8px] rounded', text: 'text-[10px]' },
  md: { circle: 'w-7 h-7 text-[11px] rounded-lg', text: 'text-xs' },
  lg: { circle: 'w-9 h-9 text-sm rounded-xl', text: 'text-sm' },
}

export default function SeguradoraBadge({ nome, size = 'sm', showName = true, className = '' }) {
  if (!nome) return null
  const { bg, fg } = paleta(nome)
  const { circle, text } = SIZE[size] || SIZE.sm

  return (
    <div className={`flex items-center gap-1.5 min-w-0 ${className}`} title={nome}>
      <div
        className={`${circle} flex items-center justify-center font-bold flex-shrink-0`}
        style={{ background: bg, color: fg }}
      >
        {iniciais(nome)}
      </div>
      {showName && (
        <span className={`${text} text-dark-text truncate`}>{nome}</span>
      )}
    </div>
  )
}
