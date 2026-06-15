import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'
import { ArrowLeft, Pencil, X, Check, Plus } from 'lucide-react'
import { Select } from '../components/ui/Select'
import { PageHeader, MetricCard, DataCard } from '../components/ui'
import { fetchCodigos, fetchSeguradoras, upsertCodigo, deletarCodigo } from '../lib/imobiliariasCodigos'

function CampoEditavel({ label, value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (draft === (value || '')) {
      setEditing(false)
      return
    }
    setSaving(true)
    await onSave(draft.trim())
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <div>
        <p className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider mb-1">{label}</p>
        <div className="flex items-center gap-1.5">
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') {
                setEditing(false)
                setDraft(value || '')
              }
            }}
            autoFocus
            className="input text-sm py-1.5 flex-1"
          />
          <button onClick={save} disabled={saving} className="p-1.5 rounded-lg bg-status-success/20 text-status-success hover:bg-status-success/30">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { setEditing(false); setDraft(value || '') }} className="p-1.5 rounded-lg border border-dark-border text-dark-muted hover:text-dark-text">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider mb-1">{label}</p>
      <p
        onClick={() => { setDraft(value || ''); setEditing(true) }}
        className="text-sm text-dark-text cursor-pointer group flex items-center gap-1.5 hover:text-brand-accent transition-colors"
      >
        <span>{value || <span className="italic text-dark-muted/40">—</span>}</span>
        <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-40 flex-shrink-0" />
      </p>
    </div>
  )
}

function CampoEmBreve({ label }) {
  return (
    <div className="relative opacity-50">
      <p className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider mb-1">{label}</p>
      <div className="h-9 bg-dark-surface2 rounded-lg border border-dark-border" />
      <span className="absolute top-0 right-0 text-[9px] font-bold px-2 py-0.5 rounded-full bg-brand-gold/15 text-brand-gold border border-brand-gold/25">
        Em Breve
      </span>
    </div>
  )
}

export default function ImobiliariaDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const [imob, setImob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [novoAlias, setNovoAlias] = useState('')
  const [addingAlias, setAddingAlias] = useState(false)

  const [codigos, setCodigos] = useState([])
  const [seguradoras, setSeguradoras] = useState([])
  const [novoCodigo, setNovoCodigo] = useState({ seguradora_id: '', codigo: '' })
  const [salvandoCod, setSalvandoCod] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('imobiliarias')
      .select('id, nome_canonico, ativa, created_at, imobiliaria_aliases(id, alias)')
      .eq('id', id)
      .single()
    setImob(data)
    setLoading(false)
  }, [id])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    if (!id) return
    fetchCodigos(id).then(setCodigos)
    fetchSeguradoras().then(setSeguradoras)
  }, [id])

  async function updateField(field, value) {
    const { error } = await supabase.from('imobiliarias').update({ [field]: value }).eq('id', id)
    if (error) {
      toast({ type: 'error', title: 'Erro ao salvar' })
    } else {
      setImob(prev => ({ ...prev, [field]: value }))
      toast({ type: 'success', title: 'Salvo' })
    }
  }

  async function adicionarAlias() {
    const t = novoAlias.trim()
    if (!t) return
    setAddingAlias(true)
    const { error } = await supabase.from('imobiliaria_aliases').insert({ imobiliaria_id: id, alias: t })
    if (error) {
      toast({ type: 'error', title: 'Erro ao adicionar variação', message: error.message })
    } else {
      setNovoAlias('')
      toast({ type: 'success', title: 'Variação adicionada' })
      carregar()
    }
    setAddingAlias(false)
  }

  async function excluirAlias(aliasId) {
    await supabase.from('imobiliaria_aliases').delete().eq('id', aliasId)
    toast({ type: 'success', title: 'Variação removida' })
    carregar()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-dark-muted text-sm">
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Carregando...
      </div>
    )
  }

  if (!imob) {
    return (
      <div className="text-center py-20">
        <p className="text-dark-muted">Imobiliária não encontrada</p>
        <button onClick={() => navigate('/imobiliarias')} className="btn-secondary mt-4">← Voltar</button>
      </div>
    )
  }

  const aliases = imob.imobiliaria_aliases || []
  const totalCodigos = codigos.length

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        eyebrow="Cadastro operacional"
        title={imob.nome_canonico}
        description="Detalhe da imobiliária com edição inline, variações de nome e códigos por seguradora."
        actions={
          <button
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/imobiliarias'))}
            className="btn-secondary flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        }
        stats={[
          <MetricCard key="status" label="Status" value={imob.ativa ? 'Ativa' : 'Inativa'} />,
          <MetricCard key="variacoes" label="Variações" value={aliases.length} />,
          <MetricCard key="codigos" label="Códigos" value={totalCodigos} />,
          <MetricCard key="cadastro" label="Cadastrada em" value={new Date(imob.created_at).toLocaleDateString('pt-BR')} />,
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <DataCard title="Dados do sistema" description="Campos principais e status da imobiliária.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <CampoEditavel label="Nome no sistema" value={imob.nome_canonico} onSave={v => updateField('nome_canonico', v)} />
              <div>
                <p className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider mb-2">Status</p>
                <label className="flex items-center gap-3 cursor-pointer w-fit">
                  <div
                    onClick={() => updateField('ativa', !imob.ativa)}
                    className={`w-9 h-5 rounded-full transition-colors ${imob.ativa ? 'bg-status-success' : 'bg-dark-border'}`}
                  >
                    <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform m-[3px] ${imob.ativa ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                  <span className="text-sm text-dark-text">{imob.ativa ? 'Ativa' : 'Inativa'}</span>
                </label>
              </div>
            </div>
          </DataCard>

          <DataCard title="Variações de nome" description="Aliases usados para consolidar registros e buscas.">
            <div className="space-y-2 mb-4">
              {aliases.length === 0 && (
                <p className="text-xs text-dark-muted/50 italic">Nenhuma variação cadastrada</p>
              )}
              {aliases.map(a => (
                <div key={a.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-dark-border/50 last:border-0">
                  <span className="text-sm text-dark-text">{a.alias}</span>
                  <button
                    onClick={() => excluirAlias(a.id)}
                    className="text-status-danger/60 hover:text-status-danger transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={novoAlias}
                onChange={e => setNovoAlias(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && adicionarAlias()}
                placeholder="Adicionar nova variação..."
                className="input text-sm flex-1"
              />
              <button
                onClick={adicionarAlias}
                disabled={!novoAlias.trim() || addingAlias}
                className="btn-secondary px-3 py-1.5 text-xs gap-1 disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </button>
            </div>
          </DataCard>

          <DataCard title="Dados de parceria" description="Bloco reservado para evolução futura da operação.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <CampoEmBreve label="Responsável" />
              <CampoEmBreve label="Telefone" />
              <CampoEmBreve label="E-mail" />
              <CampoEmBreve label="Status da parceria" />
              <CampoEmBreve label="Volume mensal" />
              <CampoEmBreve label="Data de início" />
              <div className="sm:col-span-2">
                <CampoEmBreve label="Endereço" />
              </div>
            </div>
          </DataCard>
        </div>

        <div className="space-y-4">
          <DataCard title="Informações" description="Contexto técnico do cadastro atual.">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-dark-muted">ID</span>
                <span className="text-dark-muted font-mono text-[9px] truncate max-w-[140px]">{imob.id}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-dark-muted">Cadastrada em</span>
                <span className="text-dark-text font-mono text-[10px]">{new Date(imob.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-dark-muted">Variações</span>
                <span className="text-dark-text font-semibold">{aliases.length}</span>
              </div>
            </div>
          </DataCard>

          <DataCard title="Código por seguradora" description="Mapeamento de integração por seguradora.">
            <div className="space-y-1">
              {codigos.length === 0 && (
                <p className="text-xs text-dark-muted/50 text-center py-3">Nenhum código cadastrado</p>
              )}
              {codigos.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-dark-border/50 last:border-0">
                  <span className="text-xs text-dark-text">{c.seguradoras?.nome_canonico || '—'}</span>
                  <span className="text-xs font-mono text-dark-muted">{c.codigo}</span>
                  <button
                    onClick={async () => {
                      const err = await deletarCodigo(c.id)
                      if (!err) setCodigos(prev => prev.filter(x => x.id !== c.id))
                    }}
                    className="text-status-danger/60 hover:text-status-danger transition-colors flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 mt-4">
              <Select
                value={novoCodigo.seguradora_id}
                onChange={v => setNovoCodigo(p => ({ ...p, seguradora_id: v }))}
                placeholder="Seguradora..."
                options={[
                  { value: '', label: 'Seguradora...' },
                  ...seguradoras.map(s => ({ value: s.id, label: s.nome_canonico })),
                ]}
              />
              <div className="flex gap-2">
                <input
                  value={novoCodigo.codigo}
                  onChange={e => setNovoCodigo(p => ({ ...p, codigo: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && novoCodigo.seguradora_id && novoCodigo.codigo.trim() && document.getElementById('btn-add-codigo')?.click()}
                  placeholder="Código"
                  className="input text-sm flex-1"
                />
                <button
                  id="btn-add-codigo"
                  onClick={async () => {
                    if (!novoCodigo.seguradora_id || !novoCodigo.codigo.trim()) return
                    setSalvandoCod(true)
                    await upsertCodigo(id, novoCodigo.seguradora_id, novoCodigo.codigo.trim())
                    const fresh = await fetchCodigos(id)
                    setCodigos(fresh)
                    setNovoCodigo({ seguradora_id: '', codigo: '' })
                    setSalvandoCod(false)
                  }}
                  disabled={!novoCodigo.seguradora_id || !novoCodigo.codigo.trim() || salvandoCod}
                  className="btn-primary text-sm px-3"
                >
                  {salvandoCod ? '...' : 'Add'}
                </button>
              </div>
            </div>
          </DataCard>
        </div>
      </div>
    </div>
  )
}
