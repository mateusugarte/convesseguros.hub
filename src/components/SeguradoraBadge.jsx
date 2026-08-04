import { useEffect, useState } from 'react'
import { findSeguradoraMetaByNome } from '../lib/seguradoras'
import { getEntityImageUrl } from '../lib/entityMedia'
import { normalizeDisplayText } from '../lib/text'

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
  xl: { dim: 'w-14 h-14', rounded: 'rounded-xl', text: 'text-sm', nameText: 'text-sm' },
  xxl: { dim: 'w-20 h-20', rounded: 'rounded-2xl', text: 'text-xl', nameText: 'text-base' },
}

const SKIP = new Set(['de', 'da', 'do', 'seguros', 'seguro', 's/a', 'sa', 'ltda', 'cia'])
const META_CACHE = new Map()

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

export default function SeguradoraBadge({ nome, logoUrl, logoPath, size = 'sm', showName = true, className = '', resolveMeta = true }) {
  const [imgError, setImgError] = useState(false)
  const [resolvedLogo, setResolvedLogo] = useState(logoUrl || null)

  useEffect(() => {
    let active = true
    setImgError(false)

    if (logoPath || logoUrl) {
      setResolvedLogo(getEntityImageUrl(logoPath, logoUrl))
      return () => { active = false }
    }

    if (!resolveMeta) {
      setResolvedLogo(null)
      return () => { active = false }
    }

    const cacheKey = normalizeDisplayText(nome) || nome
    if (META_CACHE.has(cacheKey)) {
      setResolvedLogo(META_CACHE.get(cacheKey))
      return () => { active = false }
    }

    setResolvedLogo(null)
    findSeguradoraMetaByNome(cacheKey)
      .then(meta => {
        if (!active) return
        const nextLogo = getEntityImageUrl(meta?.logo_path, meta?.logo_url || null)
        META_CACHE.set(cacheKey, nextLogo)
        setResolvedLogo(nextLogo)
      })
      .catch(() => {
        if (active) setResolvedLogo(null)
      })

    return () => { active = false }
  }, [nome, logoPath, logoUrl, resolveMeta])

  if (!nome) return null

  const { dim, rounded, text, nameText } = SIZE[size] || SIZE.sm
  const displayNome = normalizeDisplayText(nome) || nome
  const { bg, fg } = paleta(displayNome)

  return (
    <div className={`flex items-center gap-1.5 min-w-0 ${className}`} title={displayNome}>
      {resolvedLogo && !imgError ? (
        <div className={`${dim} ${rounded} flex-shrink-0 overflow-hidden bg-white border border-dark-border/30`}>
          <img
            src={resolvedLogo}
            alt={displayNome}
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
        <span className={`${nameText} text-dark-text truncate`}>{displayNome}</span>
      )}
    </div>
  )
}
