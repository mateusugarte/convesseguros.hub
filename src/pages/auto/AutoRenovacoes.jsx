import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, CheckCircle2, Clock, ExternalLink, RefreshCw, Send, XCircle } from 'lucide-react'
import { getRenovacoesAuto, atualizarStatusRenovacao } from '../../lib/auto'
import { PageHeader, MetricCard, FilterBar, DataCard, EmptyState } from '../../components/ui'
import { RENOVACAO_STATUS, monthKey } from './autoShared'

const PERIODOS = [
  { value: 'mes_atual', label: 'Mês selecionado' },
  { value: 'proximo_mes', label: 'Mês seguinte' },
  { value: 'passadas', label: 'Vencidas' },
  { value: '', label: 'Todas' },
]

const ACOMPANHAR_FILTROS = [
  { value: 'todas', label: 'Todas' },
  { value: 'cotada_enviada', label: 'Cotadas e enviadas' },
  { value: 'cotada_nao_enviada', label: 'Cotadas não enviadas' },
  { value: 'nao_cotada', label: 'Não cotadas' },
]

const STATUS_COTACAO = {
  nao_cotada: { label: 'Não cotada', shell: 'border-status-danger/20 bg-status-danger/10', badge: 'bg-status-danger/10 text-status-danger' },
  cotada_nao_enviada: { label: 'Cotada - não enviada', shell: 'border-status-warning/20 bg-status-warning/10', badge: 'bg-status-warning/10 text-status-warning' },
  cotada_enviada: { label: 'Cotada e enviada', shell: 'border-status-success/20 bg-status-success/10', badge: 'bg-status-success/10 text-status-success' },
}

function currentMonthRef() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(monthRef, offset) {
  const [year, month] = String(monthRef || '').split('-').map(Number)
  const date = new Date(year || new Date().getFullYear(), (month || 1) - 1 + offset, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatarMes(monthRef) {
  const [year, month] = String(monthRef || '').split('-').map(Number)
  if (!year || !month) return 'mês atual'
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function formatarData(str) {
  if (!str) return '-'
  return new Date(`${str}T12:00:00`).toLocaleDateString('pt-BR')
}

function diasParaVencer(str) {
  if (!str) return null
  const hoje = new Date()
  const alvo = new Date(`${str}T12:00:00`)
  return Math.ceil((alvo - hoje) / (1000 * 60 * 60 * 24))
}

export default function AutoRenovacoes() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [mesRef, setMesRef] = useState(currentMonthRef)
  const [periodo, setPeriodo] = useState('mes_atual')
  const [acompanharFiltro, setAcompanharFiltro] = useState('todas')
  const mesSeguinteRef = useMemo(() => shiftMonth(mesRef, 1), [mesRef])

  const { data: renovacoes = [], isLoading } = useQuery({
    queryKey: ['auto-renovacoes', periodo, mesRef],
    queryFn: () => getRenovacoesAuto({ periodo, mes: mesRef }),
  })

  const { data: todasRenovacoes = [], isLoading: loadingTodas } = useQuery({
    queryKey: ['auto-renovacoes-todas'],
    queryFn: () => getRenovacoesAuto({ periodo: '' }),
  })

  const { mutate: atualizarStatus } = useMutation({
    mutationFn: ({ id, status_cotacao }) => atualizarStatusRenovacao(id, { status_cotacao }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auto-renovacoes'] })
      qc.invalidateQueries({ queryKey: ['auto-renovacoes-todas'] })
    },
  })

  const metricas = useMemo(() => ({
    total: renovacoes.length,
    enviadas: renovacoes.filter(item => item.status_cotacao === 'cotada_enviada').length,
    pendentes: renovacoes.filter(item => item.status_cotacao !== 'cotada_enviada').length,
    vencemNoMes: todasRenovacoes.filter(item => monthKey(item.vigencia_fim) === mesRef).length,
    vencemMesSeguinte: todasRenovacoes.filter(item => monthKey(item.vigencia_fim) === mesSeguinteRef).length,
  }), [renovacoes, todasRenovacoes, mesRef, mesSeguinteRef])

  const acompanharResumo = useMemo(() => ({
    total: todasRenovacoes.length,
    enviadas: todasRenovacoes.filter(item => item.status_cotacao === 'cotada_enviada').length,
    cotadaNaoEnviada: todasRenovacoes.filter(item => item.status_cotacao === 'cotada_nao_enviada').length,
    naoCotada: todasRenovacoes.filter(item => item.status_cotacao === 'nao_cotada' || !item.status_cotacao).length,
    renovadas: todasRenovacoes.filter(item => item.status_renovacao === 'renovada').length,
    pendentes: todasRenovacoes.filter(item => item.status_renovacao === 'pendente').length,
  }), [todasRenovacoes])

  const acompanharLista = useMemo(() => {
    if (acompanharFiltro === 'todas') return todasRenovacoes
    return todasRenovacoes.filter(item => (item.status_cotacao || 'nao_cotada') === acompanharFiltro)
  }, [todasRenovacoes, acompanharFiltro])

  return (
    <div className="auto-page space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Modulo auto"
        title="Renovações Auto"
        description={`Acompanhe vencimentos, situação da cotação e o que ainda precisa sair para proteger a carteira em ${formatarMes(mesRef)}.`}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <input type="month" value={mesRef} onChange={e => setMesRef(e.target.value || currentMonthRef())} className="input" />
            <button onClick={() => navigate('/auto/emissoes')} className="btn-secondary">Abrir emissões</button>
          </div>
        )}
        stats={(
          <>
            <MetricCard label="Renovações" value={metricas.total} hint="itens no recorte ativo" icon={<RefreshCw className="w-5 h-5" />} />
            <MetricCard label="Vencem no mês" value={metricas.vencemNoMes} hint={formatarMes(mesRef)} tone="warning" icon={<CalendarClock className="w-5 h-5" />} />
            <MetricCard label="Vencem mês seguinte" value={metricas.vencemMesSeguinte} hint={formatarMes(mesSeguinteRef)} tone="warning" icon={<Clock className="w-5 h-5" />} />
            <MetricCard label="Cotadas e enviadas" value={metricas.enviadas} hint="prontas para retorno" tone="success" icon={<CheckCircle2 className="w-5 h-5" />} />
          </>
        )}
      />

      <DataCard className="overflow-hidden border-brand-accent/12" bodyClassName="p-0">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="relative overflow-hidden bg-gradient-to-br from-brand-accent/10 via-transparent to-brand-secondary/8 p-6 md:p-8">
            <div className="absolute -right-6 top-0 h-28 w-28 rounded-full bg-brand-accent/10 blur-3xl" />
            <div className="relative z-[1] max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-dark-surface/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-status-info">
                <Clock className="h-3.5 w-3.5" />
                Leitura da carteira
              </div>
              <h2 className="mt-4 text-2xl font-semibold text-dark-text md:text-3xl">
                Renovações com foco em risco, prazo e envio.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-dark-muted">
                O módulo agora respeita o mês selecionado e destaca o que vence no período, o que vence no mês seguinte e o status operacional de cada apólice.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="badge badge-success">{metricas.enviadas} enviadas</span>
                <span className="badge badge-warning">{metricas.pendentes} pendentes</span>
                <span className="badge badge-muted">{metricas.total} no recorte</span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 bg-dark-surface2/45 p-6 md:p-8 sm:grid-cols-2 lg:grid-cols-1">
            {[
              { label: 'Cotadas e enviadas', value: acompanharResumo.enviadas, hint: 'prontas para fechamento', tone: 'success' },
              { label: 'Cotadas não enviadas', value: acompanharResumo.cotadaNaoEnviada, hint: 'aguardando envio', tone: 'warning' },
              { label: 'Não cotadas', value: acompanharResumo.naoCotada, hint: 'sem cotação iniciada', tone: 'danger' },
              { label: 'Renovadas', value: acompanharResumo.renovadas, hint: `de ${acompanharResumo.total} no total`, tone: 'accent' },
            ].map(item => (
              <div key={item.label} className="rounded-3xl border border-dark-border/70 bg-dark-surface/75 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">{item.label}</p>
                  <span className={`h-2.5 w-2.5 rounded-full ${item.tone === 'success' ? 'bg-status-success' : item.tone === 'warning' ? 'bg-status-warning' : item.tone === 'danger' ? 'bg-status-danger' : 'bg-brand-accent'}`} />
                </div>
                <p className="mt-2 text-2xl font-semibold text-dark-text">{item.value}</p>
                <p className="mt-2 text-xs text-dark-muted">{item.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </DataCard>

      <FilterBar>
        <div className="flex flex-wrap items-center gap-2">
          {PERIODOS.map(item => (
            <button
              key={item.value}
              onClick={() => setPeriodo(item.value)}
              className={`rounded-2xl border px-4 py-2 text-sm font-medium transition-all ${
                periodo === item.value
                  ? 'border-brand-accent bg-brand-accent/10 text-status-info'
                  : 'border-dark-border text-dark-muted hover:border-brand-accent/40 hover:text-dark-text'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </FilterBar>

      <DataCard title="Lista de renovações" subtitle="Clique em uma renovação para abrir a área completa da apólice." className="overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-dark-muted">Carregando renovações...</div>
        ) : renovacoes.length === 0 ? (
          <EmptyState icon={<RefreshCw className="w-6 h-6" />} title="Nenhuma renovação no recorte" description="Quando houver itens no período selecionado, eles aparecerão aqui." />
        ) : (
          <div className="space-y-3">
            {renovacoes.map(item => {
              const apolice = item.apolices_auto || {}
              const statusInfo = STATUS_COTACAO[item.status_cotacao] || STATUS_COTACAO.nao_cotada
              const renovacaoInfo = RENOVACAO_STATUS[item.status_renovacao || 'pendente'] || RENOVACAO_STATUS.pendente
              const dias = diasParaVencer(item.vigencia_fim)
              const apoliceId = apolice.id || item.apolice_id
              return (
                <article
                  key={item.id}
                  onClick={() => apoliceId && navigate(`/auto/apolices/${apoliceId}`)}
                  className={`group relative overflow-hidden rounded-3xl border p-4 transition-all ${statusInfo.shell} ${apoliceId ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
                >
                  <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-60" />
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-dark-text">{item.clientes_auto?.nome_completo || apolice.nome_cliente || '-'}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusInfo.badge}`}>{statusInfo.label}</span>
                        <span className={`badge ${renovacaoInfo.cls}`}>{renovacaoInfo.label}</span>
                        {typeof dias === 'number' && (
                          <span className={`badge ${dias < 0 ? 'badge-danger' : dias <= 15 ? 'badge-warning' : 'badge-muted'}`}>
                            {dias < 0 ? `${Math.abs(dias)} dia(s) vencida` : `${dias} dia(s) para vencer`}
                          </span>
                        )}
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
                        <div className="rounded-2xl border border-white/60 bg-white/70 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Apólice</p>
                          <p className="mt-1 font-semibold text-dark-text">{apolice.numero_apolice || 'Sem número'}</p>
                          <p className="mt-1 text-xs text-dark-muted">{formatarData(apolice.vigencia_inicio)} até {formatarData(item.vigencia_fim || apolice.vigencia_fim)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/60 bg-white/70 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Cliente vinculado</p>
                          <p className="mt-1 font-semibold text-dark-text">{item.clientes_auto?.nome_completo || apolice.nome_cliente || '-'}</p>
                          <p className="mt-1 text-xs text-dark-muted">{item.clientes_auto?.celular || item.clientes_auto?.telefone || item.clientes_auto?.email || 'Sem contato principal'}</p>
                        </div>
                        <div className="rounded-2xl border border-white/60 bg-white/70 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Seguradora</p>
                          <p className="mt-1 font-semibold text-dark-text">{item.seguradora || apolice.seguradora || 'Não informada'}</p>
                          <p className="mt-1 text-xs text-dark-muted">Veículo: {apolice.modelo_veiculo || '—'} · Placa: {apolice.placa || '—'}</p>
                        </div>
                        <div className="rounded-2xl border border-white/60 bg-white/70 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Informações da emissão</p>
                          <p className="mt-1 font-semibold text-dark-text">Emissão #{apolice.emissao_id || '—'}</p>
                          <p className="mt-1 text-xs text-dark-muted">Pagamento: {apolice.forma_pagamento || '—'} · Parcelamento: {apolice.parcelamento || '—'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex min-w-[240px] flex-col gap-3" onClick={e => e.stopPropagation()}>
                      <select
                        value={item.status_cotacao || 'nao_cotada'}
                        onChange={e => atualizarStatus({ id: item.id, status_cotacao: e.target.value })}
                        className="rounded-2xl border border-dark-border/70 bg-dark-surface/90 px-3 py-2 text-sm text-dark-text shadow-sm outline-none transition-colors focus:border-brand-accent/40"
                      >
                        <option value="nao_cotada">Não cotada</option>
                        <option value="cotada_nao_enviada">Cotada - não enviada</option>
                        <option value="cotada_enviada">Cotada e enviada</option>
                      </select>
                      {apoliceId && (
                        <button onClick={() => navigate(`/auto/apolices/${apoliceId}`)} className="btn-secondary inline-flex items-center justify-center gap-2">
                          Abrir apólice
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </DataCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[28px] border border-status-success/20 bg-gradient-to-br from-status-success/8 to-white/70 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-status-success">
            <Send className="w-4 h-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.14em]">Cotadas e enviadas</p>
          </div>
          <p className="mt-3 text-3xl font-bold text-dark-text">{acompanharResumo.enviadas}</p>
          <p className="mt-1 text-xs text-dark-muted">prontas para fechamento</p>
        </div>

        <div className="rounded-[28px] border border-status-warning/20 bg-gradient-to-br from-status-warning/8 to-white/70 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-status-warning">
            <Clock className="w-4 h-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.14em]">Cotadas não enviadas</p>
          </div>
          <p className="mt-3 text-3xl font-bold text-dark-text">{acompanharResumo.cotadaNaoEnviada}</p>
          <p className="mt-1 text-xs text-dark-muted">aguardando envio ao cliente</p>
        </div>

        <div className="rounded-[28px] border border-status-danger/20 bg-gradient-to-br from-status-danger/8 to-white/70 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-status-danger">
            <XCircle className="w-4 h-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.14em]">Não cotadas</p>
          </div>
          <p className="mt-3 text-3xl font-bold text-dark-text">{acompanharResumo.naoCotada}</p>
          <p className="mt-1 text-xs text-dark-muted">sem cotação iniciada</p>
        </div>

        <div className="rounded-[28px] border border-brand-accent/20 bg-gradient-to-br from-brand-accent/10 to-white/70 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-status-info">
            <CheckCircle2 className="w-4 h-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.14em]">Renovadas</p>
          </div>
          <p className="mt-3 text-3xl font-bold text-dark-text">{acompanharResumo.renovadas}</p>
          <p className="mt-1 text-xs text-dark-muted">de {acompanharResumo.total} no total</p>
        </div>
      </div>

      <DataCard
        title="Acompanhar renovações"
        subtitle="Visão completa do status de todas as renovações da carteira"
        actions={(
          <div className="flex flex-wrap gap-2">
            {ACOMPANHAR_FILTROS.map(f => (
              <button
                key={f.value}
                onClick={() => setAcompanharFiltro(f.value)}
                className={`rounded-2xl border px-3 py-1.5 text-xs font-medium transition-all ${
                  acompanharFiltro === f.value
                    ? 'border-brand-accent bg-brand-accent/10 text-status-info'
                    : 'border-dark-border text-dark-muted hover:border-brand-accent/40 hover:text-dark-text'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      >
        {loadingTodas ? (
          <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
        ) : acompanharLista.length === 0 ? (
          <EmptyState icon={<RefreshCw className="w-6 h-6" />} title="Nenhuma renovação encontrada" description="Nenhuma renovação corresponde ao filtro selecionado." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-border/60 text-left">
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Cliente</th>
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Seguradora</th>
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Vencimento</th>
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Cotação</th>
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Resultado</th>
                  <th className="pb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border/40">
                {acompanharLista.map(item => {
                  const cotacaoInfo = STATUS_COTACAO[item.status_cotacao || 'nao_cotada']
                  const renovacaoInfo = RENOVACAO_STATUS[item.status_renovacao || 'pendente'] || RENOVACAO_STATUS.pendente
                  const apoliceId = item.apolices_auto?.id || item.apolice_id
                  return (
                    <tr key={item.id} className="transition-colors hover:bg-brand-accent/5">
                      <td className="py-3 pr-4 font-medium text-dark-text">{item.clientes_auto?.nome_completo || '-'}</td>
                      <td className="py-3 pr-4 text-dark-muted">{item.seguradora || '-'}</td>
                      <td className="py-3 pr-4 text-dark-muted">{formatarData(item.vigencia_fim)}</td>
                      <td className="py-3 pr-4"><span className={`badge ${cotacaoInfo.badge}`}>{cotacaoInfo.label}</span></td>
                      <td className="py-3 pr-4"><span className={`badge ${renovacaoInfo.cls}`}>{renovacaoInfo.label}</span></td>
                      <td className="py-3">
                        {apoliceId ? (
                          <button onClick={() => navigate(`/auto/apolices/${apoliceId}`)} className="rounded-2xl border border-brand-secondary/20 bg-brand-secondary/8 px-3 py-1.5 text-xs font-semibold text-status-info">
                            Abrir apólice
                          </button>
                        ) : '—'}
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
