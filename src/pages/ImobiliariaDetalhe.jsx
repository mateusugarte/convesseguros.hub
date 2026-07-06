import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'
import { ArrowLeft, Pencil, X, Check, Plus, Upload, Building2, ShieldCheck, Save } from 'lucide-react'
import { PageHeader, MetricCard, DataCard } from '../components/ui'
import { fetchCodigos, upsertCodigo } from '../lib/imobiliariasCodigos'
import { fetchSeguradorasPorProduto } from '../lib/seguradoras'
import { getEntityImageUrl, replaceEntityImage } from '../lib/entityMedia'
import ImobiliariaIdentity from '../components/ImobiliariaIdentity'
import SeguradoraBadge from '../components/SeguradoraBadge'

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
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-dark-muted">{label}</p>
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
            className="input flex-1 py-1.5 text-sm"
          />
          <button onClick={save} disabled={saving} className="rounded-lg bg-status-success/20 p-1.5 text-status-success hover:bg-status-success/30">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => { setEditing(false); setDraft(value || '') }} className="rounded-lg border border-dark-border p-1.5 text-dark-muted hover:text-dark-text">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-dark-muted">{label}</p>
      <p
        onClick={() => { setDraft(value || ''); setEditing(true) }}
        className="group flex cursor-pointer items-center gap-1.5 text-sm text-dark-text transition-colors hover:text-status-info"
      >
        <span>{value || <span className="italic text-dark-muted/40">-</span>}</span>
        <Pencil className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-40" />
      </p>
    </div>
  )
}

function CampoEmBreve({ label }) {
  return (
    <div className="relative opacity-50">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-dark-muted">{label}</p>
      <div className="h-9 rounded-lg border border-dark-border bg-dark-surface2" />
      <span className="absolute right-0 top-0 rounded-full border border-brand-gold/25 bg-brand-gold/15 px-2 py-0.5 text-[9px] font-bold text-brand-gold">
        Em breve
      </span>
    </div>
  )
}

function buildDraftMap(seguradoras, codigos) {
  const map = {}
  for (const seg of seguradoras || []) {
    const codigo = (codigos || []).find(item => item.seguradora_id === seg.id)
    map[seg.id] = {
      codigo: codigo?.codigo || '',
      observacoes: codigo?.observacoes || '',
    }
  }
  return map
}

function SeguradoraCadastroCard({ seguradora, ativa, draft, saving, toggling, onToggle, onChange, onSave }) {
  return (
    <div className={`rounded-[24px] border p-4 transition-all ${ativa ? 'border-emerald-500/30 bg-[linear-gradient(145deg,rgba(16,185,129,0.08),rgba(255,255,255,0.96))] shadow-sm' : 'border-dark-border bg-white/90'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <SeguradoraBadge
            nome={seguradora.nome_canonico}
            logoUrl={seguradora.logo_url}
            logoPath={seguradora.logo_path}
            size="lg"
            className="min-w-0"
            resolveMeta={false}
          />
          <p className="text-xs text-dark-muted">
            {ativa ? 'Cadastro ativo para esta imobiliária.' : 'Marque quando a imobiliária possuir cadastro nesta seguradora.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          disabled={toggling}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${ativa ? 'border-emerald-500/30 bg-emerald-500/12 text-emerald-700' : 'border-dark-border text-dark-muted hover:text-dark-text'}`}
        >
          <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${ativa ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-dark-border bg-white text-transparent'}`}>
            <Check className="h-3 w-3" />
          </span>
          {ativa ? 'Cadastrada' : 'Sem cadastro'}
        </button>
      </div>

      <div className={`mt-4 space-y-3 transition-opacity ${ativa ? 'opacity-100' : 'pointer-events-none opacity-45'}`}>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Código da imobiliária</label>
          <input
            value={draft.codigo}
            onChange={e => onChange('codigo', e.target.value)}
            placeholder="Ex: 15392"
            className="input text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Observações</label>
          <textarea
            value={draft.observacoes}
            onChange={e => onChange('observacoes', e.target.value)}
            rows={3}
            placeholder="Detalhes do cadastro, contato, restrições ou observações comerciais."
            className="input min-h-[88px] resize-y text-sm"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-dark-muted">Os dados ficam vinculados a esta seguradora para a imobiliária.</p>
          <button
            type="button"
            onClick={onSave}
            disabled={!ativa || saving}
            className="btn-primary inline-flex items-center gap-2 px-3 py-2 text-sm disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
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
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageLoadError, setImageLoadError] = useState(false)

  const [codigos, setCodigos] = useState([])
  const [seguradorasFianca, setSeguradorasFianca] = useState([])
  const [seguradorasAtivas, setSeguradorasAtivas] = useState(new Set())
  const [drafts, setDrafts] = useState({})
  const [salvandoCards, setSalvandoCards] = useState(new Set())
  const [alternandoCards, setAlternandoCards] = useState(new Set())

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('imobiliarias')
      .select('id, nome_canonico, ativa, created_at, imagem_url, imagem_path, recebe_comissao, pct_comissao, objetivo_comercial, observacoes_comerciais, imobiliaria_aliases(id, alias)')
      .eq('id', id)
      .single()
    setImob(data)
    setLoading(false)
  }, [id])

  const carregarCadastros = useCallback(async () => {
    if (!id) return

    const [codigosData, seguradorasData, vinculosResp] = await Promise.all([
      fetchCodigos(id),
      fetchSeguradorasPorProduto('fianca'),
      supabase.from('imobiliaria_seguradoras').select('seguradora_id').eq('imobiliaria_id', id),
    ])

    setCodigos(codigosData || [])
    setSeguradorasFianca(seguradorasData || [])
    setSeguradorasAtivas(new Set((vinculosResp.data || []).map(item => item.seguradora_id)))
    setDrafts(buildDraftMap(seguradorasData || [], codigosData || []))
  }, [id])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    carregarCadastros()
  }, [carregarCadastros])

  const codigoMap = useMemo(() => new Map(codigos.map(item => [item.seguradora_id, item])), [codigos])

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

  async function handleImageUpload(event) {
    const file = event.target.files?.[0]
    if (!file || !imob) return

    setUploadingImage(true)
    setImageLoadError(false)
    const uploaded = await replaceEntityImage({
      file,
      entityType: 'imobiliaria',
      entityId: imob.id,
      previousPath: imob.imagem_path || null,
    })

    if (uploaded.error) {
      setUploadingImage(false)
      toast({ type: 'error', title: 'Erro ao enviar imagem', message: uploaded.error.message })
      return
    }

    const { error } = await supabase
      .from('imobiliarias')
      .update({ imagem_url: uploaded.url, imagem_path: uploaded.path })
      .eq('id', id)

    setUploadingImage(false)

    if (error) {
      toast({ type: 'error', title: 'Erro ao salvar imagem', message: error.message })
      return
    }

    setImob(prev => ({ ...prev, imagem_url: uploaded.url, imagem_path: uploaded.path }))
    toast({ type: 'success', title: 'Imagem atualizada' })
  }

  async function toggleSeguradora(seguradoraId, ativa) {
    const key = String(seguradoraId)
    setAlternandoCards(prev => new Set([...prev, key]))

    let error
    if (ativa) {
      ;({ error } = await supabase
        .from('imobiliaria_seguradoras')
        .delete()
        .eq('imobiliaria_id', id)
        .eq('seguradora_id', seguradoraId))
    } else {
      ;({ error } = await supabase
        .from('imobiliaria_seguradoras')
        .insert({ imobiliaria_id: id, seguradora_id: seguradoraId }))
    }

    if (error) {
      toast({ type: 'error', title: 'Erro ao atualizar cadastro', message: error.message })
    } else {
      setSeguradorasAtivas(prev => {
        const next = new Set(prev)
        if (ativa) next.delete(seguradoraId)
        else next.add(seguradoraId)
        return next
      })
      toast({ type: 'success', title: ativa ? 'Cadastro desmarcado' : 'Cadastro marcado' })
    }

    setAlternandoCards(prev => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }

  function updateDraft(seguradoraId, field, value) {
    setDrafts(prev => ({
      ...prev,
      [seguradoraId]: {
        codigo: prev[seguradoraId]?.codigo || '',
        observacoes: prev[seguradoraId]?.observacoes || '',
        [field]: value,
      },
    }))
  }

  async function salvarCadastro(seguradoraId) {
    const key = String(seguradoraId)
    const draft = drafts[seguradoraId] || { codigo: '', observacoes: '' }

    setSalvandoCards(prev => new Set([...prev, key]))
    const error = await upsertCodigo(id, seguradoraId, {
      codigo: draft.codigo.trim(),
      observacoes: draft.observacoes.trim(),
    })

    if (error) {
      toast({ type: 'error', title: 'Erro ao salvar dados da seguradora', message: error.message })
    } else {
      const fresh = await fetchCodigos(id)
      setCodigos(fresh)
      setDrafts(prev => ({
        ...prev,
        [seguradoraId]: {
          codigo: draft.codigo.trim(),
          observacoes: draft.observacoes.trim(),
        },
      }))
      toast({ type: 'success', title: 'Dados da seguradora salvos' })
    }

    setSalvandoCards(prev => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-dark-muted">
        <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Carregando...
      </div>
    )
  }

  if (!imob) {
    return (
      <div className="py-20 text-center">
        <p className="text-dark-muted">Imobiliária não encontrada</p>
        <button onClick={() => navigate('/imobiliarias')} className="btn-secondary mt-4">Voltar</button>
      </div>
    )
  }

  const aliases = imob.imobiliaria_aliases || []
  const totalCodigos = codigos.filter(item => item.codigo || item.observacoes).length

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        eyebrow="Cadastro operacional"
        title={imob.nome_canonico}
        description="Detalhe da imobiliária com edição inline, variações de nome e cadastro visual por seguradora de fiança."
        actions={
          <button
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/imobiliarias'))}
            className="btn-secondary flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
        }
        stats={[
          <MetricCard key="status" label="Status" value={imob.ativa ? 'Ativa' : 'Inativa'} />,
          <MetricCard key="variacoes" label="Variações" value={aliases.length} />,
          <MetricCard key="seguradoras" label="Seguradoras fiança" value={seguradorasAtivas.size} />,
          <MetricCard key="cadastro" label="Cadastrada em" value={new Date(imob.created_at).toLocaleDateString('pt-BR')} />,
        ]}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <DataCard title="Imagem" description="Imagem usada nos cards e seletores da imobiliária.">
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-1">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-dark-border bg-dark-surface/70">
                  {getEntityImageUrl(imob.imagem_path, imob.imagem_url) ? (
                    <img
                      src={getEntityImageUrl(imob.imagem_path, imob.imagem_url)}
                      alt={imob.nome_canonico}
                      className="h-full w-full object-cover"
                      onError={() => setImageLoadError(true)}
                      onLoad={() => setImageLoadError(false)}
                    />
                  ) : (
                    <Building2 className="h-10 w-10 text-dark-muted/40" />
                  )}
                </div>
                {imageLoadError && <p className="max-w-24 text-[10px] leading-tight text-status-danger">Falha ao carregar a imagem.</p>}
              </div>
              <label className={`btn-secondary flex cursor-pointer items-center gap-2 text-sm ${uploadingImage ? 'pointer-events-none opacity-50' : ''}`}>
                <Upload className="h-4 w-4" />
                {uploadingImage ? 'Enviando...' : 'Enviar imagem'}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            </div>
          </DataCard>

          <DataCard title="Dados do sistema" description="Campos principais e status da imobiliária.">
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <CampoEditavel label="Nome no sistema" value={imob.nome_canonico} onSave={v => updateField('nome_canonico', v)} />
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-dark-muted">Status</p>
                <label className="flex w-fit items-center gap-3">
                  <div
                    onClick={() => updateField('ativa', !imob.ativa)}
                    className={`h-5 w-9 rounded-full transition-colors ${imob.ativa ? 'bg-status-success' : 'bg-dark-border'}`}
                  >
                    <div className={`m-[3px] h-3.5 w-3.5 rounded-full bg-white transition-transform ${imob.ativa ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                  <span className="text-sm text-dark-text">{imob.ativa ? 'Ativa' : 'Inativa'}</span>
                </label>
              </div>
            </div>
          </DataCard>

          <DataCard title="Variações de nome" description="Aliases usados para consolidar registros e buscas.">
            <div className="mb-4 space-y-2">
              {aliases.length === 0 && <p className="text-xs italic text-dark-muted/50">Nenhuma variação cadastrada</p>}
              {aliases.map(a => (
                <div key={a.id} className="flex items-center justify-between gap-3 border-b border-dark-border/50 py-1.5 last:border-0">
                  <span className="text-sm text-dark-text">{a.alias}</span>
                  <button onClick={() => excluirAlias(a.id)} className="text-status-danger/60 transition-colors hover:text-status-danger">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={novoAlias}
                onChange={e => setNovoAlias(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && adicionarAlias()}
                placeholder="Adicionar nova variação..."
                className="input flex-1 text-sm"
              />
              <button
                onClick={adicionarAlias}
                disabled={!novoAlias.trim() || addingAlias}
                className="btn-secondary gap-1 px-3 py-1.5 text-xs disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </button>
            </div>
          </DataCard>

          <DataCard title="Cadastros em seguradoras de fiança" description="Marque onde a imobiliária possui cadastro e registre código e observações por seguradora.">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(236,253,245,0.9))] p-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Painel de cadastro</p>
                <p className="mt-1 max-w-xl text-sm text-dark-muted">Use os cards para ativar as seguradoras de fiança, salvar o código interno da imobiliária e registrar observações operacionais.</p>
              </div>
              <ImobiliariaIdentity nome={imob.nome_canonico} imagemUrl={imob.imagem_url} imagemPath={imob.imagem_path} size="lg" className="shrink-0" />
            </div>

            {seguradorasFianca.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-dark-border px-4 py-8 text-center text-sm text-dark-muted">Nenhuma seguradora de fiança ativa foi encontrada.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {seguradorasFianca.map(seg => {
                  const ativa = seguradorasAtivas.has(seg.id)
                  const draft = drafts[seg.id] || { codigo: codigoMap.get(seg.id)?.codigo || '', observacoes: codigoMap.get(seg.id)?.observacoes || '' }
                  const key = String(seg.id)
                  return (
                    <SeguradoraCadastroCard
                      key={seg.id}
                      seguradora={seg}
                      ativa={ativa}
                      draft={draft}
                      saving={salvandoCards.has(key)}
                      toggling={alternandoCards.has(key)}
                      onToggle={() => toggleSeguradora(seg.id, ativa)}
                      onChange={(field, value) => updateDraft(seg.id, field, value)}
                      onSave={() => salvarCadastro(seg.id)}
                    />
                  )
                })}
              </div>
            )}
          </DataCard>

          <DataCard title="Dados de parceria" description="Bloco reservado para evolução futura da operação.">
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
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

          <DataCard title="Parceria comercial" description="Controle de comissão, objetivo e observações da imobiliária.">
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-dark-muted">Recebe comissão</p>
                <label className="flex w-fit items-center gap-3">
                  <div
                    onClick={() => updateField('recebe_comissao', !imob.recebe_comissao)}
                    className={`h-5 w-9 rounded-full transition-colors ${imob.recebe_comissao ? 'bg-status-success' : 'bg-dark-border'}`}
                  >
                    <div className={`m-[3px] h-3.5 w-3.5 rounded-full bg-white transition-transform ${imob.recebe_comissao ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                  <span className="text-sm text-dark-text">{imob.recebe_comissao ? 'Sim' : 'Não'}</span>
                </label>
              </div>

              <CampoEditavel
                label="% Comissão"
                value={imob.pct_comissao != null ? `${imob.pct_comissao}` : ''}
                onSave={v => updateField('pct_comissao', v ? Number(v) : null)}
              />

              <CampoEditavel label="Objetivo comercial" value={imob.objetivo_comercial} onSave={v => updateField('objetivo_comercial', v)} />
              <CampoEditavel label="Observações comerciais" value={imob.observacoes_comerciais} onSave={v => updateField('observacoes_comerciais', v)} />
            </div>
          </DataCard>
        </div>

        <div className="space-y-4">
          <DataCard title="Informações" description="Contexto técnico do cadastro atual.">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-dark-muted">ID</span>
                <span className="max-w-[140px] truncate font-mono text-[9px] text-dark-muted">{imob.id}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-dark-muted">Cadastrada em</span>
                <span className="font-mono text-[10px] text-dark-text">{new Date(imob.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-dark-muted">Variações</span>
                <span className="font-semibold text-dark-text">{aliases.length}</span>
              </div>
            </div>
          </DataCard>

          <DataCard title="Resumo de cadastros" description="Visão rápida das seguradoras de fiança marcadas para esta imobiliária.">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-emerald-500/15 bg-emerald-500/8 px-3 py-2">
                <div className="flex items-center gap-2 text-emerald-700">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="text-sm font-semibold">Cadastros ativos</span>
                </div>
                <span className="text-lg font-bold text-emerald-700">{seguradorasAtivas.size}</span>
              </div>

              {seguradorasFianca.filter(seg => seguradorasAtivas.has(seg.id)).length === 0 ? (
                <p className="rounded-2xl border border-dashed border-dark-border px-3 py-6 text-center text-xs text-dark-muted">Nenhuma seguradora de fiança marcada ainda.</p>
              ) : (
                <div className="space-y-2">
                  {seguradorasFianca.filter(seg => seguradorasAtivas.has(seg.id)).map(seg => {
                    const cadastro = codigoMap.get(seg.id)
                    return (
                      <div key={seg.id} className="rounded-2xl border border-dark-border/70 bg-dark-surface/30 px-3 py-3">
                        <SeguradoraBadge
                          nome={seg.nome_canonico}
                          logoUrl={seg.logo_url}
                          logoPath={seg.logo_path}
                          size="sm"
                          resolveMeta={false}
                        />
                        <p className="mt-2 text-[11px] text-dark-muted">Código: <span className="font-mono text-dark-text">{cadastro?.codigo || '-'}</span></p>
                      </div>
                    )
                  })}
                </div>
              )}

              <p className="text-[11px] text-dark-muted">Registros com código ou observações salvas: {totalCodigos}</p>
            </div>
          </DataCard>
        </div>
      </div>
    </div>
  )
}
