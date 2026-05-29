import { useEffect, useState } from 'react'
import { fetchFichaDetalhe, STATUS_LABELS, PRODUTO_LABELS } from '../lib/fichas'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { X, Pencil, Trash2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function fmt(v) { if (v === null || v === undefined) return '—'; return String(v) }
function fmtBRL(v) {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}
function fmtDt(v) {
  if (!v) return '—'
  try { return format(parseISO(v), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) } catch { return v }
}

function Field({ label, value }) {
  if (!value && value !== 0 && value !== false) return null
  return (
    <div>
      <p className="text-[10px] font-medium text-dark-muted uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-dark-text">{String(value)}</p>
    </div>
  )
}

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-dark-border last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-3 hover:bg-dark-surface2/50 transition-colors"
      >
        <span className="text-xs font-semibold text-dark-muted uppercase tracking-wider">{title}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-dark-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-dark-muted" />}
      </button>
      {open && (
        <div className="px-6 pb-4 grid grid-cols-2 gap-x-6 gap-y-3">
          {children}
        </div>
      )}
    </div>
  )
}

export default function DetalhesFicha({ id, onClose, onEdit, onDelete }) {
  const [ficha,    setFicha]    = useState(null)
  const [confirm,  setConfirm]  = useState(false)
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { fetchFichaDetalhe(id).then(setFicha) }, [id])

  if (!ficha) {
    return (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-end animate-fade-in">
        <div className="h-full w-full max-w-[480px] bg-dark-surface border-l border-dark-border flex items-center justify-center">
          <p className="text-dark-muted text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  const si    = STATUS_LABELS[ficha.status] ?? { label: ficha.status, color: '' }
  const isPJ  = ficha.produto === 'pessoa_juridica'
  const isPlus = ficha.produto === 'comercial_pf' || isPJ

  async function handleDelete() {
    setDeleting(true)
    await onDelete(ficha.id)
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-end animate-fade-in" onClick={onClose}>
      <div
        className="h-full w-full max-w-[480px] bg-dark-surface border-l border-dark-border flex flex-col animate-slide-in-r"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-dark-border flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-dark-text truncate">
              {isPJ ? (ficha.nome_empresa || ficha.nome_interessado || 'Sem nome') : (ficha.nome_interessado || 'Sem nome')}
            </h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`badge ${si.color}`}>{si.label}</span>
              <span className="text-xs text-dark-muted">{PRODUTO_LABELS[ficha.produto] ?? ficha.produto}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
            {/* Link para página completa */}
            <button
              onClick={() => { onClose(); navigate(`/fichas/${ficha.id}`) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dark-border text-xs text-dark-muted hover:text-brand-accent hover:border-brand-accent/50 transition-colors"
              title="Abrir página completa"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Abrir
            </button>
            <button
              onClick={() => onEdit(ficha)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dark-border text-xs text-dark-muted hover:text-dark-text hover:border-brand-accent/50 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
            {!confirm ? (
              <button
                onClick={() => setConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-status-danger/30 text-xs text-status-danger hover:bg-status-danger/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-xs text-status-danger font-medium">Confirmar?</span>
                <button onClick={handleDelete} disabled={deleting}
                        className="px-2.5 py-1 rounded-lg bg-status-danger text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {deleting ? '...' : 'Sim'}
                </button>
                <button onClick={() => setConfirm(false)}
                        className="px-2.5 py-1 rounded-lg border border-dark-border text-xs text-dark-muted hover:text-dark-text transition-colors">
                  Não
                </button>
              </div>
            )}
            <button onClick={onClose} className="text-dark-muted hover:text-dark-text transition-colors ml-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Identificação */}
          <Section title={isPJ ? 'Empresa' : 'Interessado'}>
            {isPJ ? (
              <>
                <Field label="Nome da Empresa" value={ficha.nome_empresa} />
                <Field label="CNPJ"            value={ficha.cnpj} />
                <Field label="CPF dos Sócios"  value={ficha.cpf_socios} />
              </>
            ) : (
              <>
                <Field label="CPF"     value={ficha.cpf} />
              </>
            )}
            <Field label="Celular" value={ficha.celular} />
            <Field label="E-mail"  value={ficha.email} />
          </Section>

          <Section title="Dados do Imóvel">
            <Field label="Imobiliária"  value={ficha.imobiliaria} />
            <Field label="Tipo"         value={ficha.tipo_imovel} />
            <Field label="CEP"          value={ficha.cep} />
            <Field label="Aluguel"      value={fmtBRL(ficha.valor_aluguel)} />
            <Field label="IPTU"         value={fmtBRL(ficha.valor_iptu)} />
            <Field label="Condomínio"   value={fmtBRL(ficha.valor_condominio)} />
            <Field label="Observações"  value={ficha.observacoes || '—'} />
          </Section>

          {/* Campos extras para Comercial PF e PJ */}
          {isPlus && (
            <Section title="Dados Complementares" defaultOpen={false}>
              <Field label="Atividade"         value={ficha.atividade} />
              <Field label="Total Rendimentos" value={fmtBRL(ficha.total_rendimentos)} />
              <Field label="Capital Social"    value={fmtBRL(ficha.capital_social)} />
              <Field label="Motivo Locação"    value={ficha.motivo_locacao} />
              <Field label="Vigência"          value={ficha.vigencia} />
              {isPJ && <Field label="Opção Tributária" value={ficha.opcao_tributaria} />}
            </Section>
          )}

          <Section title="Controle Interno">
            <Field label="Orç. (Forms)"    value={ficha.orcamentista_forms} />
            <Field label="Assumida por"    value={ficha.profiles?.nome} />
            <Field label="Assumida em"     value={fmtDt(ficha.assumida_em)} />
            <Field label="Seguradora"      value={ficha.seguradora} />
            <Field label="Retorno enviado" value={ficha.retorno_enviado ? 'Sim' : null} />
            <Field label="Finalizada em"   value={fmtDt(ficha.finalizada_em)} />
          </Section>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-dark-border">
          <p className="text-[11px] text-dark-muted/60">Recebida em {fmtDt(ficha.created_at)}</p>
        </div>
      </div>
    </div>
  )
}
