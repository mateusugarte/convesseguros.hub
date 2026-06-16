import { useEffect, useState } from 'react'
import { findSeguradoraMetaByNome } from '../lib/seguradoras'

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

const SIZE = {
  xs: { dim: 'w-4 h-4', rounded: 'rounded', text: 'text-[7px]', nameText: 'text-[9px]' },
  sm: { dim: 'w-5 h-5', rounded: 'rounded', text: 'text-[8px]', nameText: 'text-[10px]' },
  md: { dim: 'w-7 h-7', rounded: 'rounded-md', text: 'text-[11px]', nameText: 'text-xs' },
  lg: { dim: 'w-9 h-9', rounded: 'rounded-lg', text: 'text-sm', nameText: 'text-sm' },
}

const SKIP = new Set(['de', 'da', 'do', 'seguros', 'seguro', 's/a', 'sa', 'ltda', 'cia'])

function paleta(nome) {
  let h = 0
  for (let i = 0; i < (nome || '').length; i += 1) h = nome.charCodeAt(i) + ((h << 5) - h)
  return PALETTE[Math.abs(h) % PALETTE.length]
}

function iniciais(nome) {
  if (!nome) return '?'
  const words = nome.trim().split(/\s+/).filter(word => !SKIP.has(word.toLowerCase()))
  if (!words.length) return nome.slice(0, 2).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export default function SeguradoraBadge({ nome, logoUrl, size = 'sm', showName = true, className = '' }) {
  const [imgError, setImgError] = useState(false)
  const [resolvedLogo, setResolvedLogo] = useState(logoUrl || null)

  useEffect(() => {
    let active = true
    setImgError(false)

    if (logoUrl) {
      setResolvedLogo(logoUrl)
      return () => { active = false }
    }

    setResolvedLogo(null)
    findSeguradoraMetaByNome(nome)
      .then(meta => {
        if (active) setResolvedLogo(meta?.logo_url || null)
      })
      .catch(() => {
        if (active) setResolvedLogo(null)
      })

    return () => { active = false }
  }, [nome, logoUrl])

  if (!nome) return null

  const { dim, rounded, text, nameText } = SIZE[size] || SIZE.sm
  const { bg, fg } = paleta(nome)

  return (
    <div className={`flex items-center gap-1.5 min-w-0 ${className}`} title={nome}>
      {resolvedLogo && !imgError ? (
        <div className={`${dim} ${rounded} flex-shrink-0 overflow-hidden bg-white border border-dark-border/30`}>
          <img
            src={resolvedLogo}
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
