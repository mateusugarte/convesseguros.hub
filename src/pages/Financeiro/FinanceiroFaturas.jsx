import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader, MetricCard, DataCard, EmptyState } from '../../components/ui'
import { Select } from '../../components/ui/Select'
import ImobiliariaIdentity from '../../components/ImobiliariaIdentity'
import { useAuth } from '../../contexts/AuthContext'
import {
  fetchFaturasLedger,
  fetchPctImobiliariasAno,
  fetchFaturasStatusAno,
  marcarFaturaPaga,
  reabrirFatura,
  salvarFaturaConferencia,
} from '../../lib/financeiro'
import { montarFaturasMes } from '../../lib/financeiroFaturasCalc'
import { fetchImobiliariasCatalogMap, resolveImobiliaria } from '../../lib/imobiliariasLogos'
import { formatMoneyBR } from '../../lib/apolices'
import { CalendarDays, Check, Coins, Percent, Receipt, RotateCcw, Save } from 'lucide-react'

const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function pad2(v) {
  return String(v).padStart(2, '0')
}

function parseMoneyInput(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const normalized = raw.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

function moneyDraft(value) {
  if (value == null) return ''
  return String(Number(value).toFixed(2)).replace('.', ',')
}

function resumoFaturas(lista) {
  return (lista || []).reduce((acc, f) => {
    acc.qtd += f.qtd
    acc.valorFatura += f.valorFatura
    acc.valorAPagar += f.valorAPagar
    acc.valorReal += f.valorRealFatura || 0
    acc.imobiliarias += 1
    if (f.status === 'pago') acc.pagas += 1
    else acc.pendentes += 1
    return acc
  }, { qtd: 0, valorFatura: 0, valorAPagar: 0, valorReal: 0, imobiliarias: 0, pagas: 0, pendentes: 0 })
}

export default function FinanceiroFaturas() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const agora = new Date()
  const mesParam = searchParams.get('mes')
  const inicialAno = mesParam ? Number(mesParam.slice(0, 4)) : agora.getFullYear()
  const inicialMes = mesParam ? Number(mesParam.slice(5, 7)) : agora.getMonth() + 1
  const [ano, setAno] = useState(inicialAno)
  const [mes, setMes] = useState(inicialMes)
  const [ledger, setLedger] = useState([])
  const [pctPorMes, setPctPorMes] = useState({})
  const [statusPorMes, setStatusPorMes] = useState({})
  const [catalogo, setCatalogo] = useState(null)
  const [valorRealDrafts, setValorRealDrafts] = useState({})
  const [savingKey, setSavingKey] = useState('')
  const [loading, setLoading] = useState(true)

  const mesRefs = useMemo(
    () => MESES_ABBR.map((_, i) => `${ano}-${pad2(i + 1)}-01`),
    [ano],
  )
  const mesRef = `${ano}-${pad2(mes)}-01`
  const mesLabel = `${MESES_ABBR[mes - 1]} ${ano}`

  useEffect(() => {
    setSearchParams({ mes: mesRef }, { replace: true })
  }, [mesRef, setSearchParams])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([
      fetchFaturasLedger(),
      fetchPctImobiliariasAno({ ano }),
      fetchFaturasStatusAno({ ano }),
      fetchImobiliariasCatalogMap(),
    ]).then(([led, pct, st, cat]) => {
      if (!mounted) return
      setLedger(led)
      setPctPorMes(pct)
      setStatusPorMes(st)
      setCatalogo(cat)
      setLoading(false)
    }).catch(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [ano])

  const faturasPorMes = useMemo(() => {
    const out = {}
    for (const ref of mesRefs) {
      out[ref] = montarFaturasMes({
        rows: ledger,
        mesRef: ref,
        pctMap: pctPorMes[ref] || {},
        statusMap: statusPorMes[ref] || {},
      })
    }
    return out
  }, [ledger, mesRefs, pctPorMes, statusPorMes])

  const faturas = faturasPorMes[mesRef] || []
  const resumoMes = useMemo(() => resumoFaturas(faturas), [faturas])
  const resumoAno = useMemo(
    () => resumoFaturas(Object.values(faturasPorMes).flat()),
    [faturasPorMes],
  )

  useEffect(() => {
    const next = {}
    for (const f of faturas) next[f.imobiliaria] = moneyDraft(f.valorRealFatura)
    setValorRealDrafts(next)
  }, [mesRef, faturas])

  function updateStatusMes(imobiliaria, patch) {
    setStatusPorMes(prev => ({
      ...prev,
      [mesRef]: {
        ...(prev[mesRef] || {}),
        [imobiliaria]: {
          ...((prev[mesRef] || {})[imobiliaria] || {}),
          ...patch,
        },
      },
    }))
  }

  function snapshotPayload(f) {
    return {
      imobiliaria: f.imobiliaria,
      mes: mesRef,
      valorRealFatura: parseMoneyInput(valorRealDrafts[f.imobiliaria]) ?? f.valorRealFatura,
      valorFatura: f.valorFatura,
      pct: f.pct,
      valorAPagar: f.valorAPagar,
      observacao: f.observacao,
    }
  }

  async function salvarValorReal(f) {
    const key = `${f.imobiliaria}:valor`
    setSavingKey(key)
    const valor = parseMoneyInput(valorRealDrafts[f.imobiliaria])
    const err = await salvarFaturaConferencia({
      ...snapshotPayload(f),
      valorRealFatura: valor,
    })
    if (!err) {
      updateStatusMes(f.imobiliaria, {
        valor_real_fatura: valor,
        valor_fatura_calculado: f.valorFatura,
        pct_comissao: f.pct,
        valor_a_pagar: f.valorAPagar,
      })
    }
    setSavingKey('')
  }

  async function togglePago(f) {
    const key = `${f.imobiliaria}:status`
    setSavingKey(key)
    if (f.status === 'pago') {
      const err = await reabrirFatura({ imobiliaria: f.imobiliaria, mes: mesRef })
      if (!err) updateStatusMes(f.imobiliaria, { status: 'pendente', data_pagamento: null })
    } else {
      const payload = snapshotPayload(f)
      const err = await marcarFaturaPaga({ ...payload, userId: user?.id })
      if (!err) {
        updateStatusMes(f.imobiliaria, {
          status: 'pago',
          data_pagamento: new Date().toISOString().slice(0, 10),
          pago_por: user?.id || null,
          valor_real_fatura: payload.valorRealFatura,
          valor_fatura_calculado: f.valorFatura,
          pct_comissao: f.pct,
          valor_a_pagar: f.valorAPagar,
        })
      }
    }
    setSavingKey('')
  }

  return (
    <div className="financeiro-page space-y-5">
      <PageHeader
        eyebrow="Financeiro · Faturas"
        title="Calendário de faturas"
        description="Acompanhe as faturas por competência, confira o valor informado pela imobiliária e registre o pagamento."
        stats={(
          <>
            <MetricCard label="Faturas do ano" value={formatMoneyBR(resumoAno.valorFatura)} hint={String(ano)} tone="accent" icon={<Receipt className="h-4 w-4" />} />
            <MetricCard label="A pagar no mês" value={formatMoneyBR(resumoMes.valorAPagar)} hint={mesLabel} tone="secondary" icon={<Percent className="h-4 w-4" />} />
            <MetricCard label="Valor real informado" value={formatMoneyBR(resumoMes.valorReal)} hint={mesLabel} tone="warning" icon={<Coins className="h-4 w-4" />} />
            <MetricCard label="Pendentes" value={resumoMes.pendentes} hint={mesLabel} tone="success" icon={<CalendarDays className="h-4 w-4" />} />
          </>
        )}
      />

      <DataCard
        title="Calendário"
        subtitle="Selecione uma competência"
        actions={(
          <Select
            value={String(ano)}
            onChange={v => setAno(Number(v))}
            options={[agora.getFullYear() + 1, agora.getFullYear(), agora.getFullYear() - 1, agora.getFullYear() - 2].map(a => ({ value: String(a), label: String(a) }))}
            className="w-28"
          />
        )}
      >
        {loading ? (
          <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
            {mesRefs.map((ref, i) => {
              const resumo = resumoFaturas(faturasPorMes[ref] || [])
              const selected = ref === mesRef
              return (
                <button
                  key={ref}
                  onClick={() => setMes(i + 1)}
                  className={`min-h-[118px] rounded-lg border p-3 text-left transition-colors ${
                    selected
                      ? 'border-brand-secondary bg-brand-secondary/12'
                      : 'border-dark-border/70 bg-dark-surface2/35 hover:border-dark-border'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-semibold ${selected ? 'text-dark-text' : 'text-dark-muted'}`}>{MESES_ABBR[i]}</span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${resumo.pendentes ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                      {resumo.pendentes || 0} pend.
                    </span>
                  </div>
                  <p className="mt-3 text-base font-semibold text-dark-text">{formatMoneyBR(resumo.valorFatura)}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-dark-muted">
                    <span>{resumo.imobiliarias} imob.</span>
                    <span>{resumo.qtd} apólices</span>
                    <span>{resumo.pagas} pagas</span>
                    <span>{formatMoneyBR(resumo.valorAPagar)}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </DataCard>

      <DataCard title={`Conferência · ${mesLabel}`} subtitle="Uma fatura por imobiliária">
        {loading ? (
          <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
        ) : faturas.length === 0 ? (
          <EmptyState title="Sem faturas no mês" description="Nenhuma parcela devida no mês selecionado." icon={<Receipt className="h-6 w-6" />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-table text-sm">
              <thead className="table-thead">
                <tr>
                  {['Imobiliária', 'Apólices', 'Fatura calculada', 'Valor real', '%', 'A pagar', 'Status', ''].map(h => (
                    <th key={h} className="th whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {faturas.map(f => {
                  const meta = resolveImobiliaria(catalogo, f.imobiliaria)
                  const valorKey = `${f.imobiliaria}:valor`
                  const statusKey = `${f.imobiliaria}:status`
                  return (
                    <tr key={f.imobiliaria} className="hover:bg-dark-surface2/40">
                      <td className="td">
                        <button onClick={() => navigate(`/financeiro/faturas/${encodeURIComponent(f.imobiliaria)}/${mesRef}`)} className="text-left">
                          <ImobiliariaIdentity nome={f.imobiliaria} imagemPath={meta?.imagemPath} imagemUrl={meta?.imagemUrl} size="sm" />
                        </button>
                      </td>
                      <td className="td font-mono text-xs">{f.qtd}</td>
                      <td className="td font-mono text-xs">{formatMoneyBR(f.valorFatura)}</td>
                      <td className="td min-w-[150px]">
                        <div className="flex items-center gap-1.5">
                          <input
                            value={valorRealDrafts[f.imobiliaria] ?? ''}
                            onChange={e => setValorRealDrafts(prev => ({ ...prev, [f.imobiliaria]: e.target.value }))}
                            onBlur={() => salvarValorReal(f)}
                            inputMode="decimal"
                            placeholder="0,00"
                            className="h-9 w-28 rounded-lg border border-dark-border bg-dark-surface2 px-2 text-right font-mono text-xs text-dark-text outline-none focus:border-brand-secondary"
                          />
                          <button
                            type="button"
                            onClick={() => salvarValorReal(f)}
                            disabled={savingKey === valorKey}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-dark-border text-dark-muted hover:text-dark-text disabled:opacity-50"
                            aria-label="Salvar valor real"
                          >
                            <Save className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
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
                          disabled={savingKey === statusKey}
                          className="inline-flex items-center gap-1 rounded-lg border border-dark-border px-2 py-1 text-[11px] font-medium text-dark-muted hover:text-dark-text disabled:opacity-50"
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
