import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  Pencil,
  Plus,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import {
  AutoBadge,
  AutoInlineAlert,
  AutoLoading,
  AutoPageHeader,
  AutoPanel,
} from '../../components/auto'
import { EmptyState } from '../../components/ui'
import { atualizarAutoTag, criarAutoTag, excluirAutoTag, getAutoTags } from '../../lib/auto'

const CORES_SUGERIDAS = [
  '#2563EB', '#DC2626', '#15803D', '#A16207', '#7C3AED', '#0891B2', '#DB2777', '#64748B',
]

const NOVA_VAZIA = { nome: '', cor: CORES_SUGERIDAS[0] }

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {CORES_SUGERIDAS.map(cor => (
        <button
          key={cor}
          type="button"
          onClick={() => onChange(cor)}
          className={`h-7 w-7 rounded-full border-2 transition-transform ${
            value === cor ? 'scale-110 border-dark-text' : 'border-transparent hover:scale-105'
          }`}
          style={{ backgroundColor: cor }}
          aria-label={`Usar cor ${cor}`}
          aria-pressed={value === cor}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-7 w-9 cursor-pointer rounded-md border border-dark-border bg-transparent"
        aria-label="Escolher outra cor"
      />
    </div>
  )
}

export default function AutoEtiquetasV2() {
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
    onSuccess: () => {
      setNova(NOVA_VAZIA)
      setErro(null)
      invalidar()
    },
    onError: err => setErro(err?.message || 'Erro ao criar etiqueta.'),
  })

  const { mutateAsync: salvar, isPending: salvando } = useMutation({
    mutationFn: ({ id, changes }) => atualizarAutoTag(id, changes),
    onSuccess: () => {
      setEditandoId(null)
      setEditForm(null)
      setErro(null)
      invalidar()
    },
    onError: err => setErro(err?.message || 'Erro ao salvar etiqueta.'),
  })

  const { mutateAsync: excluir, isPending: excluindo } = useMutation({
    mutationFn: id => excluirAutoTag(id),
    onSuccess: () => {
      setConfirmandoExclusao(null)
      setErro(null)
      invalidar()
    },
    onError: err => setErro(err?.message || 'Erro ao excluir etiqueta.'),
  })

  const ordenadas = useMemo(() => [...tags].sort((a, b) => a.ordem - b.ordem), [tags])

  async function moverOrdem(tag, direcao) {
    const index = ordenadas.findIndex(item => item.id === tag.id)
    const alvo = ordenadas[index + direcao]
    if (!alvo) return
    await Promise.all([
      atualizarAutoTag(tag.id, { ordem: alvo.ordem }),
      atualizarAutoTag(alvo.id, { ordem: tag.ordem }),
    ])
    invalidar()
  }

  return (
    <div className="auto-page auto-v2-page">
      <AutoPageHeader
        context="Configurações do Auto"
        title="Etiquetas"
        description="Organize as etiquetas manuais exibidas nas cotações e emissões."
        meta={(
          <>
            <AutoBadge tone="info" icon={Tag}>{tags.length} cadastradas</AutoBadge>
            <AutoBadge tone="success">{tags.filter(tag => tag.ativa).length} ativas</AutoBadge>
          </>
        )}
      />

      {erro && (
        <AutoInlineAlert
          tone="danger"
          icon={AlertCircle}
          title="Não foi possível concluir a alteração"
          description={erro}
        />
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <AutoPanel title="Nova etiqueta" description="Defina um nome curto e uma cor reconhecível.">
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-dark-muted">Nome</label>
              <input
                value={nova.nome}
                onChange={event => setNova(prev => ({ ...prev, nome: event.target.value }))}
                placeholder="Ex.: Prioridade alta"
                className="input"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-dark-muted">Cor</label>
              <ColorPicker
                value={nova.cor}
                onChange={cor => setNova(prev => ({ ...prev, cor }))}
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-dark-muted">Preview</p>
              <span
                className="inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
                style={{
                  borderColor: `${nova.cor}66`,
                  backgroundColor: `${nova.cor}14`,
                  color: nova.cor,
                }}
              >
                <Tag className="h-3 w-3" aria-hidden="true" />
                {nova.nome.trim() || 'Nome da etiqueta'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => criar()}
              disabled={criando || !nova.nome.trim()}
              className="btn-primary inline-flex w-full items-center justify-center gap-2 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {criando ? 'Criando...' : 'Criar etiqueta'}
            </button>
          </div>
        </AutoPanel>

        <AutoPanel
          title="Etiquetas cadastradas"
          description="A ordem abaixo é a mesma utilizada nos seletores do módulo."
        >
          {isLoading ? (
            <AutoLoading label="Carregando etiquetas..." />
          ) : isError ? (
            <AutoInlineAlert
              tone="danger"
              icon={AlertCircle}
              title="Erro ao carregar etiquetas"
              description="Confirme se a migration de etiquetas foi executada no Supabase."
            />
          ) : ordenadas.length === 0 ? (
            <EmptyState
              icon={<Tag className="h-5 w-5" />}
              title="Nenhuma etiqueta criada"
              description="Use o formulário ao lado para criar a primeira."
            />
          ) : (
            <div className="divide-y divide-dark-border/70">
              {ordenadas.map((tag, index) => {
                const emEdicao = editandoId === tag.id
                const confirmando = confirmandoExclusao === tag.id
                return (
                  <div key={tag.id} className="auto-v2-enter flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        title="Mover para cima"
                        onClick={() => moverOrdem(tag, -1)}
                        disabled={index === 0}
                        className="grid h-8 w-8 place-items-center rounded-md border border-dark-border text-dark-muted hover:text-dark-text disabled:opacity-25"
                      >
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        title="Mover para baixo"
                        onClick={() => moverOrdem(tag, 1)}
                        disabled={index === ordenadas.length - 1}
                        className="grid h-8 w-8 place-items-center rounded-md border border-dark-border text-dark-muted hover:text-dark-text disabled:opacity-25"
                      >
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>

                    {emEdicao ? (
                      <>
                        <input
                          value={editForm.nome}
                          onChange={event => setEditForm(prev => ({ ...prev, nome: event.target.value }))}
                          className="input min-w-[180px] flex-1"
                          aria-label="Nome da etiqueta"
                        />
                        <input
                          type="color"
                          value={editForm.cor}
                          onChange={event => setEditForm(prev => ({ ...prev, cor: event.target.value }))}
                          className="h-8 w-10 cursor-pointer rounded-md border border-dark-border bg-transparent"
                          aria-label="Cor da etiqueta"
                        />
                        <button
                          type="button"
                          title="Salvar edição"
                          disabled={salvando || !editForm.nome.trim()}
                          onClick={() => salvar({ id: tag.id, changes: { nome: editForm.nome, cor: editForm.cor } })}
                          className="grid h-8 w-8 place-items-center rounded-md bg-status-success/10 text-status-success disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          title="Cancelar edição"
                          onClick={() => {
                            setEditandoId(null)
                            setEditForm(null)
                          }}
                          className="grid h-8 w-8 place-items-center rounded-md border border-dark-border text-dark-muted"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="min-w-[170px] flex-1">
                          <span
                            className="inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
                            style={{
                              borderColor: `${tag.cor}66`,
                              backgroundColor: `${tag.cor}14`,
                              color: tag.cor,
                            }}
                          >
                            <Tag className="h-3 w-3" aria-hidden="true" />
                            {tag.nome}
                          </span>
                        </div>
                        <AutoBadge tone={tag.ativa ? 'success' : 'neutral'}>
                          {tag.ativa ? 'Ativa' : 'Inativa'}
                        </AutoBadge>
                        <button
                          type="button"
                          title="Editar etiqueta"
                          onClick={() => {
                            setEditandoId(tag.id)
                            setEditForm({ nome: tag.nome, cor: tag.cor })
                          }}
                          className="grid h-8 w-8 place-items-center rounded-md border border-dark-border text-dark-muted hover:border-brand-accent/40 hover:text-status-info"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => salvar({ id: tag.id, changes: { ativa: !tag.ativa } })}
                          className="min-h-8 rounded-md border border-dark-border px-2.5 text-xs font-semibold text-dark-muted hover:text-dark-text"
                        >
                          {tag.ativa ? 'Desativar' : 'Ativar'}
                        </button>

                        {confirmando ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-dark-muted">Excluir?</span>
                            <button
                              type="button"
                              disabled={excluindo}
                              onClick={() => excluir(tag.id)}
                              className="min-h-8 rounded-md bg-status-danger/10 px-2.5 text-xs font-semibold text-status-danger disabled:opacity-60"
                            >
                              {excluindo ? 'Excluindo...' : 'Confirmar'}
                            </button>
                            <button
                              type="button"
                              title="Cancelar exclusão"
                              onClick={() => setConfirmandoExclusao(null)}
                              className="grid h-8 w-8 place-items-center rounded-md border border-dark-border text-dark-muted"
                            >
                              <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            title="Excluir etiqueta"
                            onClick={() => setConfirmandoExclusao(tag.id)}
                            className="grid h-8 w-8 place-items-center rounded-md border border-status-danger/25 text-status-danger hover:bg-status-danger/10"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </AutoPanel>
      </div>
    </div>
  )
}
