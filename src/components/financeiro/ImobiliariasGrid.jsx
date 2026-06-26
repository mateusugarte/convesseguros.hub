import { useEffect, useMemo, useState } from 'react'
import { Search, Building2, ArrowRight } from 'lucide-react'
import ImobiliariaIdentity from '../ImobiliariaIdentity'
import { EmptyState } from '../ui'
import { fetchImobiliariasCatalogMap, resolveImobiliaria } from '../../lib/imobiliariasLogos'
import { fetchImobiliariasComApolices } from '../../lib/financeiroApolices'
import RegisteredSeguradorasStrip from './RegisteredSeguradorasStrip'

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
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-700/55" />
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar imobiliária..."
          className="w-full rounded-2xl border border-emerald-500/15 bg-white/80 py-3 pl-10 pr-4 text-sm text-dark-text shadow-sm outline-none transition-colors focus:border-emerald-500/40"
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
              className="group overflow-hidden rounded-[26px] border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.92))] px-4 py-4 text-left shadow-[0_18px_48px_-32px_rgba(16,185,129,0.55)] transition-all hover:-translate-y-0.5 hover:border-emerald-500/30"
            >
              <div className="flex items-start justify-between gap-3">
                <ImobiliariaIdentity nome={nome} imagemPath={meta?.imagemPath} imagemUrl={meta?.imagemUrl} size="md" />
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-emerald-700/50 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div className="mt-3 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800/55">Seguradoras cadastradas</p>
                <RegisteredSeguradorasStrip seguradoras={meta?.registeredSeguradoras} limit={3} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
