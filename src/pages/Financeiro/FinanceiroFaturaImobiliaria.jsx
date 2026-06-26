import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader, MetricCard, DataCard } from '../../components/ui'
import { Select } from '../../components/ui/Select'
import ImobiliariaIdentity from '../../components/ImobiliariaIdentity'
import SeguradoraBadge from '../../components/SeguradoraBadge'
import ApolicesListView from '../../components/financeiro/ApolicesListView'
import { useAuth } from '../../contexts/AuthContext'
import {
  fetchFaturasLedger, fetchPctImobiliarias, fetchFaturasStatus,
  marcarFaturaPaga, reabrirFatura, salvarFaturaConferencia,
} from '../../lib/financeiro'
import { montarFaturasMes, apoliceBilladaNoMes } from '../../lib/financeiroFaturasCalc'
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
  // Seguradora selecionada no filtro ('' = todas)
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

  // Restaura scroll ao voltar do detalhe da apólice.
  useEffect(() => {
    if (loading) return
    const saved = sessionStorage.getItem(SCROLL_KEY)
    if (saved) { window.scrollTo(0, Number(saved) || 0); sessionStorage.removeItem(SCROLL_KEY) }
  }, [loading])

  // Apólices filtradas pela seguradora selecionada (ou todas).
  const ledgerFiltrado = useMemo(
    () => (segFiltro ? ledger.filter(r => r.seguradora === segFiltro) : ledger),
    [ledger, segFiltro],
  )

  const fatura = useMemo(() => {
    const lista = montarFaturasMes({ rows: ledgerFiltrado, mesRef, pctMap, statusMap })
    return lista.find(f => f.imobiliaria === selecionada)
      || { imobiliaria: selecionada, qtd: 0, valorFatura: 0, valorAPagar: 0, pct: pctMap[selecionada] ?? null, status: 'pendente', valorRealFatura: null }
  }, [ledgerFiltrado, mesRef, pctMap, statusMap, selecionada])

  // Apólices emitidas no mês selecionado do ledger filtrado (estimativa do próximo mês).
  const emitidasNoMes = useMemo(() => ledgerFiltrado.filter(r => {
    const d = parseYmd(r.data_emissao)
    return d && d.getFullYear() === ano && d.getMonth() + 1 === mes
  }), [ledgerFiltrado, ano, mes])
  const valorNovasEmissoes = useMemo(() => emitidasNoMes.reduce((s, r) => s + num(r.valor_parcela), 0), [emitidasNoMes])
  const estimativaProximo = fatura.valorFatura + valorNovasEmissoes

  // Grupos por seguradora (sempre do ledger completo para o seletor).
  const segGroups = useMemo(() => {
    const map = new Map()
    for (const r of ledger) {
      const key = r.seguradora || 'Sem seguradora'
      const cur = map.get(key) || { seguradora: key, ativas: 0, valorFatura: 0, novas: 0, apolices: [] }
      cur.ativas += 1
      if (apoliceBilladaNoMes(r, mesRef)) cur.valorFatura += num(r.valor_parcela)
      const d = parseYmd(r.data_emissao)
      if (d && d.getFullYear() === ano && d.getMonth() + 1 === mes) cur.novas += num(r.valor_parcela)
      cur.apolices.push(r)
      map.set(key, cur)
    }
    return [...map.values()]
      .map(g => ({ ...g, estimativa: g.valorFatura + g.novas }))
      .sort((a, b) => b.valorFatura - a.valorFatura || a.seguradora.localeCompare(b.seguradora))
  }, [ledger, mesRef, ano, mes])

  // Apólices para exibir na lista (filtradas pela seguradora selecionada no seletor).
  const apolicesParaLista = useMemo(
    () => (segFiltro ? ledger.filter(r => r.seguradora === segFiltro) : ledger),
    [ledger, segFiltro],
  )

  // Total de apólices que faturam no mês, respeitando o filtro de seguradora.
  const ativasFiltradas = useMemo(
    () => ledgerFiltrado.filter(r => apoliceBilladaNoMes(r, mesRef)),
    [ledgerFiltrado, mesRef],
  )

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
    navigate(`/apolices/${a.id}`)
  }

  const segOptions = [
    { value: '', label: 'Todas as seguradoras' },
    ...segGroups.map(g => ({ value: g.seguradora, label: g.seguradora })),
  ]

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
        description="Fatura do mês, estimativa do próximo mês e apólices elegíveis por seguradora."
        actions={<ImobiliariaIdentity nome={selecionada} imagemPath={meta?.imagemPath} imagemUrl={meta?.imagemUrl} size="lg" />}
      />

      {/* Seletor de competência */}
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

      {/* Seletor de seguradora */}
      {segGroups.length > 0 && (
        <DataCard title="Filtrar por seguradora" subtitle="Filtra os valores e apólices abaixo pela seguradora selecionada">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSegFiltro('')}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${segFiltro === '' ? 'bg-brand-secondary text-white' : 'border border-dark-border text-dark-muted hover:text-dark-text'}`}
            >
              Todas
            </button>
            {segGroups.map(g => (
              <button
                key={g.seguradora}
                onClick={() => setSegFiltro(prev => prev === g.seguradora ? '' : g.seguradora)}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${segFiltro === g.seguradora ? 'bg-brand-secondary text-white' : 'border border-dark-border text-dark-muted hover:text-dark-text'}`}
              >
                <SeguradoraBadge nome={g.seguradora} size="xs" />
              </button>
            ))}
          </div>
        </DataCard>
      )}

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Fatura do mês"
          value={formatMoneyBR(fatura.valorFatura)}
          hint={`${fatura.qtd} apólice${fatura.qtd !== 1 ? 's' : ''} · ${mesLabel}${segFiltro ? ` · ${segFiltro}` : ''}`}
          tone="accent"
          icon={<Receipt className="h-4 w-4" />}
        />
        <MetricCard
          label="A pagar"
          value={formatMoneyBR(fatura.valorAPagar)}
          hint={fatura.pct != null ? `${fatura.pct}% × fatura` : 'sem % definido'}
          tone="secondary"
          icon={<Percent className="h-4 w-4" />}
        />
        <MetricCard
          label="Estimativa próximo mês"
          value={formatMoneyBR(estimativaProximo)}
          hint={`atual + ${emitidasNoMes.length} nova(s) → ${proximoLabel}`}
          tone="warning"
          icon={<Wallet className="h-4 w-4" />}
        />
        <MetricCard
          label={segFiltro ? `Ativas (${segFiltro})` : 'Apólices ativas'}
          value={ativasFiltradas.length}
          hint={selecionada}
          tone="success"
          icon={<Shield className="h-4 w-4" />}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => navigate(`/financeiro/faturas/${encodeURIComponent(selecionada)}/${mesRef}`)}
          className="inline-flex items-center gap-2 rounded-2xl bg-brand-secondary px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <FileText className="h-4 w-4" /> Ver apólices que contam ({fatura.qtd})
        </button>
        <button
          onClick={() => navigate(`/financeiro/faturas/${encodeURIComponent(selecionada)}/${proximoMesRef}`)}
          className="inline-flex items-center gap-2 rounded-2xl border border-dark-border px-4 py-2.5 text-sm font-medium text-dark-text transition-colors hover:border-brand-secondary"
        >
          <CalendarPlus className="h-4 w-4" /> Ver fatura de {proximoLabel}
        </button>
      </div>

      {/* Conferência */}
      <DataCard title="Conferência" subtitle="Informe o valor real e registre o pagamento">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs text-dark-muted">Valor real informado</label>
            <input
              value={valorRealDraft}
              onChange={e => setValorRealDraft(e.target.value)}
              onBlur={salvarValorReal}
              inputMode="decimal"
              placeholder="0,00"
              className="h-9 w-32 rounded-lg border border-dark-border bg-dark-surface2 px-2 text-right font-mono text-sm text-dark-text outline-none focus:border-brand-secondary"
            />
          </div>
          <button
            onClick={togglePago}
            disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dark-border px-3 text-sm font-medium text-dark-text transition-colors hover:border-brand-secondary disabled:opacity-50"
          >
            {fatura.status === 'pago' ? (<><RotateCcw className="h-4 w-4" /> Reabrir fatura</>) : (<><Check className="h-4 w-4" /> Marcar como paga</>)}
          </button>
          <span className={`inline-flex h-9 items-center rounded-lg px-3 text-xs font-medium ${fatura.status === 'pago' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
            {fatura.status === 'pago' ? 'Pago' : 'Pendente'}
          </span>
        </div>
      </DataCard>

      {/* Resumo por seguradora */}
      <DataCard
        title="Resumo por seguradora"
        subtitle={`Contribuição de cada seguradora para a fatura de ${mesLabel}`}
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
                  className={`rounded-2xl border px-4 py-3 text-left transition-colors ${ativa ? 'border-brand-secondary bg-brand-secondary/10' : 'border-dark-border/70 bg-dark-surface2/40 hover:border-brand-secondary'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <SeguradoraBadge nome={g.seguradora} size="md" />
                    <span className="rounded-md bg-dark-surface2 px-2 py-0.5 text-[11px] font-medium text-dark-muted">{g.ativas} ativas</span>
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

      {/* Lista de apólices elegíveis */}
      <DataCard
        title={segFiltro ? `Apólices — ${segFiltro}` : 'Apólices elegíveis para fatura'}
        subtitle={`Forma de pagamento: Fatura${segFiltro ? ` · filtradas por ${segFiltro}` : ' — todas as seguradoras'}`}
      >
        {loading ? (
          <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
        ) : (
          <ApolicesListView
            apolices={apolicesParaLista}
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
