import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, CheckCircle2, Clock, ExternalLink, PencilLine, RefreshCw, Search, Send, Trash2, X, XCircle } from 'lucide-react'
import {
  atualizarStatusRenovacao,
  cancelarRenovacao,
  excluirRenovacao,
  getRenovacoesAuto,
  iniciarCotacaoRenovacao,
} from '../../lib/auto'
import { useToast } from '../../contexts/ToastContext'
import { PageHeader, MetricCard, FilterBar, DataCard, EmptyState } from '../../components/ui'
import SeguradoraBadge from '../../components/SeguradoraBadge'
import ModalEditarRenovacao from './ModalEditarRenovacao'
import { renewalStatusFields, renewalStatusValue } from '../../lib/autoOperational'
import {
  RENOVACAO_STATUS,
  monthKey,
  diasParaVencer,
  formatDiasParaVencer,
  getRenovacaoUrgencia,
  RENOVACAO_URGENCIA_META,
  getRenewalQuoteStatus,
  getRenovacaoAreaStatus,
  RENOVACAO_AREA_STATUS_META,
  getComissaoAtualAnterior,
  toneClasses,
} from './autoShared'

const PERIODOS = [
  { value: 'mes_atual', label: 'Mês selecionado' },
  { value: 'proximo_mes', label: 'Mês seguinte' },
  { value: 'passadas', label: 'Vencidas' },
  { value: '', label: 'Todas' },
]

const STATUS_PLANILHA = [
  ['pendente', 'PENDENTE'],
  ['em_andamento', 'COTANDO'],
  ['enviada', 'ENVIADO'],
  ['negociando', 'NEGOCIANDO'],
  ['outra_corretora', 'OUTRA CORRETORA'],
  ['renovada', 'RENOVADO'],
  ['nao_renovada', 'CANCELADO'],
]

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

function normalizeSearch(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function renovacaoMatches(item, query) {
  if (!query) return true
  const apolice = item.apolices_auto || {}
  const cliente = item.clientes_auto || {}
  return normalizeSearch([
    cliente.nome_completo,
    cliente.celular,
    cliente.telefone,
    cliente.email,
    apolice.nome_cliente,
    apolice.numero_apolice,
    apolice.modelo_veiculo,
    apolice.placa,
    item.nome_segurado_anterior,
    item.seguradora,
    item.identificacao_veiculo,
  ].filter(Boolean).join(' ')).includes(normalizeSearch(query))
}


export default function AutoRenovacoes() {
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const qc = useQueryClient()
  // O banner do Dashboard e o botao "Puxar renovacoes" navegam levando o mes
  // como query param, para a lista abrir no mesmo recorte.
  const [mesRef, setMesRef] = useState(() => searchParams.get('mes') || currentMonthRef())
  const [periodo, setPeriodo] = useState(() => localStorage.getItem('auto-renovacoes-periodo') || 'mes_atual')
  const [busca, setBusca] = useState('')
  const mesSeguinteRef = useMemo(() => shiftMonth(mesRef, 1), [mesRef])

  // Mantem a URL em sincronia com o mes da lista, para que recarregar ou
  // compartilhar o link volte no mesmo recorte. O guard de igualdade evita
  // loop de navegacao.
  useEffect(() => {
    const mesNaUrl = searchParams.get('mes')
    if (mesNaUrl === mesRef) return
    const next = new URLSearchParams(searchParams)
    next.set('mes', mesRef)
    setSearchParams(next, { replace: true })
  }, [mesRef, searchParams, setSearchParams])

  useEffect(() => {
    localStorage.setItem('auto-renovacoes-periodo', periodo)
  }, [periodo])

  const { data: renovacoes = [], isLoading, isError: isErrorRenovacoes, error: errorRenovacoes } = useQuery({
    queryKey: ['auto-renovacoes', periodo, mesRef],
    queryFn: () => getRenovacoesAuto({ periodo, mes: mesRef }),
  })

  const { data: todasRenovacoes = [] } = useQuery({
    queryKey: ['auto-renovacoes-todas'],
    queryFn: () => getRenovacoesAuto({ periodo: '' }),
  })

  const [cotandoId, setCotandoId] = useState(null)

  const { mutateAsync: cotarRenovacao } = useMutation({
    mutationFn: renovacaoId => iniciarCotacaoRenovacao(renovacaoId),
    onSuccess: async ({ cotacaoId }) => {
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes'] })
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes-todas'] })
      await qc.invalidateQueries({ queryKey: ['auto-emissoes'] })
      navigate(`/auto/cotacoes/${cotacaoId}`)
    },
    onSettled: () => setCotandoId(null),
  })

  const handleCotar = async (renovacaoId) => {
    if (cotandoId) return
    setCotandoId(renovacaoId)
    try {
      await cotarRenovacao(renovacaoId)
    } catch (err) {
      window.alert(err?.message || 'Erro ao iniciar cotação de renovação.')
    }
  }

  const { mutateAsync: cancelarRenovacaoAsync, isPending: cancelando } = useMutation({
    mutationFn: ({ id, motivo }) => cancelarRenovacao(id, motivo),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes'] })
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes-todas'] })
    },
  })

  function handleCancelar(id) {
    const motivo = window.prompt('Motivo do cancelamento (opcional):')
    if (motivo === null) return
    cancelarRenovacaoAsync({ id, motivo: motivo || null })
  }

  const { mutateAsync: excluirRenovacaoAsync, isPending: excluindo } = useMutation({
    mutationFn: id => excluirRenovacao(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes'] })
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes-todas'] })
      // A exclusão arrasta a cotação/emissão geradas pela renovação.
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes-pendentes'] })
      await qc.invalidateQueries({ queryKey: ['auto-emissoes'] })
      await qc.invalidateQueries({ queryKey: ['auto-cotacoes'] })
      await qc.invalidateQueries({ queryKey: ['auto-cotacoes-todas'] })
      toast({ type: 'success', title: 'Renovação excluída' })
    },
    onError: err => toast({ type: 'error', title: 'Erro ao excluir renovação', message: err?.message || 'Tente novamente.' }),
  })

  function handleExcluir(id) {
    if (!window.confirm('Excluir esta renovação definitivamente? Essa ação não pode ser desfeita.')) return
    excluirRenovacaoAsync(id)
  }

  const [editandoRenovacao, setEditandoRenovacao] = useState(null)

  const { mutateAsync: salvarEdicaoAsync, isPending: salvandoEdicao } = useMutation({
    mutationFn: ({ id, campos }) => atualizarStatusRenovacao(id, campos),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes'] })
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes-todas'] })
      toast({ type: 'success', title: 'Renovação atualizada' })
      setEditandoRenovacao(null)
    },
    onError: err => toast({ type: 'error', title: 'Erro ao atualizar renovação', message: err?.message || 'Tente novamente.' }),
  })

  const { mutateAsync: salvarCelulaAsync } = useMutation({
    mutationFn: ({ id, campos }) => atualizarStatusRenovacao(id, campos),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes'] })
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes-todas'] })
    },
    onError: err => toast({ type: 'error', title: 'Não foi possível salvar a célula', message: err?.message || 'Tente novamente.' }),
  })

  const verRenovacoes = () => {
    setPeriodo('mes_atual')
    requestAnimationFrame(() => document.getElementById('planilha-renovacoes')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const metricas = useMemo(() => ({
    total: renovacoes.length,
    enviadas: renovacoes.filter(item => getRenewalQuoteStatus(item) === 'aguardando_retorno').length,
    pendentes: renovacoes.filter(item => getRenewalQuoteStatus(item) !== 'concluida').length,
    vencemNoMes: todasRenovacoes.filter(item => monthKey(item.vigencia_fim) === mesRef).length,
    vencemMesSeguinte: todasRenovacoes.filter(item => monthKey(item.vigencia_fim) === mesSeguinteRef).length,
  }), [renovacoes, todasRenovacoes, mesRef, mesSeguinteRef])

  const acompanharResumo = useMemo(() => {
    const status = todasRenovacoes.map(getRenewalQuoteStatus)
    return {
      total: todasRenovacoes.length,
      enviadas: status.filter(s => s === 'aguardando_retorno').length,
      cotadaNaoEnviada: status.filter(s => s === 'em_andamento').length,
      naoCotada: status.filter(s => s === 'nao_cotada').length,
      renovadas: todasRenovacoes.filter(item => item.status_renovacao === 'renovada').length,
      pendentes: todasRenovacoes.filter(item => item.status_renovacao === 'pendente').length,
    }
  }, [todasRenovacoes])

  const renovacoesFiltradas = useMemo(
    () => renovacoes.filter(item => renovacaoMatches(item, busca)),
    [renovacoes, busca],
  )

  return (
    <div className="auto-page space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Modulo auto"
        title="Renovações Auto"
        description={`Acompanhe vencimentos, situação da cotação e o que ainda precisa sair para proteger a carteira em ${formatarMes(mesRef)}.`}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <input type="month" value={mesRef} onChange={e => setMesRef(e.target.value || currentMonthRef())} className="input" />
            <button onClick={() => navigate(`/auto/renovacoes/puxar?mes=${mesRef}`)} className="btn-secondary">
              Puxar renovações
            </button>
            <button onClick={verRenovacoes} className="btn-primary">VER RENOVAÇÕES</button>
            <button onClick={() => navigate('/auto/emissoes')} className="btn-secondary">Abrir emissões</button>
          </div>
        )}
        stats={(
          <>
            <MetricCard label="Renovações" value={metricas.total} hint="itens no recorte ativo" icon={<RefreshCw className="w-5 h-5" />} />
            <MetricCard label="Vencem no mês" value={metricas.vencemNoMes} hint={formatarMes(mesRef)} tone="warning" icon={<CalendarClock className="w-5 h-5" />} />
            <MetricCard label="Vencem mês seguinte" value={metricas.vencemMesSeguinte} hint={formatarMes(mesSeguinteRef)} tone="warning" icon={<Clock className="w-5 h-5" />} />
            <MetricCard label="Aguardando retorno" value={metricas.enviadas} hint="em negociação/vistoria" tone="success" icon={<CheckCircle2 className="w-5 h-5" />} />
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
                <span className="badge badge-success">{metricas.enviadas} aguardando retorno</span>
                <span className="badge badge-warning">{metricas.pendentes} pendentes</span>
                <span className="badge badge-muted">{metricas.total} no recorte</span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 bg-dark-surface2/45 p-6 md:p-8 sm:grid-cols-2 lg:grid-cols-1">
            {[
              { label: 'Aguardando retorno', value: acompanharResumo.enviadas, hint: 'em negociação/vistoria', tone: 'success' },
              { label: 'Cotação em andamento', value: acompanharResumo.cotadaNaoEnviada, hint: 'cotação criada, sem retorno ainda', tone: 'warning' },
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
        <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
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
          <label className="auto-renewal-search">
            <Search aria-hidden="true" />
            <input
              value={busca}
              onChange={event => setBusca(event.target.value)}
              placeholder="Cliente, apólice, placa, veículo ou seguradora"
              aria-label="Buscar renovações"
            />
            {busca && <button type="button" onClick={() => setBusca('')} aria-label="Limpar busca"><X aria-hidden="true" /></button>}
          </label>
        </div>
      </FilterBar>

      <DataCard title="Lista de renovações" subtitle="Clique em uma renovação para abrir a área completa da apólice." className="overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-dark-muted">Carregando renovações...</div>
        ) : isErrorRenovacoes ? (
          <EmptyState icon={<XCircle className="w-6 h-6" />} title="Erro ao carregar renovações" description={errorRenovacoes?.message || 'Tente recarregar a página.'} />
        ) : renovacoesFiltradas.length === 0 ? (
          <EmptyState icon={<RefreshCw className="w-6 h-6" />} title="Nenhuma renovação no recorte" description="Quando houver itens no período selecionado, eles aparecerão aqui." />
        ) : (
          <div className="space-y-3">
            {renovacoesFiltradas.map(item => {
              const apolice = item.apolices_auto || {}
              const renovacaoInfo = RENOVACAO_STATUS[item.status_renovacao || 'pendente'] || RENOVACAO_STATUS.pendente
              const dias = diasParaVencer(item.vigencia_fim)
              const concluida = item.status_renovacao === 'renovada'
              const proximoMes = monthKey(item.vigencia_fim) === mesSeguinteRef
              const urgenciaKey = getRenovacaoUrgencia({ dias, concluida, proximoMes })
              const urgencia = RENOVACAO_URGENCIA_META[urgenciaKey]
              const areaStatusKey = getRenovacaoAreaStatus(item)
              const areaStatus = RENOVACAO_AREA_STATUS_META[areaStatusKey]
              const comissao = getComissaoAtualAnterior(item)
              const apoliceId = apolice.id || item.apolice_id
              const seguradoraNome = item.seguradora || apolice.seguradora || null
              const isCotando = cotandoId === item.id
              return (
                <article
                  key={item.id}
                  onClick={() => apoliceId && navigate(`/auto/apolices/${apoliceId}`)}
                  className={`group relative overflow-hidden rounded-3xl border p-4 transition-all ${urgencia.rowClass} ${apoliceId ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
                >
                  <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-60" />
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-dark-text">{item.clientes_auto?.nome_completo || apolice.nome_cliente || item.nome_segurado_anterior || '-'}</h3>
                        <span className={`badge ${urgencia.badgeClass}`}>{urgencia.label}</span>
                        <span className={`badge ${toneClasses(areaStatus.tone)}`}>{areaStatus.label}</span>
                        <span className={`badge ${renovacaoInfo.cls}`}>{renovacaoInfo.label}</span>
                        {typeof dias === 'number' && (
                          <span className="badge badge-muted">{formatDiasParaVencer(dias)}</span>
                        )}
                        <span className="badge badge-muted">{proximoMes ? 'Próximo mês' : 'Mês atual'}</span>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
                        <div className="rounded-2xl border border-white/60 bg-white/70 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Apólice</p>
                          <p className="mt-1 font-semibold text-dark-text">{apolice.numero_apolice || 'Sem número'}</p>
                          <p className="mt-1 text-xs text-dark-muted">{formatarData(apolice.vigencia_inicio)} até {formatarData(item.vigencia_fim || apolice.vigencia_fim)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/60 bg-white/70 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Cliente vinculado</p>
                          <p className="mt-1 font-semibold text-dark-text">{item.clientes_auto?.nome_completo || apolice.nome_cliente || item.nome_segurado_anterior || '-'}</p>
                          <p className="mt-1 text-xs text-dark-muted">{item.clientes_auto?.celular || item.clientes_auto?.telefone || item.clientes_auto?.email || 'Sem contato principal'}</p>
                        </div>
                        <div className="rounded-2xl border border-white/60 bg-white/70 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Seguradora</p>
                          {seguradoraNome ? (
                            <SeguradoraBadge nome={seguradoraNome} size="sm" className="mt-1" />
                          ) : (
                            <p className="mt-1 font-semibold text-dark-text">Não informada</p>
                          )}
                          <p className="mt-1 text-xs text-dark-muted">Veículo: {apolice.modelo_veiculo || '—'} · Placa: {apolice.placa || '—'}</p>
                          {item.identificacao_veiculo && (
                            <p className="mt-1 text-xs text-dark-muted">2 veículos — esta renovação: {item.identificacao_veiculo}</p>
                          )}
                        </div>
                        <div className="rounded-2xl border border-white/60 bg-white/70 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Informações da emissão</p>
                          <p className="mt-1 font-semibold text-dark-text">Emissão #{apolice.emissao_id || '—'}</p>
                          <p className="mt-1 text-xs text-dark-muted">Pagamento: {apolice.forma_pagamento || '—'} · Parcelamento: {apolice.parcelamento || '—'}</p>
                        </div>
                        <div className="rounded-2xl border border-white/60 bg-white/70 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Prazo e comissão</p>
                          <p className="mt-1 text-xs text-dark-muted">Limite p/ envio: {formatarData(item.data_limite_envio)}</p>
                          <p className="mt-1 text-xs text-dark-muted">
                            Comissão atual: {comissao.atual != null ? `${comissao.atual}%` : '—'} · anterior: {comissao.anterior != null ? `${comissao.anterior}%` : '—'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex min-w-[240px] flex-col gap-3" onClick={e => e.stopPropagation()}>
                      {item.cotacao_id ? (
                        <button
                          onClick={() => navigate(`/auto/cotacoes/${item.cotacao_id}`)}
                          className="btn-secondary inline-flex items-center justify-center gap-2"
                        >
                          Ver cotação
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleCotar(item.id)}
                          disabled={isCotando}
                          className="btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                          {isCotando ? 'Criando cotação...' : 'Fazer Cotação'}
                        </button>
                      )}
                      {apoliceId && (
                        <button onClick={() => navigate(`/auto/apolices/${apoliceId}`)} className="btn-secondary inline-flex items-center justify-center gap-2">
                          Abrir apólice
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      )}
                      {areaStatusKey !== 'renovado' && areaStatusKey !== 'cancelado' && (
                        <button
                          onClick={() => handleCancelar(item.id)}
                          disabled={cancelando}
                          className="rounded-2xl border border-status-danger/30 bg-status-danger/5 px-3 py-2 text-xs font-semibold text-status-danger transition-colors hover:bg-status-danger/10 disabled:opacity-60"
                        >
                          Cancelar renovação
                        </button>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditandoRenovacao(item)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl border border-dark-border px-3 py-2 text-xs font-semibold text-dark-muted transition-colors hover:border-brand-accent/40 hover:text-dark-text"
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        <button
                          onClick={() => handleExcluir(item.id)}
                          disabled={excluindo}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl border border-status-danger/30 bg-status-danger/5 px-3 py-2 text-xs font-semibold text-status-danger transition-colors hover:bg-status-danger/10 disabled:opacity-60"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Excluir
                        </button>
                      </div>
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
            <p className="text-xs font-semibold uppercase tracking-[0.14em]">Aguardando retorno</p>
          </div>
          <p className="mt-3 text-3xl font-bold text-dark-text">{acompanharResumo.enviadas}</p>
          <p className="mt-1 text-xs text-dark-muted">prontas para fechamento</p>
        </div>

        <div className="rounded-[28px] border border-status-warning/20 bg-gradient-to-br from-status-warning/8 to-white/70 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-status-warning">
            <Clock className="w-4 h-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.14em]">Cotação em andamento</p>
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

      <div id="planilha-renovacoes" className="scroll-mt-5">
        <DataCard
          title={`Planilha de renovações — ${formatarMes(mesRef)}`}
          subtitle="Edite qualquer célula; ao sair dela, a alteração é salva automaticamente. As colunas seguem a planilha operacional de agosto/2026."
        >
          {isLoading ? (
            <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
          ) : isErrorRenovacoes ? (
            <EmptyState icon={<XCircle className="w-6 h-6" />} title="Erro ao carregar renovações" description={errorRenovacoes?.message || 'Tente recarregar a página.'} />
          ) : renovacoesFiltradas.length === 0 ? (
            <EmptyState icon={<RefreshCw className="w-6 h-6" />} title="Nenhuma renovação encontrada" description="Use Puxar renovações para montar a lista deste mês." />
          ) : (
            <div className="auto-sheet-wrap">
              <table className="auto-sheet auto-sheet-renewals">
                <thead>
                  <tr>
                    <th>Data</th><th>Cia</th><th>Segurado</th><th>Veículo</th><th>Status</th>
                    <th>Limite</th><th>Comissão</th><th>Com. passada</th><th>Sistema</th><th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {renovacoesFiltradas.map(item => {
                    const nome = item.clientes_auto?.nome_completo || item.apolices_auto?.nome_cliente || item.nome_segurado_anterior || ''
                    const veiculo = item.identificacao_veiculo || item.apolices_auto?.modelo_veiculo || ''
                    const save = (field, initial) => event => {
                      if (String(event.target.value ?? '') === String(initial ?? '')) return
                      salvarCelulaAsync({ id: item.id, campos: { [field]: event.target.value || null } })
                    }
                    return (
                      <tr key={item.id}>
                        <td><input type="date" defaultValue={item.vigencia_fim || ''} onBlur={save('vigencia_fim', item.vigencia_fim)} /></td>
                        <td><input defaultValue={item.seguradora || ''} onBlur={save('seguradora', item.seguradora)} placeholder="Seguradora" /></td>
                        <td><input defaultValue={nome} onBlur={save('nome_segurado_anterior', nome)} placeholder="Segurado" /></td>
                        <td><input defaultValue={veiculo} onBlur={save('identificacao_veiculo', veiculo)} placeholder="Veículo / placa" /></td>
                        <td>
                          <select
                            value={renewalStatusValue(item)}
                            onChange={event => salvarCelulaAsync({ id: item.id, campos: renewalStatusFields(event.target.value) })}
                          >
                            {STATUS_PLANILHA.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </td>
                        <td><input type="date" defaultValue={item.data_limite_envio || ''} onBlur={save('data_limite_envio', item.data_limite_envio)} /></td>
                        <td><input type="number" step="0.01" defaultValue={item.pct_comissao_atual ?? ''} onBlur={save('pct_comissao_atual', item.pct_comissao_atual)} placeholder="%" /></td>
                        <td><input type="number" step="0.01" defaultValue={item.pct_comissao_anterior ?? ''} onBlur={save('pct_comissao_anterior', item.pct_comissao_anterior)} placeholder="%" /></td>
                        <td><span className="auto-sheet-ok">OK</span></td>
                        <td className="auto-sheet-actions">
                          {item.cotacao_id ? (
                            <button onClick={() => navigate(`/auto/cotacoes/${item.cotacao_id}`)}>Ver cotação</button>
                          ) : (
                            <button onClick={() => handleCotar(item.id)} disabled={cotandoId === item.id}>{cotandoId === item.id ? 'Criando…' : 'Cotar'}</button>
                          )}
                          <button onClick={() => setEditandoRenovacao(item)} aria-label="Editar renovação"><PencilLine className="h-3.5 w-3.5" /></button>
                          <button className="is-danger" onClick={() => handleExcluir(item.id)} disabled={excluindo} aria-label="Excluir renovação"><Trash2 className="h-3.5 w-3.5" /></button>
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

      {editandoRenovacao && (
        <ModalEditarRenovacao
          renovacao={editandoRenovacao}
          onClose={() => setEditandoRenovacao(null)}
          isSaving={salvandoEdicao}
          onSave={campos => salvarEdicaoAsync({ id: editandoRenovacao.id, campos })}
        />
      )}
    </div>
  )
}
