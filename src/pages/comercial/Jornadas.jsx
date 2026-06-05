import { useState } from 'react'
import { useComercial, journeyAdd, scriptAdd, tagAdd } from '../../lib/comercial'
import { Plus, X, ChevronDown, ChevronRight, BookOpen, FileText, Tag, Users, Map, Layers } from 'lucide-react'

const TABS = ['Jornadas', 'Scripts', 'Materiais']

// ── Journey Card ──────────────────────────────────────────────────────────────

function JourneyCard({ journey, leads }) {
  const [open, setOpen] = useState(false)
  const vinculados = leads.filter(l => l.jornadaId === journey.id)
  const etapas     = (journey.etapas || []).map(e => typeof e === 'string' ? e : (e.nome || String(e)))

  return (
    <div className="card overflow-hidden">
      <button className="w-full flex items-center gap-3 p-4 text-left hover:bg-dark-surface2 transition-colors" onClick={() => setOpen(o => !o)}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-brand-accent/10">
          <Map className="w-5 h-5 text-brand-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-dark-text text-sm">{journey.nome}</p>
          {journey.descricao && <p className="text-xs text-dark-muted mt-0.5 truncate">{journey.descricao}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-brand-accent/10 text-brand-accent">{vinculados.length} leads</span>
          {open ? <ChevronDown className="w-4 h-4 text-dark-muted" /> : <ChevronRight className="w-4 h-4 text-dark-muted" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-dark-border">
          {/* Etapas */}
          <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mt-3 mb-2">
            Etapas ({etapas.length})
          </p>
          {etapas.length === 0 ? (
            <p className="text-xs text-dark-muted">Nenhuma etapa definida</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {etapas.map((etapa, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-dark-surface2 border border-dark-border">
                  <span className="text-xs font-mono text-dark-muted">{i + 1}</span>
                  <span className="text-xs text-dark-text">{etapa}</span>
                </div>
              ))}
            </div>
          )}

          {/* Leads vinculados */}
          {vinculados.length > 0 && (
            <>
              <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mt-3 mb-2">Leads Vinculados</p>
              <div className="space-y-1">
                {vinculados.map(l => (
                  <div key={l.id} className="flex items-center gap-2 text-xs text-dark-muted">
                    <Users className="w-3 h-3" />
                    <span className="text-dark-text">{l.nome}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Script Card ───────────────────────────────────────────────────────────────

function ScriptCard({ script }) {
  const [open, setOpen] = useState(false)
  const tipo = script.tipo || script.categoria || '—'

  return (
    <div className="card overflow-hidden">
      <button className="w-full flex items-center gap-3 p-4 text-left hover:bg-dark-surface2 transition-colors" onClick={() => setOpen(o => !o)}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-brand-accent/10">
          <FileText className="w-4 h-4 text-brand-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-dark-text text-sm truncate">{script.titulo}</p>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: '#6366F120', color: '#6366F1' }}>{tipo}</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-dark-muted" /> : <ChevronRight className="w-4 h-4 text-dark-muted" />}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-dark-border">
          <div className="mt-3 p-3 rounded-xl bg-dark-surface2 text-xs text-dark-text whitespace-pre-wrap leading-relaxed">
            {script.conteudo}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Modals ────────────────────────────────────────────────────────────────────

function ModalJornada({ onClose, onSave }) {
  const [form, setForm] = useState({ nome: '', descricao: '', etapaInput: '', etapas: [] })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const addEtapa = () => {
    if (!form.etapaInput.trim()) return
    setForm(p => ({ ...p, etapas: [...p.etapas, p.etapaInput.trim()], etapaInput: '' }))
  }
  const valido = form.nome.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-modal w-full max-w-lg relative z-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border">
          <h2 className="font-bold text-dark-text">Nova Jornada</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-dark-muted" /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Nome *</label>
            <input value={form.nome} onChange={e => set('nome', e.target.value)} className="input" autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Descrição</label>
            <textarea value={form.descricao} onChange={e => set('descricao', e.target.value)} rows={2} className="input resize-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Etapas</label>
            <div className="flex gap-2">
              <input value={form.etapaInput} onChange={e => set('etapaInput', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addEtapa()}
                className="input flex-1" placeholder="Nova etapa..." />
              <button onClick={addEtapa} className="btn-secondary px-3">+</button>
            </div>
            {form.etapas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.etapas.map((e, i) => (
                  <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-dark-surface2 border border-dark-border text-xs text-dark-text">
                    <span className="font-mono text-dark-muted">{i + 1}.</span> {e}
                    <button onClick={() => setForm(p => ({ ...p, etapas: p.etapas.filter((_,j) => j !== i) }))} className="ml-1 text-dark-muted hover:text-status-error">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={() => valido && onSave(form)} disabled={!valido} className="btn-primary flex-1">Criar Jornada</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ModalScript({ onClose, onSave }) {
  const [form, setForm] = useState({ titulo: '', tipo: 'Abordagem', conteudo: '' })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const valido = form.titulo.trim() && form.conteudo.trim()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-modal w-full max-w-lg relative z-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border">
          <h2 className="font-bold text-dark-text">Novo Script</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-dark-muted" /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Título *</label>
            <input value={form.titulo} onChange={e => set('titulo', e.target.value)} className="input" autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Tipo</label>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className="select w-full">
              {['Abordagem','Follow Up','Proposta','Fechamento','Objeção'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Conteúdo *</label>
            <textarea value={form.conteudo} onChange={e => set('conteudo', e.target.value)} rows={6} className="input resize-none" placeholder="Olá [Nome], ..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={() => valido && onSave(form)} disabled={!valido} className="btn-primary flex-1">Criar Script</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Jornadas() {
  const state = useComercial()
  const [tab,   setTab]   = useState('Jornadas')
  const [modal, setModal] = useState(null)

  const materiais = state.scripts.filter(s => (s.tipo || s.categoria) === 'Material')
  const scripts   = state.scripts.filter(s => (s.tipo || s.categoria) !== 'Material')

  function handleAddJornada(form) { journeyAdd({ nome: form.nome, descricao: form.descricao, etapas: form.etapas }); setModal(null) }
  function handleAddScript(form)  { scriptAdd(form); setModal(null) }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-dark-text">Jornadas & Materiais</h1>
          <p className="text-xs text-dark-muted mt-0.5">Playbooks, scripts e conteúdos de apoio</p>
        </div>
        {tab !== 'Materiais' && (
          <button onClick={() => setModal(tab)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> {tab === 'Jornadas' ? 'Nova Jornada' : 'Novo Script'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-dark-surface2 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t ? 'bg-dark-glass text-dark-text shadow-sm' : 'text-dark-muted hover:text-dark-text'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Jornadas */}
      {tab === 'Jornadas' && (
        <div className="space-y-3">
          {state.journeys.length === 0 ? (
            <div className="text-center py-16 text-dark-muted">
              <Map className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma jornada cadastrada</p>
            </div>
          ) : (
            state.journeys.map(j => <JourneyCard key={j.id} journey={j} leads={state.leads} />)
          )}
        </div>
      )}

      {/* Scripts */}
      {tab === 'Scripts' && (
        <div className="space-y-3">
          {scripts.length === 0 ? (
            <div className="text-center py-16 text-dark-muted">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum script cadastrado</p>
            </div>
          ) : (
            scripts.map(s => <ScriptCard key={s.id} script={s} />)
          )}
        </div>
      )}

      {/* Materiais */}
      {tab === 'Materiais' && (
        <div className="space-y-3">
          {materiais.length === 0 ? (
            <div className="text-center py-16 text-dark-muted">
              <Layers className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum material cadastrado</p>
            </div>
          ) : (
            materiais.map(s => <ScriptCard key={s.id} script={s} />)
          )}
          <button onClick={() => { setModal('Scripts'); }} className="btn-secondary text-sm">
            <Plus className="w-4 h-4 inline mr-1" /> Adicionar Material
          </button>
        </div>
      )}

      {/* Etiquetas */}
      {tab === 'Jornadas' && state.tags.length > 0 && (
        <div className="glass-panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-4 h-4 text-dark-muted" />
            <p className="text-sm font-semibold text-dark-text">Etiquetas Disponíveis</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {state.tags.map(t => (
              <span key={t.id} className="px-2 py-1 rounded-lg text-xs font-semibold" style={{ background: t.cor + '22', color: t.cor, border: `1px solid ${t.cor}44` }}>
                {t.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {modal === 'Jornadas' && <ModalJornada onClose={() => setModal(null)} onSave={handleAddJornada} />}
      {modal === 'Scripts'  && <ModalScript  onClose={() => setModal(null)} onSave={f => handleAddScript({ ...f, tipo: tab === 'Materiais' ? 'Material' : f.tipo })} />}
    </div>
  )
}
