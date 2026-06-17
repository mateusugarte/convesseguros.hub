import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BadgeDollarSign, CalendarDays, Car, Check, Pencil, ShieldCheck, UserRound, X, Mail, Heart, Phone } from 'lucide-react'
import { DataCard, EmptyState, MetricCard, PageHeader } from '../../components/ui'
import SeguradoraSelect from '../../components/SeguradoraSelect'
import { deletarCotacaoAuto, getCotacaoAutoPorId, atualizarCotacaoAuto } from '../../lib/auto'
import { COTACAO_STATUS, formatDateTimeBR, formatMoney, toneClasses } from './autoShared'

function QuoteStatusBadge({ status }) {
  const meta = COTACAO_STATUS[status] || COTACAO_STATUS.aberta
  return <span className={`badge ${toneClasses(meta.tone)}`}>{meta.label}</span>
}

function DetailField({ label, value, onSave, type = 'text', rows, placeholder, readOnly = false }) {
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
      <div className="rounded-2xl border border-dark-border/60 bg-white/70 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">{label}</p>
        <p className="mt-2 text-sm text-dark-text">{value || '—'}</p>
      </div>
    )
  }

  return (
    <div className="group rounded-2xl border border-dark-border/60 bg-white/70 p-4">
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
    <div className="group rounded-2xl border border-dark-border/60 bg-white/70 p-4">
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

function SummaryGrid({ cotacao }) {
  return (
    <DataCard className="overflow-hidden border-brand-secondary/10" bodyClassName="p-0">
      <div className="grid gap-0 lg:grid-cols-4">
        <div className="border-b border-dark-border/60 p-5 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Status</p>
            <CalendarDays className="h-5 w-5 text-brand-accent/40" />
          </div>
          <p className="text-2xl font-semibold text-dark-text">{COTACAO_STATUS[cotacao.status]?.label || cotacao.status || '—'}</p>
          <p className="mt-2 text-xs text-dark-muted">estado atual da cotacao</p>
        </div>
        <div className="border-b border-dark-border/60 p-5 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Produto</p>
            <ShieldCheck className="h-5 w-5 text-brand-accent/40" />
          </div>
          <p className="text-2xl font-semibold text-dark-text">Seguro Auto</p>
          <p className="mt-2 text-xs text-dark-muted">{cotacao.tipo === 'renovacao' ? 'renovacao' : 'novo negocio'}</p>
        </div>
        <div className="border-b border-dark-border/60 p-5 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Segurado</p>
            <UserRound className="h-5 w-5 text-brand-accent/40" />
          </div>
          <p className="text-2xl font-semibold text-dark-text">{cotacao.nome_cliente || cotacao.cpf_cliente || 'Nao informado'}</p>
          <p className="mt-2 text-xs text-dark-muted">{cotacao.cpf_cliente || 'CPF pendente'}</p>
        </div>
        <div className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Recebida em</p>
            <Car className="h-5 w-5 text-brand-accent/40" />
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

  const backTo = location.state?.from || '/auto/cotacoes'

  const metrics = useMemo(() => [
    { key: 'status', label: 'Status', value: cotacao?.status ? (COTACAO_STATUS[cotacao.status]?.label || cotacao.status) : '—', tone: 'accent' },
    { key: 'tipo', label: 'Tipo', value: cotacao?.tipo === 'renovacao' ? 'Renovacao' : 'Seguro novo', tone: 'secondary' },
    { key: 'cliente', label: 'Cliente', value: cotacao?.nome_cliente || cotacao?.cpf_cliente || 'Sem nome', tone: 'success' },
    { key: 'celular', label: 'Celular', value: cotacao?.celular_cliente || '—', tone: 'warning' },
  ], [cotacao])

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-dark-muted">
        <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Carregando cotacao...
      </div>
    )
  }

  if (!cotacao) {
    return (
      <EmptyState
        title="Cotacao nao encontrada"
        description="O registro pode ter sido removido ou o link esta incorreto."
        actions={(
          <button onClick={() => navigate(backTo)} className="btn-secondary">
            Voltar
          </button>
        )}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-start">
        <button onClick={() => navigate(backTo)} className="btn-secondary">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
      </div>

      <PageHeader
        eyebrow="Seguro Auto"
        title={cotacao.nome_cliente || cotacao.cpf_cliente || 'Cotacao sem identificacao'}
        description="Area dedicada da cotacao, com leitura completa dos dados, edicao direta e apoio ao fluxo operacional."
        actions={(
          <>
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-2xl border border-status-danger/30 px-3 py-2 text-sm font-medium text-status-danger transition-colors hover:bg-status-danger/10"
            >
              Excluir
            </button>
          </>
        )}
        stats={metrics.map(({ key, label, value, tone }) => (
          <MetricCard key={key} label={label} value={value} tone={tone} />
        ))}
      />

      <SummaryGrid cotacao={cotacao} />

      {actionError && (
        <div className="rounded-2xl border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
          {actionError}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.65fr_0.95fr]">
        <div className="space-y-4">
          <DataCard title="Identificação" subtitle="Nome do segurado e dados do lead">
            <div className="grid gap-3 md:grid-cols-2">
              <DetailField label={<span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" /> Nome do segurado</span>} value={cotacao.nome_cliente} onSave={value => salvarCampo({ field: 'nome_cliente', value })} />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" /> CPF do segurado</span>} value={cotacao.cpf_cliente} onSave={value => salvarCampo({ field: 'cpf_cliente', value })} />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Celular</span>} value={cotacao.celular_cliente} onSave={value => salvarCampo({ field: 'celular_cliente', value })} />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> E-mail</span>} value={cotacao.email_cliente} onSave={value => salvarCampo({ field: 'email_cliente', value })} />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Vigência início</span>} value={cotacao.vigencia_inicio} onSave={value => salvarCampo({ field: 'vigencia_inicio', value })} type="date" />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Vigência fim</span>} value={cotacao.vigencia_fim} onSave={value => salvarCampo({ field: 'vigencia_fim', value })} type="date" />
            </div>
          </DataCard>

          <DataCard title="Condutor" subtitle="Dados do condutor principal">
            <div className="grid gap-3 md:grid-cols-2">
              <DetailField label={<span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" /> Nome do condutor</span>} value={cotacao.condutor_nome} onSave={value => salvarCampo({ field: 'condutor_nome', value })} />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" /> CPF do condutor</span>} value={cotacao.condutor_cpf} onSave={value => salvarCampo({ field: 'condutor_cpf', value })} />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><Heart className="h-3.5 w-3.5" /> Estado civil</span>} value={cotacao.estado_civil_condutor} onSave={value => salvarCampo({ field: 'estado_civil_condutor', value })} />
            </div>
          </DataCard>

          <DataCard title="Veiculo e risco" subtitle="Informacoes usadas na cotacao">
            <div className="grid gap-3 md:grid-cols-2">
              <DetailField label={<span className="inline-flex items-center gap-1.5"><Car className="h-3.5 w-3.5" /> Modelo do veiculo</span>} value={cotacao.modelo_veiculo} onSave={value => salvarCampo({ field: 'modelo_veiculo', value })} />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><Car className="h-3.5 w-3.5" /> Placa</span>} value={cotacao.placa} onSave={value => salvarCampo({ field: 'placa', value })} />
              <DetailField label={<span className="inline-flex items-center gap-1.5"><Car className="h-3.5 w-3.5" /> Uso do veiculo</span>} value={cotacao.uso_veiculo} onSave={value => salvarCampo({ field: 'uso_veiculo', value })} />
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

          <DataCard title="Seguradoras" subtitle="Selecione seguradoras cadastradas e ajuste os valores da cotacao">
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
                      type="number"
                      value={cotacao?.[section.key]?.premio_total}
                      onSave={value => salvarCampo({
                        field: section.key,
                        value: {
                          ...(cotacao?.[section.key] || {}),
                          premio_total: value,
                        },
                      })}
                    />
                    <DetailField
                      label={<span className="inline-flex items-center gap-1.5"><BadgeDollarSign className="h-3.5 w-3.5" /> Premio liquido</span>}
                      type="number"
                      value={cotacao?.[section.key]?.premio_liquido}
                      onSave={value => salvarCampo({
                        field: section.key,
                        value: {
                          ...(cotacao?.[section.key] || {}),
                          premio_liquido: value,
                        },
                      })}
                    />
                    <DetailField
                      label={<span className="inline-flex items-center gap-1.5"><BadgeDollarSign className="h-3.5 w-3.5" /> % Comissao</span>}
                      type="number"
                      value={cotacao?.[section.key]?.pct_comissao}
                      onSave={value => salvarCampo({
                        field: section.key,
                        value: {
                          ...(cotacao?.[section.key] || {}),
                          pct_comissao: value,
                        },
                      })}
                    />
                    <div className="rounded-2xl border border-brand-accent/15 bg-brand-accent/6 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Comissao estimada</p>
                      <p className="mt-2 text-sm font-semibold text-dark-text">
                        {formatMoney(Number(cotacao?.[section.key]?.premio_liquido || 0) * Number(cotacao?.[section.key]?.pct_comissao || 0))}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </DataCard>
        </div>

        <div className="space-y-4">
          <DataCard title="Informacoes" subtitle="Dados tecnicos e operacionais">
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

          <DataCard title="Resumo rapido" subtitle="Leitura operacional da cotacao">
            <div className="space-y-3 text-sm text-dark-muted">
              <p><span className="font-medium text-dark-text">Cliente:</span> {cotacao.nome_cliente || '—'}</p>
              <p><span className="font-medium text-dark-text">Celular:</span> {cotacao.celular_cliente || '—'}</p>
              <p><span className="font-medium text-dark-text">Veiculo:</span> {cotacao.modelo_veiculo || '—'}</p>
              <p><span className="font-medium text-dark-text">Placa:</span> {cotacao.placa || '—'}</p>
              <p><span className="font-medium text-dark-text">Seguradora preferencial:</span> {cotacao.seguradora_preferencial?.nome || '—'}</p>
              <p><span className="font-medium text-dark-text">Seguradora mais barata:</span> {cotacao.seguradora_mais_barata?.nome || '—'}</p>
            </div>
          </DataCard>

          <HistoricoCotacao cotacao={cotacao} />

          <DataCard title="Situacao atual" subtitle="Leitura visual do andamento">
            <div className="space-y-3">
              <QuoteStatusBadge status={cotacao.status} />
              <p className="text-sm text-dark-muted">
                {cotacao.status === 'pendente'
                  ? 'Cotacao aguardando andamento comercial.'
                  : cotacao.status === 'convertida'
                    ? 'Cotacao marcada como convertida.'
                    : 'Cotacao marcada como perdida.'}
              </p>
            </div>
          </DataCard>
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
          <div className="modal-backdrop" onClick={() => setConfirmDelete(false)} />
          <div className="relative z-10 w-full max-w-md rounded-3xl border border-dark-border/70 bg-white p-6 shadow-2xl">
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
