import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ArrowDown, ArrowUp, Check, Plus, Tag, Trash2, X } from 'lucide-react'
import { PageHeader, DataCard, EmptyState } from '../../components/ui'
import { atualizarAutoTag, criarAutoTag, excluirAutoTag, getAutoTags } from '../../lib/auto'

const CORES_SUGERIDAS = [
  '#4A90D9', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4', '#EC4899', '#64748B',
]

const NOVA_VAZIA = { nome: '', cor: CORES_SUGERIDAS[0] }

export default function AutoEtiquetas() {
  const qc = useQueryClient()
  const [nova, setNova] = useState(NOVA_VAZIA)
  const [editandoId, setEditandoId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(null)
  const [erro, setErro] = useState(null)

  const { data: tags = [], isLoading, isError } = useQuery({
    queryKey: ['auto-tags'],
    queryFn: getAutoTags,
  })

  const invalidar = () => qc.invalidateQueries({ queryKey: ['auto-tags'] })

  const { mutateAsync: criar, isPending: criando } = useMutation({
    mutationFn: () => criarAutoTag({ nome: nova.nome, cor: nova.cor, ordem: tags.length }),
    onSuccess: () => { setNova(NOVA_VAZIA); setErro(null); invalidar() },
    onError: err => setErro(err?.message || 'Erro ao criar etiqueta.'),
  })

  const { mutateAsync: salvar } = useMutation({
    mutationFn: ({ id, changes }) => atualizarAutoTag(id, changes),
    onSuccess: () => { setEditandoId(null); setEditForm(null); setErro(null); invalidar() },
    onError: err => setErro(err?.message || 'Erro ao salvar etiqueta.'),
  })

  const { mutateAsync: excluir, isPending: excluindo } = useMutation({
    mutationFn: id => excluirAutoTag(id),
    onSuccess: () => { setConfirmandoExclusao(null); setErro(null); invalidar() },
    onError: err => setErro(err?.message || 'Erro ao excluir etiqueta.'),
  })

  const moverOrdem = async (tag, direcao) => {
    const ordenadas = [...tags].sort((a, b) => a.ordem - b.ordem)
    const index = ordenadas.findIndex(item => item.id === tag.id)
    const alvo = ordenadas[index + direcao]
    if (!alvo) return
    await Promise.all([
      atualizarAutoTag(tag.id, { ordem: alvo.ordem }),
      atualizarAutoTag(alvo.id, { ordem: tag.ordem }),
    ])
    invalidar()
  }

  const ordenadas = useMemo(() => [...tags].sort((a, b) => a.ordem - b.ordem), [tags])

  return (
    <div className="auto-page space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Modulo auto"
        title="Etiquetas"
        description="Gerencie as etiquetas predefinidas usadas nos cards de cotacoes e emissoes do modulo Auto."
      />

      {erro && (
        <div className="flex items-start gap-3 rounded-2xl border border-status-danger/20 bg-status-danger/8 px-4 py-3 text-sm text-status-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      <DataCard title="Nova etiqueta" subtitle="Nome e cor sao obrigatorios.">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-medium text-dark-muted">Nome</label>
            <input
              value={nova.nome}
              onChange={e => setNova(prev => ({ ...prev, nome: e.target.value }))}
              placeholder="Ex.: Prioridade alta"
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-dark-muted">Cor</label>
            <div className="flex items-center gap-2">
              {CORES_SUGERIDAS.map(cor => (
                <button
                  key={cor}
                  type="button"
                  onClick={() => setNova(prev => ({ ...prev, cor }))}
                  className={`h-7 w-7 rounded-full border-2 transition-transform ${nova.cor === cor ? 'border-dark-text scale-110' : 'border-transparent'}`}
                  style={{ background: cor }}
                  aria-label={cor}
                />
              ))}
              <input
                type="color"
                value={nova.cor}
                onChange={e => setNova(prev => ({ ...prev, cor: e.target.value }))}
                className="h-7 w-9 cursor-pointer rounded border border-dark-border/70 bg-transparent"
              />
            </div>
          </div>
          <button
            onClick={() => criar()}
            disabled={criando || !nova.nome.trim()}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {criando ? 'Criando...' : 'Criar etiqueta'}
          </button>
        </div>
      </DataCard>

      <DataCard title="Etiquetas predefinidas" subtitle="Ative, edite, reordene ou remova. Etiquetas inativas somem dos seletores mas ficam salvas." bodyClassName="p-0">
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-dark-muted">Carregando etiquetas...</div>
        ) : isError ? (
          <div className="px-5 py-10 text-center text-sm text-status-danger">
            Erro ao carregar etiquetas. Confirme se a migration <code>55_auto_renovacao_cotacao_tags.sql</code> foi executada no Supabase.
          </div>
        ) : ordenadas.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState icon={<Tag className="h-5 w-5" />} title="Nenhuma etiqueta criada" description="Crie a primeira etiqueta predefinida acima." />
          </div>
        ) : (
          <div className="divide-y divide-dark-border/70">
            {ordenadas.map((tag, index) => {
              const emEdicao = editandoId === tag.id
              return (
                <div key={tag.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="flex flex-col gap-1">
                    <button type="button" onClick={() => moverOrdem(tag, -1)} disabled={index === 0} className="rounded-lg border border-dark-border/60 p-1 text-dark-muted hover:text-dark-text disabled:opacity-30">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => moverOrdem(tag, 1)} disabled={index === ordenadas.length - 1} className="rounded-lg border border-dark-border/60 p-1 text-dark-muted hover:text-dark-text disabled:opacity-30">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {emEdicao ? (
                    <>
                      <input
                        value={editForm.nome}
                        onChange={e => setEditForm(prev => ({ ...prev, nome: e.target.value }))}
                        className="input max-w-[220px]"
                      />
                      <input
                        type="color"
                        value={editForm.cor}
                        onChange={e => setEditForm(prev => ({ ...prev, cor: e.target.value }))}
                        className="h-8 w-10 cursor-pointer rounded border border-dark-border/70 bg-transparent"
                      />
                      <button onClick={() => salvar({ id: tag.id, changes: { nome: editForm.nome, cor: editForm.cor } })} className="rounded-xl bg-status-success/10 p-2 text-status-success hover:bg-status-success/20">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => { setEditandoId(null); setEditForm(null) }} className="rounded-xl bg-dark-surface2 p-2 text-dark-muted hover:text-dark-text">
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: `${tag.cor}55`, background: `${tag.cor}18`, color: tag.cor }}>
                        <Tag className="h-3 w-3" />
                        {tag.nome}
                      </span>
                      {!tag.ativa && <span className="badge badge-muted">Inativa</span>}
                      <button
                        onClick={() => { setEditandoId(tag.id); setEditForm({ nome: tag.nome, cor: tag.cor }) }}
                        className="text-xs font-semibold text-status-info hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => salvar({ id: tag.id, changes: { ativa: !tag.ativa } })}
                        className="text-xs font-semibold text-dark-muted hover:text-dark-text"
                      >
                        {tag.ativa ? 'Desativar' : 'Ativar'}
                      </button>

                      <div className="ml-auto">
                        {confirmandoExclusao === tag.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-dark-muted">Excluir e remover dos cards?</span>
                            <button onClick={() => excluir(tag.id)} disabled={excluindo} className="rounded-xl bg-status-danger/10 px-3 py-1.5 text-xs font-semibold text-status-danger hover:bg-status-danger/20 disabled:opacity-60">
                              {excluindo ? 'Excluindo...' : 'Confirmar'}
                            </button>
                            <button onClick={() => setConfirmandoExclusao(null)} className="rounded-xl border border-dark-border/70 px-3 py-1.5 text-xs text-dark-muted">
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmandoExclusao(tag.id)} className="rounded-xl border border-status-danger/20 p-2 text-status-danger hover:bg-status-danger/10">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </DataCard>
    </div>
  )
}
