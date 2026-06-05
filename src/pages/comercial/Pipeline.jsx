import { useState, useMemo, useEffect } from 'react'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable, useDraggable } from '@dnd-kit/core'
import {
  useComercial, leadAdd, leadMover, leadUpdate, saleAdd, eventAdd,
  PIPELINE_COLS, PRODUTOS, ORIGENS, MOTIVOS_RECUSA, TAGS_DEFAULT,
  fetchFichasParaImport, fetchApolicesParaImport,
  calcScore, scoreFaixa, diffDias,
} from '../../lib/comercial'
import { PRODUTO_LABELS, STATUS_LABELS } from '../../lib/fichas'
import {
  Plus, X, ChevronLeft, ChevronRight, Clock, Building2, ArrowRight,
  PenLine, ClipboardList, FileCheck, CheckCircle2, Search, Loader2,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const PAGE_SIZE = 3

// ── Score Badge ───────────────────────────────────────────────────────────────

function ScoreBadge({ score }) {
  const f = scoreFaixa(score)
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold" style={{ color: f.color, background: f.bg }}>
      <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: f.color }} />
      {score}
    </span>
  )
}

// ── Tag Pill ──────────────────────────────────────────────────────────────────

function TagPill({ tag }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold"
          style={{ color: tag.cor, background: tag.cor + '22', border: `1px solid ${tag.cor}44` }}>
      {tag.label}
    </span>
  )
}

// ── Lead Card ─────────────────────────────────────────────────────────────────

function LeadCard({ lead, tags, onClick, dragging = false }) {
  const score    = calcScore(lead)
  const dias     = lead.ultimaAtividade ? diffDias(lead.ultimaAtividade) : 0
  const leadTags = (lead.tags || []).map(tid => tags.find(t => t.id === tid)).filter(Boolean)

  let borderStyle = {}
  if (dias >= 10) borderStyle = { borderColor: '#EF4444', borderWidth: 2 }
  else if (dias >= 5) borderStyle = { borderColor: '#F59E0B', borderWidth: 2 }

  return (
    <div
      onClick={onClick}
      className={`card p-3 cursor-pointer hover:scale-[1.01] transition-all select-none ${dragging ? 'opacity-40' : ''}`}
      style={borderStyle}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-dark-text leading-tight">{lead.nome}</p>
        <ScoreBadge score={score} />
      </div>

      {/* Meta */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-[10px] text-dark-muted bg-dark-surface2 px-1.5 py-0.5 rounded">{lead.tipo}</span>
        <span className="text-[10px] text-dark-muted">{lead.origem}</span>
        {lead.vendaRealizada && (
          <span className="text-[10px] bg-status-success/15 text-status-success px-1.5 py-0.5 rounded font-semibold">Venda</span>
        )}
      </div>

      {/* Tags */}
      {leadTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {leadTags.slice(0, 3).map(t => <TagPill key={t.id} tag={t} />)}
        </div>
      )}

      {/* Próxima ação */}
      {lead.proximaAcao && (
        <div className="flex items-center gap-1 mb-1">
          <Clock className="w-2.5 h-2.5 text-brand-accent flex-shrink-0" />
          <p className="text-[10px] text-brand-accent truncate">{lead.proximaAcao}</p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 text-[10px] text-dark-muted mt-1">
        <span>{dias === 0 ? 'Hoje' : `${dias}d atrás`}</span>
        {lead.imobiliaria && (
          <>
            <Building2 className="w-3 h-3 ml-1" />
            <span className="truncate max-w-[80px]">{lead.imobiliaria}</span>
          </>
        )}
      </div>
    </div>
  )
}

// ── Droppable Column (com paginação) ──────────────────────────────────────────

function Column({ col, leads, tags, onCardClick, activeId }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })
  const [page, setPage] = useState(0)

  const totalPages = Math.ceil(leads.length / PAGE_SIZE)
  const safePage   = Math.min(page, Math.max(0, totalPages - 1))
  const visible    = leads.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  return (
    <div className="flex flex-col min-w-[240px] max-w-[240px] flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b" style={{ borderColor: col.color + '40' }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color }} />
          <span className="text-xs font-semibold text-dark-text truncate">{col.label}</span>
        </div>
        <span className="text-[10px] font-bold font-mono text-dark-muted bg-dark-surface2 px-1.5 py-0.5 rounded-full flex-shrink-0">{leads.length}</span>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 min-h-[200px] rounded-xl p-1.5 transition-colors ${isOver ? 'bg-brand-accent/5 ring-1 ring-brand-accent/30' : ''}`}
      >
        {visible.map(lead => (
          <DraggableCard key={lead.id} lead={lead} tags={tags} onCardClick={onCardClick} activeId={activeId} />
        ))}
        {leads.length === 0 && (
          <div className="flex items-center justify-center h-20 rounded-lg border-2 border-dashed border-dark-border/40 text-dark-muted/40 text-xs">
            Solte aqui
          </div>
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1.5 pt-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="p-1 rounded text-dark-muted hover:text-dark-text disabled:opacity-25 hover:bg-dark-surface2 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-dark-muted font-mono">{safePage + 1} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={safePage === totalPages - 1}
            className="p-1 rounded text-dark-muted hover:text-dark-text disabled:opacity-25 hover:bg-dark-surface2 transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

function DraggableCard({ lead, tags, onCardClick, activeId }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={isDragging ? 'cursor-grabbing' : 'cursor-grab'}
    >
      <LeadCard lead={lead} tags={tags} onClick={() => onCardClick(lead)} dragging={isDragging || activeId === lead.id} />
    </div>
  )
}

// ── Modals ────────────────────────────────────────────────────────────────────

function ModalWrapper({ onClose, title, children, width = 'max-w-lg' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`glass-modal w-full ${width} relative z-10 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border">
          <h2 className="font-bold text-dark-text">{title}</h2>
          <button onClick={onClose} className="text-dark-muted hover:text-dark-text"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function ModalRecusa({ lead, onConfirm, onClose }) {
  const [motivo, setMotivo] = useState('')
  return (
    <ModalWrapper onClose={onClose} title="Motivo da Recusa">
      <div className="space-y-4">
        <p className="text-sm text-dark-muted">Informe o motivo pelo qual <strong className="text-dark-text">{lead.nome}</strong> recusou.</p>
        <div className="grid grid-cols-2 gap-2">
          {MOTIVOS_RECUSA.map(m => (
            <button key={m} onClick={() => setMotivo(m)}
              className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${motivo === m ? 'border-brand-accent bg-brand-accent/10 text-dark-text' : 'border-dark-border text-dark-muted hover:border-dark-muted'}`}>
              {m}
            </button>
          ))}
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={() => motivo && onConfirm(motivo)} disabled={!motivo} className="btn-primary flex-1">Confirmar</button>
        </div>
      </div>
    </ModalWrapper>
  )
}

function ModalVenda({ lead, onConfirm, onClose }) {
  const [form, setForm] = useState({ produto: '', valor: '', comissao: '', dataEmissao: new Date().toISOString().slice(0,10), proximoProduto: '', observacoes: '' })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const valorComissao = form.valor && form.comissao ? (parseFloat(form.valor) * parseFloat(form.comissao) / 100).toFixed(2) : '0'
  const valido = form.produto && form.valor && form.comissao && form.dataEmissao

  return (
    <ModalWrapper onClose={onClose} title="Registrar Venda">
      <div className="space-y-4">
        <div className="p-3 rounded-xl bg-status-success/10 border border-status-success/20 flex items-center gap-2 text-sm text-status-success font-medium">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Registrando venda para {lead.nome}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Produto Vendido *</label>
            <select value={form.produto} onChange={e => set('produto', e.target.value)} className="select w-full">
              <option value="">Selecionar...</option>
              {PRODUTOS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Valor (R$) *</label>
            <input type="number" min="0" step="0.01" value={form.valor} onChange={e => set('valor', e.target.value)} className="input" placeholder="0,00" />
          </div>
          <div>
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">% Comissão *</label>
            <input type="number" min="0" max="100" step="0.1" value={form.comissao} onChange={e => set('comissao', e.target.value)} className="input" placeholder="%" />
          </div>
          <div>
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Data Emissão *</label>
            <input type="date" value={form.dataEmissao} onChange={e => set('dataEmissao', e.target.value)} className="input" />
          </div>
          <div>
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Comissão Calculada</label>
            <div className="input font-mono text-status-success">R$ {parseFloat(valorComissao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Próximo Produto Alvo</label>
            <select value={form.proximoProduto} onChange={e => set('proximoProduto', e.target.value)} className="select w-full">
              <option value="">Nenhum</option>
              {PRODUTOS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Observações</label>
            <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={2} className="input resize-none" />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={() => valido && onConfirm(form)} disabled={!valido} className="btn-primary flex-1">Registrar Venda</button>
        </div>
      </div>
    </ModalWrapper>
  )
}

function ModalAddLead({ onClose, onAdd, allLeads }) {
  const [step, setStep] = useState('escolha')
  const [form, setForm] = useState({
    nome: '', telefone: '', tipo: 'PF', origem: 'Seguro Fiança',
    imobiliaria: '', nomeApolice: '', tipoLocatario: 'Locatário',
    proximaAcao: '', observacoes: '', resumo: '', tags: [],
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const valido = form.nome.trim() && form.telefone.trim()

  // Fichas state
  const [fichas,        setFichas]        = useState([])
  const [loadingFichas, setLoadingFichas] = useState(false)
  const [fichaSearch,   setFichaSearch]   = useState('')
  const [fichaStatus,   setFichaStatus]   = useState('')
  const [fichaProduto,  setFichaProduto]  = useState('')

  // Apólices state
  const [apolices,        setApolices]        = useState([])
  const [loadingApolices, setLoadingApolices] = useState(false)
  const [apoliceSearch,   setApoliceSearch]   = useState('')

  useEffect(() => {
    if (step !== 'fichas') return
    setLoadingFichas(true)
    const timer = setTimeout(() => {
      fetchFichasParaImport({ search: fichaSearch, status: fichaStatus, produto: fichaProduto })
        .then(setFichas)
        .finally(() => setLoadingFichas(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [step, fichaSearch, fichaStatus, fichaProduto])

  useEffect(() => {
    if (step !== 'apolices') return
    setLoadingApolices(true)
    const timer = setTimeout(() => {
      fetchApolicesParaImport({ search: apoliceSearch })
        .then(setApolices)
        .finally(() => setLoadingApolices(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [step, apoliceSearch])

  const jaNoComercial = (id) => allLeads.some(l => l.fichaId === id || l.apoliceId === id)

  if (step === 'escolha') return (
    <ModalWrapper onClose={onClose} title="Adicionar Lead">
      <p className="text-sm text-dark-muted mb-5">Como deseja adicionar este lead?</p>
      <div className="space-y-3">
        {[
          [PenLine,       'manual',   'Criar Manualmente',      'Preencher dados do zero'],
          [ClipboardList, 'fichas',   'Selecionar de Fichas',   'Importar de ficha existente no sistema'],
          [FileCheck,     'apolices', 'Selecionar de Apólices', 'Importar de apólice ativa'],
        ].map(([Icon, key, label, desc]) => (
          <button key={key} onClick={() => setStep(key)}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-dark-border bg-dark-surface2 hover:border-brand-accent/50 hover:bg-brand-accent/5 transition-all text-left">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-brand-accent/10">
              <Icon className="w-5 h-5 text-brand-accent" />
            </div>
            <div>
              <p className="font-semibold text-dark-text text-sm">{label}</p>
              <p className="text-xs text-dark-muted mt-0.5">{desc}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-dark-muted ml-auto" />
          </button>
        ))}
      </div>
    </ModalWrapper>
  )

  if (step === 'fichas') return (
    <ModalWrapper onClose={onClose} title="Selecionar de Fichas">
      {/* Busca e filtros */}
      <div className="space-y-2 mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-muted" />
          <input value={fichaSearch} onChange={e => setFichaSearch(e.target.value)}
            placeholder="Buscar por nome..." className="input pl-8 text-sm py-1.5 w-full" />
        </div>
        <div className="flex gap-2">
          <select value={fichaStatus} onChange={e => setFichaStatus(e.target.value)} className="select text-sm py-1.5 flex-1">
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={fichaProduto} onChange={e => setFichaProduto(e.target.value)} className="select text-sm py-1.5 flex-1">
            <option value="">Todos os produtos</option>
            {Object.entries(PRODUTO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {loadingFichas ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
        </div>
      ) : fichas.length === 0 ? (
        <p className="text-xs text-dark-muted text-center py-8">Nenhuma ficha encontrada</p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {fichas.map(f => {
            const usado = jaNoComercial(f.id)
            const statusLabel = STATUS_LABELS[f.status]?.label || f.status
            const prodLabel   = PRODUTO_LABELS[f.produto] || f.produto
            return (
              <button key={f.id} disabled={usado}
                onClick={() => { set('nome', f.nome_interessado || ''); set('telefone', f.celular || ''); set('imobiliaria', f.imobiliaria || ''); setForm(p => ({ ...p, fichaId: f.id, origem: 'Seguro Fiança' })); setStep('manual') }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${usado ? 'border-dark-border opacity-50 cursor-not-allowed' : 'border-dark-border hover:border-brand-accent/50 hover:bg-dark-surface2'}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-dark-text truncate">{f.nome_interessado || '—'}</p>
                  <p className="text-xs text-dark-muted mt-0.5">{f.cpf} · {f.imobiliaria || '—'}</p>
                  <div className="flex gap-1 mt-1">
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold" style={{ background: '#4A90D920', color: '#4A90D9' }}>{prodLabel}</span>
                  </div>
                </div>
                <span className={`ml-2 text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${usado ? 'bg-dark-surface2 text-dark-muted' : 'bg-status-success/15 text-status-success'}`}>
                  {usado ? 'Já adicionado' : statusLabel}
                </span>
              </button>
            )
          })}
        </div>
      )}
      <button onClick={() => setStep('escolha')} className="btn-secondary w-full mt-4">← Voltar</button>
    </ModalWrapper>
  )

  if (step === 'apolices') return (
    <ModalWrapper onClose={onClose} title="Selecionar de Apólices">
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-muted" />
        <input value={apoliceSearch} onChange={e => setApoliceSearch(e.target.value)}
          placeholder="Buscar por nome..." className="input pl-8 text-sm py-1.5 w-full" />
      </div>

      {loadingApolices ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
        </div>
      ) : apolices.length === 0 ? (
        <p className="text-xs text-dark-muted text-center py-8">Nenhuma apólice encontrada</p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {apolices.map(a => {
            const usado = jaNoComercial(a.id)
            return (
              <button key={a.id} disabled={usado}
                onClick={() => { set('nome', a.nome_interessado || ''); set('imobiliaria', a.imobiliaria || ''); set('nomeApolice', a.numero_apolice || ''); setForm(p => ({ ...p, apoliceId: a.id, apoliceAtiva: true, origem: 'Seguro Fiança' })); setStep('manual') }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${usado ? 'border-dark-border opacity-50 cursor-not-allowed' : 'border-dark-border hover:border-brand-accent/50 hover:bg-dark-surface2'}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-dark-text truncate">{a.nome_interessado || '—'}</p>
                  <p className="text-xs text-dark-muted mt-0.5">Apólice {a.numero_apolice || '—'} · {a.imobiliaria || '—'}</p>
                  {a.seguradora && <p className="text-[9px] text-dark-muted mt-0.5">{a.seguradora}</p>}
                </div>
                <span className={`ml-2 text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${usado ? 'bg-dark-surface2 text-dark-muted' : 'bg-brand-accent/10 text-brand-accent'}`}>
                  {usado ? 'Já adicionado' : 'Disponível'}
                </span>
              </button>
            )
          })}
        </div>
      )}
      <button onClick={() => setStep('escolha')} className="btn-secondary w-full mt-4">← Voltar</button>
    </ModalWrapper>
  )

  // Manual
  return (
    <ModalWrapper onClose={onClose} title="Criar Lead" width="max-w-xl">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Nome *</label>
          <input value={form.nome} onChange={e => set('nome', e.target.value)} className="input" placeholder="Nome completo ou razão social" />
        </div>
        <div>
          <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Telefone *</label>
          <input value={form.telefone} onChange={e => set('telefone', e.target.value)} className="input" placeholder="(00) 00000-0000" />
        </div>
        <div>
          <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Tipo</label>
          <div className="flex gap-2">
            {['PF','PJ'].map(t => <button key={t} onClick={() => set('tipo', t)} className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${form.tipo === t ? 'border-brand-accent bg-brand-accent/10 text-brand-accent' : 'border-dark-border text-dark-muted'}`}>{t}</button>)}
          </div>
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Origem</label>
          <select value={form.origem} onChange={e => set('origem', e.target.value)} className="select w-full">
            {ORIGENS.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        {form.origem === 'Seguro Fiança' && (
          <>
            <div>
              <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Imobiliária</label>
              <input value={form.imobiliaria} onChange={e => set('imobiliaria', e.target.value)} className="input" />
            </div>
            <div>
              <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Tipo</label>
              <select value={form.tipoLocatario} onChange={e => set('tipoLocatario', e.target.value)} className="select w-full">
                <option>Locatário</option><option>Proprietário</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">N° Apólice</label>
              <input value={form.nomeApolice} onChange={e => set('nomeApolice', e.target.value)} className="input" />
            </div>
          </>
        )}
        <div className="col-span-2">
          <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Próxima Ação</label>
          <input value={form.proximaAcao} onChange={e => set('proximaAcao', e.target.value)} className="input" placeholder="Ex: Ligar amanhã" />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Resumo</label>
          <textarea value={form.resumo} onChange={e => set('resumo', e.target.value)} rows={2} className="input resize-none" />
        </div>
      </div>
      <div className="flex gap-3 pt-4">
        <button onClick={() => setStep('escolha')} className="btn-secondary flex-1">← Voltar</button>
        <button onClick={() => valido && onAdd(form)} disabled={!valido} className="btn-primary flex-1">Criar Lead</button>
      </div>
    </ModalWrapper>
  )
}

function ModalDetalhe({ lead, tags, allJourneys, onClose, onSave }) {
  const score = calcScore(lead)
  const f     = scoreFaixa(score)
  const [form, setForm] = useState({
    proximaAcao: lead.proximaAcao || '',
    observacoes: lead.observacoes || '',
    resumo:      lead.resumo      || '',
    tags:        lead.tags        || [],
    jornadaId:   lead.jornadaId   || '',
  })
  const set       = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const toggleTag = (tid) => set('tags', form.tags.includes(tid) ? form.tags.filter(t => t !== tid) : [...form.tags, tid])

  return (
    <ModalWrapper onClose={onClose} title={lead.nome} width="max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        {/* Info + Score */}
        <div className="col-span-2 flex items-stretch gap-3 p-3 rounded-xl bg-dark-surface2 border border-dark-border">
          <div className="flex-1 grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs content-start">
            <div><span className="text-dark-muted">Tipo:</span> <span className="text-dark-text font-medium">{lead.tipo}</span></div>
            <div><span className="text-dark-muted">Origem:</span> <span className="text-dark-text font-medium">{lead.origem}</span></div>
            <div><span className="text-dark-muted">Telefone:</span> <span className="text-dark-text font-mono">{lead.telefone}</span></div>
            {lead.imobiliaria   && <div><span className="text-dark-muted">Imob.:</span> <span className="text-dark-text font-medium">{lead.imobiliaria}</span></div>}
            {lead.nomeApolice   && <div><span className="text-dark-muted">Apólice:</span> <span className="text-dark-text font-mono">{lead.nomeApolice}</span></div>}
            {lead.tipoLocatario && <div><span className="text-dark-muted">Função:</span> <span className="text-dark-text font-medium">{lead.tipoLocatario}</span></div>}
          </div>
          <div className="text-center px-4 border-l border-dark-border flex flex-col items-center justify-center">
            <p className="text-3xl font-black font-mono" style={{ color: f.color }}>{score}</p>
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-1" style={{ background: f.bg, color: f.color }}>{f.label}</span>
          </div>
        </div>

        {/* Tags */}
        <div className="col-span-2">
          <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-2">Etiquetas</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map(t => (
              <button key={t.id} onClick={() => toggleTag(t.id)}
                className="px-2 py-1 rounded-lg text-xs font-medium border transition-all"
                style={form.tags.includes(t.id) ? { borderColor: t.cor, background: t.cor + '22', color: t.cor } : { borderColor: 'var(--glass-border)', color: 'var(--glass-text-muted)' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="col-span-2">
          <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1">Próxima Ação</label>
          <input value={form.proximaAcao} onChange={e => set('proximaAcao', e.target.value)} className="input" placeholder="Ex: Ligar amanhã" />
        </div>
        <div>
          <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1">Observações</label>
          <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={3} className="input resize-none" />
        </div>
        <div>
          <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1">Resumo Executivo</label>
          <textarea value={form.resumo} onChange={e => set('resumo', e.target.value)} rows={3} className="input resize-none" />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1">Jornada Vinculada</label>
          <select value={form.jornadaId} onChange={e => set('jornadaId', e.target.value)} className="select w-full">
            <option value="">Nenhuma</option>
            {allJourneys.map(j => <option key={j.id} value={j.id}>{j.nome}</option>)}
          </select>
        </div>

        {/* Histórico */}
        {(lead.historico || []).length > 0 && (
          <div className="col-span-2">
            <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-2">Histórico</p>
            <div className="space-y-1.5 max-h-32 overflow-y-auto p-2 rounded-xl bg-dark-surface2">
              {(lead.historico || []).slice().reverse().map((h, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-accent mt-1.5 flex-shrink-0" />
                  <span className="text-dark-muted font-mono whitespace-nowrap">{format(parseISO(h.data), 'dd/MM HH:mm')}</span>
                  <span className="text-dark-text">{h.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-5 border-t border-dark-border mt-4">
        <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
        <button onClick={() => onSave(form)} className="btn-primary flex-1">Salvar Alterações</button>
      </div>
    </ModalWrapper>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Pipeline() {
  const state = useComercial()
  const leads = state.leads
  const tags  = state.tags

  const [addOpen,    setAddOpen]    = useState(false)
  const [detalhe,    setDetalhe]    = useState(null)
  const [recusaLead, setRecusaLead] = useState(null)
  const [vendaLead,  setVendaLead]  = useState(null)
  const [activeId,   setActiveId]   = useState(null)
  const [search,     setSearch]     = useState('')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const filtered = useMemo(() => {
    if (!search.trim()) return leads
    const q = search.toLowerCase()
    return leads.filter(l => l.nome.toLowerCase().includes(q) || (l.telefone || '').includes(q))
  }, [leads, search])

  const leadsByCol = useMemo(() => {
    const map = {}
    PIPELINE_COLS.forEach(c => { map[c.id] = [] })
    filtered.forEach(l => { if (map[l.coluna]) map[l.coluna].push(l) })
    return map
  }, [filtered])

  function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over || active.id === over.id) return
    const targetCol = PIPELINE_COLS.find(c => c.id === over.id)
    if (!targetCol) return
    const lead = leads.find(l => l.id === active.id)
    if (!lead || lead.coluna === targetCol.id) return

    if (targetCol.id === 'recusou') { setRecusaLead({ lead, targetCol: targetCol.id }); return }
    if (targetCol.id === 'venda')   { setVendaLead(lead); return }

    leadMover(lead.id, targetCol.id)
    if (targetCol.id === 'oferta') {
      const em3dias = new Date(Date.now() + 3 * 86400000)
      eventAdd({ nome: `Follow Up — ${lead.nome}`, data: em3dias.toISOString(), tipo: 'Follow Up', descricao: 'Auto: proposta enviada', leadId: lead.id, auto: true })
    }
  }

  function handleSaveDetalhe(changes) { leadUpdate(detalhe.id, changes); setDetalhe(null) }
  function handleAddLead(form)        { leadAdd(form); setAddOpen(false) }
  function handleRecusa(motivo)       { leadMover(recusaLead.lead.id, 'recusou', { motivoRecusa: motivo, jaRecusou: true }); setRecusaLead(null) }
  function handleVenda(form)          { leadMover(vendaLead.id, 'venda', { vendaRealizada: true }); saleAdd({ leadId: vendaLead.id, leadNome: vendaLead.nome, ...form }); setVendaLead(null) }

  const activeCard = activeId ? leads.find(l => l.id === activeId) : null

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-dark-text">Pipeline Comercial</h1>
          <p className="text-xs text-dark-muted mt-0.5">{leads.length} leads no funil</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar lead..." className="input text-sm py-1.5 pl-8 w-44" />
          </div>
          <button onClick={() => setAddOpen(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Adicionar Lead
          </button>
        </div>
      </div>

      {/* Board */}
      <DndContext sensors={sensors} onDragStart={({ active }) => setActiveId(active.id)} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {PIPELINE_COLS.map(col => (
              <Column key={col.id} col={col} leads={leadsByCol[col.id] || []} tags={tags} onCardClick={setDetalhe} activeId={activeId} />
            ))}
          </div>
        </div>
        <DragOverlay>
          {activeCard && (
            <div className="rotate-2 opacity-90 w-[240px] cursor-grabbing">
              <LeadCard lead={activeCard} tags={tags} onClick={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Modals */}
      {addOpen    && <ModalAddLead  onClose={() => setAddOpen(false)} onAdd={handleAddLead} allLeads={leads} />}
      {detalhe    && <ModalDetalhe  lead={detalhe} tags={tags} allJourneys={state.journeys} onClose={() => setDetalhe(null)} onSave={handleSaveDetalhe} />}
      {recusaLead && <ModalRecusa   lead={recusaLead.lead} onConfirm={handleRecusa} onClose={() => setRecusaLead(null)} />}
      {vendaLead  && <ModalVenda    lead={vendaLead} onConfirm={handleVenda} onClose={() => setVendaLead(null)} />}
    </div>
  )
}
