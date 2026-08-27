import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, BadgeDollarSign, CalendarDays, Car, Check, ClipboardCheck, Copy, FileSearch, Gauge, Pencil, ShieldCheck, UserRound, X, Mail, Heart, Phone, Trash2 } from 'lucide-react'
import { DataCard, EmptyState } from '../../components/ui'
import {
  AutoBadge,
  AutoLoading,
  AutoPageHeader,
  AutoPdfAutomation,
  AutoQuoteComparison,
  AutoQuoteSnapshot,
  AutoStatStrip,
  AutoTabs,
  AutoTypeBadge,
  AutoWorkflowPanel,
} from '../../components/auto'
import SeguradoraSelect from '../../components/SeguradoraSelect'
import { calcularValorComissaoAuto, deletarCotacaoAuto, getCotacaoAutoPorId, atualizarCotacaoAuto } from '../../lib/auto'
import { COTACAO_STATUS, formatDateTimeBR, formatMoney, toneClasses } from './autoShared'
import { formatDecimalBRInput, parseDecimalBR } from '../../lib/numberInput'
import { parseOrcamentoAuto } from '../../lib/autoPdfParser.js'
import { valorFormularioAuto } from '../../lib/autoFormPayload'
import { useVoltar } from '../../hooks/useVoltar.js'

function QuoteStatusBadge({ status }) {
  const meta = COTACAO_STATUS[status] || COTACAO_STATUS.aberta
  return <span className={`badge ${toneClasses(meta.tone)}`}>{meta.label}</span>
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
  const [pdfFile, setPdfFile] = useState(null)
  const [pdfStatus, setPdfStatus] = useState('idle')
  const [pdfResult, setPdfResult] = useState(null)
  const [pdfError, setPdfError] = useState('')
  const [pdfApplied, setPdfApplied] = useState(false)

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

  const { mutateAsync: salvarSeguradora } = useMutation({
    mutationFn: async ({ field, value }) => {
      const atual = cotacao?.[field] || {}
      return atualizarCotacaoAuto(id, {
        [field]: {
          ...atual,
          nome: value || null,
        },
      })
    },
    onSuccess: async () => {
      setActionError(null)
      await qc.invalidateQueries({ queryKey: ['auto-cotacao', id] })
      await qc.invalidateQueries({ queryKey: ['auto-cotacoes-todas'] })
      await qc.invalidateQueries({ queryKey: ['auto-cotacoes'] })
    },
    onError: error => {
      setActionError(error?.message || 'Erro ao salvar a seguradora.')
    },
  })

  const { mutateAsync: aplicarPdf } = useMutation({
    mutationFn: async () => {
      const campos = pdfResult?.campos || {}
      const cotada = pdfResult?.seguradora_cotada || {}
      const patch = Object.entries(campos).reduce((next, [field, value]) => {
        if (value !== null && value !== '') next[field] = value
        return next
      }, {})
      if (Object.values(cotada).some(value => value !== null && value !== '')) {
        patch.seguradora_preferencial = {
          ...(cotacao?.seguradora_preferencial || {}),
          ...cotada,
          premio_total: cotada.valor_total || cotacao?.seguradora_preferencial?.premio_total || null,
        }
      }
      return atualizarCotacaoAuto(id, patch)
    },
    onSuccess: async () => {
      setPdfApplied(true)
      setActionError(null)
      await qc.invalidateQueries({ queryKey: ['auto-cotacao', id] })
      await qc.invalidateQueries({ queryKey: ['auto-cotacoes-todas'] })
      await qc.invalidateQueries({ queryKey: ['auto-cotacoes'] })
      await qc.invalidateQueries({ queryKey: ['auto-emissoes'] })
    },
    onError: error => setActionError(error?.message || 'Erro ao aplicar os dados do PDF.'),
  })

  async function handlePdf(file) {
    setPdfFile(file)
    setPdfResult(null)
    setPdfError('')
    setPdfApplied(false)
    if (!file) {
      setPdfStatus('idle')
      return
    }
    const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      setPdfStatus('attached')
      return
    }
    setPdfStatus('reading')
    try {
      setPdfResult(await parseOrcamentoAuto(file))
      setPdfStatus('ready')
    } catch (error) {
      setPdfError(error?.message || 'O conteúdo do orçamento não pôde ser extraído.')
      setPdfStatus('error')
    }
  }

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
  }, [id])

  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('tab')
    if (requested && DETAIL_TABS.some(item => item.value === requested)) setTab(requested)
  }, [location.search])

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
            <AutoQuoteComparison key={cotacao.id} quote={cotacao} />
            <div className="auto-comparison-manual-divider"><span>Leitura atual preservada</span></div>
            <div className="auto-comparison-legacy-tool">
              <AutoPdfAutomation
                mode="orcamento" file={pdfFile} status={pdfStatus} result={pdfResult} error={pdfError} applied={pdfApplied}
                onFile={handlePdf} onApply={() => { void aplicarPdf().catch(() => {}) }}
                onClear={() => { setPdfFile(null); setPdfStatus('idle'); setPdfResult(null); setPdfError(''); setPdfApplied(false) }}
              />
            </div>
            <div className="auto-comparison-manual-divider"><span>Ajustes financeiros rápidos</span></div>
            <div className="grid gap-4 lg:grid-cols-2">
              {[
                { key: 'seguradora_preferencial', title: 'Seguradora preferencial' },
                { key: 'seguradora_mais_barata', title: 'Seguradora mais barata' },
              ].map(section => (
                <div key={section.key} className="space-y-3 rounded-3xl border border-dark-border/60 bg-dark-surface2/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dark-muted">{section.title}</p>
                    <button
                      type="button"
                      onClick={() => { void salvarSeguradora({ field: section.key, value: '' }).catch(() => {}) }}
                      className="text-xs text-dark-muted transition-colors hover:text-dark-text"
                    >
                      Limpar
                    </button>
                  </div>
                  <SeguradoraSelect
                    value={cotacao?.[section.key]?.nome || ''}
                    onChange={value => { void salvarSeguradora({ field: section.key, value }).catch(() => {}) }}
                    produto="auto"
                    placeholder="Selecionar seguradora"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailField
                      label={<span className="inline-flex items-center gap-1.5"><BadgeDollarSign className="h-3.5 w-3.5" /> Premio total</span>}
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={formatDecimalBRInput(cotacao?.[section.key]?.premio_total)}
                      onSave={value => salvarCampo({
                        field: section.key,
                        value: {
                          ...(cotacao?.[section.key] || {}),
                          premio_total: value === null ? null : parseDecimalBR(value),
                        },
                      })}
                    />
                    <DetailField
                      label={<span className="inline-flex items-center gap-1.5"><BadgeDollarSign className="h-3.5 w-3.5" /> Premio liquido</span>}
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={formatDecimalBRInput(cotacao?.[section.key]?.premio_liquido)}
                      onSave={value => salvarCampo({
                        field: section.key,
                        value: {
                          ...(cotacao?.[section.key] || {}),
                          premio_liquido: value === null ? null : parseDecimalBR(value),
                        },
                      })}
                    />
                    <DetailField
                      label={<span className="inline-flex items-center gap-1.5"><BadgeDollarSign className="h-3.5 w-3.5" /> % Comissao</span>}
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={formatDecimalBRInput(cotacao?.[section.key]?.pct_comissao)}
                      onSave={value => salvarCampo({
                        field: section.key,
                        value: {
                          ...(cotacao?.[section.key] || {}),
                          pct_comissao: value === null ? null : parseDecimalBR(value),
                        },
                      })}
                    />
                    <DetailField
                      label={<span className="inline-flex items-center gap-1.5"><BadgeDollarSign className="h-3.5 w-3.5" /> Comissao ano passado</span>}
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={formatDecimalBRInput(cotacao?.[section.key]?.comissao_ano_passado)}
                      onSave={value => salvarCampo({
                        field: section.key,
                        value: {
                          ...(cotacao?.[section.key] || {}),
                          comissao_ano_passado: value === null ? null : parseDecimalBR(value),
                        },
                      })}
                    />
                    <div className="rounded-2xl border border-brand-accent/15 bg-brand-accent/6 p-4 sm:col-span-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Comissao estimada</p>
                      <p className="mt-2 text-sm font-semibold text-dark-text">
                        {formatMoney(calcularValorComissaoAuto(cotacao?.[section.key]?.premio_liquido, cotacao?.[section.key]?.pct_comissao))}
                      </p>
                      {Number(cotacao?.[section.key]?.comissao_ano_passado) > 0 && (
                        <p className="mt-1 text-xs text-dark-muted">
                          {(() => {
                            const atual = calcularValorComissaoAuto(cotacao?.[section.key]?.premio_liquido, cotacao?.[section.key]?.pct_comissao)
                            const anterior = Number(cotacao[section.key].comissao_ano_passado)
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
