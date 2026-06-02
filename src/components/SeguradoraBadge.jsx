import { useState } from 'react'

// ── Mapa de logos por nome (inclui variações comuns) ──────────────────────────

const LOGOS = {
  // Porto Seguro
  'porto seguro':         'https://uqkzxtelctaaqvrihnfg.supabase.co/storage/v1/object/public/conves/porto.jpg',
  'porto seguros':        'https://uqkzxtelctaaqvrihnfg.supabase.co/storage/v1/object/public/conves/porto.jpg',
  'porto':                'https://uqkzxtelctaaqvrihnfg.supabase.co/storage/v1/object/public/conves/porto.jpg',

  // Pottencial
  'pottencial seguros':   'https://uqkzxtelctaaqvrihnfg.supabase.co/storage/v1/object/public/conves/pottencial.jfif',
  'pottencial':           'https://uqkzxtelctaaqvrihnfg.supabase.co/storage/v1/object/public/conves/pottencial.jfif',
  'potencial':            'https://uqkzxtelctaaqvrihnfg.supabase.co/storage/v1/object/public/conves/pottencial.jfif',
  'potencial seguros':    'https://uqkzxtelctaaqvrihnfg.supabase.co/storage/v1/object/public/conves/pottencial.jfif',

  // TOO Seguros
  'too seguros':          'https://uqkzxtelctaaqvrihnfg.supabase.co/storage/v1/object/public/conves/too.png',
  'too':                  'https://uqkzxtelctaaqvrihnfg.supabase.co/storage/v1/object/public/conves/too.png',

  // Junto Seguros
  'junto seguros':        'https://uqkzxtelctaaqvrihnfg.supabase.co/storage/v1/object/public/conves/junto%20seguros.png',
  'junto':                'https://uqkzxtelctaaqvrihnfg.supabase.co/storage/v1/object/public/conves/junto%20seguros.png',

  // Tokio Marine
  'tokio marine':         'https://uqkzxtelctaaqvrihnfg.supabase.co/storage/v1/object/public/conves/junto%20seguros.png',
  'tokio':                'https://uqkzxtelctaaqvrihnfg.supabase.co/storage/v1/object/public/conves/junto%20seguros.png',
  'tokyo marine':         'https://uqkzxtelctaaqvrihnfg.supabase.co/storage/v1/object/public/conves/junto%20seguros.png',
}

function getLogo(nome) {
  return LOGOS[(nome || '').toLowerCase().trim()] || null
}

// ── Fallback: paleta de cores + iniciais ──────────────────────────────────────

const PALETTE = [
  { bg: '#1D4ED8', fg: '#DBEAFE' },
  { bg: '#B45309', fg: '#FEF3C7' },
  { bg: '#065F46', fg: '#D1FAE5' },
  { bg: '#7C3AED', fg: '#EDE9FE' },
  { bg: '#DC2626', fg: '#FEE2E2' },
  { bg: '#0E7490', fg: '#CFFAFE' },
  { bg: '#BE185D', fg: '#FCE7F3' },
  { bg: '#4338CA', fg: '#E0E7FF' },
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

// ── Tamanhos ──────────────────────────────────────────────────────────────────

const SIZE = {
  xs: { dim: 'w-4 h-4',   rounded: 'rounded',    text: 'text-[7px]',  nameText: 'text-[9px]' },
  sm: { dim: 'w-5 h-5',   rounded: 'rounded',    text: 'text-[8px]',  nameText: 'text-[10px]' },
  md: { dim: 'w-7 h-7',   rounded: 'rounded-md', text: 'text-[11px]', nameText: 'text-xs' },
  lg: { dim: 'w-9 h-9',   rounded: 'rounded-lg', text: 'text-sm',     nameText: 'text-sm' },
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function SeguradoraBadge({ nome, size = 'sm', showName = true, className = '' }) {
  const [imgError, setImgError] = useState(false)
  if (!nome) return null

  const { dim, rounded, text, nameText } = SIZE[size] || SIZE.sm
  const logo = getLogo(nome)
  const { bg, fg } = paleta(nome)

  return (
    <div className={`flex items-center gap-1.5 min-w-0 ${className}`} title={nome}>
      {logo && !imgError ? (
        <div
          className={`${dim} ${rounded} flex-shrink-0 overflow-hidden bg-white border border-dark-border/30`}
        >
          <img
            src={logo}
            alt={nome}
            className="w-full h-full object-contain"
            onError={() => setImgError(true)}
            loading="lazy"
            decoding="async"
          />
        </div>
      ) : (
        <div
          className={`${dim} ${rounded} flex items-center justify-center font-bold flex-shrink-0 ${text}`}
          style={{ background: bg, color: fg }}
        >
          {iniciais(nome)}
        </div>
      )}
      {showName && (
        <span className={`${nameText} text-dark-text truncate`}>{nome}</span>
      )}
    </div>
  )
}
