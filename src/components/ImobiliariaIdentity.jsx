import { Building2 } from 'lucide-react'
import { getEntityImageUrl } from '../lib/entityMedia'
import { normalizeDisplayText } from '../lib/text'

function initials(name) {
  return (name || '')
    .split(' ')
    .map(part => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'IM'
}

const SIZES = {
  sm: {
    wrapper: 'gap-2',
    logo: 'h-8 w-8 rounded-xl',
    title: 'text-[11px]',
    subtitle: 'text-[10px]',
  },
  md: {
    wrapper: 'gap-3',
    logo: 'h-10 w-10 rounded-2xl',
    title: 'text-sm',
    subtitle: 'text-xs',
  },
  lg: {
    wrapper: 'gap-4',
    logo: 'h-14 w-14 rounded-3xl',
    title: 'text-base',
    subtitle: 'text-sm',
  },
  xxl: {
    wrapper: 'gap-4',
    logo: 'h-20 w-20 rounded-[24px]',
    title: 'text-lg',
    subtitle: 'text-sm',
  },
}

export default function ImobiliariaIdentity({
  nome,
  imagemUrl,
  imagemPath,
  size = 'sm',
  emphasis = false,
  className = '',
}) {
  const meta = SIZES[size] || SIZES.sm
  const src = getEntityImageUrl(imagemPath, imagemUrl)
  const label = normalizeDisplayText(nome) || 'Imobiliária'

  return (
    <div
      className={`inline-flex items-center ${meta.wrapper} ${emphasis ? 'rounded-3xl border border-brand-accent/15 bg-brand-accent/5 px-3 py-2' : ''} ${className}`}
    >
      <div
        className={`relative flex items-center justify-center overflow-hidden border border-dark-border/60 bg-dark-surface/80 text-dark-muted shadow-sm ${meta.logo}`}
      >
        {src ? (
          <img src={src} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-secondary/10 to-brand-accent/10 text-status-info">
            {nome && nome !== '—' && nome !== 'Imobiliária'
              ? initials(normalizeDisplayText(nome) || nome)
              : <Building2 className="h-4 w-4" />
            }
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className={`truncate font-semibold text-dark-text ${meta.title}`}>{label}</p>
        {emphasis && (
          <p className={`mt-0.5 truncate text-dark-muted ${meta.subtitle}`}>
            Imobiliária vinculada na ficha
          </p>
        )}
      </div>
    </div>
  )
}

