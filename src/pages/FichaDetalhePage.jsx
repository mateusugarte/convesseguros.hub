import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchFichaDetalhe, editarFicha, deletarFicha, STATUS_LABELS, PRODUTO_LABELS } from '../lib/fichas'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowLeft, Pencil, Trash2, Check, X } from 'lucide-react'
import ModalFicha from '../components/ModalFicha'
import ModalAssumir from '../components/ModalAssumir'
import ModalFinalizar from '../components/ModalFinalizar'

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDt(v) {
  if (!v) return null
  try { return format(parseISO(v), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) } catch { return v }
}
function fmtBRL(v) {
  if (v === null || v === undefined || v === '') return null
  return String(v)
}

// ── InlineField — campo editável com click ────────────────────────────────────

function InlineField({ label, value, onSave, type = 'text', rows }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value || '')
  const [saving,  setSaving]  = useState(false)

  function cancel() { setEditing(false); setDraft(value || '') }

  async function save() {
    if (draft === (value || '')) { setEditing(false); return }
    setSaving(true)
    await onSave(draft || null)
    setSaving(false)
    setEditing(false)
  }

  function handleKey(e) {
    if (!rows && e.key === 'Enter') { e.preventDefault(); save() }
    if (e.key === 'Escape') cancel()
  }

  const inputClass = 'text-sm bg-dark-surface2 border border-brand-accent/60 rounded-lg px-3 py-1.5 text-dark-text outline-none focus:border-brand-accent w-full transition-colors'

  return (
    <div>
      <p className="text-[10px] font-medium text-dark-muted uppercase tracking-wider mb-1">{label}</p>
      {editing ? (
        <div className="flex items-start gap-1.5">
          {rows ? (
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKey}
              rows={rows}
              autoFocus
              className={`${inputClass} resize-none`}
            />
          ) : (
            <input
              type={type}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKey}
              autoFocus
              className={inputClass}
            />
          )}
          <button
            onClick={save}
            disabled={saving}
            className="flex-shrink-0 p-1.5 rounded-lg bg-status-success/20 text-status-success hover:bg-status-success/30 transition-colors mt-0.5"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={cancel}
            className="flex-shrink-0 p-1.5 rounded-lg bg-dark-surface2 text-dark-muted hover:text-dark-text transition-colors mt-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <p
          onClick={() => { setDraft(value || ''); setEditing(true) }}
          className="text-sm text-dark-text cursor-pointer group flex items-center gap-1.5 hover:text-brand-accent transition-colors"
        >
          <span>{value || <span className="text-dark-muted/40 italic">—</span>}</span>
          <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-40 flex-shrink-0 transition-opacity" />
        </p>
      )}
    </div>
  )
}

// ── ReadField — campo read-only ───────────────────────────────────────────────

function ReadField({ label, value }) {
  if (!value && value !== 0 && value !== false) return null
  return (
    <div>
      <p className="text-[10px] font-medium text-dark-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-dark-text">{String(value)}</p>
    </div>
  )
}

// ── Timeline ──────────────────────────────────────────────────────────────────

function Timeline({ ficha }) {
  const events = []

  events.push({
    label: 'Ficha recebida',
    sub: ficha.imobiliaria ? `via ${ficha.imobiliaria}` : null,
    ts: ficha.created_at,
    color: '#3B82F6',
  })

  if (ficha.assumida_em) {
    events.push({
      label: `Assumida por ${ficha.profiles?.nome || 'desconhecido'}`,
      sub: 'Status → Em Cotação',
      ts: ficha.assumida_em,
      color: '#F59E0B',
    })
  }

  if (ficha.finalizada_em) {
    const si = STATUS_LABELS[ficha.status]
    events.push({
      label: `Finalizada — ${si?.label || ficha.status}`,
      sub: ficha.seguradora ? `Seguradora: ${ficha.seguradora}` : null,
      ts: ficha.finalizada_em,
      color: ficha.status === 'aprovado' ? '#10B981' : ficha.status === 'recusado' ? '#EF4444' : '#4A90D9',
    })
  }

  return (
    <div className="space-y-3">
      {events.map((ev, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="w-2.5 h-2.5 rounded-full mt-1" style={{ background: ev.color }} />
            {i < events.length - 1 && <div className="w-px flex-1 bg-dark-border mt-1.5" />}
          </div>
          <div className="pb-3 min-w-0">
            <p className="text-sm text-dark-text font-medium">{ev.label}</p>
            {ev.sub && <p className="text-xs text-dark-muted mt-0.5">{ev.sub}</p>}
            {ev.ts && (
              <p className="text-[10px] text-dark-muted/60 mt-0.5 font-mono">{fmtDt(ev.ts)}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── ProdutoBadge ──────────────────────────────────────────────────────────────

const PROD_COLORS = {
  residencial_pf:  { bg: 'rgba(74,144,217,0.15)',  text: '#4A90D9',  border: 'rgba(74,144,217,0.3)' },
  comercial_pf:    { bg: 'rgba(16,185,129,0.15)',  text: '#10B981',  border: 'rgba(16,185,129,0.3)' },
  pessoa_juridica: { bg: 'rgba(139,92,246,0.15)',  text: '#8B5CF6',  border: 'rgba(139,92,246,0.3)' },
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function FichaDetalhePage() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const { user }  = useAuth()
  const toast     = useToast()

  const [ficha,    setFicha]    = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [editar,   setEditar]   = useState(false)
  const [assumir,  setAssumir]  = useState(false)
  const [finalizar,setFinalizar]= useState(false)
  const [confirm,  setConfirm]  = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetchFichaDetalhe(id)
    setFicha(data)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function updateField(field, value) {
    const prev = ficha
    // Optimistic update
    setFicha(f => ({ ...f, [field]: value }))
    const err = await editarFicha(id, { [field]: value }, user?.id)
    if (err) {
      setFicha(prev)
      toast({ type: 'error', title: 'Erro ao salvar campo' })
    } else {
      toast({ type: 'success', title: 'Campo atualizado' })
    }
  }

  async function handleDelete() {
    setDeleting(true)
    const err = await deletarFicha(id)
    if (err) {
      setDeleting(false)
      toast({ type: 'error', title: 'Erro ao excluir ficha' })
    } else {
      toast({ type: 'success', title: 'Ficha excluída' })
      navigate('/fichas')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-dark-muted text-sm">
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        Carregando ficha...
      </div>
    )
  }

  if (!ficha) {
    return (
      <div className="text-center py-20">
        <p className="text-dark-muted">Ficha não encontrada</p>
        <button onClick={() => navigate('/fichas')} className="btn-secondary mt-4">← Voltar</button>
      </div>
    )
  }

  const si        = STATUS_LABELS[ficha.status] ?? { label: ficha.status, color: '' }
  const prodColor = PROD_COLORS[ficha.produto] || PROD_COLORS.residencial_pf
  const isPJ      = ficha.produto === 'pessoa_juridica'
  const isComPlus = ficha.produto === 'comercial_pf' || isPJ
  const isMe      = ficha.orcamentista_id === user?.id
  const canAssumir  = !ficha.assumida && ficha.status === 'pendente'
  const canFinalizar = isMe && ficha.status === 'em_cotacao'
  const nomePrincipal = isPJ ? (ficha.nome_empresa || ficha.nome_interessado || 'Sem nome') : (ficha.nome_interessado || 'Sem nome')

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Breadcrumb / Header ── */}
      <div className="flex items-start gap-4 flex-wrap">
        <button
          onClick={() => navigate('/fichas')}
          className="flex items-center gap-1.5 text-dark-muted hover:text-dark-text transition-colors text-sm flex-shrink-0 mt-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
          Fichas
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-dark-text truncate">{nomePrincipal}</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`badge ${si.color}`}>{si.label}</span>
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full border"
              style={{ background: prodColor.bg, color: prodColor.text, borderColor: prodColor.border }}
            >
              {PRODUTO_LABELS[ficha.produto] ?? ficha.produto}
            </span>
            {ficha.imobiliaria && (
              <span className="text-xs text-dark-muted">{ficha.imobiliaria}</span>
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          {canAssumir && (
            <button onClick={() => setAssumir(true)} className="btn-primary text-sm">
              Assumir
            </button>
          )}
          {canFinalizar && (
            <button
              onClick={() => setFinalizar(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-status-success/15 text-status-success border border-status-success/20 hover:bg-status-success/25 transition-colors text-sm font-medium"
            >
              <Check className="w-4 h-4" /> Finalizar
            </button>
          )}
          <button
            onClick={() => setEditar(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dark-border text-xs text-dark-muted hover:text-dark-text hover:border-brand-accent/50 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> Editar
          </button>
          {!confirm ? (
            <button
              onClick={() => setConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-status-danger/30 text-xs text-status-danger hover:bg-status-danger/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Excluir
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-status-danger font-medium">Confirmar?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-2.5 py-1.5 rounded-lg bg-status-danger text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {deleting ? '...' : 'Sim'}
              </button>
              <button
                onClick={() => setConfirm(false)}
                className="px-2.5 py-1.5 rounded-lg border border-dark-border text-xs text-dark-muted hover:text-dark-text transition-colors"
              >
                Não
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Body: 2 colunas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Coluna Esquerda: Dados ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Identificação */}
          <div className="card p-5">
            <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-4 pb-2 border-b border-dark-border">
              {isPJ ? 'Empresa' : 'Interessado'}
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {isPJ ? (
                <>
                  <ReadField label="Nome da Empresa" value={ficha.nome_empresa} />
                  <ReadField label="CNPJ" value={ficha.cnpj} />
                  <div className="col-span-2">
                    <ReadField label="CPF dos Sócios" value={ficha.cpf_socios} />
                  </div>
                </>
              ) : (
                <>
                  <ReadField label="Nome" value={ficha.nome_interessado} />
                  <ReadField label="CPF" value={ficha.cpf} />
                </>
              )}
              <ReadField label="Celular" value={ficha.celular} />
              <ReadField label="E-mail" value={ficha.email} />
            </div>
          </div>

          {/* Imóvel */}
          <div className="card p-5">
            <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-4 pb-2 border-b border-dark-border">
              Dados do Imóvel
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <ReadField label="Imobiliária" value={ficha.imobiliaria} />
              <ReadField label="Tipo" value={ficha.tipo_imovel} />
              <ReadField label="CEP" value={ficha.cep} />
              <ReadField label="Aluguel" value={fmtBRL(ficha.valor_aluguel)} />
              <ReadField label="IPTU" value={fmtBRL(ficha.valor_iptu)} />
              <ReadField label="Condomínio" value={fmtBRL(ficha.valor_condominio)} />
              <div className="col-span-2">
                <InlineField
                  label="Observações"
                  value={ficha.observacoes}
                  onSave={v => updateField('observacoes', v)}
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Campos extras — Comercial PF e PJ */}
          {isComPlus && (
            <div className="card p-5">
              <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-4 pb-2 border-b border-dark-border">
                Dados Complementares
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <ReadField label="Atividade" value={ficha.atividade} />
                <ReadField label="Total de Rendimentos" value={fmtBRL(ficha.total_rendimentos)} />
                <ReadField label="Capital Social" value={fmtBRL(ficha.capital_social)} />
                <ReadField label="Motivo da Locação" value={ficha.motivo_locacao} />
                <ReadField label="Vigência" value={ficha.vigencia} />
                {isPJ && <ReadField label="Opção Tributária" value={ficha.opcao_tributaria} />}
              </div>
            </div>
          )}

          {/* Controle interno — campos editáveis */}
          <div className="card p-5">
            <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-4 pb-2 border-b border-dark-border">
              Controle Interno
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <ReadField label="Orçamentista (Forms)" value={ficha.orcamentista_forms} />
              <ReadField label="Assumida por" value={ficha.profiles?.nome} />
              <ReadField label="Assumida em" value={fmtDt(ficha.assumida_em)} />
              <InlineField
                label="Seguradora"
                value={ficha.seguradora}
                onSave={v => updateField('seguradora', v)}
              />
              <div className="col-span-2">
                <p className="text-[10px] font-medium text-dark-muted uppercase tracking-wider mb-2">Retorno enviado</p>
                <label className="flex items-center gap-3 cursor-pointer group w-fit">
                  <div
                    onClick={() => updateField('retorno_enviado', !ficha.retorno_enviado)}
                    className={`w-9 h-5 rounded-full transition-colors ${ficha.retorno_enviado ? 'bg-status-success' : 'bg-dark-border'}`}
                  >
                    <div className={`w-3.5 h-3.5 bg-white rounded-full mt-0.75 transition-transform ${ficha.retorno_enviado ? 'translate-x-4' : 'translate-x-0.5'} m-[3px]`} />
                  </div>
                  <span className="text-sm text-dark-text">{ficha.retorno_enviado ? 'Sim' : 'Não'}</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* ── Coluna Direita: Timeline + Meta ── */}
        <div className="space-y-4">

          {/* Meta info */}
          <div className="card p-4 space-y-3">
            <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider">Informações</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-dark-muted">Recebida em</span>
                <span className="text-dark-text font-mono text-[10px]">
                  {fmtDt(ficha.created_at)}
                </span>
              </div>
              {ficha.finalizada_em && (
                <div className="flex justify-between">
                  <span className="text-dark-muted">Finalizada em</span>
                  <span className="text-dark-text font-mono text-[10px]">
                    {fmtDt(ficha.finalizada_em)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-dark-muted">ID</span>
                <span className="text-dark-muted font-mono text-[9px] truncate max-w-[120px]">{ficha.id}</span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="card p-4">
            <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-4">Histórico</p>
            <Timeline ficha={ficha} />
          </div>
        </div>
      </div>

      {/* Modals */}
      {editar && (
        <ModalFicha
          ficha={ficha}
          onClose={() => setEditar(false)}
          onSuccess={() => { setEditar(false); load() }}
        />
      )}
      {assumir && (
        <ModalAssumir
          id={ficha.id}
          onClose={() => setAssumir(false)}
          onSuccess={() => { setAssumir(false); load() }}
        />
      )}
      {finalizar && (
        <ModalFinalizar
          ficha={ficha}
          onClose={() => setFinalizar(false)}
          onSuccess={() => { setFinalizar(false); load() }}
        />
      )}
    </div>
  )
}
