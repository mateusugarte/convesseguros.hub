import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader, MetricCard, DataCard, EmptyState } from '../../components/ui'
import { Select } from '../../components/ui/Select'
import ImobiliariaIdentity from '../../components/ImobiliariaIdentity'
import SeguradoraBadge from '../../components/SeguradoraBadge'
import ApolicesListPanel from '../../components/financeiro/ApolicesListPanel'
import { fetchFaturasLedger, fetchPctImobiliarias, fetchFaturasStatus } from '../../lib/financeiro'
import { apoliceBilladaNoMes } from '../../lib/financeiroFaturasCalc'
import { fetchImobiliariasCatalogMap, resolveImobiliaria } from '../../lib/imobiliariasLogos'
import { parseYmd } from '../../lib/financeiroCalc'
import { formatMoneyBR } from '../../lib/apolices'
import { ArrowLeft, Receipt, Building2, Shield, FileText } from 'lucide-react'

const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
function pad2(v) { return String(v).padStart(2, '0') }
function num(v) { return Number(v) || 0 }

export default function FinanceiroFaturasSeguradora() {
  const navigate = useNavigate()
  const { seguradora: segParam } = useParams()
  const seguradora = segParam ? decodeURIComponent(segParam) : ''
  const [searchParams, setSearchParams] = useSearchParams()
  const agora = new Date()
  const mesParam = searchParams.get('mes')
  const [ano, setAno] = useState(mesParam ? Number(mesParam.slice(0, 4)) : agora.getFullYear())
  const [mes, setMes] = useState(mesParam ? Number(mesParam.slice(5, 7)) : agora.getMonth() + 1)

  const [ledger, setLedger] = useState([])
  const [pctMap, setPctMap] = useState({})
  const [statusMap, setStatusMap] = useState({})
  const [catalogo, setCatalogo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [panel, setPanel] = useState({ open: false, title: '', apolices: [] })

  const mesRef = `${ano}-${pad2(mes)}-01`
  const mesLabel = `${MESES_ABBR[mes - 1]} ${ano}`

  useEffect(() => { setSearchParams({ mes: mesRef }, { replace: true }) }, [mesRef, setSearchParams])

  useEffect(() => {
    if (!seguradora) return
    let mounted = true
    setLoading(true)
    Promise.all([
      fetchFaturasLedger({ seguradora }),
      fetchPctImobiliarias({ mes: mesRef }),
      fetchFaturasStatus({ mes: mesRef }),
      fetchImobiliariasCatalogMap(),
    ]).then(([led, pct, st, cat]) => {
      if (!mounted) return
      setLedger(led)
      setPctMap(pct)
      setStatusMap(st)
      setCatalogo(cat)
      setLoading(false)
    }).catch(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [seguradora, mesRef])

  // Agrega por imobiliária: fatura do mês, apólices ativas, estimativa do próximo mês.
  const linhas = useMemo(() => {
    const map = new Map()
    for (const r of ledger) {
      const key = r.imobiliaria || 'Sem imobiliária'
      const cur = map.get(key) || { imobiliaria: key, ativas: 0, qtdFatura: 0, valorFatura: 0, estimativa: 0, naFatura: [] }
      if (r.status_apolice === 'ativa') cur.ativas += 1
      if (apoliceBilladaNoMes(r, mesRef)) {
        cur.qtdFatura += 1
        cur.valorFatura += num(r.valor_parcela)
        cur.naFatura.push(r)
      }
      const d = parseYmd(r.data_emissao)
      if (d && d.getFullYear() === ano && d.getMonth() + 1 === mes) cur.estimativa += num(r.valor_parcela)
      map.set(key, cur)
    }
    return [...map.values()].map(item => {
      const pct = pctMap[item.imobiliaria] != null ? Number(pctMap[item.imobiliaria]) : null
      return { ...item, pct, valorAPagar: pct != null ? (pct / 100) * item.valorFatura : 0 }
    }).sort((a, b) => b.valorFatura - a.valorFatura || a.imobiliaria.localeCompare(b.imobiliaria))
  }, [ledger, mesRef, ano, mes, pctMap])

  const totalFatura = useMemo(() => linhas.reduce((s, l) => s + l.valorFatura, 0), [linhas])
  const totalAtivas = useMemo(() => linhas.reduce((s, l) => s + l.ativas, 0), [linhas])

  return (
    <div className="financeiro-page space-y-5">
      <button
        onClick={() => navigate('/financeiro/faturas')}
        className="inline-flex items-center gap-1.5 text-sm text-dark-muted transition-colors hover:text-dark-text"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para faturas
      </button>

      <PageHeader
        eyebrow="Financeiro · Faturas por seguradora"
        title={seguradora}
        description="Faturas e apólices ativas por imobiliária, filtradas por esta seguradora."
        actions={<SeguradoraBadge nome={seguradora} size="xl" />}
        stats={(
          <>
            <MetricCard label="Fatura do mês" value={formatMoneyBR(totalFatura)} hint={mesLabel} tone="accent" icon={<Receipt className="h-4 w-4" />} />
            <MetricCard label="Apólices ativas" value={totalAtivas} hint={seguradora} tone="secondary" icon={<Shield className="h-4 w-4" />} />
            <MetricCard label="Imobiliárias" value={linhas.length} hint={mesLabel} tone="success" icon={<Building2 className="h-4 w-4" />} />
          </>
        )}
      />

      <DataCard
        title="Competência"
        subtitle="Selecione o mês"
        actions={(
          <Select
            value={String(ano)}
            onChange={v => setAno(Number(v))}
            options={[agora.getFullYear() + 1, agora.getFullYear(), agora.getFullYear() - 1, agora.getFullYear() - 2].map(a => ({ value: String(a), label: String(a) }))}
            className="w-28"
          />
        )}
      >
        <div className="flex flex-wrap items-center gap-1">
          {MESES_ABBR.map((label, i) => (
            <button
              key={label}
              onClick={() => setMes(i + 1)}
              className={`rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors ${mes === i + 1 ? 'bg-emerald-600 text-white' : 'text-dark-muted hover:bg-dark-surface2 hover:text-dark-text'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </DataCard>

      <DataCard title={`Imobiliárias · ${mesLabel}`} subtitle="Fatura do mês e apólices ativas por imobiliária">
        {loading ? (
          <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
        ) : linhas.length === 0 ? (
          <EmptyState title="Sem dados" description="Nenhuma apólice desta seguradora para o período." icon={<Receipt className="h-6 w-6" />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-table text-sm">
              <thead className="table-thead">
                <tr>
                  {['Imobiliária', 'Ativas', 'Na fatura', 'Fatura do mês', 'A pagar', 'Estimativa próx. mês', ''].map(h => (
                    <th key={h} className="th whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {linhas.map(l => {
                  const meta = resolveImobiliaria(catalogo, l.imobiliaria)
                  return (
                    <tr key={l.imobiliaria} className="hover:bg-dark-surface2/40">
                      <td className="td">
                        <button onClick={() => navigate(`/financeiro/faturas/${encodeURIComponent(l.imobiliaria)}`)} className="text-left">
                          <ImobiliariaIdentity nome={l.imobiliaria} imagemPath={meta?.imagemPath} imagemUrl={meta?.imagemUrl} size="sm" />
                        </button>
                      </td>
                      <td className="td font-mono text-xs">{l.ativas}</td>
                      <td className="td font-mono text-xs">{l.qtdFatura}</td>
                      <td className="td font-mono text-xs">{formatMoneyBR(l.valorFatura)}</td>
                      <td className="td font-mono text-xs font-semibold text-emerald-400">{formatMoneyBR(l.valorAPagar)}</td>
                      <td className="td font-mono text-xs">{formatMoneyBR(l.estimativa)}</td>
                      <td className="td">
                        <button
                          onClick={() => setPanel({ open: true, title: `${l.imobiliaria} · apólices que contam — ${mesLabel}`, apolices: l.naFatura })}
                          className="inline-flex items-center gap-1 rounded-lg border border-dark-border px-2 py-1 text-[11px] font-medium text-dark-muted hover:text-dark-text"
                        >
                          <FileText className="h-3 w-3" /> Apólices
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>

      <ApolicesListPanel
        isOpen={panel.open}
        onClose={() => setPanel(p => ({ ...p, open: false }))}
        title={panel.title}
        subtitle={seguradora}
        apolices={panel.apolices}
        loading={false}
      />
    </div>
  )
}
