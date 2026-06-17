import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, startOfMonth, startOfQuarter, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  ArrowUpRight, Award, CalendarRange, CircleDollarSign, Flag, Plus, Target, TrendingUp, Trophy, X,
} from 'lucide-react'
import { DatePicker } from '../../components/ui/DatePicker'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../contexts/ToastContext'
import { metaSet, PRODUTOS, saleAdd, useComercial } from '../../lib/comercial'
import {
  CrmAvatarBadge,
  CrmEmptyState,
  CrmMetricCard,
  CrmPageHeader,
  CrmSectionCard,
  CrmSegmentedControl,
} from '../../components/comercial'

const PERIOD_OPTIONS = [
  { value: 'todos', label: 'Tudo' },
  { value: '30dias', label: '30 dias' },
  { value: 'mes', label: 'Este mês' },
  { value: 'trimestre', label: 'Trimestre' },
]

function formatMoney(value) {
  return `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function ModalVenda({ leads, onClose, onSave }) {
  const [form, setForm] = useState({
    leadId: '',
    produto: '',
    valor: '',
    comissao: '',
    dataEmissao: new Date().toISOString().slice(0, 10),
    observacoes: '',
  })

  const selectedLead = leads.find(lead => lead.id === form.leadId)
  const valor = parseFloat(form.valor) || 0
  const comissaoPercent = parseFloat(form.comissao) || 0
  const comissaoCalculada = valor * comissaoPercent / 100
  const invalidComissao = comissaoPercent < 0 || comissaoPercent > 100
  const invalidValor = valor < 0
  const valid = form.produto && form.valor && form.comissao && form.dataEmissao && !invalidComissao && !invalidValor

  function setField(key, value) {
    setForm(current => ({ ...current, [key]: value }))
  }

  return (
    <div className="fixed inset-0 z-[450] flex items-center justify-center p-4 animate-fade-in">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-[32px] border border-dark-border/60 bg-white shadow-[0_36px_120px_rgba(15,23,42,0.22)]">
        <div className="grid lg:grid-cols-[minmax(0,1.1fr)_340px]">
          <div className="border-b border-dark-border/50 p-6 lg:border-b-0 lg:border-r">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-accent">Nova venda</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-dark-text">Registrar fechamento</h2>
                <p className="mt-2 text-sm text-dark-muted">Formalize o ganho, a comissão e o contexto do fechamento sem sair da área comercial.</p>
              </div>
              <button type="button" onClick={onClose} className="rounded-2xl border border-dark-border/60 p-2 text-dark-muted transition-colors hover:text-dark-text">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-dark-muted">Lead vinculado</label>
                <Select
                  value={form.leadId}
                  onChange={value => setField('leadId', value)}
                  options={leads.map(lead => ({ value: lead.id, label: lead.nome }))}
                  placeholder="Sem lead vinculado"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-dark-muted">Produto</label>
                <Select
                  value={form.produto}
                  onChange={value => setField('produto', value)}
                  options={PRODUTOS.map(product => ({ value: product.id, label: product.label }))}
                  placeholder="Selecionar produto"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-dark-muted">Valor do fechamento</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.valor}
                  onChange={event => setField('valor', event.target.value)}
                  placeholder="0,00"
                  className="input w-full"
                />
                {invalidValor && <p className="mt-1 text-xs text-rose-600">O valor não pode ser negativo.</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-dark-muted">% comissão</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.comissao}
                  onChange={event => setField('comissao', event.target.value)}
                  placeholder="0"
                  className="input w-full"
                />
                {invalidComissao && <p className="mt-1 text-xs text-rose-600">A comissão deve ficar entre 0% e 100%.</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-dark-muted">Data de emissão</label>
                <DatePicker value={form.dataEmissao} onChange={value => setField('dataEmissao', value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-dark-muted">Comissão calculada</label>
                <div className="input flex items-center font-mono text-emerald-600">{formatMoney(comissaoCalculada)}</div>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-dark-muted">Observações</label>
                <textarea
                  rows={4}
                  value={form.observacoes}
                  onChange={event => setField('observacoes', event.target.value)}
                  placeholder="Anote contexto do fechamento, objeções vencidas ou próximos passos."
                  className="input w-full resize-none"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => valid && onSave({ ...form, leadNome: selectedLead?.nome || 'Manual' })}
                disabled={!valid}
                className="btn-primary"
              >
                Registrar venda
              </button>
            </div>
          </div>

          <aside className="bg-[linear-gradient(180deg,rgba(239,246,255,0.9),rgba(255,255,255,0.96))] p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-dark-muted">Resumo do fechamento</p>
            <div className="mt-5 rounded-[26px] border border-dark-border/50 bg-white/80 p-5 shadow-sm">
              {selectedLead ? (
                <CrmAvatarBadge name={selectedLead.nome} subtitle={selectedLead.origem || 'Lead vinculado'} />
              ) : (
                <div>
                  <p className="text-sm font-semibold text-dark-text">Venda manual</p>
                  <p className="mt-1 text-xs text-dark-muted">Sem lead vinculado. O registro ficará disponível apenas no módulo de vendas.</p>
                </div>
              )}
              <div className="mt-5 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-dark-muted">Produto</span>
                  <span className="font-semibold text-dark-text">
                    {PRODUTOS.find(product => product.id === form.produto)?.label || 'A definir'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-dark-muted">Valor</span>
                  <span className="font-semibold text-dark-text">{formatMoney(valor)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-dark-muted">Comissão</span>
                  <span className="font-semibold text-emerald-600">{formatMoney(comissaoCalculada)}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-[26px] border border-dark-border/50 bg-slate-900/[0.03] p-5">
              <p className="text-sm font-semibold text-dark-text">Boas práticas</p>
              <ul className="mt-3 space-y-2 text-sm text-dark-muted">
                <li>Preencha o produto para alimentar o ranking executivo.</li>
                <li>Use observações para contexto comercial e próximos passos.</li>
                <li>Vincule o lead sempre que o fechamento veio do pipeline.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

function SalesTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-2xl border border-dark-border/60 bg-white/95 px-3 py-2 shadow-xl">
      <p className="text-xs font-semibold text-dark-text">{label}</p>
      {payload.map(item => (
        <div key={item.dataKey} className="mt-1 flex items-center justify-between gap-5 text-xs">
          <span className="inline-flex items-center gap-2 text-dark-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
            Receita
          </span>
          <span className="font-semibold text-dark-text">{formatMoney(item.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Vendas() {
  const state = useComercial()
  const toast = useToast()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [periodo, setPeriodo] = useState('mes')
  const [metaInput, setMetaInput] = useState(String(state.meta || 10))

  const filteredSales = useMemo(() => {
    if (periodo === 'todos') return state.sales || []

    const start = periodo === '30dias'
      ? subDays(new Date(), 30)
      : periodo === 'trimestre'
        ? startOfQuarter(new Date())
        : startOfMonth(new Date())

    return (state.sales || []).filter(sale => !sale.dataEmissao || new Date(sale.dataEmissao) >= start)
  }, [periodo, state.sales])

  const stats = useMemo(() => {
    const total = filteredSales.reduce((sum, sale) => sum + (parseFloat(sale.valor) || 0), 0)
    const comissao = filteredSales.reduce((sum, sale) => {
      const valor = parseFloat(sale.valor) || 0
      const percentual = parseFloat(sale.comissao) || 0
      return sum + valor * percentual / 100
    }, 0)
    const ticket = filteredSales.length ? total / filteredSales.length : 0
    const leadBase = (state.leads || []).length || 1
    const conversao = Math.round((filteredSales.length / leadBase) * 100)
    return { total, comissao, ticket, count: filteredSales.length, conversao }
  }, [filteredSales, state.leads])

  const productPerformance = useMemo(() => {
    const performance = {}
    filteredSales.forEach(sale => {
      const key = sale.produto || 'sem_produto'
      if (!performance[key]) performance[key] = { produto: key, receita: 0, vendas: 0 }
      performance[key].receita += parseFloat(sale.valor) || 0
      performance[key].vendas += 1
    })
    return Object.values(performance)
      .map(item => ({
        ...item,
        label: PRODUTOS.find(product => product.id === item.produto)?.label || item.produto,
        color: PRODUTOS.find(product => product.id === item.produto)?.cor || '#2563EB',
      }))
      .sort((a, b) => b.receita - a.receita)
  }, [filteredSales])

  const topClosings = useMemo(
    () => [...filteredSales].sort((a, b) => (parseFloat(b.valor) || 0) - (parseFloat(a.valor) || 0)).slice(0, 5),
    [filteredSales]
  )

  const metaAtual = Number(state.meta) || 10
  const progress = metaAtual > 0 ? Math.min(100, Math.round((stats.count / metaAtual) * 100)) : 0

  async function handleSave(form) {
    try {
      await saleAdd(form)
      toast({ type: 'success', title: 'Venda registrada com sucesso' })
      setOpen(false)
    } catch {
      toast({ type: 'error', title: 'Erro ao registrar venda' })
    }
  }

  function handleMetaSave() {
    const numeric = Math.max(1, parseInt(metaInput || '0', 10))
    metaSet(numeric)
    setMetaInput(String(numeric))
    toast({ type: 'success', title: 'Meta comercial atualizada' })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <CrmPageHeader
        eyebrow="Receita e performance"
        title="Cockpit executivo de vendas"
        description="Acompanhe receita, metas, performance por produto e os fechamentos que realmente movem o comercial."
        aside={(
          <div className="rounded-[24px] border border-dark-border/60 bg-white/70 px-4 py-3 text-sm shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-dark-muted">Meta operacional</p>
            <p className="mt-1 text-2xl font-black text-dark-text">{metaAtual}</p>
            <p className="mt-1 text-xs text-dark-muted">vendas alvo no período atual</p>
          </div>
        )}
        actions={(
          <>
            <button type="button" onClick={() => navigate('/comercial/pipeline')} className="btn-secondary text-sm">
              Pipeline
            </button>
            <button type="button" onClick={() => setOpen(true)} className="btn-primary text-sm">
              <span className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nova venda
              </span>
            </button>
          </>
        )}
      />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <CrmSegmentedControl options={PERIOD_OPTIONS} value={periodo} onChange={setPeriodo} />
        <div className="flex flex-wrap items-center gap-2 rounded-[22px] border border-dark-border/60 bg-white/70 px-3 py-2 shadow-sm">
          <Flag className="h-4 w-4 text-brand-accent" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-dark-muted">Meta</span>
          <input
            type="number"
            min="1"
            value={metaInput}
            onChange={event => setMetaInput(event.target.value)}
            className="w-20 rounded-xl border border-dark-border/60 bg-white px-3 py-1.5 text-sm font-semibold text-dark-text outline-none"
          />
          <button type="button" onClick={handleMetaSave} className="rounded-xl bg-dark-text px-3 py-1.5 text-xs font-semibold text-white">
            Salvar
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CrmMetricCard icon={CircleDollarSign} label="Receita" value={formatMoney(stats.total)} accent="#059669" helper="Volume financeiro convertido" />
        <CrmMetricCard icon={Award} label="Vendas" value={stats.count} accent="#2563EB" helper="Fechamentos no período" />
        <CrmMetricCard icon={Target} label="Ticket médio" value={formatMoney(stats.ticket)} accent="#7C3AED" helper="Receita média por venda" />
        <CrmMetricCard icon={TrendingUp} label="Conversão" value={`${stats.conversao}%`} accent="#EA580C" helper="Vendas sobre a base total de leads" />
        <CrmMetricCard icon={Trophy} label="Comissão" value={formatMoney(stats.comissao)} accent="#D97706" helper="Total projetado de comissão" />
        <CrmMetricCard
          icon={Flag}
          label="Meta atingida"
          value={`${progress}%`}
          accent="#DB2777"
          helper={`${stats.count} de ${metaAtual} vendas alvo`}
          badge={progress >= 100 ? 'meta batida' : null}
        />
        <CrmMetricCard
          icon={ArrowUpRight}
          label="Top produto"
          value={productPerformance[0]?.label || 'Sem produto'}
          accent="#0F766E"
          helper={productPerformance[0] ? `${formatMoney(productPerformance[0].receita)} de receita` : 'Sem vendas suficientes'}
        />
        <CrmMetricCard
          icon={CalendarRange}
          label="Janela ativa"
          value={PERIOD_OPTIONS.find(option => option.value === periodo)?.label || 'Tudo'}
          accent="#475569"
          helper="Visão usada no cockpit atual"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
        <div className="space-y-4">
          <CrmSectionCard title="Receita por produto" subtitle="Onde o caixa está concentrado agora.">
            {productPerformance.length === 0 ? (
              <CrmEmptyState
                icon={CircleDollarSign}
                title="Sem vendas no período"
                description="Registre fechamentos para desbloquear a análise de receita por produto."
                compact
              />
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productPerformance} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'rgb(100 116 139)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'rgb(100 116 139)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<SalesTooltip />} />
                    <Bar dataKey="receita" radius={[12, 12, 0, 0]}>
                      {productPerformance.map(item => <Cell key={item.produto} fill={item.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CrmSectionCard>

          <CrmSectionCard title="Fechamentos recentes" subtitle="Últimas vendas registradas com leitura executiva.">
            {filteredSales.length === 0 ? (
              <CrmEmptyState
                icon={Award}
                title="Nenhum fechamento encontrado"
                description="A lista passa a refletir as vendas assim que o time registrar novos ganhos."
                compact
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-border/60 text-left">
                      {['Lead', 'Produto', 'Valor', 'Comissão', 'Data', 'Observações'].map(header => (
                        <th key={header} className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-dark-muted">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...filteredSales].sort((a, b) => (b.dataEmissao || '').localeCompare(a.dataEmissao || '')).map(sale => {
                      const product = PRODUTOS.find(item => item.id === sale.produto)
                      const comissao = (parseFloat(sale.valor) || 0) * (parseFloat(sale.comissao) || 0) / 100
                      return (
                        <tr key={sale.id} className="border-b border-dark-border/40 last:border-b-0">
                          <td className="px-3 py-4">
                            <button type="button" onClick={() => navigate('/comercial/leads')} className="text-left">
                              <p className="font-semibold text-dark-text">{sale.leadNome || 'Venda manual'}</p>
                              <p className="text-xs text-dark-muted">Registro comercial</p>
                            </button>
                          </td>
                          <td className="px-3 py-4">
                            {product ? (
                              <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ color: product.cor, background: `${product.cor}16` }}>
                                {product.label}
                              </span>
                            ) : (
                              <span className="text-xs text-dark-muted">{sale.produto || 'Não informado'}</span>
                            )}
                          </td>
                          <td className="px-3 py-4 font-semibold text-dark-text">{formatMoney(sale.valor)}</td>
                          <td className="px-3 py-4 font-semibold text-emerald-600">{formatMoney(comissao)}</td>
                          <td className="px-3 py-4 text-dark-muted">
                            {sale.dataEmissao ? format(parseISO(sale.dataEmissao), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                          </td>
                          <td className="max-w-[220px] px-3 py-4 text-xs text-dark-muted">{sale.observacoes || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CrmSectionCard>
        </div>

        <div className="space-y-4">
          <CrmSectionCard title="Meta e performance" subtitle="Acompanhamento de progresso do time nesta janela.">
            <div className="rounded-[26px] border border-dark-border/50 bg-white/70 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dark-muted">Execução</p>
                  <p className="mt-2 text-3xl font-black text-dark-text">{progress}%</p>
                  <p className="mt-1 text-sm text-dark-muted">{stats.count} vendas registradas de uma meta de {metaAtual}.</p>
                </div>
                <div className="rounded-2xl bg-brand-accent/10 px-3 py-2 text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-accent">Receita alvo</p>
                  <p className="mt-1 text-lg font-black text-dark-text">{formatMoney(stats.ticket * metaAtual)}</p>
                </div>
              </div>
              <div className="mt-5 h-3 rounded-full bg-slate-900/6">
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#2563EB,#10B981)]" style={{ width: `${Math.max(progress, stats.count ? 8 : 0)}%` }} />
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {productPerformance.slice(0, 3).map(item => (
                <div key={item.produto} className="rounded-[22px] border border-dark-border/50 bg-white/55 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-dark-text">{item.label}</p>
                      <p className="mt-1 text-xs text-dark-muted">{item.vendas} venda(s)</p>
                    </div>
                    <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ color: item.color, background: `${item.color}16` }}>
                      {formatMoney(item.receita)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CrmSectionCard>

          <CrmSectionCard title="Ranking de fechamentos" subtitle="Negócios com maior impacto financeiro.">
            {topClosings.length === 0 ? (
              <CrmEmptyState
                icon={Trophy}
                title="Sem ranking disponível"
                description="O ranking aparece assim que houver vendas suficientes nesta janela."
                compact
              />
            ) : (
              <div className="space-y-3">
                {topClosings.map((sale, index) => (
                  <div key={sale.id} className="rounded-[22px] border border-dark-border/50 bg-white/60 p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-500/12 text-sm font-black text-amber-600">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <CrmAvatarBadge name={sale.leadNome || 'Venda manual'} subtitle={PRODUTOS.find(product => product.id === sale.produto)?.label || sale.produto} size="sm" />
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-dark-text">{formatMoney(sale.valor)}</p>
                        <p className="text-[11px] text-dark-muted">
                          {sale.dataEmissao ? format(parseISO(sale.dataEmissao), 'dd MMM', { locale: ptBR }) : 'sem data'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CrmSectionCard>
        </div>
      </div>

      {open && <ModalVenda leads={state.leads || []} onClose={() => setOpen(false)} onSave={handleSave} />}
    </div>
  )
}
