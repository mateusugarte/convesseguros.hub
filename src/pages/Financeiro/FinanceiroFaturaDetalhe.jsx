import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader, MetricCard, DataCard, EmptyState } from '../../components/ui'
import ImobiliariaIdentity from '../../components/ImobiliariaIdentity'
import RegisteredSeguradorasStrip from '../../components/financeiro/RegisteredSeguradorasStrip'
import SeguradoraBadge from '../../components/SeguradoraBadge'
import { fetchFaturasLedger } from '../../lib/financeiro'
import { apoliceContaNaFaturaNoMes } from '../../lib/financeiroFaturasCalc'
import { fetchImobiliariasCatalogMap, resolveImobiliaria } from '../../lib/imobiliariasLogos'
import { formatMesAno, primeiroDiaMes } from '../../lib/financeiroCalc'
import { formatMoneyBR } from '../../lib/apolices'
import { ArrowLeft, Receipt, FileText, Coins } from 'lucide-react'

const SCROLL_KEY = 'financeiro-fatura-detalhe-scroll'

export default function FinanceiroFaturaDetalhe() {
  const navigate = useNavigate()
  const { imobiliaria: imobParam, mes } = useParams()
  const imobiliaria = decodeURIComponent(imobParam || '')
  const mesRef = primeiroDiaMes(mes)
  const [rows, setRows] = useState([])
  const [catalogo, setCatalogo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([
      fetchFaturasLedger({ imobiliaria }),
      fetchImobiliariasCatalogMap(),
    ]).then(([led, cat]) => {
      if (!mounted) return
      setRows(led)
      setCatalogo(cat)
      setLoading(false)
    }).catch(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [imobiliaria])

  useEffect(() => {
    if (loading) return
    const saved = sessionStorage.getItem(SCROLL_KEY)
    if (saved) {
      window.scrollTo(0, Number(saved) || 0)
      sessionStorage.removeItem(SCROLL_KEY)
    }
  }, [loading])

  const apolices = useMemo(
    () => rows.filter(r => apoliceContaNaFaturaNoMes(r, mesRef)),
    [rows, mesRef],
  )
  const valorFatura = useMemo(() => apolices.reduce((s, a) => s + (Number(a.valor_parcela) || 0), 0), [apolices])
  const meta = resolveImobiliaria(catalogo, imobiliaria)

  function abrirApolice(id) {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY))
    navigate(`/apolices/${id}`)
  }

  return (
    <div className="space-y-5">
      <button onClick={() => navigate(`/financeiro/faturas/${encodeURIComponent(imobiliaria)}?mes=${mesRef}`)} className="inline-flex items-center gap-1.5 text-xs font-medium text-dark-muted hover:text-dark-text">
        <ArrowLeft className="h-4 w-4" /> Voltar para Faturas
      </button>

      <section className="overflow-hidden rounded-[30px] border border-emerald-500/15 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_40%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.92))] px-6 py-6 shadow-[0_26px_70px_-42px_rgba(16,185,129,0.55)]">
        <PageHeader
          eyebrow={`Financeiro · Fatura · ${formatMesAno(mesRef)}`}
          title={meta?.nomeCanonico || imobiliaria}
          description="Apólices com parcela devida no mês."
          actions={(<ImobiliariaIdentity nome={imobiliaria} imagemPath={meta?.imagemPath} imagemUrl={meta?.imagemUrl} size="lg" />)}
          stats={(
            <>
              <MetricCard label="Apólices" value={apolices.length} hint={formatMesAno(mesRef)} tone="success" icon={<FileText className="h-4 w-4" />} className="border border-emerald-500/15 bg-white/85" />
              <MetricCard label="Valor da fatura" value={formatMoneyBR(valorFatura)} hint="soma das parcelas" tone="accent" icon={<Coins className="h-4 w-4" />} className="border border-emerald-500/15 bg-white/85" />
            </>
          )}
        />
        <RegisteredSeguradorasStrip seguradoras={meta?.registeredSeguradoras} size="sm" className="mt-4" />
      </section>

      <DataCard title="Apólices da fatura" subtitle="Clique para abrir a apólice" className="border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(240,253,244,0.88))]">
        {loading ? (
          <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
        ) : apolices.length === 0 ? (
          <EmptyState title="Sem apólices no mês" description="Nenhuma parcela devida no mês para esta imobiliária." icon={<Receipt className="h-6 w-6" />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-table text-sm">
              <thead className="table-thead">
                <tr>
                  {['Apólice', 'Cliente', 'Seguradora', 'Parcela', 'Emissão'].map(h => (
                    <th key={h} className="th whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {apolices.map(a => (
                  <tr key={a.apolice_id} className="cursor-pointer hover:bg-dark-surface2/40" onClick={() => abrirApolice(a.apolice_id)}>
                    <td className="td font-mono text-xs text-dark-muted">{a.numero_apolice || '—'}</td>
                    <td className="td max-w-[200px] truncate">{a.nome_interessado || '—'}</td>
                    <td className="td"><SeguradoraBadge nome={a.seguradora} size="sm" /></td>
                    <td className="td font-mono text-xs">{formatMoneyBR(a.valor_parcela)}</td>
                    <td className="td text-xs text-dark-muted whitespace-nowrap">{String(a.data_emissao).slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>
    </div>
  )
}
