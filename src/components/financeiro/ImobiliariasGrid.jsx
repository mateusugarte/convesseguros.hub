import { useEffect, useMemo, useState } from 'react'
import { Search, Building2 } from 'lucide-react'
import ImobiliariaIdentity from '../ImobiliariaIdentity'
import { EmptyState } from '../ui'
import { fetchImobiliariasCatalogMap, resolveImobiliaria } from '../../lib/imobiliariasLogos'
import { fetchImobiliariasComApolices } from '../../lib/financeiroApolices'

// Grid de cards de imobiliárias (logo + nome) com busca por nome.
// Lista as imobiliárias que possuem apólices de fiança (nome real vindo de `apolices`),
// resolvendo o logo pelo catálogo de imobiliárias. onSelect(nome) ao clicar.
export default function ImobiliariasGrid({ onSelect }) {
  const [nomes, setNomes] = useState([])
  const [catalogo, setCatalogo] = useState(null)
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.allSettled([fetchImobiliariasComApolices(), fetchImobiliariasCatalogMap()])
      .then(([lista, cat]) => {
        if (!mounted) return
        setNomes(lista.status === 'fulfilled' ? lista.value : [])
        setCatalogo(cat.status === 'fulfilled' ? cat.value : null)
        setLoading(false)
      })
      .catch(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const filtrados = q ? nomes.filter(n => n.toLowerCase().includes(q)) : nomes
    return filtrados.map(nome => ({ nome, meta: resolveImobiliaria(catalogo, nome) }))
  }, [nomes, catalogo, busca])

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
        <EmptyState title="Nenhuma imobiliária" description="Nenhuma imobiliária com apólices emitidas encontrada." icon={<Building2 className="h-6 w-6" />} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map(({ nome, meta }) => (
            <button
              key={nome}
              onClick={() => onSelect?.(nome)}
              className="flex items-center gap-3 rounded-2xl border border-dark-border/70 bg-dark-surface2/40 px-4 py-3 text-left transition-colors hover:border-brand-secondary"
            >
              <ImobiliariaIdentity nome={nome} imagemPath={meta?.imagemPath} imagemUrl={meta?.imagemUrl} size="md" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
