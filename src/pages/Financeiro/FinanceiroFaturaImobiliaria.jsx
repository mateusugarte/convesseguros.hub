import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader, MetricCard, DataCard } from '../../components/ui'
import { Select } from '../../components/ui/Select'
import ImobiliariaIdentity from '../../components/ImobiliariaIdentity'
import SeguradoraBadge from '../../components/SeguradoraBadge'
import RegisteredSeguradorasStrip from '../../components/financeiro/RegisteredSeguradorasStrip'
import ApolicesListView from '../../components/financeiro/ApolicesListView'
import { useAuth } from '../../contexts/AuthContext'
import {
  fetchFaturasLedger, fetchPctImobiliarias, fetchFaturasStatus,
  marcarFaturaPaga, reabrirFatura, salvarFaturaConferencia,
} from '../../lib/financeiro'
import { montarFaturasMes, apoliceContaNaFaturaNoMes } from '../../lib/financeiroFaturasCalc'
import { apoliceAtivaNoMes } from '../../lib/financeiroElegibilidade'
import { fetchImobiliariasCatalogMap, resolveImobiliaria } from '../../lib/imobiliariasLogos'
import { parseYmd, addMeses, formatMesAno } from '../../lib/financeiroCalc'
import { formatMoneyBR } from '../../lib/apolices'
import { ArrowLeft, Receipt, Percent, Wallet, Shield, Check, RotateCcw, FileText, CalendarPlus } from 'lucide-react'

const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
function pad2(v) { return String(v).padStart(2, '0') }
function num(v) { return Number(v) || 0 }
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

const SCROLL_KEY = 'financeiro-fatura-imob-scroll'

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
  const [segFiltro, setSegFiltro] = useState('')

  const mesRef = `${ano}-${pad2(mes)}-01`
  const proximoMesRef = addMeses(mesRef, 1)
  const mesLabel = `${MESES_ABBR[mes - 1]} ${ano}`
  const proximoLabel = formatMesAno(proximoMesRef)

  useEffect(() => { setSearchParams({ mes: mesRef }, { replace: true }) }, [mesRef, setSearchParams])

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

  useEffect(() => {
    if (loading) return
    const saved = sessionStorage.getItem(SCROLL_KEY)
    if (saved) { window.scrollTo(0, Number(saved) || 0); sessionStorage.removeItem(SCROLL_KEY) }
  }, [loading])

  const ledgerFiltrado = useMemo(
    () => (segFiltro ? ledger.filter(r => r.seguradora === segFiltro) : ledger),
    [ledger, segFiltro],
  )

  const apolicesAtivasMes = useMemo(
    () => ledgerFiltrado.filter(r => apoliceAtivaNoMes(r, mesRef)),
    [ledgerFiltrado, mesRef],
  )
  const apolicesNaFatura = useMemo(
    () => ledgerFiltrado.filter(r => apoliceContaNaFaturaNoMes(r, mesRef)),
    [ledgerFiltrado, mesRef],
  )

  const fatura = useMemo(() => {
    const lista = montarFaturasMes({ rows: ledgerFiltrado, mesRef, pctMap, statusMap })
    return lista.find(f => f.imobiliaria === selecionada)
      || { imobiliaria: selecionada, qtd: 0, valorFatura: 0, valorAPagar: 0, pct: pctMap[selecionada] ?? null, status: 'pendente', valorRealFatura: null }
  }, [ledgerFiltrado, mesRef, pctMap, statusMap, selecionada])

  const emitidasNoMes = useMemo(() => ledgerFiltrado.filter(r => {
    const d = parseYmd(r.data_emissao)
    return d && d.getFullYear() === ano && d.getMonth() + 1 === mes && apoliceAtivaNoMes(r, proximoMesRef)
  }), [ledgerFiltrado, ano, mes, proximoMesRef])
  const valorNovasEmissoes = useMemo(() => emitidasNoMes.reduce((s, r) => s + num(r.valor_parcela), 0), [emitidasNoMes])
  const estimativaProximo = fatura.valorFatura + valorNovasEmissoes

  const segGroups = useMemo(() => {
    const map = new Map()
    for (const r of ledger) {
      const key = r.seguradora || 'Sem seguradora'
      const cur = map.get(key) || { seguradora: key, ativas: 0, valorFatura: 0, novas: 0, apolices: [] }
      if (apoliceAtivaNoMes(r, mesRef)) cur.ativas += 1
      if (apoliceContaNaFaturaNoMes(r, mesRef)) cur.valorFatura += num(r.valor_parcela)
      const d = parseYmd(r.data_emissao)
      if (d && d.getFullYear() === ano && d.getMonth() + 1 === mes && apoliceAtivaNoMes(r, proximoMesRef)) cur.novas += num(r.valor_parcela)
      cur.apolices.push(r)
      map.set(key, cur)
    }
    return [...map.values()]
      .map(g => ({ ...g, estimativa: g.valorFatura + g.novas }))
      .sort((a, b) => b.valorFatura - a.valorFatura || a.seguradora.localeCompare(b.seguradora))
  }, [ledger, mesRef, ano, mes, proximoMesRef])

  useEffect(() => { setValorRealDraft(moneyDraft(fatura.valorRealFatura)) }, [mesRef, fatura.valorRealFatura])

  const meta = resolveImobiliaria(catalogo, selecionada)

  function updateStatus(patch) {
    setStatusMap(prev => ({ ...prev, [selecionada]: { ...(prev[selecionada] || {}), ...patch } }))
  }
  function snapshotPayload() {
    return {
      imobiliaria: selecionada, mes: mesRef,
      valorRealFatura: parseMoneyInput(valorRealDraft) ?? fatura.valorRealFatura,
      valorFatura: fatura.valorFatura, pct: fatura.pct, valorAPagar: fatura.valorAPagar, observacao: fatura.observacao,
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

  function abrirApolice(a) {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY))
    navigate(`/apolices/${a.id}`, {
      state: {
        returnTo: `/financeiro/faturas/${encodeURIComponent(selecionada)}?mes=${mesRef}`,
        returnLabel: 'Voltar para a fatura',
      },
    })
  }

  return (
    <div className="financeiro-page space-y-5">
      <button
        onClick={() => navigate(`/financeiro/faturas?mes=${mesRef}`)}
        className="inline-flex items-center gap-1.5 text-sm text-dark-muted transition-colors hover:text-dark-text"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para imobiliárias
      </button>

      <section className="financeiro-hero px-6 py-6">
        <PageHeader
          eyebrow={`Financeiro · Fatura · ${mesLabel}`}
          title={selecionada}
          description="Fatura do mês, estimativa do próximo mês e apólices elegíveis por seguradora."
          actions={<ImobiliariaIdentity nome={selecionada} imagemPath={meta?.imagemPath} imagemUrl={meta?.imagemUrl} size="lg" />}
        />
        <RegisteredSeguradorasStrip seguradoras={meta?.registeredSeguradoras} size="sm" className="mt-4" />
      </section>

      <DataCard title="Competência" subtitle="Selecione o mês da fatura" className="border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(240,253,250,0.9))]">
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
                className={`rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors ${mes === i + 1 ? 'bg-emerald-600 text-white' : 'text-dark-muted hover:bg-emerald-50 hover:text-emerald-700'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </DataCard>

      {segGroups.length > 0 && (
        <DataCard title="Filtrar por seguradora" subtitle="Filtra os valores e apólices abaixo pela seguradora selecionada" className="border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(240,253,244,0.86))]">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSegFiltro('')}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${segFiltro === '' ? 'bg-emerald-600 text-white' : 'border border-emerald-500/15 bg-dark-surface/90 text-dark-muted hover:text-dark-text'}`}
            >
              Todas
            </button>
            {segGroups.map(g => (
              <button
                key={g.seguradora}
                onClick={() => setSegFiltro(prev => prev === g.seguradora ? '' : g.seguradora)}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${segFiltro === g.seguradora ? 'bg-emerald-600 text-white' : 'border border-emerald-500/15 bg-dark-surface/90 text-dark-muted hover:text-dark-text'}`}
              >
                <SeguradoraBadge nome={g.seguradora} size="xs" />
              </button>
            ))}
          </div>
        </DataCard>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Fatura do mês"
          value={formatMoneyBR(fatura.valorFatura)}
          hint={`${fatura.qtd} apólice${fatura.qtd !== 1 ? 's' : ''} · ${mesLabel}${segFiltro ? ` · ${segFiltro}` : ''}`}
          tone="accent"
          icon={<Receipt className="h-4 w-4" />}
          className="border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.88))]"
        />
        <MetricCard
          label="A pagar"
          value={formatMoneyBR(fatura.valorAPagar)}
          hint={fatura.pct != null ? `${fatura.pct}% × fatura` : 'sem % definido'}
          tone="secondary"
          icon={<Percent className="h-4 w-4" />}
          className="border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(240,253,250,0.9))]"
        />
        <MetricCard
          label="Estimativa próximo mês"
          value={formatMoneyBR(estimativaProximo)}
          hint={`atual + ${emitidasNoMes.length} nova(s) → ${proximoLabel}`}
          tone="warning"
          icon={<Wallet className="h-4 w-4" />}
          className="border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(254,249,195,0.55))]"
        />
        <MetricCard
          label={segFiltro ? `Ativas (${segFiltro})` : 'Apólices ativas'}
          value={apolicesAtivasMes.length}
          hint={selecionada}
          tone="success"
          icon={<Shield className="h-4 w-4" />}
          className="border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(220,252,231,0.84))]"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => navigate(`/financeiro/faturas/${encodeURIComponent(selecionada)}/${mesRef}`)}
          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <FileText className="h-4 w-4" /> Ver apólices que contam ({fatura.qtd})
        </button>
        <button
          onClick={() => navigate(`/financeiro/faturas/${encodeURIComponent(selecionada)}/${proximoMesRef}`)}
          className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-dark-surface/85 px-4 py-2.5 text-sm font-medium text-dark-text transition-colors hover:border-emerald-500/40"
        >
          <CalendarPlus className="h-4 w-4" /> Ver fatura de {proximoLabel}
        </button>
      </div>

      <DataCard title="Conferência" subtitle="Informe o valor real e registre o pagamento" className="border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(240,253,244,0.86))]">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs text-dark-muted">Valor real informado</label>
            <input
              value={valorRealDraft}
              onChange={e => setValorRealDraft(e.target.value)}
              onBlur={salvarValorReal}
              inputMode="decimal"
              placeholder="0,00"
              className="h-9 w-32 rounded-lg border border-emerald-500/15 bg-dark-surface/90 px-2 text-right font-mono text-sm text-dark-text outline-none focus:border-emerald-500/40"
            />
          </div>
          <button
            onClick={togglePago}
            disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-500/15 bg-dark-surface/90 px-3 text-sm font-medium text-dark-text transition-colors hover:border-emerald-500/40 disabled:opacity-50"
          >
            {fatura.status === 'pago' ? (<><RotateCcw className="h-4 w-4" /> Reabrir fatura</>) : (<><Check className="h-4 w-4" /> Marcar como paga</>)}
          </button>
          <span className={`inline-flex h-9 items-center rounded-lg px-3 text-xs font-medium ${fatura.status === 'pago' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-500'}`}>
            {fatura.status === 'pago' ? 'Pago' : 'Pendente'}
          </span>
        </div>
      </DataCard>

      <DataCard
        title="Resumo por seguradora"
        subtitle={`Contribuição de cada seguradora para a fatura de ${mesLabel}`}
        className="border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.9))]"
      >
        {loading ? (
          <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
        ) : segGroups.length === 0 ? (
          <div className="py-8 text-center text-sm text-dark-muted">Sem apólices elegíveis para fatura nesta imobiliária.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {segGroups.map(g => {
              const ativa = segFiltro === g.seguradora
              return (
                <button
                  key={g.seguradora}
                  onClick={() => setSegFiltro(prev => prev === g.seguradora ? '' : g.seguradora)}
                  className={`rounded-2xl border px-4 py-3 text-left transition-colors ${ativa ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-emerald-500/15 bg-dark-surface/90 hover:border-emerald-500/30'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <SeguradoraBadge nome={g.seguradora} size="md" />
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{g.ativas} ativas</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-dark-muted">Fatura do mês</p>
                      <p className="font-semibold text-dark-text">{formatMoneyBR(g.valorFatura)}</p>
                    </div>
                    <div>
                      <p className="text-dark-muted">Estimativa próx.</p>
                      <p className="font-semibold text-dark-text">{formatMoneyBR(g.estimativa)}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </DataCard>

      <DataCard
        title={segFiltro ? `Apólices que contam — ${segFiltro}` : 'Apólices que contam na fatura'}
        subtitle={`Parcelas programadas para ${mesLabel}${segFiltro ? ` · filtradas por ${segFiltro}` : ''}`}
        className="border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(240,253,244,0.86))]"
      >
        {loading ? (
          <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
        ) : (
          <ApolicesListView
            apolices={apolicesNaFatura}
            onRowClick={abrirApolice}
            showEmissao
            showComissaoMensal
            showVigencia
          />
        )}
      </DataCard>
    </div>
  )
}
