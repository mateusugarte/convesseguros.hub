import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchNomesImobiliariasAll } from '../lib/fichas'
import { useToast } from '../contexts/ToastContext'
import { getEntityImageUrl, replaceEntityImage } from '../lib/entityMedia'
import {
  Building2, Plus, Pencil, Trash2, X, Check,
  ChevronRight, AlertCircle, Search, ChevronDown, ArrowLeft, Upload,
} from 'lucide-react'
import { PageHeader, MetricCard, DataCard } from '../components/ui'

// ── ImobiliariaSelector ───────────────────────────────────────────────────────
// Componente customizado para buscar e navegar rapidamente para uma imobiliária

function ImobiliariaSelector({ mapeadas }) {
  const navigate    = useNavigate()
  const [open,      setOpen]      = useState(false)
  const [busca,     setBusca]     = useState('')
  const [debounced, setDebounced] = useState('')
  const wrapRef   = useRef(null)
  const inputRef  = useRef(null)
  const timer     = useRef(null)

  // Debounce 300ms
  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setDebounced(busca), 300)
    return () => clearTimeout(timer.current)
  }, [busca])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else { setBusca(''); setDebounced('') }
  }, [open])

  useEffect(() => {
    if (!open) return
    function h(e) { if (!wrapRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const filtered = debounced.trim()
    ? mapeadas.filter(m => m.nome_canonico.toLowerCase().includes(debounced.toLowerCase()))
    : mapeadas.slice(0, 8)

  function navegar(id) {
    setOpen(false)
    navigate(`/imobiliarias/${id}`)
  }

  function initials(n) {
    return (n || '').split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase() || '?'
  }
  function avatarColor(n) {
    const c = ['#4A90D9','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#2B5BA8']
    let h = 0; for (let i = 0; i < (n||'').length; i++) h = n.charCodeAt(i) + ((h << 5) - h)
    return c[Math.abs(h) % c.length]
  }

  return (
    <div ref={wrapRef} className="relative w-full max-w-xs">
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-2xl border border-dark-border text-sm text-left transition-all hover:border-brand-accent/50 hover:shadow-sm"
        style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(8px)' }}
      >
        <Search className="w-3.5 h-3.5 text-dark-muted flex-shrink-0" />
        <span className="flex-1 text-dark-muted text-sm">Ir para imobiliária...</span>
        <ChevronDown className={`w-3.5 h-3.5 text-dark-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 glass-panel overflow-hidden animate-fade-in"
             style={{ minWidth: '280px', boxShadow: 'var(--glass-shadow-deep)' }}>
          {/* Campo de busca */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-dark-border">
            <Search className="w-3.5 h-3.5 text-dark-muted flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome..."
              className="flex-1 text-sm bg-transparent outline-none text-dark-text placeholder-dark-muted"
            />
            {busca && (
              <button onClick={() => setBusca('')} className="text-dark-muted hover:text-dark-text transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-dark-muted text-center py-5">Nenhuma encontrada</p>
            ) : filtered.map(imob => {
              const color = avatarColor(imob.nome_canonico)
              return (
                <button
                  key={imob.id}
                  onClick={() => navegar(imob.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-dark-surface/55 transition-all text-left"
                >
                  {getEntityImageUrl(imob.imagem_path, imob.imagem_url) ? (
                    <div className="w-8 h-8 rounded-lg overflow-hidden border border-dark-border/30 bg-white flex items-center justify-center flex-shrink-0">
                      <img src={getEntityImageUrl(imob.imagem_path, imob.imagem_url)} alt={imob.nome_canonico} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                      style={{ background: color }}
                    >
                      {initials(imob.nome_canonico)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-dark-text truncate">{imob.nome_canonico}</p>
                    <p className="text-[10px] text-dark-muted">
                      {imob.totalFichas} ficha{imob.totalFichas !== 1 ? 's' : ''} · {imob.aliases.length} variação{imob.aliases.length !== 1 ? 'ões' : ''}
                    </p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-dark-muted flex-shrink-0 opacity-50" />
                </button>
              )
            })}
          </div>

          {!debounced && mapeadas.length > 8 && (
            <div className="px-3 py-2 border-t border-dark-border">
              <p className="text-[10px] text-dark-muted text-center">
                {mapeadas.length - 8} imobiliárias — use a busca para filtrar
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Modal de Agrupamento / Criação / Edição ───────────────────────────────────

function ModalAgrupar({ modal, contagemPorNome, mapeadas, onClose, onSalvo, toast }) {
  const ehEditar  = modal?.mode === 'editar'
  const imobAtual = modal?.imob

  // modo: 'nova' | 'existente' — só relevante quando criando (não editando)
  const [modo,          setModo]          = useState('nova')
  const [imobSelecionada, setImobSelecionada] = useState('')
  const [buscaExistente, setBuscaExistente] = useState('')

  const [nomeCanonoco,  setNomeCanonoco]  = useState(imobAtual?.nome_canonico || '')
  const [aliasesModal,  setAliasesModal]  = useState(modal?.variacoes || imobAtual?.aliases || [])
  const [novoAlias,     setNovoAlias]     = useState('')
  const [imagemPreview, setImagemPreview] = useState(getEntityImageUrl(imobAtual?.imagem_path, imobAtual?.imagem_url || ''))
  const [imagemPreviewError, setImagemPreviewError] = useState(false)
  const [imagemFile,    setImagemFile]    = useState(null)
  const [salvando,      setSalvando]      = useState(false)

  const totalFichas = aliasesModal.reduce((s, v) => s + (contagemPorNome[v] || 0), 0)

  const mapeadasFiltradas = buscaExistente.trim()
    ? mapeadas.filter(m => m.nome_canonico.toLowerCase().includes(buscaExistente.toLowerCase()))
    : mapeadas

  function removerAlias(index) {
    setAliasesModal(prev => prev.filter((_, i) => i !== index))
  }

  function adicionarAlias() {
    const t = novoAlias.trim()
    if (!t) { setNovoAlias(''); return }
    setAliasesModal(prev => [...prev, t])
    setNovoAlias('')
  }

  function handleImagem(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setImagemFile(file)
    setImagemPreviewError(false)
    setImagemPreview(URL.createObjectURL(file))
  }

  async function salvar() {
    setSalvando(true)
    try {
      let imobId
      const aliasesNormalizados = aliasesModal.map(v => v.trim()).filter(Boolean)

      if (ehEditar && imobAtual) {
        // Atualizar nome canônico
        const { error } = await supabase.from('imobiliarias')
          .update({ nome_canonico: nomeCanonoco.trim() })
          .eq('id', imobAtual.id)
        if (error) throw error
        imobId = imobAtual.id
        // Limpar aliases antigos e reinserir, permitindo duplicatas quando necessário
        await supabase.from('imobiliaria_aliases').delete().eq('imobiliaria_id', imobId)
        if (aliasesNormalizados.length > 0) {
          const payload = aliasesNormalizados.map(v => ({ imobiliaria_id: imobId, alias: v }))
          const { error: err } = await supabase.from('imobiliaria_aliases')
            .insert(payload)
          if (err) throw err
        }

      } else if (modo === 'existente') {
        // Incluir variações em imobiliária existente
        // Permite registrar o mesmo alias mais de uma vez quando isso for necessário para o mapeamento
        if (!imobSelecionada || aliasesNormalizados.length === 0) {
          toast({ type: 'error', title: 'Selecione uma imobiliária e ao menos uma variação' })
          return
        }
        const payload = aliasesNormalizados.map(v => ({ imobiliaria_id: imobSelecionada, alias: v }))
        const { error } = await supabase.from('imobiliaria_aliases')
          .insert(payload)
        if (error) throw error

      } else {
        // Criar nova imobiliária
        if (!nomeCanonoco.trim()) {
          toast({ type: 'error', title: 'Informe o nome da imobiliária' })
          return
        }
        const { data: existe } = await supabase.from('imobiliarias')
          .select('id').eq('nome_canonico', nomeCanonoco.trim()).maybeSingle()

        if (existe) {
          imobId = existe.id
        } else {
          const { data: novo, error } = await supabase.from('imobiliarias')
            .insert({ nome_canonico: nomeCanonoco.trim() })
            .select('id').single()
          if (error) throw error
          imobId = novo.id
        }

        if (aliasesNormalizados.length > 0) {
          const payload = aliasesNormalizados.map(v => ({ imobiliaria_id: imobId, alias: v }))
          const { error } = await supabase.from('imobiliaria_aliases')
            .insert(payload)
          if (error) throw error
        }
      }

      if ((ehEditar || modo === 'nova') && imagemFile && imobId) {
        const uploaded = await replaceEntityImage({
          file: imagemFile,
          entityType: 'imobiliaria',
          entityId: imobId,
          previousPath: imobAtual?.imagem_path || null,
        })
        if (uploaded.error) throw uploaded.error

        const { error: imagemError } = await supabase
          .from('imobiliarias')
          .update({ imagem_url: uploaded.url, imagem_path: uploaded.path })
          .eq('id', imobId)
        if (imagemError) throw imagemError
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

  const nomeExistenteSelecionado = mapeadas.find(m => m.id === imobSelecionada)?.nome_canonico

  const podeSalvar = ehEditar
    ? nomeCanonoco.trim()
    : modo === 'existente'
      ? !!imobSelecionada && aliasesModal.length > 0
      : nomeCanonoco.trim()

  return (
    <div className="animate-fade-in">
      <div className="glass-modal rounded-[24px] overflow-hidden">

        {/* Header */}
        <div className="modal-shell-header flex items-center gap-3 px-6 py-4 border-b border-dark-border/60">
          <button onClick={onClose} className="p-1.5 rounded-xl text-dark-muted hover:text-dark-text hover:bg-dark-surface2 transition-all flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="font-bold text-dark-text text-base">
            {ehEditar ? 'Editar Imobiliária' : 'Configurar Imobiliária'}
          </h2>
        </div>

        <div className="modal-shell-body px-6 py-5 space-y-5">

          {/* Toggle Nova / Existente — apenas no modo criar */}
          {!ehEditar && mapeadas.length > 0 && (
            <div className="flex rounded-lg border border-dark-border overflow-hidden text-sm font-medium">
              <button
                onClick={() => setModo('nova')}
                className={`flex-1 py-2 transition-colors ${
                  modo === 'nova'
                    ? 'bg-brand-accent text-white'
                    : 'text-dark-muted hover:text-dark-text'
                }`}
              >
                Criar nova imobiliária
              </button>
              <button
                onClick={() => setModo('existente')}
                className={`flex-1 py-2 transition-colors ${
                  modo === 'existente'
                    ? 'bg-brand-accent text-white'
                    : 'text-dark-muted hover:text-dark-text'
                }`}
              >
                Incluir em existente
              </button>
            </div>
          )}

          {/* Seleção de imobiliária existente */}
          {!ehEditar && modo === 'existente' ? (
            <div>
              <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">
                Selecionar imobiliária *
              </label>
              <div className="flex items-center gap-2 bg-dark-surface2 border border-dark-border rounded-lg px-3 py-2 mb-2">
                <Search className="w-4 h-4 text-dark-muted flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar imobiliária..."
                  value={buscaExistente}
                  onChange={e => setBuscaExistente(e.target.value)}
                  className="text-sm flex-1 outline-none bg-transparent text-dark-text placeholder-dark-muted"
                  autoFocus
                />
              </div>
              <div className="rounded-xl border border-dark-border divide-y divide-dark-border overflow-hidden max-h-40 overflow-y-auto">
                {mapeadasFiltradas.length === 0 ? (
                  <p className="text-center py-4 text-xs text-dark-muted">Nenhuma encontrada</p>
                ) : (
                  mapeadasFiltradas.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setImobSelecionada(m.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${
                        imobSelecionada === m.id
                          ? 'bg-brand-accent/10 text-status-info'
                          : 'text-dark-text hover:bg-dark-surface2/60'
                      }`}
                    >
                      <span className="text-sm font-medium truncate">{m.nome_canonico}</span>
                      <span className="text-xs text-dark-muted flex-shrink-0 ml-2">
                        {m.totalFichas} fichas
                      </span>
                    </button>
                  ))
                )}
              </div>
              {imobSelecionada && (
                <p className="text-[11px] text-dark-muted mt-1.5">
                  As variações serão adicionadas a{' '}
                  <span className="text-status-info font-semibold">"{nomeExistenteSelecionado}"</span>
                </p>
              )}
            </div>
          ) : (
            /* Nome canônico — modo nova ou editar */
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">
                  Como deve aparecer no sistema *
                </label>
                <input
                  value={nomeCanonoco}
                  onChange={e => setNomeCanonoco(e.target.value)}
                  placeholder="Ex: Guarulhos Imóveis"
                  className="input"
                  autoFocus={ehEditar || mapeadas.length === 0}
                />
                <p className="text-[11px] text-dark-muted mt-1">
                  Este nome aparecerá em todos os filtros, cards e relatórios.
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block">
                  Imagem da imobiliária
                </label>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="w-20 h-20 rounded-2xl border border-dark-border bg-dark-surface/70 overflow-hidden flex items-center justify-center">
                    {imagemPreview ? (
                      <img
                        src={imagemPreview}
                        alt={nomeCanonoco || 'Imobiliária'}
                        className="w-full h-full object-cover"
                        onError={() => setImagemPreviewError(true)}
                        onLoad={() => setImagemPreviewError(false)}
                      />
                    ) : (
                      <Building2 className="w-8 h-8 text-dark-muted/40" />
                    )}
                    </div>
                    {imagemPreviewError && (
                      <p className="max-w-20 text-[10px] leading-tight text-status-danger">
                        Falha ao carregar a imagem.
                      </p>
                    )}
                  </div>
                  <label className="btn-secondary text-sm cursor-pointer flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Enviar imagem
                    <input type="file" accept="image/*" className="hidden" onChange={handleImagem} />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Aliases */}
          <div>
            <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">
              Variações mapeadas
            </label>

            {aliasesModal.length === 0 ? (
              <p className="text-xs text-dark-muted italic">Nenhuma variação adicionada</p>
            ) : (
              <div className="rounded-xl border border-dark-border divide-y divide-dark-border overflow-hidden mb-2">
                {aliasesModal.map((v, index) => (
                  <div key={`${v}-${index}`} className="flex items-center justify-between px-3 py-2 hover:bg-dark-surface/50 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs text-dark-text truncate">{v}</span>
                      {contagemPorNome[v] !== undefined && (
                        <span className="text-[10px] text-dark-muted flex-shrink-0">
                          ({contagemPorNome[v]} ficha{contagemPorNome[v] !== 1 ? 's' : ''})
                        </span>
                      )}
                    </div>
                    <button onClick={() => removerAlias(index)} className="flex-shrink-0 p-1 rounded hover:bg-status-danger/15 text-dark-muted hover:text-status-danger transition-colors ml-2">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Adicionar alias manualmente */}
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

            {aliasesModal.length > 0 && (
              <p className="text-xs text-dark-muted mt-2">
                Total:{' '}
                <span className="font-semibold text-dark-text">{totalFichas}</span>{' '}
                ficha{totalFichas !== 1 ? 's' : ''} serão exibidas como{' '}
                <span className="text-status-info">
                  "{modo === 'existente' ? (nomeExistenteSelecionado || '...') : (nomeCanonoco || '...')}"
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-shell-footer flex justify-end gap-3 px-6 py-4 border-t border-dark-border/60">
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

// ── Tab: Mapeadas ─────────────────────────────────────────────────────────────

function TabMapeadas({ mapeadas, confirmExcluir, setConfirmExcluir, onExcluir, onEditar }) {
  const navigate = useNavigate()

  if (mapeadas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-dark-muted">
        <Building2 className="w-10 h-10 opacity-30" />
        <p className="text-sm">Nenhuma imobiliária configurada ainda</p>
        <p className="text-xs">Use a aba "Não Mapeadas" para agrupar variações</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {mapeadas.map(imob => (
        <div key={imob.id} className="glass-panel p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1 flex items-start gap-3">
              {getEntityImageUrl(imob.imagem_path, imob.imagem_url) ? (
                <div className="w-12 h-12 rounded-xl overflow-hidden border border-dark-border/30 bg-white flex items-center justify-center flex-shrink-0">
                  <img src={getEntityImageUrl(imob.imagem_path, imob.imagem_url)} alt={imob.nome_canonico} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0 bg-brand-accent">
                  {imob.nome_canonico.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase() || '?'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <button
                  onClick={() => navigate(`/imobiliarias/${imob.id}`)}
                  className="font-bold text-dark-text hover:text-status-info transition-colors text-left flex items-center gap-1.5 group"
                >
                  {imob.nome_canonico}
                  <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </button>
              <p className="text-xs text-dark-muted mt-0.5">
                {imob.aliases.length} variação{imob.aliases.length !== 1 ? 'ões' : ''}{' '}
                · {imob.totalFichas} ficha{imob.totalFichas !== 1 ? 's' : ''}
                {!imob.ativa && <span className="ml-2 text-status-warning">· Inativa</span>}
              </p>
              {imob.aliases.length > 0 && (
                <p className="text-[11px] text-dark-muted/60 mt-2 font-mono leading-relaxed">
                  {imob.aliases.join(' · ')}
                </p>
              )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => onEditar(imob)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dark-border text-xs text-dark-muted hover:text-dark-text hover:border-brand-accent/50 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> Editar
              </button>

              {confirmExcluir === imob.id ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-status-danger font-medium">Confirmar?</span>
                  <button
                    onClick={() => onExcluir(imob.id)}
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
                  onClick={() => setConfirmExcluir(imob.id)}
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
  )
}

// ── Tab: Não Mapeadas ─────────────────────────────────────────────────────────

function TabNaoMapeadas({ naoMapeadas, selecionados, setSelecionados, onAgrupar }) {
  const [busca, setBusca] = useState('')

  const filtradas = busca.trim()
    ? naoMapeadas.filter(n => n.nome.toLowerCase().includes(busca.toLowerCase()))
    : naoMapeadas

  function toggleSel(nome) {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(nome)) next.delete(nome)
      else next.add(nome)
      return next
    })
  }

  function toggleTodos() {
    if (selecionados.size === filtradas.length) {
      setSelecionados(new Set())
    } else {
      setSelecionados(new Set(filtradas.map(n => n.nome)))
    }
  }

  if (naoMapeadas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-dark-muted">
        <Check className="w-10 h-10 opacity-30" />
        <p className="text-sm">Todas as imobiliárias estão mapeadas!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Info + ações */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-dark-muted">
          Selecione as variações que são a mesma imobiliária:
        </p>
        {selecionados.size > 0 && (
          <button
            onClick={onAgrupar}
            className="btn-primary flex items-center gap-1.5 text-sm"
          >
            Agrupar selecionadas ({selecionados.size}) →
          </button>
        )}
      </div>

      {/* Busca */}
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

      {/* Lista */}
      <div className="card overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-dark-surface2/60 border-b border-dark-border">
          <input
            type="checkbox"
            checked={selecionados.size === filtradas.length && filtradas.length > 0}
            onChange={toggleTodos}
            className="w-4 h-4 rounded accent-brand-accent"
          />
          <span className="text-xs font-semibold text-dark-muted uppercase tracking-wider flex-1">
            Nome original
          </span>
          <span className="text-xs font-semibold text-dark-muted uppercase tracking-wider">
            Fichas
          </span>
        </div>

        {/* Rows */}
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
                onChange={() => toggleSel(n.nome)}
                className="w-4 h-4 rounded accent-brand-accent flex-shrink-0"
              />
              <span className="font-mono text-sm text-dark-text flex-1 truncate">{n.nome}</span>
              <span className="text-xs text-dark-muted flex-shrink-0 font-mono">
                {n.totalFichas}
              </span>
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
            Agrupar selecionadas ({selecionados.size}) →
          </button>
        </div>
      )}
    </div>
  )
}

// ── Tab: Cadastros ────────────────────────────────────────────────────────────

function TabCadastros({ mapeadas, seguradoras, vinculacoes, onToggleSeguradora, salvandoVinc }) {
  const [busca, setBusca] = useState('')
  const filtradas = busca.trim()
    ? mapeadas.filter(m => m.nome_canonico.toLowerCase().includes(busca.toLowerCase()))
    : mapeadas

  if (mapeadas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-dark-muted">
        <Building2 className="w-10 h-10 opacity-30" />
        <p className="text-sm">Nenhuma imobiliária mapeada ainda</p>
        <p className="text-xs">Configure imobiliárias na aba "Mapeamento" primeiro</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 bg-dark-surface2 border border-dark-border rounded-lg px-3 py-2 max-w-sm">
        <Search className="w-4 h-4 text-dark-muted flex-shrink-0" />
        <input
          type="text"
          placeholder="Buscar imobiliária..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="text-sm flex-1 outline-none bg-transparent text-dark-text placeholder-dark-muted"
        />
      </div>

      <div className="space-y-3">
        {filtradas.map(imob => {
          const segsVinc = new Set(vinculacoes[imob.id] || [])
          return (
            <div key={imob.id} className="glass-panel p-4">
              <p className="font-bold text-dark-text mb-1">{imob.nome_canonico}</p>
              <p className="text-xs text-dark-muted mb-3">
                {imob.totalFichas} ficha{imob.totalFichas !== 1 ? 's' : ''}
              </p>
              <div>
                <p className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider mb-2">
                  Seguradoras cadastradas
                </p>
                {seguradoras.length === 0 ? (
                  <p className="text-xs text-dark-muted italic">Nenhuma seguradora cadastrada no sistema</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {seguradoras.map(seg => {
                      const ativa = segsVinc.has(seg.id)
                      const key = `${imob.id}:${seg.id}`
                      return (
                        <button
                          key={seg.id}
                          disabled={salvandoVinc.has(key)}
                          onClick={() => onToggleSeguradora(imob.id, seg.id, ativa)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all disabled:opacity-50 ${
                            ativa
                              ? 'bg-status-success/15 text-status-success border-status-success/30'
                              : 'bg-dark-surface2 text-dark-muted border-dark-border hover:border-dark-muted'
                          }`}
                        >
                          {ativa ? <Check className="w-3.5 h-3.5 mr-1" /> : null}
                          {seg.nome_canonico}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {filtradas.length === 0 && (
          <p className="text-center py-8 text-sm text-dark-muted">Nenhuma imobiliária encontrada</p>
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Imobiliarias() {
  const toast = useToast()

  const [tab,             setTab]             = useState('mapeadas')
  const [loading,         setLoading]         = useState(true)
  const [mapeadas,        setMapeadas]        = useState([])
  const [naoMapeadas,     setNaoMapeadas]     = useState([])
  const [seguradoras,     setSeguradoras]     = useState([])
  const [vinculacoes,     setVinculacoes]     = useState({}) // { imob_id: [seg_id] }
  const [salvandoVinc,    setSalvandoVinc]    = useState(new Set())
  const [contagemPorNome, setContagemPorNome] = useState({})
  const [selecionados,    setSelecionados]    = useState(new Set())
  const [modal,           setModal]           = useState(null)
  const [confirmExcluir,  setConfirmExcluir]  = useState(null)

  const carregarDados = useCallback(async () => {
    setLoading(true)

    // 1. Nomes de imobiliária de fichas + apólices com contagem somada
    const [nomesData, { data: apolicesData }, { data: seguradoresData }, { data: vinculacoesData }] = await Promise.all([
      fetchNomesImobiliariasAll(),
      supabase.from('apolices').select('imobiliaria').not('imobiliaria', 'is', null),
      supabase.from('seguradoras').select('id, nome_canonico').eq('ativa', true).order('nome_canonico'),
      supabase.from('imobiliaria_seguradoras').select('imobiliaria_id, seguradora_id'),
    ])

    const contagem = {}
    nomesData?.forEach(f => {
      if (f.imobiliaria) contagem[f.imobiliaria] = (contagem[f.imobiliaria] || 0) + 1
    })
    apolicesData?.forEach(a => {
      if (a.imobiliaria) contagem[a.imobiliaria] = (contagem[a.imobiliaria] || 0) + 1
    })

    // 2. Imobiliárias configuradas com seus aliases
    const { data: imobiData } = await supabase
      .from('imobiliarias')
      .select('id, nome_canonico, ativa, imagem_url, imagem_path, imobiliaria_aliases(alias)')
      .order('nome_canonico')

    // 3. Conjunto de aliases mapeados (string exata)
    const aliasesMapeados = new Set()
    imobiData?.forEach(imob => {
      imob.imobiliaria_aliases?.forEach(a => aliasesMapeados.add(a.alias))
    })

    const mapeadasList = (imobiData || []).map(imob => {
      const aliases = imob.imobiliaria_aliases?.map(a => a.alias) || []
      const totalFichas = aliases.reduce((s, alias) => s + (contagem[alias] || 0), 0)
      return { ...imob, aliases, totalFichas }
    })

    const naoMapeadasList = Object.entries(contagem)
      .filter(([nome]) => !aliasesMapeados.has(nome))
      .map(([nome, totalFichas]) => ({ nome, totalFichas }))
      .sort((a, b) => b.totalFichas - a.totalFichas)

    // 4. Vinculations map
    const vinc = {}
    vinculacoesData?.forEach(v => {
      if (!vinc[v.imobiliaria_id]) vinc[v.imobiliaria_id] = []
      vinc[v.imobiliaria_id].push(v.seguradora_id)
    })

    setContagemPorNome(contagem)
    setMapeadas(mapeadasList)
    setNaoMapeadas(naoMapeadasList)
    setSeguradoras(seguradoresData || [])
    setVinculacoes(vinc)
    setLoading(false)
  }, [])

  useEffect(() => { carregarDados() }, [carregarDados])

  async function excluirImobiliaria(id) {
    await supabase.from('imobiliarias').delete().eq('id', id)
    setConfirmExcluir(null)
    toast({ type: 'success', title: 'Imobiliária excluída' })
    carregarDados()
  }

  function abrirAgrupar() {
    setModal({ mode: 'criar', variacoes: [...selecionados] })
  }

  function abrirEditar(imob) {
    setModal({ mode: 'editar', imob, variacoes: imob.aliases })
  }

  function abrirNova() {
    setModal({ mode: 'criar', variacoes: [] })
  }

  function aoSalvar() {
    setSelecionados(new Set())
    carregarDados()
  }

  async function toggleSeguradora(imobId, segId, estaAtiva) {
    const key = `${imobId}:${segId}`
    setSalvandoVinc(prev => new Set([...prev, key]))

    // Optimistic
    setVinculacoes(prev => {
      const atual = prev[imobId] || []
      return {
        ...prev,
        [imobId]: estaAtiva ? atual.filter(id => id !== segId) : [...atual, segId],
      }
    })

    let error
    if (estaAtiva) {
      ;({ error } = await supabase.from('imobiliaria_seguradoras')
        .delete().eq('imobiliaria_id', imobId).eq('seguradora_id', segId))
    } else {
      ;({ error } = await supabase.from('imobiliaria_seguradoras')
        .insert({ imobiliaria_id: imobId, seguradora_id: segId }))
    }

    if (error) {
      // Rollback
      setVinculacoes(prev => {
        const atual = prev[imobId] || []
        return {
          ...prev,
          [imobId]: estaAtiva ? [...atual, segId] : atual.filter(id => id !== segId),
        }
      })
      toast({ type: 'error', title: 'Erro ao atualizar vínculo', message: error.message })
    }
    setSalvandoVinc(prev => { const next = new Set(prev); next.delete(key); return next })
  }

  if (modal) return (
    <ModalAgrupar
      modal={modal}
      contagemPorNome={contagemPorNome}
      mapeadas={mapeadas}
      onClose={() => setModal(null)}
      onSalvo={aoSalvar}
      toast={toast}
    />
  )

  const totalAliases = mapeadas.reduce((acc, imob) => acc + (imob.aliases?.length || 0), 0)
  const totalVinculos = Object.values(vinculacoes).reduce((acc, arr) => acc + (arr?.length || 0), 0)

  return (
    <div className="min-h-full w-full space-y-5 animate-fade-in">
      <PageHeader
        eyebrow="Cadastro operacional"
        title="Imobiliárias"
        description="Mapeie variações de nomes, consolide cadastros e gerencie vínculos com seguradoras."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {mapeadas.length > 0 && <ImobiliariaSelector mapeadas={mapeadas} />}
            {tab !== 'cadastros' && (
              <button onClick={abrirNova} className="btn-primary flex items-center gap-2 text-sm">
                <Plus className="w-4 h-4" /> Nova Imobiliária
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard label="Imobiliárias mapeadas" value={mapeadas.length} />
        <MetricCard label="Sem mapeamento" value={naoMapeadas.length} />
        <MetricCard label="Variações ativas" value={totalAliases} />
        <MetricCard label="Vínculos com seguradoras" value={totalVinculos} />
      </div>

      <DataCard
        title="Operação"
        description="Use as abas para administrar mapeamento, pendências e vínculos."
        className="overflow-hidden"
      >
        <div className="flex items-center gap-1 border-b border-dark-border">
          {[
            ['mapeadas',     `Mapeamento (${mapeadas.length})`],
            ['nao_mapeadas', `Não Mapeadas (${naoMapeadas.length})`],
            ['cadastros',    `Cadastros (${mapeadas.length})`],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setTab(key); setSelecionados(new Set()) }}
              className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                tab === key
                  ? 'border-brand-accent text-status-info'
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

        <div className="pt-5">
          {loading ? (
            <div className="flex items-center justify-center h-48 gap-2 text-dark-muted text-sm">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Carregando...
            </div>
          ) : tab === 'mapeadas' ? (
            <TabMapeadas
              mapeadas={mapeadas}
              confirmExcluir={confirmExcluir}
              setConfirmExcluir={setConfirmExcluir}
              onExcluir={excluirImobiliaria}
              onEditar={abrirEditar}
            />
          ) : tab === 'nao_mapeadas' ? (
            <TabNaoMapeadas
              naoMapeadas={naoMapeadas}
              selecionados={selecionados}
              setSelecionados={setSelecionados}
              onAgrupar={abrirAgrupar}
            />
          ) : (
            <TabCadastros
              mapeadas={mapeadas}
              seguradoras={seguradoras}
              vinculacoes={vinculacoes}
              onToggleSeguradora={toggleSeguradora}
              salvandoVinc={salvandoVinc}
            />
          )}
        </div>
      </DataCard>
    </div>
  )
}

