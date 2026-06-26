import { useEffect, useMemo, useState } from 'react'
import { Search, Building2 } from 'lucide-react'
import ImobiliariaIdentity from '../ImobiliariaIdentity'
import { EmptyState } from '../ui'
import { fetchImobiliariasCatalogMap } from '../../lib/imobiliariasLogos'

// Grid de cards de imobiliárias (logo + nome) com busca por nome.
// onSelect(nomeCanonico) é chamado ao clicar num card.
export default function ImobiliariasGrid({ onSelect }) {
  const [catalogo, setCatalogo] = useState(null)
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    fetchImobiliariasCatalogMap()
      .then(map => { if (mounted) { setCatalogo(map); setLoading(false) } })
      .catch(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const lista = useMemo(() => {
    if (!catalogo) return []
    const seen = new Map()
    for (const meta of catalogo.values()) {
      if (!meta?.nomeCanonico) continue
      if (!seen.has(meta.nomeCanonico)) seen.set(meta.nomeCanonico, meta)
    }
    let arr = [...seen.values()]
    const q = busca.trim().toLowerCase()
    if (q) arr = arr.filter(m => m.nomeCanonico.toLowerCase().includes(q))
    return arr.sort((a, b) => a.nomeCanonico.localeCompare(b.nomeCanonico))
  }, [catalogo, busca])

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-muted" />
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar imobiliária..."
          className="w-full rounded-xl border border-dark-border bg-dark-surface2 py-2 pl-9 pr-3 text-sm text-dark-text focus:border-brand-secondary focus:outline-none"
        />
      </div>
      {loading ? (
        <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
      ) : lista.length === 0 ? (
        <EmptyState title="Nenhuma imobiliária" description="Nenhuma imobiliária encontrada para a busca." icon={<Building2 className="h-6 w-6" />} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map(m => (
            <button
              key={m.nomeCanonico}
              onClick={() => onSelect?.(m.nomeCanonico)}
              className="flex items-center gap-3 rounded-2xl border border-dark-border/70 bg-dark-surface2/40 px-4 py-3 text-left transition-colors hover:border-brand-secondary"
            >
              <ImobiliariaIdentity nome={m.nomeCanonico} imagemPath={m.imagemPath} imagemUrl={m.imagemUrl} size="md" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
