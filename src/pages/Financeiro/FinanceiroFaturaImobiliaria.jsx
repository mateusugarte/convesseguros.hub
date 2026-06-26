import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader, MetricCard, DataCard } from '../../components/ui'
import { Select } from '../../components/ui/Select'
import ImobiliariaIdentity from '../../components/ImobiliariaIdentity'
import ApolicesListPanel from '../../components/financeiro/ApolicesListPanel'
import { useAuth } from '../../contexts/AuthContext'
import {
  fetchFaturasLedger, fetchPctImobiliarias, fetchFaturasStatus,
  marcarFaturaPaga, reabrirFatura, salvarFaturaConferencia,
} from '../../lib/financeiro'
import { montarFaturasMes, apoliceBilladaNoMes } from '../../lib/financeiroFaturasCalc'
import { fetchImobiliariasCatalogMap, resolveImobiliaria } from '../../lib/imobiliariasLogos'
import { parseYmd } from '../../lib/financeiroCalc'
import { formatMoneyBR } from '../../lib/apolices'
import { ArrowLeft, Receipt, Percent, Wallet, Check, RotateCcw, FileText, CalendarPlus } from 'lucide-react'

const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
function pad2(v) { return String(v).padStart(2, '0') }

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

export default function FinanceiroFaturaImobiliaria() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { imobiliaria: imobParam } = useParams()
  const selecionada = imobParam ? decodeURIComponent(imobParam) : ''
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
  const [valorRealDraft, setValorRealDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [panel, setPanel] = useState({ open: false, title: '', apolices: [] })

  const mesRef = `${ano}-${pad2(mes)}-01`
  const proximoMesRef = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${pad2(mes + 1)}-01`
  const mesLabel = `${MESES_ABBR[mes - 1]} ${ano}`
  const proximoLabel = mes === 12 ? `${MESES_ABBR[0]} ${ano + 1}` : `${MESES_ABBR[mes]} ${ano}`

  useEffect(() => {
    setSearchParams({ mes: mesRef }, { replace: true })
  }, [mesRef, setSearchParams])

  useEffect(() => {
    if (!selecionada) return
    let mounted = true
    setLoading(true)
    Promise.all([
      fetchFaturasLedger({ imobiliaria: selecionada }),
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
  }, [selecionada, mesRef])

  const fatura = useMemo(() => {
    const lista = montarFaturasMes({ rows: ledger, mesRef, pctMap, statusMap })
    return lista.find(f => f.imobiliaria === selecionada) || { imobiliaria: selecionada, qtd: 0, valorFatura: 0, valorAPagar: 0, pct: pctMap[selecionada] ?? null, status: 'pendente', valorRealFatura: null }
  }, [ledger, mesRef, pctMap, statusMap, selecionada])

  // Apólices que contam na fatura do mês.
  const apolicesNaFatura = useMemo(
    () => ledger.filter(r => apoliceBilladaNoMes(r, mesRef)),
    [ledger, mesRef],
  )

  // Estimativa do mês que vem: apólices emitidas dentro do mês selecionado
  // (a 1ª parcela delas cai na fatura do mês seguinte).
  const emitidasNoMes = useMemo(() => ledger.filter(r => {
    const d = parseYmd(r.data_emissao)
    return d && d.getFullYear() === ano && d.getMonth() + 1 === mes
  }), [ledger, ano, mes])
  const estimativaProximo = useMemo(
    () => emitidasNoMes.reduce((s, r) => s + (Number(r.valor_parcela) || 0), 0),
    [emitidasNoMes],
  )

  useEffect(() => { setValorRealDraft(moneyDraft(fatura.valorRealFatura)) }, [mesRef, fatura.valorRealFatura])

  const meta = resolveImobiliaria(catalogo, selecionada)

  function updateStatus(patch) {
    setStatusMap(prev => ({ ...prev, [selecionada]: { ...(prev[selecionada] || {}), ...patch } }))
  }

  function snapshotPayload() {
    return {
      imobiliaria: selecionada,
      mes: mesRef,
      valorRealFatura: parseMoneyInput(valorRealDraft) ?? fatura.valorRealFatura,
      valorFatura: fatura.valorFatura,
      pct: fatura.pct,
      valorAPagar: fatura.valorAPagar,
      observacao: fatura.observacao,
    }
  }

  async function salvarValorReal() {
    setSaving(true)
    const valor = parseMoneyInput(valorRealDraft)
    const err = await salvarFaturaConferencia({ ...snapshotPayload(), valorRealFatura: valor })
    if (!err) updateStatus({ valor_real_fatura: valor, valor_fatura_calculado: fatura.valorFatura, pct_comissao: fatura.pct, valor_a_pagar: fatura.valorAPagar })
    setSaving(false)
  }

  async function togglePago() {
    setSaving(true)
    if (fatura.status === 'pago') {
      const err = await reabrirFatura({ imobiliaria: selecionada, mes: mesRef })
      if (!err) updateStatus({ status: 'pendente', data_pagamento: null })
    } else {
      const payload = snapshotPayload()
      const err = await marcarFaturaPaga({ ...payload, userId: user?.id })
      if (!err) updateStatus({ status: 'pago', data_pagamento: new Date().toISOString().slice(0, 10), pago_por: user?.id || null, valor_real_fatura: payload.valorRealFatura, valor_fatura_calculado: fatura.valorFatura, pct_comissao: fatura.pct, valor_a_pagar: fatura.valorAPagar })
    }
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate('/financeiro/faturas')}
        className="inline-flex items-center gap-1.5 text-sm text-dark-muted transition-colors hover:text-dark-text"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para imobiliárias
      </button>

      <PageHeader
        eyebrow={`Financeiro · Fatura · ${mesLabel}`}
        title={selecionada}
        description="Fatura do mês, estimativa do próximo mês e apólices que entram no cálculo."
        actions={<ImobiliariaIdentity nome={selecionada} imagemPath={meta?.imagemPath} imagemUrl={meta?.imagemUrl} size="lg" />}
      />

      <DataCard title="Competência" subtitle="Selecione o mês da fatura">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={String(ano)}
            onChange={v => setAno(Number(v))}
            options={[agora.getFullYear() + 1, agora.getFullYear(), agora.getFullYear() - 1, agora.getFullYear() - 2].map(a => ({ value: String(a), label: String(a) }))}
            className="w-28"
          />
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
        </div>
      </DataCard>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Fatura do mês" value={formatMoneyBR(fatura.valorFatura)} hint={`${fatura.qtd} apólice${fatura.qtd !== 1 ? 's' : ''} · ${mesLabel}`} tone="accent" icon={<Receipt className="h-4 w-4" />} />
        <MetricCard label="A pagar" value={formatMoneyBR(fatura.valorAPagar)} hint={fatura.pct != null ? `${fatura.pct}% × fatura` : 'sem % definido'} tone="secondary" icon={<Percent className="h-4 w-4" />} />
        <MetricCard label="Estimativa próximo mês" value={formatMoneyBR(estimativaProximo)} hint={`emitidas em ${mesLabel} → ${proximoLabel}`} tone="warning" icon={<Wallet className="h-4 w-4" />} />
        <MetricCard label="Status" value={fatura.status === 'pago' ? 'Pago' : 'Pendente'} hint={mesLabel} tone={fatura.status === 'pago' ? 'success' : 'warning'} icon={<CalendarPlus className="h-4 w-4" />} />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setPanel({ open: true, title: `Apólices que contam na fatura — ${mesLabel}`, apolices: apolicesNaFatura })}
          className="inline-flex items-center gap-2 rounded-2xl bg-brand-secondary px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <FileText className="h-4 w-4" /> Ver apólices que contam ({apolicesNaFatura.length})
        </button>
        <button
          onClick={() => setPanel({ open: true, title: `Estimativa da fatura de ${proximoLabel}`, apolices: emitidasNoMes })}
          className="inline-flex items-center gap-2 rounded-2xl border border-dark-border px-4 py-2.5 text-sm font-medium text-dark-text transition-colors hover:border-brand-secondary"
        >
          <CalendarPlus className="h-4 w-4" /> Estimativa do mês que vem ({emitidasNoMes.length})
        </button>
      </div>

      <DataCard title="Conferência" subtitle="Informe o valor real e registre o pagamento">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs text-dark-muted">Valor real informado</label>
            <div className="flex items-center gap-1.5">
              <input
                value={valorRealDraft}
                onChange={e => setValorRealDraft(e.target.value)}
                onBlur={salvarValorReal}
                inputMode="decimal"
                placeholder="0,00"
                className="h-9 w-32 rounded-lg border border-dark-border bg-dark-surface2 px-2 text-right font-mono text-sm text-dark-text outline-none focus:border-brand-secondary"
              />
            </div>
          </div>
          <button
            onClick={togglePago}
            disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dark-border px-3 text-sm font-medium text-dark-text transition-colors hover:border-brand-secondary disabled:opacity-50"
          >
            {fatura.status === 'pago' ? (<><RotateCcw className="h-4 w-4" /> Reabrir fatura</>) : (<><Check className="h-4 w-4" /> Marcar como paga</>)}
          </button>
        </div>
      </DataCard>

      <ApolicesListPanel
        isOpen={panel.open}
        onClose={() => setPanel(p => ({ ...p, open: false }))}
        title={panel.title}
        subtitle={selecionada}
        apolices={panel.apolices}
        loading={loading}
      />
    </div>
  )
}
