import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable, useDraggable } from '@dnd-kit/core'
import {
  useComercial, leadAdd, leadMover, leadUpdate, saleAdd, eventAdd,
  PIPELINE_COLS, PRODUTOS, ORIGENS, MOTIVOS_RECUSA, TAGS_DEFAULT,
  fetchFichasParaImport, fetchApolicesParaImport,
  calcScore, scoreFaixa, diffDias,
} from '../../lib/comercial'
import { useToast } from '../../contexts/ToastContext'
import {
  Plus, X, Search, Building2, Clock, CheckCircle2, PenLine, ClipboardList, FileCheck, Check, GripVertical,
  AlertTriangle, Flame, Layers3, Users,
} from 'lucide-react'
import { Select } from '../../components/ui/Select'
import { DatePicker } from '../../components/ui/DatePicker'
import { CrmMetricCard, CrmPageHeader, CrmSectionCard } from '../../components/comercial'
import { kanbanPointerCollision, KANBAN_DRAG_OVERLAY_MODIFIERS } from '../../lib/kanbanDnd'

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskPhone(v) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return `(${d}`
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

function ScoreBadge({ score }) {
  const f = scoreFaixa(score)
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0"
      style={{ color: f.color, background: f.bg }}>
      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: f.color }} />
      {score}
    </span>
  )
}

function fmtIdleDays(dias) {
  if (dias === null) return 'Sem atividade'
  if (dias === 0) return 'Hoje'
  return `${dias}d`
}

// ── LeadCard ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#4A90D9','#10B981','#F59E0B','#8B5CF6','#2B5BA8','#EC4899','#06B6D4','#EF4444']

function LeadCard({ lead, col, tags = [], ghost = false, selected = false, onSelect, dragListeners, dragAttributes }) {
  const score    = calcScore(lead)
  const dias     = lead.ultimaAtividade  diffDias(lead.ultimaAtividade) : null
  const leadTags = (lead.tags || []).map(tid => tags.find(t => t.id === tid)).filter(Boolean)
  const isUrgent = dias !== null && dias >= 10
  const isWarn   = dias !== null && dias >= 5

  const initials    = (lead.nome || '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const avatarColor = AVATAR_COLORS[(lead.nome || '').charCodeAt(0) % AVATAR_COLORS.length]

  return (
    <div
      className={`kanban-card group ${ghost  'opacity-30' : ''} ${selected  'ring-2 ring-brand-accent/25' : ''}`}
      style={{
        '--kanban-accent': col.color || '#4A90D9',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(241,245,249,0.92))',
        borderColor: selected  'rgba(37, 99, 235, 0.28)' : 'rgba(148, 163, 184, 0.2)',
        boxShadow: selected  '0 18px 38px rgba(37, 99, 235, 0.12)' : '0 12px 28px rgba(15, 23, 42, 0.08)',
      }}
    >
      <div className="kanban-card-body pl-2 pr-1">
        {/* Row 1: avatar/select + nome + score */}
        <div className="flex items-start gap-2 mb-2">
          {dragListeners && dragAttributes && (
            <button
              {...dragListeners}
              {...dragAttributes}
              type="button"
              className="kanban-grip mt-0.5"
              onClick={e => e.stopPropagation()}
              aria-label="Arrastar lead"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="relative flex-shrink-0 cursor-pointer"
            onClick={e => { e.stopPropagation(); onSelect.() }}>
            {selected  (
              <div className="w-7 h-7 rounded-full bg-brand-accent flex items-center justify-center">
                <Check className="w-3.5 h-3.5 text-white" />
              </div>
            ) : (
              <>
                <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-[11px]"
                  style={{ background: avatarColor }}>
                  {initials}
                </div>
                <div className="absolute inset-0 rounded-full bg-dark-bg/70 flex items-center justify-center
                  opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-3.5 h-3.5 rounded border-2 border-white/60" />
                </div>
              </>
            )}
          </div>
          <p className="font-semibold text-dark-text text-xs leading-snug line-clamp-2 flex-1 pt-0.5">{lead.nome}</p>
          <ScoreBadge score={score} />
        </div>

        {lead.imobiliaria && (
          <div className="flex items-center gap-1 mb-1.5">
            <Building2 className="w-3 h-3 text-dark-muted flex-shrink-0" />
            <span className="text-[10px] text-dark-muted truncate">{lead.imobiliaria}</span>
          </div>
        )}

        {lead.nomeApolice && (
          <div className="flex items-center gap-1 mb-1.5">
            <FileCheck className="w-3 h-3 text-brand-accent/60 flex-shrink-0" />
            <span className="text-[10px] font-mono text-brand-accent/70 truncate">Orç: {lead.nomeApolice}</span>
          </div>
        )}

        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {lead.origem && (
            <span
              className="inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold"
              style={{ background: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.18)', color: '#1d4ed8' }}
            >
              {lead.origem}
            </span>
          )}
          {lead.coluna === 'venda' && (
            <span className="inline-flex items-center rounded-full border border-emerald-700/15 bg-emerald-700/10 px-2 py-0.5 text-[9px] font-bold text-emerald-800">
              Venda
            </span>
          )}
        </div>

        {leadTags.length > 0 && (
          <div className="flex gap-1 flex-wrap mb-1.5">
            {leadTags.slice(0, 2).map(t => (
              <span key={t.id} className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                style={{ color: t.cor, background: t.cor + '22' }}>{t.label}</span>
            ))}
          </div>
        )}

        {lead.resumo && (
          <p className="mb-2 line-clamp-2 text-[10px] leading-relaxed text-dark-muted">{lead.resumo}</p>
        )}

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-slate-300/55 bg-white/80 px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Última atividade</p>
            <div className={`mt-1 inline-flex items-center gap-1 text-[10px] font-semibold ${
              isUrgent  'text-status-error' : isWarn  'text-status-warning' : 'text-dark-text'
            }`}>
              <Clock className="h-3 w-3 flex-shrink-0" />
              <span>{fmtIdleDays(dias)}</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-300/55 bg-white/80 px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Próxima ação</p>
            <p className="mt-1 truncate text-[10px] font-semibold text-brand-accent">
              {lead.proximaAcao || 'Definir próximo passo'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── DraggableCard ─────────────────────────────────────────────────────────────

function DraggableCard({ lead, col, tags, activeId, onClick, selected, onSelect }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: lead.id })
  return (
    <div ref={setNodeRef}
      className={isDragging  'opacity-50' : ''}
      style={{ cursor: isDragging  'grabbing' : 'default', touchAction: 'none' }}
      onClick={e => { if (!isDragging) { e.stopPropagation(); onClick(lead.id) } }}>
      <LeadCard
        lead={lead}
        col={col}
        tags={tags}
        ghost={activeId === lead.id && !isDragging}
        selected={selected}
        onSelect={onSelect}
        dragListeners={listeners}
        dragAttributes={attributes}
      />
    </div>
  )
}

// ── DroppableLane ─────────────────────────────────────────────────────────────

function DroppableLane({ colId, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: colId })
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 flex flex-col min-h-0 overflow-hidden transition-colors duration-150 ${isOver  'bg-brand-accent/5' : ''}`}
    >
      {children}
    </div>
  )
}

// ── SwimLane (vertical column) ────────────────────────────────────────────────

function SwimLane({ col, leads, tags, activeId, onCardClick, selectedIds, onSelect }) {
  return (
    <div className="kanban-col w-[296px] flex-shrink-0 flex flex-col h-full">
      {/* Header */}
      <div className="kanban-col-header flex items-center justify-between flex-shrink-0"
        style={{ background: col.color + '12', borderColor: col.color + '40' }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color }} />
          <span className="text-sm font-bold text-dark-text">{col.label}</span>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ color: col.color, background: col.color + '22' }}>
          {leads.length}
        </span>
      </div>

      <DroppableLane colId={col.id}>
        <div className="kanban-col-body flex flex-col gap-2 p-3 overflow-y-auto flex-1">
          {leads.length === 0  (
            <div className="flex items-center justify-center h-20 rounded-2xl border-2 border-dashed border-dark-border/40 text-[11px] text-dark-muted bg-white/40">
              Soltar aqui
            </div>
          ) : (
            leads.map(lead => (
              <DraggableCard key={lead.id} lead={lead} col={col} tags={tags} activeId={activeId}
                selected={selectedIds.has(lead.id)} onSelect={() => onSelect(lead.id)} onClick={onCardClick} />
            ))
          )}
        </div>
      </DroppableLane>
    </div>
  )
}

// ── Modal base ────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, maxWidth = 'max-w-lg' }) {
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 animate-fade-in">
      <div className="modal-backdrop" onClick={onClose} />
      <div className={`glass-modal w-full ${maxWidth} relative z-10 max-h-[90vh] overflow-y-auto`}
        style={{ animation: 'modalContentIn 0.28s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border flex-shrink-0">
          <h2 className="font-bold text-dark-text" style={{ fontFamily: 'var(--font-heading)' }}>{title}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg transition-all hover:rotate-90 hover:scale-110 duration-200"><X className="w-5 h-5 text-dark-muted" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

const LBL = 'text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1'

// ── ModalRecusa ───────────────────────────────────────────────────────────────

function ModalRecusa({ lead, onClose, onConfirm }) {
  const [motivo, setMotivo] = useState('')
  return (
    <Modal title={`Recusar — ${lead.nome}`} onClose={onClose}>
      <div className="px-6 py-5 space-y-4">
        <p className="text-sm text-dark-muted">Selecione o motivo da recusa:</p>
        <div className="grid grid-cols-2 gap-2">
          {MOTIVOS_RECUSA.map(m => (
            <button key={m} onClick={() => setMotivo(m)}
              className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all text-left ${
                motivo === m
                   'border-status-error bg-status-error/10 text-status-error'
                  : 'border-dark-border text-dark-muted hover:border-dark-text hover:text-dark-text'
              }`}>
              {m}
            </button>
          ))}
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={() => motivo && onConfirm(motivo)} disabled={!motivo}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all bg-status-error/10 text-status-error hover:bg-status-error/20 disabled:opacity-40">
            Confirmar Recusa
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── ModalVenda ────────────────────────────────────────────────────────────────

function ModalVenda({ lead, onClose, onConfirm }) {
  const [form, setForm] = useState({
    produto: '', valor: '', comissao: '',
    dataEmissao: new Date().toISOString().slice(0, 10),
    proximoProduto: '', observacoes: '',
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const valido = form.produto && form.valor && form.comissao && form.dataEmissao
  const comissaoCalc = form.valor && form.comissao
     (parseFloat(form.valor) * parseFloat(form.comissao) / 100)
        .toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0,00'

  return (
    <Modal title={`Registrar Venda — ${lead.nome}`} onClose={onClose}>
      <div className="px-6 py-5 space-y-3">
        <div>
          <label className={LBL}>Produto *</label>
          <Select
            value={form.produto}
            onChange={v => set('produto', v)}
            placeholder="Selecionar..."
            options={PRODUTOS.map(p => ({ value: p.id, label: p.label }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LBL}>Valor (R$) *</label>
            <input type="number" min="0" step="0.01" value={form.valor}
              onChange={e => set('valor', e.target.value)} className="input" placeholder="0,00" />
          </div>
          <div>
            <label className={LBL}>% Comissão *</label>
            <input type="number" min="0" max="100" step="0.1" value={form.comissao}
              onChange={e => set('comissao', e.target.value)} className="input" placeholder="%" />
          </div>
          <div>
            <label className={LBL}>Data Emissão *</label>
            <DatePicker value={form.dataEmissao} onChange={v => set('dataEmissao', v)} />
          </div>
          <div>
            <label className={LBL}>Comissão Calculada</label>
            <div className="input font-mono text-status-success text-sm">R$ {comissaoCalc}</div>
          </div>
        </div>
        <div>
          <label className={LBL}>Próximo Produto</label>
          <Select
            value={form.proximoProduto}
            onChange={v => set('proximoProduto', v)}
            placeholder="Nenhum"
            options={[{ value: '', label: 'Nenhum' }, ...PRODUTOS.map(p => ({ value: p.id, label: p.label }))]}
          />
        </div>
        <div>
          <label className={LBL}>Observações</label>
          <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={2} className="input resize-none" />
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={() => valido && onConfirm(form)} disabled={!valido}
            className="btn-primary flex-1 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Confirmar Venda
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── ModalAddLead ──────────────────────────────────────────────────────────────

function ModalAddLead({ onClose, leads, tags, toast }) {
  const [step,          setStep]          = useState('escolha')
  const [fichaSearch,   setFichaSearch]   = useState('')
  const [fichaStatus,   setFichaStatus]   = useState('')
  const [fichas,        setFichas]        = useState([])
  const [loadingFichas, setLoadingFichas] = useState(false)
  const [apoliceSearch, setApoliceSearch] = useState('')
  const [apolices,      setApolices]      = useState([])
  const [loadingApo,    setLoadingApo]    = useState(false)
  const [form, setForm] = useState({
    nome: '', telefone: '', tipo: 'PF', origem: 'Prospecção',
    imobiliaria: '', nomeApolice: '', tipoLocatario: '',
    proximaAcao: '', resumo: '', tags: [],
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    if (step !== 'fichas') return
    setLoadingFichas(true)
    const t = setTimeout(() => {
      fetchFichasParaImport({ search: fichaSearch, status: fichaStatus })
        .then(setFichas).finally(() => setLoadingFichas(false))
    }, 300)
    return () => clearTimeout(t)
  }, [step, fichaSearch, fichaStatus])

  useEffect(() => {
    if (step !== 'apolices') return
    setLoadingApo(true)
    const t = setTimeout(() => {
      fetchApolicesParaImport({ search: apoliceSearch })
        .then(setApolices).finally(() => setLoadingApo(false))
    }, 300)
    return () => clearTimeout(t)
  }, [step, apoliceSearch])

  const jaNoComercial = nome => leads.some(l => l.nome.toLowerCase() === (nome || '').toLowerCase())

  async function importFicha(f) {
    if (jaNoComercial(f.nome_interessado)) return
    try {
      await leadAdd({ nome: f.nome_interessado, telefone: f.celular || '', tipo: 'PF', origem: 'Seguro Fiança', imobiliaria: f.imobiliaria || '', nomeApolice: f.id, tipoLocatario: 'Locatário', proximaAcao: '', resumo: '', tags: [], apoliceAtiva: false })
      toast.({ type: 'success', title: 'Lead importado!' })
    } catch { toast.({ type: 'error', title: 'Erro ao importar lead' }) }
    onClose()
  }

  async function importApolice(a) {
    if (jaNoComercial(a.nome_interessado)) return
    try {
      await leadAdd({ nome: a.nome_interessado, telefone: '', tipo: 'PF', origem: 'Seguro Fiança', imobiliaria: a.imobiliaria || '', nomeApolice: a.numero_apolice || '', tipoLocatario: 'Locatário', proximaAcao: '', resumo: '', tags: [], apoliceAtiva: true })
      toast.({ type: 'success', title: 'Lead importado!' })
    } catch { toast.({ type: 'error', title: 'Erro ao importar lead' }) }
    onClose()
  }

  async function saveManual() {
    if (!form.nome.trim()) return
    try {
      await leadAdd(form)
      toast.({ type: 'success', title: 'Lead criado!' })
    } catch { toast.({ type: 'error', title: 'Erro ao criar lead' }) }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 animate-fade-in">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="glass-modal w-full max-w-2xl relative z-10 max-h-[90vh] flex flex-col"
        style={{ animation: 'modalContentIn 0.28s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border flex-shrink-0">
          <div className="flex items-center gap-3">
            {step !== 'escolha' && (
              <button onClick={() => setStep('escolha')}
                className="text-xs text-dark-muted hover:text-dark-text px-2 py-1 rounded-lg hover:bg-dark-surface2 transition-colors">
                ← Voltar
              </button>
            )}
            <h2 className="font-bold text-dark-text">
              {step === 'escolha'  && 'Adicionar Lead'}
              {step === 'fichas'   && 'Importar de Fichas'}
              {step === 'apolices' && 'Importar de Apólices'}
              {step === 'manual'   && 'Novo Lead Manual'}
            </h2>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-dark-muted" /></button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Escolha */}
          {step === 'escolha' && (
            <div className="px-6 py-6 grid grid-cols-3 gap-4">
              {[
                { id: 'manual',   icon: PenLine,       label: 'Manual',   desc: 'Criar do zero' },
                { id: 'fichas',   icon: ClipboardList, label: 'Fichas',   desc: 'Importar do sistema' },
                { id: 'apolices', icon: FileCheck,     label: 'Apólices', desc: 'Por apólice ativa' },
              ].map(opt => (
                <button key={opt.id} onClick={() => setStep(opt.id)}
                  className="card p-5 flex flex-col items-center gap-3 hover:bg-dark-surface2 transition-colors cursor-pointer">
                  <opt.icon className="w-8 h-8 text-brand-accent" />
                  <div className="text-center">
                    <p className="font-bold text-dark-text text-sm">{opt.label}</p>
                    <p className="text-xs text-dark-muted mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Fichas */}
          {step === 'fichas' && (
            <div className="px-6 py-4 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-muted" />
                  <input value={fichaSearch} onChange={e => setFichaSearch(e.target.value)}
                    placeholder="Buscar por nome..." className="input pl-8 text-sm py-1.5 w-full" autoFocus />
                </div>
                <Select
                  value={fichaStatus}
                  onChange={setFichaStatus}
                  placeholder="Todos os status"
                  className="w-36"
                  options={[
                    { value: '', label: 'Todos os status' },
                    ...['pendente','em_cotacao','aprovado','recusado','emitido','cancelado','cpf_invalido','em_analise']
                      .map(s => ({ value: s, label: s.replace(/_/g, ' ') }))
                  ]}
                />
              </div>
              {loadingFichas  (
                <div className="text-center py-10 text-dark-muted text-sm">Carregando fichas...</div>
              ) : fichas.length === 0  (
                <div className="text-center py-10 text-dark-muted text-sm">Nenhuma ficha encontrada</div>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {fichas.map(f => {
                    const importado = jaNoComercial(f.nome_interessado)
                    return (
                      <div key={f.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${importado  'border-dark-border opacity-50' : 'border-dark-border hover:bg-dark-surface2'}`}>
                        <div>
                          <p className="font-semibold text-dark-text text-sm">{f.nome_interessado}</p>
                          <p className="text-xs text-dark-muted">{f.imobiliaria || '—'} · {f.status}</p>
                        </div>
                        {importado
                           <span className="text-xs text-dark-muted">Já importado</span>
                          : <button onClick={() => importFicha(f)} className="btn-primary text-xs px-3 py-1.5">Importar</button>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Apólices */}
          {step === 'apolices' && (
            <div className="px-6 py-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-muted" />
                <input value={apoliceSearch} onChange={e => setApoliceSearch(e.target.value)}
                  placeholder="Buscar por nome..." className="input pl-8 text-sm py-1.5 w-full" autoFocus />
              </div>
              {loadingApo  (
                <div className="text-center py-10 text-dark-muted text-sm">Carregando apólices...</div>
              ) : apolices.length === 0  (
                <div className="text-center py-10 text-dark-muted text-sm">Nenhuma apólice encontrada</div>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {apolices.map(a => {
                    const importado = jaNoComercial(a.nome_interessado)
                    return (
                      <div key={a.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${importado  'border-dark-border opacity-50' : 'border-dark-border hover:bg-dark-surface2'}`}>
                        <div>
                          <p className="font-semibold text-dark-text text-sm">{a.nome_interessado}</p>
                          <p className="text-xs text-dark-muted">{a.numero_apolice || '—'} · {a.imobiliaria || '—'}</p>
                        </div>
                        {importado
                           <span className="text-xs text-dark-muted">Já importado</span>
                          : <button onClick={() => importApolice(a)} className="btn-primary text-xs px-3 py-1.5">Importar</button>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Manual */}
          {step === 'manual' && (
            <div className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={LBL}>Nome *</label>
                  <input value={form.nome} onChange={e => set('nome', e.target.value)}
                    className="input" placeholder="Nome completo" autoFocus />
                </div>
                <div>
                  <label className={LBL}>Telefone</label>
                  <input value={form.telefone} onChange={e => set('telefone', maskPhone(e.target.value))}
                    className="input" placeholder="(11) 99999-9999" inputMode="numeric" />
                </div>
                <div>
                  <label className={LBL}>Tipo</label>
                  <Select
                    value={form.tipo}
                    onChange={v => set('tipo', v)}
                    options={[{ value: 'PF', label: 'Pessoa Física' }, { value: 'PJ', label: 'Pessoa Jurídica' }]}
                  />
                </div>
                <div>
                  <label className={LBL}>Origem</label>
                  <Select
                    value={form.origem}
                    onChange={v => set('origem', v)}
                    options={ORIGENS.map(o => ({ value: o, label: o }))}
                  />
                </div>
                <div>
                  <label className={LBL}>Imobiliária</label>
                  <input value={form.imobiliaria} onChange={e => set('imobiliaria', e.target.value)}
                    className="input" placeholder="Nome da imobiliária" />
                </div>
                {form.origem === 'Seguro Fiança' && (
                  <>
                    <div>
                      <label className={LBL}>Nº Apólice</label>
                      <input value={form.nomeApolice} onChange={e => set('nomeApolice', e.target.value)} className="input" />
                    </div>
                    <div>
                      <label className={LBL}>Tipo Locatário</label>
                      <Select
                        value={form.tipoLocatario}
                        onChange={v => set('tipoLocatario', v)}
                        placeholder="—"
                        options={[
                          { value: '', label: '—' },
                          { value: 'Locatário', label: 'Locatário' },
                          { value: 'Fiador', label: 'Fiador' },
                          { value: 'Imobiliária', label: 'Imobiliária' },
                        ]}
                      />
                    </div>
                  </>
                )}
                <div className="col-span-2">
                  <label className={LBL}>Próxima Ação</label>
                  <input value={form.proximaAcao} onChange={e => set('proximaAcao', e.target.value)}
                    className="input" placeholder="Ex: Ligar amanhã" />
                </div>
                <div className="col-span-2">
                  <label className={LBL}>Resumo</label>
                  <textarea value={form.resumo} onChange={e => set('resumo', e.target.value)}
                    rows={2} className="input resize-none" placeholder="Contexto do lead..." />
                </div>
                <div className="col-span-2">
                  <label className={LBL}>Etiquetas</label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {tags.map(t => (
                      <button key={t.id}
                        onClick={() => set('tags', form.tags.includes(t.id)  form.tags.filter(x => x !== t.id) : [...form.tags, t.id])}
                        className="px-2 py-1 rounded text-xs font-medium border transition-all"
                        style={form.tags.includes(t.id)
                           { borderColor: t.cor, background: t.cor + '22', color: t.cor }
                          : { borderColor: 'var(--glass-border)', color: 'var(--glass-text-muted)' }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={saveManual} disabled={!form.nome.trim()} className="btn-primary flex-1">Criar Lead</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── SelectionBar ──────────────────────────────────────────────────────────────

function SelectionBar({ count, onMover, onArquivar, onClear }) {
  if (count === 0) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[400] animate-fade-in pointer-events-none">
      <div className="glass-modal px-4 py-3 flex items-center gap-3 rounded-2xl pointer-events-auto">
        <span className="text-sm font-bold text-dark-text">{count} selecionado{count > 1  's' : ''}</span>
        <div className="w-px h-4 bg-dark-border" />
        <button onClick={onMover} className="btn-secondary text-xs px-3 py-1.5">Mover coluna</button>
        <button onClick={onArquivar}
          className="text-xs px-3 py-1.5 rounded-lg font-medium text-status-error hover:bg-status-error/10 transition-colors">
          Arquivar
        </button>
        <button onClick={onClear} className="text-dark-muted hover:text-dark-text transition-colors ml-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

export default function Pipeline() {
  const state      = useComercial()
  const toast      = useToast()
  const navigate   = useNavigate()
  const [activeId,    setActiveId]    = useState(null)
  const [addOpen,     setAddOpen]     = useState(false)
  const [recusaLead,  setRecusaLead]  = useState(null)
  const [vendaLead,   setVendaLead]   = useState(null)
  const [search,      setSearch]      = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())

  const sensors    = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const activeLead = activeId  state.leads.find(l => l.id === activeId) : null
  const leads      = state.leads || []

  const filtered = useMemo(() => {
    if (!search.trim()) return state.leads || []
    const q = search.toLowerCase()
    return (state.leads || []).filter(l =>
      l.nome.toLowerCase().includes(q) ||
      (l.telefone || '').includes(q) ||
      (l.imobiliaria || '').toLowerCase().includes(q)
    )
  }, [state.leads, search])

  const activeLeads = leads.filter(l => l.coluna !== 'recusou')
  const hotLeads = activeLeads.filter(l => calcScore(l) > 60)
  const staleLeads = activeLeads.filter(l => l.ultimaAtividade && diffDias(l.ultimaAtividade) >= 7)
  const proposalLeads = activeLeads.filter(l => ['oferta', 'negociando', 'followup'].includes(l.coluna) || l.propostaEnviada)
  const stageOverview = PIPELINE_COLS.map(col => {
    const colLeads = filtered.filter(l => l.coluna === col.id)
    return {
      ...col,
      total: colLeads.length,
      stale: colLeads.filter(l => l.ultimaAtividade && diffDias(l.ultimaAtividade) >= 7).length,
    }
  })

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over) return
    const lead = state.leads.find(l => l.id === active.id)
    if (!lead || over.id === lead.coluna) return

    if (over.id === 'recusou') {
      setRecusaLead(lead)
    } else if (over.id === 'venda') {
      setVendaLead(lead)
    } else {
      if (over.id === 'oferta') {
        eventAdd({
          nome: `Follow Up — ${lead.nome}`,
          data: new Date(Date.now() + 3 * 86400000).toISOString(),
          tipo: 'Follow Up',
          descricao: 'Auto: acompanhar proposta enviada',
          leadId: lead.id,
          auto: true,
        })
      }
      leadMover(lead.id, over.id)
      const now = new Date().toISOString()
      leadUpdate(lead.id, { score: calcScore({ ...lead, coluna: over.id, ultimaAtividade: now }) })
    }
  }

  return (
    <div className="space-y-5 animate-fade-in pb-10">
      <CrmPageHeader
        eyebrow="Pipeline comercial"
        title="Operação de avanço e fechamento"
        description="O pipeline agora funciona como uma mesa de controle comercial: volume por etapa, temperatura, inatividade e próximos movimentos na mesma superfície."
        aside={(
          <div className="rounded-[24px] border border-dark-border/60 bg-white/70 px-4 py-3 text-sm shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-dark-muted">Leads visíveis</p>
            <p className="mt-1 text-2xl font-black text-dark-text">{filtered.length}</p>
            <p className="mt-1 text-xs text-dark-muted">{activeLeads.length} ativos na operação</p>
          </div>
        )}
        actions={(
          <>
            <div className="relative min-w-[240px] max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-muted" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome, telefone ou imobiliária"
                className="input w-full py-2 pl-9 text-sm"
              />
            </div>
            <button onClick={() => setAddOpen(true)} className="btn-primary text-sm">
              <span className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Novo lead
              </span>
            </button>
          </>
        )}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CrmMetricCard icon={Users} label="Leads ativos" value={activeLeads.length} accent="#2563EB" helper="Em andamento no pipeline" />
        <CrmMetricCard icon={Flame} label="Alta temperatura" value={hotLeads.length} accent="#DC2626" helper="Score acima de 60" />
        <CrmMetricCard icon={ClipboardList} label="Propostas" value={proposalLeads.length} accent="#7C3AED" helper="Oferta, negociação e follow-up" />
        <CrmMetricCard icon={AlertTriangle} label="Sem atividade" value={staleLeads.length} accent="#D97706" helper="Leads com 7 dias ou mais sem contato" />
      </div>

      <CrmSectionCard
        title="Board executivo"
        subtitle="Arraste, revise gargalos e leia cada etapa como uma unidade operacional."
        contentClassName="p-0"
      >
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 border-b border-dark-border/50 xl:border-b-0 xl:border-r">
            <div className="flex items-center gap-2 overflow-x-auto px-5 py-4">
              {stageOverview.map(stage => (
                <div key={stage.id} className="min-w-[148px] rounded-[20px] border border-dark-border/50 bg-white/60 px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: stage.color }} />
                    <p className="truncate text-xs font-semibold text-dark-text">{stage.label}</p>
                  </div>
                  <p className="mt-3 text-2xl font-black text-dark-text">{stage.total}</p>
                  <p className="mt-1 text-[11px] text-dark-muted">{stage.stale} com inatividade crítica</p>
                </div>
              ))}
            </div>

            <div style={{ height: 'calc(100vh - 28rem)' }} className="min-h-[520px] px-5 pb-5">
              <DndContext
                sensors={sensors}
                collisionDetection={kanbanPointerCollision}
                onDragStart={({ active }) => setActiveId(active.id)}
                onDragEnd={handleDragEnd}
              >
                <div className="flex h-full gap-3 overflow-x-auto pb-4">
                  {PIPELINE_COLS.map(col => (
                    <SwimLane
                      key={col.id}
                      col={col}
                      leads={filtered.filter(l => l.coluna === col.id)}
                      tags={state.tags}
                      activeId={activeId}
                      onCardClick={id => navigate('/comercial/leads/' + id)}
                      selectedIds={selectedIds}
                      onSelect={toggleSelect}
                    />
                  ))}
                </div>
                <DragOverlay dropAnimation={null} modifiers={KANBAN_DRAG_OVERLAY_MODIFIERS}>
                  {activeLead  (
                    <div style={{ width: 'var(--kanban-col-w, 286px)', pointerEvents: 'none', filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.4))' }}>
                      <LeadCard
                        lead={activeLead}
                        col={PIPELINE_COLS.find(c => c.id === activeLead.coluna)}
                        tags={state.tags}
                      />
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          </div>

          <aside className="space-y-4 px-5 py-5">
            <div className="rounded-[24px] border border-dark-border/50 bg-white/65 p-4">
              <div className="flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-brand-accent" />
                <p className="text-sm font-semibold text-dark-text">Leitura rápida</p>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-dark-muted">Selecionados</span>
                  <span className="text-sm font-semibold text-dark-text">{selectedIds.size}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-dark-muted">Recusados</span>
                  <span className="text-sm font-semibold text-dark-text">{leads.filter(l => l.coluna === 'recusou').length}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-dark-muted">Em venda</span>
                  <span className="text-sm font-semibold text-dark-text">{leads.filter(l => l.coluna === 'venda').length}</span>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-dark-border/50 bg-white/65 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-status-warning" />
                <p className="text-sm font-semibold text-dark-text">Pontos de atenção</p>
              </div>
              <div className="mt-4 space-y-2.5">
                {staleLeads.slice(0, 4).map(lead => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => navigate(`/comercial/leads/${lead.id}`)}
                    className="w-full rounded-[18px] border border-dark-border/40 bg-white/70 px-3 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm"
                  >
                    <p className="truncate text-sm font-semibold text-dark-text">{lead.nome}</p>
                    <p className="mt-1 text-xs text-dark-muted">
                      {PIPELINE_COLS.find(c => c.id === lead.coluna).label || 'Pipeline'} • {diffDias(lead.ultimaAtividade)}d sem contato
                    </p>
                  </button>
                ))}
                {staleLeads.length === 0 && (
                  <p className="text-sm text-dark-muted">Nenhum lead crítico no momento.</p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </CrmSectionCard>

      {/* Modais */}
      {addOpen    && <ModalAddLead onClose={() => setAddOpen(false)} leads={state.leads} tags={state.tags} toast={toast} />}
      {recusaLead && <ModalRecusa  lead={recusaLead} onClose={() => setRecusaLead(null)} onConfirm={async motivo => {
        await leadMover(recusaLead.id, 'recusou', { jaRecusou: true, motivoRecusa: motivo })
        toast({ type: 'success', title: 'Lead movido para Recusou' })
        setRecusaLead(null)
      }} />}
      {vendaLead  && <ModalVenda   lead={vendaLead}  onClose={() => setVendaLead(null)}  onConfirm={async form => {
        try {
          await saleAdd({ ...form, leadNome: vendaLead.nome })
          await leadMover(vendaLead.id, 'venda', { vendaRealizada: true })
          toast({ type: 'success', title: 'Venda registrada!' })
        } catch { toast({ type: 'error', title: 'Erro ao registrar venda' }) }
        setVendaLead(null)
      }} />}

      <SelectionBar
        count={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        onMover={() => setSelectedIds(new Set())}
        onArquivar={() => setSelectedIds(new Set())}
      />
    </div>
  )
}
