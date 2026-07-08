import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { memo } from 'react'
import { startTransition } from 'react'
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import {
  Briefcase,
  Building,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Files,
  GripVertical,
  Home,
  LayoutGrid,
  Link2,
  Percent,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
  AlertTriangle,
} from 'lucide-react'
import {
  buscarApolicePorNumero,
  buscarApolicePorFichaId,
  calculateValorComissao,
  criarApolice,
  fetchApolicesKanban,
  formatMoneyBR,
  moverStatusApolice,
  vincularApoliceAFicha,
  STATUS_EMISSAO_LABELS,
} from '../lib/apolices'
import { normalizeNumeroApolice } from '../lib/apolicesNumero'
import { buscarFichasParaVinculoApolice, fetchFichasAprovadasEmissao, matchFichasPorNome } from '../lib/fichas'
import { sanitizeProprietarioNome } from '../lib/text'
import { uploadDocumento } from '../lib/documentos'
import { normalizeDisplayText } from '../lib/text'
import { useImobiliaria } from '../hooks/useImobiliaria'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { KanbanSkeleton } from '../components/Skeleton'
import SeguradoraBadge from '../components/SeguradoraBadge'
import { Avatar, Modal } from '../components/ui'
import ImobiliariaSelect from '../components/ImobiliariaSelect'
import { kanbanPointerCollision, KANBAN_DRAG_OVERLAY_MODIFIERS } from '../lib/kanbanDnd'

const COLUNAS = [
  { id: 'recebida', label: 'Recebida', color: '#3B82F6' },
  { id: 'proposta_transmitida', label: 'Proposta Transmitida', color: '#F59E0B' },
  { id: 'emitida', label: 'Proposta Transmitida', color: '#8B5CF6' },
  { id: 'enviada', label: 'Apólice Enviada', color: '#059669' },
]

const PRODUTO_ICON = { residencial_pf: Home, comercial_pf: Briefcase, pessoa_juridica: Building }
const PRODUTO_COLOR = { residencial_pf: '#4A90D9', comercial_pf: '#059669', pessoa_juridica: '#8B5CF6' }
const PRODUTO_ABBR = { residencial_pf: 'RES. PF', comercial_pf: 'COM. PF', pessoa_juridica: 'PJ' }
const SEGURADORAS_UPLOAD_DIRETO = ['Porto Seguro', 'Pottencial Seguros', 'TOO Seguros', 'Tokio Marine']
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
    <div className="rounded-xl border border-dark-border/60 bg-dark-surface/80 px-2 py-1.5">
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
          <div className="rounded-xl border border-dark-border/60 bg-dark-surface/80 px-2 py-1.5">
            <p className="text-[8px] uppercase tracking-[0.14em] text-dark-muted">Seguradora</p>
            <div className="mt-1 min-w-0">
              {apolice?.seguradora
                ? <SeguradoraBadge nome={apolice.seguradora} size="xs" showName className="max-w-full" />
                : <p className="text-[10px] text-dark-muted">—</p>}
            </div>
          </div>
          <div className="rounded-xl border border-dark-border/60 bg-dark-surface/80 px-2 py-1.5">
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
        willChange: isDragging ? 'transform' : 'auto',
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

function IniciarEmissaoWorkspace({ onBack, onCriado, onAbrirApolice, toast, grupos, getAliases, user }) {
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
    const existente = await buscarApolicePorFichaId(fichaSelecionada.id)
    if (existente) {
      setCriando(false)
      toast({
        type: 'warning',
        title: 'Lead j� possui ap�lice',
        message: 'A ficha selecionada j� possui uma ap�lice' + (existente.numero_apolice ? ' (' + existente.numero_apolice + ')' : '') + (existente.seguradora ? ' na ' + existente.seguradora : '') + '.',
        action: onAbrirApolice && existente.id ? { label: 'Abrir ap�lice', onClick: () => onAbrirApolice(existente.id) } : undefined,
        duration: 10000,
      })
      return
    }
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
    <section className="glass-panel rounded-3xl overflow-hidden animate-fade-in min-h-0 max-h-[calc(100dvh-14rem)] overflow-y-auto">
      <div className="flex items-center justify-between gap-4 px-7 py-5 border-b border-dark-border">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/20 bg-brand-accent/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-primary">
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

          <div className="rounded-3xl border border-dark-border bg-dark-surface/70 overflow-hidden">
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
          <div className="rounded-3xl border border-dark-border bg-dark-surface/80 p-5">
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
                <div className="input min-h-[44px] bg-dark-surface/70 flex items-center text-sm">
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

function UploadDiretoWorkspace({ onBack, onCriado, onAbrirApolice, toast, grupos, user }) {
  const [seguradora, setSeguradora] = useState('Porto Seguro')
  const [imobiliaria, setImobiliaria] = useState('')
  const [buscaImob, setBuscaImob] = useState('')
  const [celular, setCelular] = useState('')
  const [pdfFile, setPdfFile] = useState(null)
  const [extraindo, setExtraindo] = useState(false)
  const [criando, setCriando] = useState(false)
  const [dadosExtraidos, setDadosExtraidos] = useState(null)
  const [apoliceExistente, setApoliceExistente] = useState(null)
  const [erro, setErro] = useState('')
  const fileInputRef = useRef(null)

  function avisarApoliceDuplicada(existente, numeroApolice) {
    if (!existente?.id) return
    toast({
      type: 'warning',
      title: 'Apólice já cadastrada',
      message: 'A apólice ' + (existente.numero_apolice || numeroApolice) + ' já existe no sistema.',
      action: onAbrirApolice ? { label: 'Abrir apólice', onClick: () => onAbrirApolice(existente.id) } : undefined,
      duration: 10000,
    })
  }

  async function verificarDuplicidade(numeroApolice, { silent = false } = {}) {
    const numero = String(numeroApolice || '').trim()
    if (!numero) {
      setApoliceExistente(null)
      return null
    }

    try {
      const existente = await buscarApolicePorNumero(numero)
      setApoliceExistente(existente)
      if (existente && !silent) avisarApoliceDuplicada(existente, numero)
      return existente
    } catch (err) {
      if (!silent) {
        toast({ type: 'error', title: 'Erro ao verificar duplicidade', message: err?.message || 'Não foi possível verificar o número da apólice.' })
      }
      return null
    }
  }

  const gruposFiltrados = useMemo(() => {
    const q = buscaImob.trim().toLowerCase()
    if (!q) return grupos
    return grupos.filter(g => g.nome_canonico.toLowerCase().includes(q))
  }, [grupos, buscaImob])

  function selecionarSeguradora(nome) {
    setSeguradora(nome)
    setPdfFile(null)
    setDadosExtraidos(null)
    setApoliceExistente(null)
    setErro('')
  }

  function handleArquivo(file) {
    setPdfFile(file)
    setDadosExtraidos(null)
    setApoliceExistente(null)
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
      if (parsed.numero_apolice) {
        await verificarDuplicidade(parsed.numero_apolice)
      } else {
        setApoliceExistente(null)
      }
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

    const numeroApolice = String(dadosExtraidos.numero_apolice || '').trim()
    const duplicada = apoliceExistente || await verificarDuplicidade(numeroApolice, { silent: true })
    if (duplicada) {
      setCriando(false)
      avisarApoliceDuplicada(duplicada, numeroApolice)
      return
    }

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
      status_emissao: dadosExtraidos.status_emissao || 'emitida',
      data_emissao: dadosExtraidos.data_emissao || new Date().toISOString().slice(0, 10),
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
      valor_aluguel: dadosExtraidos.valor_aluguel ?? null,
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
  const podeCriar = pdfFile && dadosExtraidos && imobiliaria && celular.trim() && !extraindo && !criando && !apoliceExistente

  return (
    <div className="card p-0 overflow-hidden animate-fade-in min-h-0 max-h-[calc(100dvh-14rem)] overflow-y-auto">
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

          {/* ── Coluna esquerda ──────────────────────────────────── */}
          <div className="space-y-5">

            {/* Seguradora */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-dark-muted mb-3">Seguradora</p>
              <div className="grid grid-cols-2 gap-2">
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

          {/* ── Coluna direita ───────────────────────────────────── */}
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

              {apoliceExistente && (
                <div className="mt-3 flex items-start gap-3 p-3 rounded-xl border border-status-warning/25 bg-status-warning/8">
                  <AlertTriangle className="w-4 h-4 text-status-warning mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-dark-text">Já existe uma apólice com esse número.</p>
                    <p className="mt-1 text-xs text-dark-muted">
                      {apoliceExistente.numero_apolice || dadosExtraidos?.numero_apolice || 'Sem número'}
                      {' · '}
                      {apoliceExistente.seguradora || 'Sem seguradora'}
                      {' · '}
                      {apoliceExistente.imobiliaria || 'Sem imobiliária'}
                    </p>
                    <button
                      type="button"
                      onClick={() => onAbrirApolice?.(apoliceExistente.id)}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-status-warning hover:opacity-75 transition-opacity"
                    >
                      Abrir apólice existente
                    </button>
                  </div>
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

const MAX_ARQUIVOS_LOTE = 10

function novoItemLote(file) {
  return {
    id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
    file,
    status: 'pendente', // pendente | extraindo | ok | erro | criando | criado | erro_criacao
    dadosExtraidos: null,
    erro: '',
    duplicidadeNumero: null,
    confirmadoDiferente: false,
    imobiliariaSelecionada: '',
    carregandoFichasRow: false,
    fichasCandidatas: [],
    fichaSelecionadaId: null,
    apoliceDivergente: null,
    pctComissao: '',
    selecionado: false,
  }
}

function abrirApoliceEmNovaAba(id) {
  if (!id) return
  window.open(`/apolices/${id}`, '_blank', 'noopener,noreferrer')
}

function montarPayloadApoliceLote(item, { seguradora, user }) {
  const dados = item.dadosExtraidos || {}
  const documento = dados.documento_locatario || ''
  const { cpf, cnpj, isPessoaJuridica } = formatDocumentoTipo(documento)
  const produto = inferProdutoFianca({ documento, tipoImovel: dados.tipo_imovel })
  const premioLiquido = dados.premio_liquido ?? null
  const pctNumero = item.pctComissao !== '' && item.pctComissao !== null && item.pctComissao !== undefined
    ? Number(item.pctComissao)
    : null

  return {
    ficha_id: item.fichaSelecionadaId || null,
    imobiliaria: item.imobiliariaSelecionada || null,
    produto,
    nome_interessado: isPessoaJuridica ? null : (dados.nome_locatario || null),
    nome_empresa: isPessoaJuridica ? (dados.nome_locatario || null) : null,
    numero_apolice: dados.numero_apolice || null,
    numero_proposta: dados.numero_proposta || null,
    seguradora,
    status_emissao: dados.status_emissao || 'emitida',
    data_emissao: dados.data_emissao || new Date().toISOString().slice(0, 10),
    emitido_por: user?.id || null,
    proprietario_nome: sanitizeProprietarioNome(dados.nome_proprietario) || null,
    endereco: dados.endereco || null,
    inicio_vigencia: dados.inicio_vigencia || null,
    fim_vigencia: dados.fim_vigencia || null,
    parcelamento: dados.parcelamento || null,
    valor_parcela: dados.valor_parcela || null,
    premio_liquido: premioLiquido,
    premio_total: dados.premio_total || null,
    valor_producao: dados.premio_total || null,
    forma_pagamento: dados.forma_pagamento || null,
    email_proprietario: dados.email_proprietario || null,
    cpf: cpf || null,
    cnpj: cnpj || null,
    celular: dados.celular_locatario || dados.proprietario_cel || null,
    tipo_imovel: dados.tipo_imovel || null,
    cep: dados.cep || null,
    valor_aluguel: dados.valor_aluguel ?? null,
    pct_comissao: pctNumero,
    valor_comissao: pctNumero !== null ? calculateValorComissao(premioLiquido, pctNumero) : null,
  }
}

function UploadLoteWorkspace({ onBack, onCriado, toast, getAliases, user }) {
  const [seguradora, setSeguradora] = useState('Porto Seguro')
  const [itens, setItens] = useState([])
  const [todasFichas, setTodasFichas] = useState([])
  const [carregandoFichas, setCarregandoFichas] = useState(true)
  const [registrando, setRegistrando] = useState(false)
  const [modalItemId, setModalItemId] = useState(null)
  const fileInputRef = useRef(null)

  const loteIniciado = itens.length > 0

  useEffect(() => {
    let cancelado = false
    async function carregar() {
      setCarregandoFichas(true)
      try {
        const data = await buscarFichasParaVinculoApolice({})
        if (!cancelado) setTodasFichas(data)
      } catch {
        if (!cancelado) {
          setTodasFichas([])
          toast({ type: 'error', title: 'Erro ao carregar fichas' })
        }
      } finally {
        if (!cancelado) setCarregandoFichas(false)
      }
    }
    carregar()
    return () => { cancelado = true }
  }, [toast])

  async function checarApoliceDaFicha(itemId, fichaId) {
    if (!fichaId) return
    const existente = await buscarApolicePorFichaId(fichaId).catch(() => null)
    if (!existente) return
    setItens(prev => prev.map(i => {
      if (i.id !== itemId || i.fichaSelecionadaId !== fichaId) return i
      const numeroNovo = normalizeNumeroApolice(i.dadosExtraidos?.numero_apolice)
      const numeroExistente = normalizeNumeroApolice(existente.numero_apolice)
      const divergente = numeroExistente && numeroNovo && numeroExistente !== numeroNovo
      return { ...i, apoliceDivergente: divergente ? existente : null }
    }))
  }

  async function processarItens(alvos) {
    for (const item of alvos) {
      setItens(prev => prev.map(i => (i.id === item.id ? { ...i, status: 'extraindo', erro: '' } : i)))
      try {
        const { parseApolice } = await import('../lib/apoliceParser')
        const { campos, extras, semParser } = await parseApolice(seguradora, item.file)
        const dados = { ...campos, ...extras }

        let duplicidadeNumero = null
        if (dados.numero_apolice) {
          duplicidadeNumero = await buscarApolicePorNumero(dados.numero_apolice).catch(() => null)
        }

        const erro = semParser || (!dados.numero_apolice && !dados.nome_locatario)
          ? `Não foi possível identificar dados da apólice ${seguradora}. Verifique se o PDF é da seguradora selecionada.`
          : ''

        setItens(prev => prev.map(i => (i.id === item.id ? {
          ...i,
          status: erro ? 'erro' : 'ok',
          dadosExtraidos: dados,
          erro,
          duplicidadeNumero,
          confirmadoDiferente: false,
          selecionado: false,
        } : i)))
      } catch (err) {
        setItens(prev => prev.map(i => (i.id === item.id ? {
          ...i,
          status: 'erro',
          erro: err?.message || 'Erro ao ler o PDF da apólice.',
        } : i)))
      }
    }
  }

  function handleArquivos(fileList) {
    const arquivos = Array.from(fileList || []).filter(Boolean)
    if (!arquivos.length) return

    const vagas = MAX_ARQUIVOS_LOTE - itens.length
    if (vagas <= 0) {
      toast({ type: 'warning', title: `Limite de ${MAX_ARQUIVOS_LOTE} apólices por lote atingido` })
      return
    }

    const aceitos = arquivos.slice(0, vagas)
    if (arquivos.length > vagas) {
      toast({ type: 'warning', title: `Apenas ${vagas} arquivo(s) foram adicionados (limite de ${MAX_ARQUIVOS_LOTE} por lote)` })
    }

    const novos = aceitos.map(novoItemLote)
    setItens(prev => [...prev, ...novos])
    void processarItens(novos)
  }

  function removerItem(id) {
    setItens(prev => prev.filter(i => i.id !== id))
  }

  function toggleSelecionado(id) {
    setItens(prev => prev.map(i => (i.id === id ? { ...i, selecionado: !i.selecionado } : i)))
  }

  async function handleImobiliariaRow(itemId, nomeImobiliaria) {
    const itemAtual = itens.find(i => i.id === itemId)
    setItens(prev => prev.map(i => (i.id === itemId ? {
      ...i,
      imobiliariaSelecionada: nomeImobiliaria,
      fichasCandidatas: [],
      fichaSelecionadaId: null,
      apoliceDivergente: null,
      carregandoFichasRow: Boolean(nomeImobiliaria),
      selecionado: false,
    } : i)))

    if (!nomeImobiliaria) return

    const aliases = await getAliases(nomeImobiliaria).catch(() => [nomeImobiliaria])
    const nomeLocatario = itemAtual?.dadosExtraidos?.nome_locatario
    const doGrupo = todasFichas.filter(f => aliases.includes(f.imobiliaria))
    const candidatas = nomeLocatario ? matchFichasPorNome(doGrupo, nomeLocatario) : []
    const fichaAuto = candidatas.length === 1 ? candidatas[0] : null

    setItens(prev => prev.map(i => (i.id === itemId ? {
      ...i,
      carregandoFichasRow: false,
      fichasCandidatas: candidatas,
      fichaSelecionadaId: fichaAuto?.id || null,
      selecionado: i.status === 'ok' && !i.duplicidadeNumero,
    } : i)))

    if (fichaAuto) void checarApoliceDaFicha(itemId, fichaAuto.id)
  }

  function definirFicha(id, fichaId) {
    setItens(prev => prev.map(i => (i.id === id ? { ...i, fichaSelecionadaId: fichaId || null, apoliceDivergente: null } : i)))
    if (fichaId) void checarApoliceDaFicha(id, fichaId)
  }

  function definirComissao(id, value) {
    setItens(prev => prev.map(i => (i.id === id ? { ...i, pctComissao: value } : i)))
  }

  function confirmarDiferente(id) {
    setItens(prev => prev.map(i => (i.id === id ? {
      ...i,
      confirmadoDiferente: true,
      selecionado: Boolean(i.imobiliariaSelecionada),
    } : i)))
    setModalItemId(null)
  }

  function tentarNovamente(item) {
    if (item.status === 'erro_criacao') {
      setItens(prev => prev.map(i => (i.id === item.id ? { ...i, status: 'ok', erro: '' } : i)))
    } else {
      void processarItens([item])
    }
  }

  const podeRegistrar = !registrando && itens.some(i => i.selecionado && i.status === 'ok' && i.imobiliariaSelecionada)
  const totalSelecionadas = itens.filter(i => i.selecionado && i.status === 'ok' && i.imobiliariaSelecionada).length

  async function registrarSelecionadas() {
    setRegistrando(true)

    const alvos = itens.filter(i => i.selecionado && i.status === 'ok' && i.imobiliariaSelecionada)
    let sucesso = 0
    let falhas = 0

    for (const item of alvos) {
      setItens(prev => prev.map(i => (i.id === item.id ? { ...i, status: 'criando' } : i)))

      const numeroApolice = String(item.dadosExtraidos?.numero_apolice || '').trim()
      const duplicada = numeroApolice
        ? await buscarApolicePorNumero(numeroApolice).catch(() => null)
        : null
      if (duplicada && !item.confirmadoDiferente) {
        falhas += 1
        setItens(prev => prev.map(i => (i.id === item.id ? {
          ...i,
          status: 'ok',
          duplicidadeNumero: duplicada,
          erro: 'Apólice duplicada — confirme em "Verificar dados" antes de registrar.',
        } : i)))
        continue
      }

      const payload = montarPayloadApoliceLote(item, { seguradora, user })
      const { data, error } = await criarApolice(payload)
      if (error) {
        falhas += 1
        setItens(prev => prev.map(i => (i.id === item.id ? { ...i, status: 'erro_criacao', erro: error.message } : i)))
        continue
      }

      const { error: uploadError } = await uploadDocumento({
        file: item.file,
        apoliceId: data?.id,
        cpfCnpj: payload.cpf || payload.cnpj,
        userId: user?.id,
      })

      if (item.fichaSelecionadaId) {
        await vincularApoliceAFicha(item.fichaSelecionadaId, payload)
      }

      sucesso += 1
      setItens(prev => prev.map(i => (i.id === item.id ? {
        ...i,
        status: 'criado',
        erro: uploadError ? 'PDF não anexado: ' + uploadError.message : '',
      } : i)))
    }

    setRegistrando(false)
    setItens(prev => prev.filter(i => i.status !== 'criado'))

    if (sucesso) {
      toast({
        type: 'success',
        title: `${sucesso} apólice(s) criada(s)`,
        message: falhas ? `${falhas} com erro — revise a lista.` : undefined,
      })
      onCriado?.()
    } else if (falhas) {
      toast({ type: 'error', title: 'Nenhuma apólice criada', message: 'Revise os itens com erro na lista.' })
    }
  }

  const itemModal = itens.find(i => i.id === modalItemId) || null

  return (
    <div className="card p-0 overflow-hidden animate-fade-in min-h-0 max-h-[calc(100dvh-14rem)] overflow-y-auto">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-dark-border">
        <button onClick={onBack} className="btn-ghost p-1.5 rounded-xl">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-base font-bold text-dark-text">Upload em Lote de Apólices</h2>
          <p className="text-xs text-dark-muted">Escolha a seguradora, anexe até {MAX_ARQUIVOS_LOTE} PDFs e selecione a imobiliária de cada apólice na própria linha.</p>
        </div>
      </div>

      <div className="p-6 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          <div className="space-y-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-dark-muted mb-3">Seguradora</p>
              <div className={`grid grid-cols-2 gap-2 ${loteIniciado ? 'opacity-60 pointer-events-none' : ''}`}>
                {SEGURADORAS_UPLOAD_DIRETO.map(nome => {
                  const ativo = seguradora === nome
                  return (
                    <button
                      key={nome}
                      type="button"
                      onClick={() => setSeguradora(nome)}
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

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                multiple
                className="hidden"
                onChange={e => {
                  handleArquivos(e.target.files)
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={itens.length >= MAX_ARQUIVOS_LOTE}
                className="w-full flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-dark-border hover:border-dark-border/80 hover:bg-dark-surface2/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-11 h-11 rounded-xl bg-dark-surface2 flex items-center justify-center">
                  <Files className="w-5 h-5 text-dark-muted" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-dark-text">
                    {itens.length === 0 ? 'Selecionar PDFs' : `Adicionar mais PDFs (${itens.length}/${MAX_ARQUIVOS_LOTE})`}
                  </p>
                  <p className="text-xs text-dark-muted mt-0.5">Até {MAX_ARQUIVOS_LOTE} arquivos da {seguradora}</p>
                </div>
              </button>
              {carregandoFichas && (
                <p className="mt-2 text-[11px] text-dark-muted flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Carregando fichas do sistema...
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-dark-muted">Apólices do lote</p>
              <span className="text-xs text-dark-muted">{itens.length} de {MAX_ARQUIVOS_LOTE}</span>
            </div>

            {itens.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-dark-border p-8 text-center text-sm text-dark-muted">
                Nenhum PDF adicionado ainda.
              </div>
            ) : (
              <div className="space-y-2">
                {itens.map(item => (
                  <LinhaApoliceLote
                    key={item.id}
                    item={item}
                    onToggle={() => toggleSelecionado(item.id)}
                    onRemover={() => removerItem(item.id)}
                    onVerificar={() => setModalItemId(item.id)}
                    onDefinirImobiliaria={nome => handleImobiliariaRow(item.id, nome)}
                    onDefinirFicha={fichaId => definirFicha(item.id, fichaId)}
                    onDefinirComissao={value => definirComissao(item.id, value)}
                    onTentarNovamente={() => tentarNovamente(item)}
                    onVerApoliceDivergente={() => abrirApoliceEmNovaAba(item.apoliceDivergente?.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-5 border-t border-dark-border">
          <button onClick={onBack} className="btn-secondary text-sm">Cancelar</button>
          <button onClick={registrarSelecionadas} disabled={!podeRegistrar} className="btn-primary text-sm">
            {registrando ? 'Registrando...' : `Registrar selecionadas (${totalSelecionadas})`}
          </button>
        </div>
      </div>

      {itemModal && (
        <Modal isOpen onClose={() => setModalItemId(null)} title="Verificar dados extraídos" subtitle={itemModal.file.name} maxWidth="lg">
          <div className="grid grid-cols-2 gap-2">
            <DadoCard label="Locatário" value={itemModal.dadosExtraidos?.nome_locatario} span2 />
            <DadoCard label="Documento" value={itemModal.dadosExtraidos?.documento_locatario} mono />
            <DadoCard label="Nº Apólice" value={itemModal.dadosExtraidos?.numero_apolice} mono />
            <DadoCard label="Proposta" value={itemModal.dadosExtraidos?.numero_proposta} mono />
            <DadoCard
              label="Vigência"
              value={[itemModal.dadosExtraidos?.inicio_vigencia, itemModal.dadosExtraidos?.fim_vigencia].filter(Boolean).join(' → ') || null}
              span2
            />
            <DadoCard label="Prêmio Líquido" value={itemModal.dadosExtraidos?.premio_liquido ? formatMoneyBR(itemModal.dadosExtraidos.premio_liquido) : null} />
            <DadoCard label="Parcela" value={itemModal.dadosExtraidos?.valor_parcela ? formatMoneyBR(itemModal.dadosExtraidos.valor_parcela) : null} highlight />
            <DadoCard label="Imóvel" value={itemModal.dadosExtraidos?.endereco} span2 />
          </div>

          {itemModal.duplicidadeNumero && (
            <div className="mt-4 flex items-start gap-3 p-3 rounded-xl border border-status-danger/25 bg-status-danger/8">
              <AlertTriangle className="w-4 h-4 text-status-danger mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-dark-text">Já existe uma apólice com esse número no sistema.</p>
                <p className="mt-1 text-xs text-dark-muted">
                  {itemModal.duplicidadeNumero.numero_apolice || 'Sem número'}
                  {' · '}{itemModal.duplicidadeNumero.seguradora || 'Sem seguradora'}
                  {' · '}{itemModal.duplicidadeNumero.imobiliaria || 'Sem imobiliária'}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => abrirApoliceEmNovaAba(itemModal.duplicidadeNumero.id)}
                    className="text-xs font-semibold text-status-danger hover:opacity-75 transition-opacity"
                  >
                    Abrir apólice existente
                  </button>
                  {!itemModal.confirmadoDiferente && (
                    <button
                      type="button"
                      onClick={() => confirmarDiferente(itemModal.id)}
                      className="text-xs font-semibold text-brand-primary hover:opacity-75 transition-opacity"
                    >
                      É uma apólice diferente
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {itemModal.apoliceDivergente && (
            <div className="mt-4 flex items-start gap-3 p-3 rounded-xl border border-status-warning/25 bg-status-warning/8">
              <AlertTriangle className="w-4 h-4 text-status-warning mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-dark-text">Essa ficha já tem uma apólice com número diferente.</p>
                <p className="mt-1 text-xs text-dark-muted">
                  {itemModal.apoliceDivergente.numero_apolice || 'Sem número'}
                  {' · '}{itemModal.apoliceDivergente.seguradora || 'Sem seguradora'}
                  {' · '}{itemModal.apoliceDivergente.imobiliaria || 'Sem imobiliária'}
                </p>
                <button
                  type="button"
                  onClick={() => abrirApoliceEmNovaAba(itemModal.apoliceDivergente.id)}
                  className="mt-2 text-xs font-semibold text-status-warning hover:opacity-75 transition-opacity"
                >
                  Abrir apólice vinculada à ficha
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

function LinhaApoliceLote({
  item,
  onToggle,
  onRemover,
  onVerificar,
  onDefinirImobiliaria,
  onDefinirFicha,
  onDefinirComissao,
  onTentarNovamente,
  onVerApoliceDivergente,
}) {
  const dados = item.dadosExtraidos || {}
  const bloqueadoPorDuplicidade = Boolean(item.duplicidadeNumero) && !item.confirmadoDiferente
  const emProcesso = item.status === 'extraindo' || item.status === 'criando'
  const comErro = item.status === 'erro' || item.status === 'erro_criacao'
  const temDuplicidade = Boolean(item.duplicidadeNumero) && !item.confirmadoDiferente
  const temDivergencia = !temDuplicidade && Boolean(item.apoliceDivergente)

  return (
    <div className={`rounded-2xl border p-3.5 transition-all ${
      comErro ? 'border-status-danger/30 bg-status-danger/5'
        : temDuplicidade ? 'border-status-danger/40 bg-status-danger/8'
        : temDivergencia ? 'border-status-warning/30 bg-status-warning/5'
        : 'border-dark-border bg-dark-surface2/20'
    }`}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          disabled={bloqueadoPorDuplicidade || item.status !== 'ok' || !item.imobiliariaSelecionada}
          className="mt-0.5 disabled:opacity-40"
        >
          {item.selecionado ? (
            <CheckCircle2 className="w-4 h-4 text-brand-primary" />
          ) : (
            <Circle className="w-4 h-4 text-dark-muted" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-dark-text truncate">
              {dados.nome_locatario || item.file.name}
            </p>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="relative">
                <Percent className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-dark-muted pointer-events-none" />
                <input
                  value={item.pctComissao}
                  onChange={e => onDefinirComissao(e.target.value)}
                  placeholder="Comissão"
                  className="input text-xs py-1 pl-6 w-24"
                  inputMode="decimal"
                />
              </div>
              <button type="button" onClick={onRemover} className="text-dark-muted hover:text-status-danger transition-colors p-1">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <p className="mt-0.5 text-xs text-dark-muted truncate">
            {item.file.name}
            {dados.numero_apolice && <> · Nº {dados.numero_apolice}</>}
          </p>

          {emProcesso && (
            <p className="mt-1.5 text-xs text-dark-muted flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3 animate-spin" />
              {item.status === 'extraindo' ? 'Lendo PDF...' : 'Registrando...'}
            </p>
          )}

          {item.erro && (
            <div className="mt-1.5 flex items-center gap-2">
              <p className="text-xs text-status-danger">{item.erro}</p>
              {comErro && (
                <button type="button" onClick={onTentarNovamente} className="text-xs font-semibold text-brand-primary hover:opacity-75 transition-opacity flex-shrink-0">
                  Tentar novamente
                </button>
              )}
            </div>
          )}

          {temDuplicidade && !item.erro && (
            <div className="mt-2 flex items-center gap-2 text-xs text-status-danger">
              <AlertTriangle className="w-3.5 h-3.5" />
              Apólice já cadastrada no sistema — confirme em "Verificar dados" para liberar a seleção.
            </div>
          )}

          {temDivergencia && (
            <div className="mt-2 flex items-center gap-2 text-xs text-status-warning">
              <AlertTriangle className="w-3.5 h-3.5" />
              A ficha vinculada já tem apólice com número diferente.
              <button type="button" onClick={onVerApoliceDivergente} className="font-semibold underline hover:opacity-75 transition-opacity flex-shrink-0">
                Verificar apólice existente
              </button>
            </div>
          )}

          {item.status === 'ok' && (
            <div className="mt-2">
              <ImobiliariaSelect
                value={item.imobiliariaSelecionada}
                onChange={onDefinirImobiliaria}
                placeholder="Selecionar imobiliária"
                showAll={false}
                required
                className="text-xs max-w-xs"
              />
            </div>
          )}

          {item.status === 'ok' && item.imobiliariaSelecionada && (
            <div className="mt-2 flex items-center gap-2">
              <Link2 className="w-3.5 h-3.5 text-dark-muted flex-shrink-0" />
              {item.carregandoFichasRow ? (
                <span className="text-xs text-dark-muted flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Buscando fichas...
                </span>
              ) : item.fichasCandidatas.length > 0 ? (
                <select
                  value={item.fichaSelecionadaId || ''}
                  onChange={e => onDefinirFicha(e.target.value || null)}
                  className="select text-xs py-1"
                >
                  <option value="">Nenhuma ficha (não vincular)</option>
                  {item.fichasCandidatas.map(ficha => (
                    <option key={ficha.id} value={ficha.id}>
                      {ficha.nome_empresa || ficha.nome_interessado || 'Sem nome'} · {ficha.status}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-dark-muted">Nenhuma ficha correspondente encontrada</span>
              )}
            </div>
          )}

          {item.status === 'ok' && (
            <button type="button" onClick={onVerificar} className="mt-2 text-xs font-semibold text-brand-primary hover:opacity-75 transition-opacity">
              Verificar dados
            </button>
          )}
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
  const [filtro, setFiltro] = useState('hoje')
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
    <div className="apolices-gestao-page flex h-full min-h-0 w-full flex-1 flex-col gap-4 animate-fade-in">
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
                filtro === item ? 'bg-brand-primary text-white shadow-sm' : 'text-dark-muted hover:text-dark-text'
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
          <button
            onClick={() => setWorkspace(prev => (prev === 'upload_lote' ? 'kanban' : 'upload_lote'))}
            className={`flex items-center gap-2 text-sm ${workspace === 'upload_lote' ? 'btn-secondary' : 'btn-primary'}`}
          >
            <Files className="w-4 h-4" />
            {workspace === 'upload_lote' ? 'Fechar upload em lote' : 'Upload em Lote'}
          </button>
        </div>
      </div>

      {workspace === 'iniciar' && (
        <IniciarEmissaoWorkspace
          onBack={() => setWorkspace('kanban')}
          onCriado={handleCriado}
          onAbrirApolice={openApolice}
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
          onAbrirApolice={openApolice}
          toast={toast}
          grupos={grupos}
          user={user}
        />
      )}

      {workspace === 'upload_lote' && (
        <UploadLoteWorkspace
          onBack={() => setWorkspace('kanban')}
          onCriado={handleCriado}
          toast={toast}
          getAliases={getAliases}
          user={user}
        />
      )}

      {workspace !== 'kanban' ? null : loading ? (
        <KanbanSkeleton />
      ) : (
        <div className="relative kanban-viewport min-h-0 flex-1">
          {canScrollL && (
            <>
              <div className="absolute left-0 top-0 bottom-4 w-16 z-10 pointer-events-none" style={{ background: 'linear-gradient(to right, rgb(var(--color-bg)), transparent)' }} />
              <button
                onClick={() => scrollRef.current?.scrollBy({ left: -360, behavior: 'smooth' })}
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
                onClick={() => scrollRef.current?.scrollBy({ left: 360, behavior: 'smooth' })}
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
              <div className="kanban-columns-row flex min-h-full items-stretch gap-4 min-w-max px-1 pb-2">
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









