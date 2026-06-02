import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'
import { Shield, Plus, Pencil, Trash2, X, Check, Search } from 'lucide-react'

// ── Modal Criar/Editar ────────────────────────────────────────────────────────

function ModalSeguradora({ modal, onClose, onSalvo, toast }) {
  const ehEditar  = modal?.mode === 'editar'
  const segAtual  = modal?.seg

  const [nome,       setNome]       = useState(segAtual?.nome_canonico || '')
  const [aliases,    setAliases]    = useState(segAtual?.aliases || [])
  const [novoAlias,  setNovoAlias]  = useState('')
  const [salvando,   setSalvando]   = useState(false)

  function removerAlias(a) { setAliases(prev => prev.filter(x => x !== a)) }

  function adicionarAlias() {
    const t = novoAlias.trim()
    if (!t || aliases.includes(t)) { setNovoAlias(''); return }
    setAliases(prev => [...prev, t])
    setNovoAlias('')
  }

  async function salvar() {
    if (!nome.trim()) return
    setSalvando(true)
    try {
      let segId

      if (ehEditar && segAtual) {
        const { error } = await supabase.from('seguradoras')
          .update({ nome_canonico: nome.trim() })
          .eq('id', segAtual.id)
        if (error) throw error
        segId = segAtual.id
        await supabase.from('seguradora_aliases').delete().eq('seguradora_id', segId)
      } else {
        const { data: existe } = await supabase.from('seguradoras')
          .select('id').eq('nome_canonico', nome.trim()).maybeSingle()
        if (existe) {
          segId = existe.id
        } else {
          const { data: novo, error } = await supabase.from('seguradoras')
            .insert({ nome_canonico: nome.trim() })
            .select('id').single()
          if (error) throw error
          segId = novo.id
        }
      }

      if (aliases.length > 0) {
        const payload = aliases.map(a => ({ seguradora_id: segId, alias: a.trim() }))
        const { error } = await supabase.from('seguradora_aliases')
          .insert(payload)
        if (error) throw error
      }

      toast({ type: 'success', title: 'Seguradora salva!' })
      onSalvo()
      onClose()
    } catch (e) {
      toast({ type: 'error', title: 'Erro ao salvar', message: e.message })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-dark-surface border border-dark-border rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border">
          <h2 className="font-bold text-dark-text text-base">
            {ehEditar ? 'Editar Seguradora' : 'Nova Seguradora'}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">
              Nome canônico *
            </label>
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Porto Seguro"
              className="input"
              autoFocus
            />
            <p className="text-[11px] text-dark-muted mt-1">
              Nome que aparecerá em todo o sistema.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">
              Variações mapeadas
            </label>

            {aliases.length === 0 ? (
              <p className="text-xs text-dark-muted italic mb-2">Nenhuma variação adicionada</p>
            ) : (
              <div className="rounded-xl border border-dark-border divide-y divide-dark-border overflow-hidden mb-2">
                {aliases.map(a => (
                  <div key={a} className="flex items-center justify-between px-3 py-2 hover:bg-dark-surface2/40">
                    <span className="font-mono text-xs text-dark-text truncate">{a}</span>
                    <button
                      onClick={() => removerAlias(a)}
                      className="flex-shrink-0 p-1 rounded hover:bg-status-danger/15 text-dark-muted hover:text-status-danger transition-colors ml-2"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                value={novoAlias}
                onChange={e => setNovoAlias(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && adicionarAlias()}
                placeholder="Adicionar variação..."
                className="input text-xs py-1.5 flex-1"
              />
              <button
                onClick={adicionarAlias}
                disabled={!novoAlias.trim()}
                className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-dark-border">
          <button onClick={onClose} className="btn-secondary text-sm">Cancelar</button>
          <button
            onClick={salvar}
            disabled={!nome.trim() || salvando}
            className="btn-primary text-sm"
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Seguradoras() {
  const toast = useToast()

  const [seguradoras,    setSeguradoras]    = useState([])
  const [loading,        setLoading]        = useState(true)
  const [busca,          setBusca]          = useState('')
  const [modal,          setModal]          = useState(null)
  const [confirmExcluir, setConfirmExcluir] = useState(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('seguradoras')
      .select('id, nome_canonico, ativa, seguradora_aliases(alias)')
      .order('nome_canonico')
    setSeguradoras((data || []).map(s => ({
      ...s,
      aliases: s.seguradora_aliases?.map(a => a.alias) || [],
    })))
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function excluir(id) {
    const { error } = await supabase.from('seguradoras').delete().eq('id', id)
    setConfirmExcluir(null)
    if (error) {
      toast({ type: 'error', title: 'Erro ao excluir', message: error.message })
    } else {
      toast({ type: 'success', title: 'Seguradora excluída' })
      carregar()
    }
  }

  const filtradas = busca.trim()
    ? seguradoras.filter(s =>
        s.nome_canonico.toLowerCase().includes(busca.toLowerCase()) ||
        s.aliases.some(a => a.toLowerCase().includes(busca.toLowerCase()))
      )
    : seguradoras

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-dark-text">Seguradoras</h1>
          <p className="text-xs text-dark-muted mt-0.5">
            Cadastro de seguradoras e mapeamento de variações de nomes
          </p>
        </div>
        <button onClick={() => setModal({ mode: 'criar' })} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Nova Seguradora
        </button>
      </div>

      {/* Busca */}
      <div className="flex items-center gap-2 bg-dark-surface2 border border-dark-border rounded-lg px-3 py-2 max-w-sm">
        <Search className="w-4 h-4 text-dark-muted flex-shrink-0" />
        <input
          type="text"
          placeholder="Buscar seguradora ou variação..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="text-sm flex-1 outline-none bg-transparent text-dark-text placeholder-dark-muted"
        />
        {busca && (
          <button onClick={() => setBusca('')} className="text-dark-muted hover:text-dark-text">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center h-48 gap-2 text-dark-muted text-sm">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Carregando...
        </div>
      ) : filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-dark-muted">
          <Shield className="w-10 h-10 opacity-30" />
          <p className="text-sm">{busca ? 'Nenhuma seguradora encontrada' : 'Nenhuma seguradora cadastrada'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtradas.map(seg => (
            <div key={seg.id} className="card p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-dark-text">{seg.nome_canonico}</p>
                  <p className="text-xs text-dark-muted mt-0.5">
                    {seg.aliases.length} variação{seg.aliases.length !== 1 ? 'ões' : ''}
                    {!seg.ativa && <span className="ml-2 text-status-warning">· Inativa</span>}
                  </p>
                  {seg.aliases.length > 0 && (
                    <p className="text-[11px] text-dark-muted/60 mt-2 font-mono leading-relaxed">
                      {seg.aliases.join(' · ')}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setModal({ mode: 'editar', seg, aliases: seg.aliases })}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dark-border text-xs text-dark-muted hover:text-dark-text hover:border-brand-accent/50 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>

                  {confirmExcluir === seg.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-status-danger font-medium">Confirmar?</span>
                      <button
                        onClick={() => excluir(seg.id)}
                        className="px-2 py-1 rounded bg-status-danger text-white text-xs hover:opacity-90"
                      >
                        Sim
                      </button>
                      <button
                        onClick={() => setConfirmExcluir(null)}
                        className="px-2 py-1 rounded border border-dark-border text-xs text-dark-muted hover:text-dark-text"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmExcluir(seg.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-status-danger/30 text-xs text-status-danger hover:bg-status-danger/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <ModalSeguradora
          modal={modal}
          onClose={() => setModal(null)}
          onSalvo={() => { carregar(); setModal(null) }}
          toast={toast}
        />
      )}
    </div>
  )
}
