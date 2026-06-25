import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader, MetricCard, DataCard, EmptyState } from '../../components/ui'
import { Select } from '../../components/ui/Select'
import ImobiliariaIdentity from '../../components/ImobiliariaIdentity'
import { useAuth } from '../../contexts/AuthContext'
import {
  fetchFaturasLedger, fetchPctImobiliarias, fetchFaturasStatus, marcarFaturaPaga, reabrirFatura,
} from '../../lib/financeiro'
import { montarFaturasMes } from '../../lib/financeiroFaturasCalc'
import { fetchImobiliariasCatalogMap, resolveImobiliaria } from '../../lib/imobiliariasLogos'
import { primeiroDiaMes } from '../../lib/financeiroCalc'
import { formatMoneyBR } from '../../lib/apolices'
import { Coins, Percent, Receipt, Check, RotateCcw } from 'lucide-react'

const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function pad2(v) { return String(v).padStart(2, '0') }

export default function FinanceiroFaturas() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const agora = new Date()
  const mesParam = searchParams.get('mes') // 'YYYY-MM-01'
  const inicialAno = mesParam ? Number(mesParam.slice(0, 4)) : agora.getFullYear()
  const inicialMes = mesParam ? Number(mesParam.slice(5, 7)) : agora.getMonth() + 1
  const [ano, setAno] = useState(inicialAno)
  const [mes, setMes] = useState(inicialMes)
  const [ledger, setLedger] = useState([])
  const [pctMap, setPctMap] = useState({})
  const [statusMap, setStatusMap] = useState({})
  const [catalogo, setCatalogo] = useState(null)
  const [loading, setLoading] = useState(true)

  const mesRef = `${ano}-${pad2(mes)}-01`

  useEffect(() => {
    setSearchParams({ mes: mesRef }, { replace: true })
  }, [mesRef, setSearchParams])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([
      fetchFaturasLedger(),
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
  }, [mesRef])

  const faturas = useMemo(
    () => montarFaturasMes({ rows: ledger, mesRef: primeiroDiaMes(mesRef), pctMap, statusMap }),
    [ledger, mesRef, pctMap, statusMap],
  )
  const totalFatura = useMemo(() => faturas.reduce((s, f) => s + f.valorFatura, 0), [faturas])
  const totalAPagar = useMemo(() => faturas.reduce((s, f) => s + f.valorAPagar, 0), [faturas])
  const mesLabel = `${MESES_ABBR[mes - 1]} ${ano}`

  async function togglePago(f) {
    if (f.status === 'pago') {
      const err = await reabrirFatura({ imobiliaria: f.imobiliaria, mes: mesRef })
      if (!err) setStatusMap(prev => ({ ...prev, [f.imobiliaria]: { status: 'pendente', data_pagamento: null } }))
    } else {
      const err = await marcarFaturaPaga({ imobiliaria: f.imobiliaria, mes: mesRef, userId: user?.id })
      if (!err) setStatusMap(prev => ({ ...prev, [f.imobiliaria]: { status: 'pago', data_pagamento: new Date().toISOString().slice(0, 10) } }))
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Financeiro · Faturas"
        title="Faturas das imobiliárias"
        description="Por mês, a fatura é a soma das parcelas devidas; o valor a pagar é o % da Produção sobre a fatura."
        stats={(
          <>
            <MetricCard label="Total faturas" value={formatMoneyBR(totalFatura)} hint={mesLabel} tone="accent" icon={<Receipt className="h-4 w-4" />} />
            <MetricCard label="Total a pagar" value={formatMoneyBR(totalAPagar)} hint={mesLabel} tone="secondary" icon={<Percent className="h-4 w-4" />} />
            <MetricCard label="Imobiliárias" value={faturas.length} hint={mesLabel} tone="success" icon={<Coins className="h-4 w-4" />} />
          </>
        )}
      />

      <DataCard
        title="Mês"
        subtitle="Selecione o mês de competência"
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
              className={`rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors ${mes === i + 1 ? 'bg-brand-secondary text-white' : 'text-dark-muted hover:bg-dark-surface2 hover:text-dark-text'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </DataCard>

      <DataCard title={`Faturas — ${mesLabel}`} subtitle="Clique numa imobiliária para ver as apólices">
        {loading ? (
          <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
        ) : faturas.length === 0 ? (
          <EmptyState title="Sem faturas no mês" description="Nenhuma parcela devida no mês selecionado." icon={<Receipt className="h-6 w-6" />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-table text-sm">
              <thead className="table-thead">
                <tr>
                  {['Imobiliária', 'Apólices', 'Fatura', '%', 'A pagar', 'Status', ''].map(h => (
                    <th key={h} className="th whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {faturas.map(f => {
                  const meta = resolveImobiliaria(catalogo, f.imobiliaria)
                  return (
                    <tr key={f.imobiliaria} className="hover:bg-dark-surface2/40">
                      <td className="td">
                        <button onClick={() => navigate(`/financeiro/faturas/${encodeURIComponent(f.imobiliaria)}/${mesRef}`)} className="text-left">
                          <ImobiliariaIdentity nome={f.imobiliaria} imagemPath={meta?.imagemPath} imagemUrl={meta?.imagemUrl} size="sm" />
                        </button>
                      </td>
                      <td className="td font-mono text-xs">{f.qtd}</td>
                      <td className="td font-mono text-xs">{formatMoneyBR(f.valorFatura)}</td>
                      <td className="td font-mono text-xs">{f.pct != null ? `${f.pct}%` : '—'}</td>
                      <td className="td font-mono text-xs font-semibold text-emerald-400">{formatMoneyBR(f.valorAPagar)}</td>
                      <td className="td">
                        <span className={`rounded-lg px-2 py-0.5 text-[11px] font-medium ${f.status === 'pago' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                          {f.status === 'pago' ? 'Pago' : 'Pendente'}
                        </span>
                      </td>
                      <td className="td">
                        <button
                          onClick={() => togglePago(f)}
                          className="inline-flex items-center gap-1 rounded-lg border border-dark-border px-2 py-1 text-[11px] font-medium text-dark-muted hover:text-dark-text"
                        >
                          {f.status === 'pago' ? (<><RotateCcw className="h-3 w-3" /> Reabrir</>) : (<><Check className="h-3 w-3" /> Marcar pago</>)}
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
    </div>
  )
}
