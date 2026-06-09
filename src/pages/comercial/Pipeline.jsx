import { useState, useMemo, useEffect } from 'react'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable, useDraggable } from '@dnd-kit/core'
import {
  useComercial, leadAdd, leadMover, leadUpdate, saleAdd, eventAdd,
  PIPELINE_COLS, PRODUTOS, ORIGENS, MOTIVOS_RECUSA, TAGS_DEFAULT,
  fetchFichasParaImport, fetchApolicesParaImport,
  calcScore, scoreFaixa, diffDias,
} from '../../lib/comercial'
import { useToast } from '../../contexts/ToastContext'
import { Plus, X, Search, Phone, Building2, Clock, CheckCircle2, PenLine, ClipboardList, FileCheck } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

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

// ── LeadCard ──────────────────────────────────────────────────────────────────

function LeadCard({ lead, tags = [], ghost = false }) {
  const score = calcScore(lead)
  const dias  = lead.ultimaAtividade ? diffDias(lead.ultimaAtividade) : null
  const leadTags = (lead.tags || []).map(tid => tags.find(t => t.id === tid)).filter(Boolean)
  const borderColor = dias !== null && dias >= 10 ? 'border-l-status-error' : dias !== null && dias >= 5 ? 'border-l-status-warning' : 'border-l-transparent'

  return (
    <div className={`w-52 flex-shrink-0 rounded-xl border border-dark-border p-3 select-none transition-all duration-150
      ${ghost ? 'opacity-30' : 'hover:border-brand-accent/30 hover:shadow-md'}
      border-l-2 ${borderColor}`}
      style={{ background: 'var(--glass-bg-heavy)', backdropFilter: 'blur(4px)' }}>
      <div className="flex items-start justify-between gap-1.5 mb-2">
        <p className="font-semibold text-dark-text text-xs leading-snug line-clamp-2 flex-1">{lead.nome}</p>
        <ScoreBadge score={score} />
      </div>
      {lead.imobiliaria && (
        <div className="flex items-center gap-1 mb-1.5">
          <Building2 className="w-3 h-3 text-dark-muted flex-shrink-0" />
          <span className="text-[10px] text-dark-muted truncate">{lead.imobiliaria}</span>
        </div>
      )}
      {lead.origem && (
        <span className="inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full mb-1.5"
          style={{ background: '#6366F115', color: '#6366F1' }}>{lead.origem}</span>
      )}
      {leadTags.length > 0 && (
        <div className="flex gap-1 flex-wrap mb-1.5">
          {leadTags.slice(0, 2).map(t => (
            <span key={t.id} className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
              style={{ color: t.cor, background: t.cor + '22' }}>{t.label}</span>
          ))}
        </div>
      )}
      {lead.proximaAcao && (
        <p className="text-[10px] text-brand-accent truncate">{lead.proximaAcao}</p>
      )}
      {dias !== null && (
        <div className="flex items-center gap-1 mt-1.5">
          <Clock className={`w-3 h-3 flex-shrink-0 ${dias >= 10 ? 'text-status-error' : dias >= 5 ? 'text-status-warning' : 'text-dark-muted'}`} />
          <span className={`text-[10px] ${dias >= 10 ? 'text-status-error font-semibold' : dias >= 5 ? 'text-status-warning' : 'text-dark-muted'}`}>
            {dias === 0 ? 'Hoje' : `${dias}d`}
          </span>
        </div>
      )}
    </div>
  )
}

// ── DraggableCard ─────────────────────────────────────────────────────────────

function DraggableCard({ lead, tags, activeId, onClick }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: lead.id })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      onClick={e => { if (!isDragging) { e.stopPropagation(); onClick(lead) } }}>
      <LeadCard lead={lead} tags={tags} ghost={activeId === lead.id && !isDragging} />
    </div>
  )
}

// ── DroppableLane ─────────────────────────────────────────────────────────────

function DroppableLane({ colId, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: colId })
  return (
    <div ref={setNodeRef} className={`flex-1 overflow-x-auto transition-colors duration-150 ${isOver ? 'bg-brand-accent/5' : ''}`}>
      {children}
    </div>
  )
}

// ── SwimLane ──────────────────────────────────────────────────────────────────

function SwimLane({ col, leads, tags, activeId, onCardClick }) {
  return (
    <div className="flex border-b border-dark-border last:border-b-0" style={{ minHeight: '88px' }}>
      {/* Label */}
      <div className="w-44 flex-shrink-0 flex flex-col justify-center gap-1.5 px-4 border-r border-dark-border"
        style={{ background: 'var(--glass-bg)' }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color }} />
          <span className="text-xs font-bold text-dark-text leading-tight">{col.label}</span>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full w-fit"
          style={{ color: col.color, background: col.color + '22' }}>
          {leads.length} {leads.length === 1 ? 'lead' : 'leads'}
        </span>
      </div>

      {/* Cards */}
      <DroppableLane colId={col.id}>
        <div className="flex items-start gap-3 px-4 py-3" style={{ minWidth: 'max-content', minHeight: '88px' }}>
          {leads.length === 0 ? (
            <div className="flex items-center justify-center w-44 rounded-xl border-2 border-dashed border-dark-border/50 text-[11px] text-dark-muted"
              style={{ minHeight: '62px' }}>
              Arrastar para cá
            </div>
          ) : (
            leads.map(lead => (
              <DraggableCard key={lead.id} lead={lead} tags={tags} activeId={activeId} onClick={onCardClick} />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`glass-modal w-full ${maxWidth} relative z-10 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border flex-shrink-0">
          <h2 className="font-bold text-dark-text">{title}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-dark-muted" /></button>
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
                  ? 'border-status-error bg-status-error/10 text-status-error'
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
    ? (parseFloat(form.valor) * parseFloat(form.comissao) / 100)
        .toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0,00'

  return (
    <Modal title={`Registrar Venda — ${lead.nome}`} onClose={onClose}>
      <div className="px-6 py-5 space-y-3">
        <div>
          <label className={LBL}>Produto *</label>
          <select value={form.produto} onChange={e => set('produto', e.target.value)} className="select w-full">
            <option value="">Selecionar...</option>
            {PRODUTOS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
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
            <input type="date" value={form.dataEmissao} onChange={e => set('dataEmissao', e.target.value)} className="input" />
          </div>
          <div>
            <label className={LBL}>Comissão Calculada</label>
            <div className="input font-mono text-status-success text-sm">R$ {comissaoCalc}</div>
          </div>
        </div>
        <div>
          <label className={LBL}>Próximo Produto</label>
          <select value={form.proximoProduto} onChange={e => set('proximoProduto', e.target.value)} className="select w-full">
            <option value="">Nenhum</option>
            {PRODUTOS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
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
      toast?.({ type: 'success', title: 'Lead importado!' })
    } catch { toast?.({ type: 'error', title: 'Erro ao importar lead' }) }
    onClose()
  }

  async function importApolice(a) {
    if (jaNoComercial(a.nome_interessado)) return
    try {
      await leadAdd({ nome: a.nome_interessado, telefone: '', tipo: 'PF', origem: 'Seguro Fiança', imobiliaria: a.imobiliaria || '', nomeApolice: a.numero_apolice || '', tipoLocatario: 'Locatário', proximaAcao: '', resumo: '', tags: [], apoliceAtiva: true })
      toast?.({ type: 'success', title: 'Lead importado!' })
    } catch { toast?.({ type: 'error', title: 'Erro ao importar lead' }) }
    onClose()
  }

  async function saveManual() {
    if (!form.nome.trim()) return
    try {
      await leadAdd(form)
      toast?.({ type: 'success', title: 'Lead criado!' })
    } catch { toast?.({ type: 'error', title: 'Erro ao criar lead' }) }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-modal w-full max-w-2xl relative z-10 max-h-[90vh] flex flex-col">
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
                <select value={fichaStatus} onChange={e => setFichaStatus(e.target.value)} className="select text-sm py-1.5 w-36">
                  <option value="">Todos os status</option>
                  {['pendente','em_cotacao','aprovado','recusado','emitido','cancelado','cpf_invalido','em_analise'].map(s => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              {loadingFichas ? (
                <div className="text-center py-10 text-dark-muted text-sm">Carregando fichas...</div>
              ) : fichas.length === 0 ? (
                <div className="text-center py-10 text-dark-muted text-sm">Nenhuma ficha encontrada</div>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {fichas.map(f => {
                    const importado = jaNoComercial(f.nome_interessado)
                    return (
                      <div key={f.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${importado ? 'border-dark-border opacity-50' : 'border-dark-border hover:bg-dark-surface2'}`}>
                        <div>
                          <p className="font-semibold text-dark-text text-sm">{f.nome_interessado}</p>
                          <p className="text-xs text-dark-muted">{f.imobiliaria || '—'} · {f.status}</p>
                        </div>
                        {importado
                          ? <span className="text-xs text-dark-muted">Já importado</span>
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
              {loadingApo ? (
                <div className="text-center py-10 text-dark-muted text-sm">Carregando apólices...</div>
              ) : apolices.length === 0 ? (
                <div className="text-center py-10 text-dark-muted text-sm">Nenhuma apólice encontrada</div>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {apolices.map(a => {
                    const importado = jaNoComercial(a.nome_interessado)
                    return (
                      <div key={a.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${importado ? 'border-dark-border opacity-50' : 'border-dark-border hover:bg-dark-surface2'}`}>
                        <div>
                          <p className="font-semibold text-dark-text text-sm">{a.nome_interessado}</p>
                          <p className="text-xs text-dark-muted">{a.numero_apolice || '—'} · {a.imobiliaria || '—'}</p>
                        </div>
                        {importado
                          ? <span className="text-xs text-dark-muted">Já importado</span>
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
                  <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className="select w-full">
                    <option value="PF">Pessoa Física</option>
                    <option value="PJ">Pessoa Jurídica</option>
                  </select>
                </div>
                <div>
                  <label className={LBL}>Origem</label>
                  <select value={form.origem} onChange={e => set('origem', e.target.value)} className="select w-full">
                    {ORIGENS.map(o => <option key={o}>{o}</option>)}
                  </select>
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
                      <select value={form.tipoLocatario} onChange={e => set('tipoLocatario', e.target.value)} className="select w-full">
                        <option value="">—</option>
                        <option value="Locatário">Locatário</option>
                        <option value="Fiador">Fiador</option>
                        <option value="Imobiliária">Imobiliária</option>
                      </select>
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
                        onClick={() => set('tags', form.tags.includes(t.id) ? form.tags.filter(x => x !== t.id) : [...form.tags, t.id])}
                        className="px-2 py-1 rounded text-xs font-medium border transition-all"
                        style={form.tags.includes(t.id)
                          ? { borderColor: t.cor, background: t.cor + '22', color: t.cor }
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

// ── ModalDetalhe ──────────────────────────────────────────────────────────────

function ModalDetalhe({ lead, tags, journeys, onClose }) {
  const score = calcScore(lead)
  const f = scoreFaixa(score)
  const [form, setForm] = useState({
    proximaAcao: lead.proximaAcao || '',
    observacoes: lead.observacoes || '',
    resumo:      lead.resumo      || '',
    tags:        lead.tags        || [],
    jornadaId:   lead.jornadaId   || '',
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const toggleTag = tid => set('tags', form.tags.includes(tid) ? form.tags.filter(t => t !== tid) : [...form.tags, tid])

  return (
    <Modal title={lead.nome} onClose={onClose}>
      <div className="px-6 py-5 space-y-4">
        {/* Score */}
        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: f.bg }}>
          <span className="text-3xl font-black font-mono" style={{ color: f.color }}>{score}</span>
          <div>
            <p className="font-bold text-sm" style={{ color: f.color }}>{f.label} {f.emoji}</p>
            <p className="text-[10px] text-dark-muted">Score calculado por critérios</p>
          </div>
        </div>
        {/* Info */}
        <div className="space-y-1.5">
          {lead.telefone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-3.5 h-3.5 text-dark-muted flex-shrink-0" />
              <span className="font-mono text-dark-text">{lead.telefone}</span>
            </div>
          )}
          {lead.imobiliaria && (
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="w-3.5 h-3.5 text-dark-muted flex-shrink-0" />
              <span className="text-dark-text">{lead.imobiliaria}</span>
            </div>
          )}
        </div>
        {/* Tags */}
        <div>
          <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-2">Etiquetas</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map(t => (
              <button key={t.id} onClick={() => toggleTag(t.id)}
                className="px-2 py-1 rounded text-xs font-medium border transition-all"
                style={form.tags.includes(t.id)
                  ? { borderColor: t.cor, background: t.cor + '22', color: t.cor }
                  : { borderColor: 'var(--glass-border)', color: 'var(--glass-text-muted)' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">Próxima Ação</label>
          <input value={form.proximaAcao} onChange={e => set('proximaAcao', e.target.value)} className="input text-sm" />
        </div>
        <div>
          <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">Observações</label>
          <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={2} className="input text-sm resize-none" />
        </div>
        <div>
          <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">Jornada</label>
          <select value={form.jornadaId} onChange={e => set('jornadaId', e.target.value)} className="select w-full text-sm">
            <option value="">Nenhuma</option>
            {journeys.map(j => <option key={j.id} value={j.id}>{j.nome}</option>)}
          </select>
        </div>
        {/* Histórico */}
        {(lead.historico || []).length > 0 && (
          <div>
            <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-2">Histórico</p>
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {[...(lead.historico || [])].reverse().map((h, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-accent mt-1.5 flex-shrink-0" />
                  <span className="text-dark-muted font-mono whitespace-nowrap">
                    {(() => { try { return format(parseISO(h.data), 'dd/MM HH:mm') } catch { return '—' } })()}
                  </span>
                  <span className="text-dark-text">{h.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={() => { leadUpdate(lead.id, form); onClose() }} className="btn-primary flex-1">Salvar</button>
        </div>
      </div>
    </Modal>
  )
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

export default function Pipeline() {
  const state  = useComercial()
  const toast  = useToast()
  const [activeId,   setActiveId]   = useState(null)
  const [addOpen,    setAddOpen]    = useState(false)
  const [detalhe,    setDetalhe]    = useState(null)
  const [recusaLead, setRecusaLead] = useState(null)
  const [vendaLead,  setVendaLead]  = useState(null)
  const [search,     setSearch]     = useState('')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const activeLead = activeId ? state.leads.find(l => l.id === activeId) : null

  const filtered = useMemo(() => {
    if (!search.trim()) return state.leads
    const q = search.toLowerCase()
    return state.leads.filter(l =>
      l.nome.toLowerCase().includes(q) ||
      (l.telefone || '').includes(q) ||
      (l.imobiliaria || '').toLowerCase().includes(q)
    )
  }, [state.leads, search])

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
    }
  }

  return (
    <div className="flex flex-col gap-3 animate-fade-in" style={{ height: 'calc(100vh - 9.5rem)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-dark-text">Pipeline</h1>
          <p className="text-xs text-dark-muted">
            {state.leads.filter(l => l.coluna !== 'recusou').length} leads ativos
          </p>
        </div>
        <div className="relative flex-1 max-w-xs ml-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar leads..."
            className="input pl-9 py-2 text-sm w-full"
          />
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-primary flex items-center gap-2 text-sm ml-auto">
          <Plus className="w-4 h-4" /> Novo Lead
        </button>
      </div>

      {/* Board — swimlane horizontal */}
      <div className="flex-1 min-h-0 rounded-2xl border border-dark-border overflow-hidden flex flex-col"
        style={{ background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)' }}>
        <DndContext
          sensors={sensors}
          onDragStart={({ active }) => setActiveId(active.id)}
          onDragEnd={handleDragEnd}>
          <div className="flex-1 overflow-y-auto">
            {PIPELINE_COLS.map(col => (
              <SwimLane
                key={col.id}
                col={col}
                leads={filtered.filter(l => l.coluna === col.id)}
                tags={state.tags}
                activeId={activeId}
                onCardClick={setDetalhe}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeLead ? (
              <div style={{ filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.4))' }}>
                <LeadCard lead={activeLead} tags={state.tags} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Modais */}
      {addOpen    && <ModalAddLead onClose={() => setAddOpen(false)} leads={state.leads} tags={state.tags} toast={toast} />}
      {detalhe    && <ModalDetalhe lead={detalhe} tags={state.tags} journeys={state.journeys} onClose={() => setDetalhe(null)} />}
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
    </div>
  )
}
