import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'
import SeguradoraBadge from '../components/SeguradoraBadge'
import { Shield, Plus, Pencil, Trash2, X, Check, Search, ArrowLeft } from 'lucide-react'

// ── Modal Agrupar / Criar / Editar ────────────────────────────────────────────

function ModalSeguradora({ modal, cadastradas, onClose, onSalvo, toast }) {
  const ehEditar   = modal?.mode === 'editar'
  const segAtual   = modal?.seg
  const variacoes  = modal?.variacoes || []  // nomes não mapeados pré-selecionados

  const [modo,           setModo]           = useState('nova')
  const [segExistente,   setSegExistente]   = useState('')
  const [buscaExistente, setBuscaExistente] = useState('')
  const [nome,           setNome]           = useState(segAtual?.nome_canonico || '')
  const [aliases,        setAliases]        = useState(segAtual?.aliases || variacoes)
  const [salvando,       setSalvando]       = useState(false)

  const cadastradasFiltradas = buscaExistente.trim()
    ? cadastradas.filter(s => s.nome_canonico.toLowerCase().includes(buscaExistente.toLowerCase()))
    : cadastradas

  function removerAlias(a) { setAliases(prev => prev.filter(x => x !== a)) }

  async function salvar() {
    setSalvando(true)
    try {
      let segId

      if (ehEditar && segAtual) {
        const { error } = await supabase.from('seguradoras')
          .update({ nome_canonico: nome.trim() }).eq('id', segAtual.id)
        if (error) throw error
        segId = segAtual.id
        await supabase.from('seguradora_aliases').delete().eq('seguradora_id', segId)

      } else if (modo === 'existente') {
        if (!segExistente || aliases.length === 0) {
          toast({ type: 'error', title: 'Selecione uma seguradora e ao menos uma variação' })
          return
        }
        segId = segExistente

      } else {
        if (!nome.trim()) { toast({ type: 'error', title: 'Informe o nome da seguradora' }); return }
        const { data: existe } = await supabase.from('seguradoras')
          .select('id').eq('nome_canonico', nome.trim()).maybeSingle()
        segId = existe?.id
        if (!segId) {
          const { data: novo, error } = await supabase.from('seguradoras')
            .insert({ nome_canonico: nome.trim() }).select('id').single()
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

      toast({ type: 'success', title: 'Configuração salva!' })
      onSalvo()
      onClose()
    } catch (e) {
      toast({ type: 'error', title: 'Erro ao salvar', message: e.message })
    } finally {
      setSalvando(false)
    }
  }

  const nomeSelecionado = cadastradas.find(s => s.id === segExistente)?.nome_canonico
  const podeSalvar = ehEditar
    ? nome.trim()
    : modo === 'existente'
      ? !!segExistente && aliases.length > 0
      : nome.trim()

  return (
    <div className="animate-fade-in">
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-dark-border">
          <button onClick={onClose} className="p-1.5 rounded-xl text-dark-muted hover:text-dark-text hover:bg-dark-surface2 transition-all flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="font-bold text-dark-text text-base">
            {ehEditar ? 'Editar Seguradora' : 'Configurar Seguradora'}
          </h2>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Toggle Nova / Existente — só ao criar */}
          {!ehEditar && cadastradas.length > 0 && (
            <div className="flex rounded-lg border border-dark-border overflow-hidden text-sm font-medium">
              <button
                onClick={() => setModo('nova')}
                className={`flex-1 py-2 transition-colors ${modo === 'nova' ? 'bg-brand-accent text-white' : 'text-dark-muted hover:text-dark-text'}`}
              >
                Criar nova
              </button>
              <button
                onClick={() => setModo('existente')}
                className={`flex-1 py-2 transition-colors ${modo === 'existente' ? 'bg-brand-accent text-white' : 'text-dark-muted hover:text-dark-text'}`}
              >
                Incluir em existente
              </button>
            </div>
          )}

          {/* Seleção de seguradora existente */}
          {!ehEditar && modo === 'existente' ? (
            <div>
              <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">
                Selecionar seguradora *
              </label>
              <div className="flex items-center gap-2 bg-dark-surface2 border border-dark-border rounded-lg px-3 py-2 mb-2">
                <Search className="w-4 h-4 text-dark-muted flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={buscaExistente}
                  onChange={e => setBuscaExistente(e.target.value)}
                  className="text-sm flex-1 outline-none bg-transparent text-dark-text placeholder-dark-muted"
                  autoFocus
                />
              </div>
              <div className="rounded-xl border border-dark-border divide-y divide-dark-border overflow-hidden max-h-40 overflow-y-auto">
                {cadastradasFiltradas.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSegExistente(s.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors ${
                      segExistente === s.id
                        ? 'bg-brand-accent/10 text-brand-accent'
                        : 'text-dark-text hover:bg-dark-surface2/60'
                    }`}
                  >
                    <SeguradoraBadge nome={s.nome_canonico} size="xs" showName={false} />
                    <span className="text-sm font-medium">{s.nome_canonico}</span>
                  </button>
                ))}
              </div>
              {segExistente && (
                <p className="text-[11px] text-dark-muted mt-1.5">
                  Variações serão adicionadas a{' '}
                  <span className="text-brand-accent font-semibold">"{nomeSelecionado}"</span>
                </p>
              )}
            </div>
          ) : (
            /* Nome canônico */
            <div>
              <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">
                Como deve aparecer no sistema *
              </label>
              <input
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: Porto Seguro"
                className="input"
                autoFocus={ehEditar || cadastradas.length === 0}
              />
            </div>
          )}

          {/* Variações */}
          <div>
            <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">
              Variações mapeadas
            </label>
            {aliases.length === 0 ? (
              <p className="text-xs text-dark-muted italic mb-2">Nenhuma variação adicionada</p>
            ) : (
              <div className="rounded-xl border border-dark-border divide-y divide-dark-border overflow-hidden mb-2 max-h-44 overflow-y-auto">
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
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-dark-border">
          <button onClick={onClose} className="btn-secondary text-sm">Cancelar</button>
          <button
            onClick={salvar}
            disabled={!podeSalvar || salvando}
            className="btn-primary text-sm"
          >
            {salvando ? 'Salvando...' : 'Salvar Configuração'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Cadastradas ──────────────────────────────────────────────────────────

function TabCadastradas({ seguradoras, onEditar, onExcluir, confirmExcluir, setConfirmExcluir }) {
  const [busca, setBusca] = useState('')
  const filtradas = busca.trim()
    ? seguradoras.filter(s =>
        s.nome_canonico.toLowerCase().includes(busca.toLowerCase()) ||
        s.aliases.some(a => a.toLowerCase().includes(busca.toLowerCase()))
      )
    : seguradoras

  if (seguradoras.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-dark-muted">
        <Shield className="w-10 h-10 opacity-30" />
        <p className="text-sm">Nenhuma seguradora cadastrada ainda</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 bg-dark-surface2 border border-dark-border rounded-lg px-3 py-2 max-w-sm">
        <Search className="w-4 h-4 text-dark-muted flex-shrink-0" />
        <input
          type="text"
          placeholder="Buscar seguradora ou variação..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="text-sm flex-1 outline-none bg-transparent text-dark-text placeholder-dark-muted"
        />
        {busca && <button onClick={() => setBusca('')} className="text-dark-muted hover:text-dark-text"><X className="w-3.5 h-3.5" /></button>}
      </div>

      <div className="space-y-3">
        {filtradas.map(seg => (
          <div key={seg.id} className="card p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <SeguradoraBadge nome={seg.nome_canonico} size="md" />
                <p className="text-xs text-dark-muted mt-2">
                  {seg.aliases.length} variação{seg.aliases.length !== 1 ? 'ões' : ''}
                  {!seg.ativa && <span className="ml-2 text-status-warning">· Inativa</span>}
                </p>
                {seg.aliases.length > 0 && (
                  <p className="text-[11px] text-dark-muted/60 mt-1.5 font-mono leading-relaxed">
                    {seg.aliases.join(' · ')}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => onEditar(seg)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dark-border text-xs text-dark-muted hover:text-dark-text hover:border-brand-accent/50 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </button>
                {confirmExcluir === seg.id ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-status-danger font-medium">Confirmar?</span>
                    <button onClick={() => onExcluir(seg.id)} className="px-2 py-1 rounded bg-status-danger text-white text-xs hover:opacity-90">Sim</button>
                    <button onClick={() => setConfirmExcluir(null)} className="px-2 py-1 rounded border border-dark-border text-xs text-dark-muted hover:text-dark-text">Não</button>
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
        {filtradas.length === 0 && (
          <p className="text-center py-8 text-sm text-dark-muted">Nenhuma seguradora encontrada</p>
        )}
      </div>
    </div>
  )
}

// ── Tab: Não Mapeadas ─────────────────────────────────────────────────────────

function TabNaoMapeadas({ naoMapeadas, selecionados, setSelecionados, onAgrupar }) {
  const [busca, setBusca] = useState('')
  const filtradas = busca.trim()
    ? naoMapeadas.filter(n => n.nome.toLowerCase().includes(busca.toLowerCase()))
    : naoMapeadas

  function toggle(nome) {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(nome)) next.delete(nome); else next.add(nome)
      return next
    })
  }

  function toggleTodos() {
    setSelecionados(
      selecionados.size === filtradas.length
        ? new Set()
        : new Set(filtradas.map(n => n.nome))
    )
  }

  if (naoMapeadas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-dark-muted">
        <Check className="w-10 h-10 opacity-30" />
        <p className="text-sm">Todas as seguradoras estão mapeadas!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-dark-muted">
          Selecione as variações para mapear a uma seguradora:
        </p>
        {selecionados.size > 0 && (
          <button onClick={onAgrupar} className="btn-primary flex items-center gap-1.5 text-sm">
            Mapear selecionadas ({selecionados.size}) →
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 bg-dark-surface2 border border-dark-border rounded-lg px-3 py-2">
        <Search className="w-4 h-4 text-dark-muted flex-shrink-0" />
        <input
          type="text"
          placeholder="Filtrar variações..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="text-sm flex-1 outline-none bg-transparent text-dark-text placeholder-dark-muted"
        />
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2.5 bg-dark-surface2/60 border-b border-dark-border">
          <input
            type="checkbox"
            checked={selecionados.size === filtradas.length && filtradas.length > 0}
            onChange={toggleTodos}
            className="w-4 h-4 rounded accent-brand-accent"
          />
          <span className="text-xs font-semibold text-dark-muted uppercase tracking-wider flex-1">Nome encontrado no sistema</span>
          <span className="text-xs font-semibold text-dark-muted uppercase tracking-wider">Fichas</span>
        </div>

        <div className="divide-y divide-dark-border max-h-[480px] overflow-y-auto">
          {filtradas.map(n => (
            <label
              key={n.nome}
              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                selecionados.has(n.nome) ? 'bg-brand-accent/5' : 'hover:bg-dark-surface2/40'
              }`}
            >
              <input
                type="checkbox"
                checked={selecionados.has(n.nome)}
                onChange={() => toggle(n.nome)}
                className="w-4 h-4 rounded accent-brand-accent flex-shrink-0"
              />
              <span className="font-mono text-sm text-dark-text flex-1 truncate">{n.nome}</span>
              <span className="text-xs text-dark-muted flex-shrink-0 font-mono">{n.total}</span>
            </label>
          ))}
          {filtradas.length === 0 && (
            <p className="text-center py-8 text-sm text-dark-muted">Nenhum resultado</p>
          )}
        </div>
      </div>

      {selecionados.size > 0 && (
        <div className="flex justify-end">
          <button onClick={onAgrupar} className="btn-primary flex items-center gap-1.5 text-sm">
            Mapear selecionadas ({selecionados.size}) →
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Seguradoras() {
  const toast = useToast()

  const [tab,            setTab]            = useState('cadastradas')
  const [loading,        setLoading]        = useState(true)
  const [seguradoras,    setSeguradoras]    = useState([])
  const [naoMapeadas,    setNaoMapeadas]    = useState([])
  const [selecionados,   setSelecionados]   = useState(new Set())
  const [modal,          setModal]          = useState(null)
  const [confirmExcluir, setConfirmExcluir] = useState(null)

  const carregar = useCallback(async () => {
    setLoading(true)

    // 1. Nomes de seguradora de fichas + apólices
    const [{ data: fichasData }, { data: apolicesData }, { data: segsData }] = await Promise.all([
      supabase.from('fichas').select('seguradora').not('seguradora', 'is', null),
      supabase.from('apolices').select('seguradora').not('seguradora', 'is', null),
      supabase.from('seguradoras')
        .select('id, nome_canonico, ativa, seguradora_aliases(alias)')
        .order('nome_canonico'),
    ])

    // Contagem de fichas + apólices por nome
    const contagem = {}
    fichasData?.forEach(f => { if (f.seguradora) contagem[f.seguradora] = (contagem[f.seguradora] || 0) + 1 })
    apolicesData?.forEach(a => { if (a.seguradora) contagem[a.seguradora] = (contagem[a.seguradora] || 0) + 1 })

    // Conjunto de nomes já mapeados (aliases + nomes canônicos)
    const mapeados = new Set()
    segsData?.forEach(s => {
      mapeados.add(s.nome_canonico.toLowerCase())
      s.seguradora_aliases?.forEach(al => mapeados.add(al.alias.toLowerCase()))
    })

    const segs = (segsData || []).map(s => ({
      ...s,
      aliases: s.seguradora_aliases?.map(a => a.alias) || [],
    }))

    const naoMap = Object.entries(contagem)
      .filter(([nome]) => !mapeados.has(nome.toLowerCase()))
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total)

    setSeguradoras(segs)
    setNaoMapeadas(naoMap)
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function excluir(id) {
    const { error } = await supabase.from('seguradoras').delete().eq('id', id)
    setConfirmExcluir(null)
    if (error) toast({ type: 'error', title: 'Erro ao excluir', message: error.message })
    else { toast({ type: 'success', title: 'Seguradora excluída' }); carregar() }
  }

  function abrirAgrupar() {
    setModal({ mode: 'criar', variacoes: [...selecionados] })
  }

  function aoSalvar() {
    setSelecionados(new Set())
    carregar()
  }

  if (modal) return (
    <ModalSeguradora
      modal={modal}
      cadastradas={seguradoras}
      onClose={() => setModal(null)}
      onSalvo={aoSalvar}
      toast={toast}
    />
  )

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="title-page text-dark-text">Seguradoras</h1>
          <p className="text-xs text-dark-muted mt-0.5">
            Cadastro e mapeamento de variações de nomes das seguradoras
          </p>
        </div>
        {tab === 'cadastradas' && (
          <button onClick={() => setModal({ mode: 'criar', variacoes: [] })} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Nova Seguradora
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-dark-border">
        {[
          ['cadastradas',  `Cadastradas (${seguradoras.length})`],
          ['nao_mapeadas', `Não Mapeadas (${naoMapeadas.length})`],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setTab(key); setSelecionados(new Set()) }}
            className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
              tab === key
                ? 'border-brand-accent text-brand-accent'
                : 'border-transparent text-dark-muted hover:text-dark-text'
            }`}
          >
            {label}
          </button>
        ))}
        {naoMapeadas.length > 0 && tab !== 'nao_mapeadas' && (
          <span className="ml-2 bg-status-warning/15 text-status-warning text-[10px] font-bold px-2 py-0.5 rounded-full">
            {naoMapeadas.length} sem mapeamento
          </span>
        )}
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="flex items-center justify-center h-48 gap-2 text-dark-muted text-sm">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Carregando...
        </div>
      ) : tab === 'cadastradas' ? (
        <TabCadastradas
          seguradoras={seguradoras}
          onEditar={seg => setModal({ mode: 'editar', seg, variacoes: seg.aliases })}
          onExcluir={excluir}
          confirmExcluir={confirmExcluir}
          setConfirmExcluir={setConfirmExcluir}
        />
      ) : (
        <TabNaoMapeadas
          naoMapeadas={naoMapeadas}
          selecionados={selecionados}
          setSelecionados={setSelecionados}
          onAgrupar={abrirAgrupar}
        />
      )}

    </div>
  )
}

