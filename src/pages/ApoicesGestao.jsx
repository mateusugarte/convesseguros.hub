import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import {
  criarApolice,
  fetchApolicesKanban,
  formatMoneyBR,
  moverStatusApolice,
  STATUS_EMISSAO_LABELS,
} from '../lib/apolices'
import { fetchFichasAprovadasEmissao } from '../lib/fichas'
import { normalizeDisplayText } from '../lib/text'
import { useImobiliaria } from '../hooks/useImobiliaria'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { KanbanSkeleton } from '../components/Skeleton'
import SeguradoraBadge from '../components/SeguradoraBadge'
import { Avatar } from '../components/ui'

const COLUNAS = [
  { id: 'recebida', label: 'Recebida', color: '#3B82F6' },
  { id: 'proposta_transmitida', label: 'Proposta Transmitida', color: '#F59E0B' },
  { id: 'emitida', label: 'Apólice Emitida', color: '#8B5CF6' },
  { id: 'enviada', label: 'Apólice Enviada', color: '#10B981' },
]

function getPeriodDates(filtro) {
  const now = new Date()
  if (filtro === 'hoje') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return [start.toISOString(), now.toISOString()]
  }
  if (filtro === 'semana') {
    const start = new Date(now)
    start.setDate(start.getDate() - 7)
    start.setHours(0, 0, 0, 0)
    return [start.toISOString(), now.toISOString()]
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return [start.toISOString(), now.toISOString()]
}

function timeSince(dateStr) {
  if (!dateStr) return 'agora'
  const hours = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60))
  if (hours < 1) return '<1h'
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function timeBadgeClass(dateStr) {
  if (!dateStr) return 'badge-info'
  const hours = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60))
  if (hours < 4) return 'badge-success'
  if (hours < 24) return 'badge-warning'
  return 'badge-danger'
}

function nomeApolice(apolice) {
  return normalizeDisplayText(
    apolice?.fichas?.nome_empresa
      || apolice?.fichas?.nome_interessado
      || apolice?.nome_interessado
  ) || 'Sem nome'
}

function documentoApolice(apolice) {
  return apolice?.fichas?.cnpj || apolice?.fichas?.cpf || '—'
}

function resumoFicha(ficha) {
  const raw = ficha?.raw_data || {}
  const nome = normalizeDisplayText(
    ficha?.nome_empresa
      || ficha?.nome_interessado
      || raw?.nome_empresa
      || raw?.nome_interessado
      || raw?.nome
  ) || 'Sem nome'

  return {
    nome,
    imobiliaria: normalizeDisplayText(ficha?.imobiliaria || raw?.imobiliaria) || 'Imobiliária não informada',
    avatarUrl: ficha?.profiles?.avatar_url || raw?.avatar_url || '',
    emissorNome: ficha?.profiles?.nome || '',
    numeroOrcamento: String(raw?.numero_orcamento || '').trim(),
  }
}

function KanbanCard({ apolice, resolverNome, onOpen, isDragOverlay = false, dragListeners, dragAttributes }) {
  const emissorNome = apolice?.profiles?.nome || ''
  const documento = documentoApolice(apolice)
  const celular = apolice?.fichas?.celular || '—'
  const tipoImovel = normalizeDisplayText(apolice?.fichas?.tipo_imovel) || '—'
  const vigencia = [apolice?.inicio_vigencia, apolice?.fim_vigencia].filter(Boolean).join(' até ') || '—'
  const parcela = apolice?.valor_parcela ? formatMoneyBR(apolice.valor_parcela) : '—'
  const parcelamento = apolice?.parcelamento ? `${apolice.parcelamento}x` : '—'
  const statusLabel = STATUS_EMISSAO_LABELS[apolice?.status_emissao]?.label || 'Recebida'

  return (
    <div className={`kanban-card${isDragOverlay ? ' kanban-card-dragging' : ''}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {!isDragOverlay && (
            <button
              {...dragListeners}
              {...dragAttributes}
              className="text-dark-muted hover:text-dark-text transition-colors"
              onClick={e => e.stopPropagation()}
              tabIndex={-1}
              aria-label="Arrastar apólice"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="badge badge-info text-[9px] uppercase tracking-wide">{statusLabel}</span>
        </div>
        <span className={`badge text-[9px] font-mono ${timeBadgeClass(apolice?.created_at)}`}>
          {timeSince(apolice?.created_at)}
        </span>
      </div>

      <button type="button" className="w-full text-left" onClick={() => onOpen?.(apolice.id)}>
        <p className="text-[13px] font-semibold text-dark-text leading-tight truncate">
          {nomeApolice(apolice)}
        </p>
        <p className="mt-1 text-[10px] text-dark-muted truncate">
          {resolverNome ? resolverNome(apolice?.imobiliaria) : (apolice?.imobiliaria || '—')}
        </p>

        {apolice?.numero_apolice && (
          <p className="mt-2 text-[10px] font-mono" style={{ color: '#2B5BA8' }}>
            {apolice.numero_apolice}
          </p>
        )}
      </button>

      {apolice?.seguradora && (
        <div className="mt-2">
          <SeguradoraBadge nome={apolice.seguradora} size="xs" />
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <InfoPill label="Documento" value={documento} mono />
        <InfoPill label="Celular" value={celular} />
        <InfoPill label="Imóvel" value={tipoImovel} />
        <InfoPill label="Parcelas" value={parcelamento} />
      </div>

      <div className="mt-2 rounded-xl border border-dark-border/60 bg-dark-surface2/20 px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[8px] uppercase tracking-[0.14em] text-dark-muted">Vigência</p>
            <p className="mt-0.5 text-[10px] text-dark-text truncate">{vigencia}</p>
          </div>
          <div className="text-right">
            <p className="text-[8px] uppercase tracking-[0.14em] text-dark-muted">Parcela</p>
            <p className="mt-0.5 text-[10px] font-semibold text-brand-accent">{parcela}</p>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-dark-border/40 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar name={emissorNome || 'Livre'} src={apolice?.profiles?.avatar_url || ''} size="sm" />
          <span className="text-[10px] text-dark-muted truncate">
            {emissorNome ? emissorNome.split(' ')[0] : 'Livre'}
          </span>
        </div>
        <button type="button" className="text-[10px] text-dark-muted hover:text-dark-text transition-colors" onClick={() => onOpen?.(apolice.id)}>
          Detalhes
        </button>
      </div>
    </div>
  )
}

function InfoPill({ label, value, mono = false }) {
  return (
    <div className="rounded-xl border border-dark-border/60 bg-white/80 px-2.5 py-2">
      <p className="text-[8px] uppercase tracking-[0.14em] text-dark-muted">{label}</p>
      <p className={`mt-0.5 text-[10px] text-dark-text truncate${mono ? ' font-mono' : ''}`}>{value || '—'}</p>
    </div>
  )
}

function DraggableCard({ apolice, resolverNome, onOpen }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: apolice.id,
    data: { type: 'card' },
  })

  return (
    <div ref={setNodeRef} style={{ opacity: isDragging ? 0.35 : 1 }}>
      <KanbanCard
        apolice={apolice}
        resolverNome={resolverNome}
        onOpen={onOpen}
        dragListeners={listeners}
        dragAttributes={attributes}
      />
    </div>
  )
}

function DroppableColumn({ col, apolices, resolverNome, onOpen }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })

  return (
    <div className="kanban-col flex flex-col flex-shrink-0">
      <div
        className="kanban-col-header"
        style={{ background: `${col.color}14`, borderColor: `${col.color}45` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
          <span className="text-[12px] font-semibold" style={{ color: col.color }}>{col.label}</span>
        </div>
        <span
          className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md"
          style={{ background: `${col.color}24`, color: col.color }}
        >
          {apolices.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className="kanban-col-body flex-1 space-y-2 p-2 rounded-b-xl border overflow-y-auto transition-colors duration-150"
        style={{
          borderColor: isOver ? `${col.color}66` : 'rgb(var(--color-border))',
          backgroundColor: isOver ? `${col.color}08` : 'rgb(var(--color-surface2) / 0.35)',
          boxShadow: isOver ? `inset 0 0 0 1px ${col.color}55` : 'none',
        }}
      >
        {apolices.length === 0 ? (
          <div className="flex items-center justify-center h-20 rounded-xl border border-dashed border-dark-border/50 text-[11px] text-dark-muted">
            Vazia
          </div>
        ) : apolices.map(apolice => (
          <DraggableCard
            key={apolice.id}
            apolice={apolice}
            resolverNome={resolverNome}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  )
}

function ModalIniciarEmissao({ onClose, onCriado, toast, grupos, getAliases, user }) {
  const [imobFiltro, setImobFiltro] = useState('')
  const [busca, setBusca] = useState('')
  const [fichas, setFichas] = useState([])
  const [loading, setLoading] = useState(true)
  const [criando, setCriando] = useState(false)
  const [fichaSelecionada, setFichaSelecionada] = useState(null)
  const [numeroOrcamento, setNumeroOrcamento] = useState('')

  const loadFichas = useCallback(async () => {
    setLoading(true)
    try {
      let imobiliarias
      if (imobFiltro) {
        const aliases = await getAliases(imobFiltro)
        imobiliarias = aliases.length ? aliases : [imobFiltro]
      }
      const data = await fetchFichasAprovadasEmissao({
        search: busca.trim(),
        imobiliarias,
      })
      setFichas(data || [])
    } catch {
      setFichas([])
      toast({ type: 'error', title: 'Erro ao carregar fichas aprovadas' })
    } finally {
      setLoading(false)
    }
  }, [busca, getAliases, imobFiltro, toast])

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadFichas()
    }, 250)
    return () => clearTimeout(timeout)
  }, [loadFichas])

  function selecionarFicha(ficha) {
    const resumo = resumoFicha(ficha)
    setFichaSelecionada(ficha)
    setNumeroOrcamento(resumo.numeroOrcamento)
  }

  async function criarSolicitacao() {
    if (!fichaSelecionada) return
    setCriando(true)
    const resumo = resumoFicha(fichaSelecionada)
    const payload = {
      ficha_id: fichaSelecionada.id,
      imobiliaria: fichaSelecionada.imobiliaria || null,
      produto: fichaSelecionada.raw_data?.produto || null,
      status_emissao: 'recebida',
      nome_interessado: resumo.nome,
      numero_proposta: numeroOrcamento.trim() || null,
      emitido_por: user?.id || null,
      numero_apolice: '',
      seguradora: 'Outras',
      data_emissao: new Date().toISOString().slice(0, 10),
    }

    const { error } = await criarApolice(payload)
    setCriando(false)

    if (error) {
      toast({ type: 'error', title: 'Erro ao criar solicitação', message: error.message })
      return
    }

    toast({ type: 'success', title: 'Solicitação criada' })
    onCriado?.()
    onClose?.()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="glass-panel rounded-3xl w-full max-w-6xl overflow-hidden">
        <div className="flex items-center justify-between px-7 py-5 border-b border-dark-border">
          <div>
            <h2 className="text-xl font-bold text-dark-text">Iniciar Emissão</h2>
            <p className="text-sm text-dark-muted mt-0.5">Selecione uma ficha aprovada para criar a solicitação.</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 rounded-xl" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-7 py-6 space-y-5">
          <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-4">
            <div>
              <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">
                Imobiliária
              </label>
              <select value={imobFiltro} onChange={e => setImobFiltro(e.target.value)} className="select text-sm">
                <option value="">Todas as imobiliárias</option>
                {grupos.map(grupo => (
                  <option key={grupo.id} value={grupo.nome_canonico}>
                    {grupo.nome_canonico}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">
                Pesquisar fichas aprovadas
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
                <input
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Nome do cliente ou imobiliária"
                  className="input pl-10"
                />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-dark-border bg-white/70 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border">
              <div>
                <h3 className="text-lg font-semibold text-dark-text">Fichas aprovadas</h3>
                <p className="text-sm text-dark-muted">Mostrando nome completo, foto e imobiliária.</p>
              </div>
              <span className="text-sm text-dark-muted">{fichas.length} fichas</span>
            </div>

            <div className="max-h-[420px] overflow-y-auto p-4">
              {loading ? (
                <div className="text-sm text-dark-muted text-center py-16">Carregando fichas aprovadas...</div>
              ) : fichas.length === 0 ? (
                <div className="text-sm text-dark-muted text-center py-16">
                  Nenhuma ficha aprovada encontrada.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {fichas.map(ficha => {
                    const resumo = resumoFicha(ficha)
                    const selecionada = fichaSelecionada?.id === ficha.id
                    return (
                      <button
                        key={ficha.id}
                        type="button"
                        onClick={() => selecionarFicha(ficha)}
                        className={`rounded-2xl border p-4 text-left transition-all ${
                          selecionada
                            ? 'border-brand-accent bg-brand-accent/5 shadow-sm'
                            : 'border-dark-border hover:border-brand-accent/40 hover:bg-dark-surface2/20'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar name={resumo.nome} src={resumo.avatarUrl} size="md" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[15px] font-semibold text-dark-text truncate">{resumo.nome}</p>
                              <span className="badge badge-success text-[10px]">Aprovada</span>
                            </div>
                            <p className="mt-1 text-sm text-dark-muted truncate">{resumo.imobiliaria}</p>
                            {resumo.emissorNome && (
                              <p className="mt-2 text-[11px] text-dark-muted truncate">
                                Orcamentista: {resumo.emissorNome}
                              </p>
                            )}
                            <p className="mt-2 text-[11px] font-mono text-dark-muted">
                              Nº orçamento: {resumo.numeroOrcamento || 'Não informado'}
                            </p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-dark-border bg-dark-surface2/20 p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-dark-muted">Dados da emissão</h3>
                <p className="text-sm text-dark-muted mt-1">
                  Ao selecionar a ficha, o número do orçamento é preenchido automaticamente quando existir.
                </p>
              </div>
              {fichaSelecionada && (
                <button
                  type="button"
                  className="text-sm text-dark-muted hover:text-dark-text transition-colors"
                  onClick={() => {
                    setFichaSelecionada(null)
                    setNumeroOrcamento('')
                  }}
                >
                  Limpar seleção
                </button>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">
                  Nº do orçamento
                </label>
                <input
                  value={numeroOrcamento}
                  onChange={e => setNumeroOrcamento(e.target.value)}
                  placeholder="Ex: 12345"
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">
                  Ficha selecionada
                </label>
                <div className="input text-sm bg-white/70">
                  {fichaSelecionada ? resumoFicha(fichaSelecionada).nome : 'Nenhuma ficha selecionada'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-7 py-5 border-t border-dark-border">
          <button onClick={onClose} className="btn-secondary text-sm">Cancelar</button>
          <button
            onClick={criarSolicitacao}
            disabled={!fichaSelecionada || criando}
            className="btn-primary text-sm"
          >
            {criando ? 'Criando...' : 'Criar Solicitação'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ApoicesGestao() {
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const { grupos, resolverNome, getAliases } = useImobiliaria()

  const [apolices, setApolices] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('semana')
  const [imobFiltro, setImobFiltro] = useState('')
  const [modalIniciar, setModalIniciar] = useState(false)
  const [activeId, setActiveId] = useState(null)

  const scrollRef = useRef(null)
  const [canScrollL, setCanScrollL] = useState(false)
  const [canScrollR, setCanScrollR] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [dateFrom, dateTo] = getPeriodDates(filtro)
      let imobiliarias
      if (imobFiltro) {
        const aliases = await getAliases(imobFiltro)
        imobiliarias = aliases.length ? aliases : [imobFiltro]
      }
      const data = await fetchApolicesKanban({ dateFrom, dateTo, imobiliarias })
      setApolices(data || [])
    } catch {
      setApolices([])
      toast({ type: 'error', title: 'Erro ao carregar apólices' })
    } finally {
      setLoading(false)
    }
  }, [filtro, getAliases, imobFiltro, toast])

  useEffect(() => {
    load()
  }, [load])

  const groups = useMemo(() => {
    const initial = Object.fromEntries(COLUNAS.map(col => [col.id, []]))
    for (const apolice of apolices) {
      if (initial[apolice.status_emissao]) initial[apolice.status_emissao].push(apolice)
    }
    return initial
  }, [apolices])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const updateScrollState = () => {
      setCanScrollL(el.scrollLeft > 5)
      setCanScrollR(el.scrollLeft < el.scrollWidth - el.clientWidth - 5)
    }

    updateScrollState()
    el.addEventListener('scroll', updateScrollState, { passive: true })
    const resizeObserver = new ResizeObserver(updateScrollState)
    resizeObserver.observe(el)

    return () => {
      el.removeEventListener('scroll', updateScrollState)
      resizeObserver.disconnect()
    }
  }, [loading, apolices.length])

  async function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over) return

    const id = active.id
    const novoStatus = over.id
    const apolice = apolices.find(item => item.id === id)

    if (!apolice || !COLUNAS.some(col => col.id === novoStatus) || apolice.status_emissao === novoStatus) {
      return
    }

    setApolices(prev => prev.map(item => (
      item.id === id ? { ...item, status_emissao: novoStatus } : item
    )))

    const error = await moverStatusApolice(id, novoStatus)
    if (error) {
      toast({ type: 'error', title: 'Erro ao mover apólice' })
      load()
    }
  }

  const activeCard = activeId ? apolices.find(item => item.id === activeId) : null

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="title-page text-dark-text">Gestão de Apólices</h1>
          <p className="text-xs text-dark-muted mt-0.5">
            Arraste as apólices entre as colunas para atualizar o status
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-dark-surface2 border border-dark-border rounded-lg p-0.5">
          {['hoje', 'semana', 'mes'].map(item => (
            <button
              key={item}
              onClick={() => setFiltro(item)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filtro === item ? 'bg-brand-secondary text-white shadow-sm' : 'text-dark-muted hover:text-dark-text'
              }`}
            >
              {item === 'hoje' ? 'Hoje' : item === 'semana' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={imobFiltro}
            onChange={e => setImobFiltro(e.target.value)}
            className="select text-sm py-1.5"
            style={{ minWidth: '220px' }}
          >
            <option value="">Todas as imobiliárias</option>
            {grupos.map(grupo => (
              <option key={grupo.id} value={grupo.nome_canonico}>
                {grupo.nome_canonico}
              </option>
            ))}
          </select>

          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dark-border text-xs text-dark-muted hover:text-dark-text transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </button>

          <button onClick={() => setModalIniciar(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            Iniciar Emissão
          </button>
        </div>
      </div>

      {loading ? (
        <KanbanSkeleton />
      ) : (
        <div className="relative">
          {canScrollL && (
            <>
              <div
                className="absolute left-0 top-0 bottom-4 w-16 z-10 pointer-events-none"
                style={{ background: 'linear-gradient(to right, rgb(var(--color-bg)), transparent)' }}
              />
              <button
                onClick={() => scrollRef.current?.scrollBy({ left: -280, behavior: 'smooth' })}
                className="absolute left-0.5 top-[60px] z-20 w-7 h-7 rounded-full bg-dark-surface border border-dark-border shadow-md flex items-center justify-center text-dark-muted hover:text-dark-text transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          )}

          {canScrollR && (
            <>
              <div
                className="absolute right-0 top-0 bottom-4 w-16 z-10 pointer-events-none"
                style={{ background: 'linear-gradient(to left, rgb(var(--color-bg)), transparent)' }}
              />
              <button
                onClick={() => scrollRef.current?.scrollBy({ left: 280, behavior: 'smooth' })}
                className="absolute right-0.5 top-[60px] z-20 w-7 h-7 rounded-full bg-dark-surface border border-dark-border shadow-md flex items-center justify-center text-dark-muted hover:text-dark-text transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          <div ref={scrollRef} className="kanban-scroll overflow-x-auto pb-4">
            <DndContext
              sensors={sensors}
              onDragStart={({ active }) => setActiveId(active.id)}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveId(null)}
            >
              <div className="flex gap-3 min-w-max px-1">
                {COLUNAS.map(col => (
                  <DroppableColumn
                    key={col.id}
                    col={col}
                    apolices={groups[col.id] || []}
                    resolverNome={resolverNome}
                    onOpen={id => navigate(`/apolices/${id}`)}
                  />
                ))}
              </div>

              <DragOverlay dropAnimation={null}>
                {activeCard ? (
                  <div style={{ width: 'var(--kanban-col-w, 286px)', pointerEvents: 'none' }}>
                    <KanbanCard apolice={activeCard} resolverNome={resolverNome} isDragOverlay />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        </div>
      )}

      {modalIniciar && (
        <ModalIniciarEmissao
          onClose={() => setModalIniciar(false)}
          onCriado={load}
          toast={toast}
          grupos={grupos}
          getAliases={getAliases}
          user={user}
        />
      )}
    </div>
  )
}
