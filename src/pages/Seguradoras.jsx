import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Check, Plus, Pencil, Search, Shield, Trash2, Upload, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'
import { PRODUTO_LABELS } from '../lib/fichas'
import { PageHeader, MetricCard, DataCard } from '../components/ui'
import SeguradoraBadge from '../components/SeguradoraBadge'
import EntityDocumentsSection from '../components/EntityDocumentsSection'
import { replaceEntityImage, uploadEntityDocument } from '../lib/entityMedia'
import { SEGURADORA_PRODUTOS, invalidarCacheSeguradoras } from '../lib/seguradoras'

function fileTitle(fileName) {
  const parts = String(fileName || '').split('.')
  if (parts.length <= 1) return fileName
  parts.pop()
  return parts.join('.')
}

function ProductChooser({ value, onChange }) {
  function toggle(produto) {
    onChange(
      value.includes(produto)
        ? value.filter(item => item !== produto)
        : [...value, produto]
    )
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block">
        Produtos atendidos *
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {SEGURADORA_PRODUTOS.map(produto => {
          const active = value.includes(produto)
          return (
            <button
              key={produto}
              type="button"
              onClick={() => toggle(produto)}
              className={`rounded-xl border px-3 py-2 text-sm transition-all ${
                active
                  ? 'border-brand-accent bg-brand-accent/10 text-brand-accent'
                  : 'border-dark-border text-dark-muted hover:border-brand-accent/40 hover:text-dark-text'
              }`}
            >
              {PRODUTO_LABELS[produto] || produto}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PendingDocs({ docs, onTitleChange, onRemove }) {
  if (docs.length === 0) return null

  return (
    <div className="rounded-xl border border-dark-border overflow-hidden">
      <div className="px-3 py-2 border-b border-dark-border bg-dark-surface2/50">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-muted">
          Documentos que serao enviados ao salvar
        </p>
      </div>
      <div className="divide-y divide-dark-border">
        {docs.map(doc => (
          <div key={doc.id} className="px-3 py-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-dark-text truncate">{doc.file.name}</p>
                <p className="text-[10px] text-dark-muted truncate">{Math.round(doc.file.size / 1024)} KB</p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(doc.id)}
                className="p-1 rounded text-dark-muted hover:text-status-danger hover:bg-status-danger/10 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              value={doc.title}
              onChange={e => onTitleChange(doc.id, e.target.value)}
              className="input text-sm"
              placeholder="Titulo do documento"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function ModalSeguradora({ modal, cadastradas, onClose, onSalvo, toast }) {
  const ehEditar = modal?.mode === 'editar'
  const segAtual = modal?.seg
  const variacoes = modal?.variacoes || []

  const [modo, setModo] = useState('nova')
  const [segExistente, setSegExistente] = useState('')
  const [buscaExistente, setBuscaExistente] = useState('')
  const [nome, setNome] = useState(segAtual?.nome_canonico || '')
  const [aliases, setAliases] = useState(segAtual?.aliases || variacoes)
  const [produtos, setProdutos] = useState(segAtual?.produtos || [])
  const [logoPreview, setLogoPreview] = useState(segAtual?.logo_url || '')
  const [logoFile, setLogoFile] = useState(null)
  const [pendingDocs, setPendingDocs] = useState([])
  const [salvando, setSalvando] = useState(false)

  const cadastradasFiltradas = buscaExistente.trim()
    ? cadastradas.filter(seg => seg.nome_canonico.toLowerCase().includes(buscaExistente.toLowerCase()))
    : cadastradas

  function removerAlias(alias) {
    setAliases(prev => prev.filter(item => item !== alias))
  }

  function handleLogoChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  function handlePendingDocs(event) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    setPendingDocs(prev => [
      ...prev,
      ...files.map(file => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        title: fileTitle(file.name),
      })),
    ])
    event.target.value = ''
  }

  function updatePendingDocTitle(id, title) {
    setPendingDocs(prev => prev.map(doc => (
      doc.id === id ? { ...doc, title } : doc
    )))
  }

  function removePendingDoc(id) {
    setPendingDocs(prev => prev.filter(doc => doc.id !== id))
  }

  async function saveSeguradoraBase(segId) {
    if (ehEditar) {
      const { error } = await supabase
        .from('seguradoras')
        .update({ nome_canonico: nome.trim() })
        .eq('id', segId)
      if (error) throw error
    } else {
      const { data: existe } = await supabase
        .from('seguradoras')
        .select('id, logo_path')
        .eq('nome_canonico', nome.trim())
        .maybeSingle()

      if (existe?.id) return existe

      const { data: novo, error } = await supabase
        .from('seguradoras')
        .insert({ nome_canonico: nome.trim() })
        .select('id, logo_path')
        .single()
      if (error) throw error
      return novo
    }

    return { id: segId, logo_path: segAtual?.logo_path || null }
  }

  async function salvar() {
    setSalvando(true)
    try {
      let segId = segAtual?.id || null
      let currentLogoPath = segAtual?.logo_path || null

      if (ehEditar || modo === 'nova') {
        if (!nome.trim()) {
          toast({ type: 'error', title: 'Informe o nome da seguradora' })
          return
        }
        if (produtos.length === 0) {
          toast({ type: 'error', title: 'Selecione ao menos um produto' })
          return
        }

        const base = await saveSeguradoraBase(segId)
        segId = base.id
        currentLogoPath = base.logo_path || currentLogoPath

        if (logoFile) {
          const uploaded = await replaceEntityImage({
            file: logoFile,
            entityType: 'seguradora',
            entityId: segId,
            previousPath: currentLogoPath,
          })
          if (uploaded.error) throw uploaded.error

          const { error: updateLogoError } = await supabase
            .from('seguradoras')
            .update({ logo_url: uploaded.url, logo_path: uploaded.path })
            .eq('id', segId)
          if (updateLogoError) throw updateLogoError
        }

        await supabase.from('seguradora_aliases').delete().eq('seguradora_id', segId)
        await supabase.from('seguradora_produtos').delete().eq('seguradora_id', segId)

        if (aliases.length > 0) {
          const payload = aliases.map(alias => ({ seguradora_id: segId, alias: alias.trim() }))
          const { error } = await supabase.from('seguradora_aliases').upsert(payload, { onConflict: 'alias' })
          if (error) throw error
        }

        const productPayload = produtos.map(produto => ({ seguradora_id: segId, produto }))
        const { error: produtosError } = await supabase.from('seguradora_produtos').insert(productPayload)
        if (produtosError) throw produtosError
      } else {
        if (!segExistente || aliases.length === 0) {
          toast({ type: 'error', title: 'Selecione uma seguradora e ao menos uma variacao' })
          return
        }
        segId = segExistente
        const payload = aliases.map(alias => ({ seguradora_id: segId, alias: alias.trim() }))
        const { error } = await supabase.from('seguradora_aliases').upsert(payload, { onConflict: 'alias' })
        if (error) throw error
      }

      for (const doc of pendingDocs) {
        const { error } = await uploadEntityDocument({
          file: doc.file,
          tipoEntidade: 'seguradora',
          entidadeId: segId,
          titulo: doc.title || doc.file.name,
        })
        if (error) throw error
      }

      invalidarCacheSeguradoras()
      toast({ type: 'success', title: 'Configuracao salva!' })
      onSalvo()
      onClose()
    } catch (error) {
      toast({ type: 'error', title: 'Erro ao salvar', message: error.message })
    } finally {
      setSalvando(false)
    }
  }

  const nomeSelecionado = cadastradas.find(seg => seg.id === segExistente)?.nome_canonico
  const modoCompleto = ehEditar || modo === 'nova'
  const podeSalvar = modoCompleto
    ? !!nome.trim() && produtos.length > 0
    : !!segExistente && aliases.length > 0

  return (
    <div className="animate-fade-in">
      <div className="glass-modal rounded-[24px] overflow-hidden">
        <div className="modal-shell-header flex items-center gap-3 px-6 py-4 border-b border-dark-border/60">
          <button onClick={onClose} className="p-1.5 rounded-xl text-dark-muted hover:text-dark-text hover:bg-dark-surface2 transition-all flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="font-bold text-dark-text text-base">
            {ehEditar ? 'Editar Seguradora' : 'Configurar Seguradora'}
          </h2>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">
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

          {!modoCompleto ? (
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
                {cadastradasFiltradas.map(seg => (
                  <button
                    key={seg.id}
                    onClick={() => setSegExistente(seg.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors ${
                      segExistente === seg.id
                        ? 'bg-brand-accent/10 text-brand-accent'
                        : 'text-dark-text hover:bg-white/55'
                    }`}
                  >
                    <SeguradoraBadge nome={seg.nome_canonico} logoUrl={seg.logo_url} size="xs" showName={false} />
                    <span className="text-sm font-medium">{seg.nome_canonico}</span>
                  </button>
                ))}
              </div>
              {segExistente && (
                <p className="text-[11px] text-dark-muted mt-1.5">
                  Variacoes serao adicionadas a <span className="text-brand-accent font-semibold">"{nomeSelecionado}"</span>
                </p>
              )}
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">
                  Como deve aparecer no sistema *
                </label>
                <input
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Ex: Porto Seguro"
                  className="input"
                  autoFocus
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block">
                  Logo da seguradora
                </label>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="w-20 h-20 rounded-2xl border border-dark-border bg-white/70 overflow-hidden flex items-center justify-center">
                    {logoPreview ? (
                      <img src={logoPreview} alt={nome || 'Seguradora'} className="w-full h-full object-contain" />
                    ) : (
                      <Shield className="w-8 h-8 text-dark-muted/40" />
                    )}
                  </div>
                  <label className="btn-secondary text-sm cursor-pointer flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Enviar imagem
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  </label>
                </div>
              </div>

              <ProductChooser value={produtos} onChange={setProdutos} />
            </>
          )}

          <div>
            <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">
              Variacoes mapeadas
            </label>
            {aliases.length === 0 ? (
              <p className="text-xs text-dark-muted italic mb-2">Nenhuma variacao adicionada</p>
            ) : (
              <div className="rounded-xl border border-dark-border divide-y divide-dark-border overflow-hidden mb-2 max-h-44 overflow-y-auto">
                {aliases.map(alias => (
                  <div key={alias} className="flex items-center justify-between px-3 py-2 hover:bg-white/50 transition-colors">
                    <span className="font-mono text-xs text-dark-text truncate">{alias}</span>
                    <button
                      onClick={() => removerAlias(alias)}
                      className="flex-shrink-0 p-1 rounded hover:bg-status-danger/15 text-dark-muted hover:text-status-danger transition-colors ml-2"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {modoCompleto && (
            <>
              <div>
                <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">
                  Anexar documentos
                </label>
                <label className="btn-secondary text-sm cursor-pointer inline-flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Selecionar arquivos
                  <input type="file" className="hidden" multiple onChange={handlePendingDocs} />
                </label>
              </div>

              <PendingDocs
                docs={pendingDocs}
                onTitleChange={updatePendingDocTitle}
                onRemove={removePendingDoc}
              />
            </>
          )}

          {ehEditar && segAtual?.id && (
            <EntityDocumentsSection tipoEntidade="seguradora" entidadeId={segAtual.id} title="Documentos da seguradora" />
          )}
        </div>

        <div className="modal-shell-footer flex justify-end gap-3 px-6 py-4 border-t border-dark-border/60">
          <button onClick={onClose} className="btn-secondary text-sm">Cancelar</button>
          <button onClick={salvar} disabled={!podeSalvar || salvando} className="btn-primary text-sm">
            {salvando ? 'Salvando...' : 'Salvar Configuracao'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TabCadastradas({ seguradoras, onEditar, onExcluir, confirmExcluir, setConfirmExcluir }) {
  const [busca, setBusca] = useState('')
  const filtradas = busca.trim()
    ? seguradoras.filter(seg =>
        seg.nome_canonico.toLowerCase().includes(busca.toLowerCase()) ||
        seg.aliases.some(alias => alias.toLowerCase().includes(busca.toLowerCase()))
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
          placeholder="Buscar seguradora ou variacao..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="text-sm flex-1 outline-none bg-transparent text-dark-text placeholder-dark-muted"
        />
        {busca && <button onClick={() => setBusca('')} className="text-dark-muted hover:text-dark-text"><X className="w-3.5 h-3.5" /></button>}
      </div>

      <div className="space-y-3">
        {filtradas.map(seg => (
          <div key={seg.id} className="glass-panel p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1 space-y-2">
                <SeguradoraBadge nome={seg.nome_canonico} logoUrl={seg.logo_url} size="md" />
                <div className="flex flex-wrap gap-2">
                  {seg.produtos.map(produto => (
                    <span key={produto} className="px-2 py-1 rounded-full text-[10px] font-semibold bg-brand-accent/10 text-brand-accent border border-brand-accent/20">
                      {PRODUTO_LABELS[produto] || produto}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-dark-muted">
                  {seg.aliases.length} variacao{seg.aliases.length !== 1 ? 'oes' : ''}
                  {!seg.ativa && <span className="ml-2 text-status-warning">· Inativa</span>}
                </p>
                {seg.aliases.length > 0 && (
                  <p className="text-[11px] text-dark-muted/60 font-mono leading-relaxed">
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
                    <button onClick={() => setConfirmExcluir(null)} className="px-2 py-1 rounded border border-dark-border text-xs text-dark-muted hover:text-dark-text">Nao</button>
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
    </div>
  )
}

function TabNaoMapeadas({ naoMapeadas, selecionados, setSelecionados, onAgrupar }) {
  const [busca, setBusca] = useState('')
  const filtradas = busca.trim()
    ? naoMapeadas.filter(item => item.nome.toLowerCase().includes(busca.toLowerCase()))
    : naoMapeadas

  function toggle(nome) {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(nome)) next.delete(nome)
      else next.add(nome)
      return next
    })
  }

  function toggleTodos() {
    setSelecionados(
      selecionados.size === filtradas.length
        ? new Set()
        : new Set(filtradas.map(item => item.nome))
    )
  }

  if (naoMapeadas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-dark-muted">
        <Check className="w-10 h-10 opacity-30" />
        <p className="text-sm">Todas as seguradoras estao mapeadas!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-dark-muted">
          Selecione as variacoes para mapear a uma seguradora:
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
          placeholder="Filtrar variacoes..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="text-sm flex-1 outline-none bg-transparent text-dark-text placeholder-dark-muted"
        />
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2.5 bg-white/55 border-b border-dark-border/60">
          <input
            type="checkbox"
            checked={selecionados.size === filtradas.length && filtradas.length > 0}
            onChange={toggleTodos}
            className="w-4 h-4 rounded accent-brand-accent"
          />
          <span className="text-xs font-semibold text-dark-muted uppercase tracking-wider flex-1">Nome encontrado no sistema</span>
          <span className="text-xs font-semibold text-dark-muted uppercase tracking-wider">Uso</span>
        </div>

        <div className="divide-y divide-dark-border max-h-[480px] overflow-y-auto">
          {filtradas.map(item => (
            <label
              key={item.nome}
              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                selecionados.has(item.nome) ? 'bg-brand-accent/5' : 'hover:bg-white/50'
              }`}
            >
              <input
                type="checkbox"
                checked={selecionados.has(item.nome)}
                onChange={() => toggle(item.nome)}
                className="w-4 h-4 rounded accent-brand-accent flex-shrink-0"
              />
              <span className="font-mono text-sm text-dark-text flex-1 truncate">{item.nome}</span>
              <span className="text-xs text-dark-muted flex-shrink-0 font-mono">{item.total}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Seguradoras() {
  const toast = useToast()
  const [tab, setTab] = useState('cadastradas')
  const [loading, setLoading] = useState(true)
  const [seguradoras, setSeguradoras] = useState([])
  const [naoMapeadas, setNaoMapeadas] = useState([])
  const [selecionados, setSelecionados] = useState(new Set())
  const [modal, setModal] = useState(null)
  const [confirmExcluir, setConfirmExcluir] = useState(null)

  const carregar = useCallback(async () => {
    setLoading(true)

    const [{ data: fichasData }, { data: apolicesData }, { data: segsData }] = await Promise.all([
      supabase.from('fichas').select('seguradora').not('seguradora', 'is', null),
      supabase.from('apolices').select('seguradora').not('seguradora', 'is', null),
      supabase.from('seguradoras')
        .select('id, nome_canonico, ativa, logo_url, logo_path, seguradora_aliases(alias), seguradora_produtos(produto)')
        .order('nome_canonico'),
    ])

    const contagem = {}
    fichasData?.forEach(item => {
      if (item.seguradora) contagem[item.seguradora] = (contagem[item.seguradora] || 0) + 1
    })
    apolicesData?.forEach(item => {
      if (item.seguradora) contagem[item.seguradora] = (contagem[item.seguradora] || 0) + 1
    })

    const mapeados = new Set()
    segsData?.forEach(seg => {
      mapeados.add(seg.nome_canonico.toLowerCase())
      seg.seguradora_aliases?.forEach(alias => mapeados.add(alias.alias.toLowerCase()))
    })

    const segs = (segsData || []).map(seg => ({
      ...seg,
      aliases: seg.seguradora_aliases?.map(item => item.alias) || [],
      produtos: seg.seguradora_produtos?.map(item => item.produto) || [],
    }))

    const naoMap = Object.entries(contagem)
      .filter(([nome]) => !mapeados.has(nome.toLowerCase()))
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total)

    setSeguradoras(segs)
    setNaoMapeadas(naoMap)
    setLoading(false)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function excluir(id) {
    const { error } = await supabase.from('seguradoras').delete().eq('id', id)
    setConfirmExcluir(null)
    if (error) {
      toast({ type: 'error', title: 'Erro ao excluir', message: error.message })
      return
    }
    invalidarCacheSeguradoras()
    toast({ type: 'success', title: 'Seguradora excluida' })
    carregar()
  }

  function abrirAgrupar() {
    setModal({ mode: 'criar', variacoes: [...selecionados] })
  }

  function aoSalvar() {
    setSelecionados(new Set())
    carregar()
  }

  if (modal) {
    return (
      <ModalSeguradora
        modal={modal}
        cadastradas={seguradoras}
        onClose={() => setModal(null)}
        onSalvo={aoSalvar}
        toast={toast}
      />
    )
  }

  const totalAliases = seguradoras.reduce((acc, seg) => acc + (seg.aliases?.length || 0), 0)
  const ativas = seguradoras.filter(seg => seg.ativa !== false).length
  const totalProdutos = seguradoras.reduce((acc, seg) => acc + seg.produtos.length, 0)

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        eyebrow="Cadastro operacional"
        title="Seguradoras"
        description="Centralize nome, imagem, documentos, produtos e variacoes de cada seguradora."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {tab === 'cadastradas' && (
              <button onClick={() => setModal({ mode: 'criar', variacoes: [] })} className="btn-primary flex items-center gap-2 text-sm">
                <Plus className="w-4 h-4" /> Nova Seguradora
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard label="Seguradoras cadastradas" value={seguradoras.length} />
        <MetricCard label="Ativas" value={ativas} />
        <MetricCard label="Sem mapeamento" value={naoMapeadas.length} />
        <MetricCard label="Produtos vinculados" value={totalProdutos || totalAliases} />
      </div>

      <DataCard title="Operacao" description="Cadastre seguradoras completas ou limpe variacoes ainda nao consolidadas." className="overflow-hidden">
        <div className="flex items-center gap-1 border-b border-dark-border">
          {[
            ['cadastradas', `Cadastradas (${seguradoras.length})`],
            ['nao_mapeadas', `Nao Mapeadas (${naoMapeadas.length})`],
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
        </div>

        <div className="pt-5">
          {loading ? (
            <div className="flex items-center justify-center h-48 gap-2 text-dark-muted text-sm">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
      </DataCard>
    </div>
  )
}
