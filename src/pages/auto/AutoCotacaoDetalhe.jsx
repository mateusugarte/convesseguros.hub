import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, AlertTriangle, BadgeDollarSign, CalendarDays, Car, Check, ClipboardCheck, Copy, FileSearch, Gauge, Pencil, ShieldCheck, UserRound, X, Mail, Heart, Phone, Trash2 } from 'lucide-react'
import { DataCard, EmptyState } from '../../components/ui'
import SeguradoraBadge from '../../components/SeguradoraBadge'
import {
  AutoBadge,
  AutoLoading,
  AutoPageHeader,
  AutoQuoteComparison,
  AutoQuoteSnapshot,
  AutoStatStrip,
  AutoTabs,
  AutoTypeBadge,
  AutoWorkflowPanel,
} from '../../components/auto'
import { calcularValorComissaoAuto, deletarCotacaoAuto, getCotacaoAutoPorId, atualizarCotacaoAuto, sincronizarDadosExtraidosCotacaoAuto } from '../../lib/auto'
import { COTACAO_STATUS, formatDateTimeBR, formatMoney, toneClasses } from './autoShared'
import { formatDecimalBRInput, parseDecimalBR } from '../../lib/numberInput'
import { mesclarOpcaoFinanceira, opcaoFinanceiraSincronizada } from '../../lib/autoQuoteFinancial'
import { valorFormularioAuto } from '../../lib/autoFormPayload'
import { planExtractedQuoteClientSync } from '../../lib/autoQuoteClientSync.js'
import { useVoltar } from '../../hooks/useVoltar.js'

function QuoteStatusBadge({ status }) {
  const meta = COTACAO_STATUS[status] || COTACAO_STATUS.aberta
  return <span className={`badge ${toneClasses(meta.tone)}`}>{meta.label}</span>
}

function formatMoneyOptional(value, fallback = 'Aguardando leitura') {
  const parsed = parseDecimalBR(value)
  return parsed === null ? fallback : formatMoney(parsed)
}

function DetailField({ label, value, onSave, type = 'text', rows, placeholder, readOnly = false, inputMode }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editing) setDraft(value ?? '')
  }, [editing, value])

  const cancel = useCallback(() => {
    setEditing(false)
    setDraft(value ?? '')
  }, [value])

  const save = useCallback(async () => {
    if ((draft ?? '') === (value ?? '')) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onSave(draft === '' ? null : draft)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }, [draft, onSave, value])

  const inputClass = 'w-full rounded-2xl border border-brand-accent/30 bg-white px-3 py-2 text-sm text-dark-text outline-none transition-colors focus:border-brand-accent'

  if (readOnly) {
    return (
      <div className="auto-quote-field is-readonly">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">{label}</p>
        <p className="mt-2 text-sm text-dark-text">{value || '—'}</p>
      </div>
    )
  }

  return (
    <div className="auto-quote-field group">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">{label}</p>
      {editing ? (
        <div className="mt-2 flex items-start gap-2">
          {rows ? (
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={rows}
              placeholder={placeholder}
              className={`${inputClass} min-h-[44px] resize-none`}
            />
          ) : (
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              type={type}
              inputMode={inputMode}
              placeholder={placeholder}
              className={inputClass}
            />
          )}
          <button
            type="button"
            onClick={() => { void save().catch(() => {}) }}
            disabled={saving}
            className="rounded-xl bg-status-success/15 p-2 text-status-success transition-colors hover:bg-status-success/25 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={cancel}
            className="rounded-xl border border-dark-border/70 p-2 text-dark-muted transition-colors hover:text-dark-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(value ?? '')
            setEditing(true)
          }}
          className="mt-2 flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="min-w-0 truncate text-sm text-dark-text">{value || '—'}</span>
          <Pencil className="h-3.5 w-3.5 shrink-0 text-dark-muted/50 opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      )}
    </div>
  )
}

function DetailSelect({ label, value, onSave, options }) {
  const [editing, setEditing] = useState(false)

  return (
    <div className="auto-quote-field group">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">{label}</p>
      {editing ? (
        <div className="mt-2 flex items-center gap-2">
          <select
            value={value || ''}
            onChange={async e => {
              try {
                await onSave(e.target.value || null)
                setEditing(false)
              } catch {
                // Keep field open on failure.
              }
            }}
            className="select flex-1"
          >
            {options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-xl border border-dark-border/70 p-2 text-dark-muted transition-colors hover:text-dark-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-2 flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="min-w-0 truncate text-sm text-dark-text">{options.find(opt => opt.value === value)?.label || value || '—'}</span>
          <Pencil className="h-3.5 w-3.5 shrink-0 text-dark-muted/50 opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      )}
    </div>
  )
}

const STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'convertida', label: 'Convertida' },
  { value: 'perdida', label: 'Perdida' },
]

const TIPO_OPTIONS = [
  { value: 'novo', label: 'Seguro novo' },
  { value: 'renovacao', label: 'Renovacao' },
]

const DETAIL_TABS = [
  { value: 'resumo', label: 'Resumo', icon: Gauge },
  { value: 'segurado', label: 'Segurado', icon: UserRound },
  { value: 'risco', label: 'Veículo e risco', icon: Car },
  { value: 'seguradoras', label: 'Orçamentos', icon: ShieldCheck },
  { value: 'operacao', label: 'Operação', icon: Activity },
]

function SummaryGrid({ cotacao }) {
  return (
    <DataCard className="overflow-hidden border-brand-secondary/10" bodyClassName="p-0">
      <div className="grid gap-0 lg:grid-cols-4">
        <div className="border-b border-dark-border/60 p-5 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Status</p>
            <CalendarDays className="h-5 w-5 text-status-info/40" />
          </div>
          <p className="text-2xl font-semibold text-dark-text">{COTACAO_STATUS[cotacao.status]?.label || cotacao.status || '—'}</p>
          <p className="mt-2 text-xs text-dark-muted">estado atual da cotacao</p>
        </div>
        <div className="border-b border-dark-border/60 p-5 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Produto</p>
            <ShieldCheck className="h-5 w-5 text-status-info/40" />
          </div>
          <p className="text-2xl font-semibold text-dark-text">Seguro Auto</p>
          <p className="mt-2 text-xs text-dark-muted">{cotacao.tipo === 'renovacao' ? 'renovacao' : 'novo negocio'}</p>
        </div>
        <div className="border-b border-dark-border/60 p-5 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Segurado</p>
            <UserRound className="h-5 w-5 text-status-info/40" />
          </div>
          <p className="text-2xl font-semibold text-dark-text">{cotacao.nome_cliente || cotacao.cpf_cliente || 'Nao informado'}</p>
          <p className="mt-2 text-xs text-dark-muted">{cotacao.cpf_cliente || 'CPF pendente'}</p>
        </div>
        <div className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Recebida em</p>
            <Car className="h-5 w-5 text-status-info/40" />
          </div>
          <p className="text-2xl font-semibold text-dark-text">{formatDateTimeBR(cotacao.created_at) || '—'}</p>
          <p className="mt-2 text-xs text-dark-muted">entrada original</p>
        </div>
      </div>
    </DataCard>
  )
}

function HistoricoCotacao({ cotacao }) {
  return (
    <DataCard title="Historico" subtitle="Linha do tempo da cotacao">
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="mt-1 h-2.5 w-2.5 rounded-full bg-brand-accent" />
            <div className="mt-1.5 w-px flex-1 bg-dark-border" />
          </div>
          <div className="pb-1">
            <p className="text-sm font-medium text-dark-text">Cotacao recebida</p>
            <p className="text-xs text-dark-muted">{formatDateTimeBR(cotacao.created_at) || 'Sem data'}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex flex-col items-center flex-shrink-0">
            <div className={`mt-1 h-2.5 w-2.5 rounded-full ${cotacao.status === 'perdida' ? 'bg-status-danger' : 'bg-status-success'}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-dark-text">Status atual: {COTACAO_STATUS[cotacao.status]?.label || cotacao.status || '—'}</p>
            <p className="text-xs text-dark-muted">
              {cotacao.seguradora_preferencial?.nome || cotacao.seguradora_mais_barata?.nome
                ? 'Seguradoras ja vinculadas na cotacao.'
                : 'Aguardando definicao de seguradoras.'}
            </p>
          </div>
        </div>
      </div>
    </DataCard>
  )
}

export default function AutoCotacaoDetalhe() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [tab, setTab] = useState(() => new URLSearchParams(location.search).get('tab') || 'resumo')
  const [copied, setCopied] = useState('')
  const [opcoesFinanceirasComparativo, setOpcoesFinanceirasComparativo] = useState(null)
  const [extractedConflict, setExtractedConflict] = useState(null)

  const { data: cotacao, isLoading } = useQuery({
    queryKey: ['auto-cotacao', id],
    queryFn: () => getCotacaoAutoPorId(id),
    enabled: !!id,
  })

  const { mutateAsync: salvarCampo } = useMutation({
    mutationFn: async ({ field, value }) => atualizarCotacaoAuto(id, { [field]: value }),
    onSuccess: async () => {
      setActionError(null)
      await qc.invalidateQueries({ queryKey: ['auto-cotacao', id] })
      await qc.invalidateQueries({ queryKey: ['auto-cotacoes-todas'] })
      await qc.invalidateQueries({ queryKey: ['auto-cotacoes'] })
      await qc.invalidateQueries({ queryKey: ['auto-cotacoes-resumo'] })
      await qc.invalidateQueries({ queryKey: ['auto-dashboard-cotacoes-resumo'] })
    },
    onError: error => {
      setActionError(error?.message || 'Erro ao salvar a cotacao.')
    },
  })

  const { mutate: sincronizarOpcoesFinanceiras } = useMutation({
    mutationFn: patch => atualizarCotacaoAuto(id, patch),
    onSuccess: async () => {
      setActionError(null)
      await qc.invalidateQueries({ queryKey: ['auto-cotacao', id] })
      await qc.invalidateQueries({ queryKey: ['auto-cotacoes-todas'] })
      await qc.invalidateQueries({ queryKey: ['auto-cotacoes'] })
    },
    onError: error => {
      setActionError(error?.message || 'Erro ao sincronizar as seguradoras do comparativo.')
    },
  })
  // A segunda seguradora pode terminar a leitura antes do refetch causado pela
  // primeira. Este espelho incorpora imediatamente o que acabou de ser salvo,
  // evitando planejar a segunda sincronização contra uma cotação antiga.
  const cotacaoSyncRef = useRef(null)
  useEffect(() => {
    if (cotacao) cotacaoSyncRef.current = cotacao
  }, [cotacao])

  const { mutateAsync: sincronizarDadosExtraidos, isPending: sincronizandoDadosExtraidos } = useMutation({
    mutationFn: patch => sincronizarDadosExtraidosCotacaoAuto(id, patch),
    onSuccess: async data => {
      if (data) {
        cotacaoSyncRef.current = data
        qc.setQueryData(['auto-cotacao', id], data)
      }
      setActionError(data?.aviso_sincronizacao_cliente
        ? `Os dados foram salvos na cotação, mas o cadastro do cliente precisa de conferência: ${data.aviso_sincronizacao_cliente}`
        : null)
      await qc.invalidateQueries({ queryKey: ['auto-cotacao', id] })
      await qc.invalidateQueries({ queryKey: ['auto-cotacoes-todas'] })
      await qc.invalidateQueries({ queryKey: ['auto-cotacoes'] })
      await qc.invalidateQueries({ queryKey: ['auto-clientes-carteira'] })
      await qc.invalidateQueries({ queryKey: ['auto-emissoes'] })
    },
    onError: async error => {
      setActionError(error?.message || 'Erro ao sincronizar os dados extraídos do PDF.')
      await qc.invalidateQueries({ queryKey: ['auto-cotacao', id] })
    },
  })

  const handleExtractedClientData = useCallback(async ({ role, seguradora, fields }) => {
    const base = cotacaoSyncRef.current || cotacao
    if (!base || !fields) return
    const plan = planExtractedQuoteClientSync(base, fields)
    if (Object.keys(plan.automaticPatch).length) {
      // Atualiza a tela antes do round-trip e aguarda a persistência. Assim o
      // upload só aparece concluído quando CPF, veículo, CEP e risco realmente
      // chegaram à cotação — uma falha deixa de passar silenciosamente.
      cotacaoSyncRef.current = { ...base, ...plan.automaticPatch }
      qc.setQueryData(['auto-cotacao', id], current => current ? { ...current, ...plan.automaticPatch } : current)
      await sincronizarDadosExtraidos(plan.automaticPatch)
    }
    if (!plan.conflicts.length) return

    setExtractedConflict(current => {
      // A seguradora atual e a referencia principal. Se os dois PDFs forem
      // lidos quase juntos, ela vence uma divergencia concorrente ainda aberta.
      if (current?.role === 'atual' && role !== 'atual') return current
      return {
        role,
        seguradora,
        conflicts: plan.conflicts,
        choices: Object.fromEntries(plan.conflicts.map(item => [item.field, 'current'])),
      }
    })
  }, [cotacao, id, qc, sincronizarDadosExtraidos])

  const confirmarDadosExtraidos = useCallback(async () => {
    if (!extractedConflict) return
    const patch = Object.fromEntries(
      extractedConflict.conflicts
        .filter(item => extractedConflict.choices[item.field] === 'extracted')
        .map(item => [item.field, item.extracted]),
    )
    try {
      if (Object.keys(patch).length) await sincronizarDadosExtraidos(patch)
      setExtractedConflict(null)
    } catch {
      // A mutation já apresenta a mensagem e mantém o modal aberto para o
      // usuário tentar novamente sem perder as escolhas.
    }
  }, [extractedConflict, sincronizarDadosExtraidos])

  const { mutateAsync: excluir, isPending: deleting } = useMutation({
    mutationFn: () => deletarCotacaoAuto(id),
    onSuccess: async () => {
      setActionError(null)
      await qc.invalidateQueries({ queryKey: ['auto-cotacao', id] })
      await qc.invalidateQueries({ queryKey: ['auto-cotacoes-todas'] })
      await qc.invalidateQueries({ queryKey: ['auto-cotacoes'] })
      navigate('/auto/cotacoes')
    },
    onError: error => {
      setActionError(error?.message || 'Erro ao excluir a cotacao.')
    },
  })

  useEffect(() => {
    setConfirmDelete(false)
    setOpcoesFinanceirasComparativo(null)
  }, [id])

  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('tab')
    if (requested && DETAIL_TABS.some(item => item.value === requested)) setTab(requested)
  }, [location.search])

  const opcoesFinanceirasExibidas = useMemo(() => Object.fromEntries([
    'seguradora_preferencial',
    'seguradora_mais_barata',
  ].map(field => [
    field,
    opcoesFinanceirasComparativo && !opcoesFinanceirasComparativo[field]
      ? {}
      : mesclarOpcaoFinanceira(cotacao?.[field], opcoesFinanceirasComparativo?.[field]),
  ])), [cotacao, opcoesFinanceirasComparativo])

  useEffect(() => {
    if (!cotacao || !opcoesFinanceirasComparativo) return undefined

    const patch = {}
    for (const field of ['seguradora_preferencial', 'seguradora_mais_barata']) {
      const derivada = opcoesFinanceirasComparativo[field]
      if (!derivada?.nome || opcaoFinanceiraSincronizada(cotacao[field], derivada)) continue
      patch[field] = mesclarOpcaoFinanceira(cotacao[field], derivada)
    }
    if (!Object.keys(patch).length) return undefined

    const timer = window.setTimeout(() => sincronizarOpcoesFinanceiras(patch), 350)
    return () => window.clearTimeout(timer)
  }, [cotacao, opcoesFinanceirasComparativo, sincronizarOpcoesFinanceiras])

  // Volta para a tela de onde a cotacao foi aberta — Visao Geral, Pipeline,
  // ficha do cliente ou busca. A lista de cotacoes e so o ultimo recurso.
  const voltar = useVoltar('/auto/cotacoes')

  const metrics = useMemo(() => [
    { key: 'status', label: 'Status comercial', value: cotacao?.status ? (COTACAO_STATUS[cotacao.status]?.label || cotacao.status) : '—', hint: 'situação atual', tone: cotacao?.status === 'convertida' ? 'success' : cotacao?.status === 'perdida' ? 'danger' : 'warning', icon: Gauge },
    { key: 'tipo', label: 'Modalidade', value: cotacao?.tipo === 'renovacao' ? 'Renovação' : cotacao?.tipo === 'endosso' ? 'Endosso' : 'Seguro novo', hint: 'tipo de oportunidade', tone: cotacao?.tipo === 'renovacao' ? 'renewal' : 'new', icon: FileSearch },
    { key: 'veiculo', label: 'Veículo', value: cotacao?.modelo_veiculo || 'Não informado', hint: cotacao?.placa || 'placa pendente', tone: 'info', icon: Car },
    { key: 'seguradora', label: 'Melhor opção', value: cotacao?.seguradora_mais_barata?.nome || cotacao?.seguradora_preferencial?.nome || 'Em análise', hint: 'seguradora em destaque', tone: 'success', icon: ShieldCheck },
  ], [cotacao])

  const copyValue = useCallback(async (label, value) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(String(value))
      setCopied(label)
      window.setTimeout(() => setCopied(''), 1800)
    } catch {
      setActionError('Não foi possível copiar o dado automaticamente.')
    }
  }, [])
  if (isLoading) {
    return (
      <div className="auto-page auto-v2-page">
        <AutoLoading label="Carregando cotação..." />
      </div>
    )
  }

  if (!cotacao) {
    return (
      <EmptyState
        title="Cotacao nao encontrada"
        description="O registro pode ter sido removido ou o link esta incorreto."
        actions={(
          <button onClick={voltar} className="btn-secondary">
            Voltar
          </button>
        )}
      />
    )
  }

  return (
    <div className="auto-page auto-v2-page auto-quote-workspace">
      <AutoPageHeader
        context="Workspace de cotação"
        title={cotacao.nome_cliente || cotacao.cpf_cliente || 'Cotacao sem identificacao'}
        description={`${cotacao.modelo_veiculo || 'Veículo não informado'} · ${cotacao.placa || 'placa pendente'}`}
        onBack={voltar}
        backLabel="Voltar"
        meta={(
          <>
            <AutoTypeBadge type={cotacao.tipo} />
            <AutoBadge tone={cotacao.status === 'convertida' ? 'success' : cotacao.status === 'perdida' ? 'danger' : 'warning'}>
              {COTACAO_STATUS[cotacao.status]?.label || cotacao.status || 'Pendente'}
            </AutoBadge>
            {copied && <AutoBadge tone="success">{copied} copiado</AutoBadge>}
          </>
        )}
        actions={(
          <>
            {cotacao.status !== 'convertida' && (
              <button
                type="button"
                onClick={() => { void salvarCampo({ field: 'status', value: 'convertida' }).catch(() => {}) }}
                className="btn-primary inline-flex items-center gap-2"
              >
                <ClipboardCheck className="h-4 w-4" />
                Marcar convertida
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="auto-danger-action"
            >
              <Trash2 className="h-4 w-4" />
              <span>Excluir</span>
            </button>
          </>
        )}
      />

      <AutoStatStrip items={metrics} />

      <AutoTabs items={DETAIL_TABS} value={tab} onChange={setTab} ariaLabel="Áreas da cotação" />

      {tab === 'resumo' && <SummaryGrid cotacao={cotacao} />}

      {actionError && (
        <div className="rounded-2xl border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
          {actionError}
        </div>
      )}

      <div className={tab === 'resumo' ? 'grid gap-4 xl:grid-cols-[1.65fr_0.95fr]' : 'grid gap-4 xl:grid-cols-2'}>
        <div className={tab === 'resumo' ? 'space-y-4' : 'contents'}>
          <DataCard className={tab === 'resumo' ? '' : 'hidden'} title="Cotação completa" subtitle="Todas as informações recebidas e preenchidas, sem abrir outra tela">
            <AutoQuoteSnapshot quote={cotacao} />
          </DataCard>
          <DataCard className={tab === 'segurado' ? '' : 'hidden'} title="Identificação" subtitle="Nome do segurado e dados do lead">
            <div className="grid gap-3 md:grid-cols-2">
              <DetailField label={<span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" /> Nome do segurado</span>} value={cotacao.nome_cliente} onSave={value => salvarCampo({ field: 'nome_cliente', value })} />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" /> CPF do segurado</span>} value={cotacao.cpf_cliente} onSave={value => salvarCampo({ field: 'cpf_cliente', value })} />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Celular</span>} value={cotacao.celular_cliente} onSave={value => salvarCampo({ field: 'celular_cliente', value })} />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> E-mail</span>} value={cotacao.email_cliente} onSave={value => salvarCampo({ field: 'email_cliente', value })} />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Vigência início</span>} value={cotacao.vigencia_inicio} onSave={value => salvarCampo({ field: 'vigencia_inicio', value })} type="date" />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Vigência fim</span>} value={cotacao.vigencia_fim} onSave={value => salvarCampo({ field: 'vigencia_fim', value })} type="date" />
            </div>
          </DataCard>

          <DataCard className={tab === 'segurado' ? '' : 'hidden'} title="Condutor" subtitle="Dados do condutor principal">
            <div className="grid gap-3 md:grid-cols-2">
              <DetailField label={<span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" /> Nome do condutor</span>} value={cotacao.condutor_nome} onSave={value => salvarCampo({ field: 'condutor_nome', value })} />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" /> CPF do condutor</span>} value={cotacao.condutor_cpf} onSave={value => salvarCampo({ field: 'condutor_cpf', value })} />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><Heart className="h-3.5 w-3.5" /> Estado civil</span>} value={cotacao.estado_civil_condutor} onSave={value => salvarCampo({ field: 'estado_civil_condutor', value })} />
            </div>
          </DataCard>

          <DataCard className={tab === 'risco' ? 'xl:col-span-2' : 'hidden'} title="Veículo e risco" subtitle="Informações usadas na análise e precificação">
            <div className="grid gap-3 md:grid-cols-2">
              <DetailField label={<span className="inline-flex items-center gap-1.5"><Car className="h-3.5 w-3.5" /> Modelo do veiculo</span>} value={cotacao.modelo_veiculo} onSave={value => salvarCampo({ field: 'modelo_veiculo', value })} />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><Car className="h-3.5 w-3.5" /> Placa</span>} value={cotacao.placa} onSave={value => salvarCampo({ field: 'placa', value })} />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><Car className="h-3.5 w-3.5" /> Uso do veiculo</span>} value={cotacao.uso_veiculo} onSave={value => salvarCampo({ field: 'uso_veiculo', value })} />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><Car className="h-3.5 w-3.5" /> Tipo de residência</span>} value={valorFormularioAuto(cotacao, 'tipo_residencia')} readOnly />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Passagem por leilão</span>} value={valorFormularioAuto(cotacao, 'passagem_leilao')} readOnly />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><Car className="h-3.5 w-3.5" /> Veiculo financiado</span>} value={cotacao.veiculo_financiado} onSave={value => salvarCampo({ field: 'veiculo_financiado', value })} />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> CEP pernoite</span>} value={cotacao.cep_pernoite} onSave={value => salvarCampo({ field: 'cep_pernoite', value })} />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Garagem residencia</span>} value={cotacao.garagem_residencia} onSave={value => salvarCampo({ field: 'garagem_residencia', value })} />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Garagem trabalho</span>} value={cotacao.garagem_trabalho} onSave={value => salvarCampo({ field: 'garagem_trabalho', value })} />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Garagem estudo</span>} value={cotacao.garagem_estudo} onSave={value => salvarCampo({ field: 'garagem_estudo', value })} />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" /> Jovens 18-26</span>} value={cotacao.jovens_18_26} onSave={value => salvarCampo({ field: 'jovens_18_26', value })} />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Possui kit gas</span>} value={cotacao.possui_kit_gas} onSave={value => salvarCampo({ field: 'possui_kit_gas', value })} />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Possui blindagem</span>} value={cotacao.possui_blindagem} onSave={value => salvarCampo({ field: 'possui_blindagem', value })} />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Isento imposto</span>} value={cotacao.isento_imposto} onSave={value => salvarCampo({ field: 'isento_imposto', value })} />
            </div>
          </DataCard>

          <DataCard className={tab === 'seguradoras' ? 'xl:col-span-2 auto-comparison-card' : 'hidden'} title="Orçamentos da cotação" subtitle="Dois PDFs, revisão obrigatória e dados prontos para o comparativo final">
            <AutoQuoteComparison
              key={cotacao.id}
              quote={cotacao}
              onFinancialOptionsChange={setOpcoesFinanceirasComparativo}
              onExtractedClientData={handleExtractedClientData}
            />
            <div className="auto-comparison-manual-divider"><span>Fechamento financeiro</span></div>
            <div className="grid gap-4 lg:grid-cols-2">
              {[
                { key: 'seguradora_preferencial', title: 'Seguradora preferencial', badge: 'Seguradora atual' },
                { key: 'seguradora_mais_barata', title: 'Seguradora mais barata', badge: 'Menor prêmio total' },
              ].map(section => (
                <div key={section.key} className="overflow-hidden rounded-3xl border border-dark-border/60 bg-white shadow-[0_16px_40px_rgba(15,42,78,0.06)]">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dark-border/50 bg-gradient-to-br from-brand-accent/[0.08] via-white to-white p-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-dark-muted">{section.title}</p>
                      <div className="mt-2 flex min-h-9 items-center text-dark-text">
                        {opcoesFinanceirasExibidas[section.key]?.nome
                          ? <SeguradoraBadge nome={opcoesFinanceirasExibidas[section.key].nome} size="lg" className="font-semibold" />
                          : <strong className="text-base">Aguardando comparação</strong>}
                      </div>
                    </div>
                    <span className="rounded-full border border-[#cbd9ff] bg-[#edf2ff] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#315dc5]">{section.badge}</span>
                  </div>
                  <div className="grid gap-3 p-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-brand-accent/15 bg-brand-accent/[0.05] p-4 sm:col-span-2">
                      <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted"><BadgeDollarSign className="h-3.5 w-3.5" /> Prêmio total do orçamento</p>
                      <p className="mt-2 text-xl font-semibold text-dark-text">{formatMoneyOptional(opcoesFinanceirasExibidas[section.key]?.premio_total)}</p>
                      <p className="mt-1 text-xs text-dark-muted">Preenchido automaticamente pela comparação revisada acima.</p>
                    </div>
                    <DetailField
                      label={<span className="inline-flex items-center gap-1.5"><BadgeDollarSign className="h-3.5 w-3.5" /> Prêmio líquido</span>}
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={formatDecimalBRInput(opcoesFinanceirasExibidas[section.key]?.premio_liquido)}
                      onSave={value => salvarCampo({
                        field: section.key,
                        value: {
                          ...opcoesFinanceirasExibidas[section.key],
                          premio_liquido: value === null ? null : parseDecimalBR(value),
                        },
                      })}
                    />
                    <DetailField
                      label={<span className="inline-flex items-center gap-1.5"><BadgeDollarSign className="h-3.5 w-3.5" /> % Comissão</span>}
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={formatDecimalBRInput(opcoesFinanceirasExibidas[section.key]?.pct_comissao)}
                      onSave={value => salvarCampo({
                        field: section.key,
                        value: {
                          ...opcoesFinanceirasExibidas[section.key],
                          pct_comissao: value === null ? null : parseDecimalBR(value),
                        },
                      })}
                    />
                    <DetailField
                      label={<span className="inline-flex items-center gap-1.5"><BadgeDollarSign className="h-3.5 w-3.5" /> Comissão ano passado</span>}
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={formatDecimalBRInput(opcoesFinanceirasExibidas[section.key]?.comissao_ano_passado)}
                      onSave={value => salvarCampo({
                        field: section.key,
                        value: {
                          ...opcoesFinanceirasExibidas[section.key],
                          comissao_ano_passado: value === null ? null : parseDecimalBR(value),
                        },
                      })}
                    />
                    <div className="rounded-2xl border border-brand-accent/15 bg-brand-accent/[0.05] p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Comissão estimada</p>
                      <p className="mt-2 text-sm font-semibold text-dark-text">
                        {formatMoney(calcularValorComissaoAuto(opcoesFinanceirasExibidas[section.key]?.premio_liquido, opcoesFinanceirasExibidas[section.key]?.pct_comissao))}
                      </p>
                      {Number(opcoesFinanceirasExibidas[section.key]?.comissao_ano_passado) > 0 && (
                        <p className="mt-1 text-xs text-dark-muted">
                          {(() => {
                            const atual = calcularValorComissaoAuto(opcoesFinanceirasExibidas[section.key]?.premio_liquido, opcoesFinanceirasExibidas[section.key]?.pct_comissao)
                            const anterior = Number(opcoesFinanceirasExibidas[section.key].comissao_ano_passado)
                            const diferenca = atual - anterior
                            const sinal = diferenca > 0 ? '+' : ''
                            return `vs. ano passado (${formatMoney(anterior)}): ${sinal}${formatMoney(diferenca)}`
                          })()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </DataCard>
        </div>

        <div className={tab === 'resumo' ? 'space-y-4' : 'contents'}>
          <div className={tab === 'operacao' ? 'xl:col-span-2' : 'hidden'}>
            <AutoWorkflowPanel cotacao={cotacao} />
          </div>
          <DataCard className={tab === 'operacao' ? '' : 'hidden'} title="Informações" subtitle="Dados técnicos e operacionais">
            <div className="grid gap-3">
              <DetailField label={<span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> ID</span>} value={cotacao.id} readOnly />
              <DetailSelect label={<span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Status</span>} value={cotacao.status} onSave={value => salvarCampo({ field: 'status', value })} options={STATUS_OPTIONS} />
              <DetailSelect label={<span className="inline-flex items-center gap-1.5"><Car className="h-3.5 w-3.5" /> Tipo</span>} value={cotacao.tipo} onSave={value => salvarCampo({ field: 'tipo', value })} options={TIPO_OPTIONS} />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" /> Origem do lead</span>} value={cotacao.origem_lead} onSave={value => salvarCampo({ field: 'origem_lead', value })} />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Criado em</span>} value={formatDateTimeBR(cotacao.created_at)} readOnly />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Atualizado em</span>} value={formatDateTimeBR(cotacao.updated_at)} readOnly />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" /> ID do cliente</span>} value={cotacao.cliente_id} readOnly />
            </div>
          </DataCard>

          <DataCard className={tab === 'resumo' ? '' : 'hidden'} title="Ações rápidas" subtitle="Contate ou reutilize os dados sem sair da cotação">
            <div className="auto-quote-quick-actions">
              <a
                href={cotacao.celular_cliente ? `tel:${String(cotacao.celular_cliente).replace(/\D/g, '')}` : undefined}
                aria-disabled={!cotacao.celular_cliente}
                className={!cotacao.celular_cliente ? 'is-disabled' : ''}
              >
                <Phone aria-hidden="true" />
                <span><strong>Ligar para o cliente</strong><small>{cotacao.celular_cliente || 'Celular pendente'}</small></span>
              </a>
              <a
                href={cotacao.email_cliente ? `mailto:${cotacao.email_cliente}` : undefined}
                aria-disabled={!cotacao.email_cliente}
                className={!cotacao.email_cliente ? 'is-disabled' : ''}
              >
                <Mail aria-hidden="true" />
                <span><strong>Enviar e-mail</strong><small>{cotacao.email_cliente || 'E-mail pendente'}</small></span>
              </a>
              <button type="button" onClick={() => copyValue('CPF', cotacao.cpf_cliente)} disabled={!cotacao.cpf_cliente}>
                <Copy aria-hidden="true" />
                <span><strong>Copiar CPF</strong><small>{cotacao.cpf_cliente || 'CPF pendente'}</small></span>
              </button>
              <button type="button" onClick={() => copyValue('Placa', cotacao.placa)} disabled={!cotacao.placa}>
                <Copy aria-hidden="true" />
                <span><strong>Copiar placa</strong><small>{cotacao.placa || 'Placa pendente'}</small></span>
              </button>
            </div>
          </DataCard>

          <div className={tab === 'operacao' ? '' : 'hidden'}>
            <HistoricoCotacao cotacao={cotacao} />
          </div>

          <DataCard className={tab === 'resumo' ? '' : 'hidden'} title="Próxima decisão" subtitle="Atualize o andamento com um clique">
            <div className="space-y-3">
              <QuoteStatusBadge status={cotacao.status} />
              <p className="text-sm text-dark-muted">
                {cotacao.status === 'pendente'
                  ? 'Cotacao aguardando andamento comercial.'
                  : cotacao.status === 'convertida'
                    ? 'Cotacao marcada como convertida.'
                    : 'Cotacao marcada como perdida.'}
              </p>
              <div className="auto-quote-status-actions">
                {STATUS_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => { void salvarCampo({ field: 'status', value: option.value }).catch(() => {}) }}
                    className={cotacao.status === option.value ? 'is-active' : ''}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </DataCard>
        </div>
      </div>

      {extractedConflict && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center px-4 py-6">
          <div className="modal-backdrop" onClick={() => setExtractedConflict(null)} />
          <section className="relative z-10 max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-[28px] border border-dark-border/70 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="auto-extracted-conflict-title">
            <header className="flex items-start gap-4 border-b border-dark-border/60 bg-gradient-to-br from-status-warning/10 via-white to-brand-accent/5 p-5 md:p-6">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-status-warning/15 text-status-warning"><AlertTriangle className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-status-warning">Dados diferentes encontrados</p>
                <h2 id="auto-extracted-conflict-title" className="mt-1 text-xl font-semibold text-dark-text">O PDF trouxe informações diferentes do cadastro</h2>
                <p className="mt-1 text-sm text-dark-muted">Escolha campo a campo o que deve permanecer. Nada será substituído sem sua confirmação{extractedConflict.seguradora ? ` · leitura ${extractedConflict.seguradora}` : ''}.</p>
              </div>
              <button type="button" onClick={() => setExtractedConflict(null)} className="rounded-full p-2 text-dark-muted transition-colors hover:bg-dark-border/40" aria-label="Fechar"><X className="h-5 w-5" /></button>
            </header>

            <div className="max-h-[58vh] space-y-3 overflow-y-auto p-5 md:p-6">
              {extractedConflict.conflicts.map(item => (
                <article key={item.field} className="rounded-2xl border border-dark-border/70 bg-dark-surface2/25 p-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">{item.label}</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {[
                      { value: 'current', eyebrow: 'Manter cadastro atual', content: item.current },
                      { value: 'extracted', eyebrow: 'Usar informação do PDF', content: item.extracted },
                    ].map(option => {
                      const selected = extractedConflict.choices[item.field] === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setExtractedConflict(current => ({ ...current, choices: { ...current.choices, [item.field]: option.value } }))}
                          className={`flex min-h-20 items-start gap-3 rounded-xl border p-3 text-left transition-colors ${selected ? 'border-brand-accent bg-brand-accent/8' : 'border-dark-border bg-white hover:border-brand-accent/35'}`}
                        >
                          <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${selected ? 'border-brand-accent bg-brand-accent text-white' : 'border-dark-border text-transparent'}`}><Check className="h-3 w-3" /></span>
                          <span className="min-w-0"><small className="block text-[9px] font-semibold uppercase tracking-[0.12em] text-dark-muted">{option.eyebrow}</small><strong className="mt-1 block break-words text-sm text-dark-text">{option.content}</strong></span>
                        </button>
                      )
                    })}
                  </div>
                </article>
              ))}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-dark-border/60 bg-dark-surface2/35 px-5 py-4 md:px-6">
              <p className="text-xs text-dark-muted">Campos vazios já foram preenchidos automaticamente.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setExtractedConflict(null)} className="btn-secondary">Cancelar</button>
                <button type="button" onClick={confirmarDadosExtraidos} disabled={sincronizandoDadosExtraidos} className="btn-primary disabled:opacity-50">{sincronizandoDadosExtraidos ? 'Salvando…' : 'Confirmar escolhas'}</button>
              </div>
            </footer>
          </section>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
          <div className="modal-backdrop" onClick={() => setConfirmDelete(false)} />
          <div className="relative z-10 w-full max-w-md rounded-3xl border border-dark-border/70 bg-white p-6">
            <p className="text-lg font-semibold text-dark-text">Excluir cotacao?</p>
            <p className="mt-2 text-sm text-dark-muted">
              Essa acao remove o registro e nao pode ser desfeita.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary">
                Cancelar
              </button>
              <button
                onClick={() => { void excluir().catch(() => {}) }}
                disabled={deleting}
                className="rounded-2xl bg-status-danger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              >
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
