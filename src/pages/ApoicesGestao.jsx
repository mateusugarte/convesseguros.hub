import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { memo } from 'react'
import { startTransition } from 'react'
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import {
  Briefcase,
  Building,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Home,
  LayoutGrid,
  Plus,
  RefreshCw,
  Search,
  Upload,
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
import { sanitizeProprietarioNome } from '../lib/text'
import { uploadDocumento } from '../lib/documentos'
import { normalizeDisplayText } from '../lib/text'
import { useImobiliaria } from '../hooks/useImobiliaria'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { KanbanSkeleton } from '../components/Skeleton'
import SeguradoraBadge from '../components/SeguradoraBadge'
import { Avatar } from '../components/ui'
import ImobiliariaSelect from '../components/ImobiliariaSelect'
import { kanbanPointerCollision, KANBAN_DRAG_OVERLAY_MODIFIERS } from '../lib/kanbanDnd'

const COLUNAS = [
  { id: 'recebida', label: 'Recebida', color: '#3B82F6' },
  { id: 'proposta_transmitida', label: 'Proposta Transmitida', color: '#F59E0B' },
  { id: 'emitida', label: 'Apólice Emitida', color: '#8B5CF6' },
  { id: 'enviada', label: 'Apólice Enviada', color: '#059669' },
]

const PRODUTO_ICON = { residencial_pf: Home, comercial_pf: Briefcase, pessoa_juridica: Building }
const PRODUTO_COLOR = { residencial_pf: '#4A90D9', comercial_pf: '#059669', pessoa_juridica: '#8B5CF6' }
const PRODUTO_ABBR = { residencial_pf: 'RES. PF', comercial_pf: 'COM. PF', pessoa_juridica: 'PJ' }
const SEGURADORAS_UPLOAD_DIRETO = ['Porto Seguro', 'Pottencial Seguros', 'TOO Seguros']
const KANBAN_INITIAL_BATCH = 12
const KANBAN_BATCH_STEP = 10

function getPeriodDates(filtro) {
  const now = new Date()
  if (filtro === 'total') {
    return [null, null]
  }
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

function produtoApolice(apolice) {
  return apolice?.fichas?.produto || apolice?.produto || ''
}

function documentoApolice(apolice) {
  return apolice?.fichas?.cnpj || apolice?.fichas?.cpf || apolice?.cnpj || apolice?.cpf || '—'
}

function isApoliceSemFicha(apolice) {
  return !apolice?.ficha_id && !apolice?.fichas
}

function statusBadgeClass(status) {
  switch (status) {
    case 'emitida':
    case 'enviada':
      return 'badge-success'
    case 'proposta_transmitida':
      return 'badge-warning'
    default:
      return 'badge-info'
  }
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

function inferProdutoFianca({ documento, tipoImovel }) {
  const digits = String(documento || '').replace(/\D/g, '')
  const tipo = String(tipoImovel || '').toLowerCase()
  if (digits.length > 11) return 'pessoa_juridica'
  if (tipo.includes('comercial')) return 'comercial_pf'
  return 'residencial_pf'
}

function formatDocumentoTipo(documento) {
  const digits = String(documento || '').replace(/\D/g, '')
  if (!digits) return { cpf: null, cnpj: null, isPessoaJuridica: false }
  return {
    cpf: digits.length <= 11 ? documento : null,
    cnpj: digits.length > 11 ? documento : null,
    isPessoaJuridica: digits.length > 11,
  }
}

const InfoPill = memo(function InfoPill({ label, value, mono = false }) {
  return (
    <div className="rounded-xl border border-dark-border/60 bg-white/80 px-2 py-1.5">
      <p className="text-[8px] uppercase tracking-[0.14em] text-dark-muted">{label}</p>
      <p className={`mt-0.5 text-[10px] text-dark-text truncate${mono ? ' font-mono' : ''}`}>{value || '—'}</p>
    </div>
  )
})

const KanbanCard = memo(function KanbanCard({ apolice, resolverNome, resolverImobiliariaInfo, onOpen, isDragOverlay = false, dragListeners, dragAttributes }) {
  const [expandido, setExpandido] = useState(false)
  const produto = produtoApolice(apolice)
  const ProdutoIcon = PRODUTO_ICON[produto] || LayoutGrid
  const produtoColor = PRODUTO_COLOR[produto] || '#6B7280'
  const emissorNome = apolice?.profiles?.nome || ''
  const statusLabel = STATUS_EMISSAO_LABELS[apolice?.status_emissao]?.label || apolice?.status_emissao || 'Recebida'
  const documento = documentoApolice(apolice)
  const semFicha = isApoliceSemFicha(apolice)
  const celular = apolice?.fichas?.celular || apolice?.celular || '—'
  const tipoImovel = normalizeDisplayText(apolice?.fichas?.tipo_imovel || apolice?.tipo_imovel) || '—'
  const vigencia = [apolice?.inicio_vigencia, apolice?.fim_vigencia].filter(Boolean).join(' até ') || '—'
  const parcela = apolice?.valor_parcela ? formatMoneyBR(apolice.valor_parcela) : '—'
  const parcelamento = apolice?.parcelamento ? `${apolice.parcelamento}x` : '—'
  const nomeImob = resolverNome ? resolverNome(apolice?.imobiliaria) : (apolice?.imobiliaria || '')
  const imobInfo = resolverImobiliariaInfo ? resolverImobiliariaInfo(apolice?.imobiliaria) : null

  return (
    <div
      className={`kanban-card${isDragOverlay ? ' kanban-card-dragging' : ''}`}
      style={{ '--kanban-accent': semFicha ? '#F97316' : produtoColor }}
    >
      {!isDragOverlay && (
        <button
          {...dragListeners}
          {...dragAttributes}
          type="button"
          className="kanban-grip"
          onClick={event => event.stopPropagation()}
          tabIndex={-1}
          aria-label="Arrastar apólice"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      )}

      <div className="kanban-card-body cursor-pointer" onClick={() => !isDragOverlay && onOpen?.(apolice.id)}>
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <span
            className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-[3px] rounded-full uppercase tracking-wide select-none"
            style={{ background: `${produtoColor}20`, color: produtoColor }}
          >
            <ProdutoIcon className="w-2.5 h-2.5" strokeWidth={2.5} />
            {PRODUTO_ABBR[produto] || 'AUTO'}
          </span>
          <span className={`badge text-[9px] font-mono select-none ${statusBadgeClass(apolice?.status_emissao)}`}>
            {statusLabel}
          </span>
          <span className={`badge text-[9px] font-mono select-none ${timeBadgeClass(apolice?.created_at)}`}>
            {timeSince(apolice?.created_at)}
          </span>
        </div>

        <p className="text-[12.5px] font-semibold text-dark-text leading-snug truncate mb-0.5">
          {nomeApolice(apolice)}
        </p>
        {semFicha && (
          <div className="mb-1.5">
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]"
              style={{ background: 'rgba(249,115,22,0.14)', color: '#EA580C' }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#EA580C' }} />
              Sem ficha vinculada
            </span>
          </div>
        )}
        <div className="mb-2 grid grid-cols-2 gap-1.5">
          <div className="rounded-xl border border-dark-border/60 bg-white/80 px-2 py-1.5">
            <p className="text-[8px] uppercase tracking-[0.14em] text-dark-muted">Seguradora</p>
            <div className="mt-1 min-w-0">
              {apolice?.seguradora
                ? <SeguradoraBadge nome={apolice.seguradora} size="xs" showName className="max-w-full" />
                : <p className="text-[10px] text-dark-muted">—</p>}
            </div>
          </div>
          <div className="rounded-xl border border-dark-border/60 bg-white/80 px-2 py-1.5">
            <p className="text-[8px] uppercase tracking-[0.14em] text-dark-muted">Imobiliária</p>
            <div className="mt-1 flex items-center gap-1.5 min-w-0">
              {imobInfo?.imagem_url ? (
                <img src={imobInfo.imagem_url} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" loading="lazy" decoding="async" />
              ) : (
                <Avatar name={nomeImob} size="sm" />
              )}
              <p className="text-[10px] text-dark-text truncate leading-none font-medium">
                {nomeImob || '—'}
              </p>
            </div>
          </div>
        </div>

        {apolice?.numero_apolice && (
          <p className="text-[10px] font-mono mb-1.5" style={{ color: '#2B5BA8' }}>
            {apolice.numero_apolice}
          </p>
        )}

        {!isDragOverlay && (
          <>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <InfoPill label="Documento" value={documento} mono />
              <InfoPill label="Celular" value={celular} />
              <InfoPill label="Imóvel" value={tipoImovel} />
              <InfoPill label="Parcelas" value={parcelamento} />
            </div>

            <div className="mt-1.5 rounded-xl border border-dark-border/60 bg-dark-surface2/25 px-2 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[8px] uppercase tracking-[0.14em] text-dark-muted">Vigência</p>
                  <p className="mt-0.5 text-[10px] text-dark-text truncate">{vigencia}</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] uppercase tracking-[0.14em] text-dark-muted">Parcela</p>
                  <p className="mt-0.5 text-[10px] font-semibold" style={{ color: '#000079' }}>{parcela}</p>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-dark-border/40 mt-auto">
          {emissorNome ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <Avatar name={emissorNome} src={apolice?.profiles?.avatar_url || ''} size="sm" />
              <span className="text-[10px] text-dark-muted font-medium truncate max-w-[96px]">
                {emissorNome.split(' ')[0]}
              </span>
            </div>
          ) : (
            <span className="text-[9px] text-status-warning font-semibold tracking-wide uppercase">Livre</span>
          )}

          {!isDragOverlay && (
            <button
              type="button"
              onPointerDown={event => event.stopPropagation()}
              onClick={event => {
                event.stopPropagation()
                setExpandido(value => !value)
              }}
              className="text-[9px] text-dark-muted hover:text-dark-text transition-colors px-1.5 py-0.5 rounded-md hover:bg-dark-surface2"
            >
              {expandido ? '▲' : '▼ Detalhes'}
            </button>
          )}
        </div>

        {expandido && !isDragOverlay && (
          <div className="space-y-0.5 pt-1.5 mt-1.5 border-t border-dark-border/40 animate-fade-in">
            <p className="text-[9px] text-dark-muted truncate">
              Imobiliária: {resolverNome ? resolverNome(apolice?.imobiliaria) : (apolice?.imobiliaria || '—')}
            </p>
            {(apolice?.fichas?.cep || apolice?.cep) && <p className="text-[9px] text-dark-muted font-mono">CEP: {apolice?.fichas?.cep || apolice?.cep}</p>}
            {apolice?.seguradora && <p className="text-[9px] text-dark-muted">Seguradora: {apolice.seguradora}</p>}
            {apolice?.email_proprietario && <p className="text-[9px] text-dark-muted break-all">Email proprietário: {apolice.email_proprietario}</p>}
            {apolice?.valor_parcela && <p className="text-[9px] text-dark-muted">Parcela: {parcela}</p>}
          </div>
        )}
      </div>
    </div>
  )
})

const DraggableCard = memo(function DraggableCard({ apolice, resolverNome, resolverImobiliariaInfo, onOpen }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: apolice.id,
    data: { type: 'card' },
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        opacity: isDragging ? 0.25 : 1,
        transition: isDragging ? 'none' : 'opacity 0.2s ease',
        willChange: 'transform',
        contentVisibility: 'auto',
        containIntrinsicSize: '220px',
      }}
    >
      <KanbanCard
        apolice={apolice}
        resolverNome={resolverNome}
        resolverImobiliariaInfo={resolverImobiliariaInfo}
        onOpen={onOpen}
        dragListeners={listeners}
        dragAttributes={attributes}
      />
    </div>
  )
})

const ColumnCardList = memo(function ColumnCardList({ apolices, resolverNome, resolverImobiliariaInfo, onOpen }) {
  const [visibleCount, setVisibleCount] = useState(() => Math.min(apolices.length, KANBAN_INITIAL_BATCH))

  useEffect(() => {
    setVisibleCount(Math.min(apolices.length, KANBAN_INITIAL_BATCH))
  }, [apolices])

  useEffect(() => {
    if (visibleCount >= apolices.length) return

    const frameId = requestAnimationFrame(() => {
      setVisibleCount(current => Math.min(apolices.length, current + KANBAN_BATCH_STEP))
    })

    return () => cancelAnimationFrame(frameId)
  }, [apolices.length, visibleCount])

  const visibleItems = useMemo(() => apolices.slice(0, visibleCount), [apolices, visibleCount])

  return visibleItems.map(apolice => (
    <DraggableCard
      key={apolice.id}
      apolice={apolice}
      resolverNome={resolverNome}
      resolverImobiliariaInfo={resolverImobiliariaInfo}
      onOpen={onOpen}
    />
  ))
})

const DroppableColumn = memo(function DroppableColumn({ col, apolices, resolverNome, resolverImobiliariaInfo, onOpen }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })

  return (
    <div className="kanban-col flex h-full flex-col flex-shrink-0" style={{ contain: 'layout paint style' }}>
      <div className="kanban-col-header" style={{ background: `${col.color}14`, borderColor: `${col.color}45` }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
          <span className="text-[12px] font-semibold" style={{ color: col.color }}>{col.label}</span>
        </div>
        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md" style={{ background: `${col.color}24`, color: col.color }}>
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
          contentVisibility: 'auto',
          containIntrinsicSize: '780px',
        }}
      >
        {apolices.length === 0 ? (
          <div className="flex items-center justify-center h-20 rounded-xl border border-dashed border-dark-border/50 text-[11px] text-dark-muted">
            Vazia
          </div>
        ) : (
          <ColumnCardList
            apolices={apolices}
            resolverNome={resolverNome}
            resolverImobiliariaInfo={resolverImobiliariaInfo}
            onOpen={onOpen}
          />
        )}
      </div>
    </div>
  )
})

function IniciarEmissaoWorkspace({ onBack, onCriado, toast, grupos, getAliases, user }) {
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
    const timeout = setTimeout(() => loadFichas(), 250)
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
    onBack?.()
  }

  return (
    <section className="glass-panel rounded-3xl overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between gap-4 px-7 py-5 border-b border-dark-border">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/20 bg-brand-accent/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-accent">
            <Plus className="w-3.5 h-3.5" />
            Area dedicada
          </div>
          <h2 className="mt-3 text-xl font-bold text-dark-text">Iniciar Emissão</h2>
          <p className="text-sm text-dark-muted mt-0.5">Selecione uma ficha aprovada para criar a solicitação.</p>
        </div>
        <button onClick={onBack} className="btn-secondary text-sm">
          Voltar para gestão
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="px-7 py-6 space-y-5">
          <div>
            <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-4">
              <div>
                <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">Imobiliária</label>
                <ImobiliariaSelect
                  value={imobFiltro}
                  onChange={setImobFiltro}
                  placeholder="Todas as imobiliárias"
                  allLabel="Todas as imobiliárias"
                  className="text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">Pesquisar fichas aprovadas</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
                  <input
                    value={busca}
                    onChange={event => setBusca(event.target.value)}
                    placeholder="Nome do cliente ou imobiliária"
                    className="input pl-10"
                  />
                </div>
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
                <div className="text-sm text-dark-muted text-center py-16">Nenhuma ficha aprovada encontrada.</div>
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
                              <p className="mt-2 text-[11px] text-dark-muted truncate">Orcamentista: {resumo.emissorNome}</p>
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
        </div>

        <aside className="border-t xl:border-t-0 xl:border-l border-dark-border bg-dark-surface2/20 px-7 py-6">
          <div className="rounded-3xl border border-dark-border bg-white/80 p-5">
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

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">Nº do orçamento</label>
                <input
                  value={numeroOrcamento}
                  onChange={event => setNumeroOrcamento(event.target.value)}
                  placeholder="Ex: 12345"
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">Ficha selecionada</label>
                <div className="input min-h-[44px] bg-white/70 flex items-center text-sm">
                  {fichaSelecionada ? resumoFicha(fichaSelecionada).nome : 'Nenhuma ficha selecionada'}
                </div>
              </div>
              {fichaSelecionada && (
                <>
                  <div className="rounded-2xl border border-dark-border/60 bg-dark-surface2/20 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Imobiliária</p>
                    <p className="mt-2 text-sm font-semibold text-dark-text">{resumoFicha(fichaSelecionada).imobiliaria}</p>
                  </div>
                  <div className="rounded-2xl border border-dark-border/60 bg-dark-surface2/20 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Resumo</p>
                    <p className="mt-2 text-sm text-dark-text">Cliente: {resumoFicha(fichaSelecionada).nome}</p>
                    <p className="mt-1 text-xs text-dark-muted">Orçamento: {numeroOrcamento || 'Não informado'}</p>
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button onClick={onBack} className="btn-secondary text-sm">Cancelar</button>
              <button onClick={criarSolicitacao} disabled={!fichaSelecionada || criando} className="btn-primary text-sm">
                {criando ? 'Criando...' : 'Criar Solicitação'}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}

function DadoCard({ label, value, mono = false, highlight = false, span2 = false }) {
  return (
    <div className={`rounded-xl border border-dark-border/60 bg-dark-surface/50 px-3 py-2.5${span2 ? ' col-span-2' : ''}`}>
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-dark-muted mb-1">{label}</p>
      <p className={`text-xs truncate ${mono ? 'font-mono' : 'font-medium'} ${highlight ? 'font-bold' : ''}`}
         style={highlight ? { color: '#000079' } : undefined}>
        {value || '—'}
      </p>
    </div>
  )
}

function UploadDiretoWorkspace({ onBack, onCriado, toast, grupos, user }) {
  const [seguradora, setSeguradora] = useState('Porto Seguro')
  const [imobiliaria, setImobiliaria] = useState('')
  const [buscaImob, setBuscaImob] = useState('')
  const [celular, setCelular] = useState('')
  const [pdfFile, setPdfFile] = useState(null)
  const [extraindo, setExtraindo] = useState(false)
  const [criando, setCriando] = useState(false)
  const [dadosExtraidos, setDadosExtraidos] = useState(null)
  const [erro, setErro] = useState('')
  const fileInputRef = useRef(null)

  const gruposFiltrados = useMemo(() => {
    const q = buscaImob.trim().toLowerCase()
    if (!q) return grupos
    return grupos.filter(g => g.nome_canonico.toLowerCase().includes(q))
  }, [grupos, buscaImob])

  function selecionarSeguradora(nome) {
    setSeguradora(nome)
    setPdfFile(null)
    setDadosExtraidos(null)
    setErro('')
  }

  function handleArquivo(file) {
    setPdfFile(file)
    setDadosExtraidos(null)
    setErro('')
    if (file) {
      void handleExtrair(file)
    }
  }

  async function handleExtrair(fileOverride = null) {
    const fileAtual = fileOverride || pdfFile
    if (!fileAtual) return
    setExtraindo(true)
    setErro('')
    try {
      const { parseApolice } = await import('../lib/apoliceParser')
      const { campos, extras, semParser } = await parseApolice(seguradora, fileAtual)
      const parsed = { ...campos, ...extras }
      setDadosExtraidos(parsed)
      if (semParser || (!parsed.numero_apolice && !parsed.nome_locatario)) {
        setErro(`Não foi possível identificar dados da apólice ${seguradora}. Verifique se o PDF é da seguradora selecionada.`)
      }
      if ((parsed.celular_locatario || parsed.proprietario_cel) && !celular.trim()) {
        setCelular(parsed.celular_locatario || parsed.proprietario_cel)
      }
    } catch (err) {
      setErro(err?.message || 'Erro ao ler o PDF da apólice.')
    } finally {
      setExtraindo(false)
    }
  }

  async function criarUploadDireto() {
    if (!pdfFile || !dadosExtraidos || !imobiliaria || !celular.trim()) return
    setCriando(true)
    const documento = dadosExtraidos.documento_locatario || ''
    const { cpf, cnpj, isPessoaJuridica } = formatDocumentoTipo(documento)
    const produto = inferProdutoFianca({ documento, tipoImovel: dadosExtraidos.tipo_imovel })
    const payload = {
      ficha_id: null,
      imobiliaria,
      produto,
      nome_interessado: isPessoaJuridica ? null : (dadosExtraidos.nome_locatario || null),
      nome_empresa: isPessoaJuridica ? (dadosExtraidos.nome_locatario || null) : null,
      numero_apolice: dadosExtraidos.numero_apolice || null,
      numero_proposta: dadosExtraidos.numero_proposta || null,
      seguradora,
      status_emissao: 'emitida',
      data_emissao: new Date().toISOString().slice(0, 10),
      emitido_por: user?.id || null,
      proprietario_nome: sanitizeProprietarioNome(dadosExtraidos.nome_proprietario) || null,
      endereco: dadosExtraidos.endereco || null,
      inicio_vigencia: dadosExtraidos.inicio_vigencia || null,
      fim_vigencia: dadosExtraidos.fim_vigencia || null,
      parcelamento: dadosExtraidos.parcelamento || null,
      valor_parcela: dadosExtraidos.valor_parcela || null,
      premio_liquido: dadosExtraidos.premio_liquido || null,
      premio_total: dadosExtraidos.premio_total || null,
      valor_producao: dadosExtraidos.premio_total || null,
      forma_pagamento: dadosExtraidos.forma_pagamento || null,
      email_proprietario: dadosExtraidos.email_proprietario || null,
      cpf: cpf || null,
      cnpj: cnpj || null,
      celular: celular.trim() || null,
      tipo_imovel: dadosExtraidos.tipo_imovel || null,
      cep: dadosExtraidos.cep || null,
      valor_aluguel: dadosExtraidos.valor_aluguel || null,
    }

    const { data, error } = await criarApolice(payload)
    if (error) {
      setCriando(false)
      toast({ type: 'error', title: 'Erro ao criar apólice', message: error.message })
      return
    }

    const { error: uploadError } = await uploadDocumento({
      file: pdfFile,
      apoliceId: data?.id,
      cpfCnpj: cpf || cnpj,
      userId: user?.id,
    })

    setCriando(false)
    if (uploadError) {
      toast({ type: 'error', title: 'Apólice criada, mas o PDF não foi anexado', message: uploadError.message })
    } else {
      toast({ type: 'success', title: 'Apólice criada a partir do PDF' })
    }
    onCriado?.(data)
    onBack?.()
  }

  const imobSelecionada = grupos.find(g => g.nome_canonico === imobiliaria)
  const podeCriar = pdfFile && dadosExtraidos && imobiliaria && celular.trim() && !extraindo && !criando

  return (
    <div className="card p-0 overflow-hidden animate-fade-in">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-dark-border">
        <button onClick={onBack} className="btn-ghost p-1.5 rounded-xl">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-base font-bold text-dark-text">Upload Direto de Apólice</h2>
          <p className="text-xs text-dark-muted">Registre uma apólice já emitida a partir do PDF, sem vincular ficha.</p>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">

          {/* ── Coluna esquerda ─────────────────────────────────── */}
          <div className="space-y-5">

            {/* Seguradora */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-dark-muted mb-3">Seguradora</p>
              <div className="grid grid-cols-3 gap-2">
                {SEGURADORAS_UPLOAD_DIRETO.map(nome => {
                  const ativo = seguradora === nome
                  return (
                    <button
                      key={nome}
                      type="button"
                      onClick={() => selecionarSeguradora(nome)}
                      className={`flex flex-col items-center gap-2.5 p-3 rounded-2xl border-2 transition-all ${
                        ativo
                          ? 'border-brand-primary shadow-sm'
                          : 'border-dark-border hover:border-dark-border/80 bg-dark-surface2/20 hover:bg-dark-surface2/40'
                      }`}
                      style={ativo ? { background: 'rgb(var(--brand-primary-rgb) / 0.06)' } : undefined}
                    >
                      <SeguradoraBadge nome={nome} size="lg" showName={false} />
                      <span className={`text-[10px] font-semibold text-center leading-tight ${ativo ? 'text-brand-primary' : 'text-dark-muted'}`}>
                        {nome.replace(' Seguros', '').replace(' Seguro', '')}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Imobiliária */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-dark-muted mb-2">Imobiliária</p>
              {imobSelecionada && (
                <div className="flex items-center gap-2.5 mb-2 px-3 py-2 rounded-xl border-2 border-brand-primary" style={{ background: 'rgb(var(--brand-primary-rgb) / 0.06)' }}>
                  <Avatar name={imobSelecionada.nome_canonico} src={imobSelecionada.imagem_url || ''} size="sm" />
                  <span className="text-xs font-semibold text-brand-primary truncate">{imobSelecionada.nome_canonico}</span>
                  <button onClick={() => setImobiliaria('')} className="ml-auto text-dark-muted hover:text-dark-text">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-muted pointer-events-none" />
                <input
                  value={buscaImob}
                  onChange={e => setBuscaImob(e.target.value)}
                  placeholder="Buscar imobiliária..."
                  className="input text-xs pl-8 py-1.5"
                />
              </div>
              <div className="max-h-44 overflow-y-auto space-y-0.5">
                {gruposFiltrados.map(grupo => {
                  const sel = imobiliaria === grupo.nome_canonico
                  return (
                    <button
                      key={grupo.id}
                      type="button"
                      onClick={() => setImobiliaria(grupo.nome_canonico)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all text-left ${
                        sel
                          ? 'border-brand-primary/40 bg-brand-primary/5'
                          : 'border-transparent hover:border-dark-border hover:bg-dark-surface2/40'
                      }`}
                    >
                      <Avatar name={grupo.nome_canonico} src={grupo.imagem_url || ''} size="sm" />
                      <span className={`text-xs font-medium truncate flex-1 ${sel ? 'text-brand-primary' : 'text-dark-text'}`}>
                        {grupo.nome_canonico}
                      </span>
                      {sel && <span className="text-[10px] font-bold text-brand-primary">✓</span>}
                    </button>
                  )
                })}
                {gruposFiltrados.length === 0 && (
                  <p className="text-xs text-dark-muted py-3 text-center">Nenhuma imobiliária encontrada</p>
                )}
              </div>
            </div>

            {/* Celular */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-dark-muted mb-2">Celular do Locatário</p>
              <input
                value={celular}
                onChange={e => setCelular(e.target.value)}
                placeholder="(00) 00000-0000"
                className="input text-sm"
              />
            </div>
          </div>

          {/* ── Coluna direita ──────────────────────────────────── */}
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-dark-muted mb-3">PDF da Apólice</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={e => handleArquivo(e.target.files?.[0] || null)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`w-full flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed transition-all ${
                  pdfFile
                    ? 'border-brand-primary/40'
                    : 'border-dark-border hover:border-dark-border/80 hover:bg-dark-surface2/30'
                }`}
                style={pdfFile ? { background: 'rgba(4,120,87,0.05)' } : undefined}
              >
                {extraindo ? (
                  <>
                    <RefreshCw className="w-7 h-7 text-dark-muted animate-spin" />
                    <span className="text-sm text-dark-muted font-medium">Lendo PDF...</span>
                  </>
                ) : pdfFile ? (
                  <>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: '#000079' }}>
                      <Upload className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-dark-text">{pdfFile.name}</p>
                      <p className="text-xs text-dark-muted mt-0.5">Leitura automática iniciada. Clique para trocar o arquivo</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-11 h-11 rounded-xl bg-dark-surface2 flex items-center justify-center">
                      <Upload className="w-5 h-5 text-dark-muted" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-dark-text">Selecionar PDF</p>
                      <p className="text-xs text-dark-muted mt-0.5">Clique para escolher o arquivo da apólice</p>
                    </div>
                  </>
                )}
              </button>

              {pdfFile && !extraindo && (
                <button
                  type="button"
                  onClick={handleExtrair}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all text-white"
                  style={{ background: '#000079' }}
                >
                  <RefreshCw className="w-4 h-4" />
                  Reprocessar PDF
                </button>
              )}

              {erro && (
                <div className="mt-3 flex items-start gap-2 p-3 rounded-xl border border-status-danger/25 bg-status-danger/8">
                  <X className="w-3.5 h-3.5 text-status-danger mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-status-danger">{erro}</p>
                </div>
              )}
            </div>

            {dadosExtraidos && (
              <div className="animate-fade-in">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-dark-muted mb-3">Dados Extraídos</p>
                <div className="grid grid-cols-2 gap-2">
                  <DadoCard label="Locatário" value={dadosExtraidos.nome_locatario} />
                  <DadoCard label="Email do proprietário" value={dadosExtraidos.email_proprietario} span2 />
                  <DadoCard label="Documento" value={dadosExtraidos.documento_locatario} mono />
                  <DadoCard label="Nº Apólice" value={dadosExtraidos.numero_apolice} mono />
                  <DadoCard label="Proposta" value={dadosExtraidos.numero_proposta} mono />
                  <DadoCard label="Vigência" value={[dadosExtraidos.inicio_vigencia, dadosExtraidos.fim_vigencia].filter(Boolean).join(' → ') || null} />
                  <DadoCard label="Parcela" value={dadosExtraidos.valor_parcela ? formatMoneyBR(dadosExtraidos.valor_parcela) : null} highlight />
                  <DadoCard label="Prêmio Líquido" value={dadosExtraidos.premio_liquido ? formatMoneyBR(dadosExtraidos.premio_liquido) : null} />
                  <DadoCard label="Parcelamento" value={dadosExtraidos.parcelamento ? `${dadosExtraidos.parcelamento}x` : null} />
                  <DadoCard label="Imóvel" value={dadosExtraidos.endereco_linha || dadosExtraidos.endereco} span2 />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-5 mt-5 border-t border-dark-border">
          <button onClick={onBack} className="btn-secondary text-sm">Cancelar</button>
          <button
            onClick={criarUploadDireto}
            disabled={!podeCriar}
            className="btn-primary text-sm"
          >
            {criando ? 'Criando...' : 'Criar Apólice'}
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
  const { grupos, resolverNome, resolverImobiliariaInfo, getAliases } = useImobiliaria()

  const [apolices, setApolices] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('total')
  const [imobFiltro, setImobFiltro] = useState('')
  const [workspace, setWorkspace] = useState('kanban')
  const [activeCard, setActiveCard] = useState(null)

  const scrollRef = useRef(null)
  const [canScrollL, setCanScrollL] = useState(false)
  const [canScrollR, setCanScrollR] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 2 } }))

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
      startTransition(() => {
        setApolices(data || [])
      })
    } catch {
      startTransition(() => {
        setApolices([])
      })
      toast({ type: 'error', title: 'Erro ao carregar apólices' })
    } finally {
      setLoading(false)
    }
  }, [filtro, getAliases, imobFiltro, toast])

  useEffect(() => {
    load()
  }, [load])

  const openApolice = useCallback((id) => {
    navigate(`/apolices/${id}`)
  }, [navigate])

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
    let frameId = null

    const measureScrollState = () => {
      setCanScrollL(el.scrollLeft > 5)
      setCanScrollR(el.scrollLeft < el.scrollWidth - el.clientWidth - 5)
    }
    const updateScrollState = () => {
      if (frameId !== null) return
      frameId = requestAnimationFrame(() => {
        frameId = null
        measureScrollState()
      })
    }

    measureScrollState()
    el.addEventListener('scroll', updateScrollState, { passive: true })
    const resizeObserver = new ResizeObserver(updateScrollState)
    resizeObserver.observe(el)

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId)
      el.removeEventListener('scroll', updateScrollState)
      resizeObserver.disconnect()
    }
  }, [loading, apolices.length])

  async function handleDragEnd({ active, over }) {
    setActiveCard(null)
    if (!over) return

    const id = active.id
    const novoStatus = over.id
    const apolice = apolices.find(item => item.id === id)

    if (!apolice || !COLUNAS.some(col => col.id === novoStatus) || apolice.status_emissao === novoStatus) {
      return
    }

    startTransition(() => {
      setApolices(prev => prev.map(item => (
        item.id === id ? { ...item, status_emissao: novoStatus } : item
      )))
    })

    const error = await moverStatusApolice(id, novoStatus)
    if (error) {
      toast({ type: 'error', title: 'Erro ao mover apólice' })
      load()
    }
  }

  function handleCriado(novaApolice) {
    if (!novaApolice?.id) {
      load()
      return
    }

    startTransition(() => {
      setApolices(prev => {
        const semDuplicata = prev.filter(item => item.id !== novaApolice.id)
        return [{ ...novaApolice, status_emissao: novaApolice.status_emissao || 'recebida' }, ...semDuplicata]
      })
    })
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="title-page text-dark-text">Gestão de Apólices</h1>
          <p className="text-xs text-dark-muted mt-0.5">Arraste as apólices entre as colunas para atualizar o status</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-dark-surface2 border border-dark-border rounded-lg p-0.5">
          {['total', 'hoje', 'semana', 'mes'].map(item => (
            <button
              key={item}
              onClick={() => setFiltro(item)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filtro === item ? 'bg-brand-secondary text-white shadow-sm' : 'text-dark-muted hover:text-dark-text'
              }`}
            >
              {item === 'total' ? 'Todos' : item === 'hoje' ? 'Hoje' : item === 'semana' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={imobFiltro}
            onChange={event => setImobFiltro(event.target.value)}
            className="select text-sm py-1.5"
            style={{ minWidth: '220px' }}
          >
            <option value="">Todas as imobiliárias</option>
            {grupos.map(grupo => (
              <option key={grupo.id} value={grupo.nome_canonico}>{grupo.nome_canonico}</option>
            ))}
          </select>

          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dark-border text-xs text-dark-muted hover:text-dark-text transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </button>

          <button
            onClick={() => setWorkspace(prev => (prev === 'iniciar' ? 'kanban' : 'iniciar'))}
            className={`flex items-center gap-2 text-sm ${workspace === 'iniciar' ? 'btn-secondary' : 'btn-primary'}`}
          >
            <Plus className="w-4 h-4" />
            {workspace === 'iniciar' ? 'Fechar emissão' : 'Iniciar Emissão'}
          </button>
          <button
            onClick={() => setWorkspace(prev => (prev === 'upload' ? 'kanban' : 'upload'))}
            className={`flex items-center gap-2 text-sm ${workspace === 'upload' ? 'btn-secondary' : 'btn-primary'}`}
          >
            <Upload className="w-4 h-4" />
            {workspace === 'upload' ? 'Fechar upload' : 'Upload direto'}
          </button>
        </div>
      </div>

      {workspace === 'iniciar' && (
        <IniciarEmissaoWorkspace
          onBack={() => setWorkspace('kanban')}
          onCriado={handleCriado}
          toast={toast}
          grupos={grupos}
          getAliases={getAliases}
          user={user}
        />
      )}

      {workspace === 'upload' && (
        <UploadDiretoWorkspace
          onBack={() => setWorkspace('kanban')}
          onCriado={handleCriado}
          toast={toast}
          grupos={grupos}
          user={user}
        />
      )}

      {workspace !== 'kanban' ? null : loading ? (
        <KanbanSkeleton />
      ) : (
        <div className="relative kanban-viewport min-h-[calc(100vh-16rem)]">
          {canScrollL && (
            <>
              <div className="absolute left-0 top-0 bottom-4 w-16 z-10 pointer-events-none" style={{ background: 'linear-gradient(to right, rgb(var(--color-bg)), transparent)' }} />
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
              <div className="absolute right-0 top-0 bottom-4 w-16 z-10 pointer-events-none" style={{ background: 'linear-gradient(to left, rgb(var(--color-bg)), transparent)' }} />
              <button
                onClick={() => scrollRef.current?.scrollBy({ left: 280, behavior: 'smooth' })}
                className="absolute right-0.5 top-[60px] z-20 w-7 h-7 rounded-full bg-dark-surface border border-dark-border shadow-md flex items-center justify-center text-dark-muted hover:text-dark-text transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          <div ref={scrollRef} className="kanban-scroll h-full overflow-x-auto pb-2">
            <DndContext
              sensors={sensors}
              collisionDetection={kanbanPointerCollision}
              onDragStart={({ active }) => {
                const nextId = active.id
                setActiveCard(apolices.find(item => item.id === nextId) || null)
              }}
              onDragEnd={handleDragEnd}
              onDragCancel={() => {
                setActiveCard(null)
              }}
            >
              <div className="flex min-h-full items-stretch gap-3 min-w-max px-1">
                {COLUNAS.map(col => (
                  <DroppableColumn
                    key={col.id}
                    col={col}
                    apolices={groups[col.id] || []}
                    resolverNome={resolverNome}
                    resolverImobiliariaInfo={resolverImobiliariaInfo}
                    onOpen={openApolice}
                  />
                ))}
              </div>

              <DragOverlay dropAnimation={null} modifiers={KANBAN_DRAG_OVERLAY_MODIFIERS}>
                {activeCard ? (
                  <div style={{ width: 'var(--kanban-col-w, 286px)', pointerEvents: 'none' }}>
                    <KanbanCard apolice={activeCard} resolverNome={resolverNome} resolverImobiliariaInfo={resolverImobiliariaInfo} isDragOverlay />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        </div>
      )}
    </div>
  )
}




