import { useState, useMemo } from 'react'
import { useComercial, leadUpdate, calcScore, scoreFaixa, diffDias, PIPELINE_COLS, PRODUTOS, ORIGENS, TAGS_DEFAULT } from '../../lib/comercial'
import { Search, Filter, X, ChevronDown, Phone, Building2, Clock, Tag, ArrowUpDown } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function ScoreBadge({ score }) {
  const f = scoreFaixa(score)
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ color: f.color, background: f.bg }}>
      <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: f.color }} />
      {score}
    </span>
  )
}

function ColTag({ colId }) {
  const col = PIPELINE_COLS.find(c => c.id === colId)
  if (!col) return null
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ color: col.color, background: col.color + '22' }}>
      {col.label}
    </span>
  )
}

// ── Side Panel ────────────────────────────────────────────────────────────────

function SidePanel({ lead, tags, journeys, onClose, onSave }) {
  const score = calcScore(lead)
  const f     = scoreFaixa(score)
  const [form, setForm] = useState({ proximaAcao: lead.proximaAcao || '', observacoes: lead.observacoes || '', resumo: lead.resumo || '', tags: lead.tags || [], jornadaId: lead.jornadaId || '' })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const toggleTag = (tid) => set('tags', form.tags.includes(tid) ? form.tags.filter(t => t !== tid) : [...form.tags, tid])

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex animate-fade-in">
      {/* Backdrop */}
      <div className="flex-1 cursor-pointer" onClick={onClose} />
      {/* Panel */}
      <div className="w-80 glass-modal flex flex-col overflow-y-auto h-full shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-dark-border flex-shrink-0">
          <div>
            <p className="font-bold text-dark-text">{lead.nome}</p>
            <div className="flex items-center gap-2 mt-1">
              <ColTag colId={lead.coluna} />
              <ScoreBadge score={score} />
            </div>
          </div>
          <button onClick={onClose} className="text-dark-muted hover:text-dark-text ml-2"><X className="w-4 h-4" /></button>
        </div>

        {/* Dados */}
        <div className="px-5 py-4 space-y-4 flex-1">
          <div className="space-y-2 text-sm">
            {lead.telefone && (
              <div className="flex items-center gap-2 text-dark-muted">
                <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="font-mono text-dark-text">{lead.telefone}</span>
              </div>
            )}
            {lead.imobiliaria && (
              <div className="flex items-center gap-2 text-dark-muted">
                <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-dark-text">{lead.imobiliaria}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-dark-muted">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="text-dark-text">{lead.ultimaAtividade ? `${diffDias(lead.ultimaAtividade)}d sem atividade` : 'Novo'}</span>
            </div>
          </div>

          <div className="h-px bg-dark-border" />

          {/* Score breakdown */}
          <div>
            <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-2">Score</p>
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: f.bg }}>
              <span className="text-3xl font-black font-mono" style={{ color: f.color }}>{score}</span>
              <div>
                <p className="font-bold text-sm" style={{ color: f.color }}>{f.label}</p>
                <p className="text-[10px] text-dark-muted">Calculado por critérios</p>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div>
            <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-2">Etiquetas</p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(t => (
                <button key={t.id} onClick={() => toggleTag(t.id)}
                  className="px-2 py-1 rounded text-xs font-medium border transition-all"
                  style={form.tags.includes(t.id) ? { borderColor: t.cor, background: t.cor + '22', color: t.cor } : { borderColor: 'var(--glass-border)', color: 'var(--glass-text-muted)' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">Próxima Ação</label>
            <input value={form.proximaAcao} onChange={e => set('proximaAcao', e.target.value)} className="input text-sm" placeholder="Ex: Ligar amanhã" />
          </div>
          <div>
            <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">Observações</label>
            <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={3} className="input text-sm resize-none" />
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
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
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

        {/* Footer */}
        <div className="px-5 py-4 border-t border-dark-border flex-shrink-0">
          <button onClick={() => onSave(lead.id, form)} className="btn-primary w-full text-sm">Salvar Alterações</button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

const SORT_OPTS = [
  { id: 'score_desc',    label: 'Score ↓' },
  { id: 'score_asc',     label: 'Score ↑' },
  { id: 'nome',          label: 'Nome A–Z' },
  { id: 'atividade',     label: 'Última Atividade' },
]

export default function BaseLeads() {
  const state    = useComercial()
  const [search, setSearch]   = useState('')
  const [colFil, setColFil]   = useState('')
  const [origemFil, setOrigemFil] = useState('')
  const [sortBy, setSortBy]   = useState('score_desc')
  const [panel, setPanel]     = useState(null)

  const filtered = useMemo(() => {
    let rows = [...state.leads]
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(l => l.nome.toLowerCase().includes(q) || (l.telefone || '').includes(q) || (l.imobiliaria || '').toLowerCase().includes(q))
    }
    if (colFil)     rows = rows.filter(l => l.coluna === colFil)
    if (origemFil)  rows = rows.filter(l => l.origem === origemFil)

    rows.sort((a, b) => {
      if (sortBy === 'score_desc') return calcScore(b) - calcScore(a)
      if (sortBy === 'score_asc')  return calcScore(a) - calcScore(b)
      if (sortBy === 'nome')       return a.nome.localeCompare(b.nome)
      if (sortBy === 'atividade')  return (b.ultimaAtividade || '') > (a.ultimaAtividade || '') ? 1 : -1
      return 0
    })
    return rows
  }, [state.leads, search, colFil, origemFil, sortBy])

  function handleSave(id, changes) {
    leadUpdate(id, changes)
    setPanel(null)
  }

  const hasFilters = colFil || origemFil || search

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-dark-text">Base de Leads</h1>
          <p className="text-xs text-dark-muted mt-0.5">{filtered.length} de {state.leads.length} leads</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel p-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, telefone, imobiliária..." className="input pl-8 text-sm py-1.5 w-full" />
        </div>
        <select value={colFil} onChange={e => setColFil(e.target.value)} className="select text-sm py-1.5">
          <option value="">Todas as colunas</option>
          {PIPELINE_COLS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select value={origemFil} onChange={e => setOrigemFil(e.target.value)} className="select text-sm py-1.5">
          <option value="">Todas as origens</option>
          {['Seguro Fiança','Indicação','Prospecção','Outros Produtos'].map(o => <option key={o}>{o}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="select text-sm py-1.5">
          {SORT_OPTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        {hasFilters && (
          <button onClick={() => { setSearch(''); setColFil(''); setOrigemFil('') }} className="text-xs text-dark-muted hover:text-dark-text flex items-center gap-1">
            <X className="w-3.5 h-3.5" /> Limpar
          </button>
        )}
      </div>

      {/* Table */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-border">
                {['Nome','Etapa','Score','Origem','Imobiliária','Última Atividade','Próxima Ação'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-dark-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-dark-muted text-sm py-12">Nenhum lead encontrado</td>
                </tr>
              ) : (
                filtered.map(lead => {
                  const score = calcScore(lead)
                  const dias  = lead.ultimaAtividade ? diffDias(lead.ultimaAtividade) : null
                  const leadTags = (lead.tags || []).map(tid => state.tags.find(t => t.id === tid)).filter(Boolean)
                  return (
                    <tr key={lead.id} onClick={() => setPanel(lead)}
                      className="border-b border-dark-border/50 hover:bg-dark-surface2 cursor-pointer transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-dark-text">{lead.nome}</p>
                        {leadTags.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {leadTags.slice(0,2).map(t => (
                              <span key={t.id} className="px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ color: t.cor, background: t.cor + '22' }}>{t.label}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3"><ColTag colId={lead.coluna} /></td>
                      <td className="px-4 py-3"><ScoreBadge score={score} /></td>
                      <td className="px-4 py-3 text-dark-muted text-xs">{lead.origem}</td>
                      <td className="px-4 py-3 text-dark-muted text-xs">{lead.imobiliaria || '—'}</td>
                      <td className="px-4 py-3">
                        {dias === null ? (
                          <span className="text-xs text-dark-muted">—</span>
                        ) : (
                          <span className={`text-xs font-medium ${dias >= 10 ? 'text-status-error' : dias >= 5 ? 'text-status-warning' : 'text-dark-muted'}`}>
                            {dias === 0 ? 'Hoje' : `${dias}d atrás`}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-brand-accent max-w-[160px] truncate">{lead.proximaAcao || '—'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side Panel */}
      {panel && (
        <SidePanel
          lead={panel}
          tags={state.tags}
          journeys={state.journeys}
          onClose={() => setPanel(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
