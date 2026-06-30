import SeguradoraBadge from '../SeguradoraBadge'

export default function RegisteredSeguradorasStrip({ seguradoras = [], limit = 4, size = 'xs', className = '' }) {
  if (!seguradoras.length) return null

  const visible = seguradoras.slice(0, limit)
  const restante = seguradoras.length - visible.length

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {visible.map(seg => (
        <SeguradoraBadge
          key={seg.id || seg.nomeCanonico}
          nome={seg.nomeCanonico}
          logoUrl={seg.logoUrl}
          logoPath={seg.logoPath}
          size={size}
          className="rounded-full border border-emerald-500/15 bg-dark-surface/70 px-2 py-1"
        />
      ))}
      {restante > 0 && (
        <span className="inline-flex items-center rounded-full border border-emerald-500/15 bg-emerald-500/8 px-2 py-1 text-[11px] font-semibold text-emerald-700">
          +{restante}
        </span>
      )}
    </div>
  )
}
