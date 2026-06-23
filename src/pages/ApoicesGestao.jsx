import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from '@dnd-kit/core'
import {
  fetchApolicesKanban, criarApolice, moverStatusApolice,
  STATUS_EMISSAO_LABELS,
  calculatePremioTotal, calculateValorComissao, formatMoneyBR, toNumber,
} from '../lib/apolices'
import { useImobiliaria } from '../hooks/useImobiliaria'
import { Select } from '../components/ui/Select'
import { DatePicker } from '../components/ui/DatePicker'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { STATUS_LABELS } from '../lib/fichas'
import { fetchFichasAprovadasEmissao } from '../lib/fichas'
import { formatDecimalBRInput } from '../lib/numberInput'
import {
  Plus, ChevronLeft, ChevronRight, RefreshCw,
  Search, Home, Briefcase, Building, LayoutGrid, X, Check, ArrowLeft,
  GripVertical, ChevronsLeft, Pencil, Upload, Sparkles,
} from 'lucide-react'
import SeguradoraBadge from '../components/SeguradoraBadge'
import SeguradoraSelect from '../components/SeguradoraSelect'
import ImobiliariaSelect from '../components/ImobiliariaSelect'
import { Avatar } from '../components/ui'
import { supabase } from '../lib/supabase'
import { KanbanSkeleton } from '../components/Skeleton'
import { kanbanPointerCollision, KANBAN_DRAG_OVERLAY_MODIFIERS } from '../lib/kanbanDnd'
import { normalizeDisplayText } from '../lib/text'
import { parseApolice } from '../lib/apoliceParser'

// â”€â”€ Constantes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const COLUNAS = [
  { id: 'recebida',             label: 'Recebida',             color: '#3B82F6' },
  { id: 'proposta_transmitida', label: 'Proposta Transmitida', color: '#F59E0B' },
  { id: 'emitida',              label: 'ApÃ³lice Emitida',      color: '#8B5CF6' },
  { id: 'enviada',              label: 'ApÃ³lice Enviada',      color: '#10B981' },
]

const PRODUTO_ICON  = { residencial_pf: Home, comercial_pf: Briefcase, pessoa_juridica: Building }
const PRODUTO_COLOR = { residencial_pf: '#4A90D9', comercial_pf: '#10B981', pessoa_juridica: '#8B5CF6' }
const PRODUTO_ABBR  = { residencial_pf: 'Res. PF', comercial_pf: 'Com. PF', pessoa_juridica: 'PJ' }

function timeSince(dateStr) {
  const h = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60))
  if (h < 1) return '<1h'
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}
function timeBadgeCls(dateStr) {
  const h = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60))
  if (h < 4) return 'badge-success'
  if (h < 24) return 'badge-warning'
  return 'badge-danger'
}
function stringColor(str) {
  const c = ['#4A90D9','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#2B5BA8']
  let h = 0; for (let i = 0; i < (str||'').length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return c[Math.abs(h) % c.length]
}
function initials(n) {
  return (n||'').split(' ').map(x => x[0]).slice(0,2).join('').toUpperCase() || '?'
}

function getPeriodDates(filtro) {
  const now = new Date()
  if (filtro === 'hoje') {
    const s = new Date(now); s.setHours(0,0,0,0)
    return [s.toISOString(), now.toISOString()]
  }
  if (filtro === 'semana') {
    const s = new Date(now); s.setDate(s.getDate() - 7); s.setHours(0,0,0,0)
    return [s.toISOString(), now.toISOString()]
  }
  const s = new Date(now.getFullYear(), now.getMonth(), 1)
  return [s.toISOString(), now.toISOString()]
}

function calcularMeses(inicio, fim) {
  if (!inicio || !fim) return 0
  return Math.max(0, Math.round((new Date(fim) - new Date(inicio)) / (1000 * 60 * 60 * 24 * 30)))
}

function isLikelyPolicyNumber(value) {
  const text = String(value || '').trim()
  return text.length > 0 && /^[0-9./-]+$/.test(text)
}

function FieldShell({ label, required, children }) {
  return (
    <div className="group relative rounded-3xl border border-transparent px-2 py-1.5 transition-all hover:border-brand-accent/20 hover:bg-dark-surface2/20">
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-dark-muted">
        {label}{required && <span className="ml-0.5 text-status-danger">*</span>}
      </label>
      <div className="relative">
        {children}
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-dark-border/70 bg-white px-2 py-1 text-[10px] font-semibold text-dark-muted opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
          <span className="inline-flex items-center gap-1">
            <Pencil className="h-3 w-3" />
            Editar
          </span>
        </span>
      </div>
    </div>
  )
}

function EditField({ label, value, onChange, type = 'text', placeholder, required, inputMode }) {
  return (
    <FieldShell label={label} required={required}>
      {type === 'date' ? (
        <DatePicker value={value || ''} onChange={onChange} className="w-full" />
      ) : (
        <input
          type={type}
          inputMode={inputMode}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="input text-sm pr-20"
        />
      )}
    </FieldShell>
  )
}

function SelectField({ label, value, onChange, options, required }) {
  const normalized = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o))
  return (
    <FieldShell label={label} required={required}>
      <Select value={value || ''} onChange={onChange} options={normalized} placeholder="Selecione..." className="w-full" />
    </FieldShell>
  )
}

// â”€â”€ Helpers nomes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function nomeApolice(apolice) {
  return normalizeDisplayText(
    apolice.fichas?.nome_empresa
    || apolice.fichas?.nome_interessado
    || apolice.nome_interessado
  ) || 'â€”'
}

function produtoApolice(apolice) {
  return apolice.fichas?.produto || apolice.produto
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

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function resolveFichaEmissao(ficha) {
  const raw = ficha?.raw_data || {}
  return {
    nome: normalizeDisplayText(ficha?.nome_empresa || ficha?.nome_interessado || raw?.nome_empresa || raw?.nome_interessado) || 'â€”',
    numeroOrcamento: ficha?.numero_orcamento || raw?.numero_orcamento || ficha?.numero_apolice || raw?.numero_apolice || '',
    avatarUrl: ficha?.profiles?.avatar_url || raw?.avatar_url || '',
  }
}

function buildFormDataFromFicha(ficha, seguradoraNome = '') {
  const base = resolveFichaEmissao(ficha)
  const raw = ficha?.raw_data || {}

  return {
    numeroOrcamento: base.numeroOrcamento ? String(base.numeroOrcamento) : '',
    nome: base.nome,
    imobiliaria: ficha?.imobiliaria || raw?.imobiliaria || '',
  }
}

// â”€â”€ Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ApoliceCard({ apolice, isDragOverlay = false, resolverNome, onDetalhe, dragListeners, dragAttributes }) {
  const [expandido, setExpandido] = useState(false)

  const prod     = produtoApolice(apolice)
  const ProdIcon = PRODUTO_ICON[prod] || LayoutGrid
  const pColor   = PRODUTO_COLOR[prod] || '#6B7280'
  const emissor  = apolice.profiles?.nome
  const statusLabel = STATUS_EMISSAO_LABELS[apolice.status_emissao]?.label || apolice.status_emissao || 'Recebida'
  const documento = apolice.fichas?.cnpj || apolice.fichas?.cpf || 'â€”'
  const celular = apolice.fichas?.celular || 'â€”'
  const tipoImovel = apolice.fichas?.tipo_imovel || 'â€”'
  const vigencia = [apolice.inicio_vigencia, apolice.fim_vigencia].filter(Boolean).join(' atÃ© ') || 'â€”'
  const valorParcela = apolice.valor_parcela ? formatMoneyBR(apolice.valor_parcela) : 'â€”'
  const parcelamento = apolice.parcelamento ? `${apolice.parcelamento}x` : 'â€”'

  return (
    <div
      className={`kanban-card${isDragOverlay ? ' kanban-card-dragging' : ''}`}
      style={{ '--kanban-accent': pColor }}
    >
      {/* Grip handle */}
      {!isDragOverlay && (
        <button
          {...dragListeners}
          {...dragAttributes}
          className="kanban-grip"
          onClick={e => e.stopPropagation()}
          tabIndex={-1}
          aria-label="Arrastar"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      )}

      <div className="kanban-card-body" onClick={() => !isDragOverlay && onDetalhe?.(apolice.id)}>
        {/* Row 1: produto + tempo */}
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <span
            className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-[3px] rounded-full uppercase tracking-wide select-none"
            style={{ background: pColor + '20', color: pColor }}
          >
            <ProdIcon className="w-2.5 h-2.5" strokeWidth={2.5} />
            {PRODUTO_ABBR[prod] || 'AUTO'}
          </span>
          <span className={`badge text-[9px] font-mono select-none ${statusBadgeClass(apolice.status_emissao)}`}>
            {statusLabel}
          </span>
          <span className={`badge text-[9px] font-mono select-none ${timeBadgeCls(apolice.created_at)}`}>
            {timeSince(apolice.created_at)}
          </span>
        </div>

        {/* Nome */}
        <p className="text-[12.5px] font-semibold text-dark-text leading-snug truncate mb-0.5">
          {nomeApolice(apolice)}
        </p>

        {/* ImobiliÃ¡ria */}
        <p className="text-[10px] text-dark-muted truncate leading-none mb-1.5">
          {resolverNome ? resolverNome(apolice.imobiliaria) : (apolice.imobiliaria || 'â€”')}
        </p>

        {/* NÃºmero apÃ³lice */}
        {apolice.numero_apolice && (
          <p className="text-[10px] font-mono mb-1.5" style={{ color: '#2B5BA8' }}>
            {apolice.numero_apolice}
          </p>
        )}

        {/* Seguradora */}
        {apolice.seguradora && (
          <div className="mb-1.5">
            <SeguradoraBadge nome={apolice.seguradora} size="xs" />
          </div>
        )}

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <div className="rounded-xl border border-dark-border/60 bg-white/80 px-2 py-1.5">
            <p className="text-[8px] uppercase tracking-[0.14em] text-dark-muted">Documento</p>
            <p className="mt-0.5 text-[10px] font-mono text-dark-text truncate">{documento}</p>
          </div>
          <div className="rounded-xl border border-dark-border/60 bg-white/80 px-2 py-1.5">
            <p className="text-[8px] uppercase tracking-[0.14em] text-dark-muted">Celular</p>
            <p className="mt-0.5 text-[10px] text-dark-text truncate">{celular}</p>
          </div>
          <div className="rounded-xl border border-dark-border/60 bg-white/80 px-2 py-1.5">
            <p className="text-[8px] uppercase tracking-[0.14em] text-dark-muted">ImÃ³vel</p>
            <p className="mt-0.5 text-[10px] text-dark-text truncate">{tipoImovel}</p>
          </div>
          <div className="rounded-xl border border-dark-border/60 bg-white/80 px-2 py-1.5">
            <p className="text-[8px] uppercase tracking-[0.14em] text-dark-muted">Parcelas</p>
            <p className="mt-0.5 text-[10px] text-dark-text truncate">{parcelamento}</p>
          </div>
        </div>

        <div className="mt-1.5 rounded-xl border border-dark-border/60 bg-dark-surface2/25 px-2 py-1.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[8px] uppercase tracking-[0.14em] text-dark-muted">VigÃªncia</p>
              <p className="mt-0.5 text-[10px] text-dark-text truncate">{vigencia}</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] uppercase tracking-[0.14em] text-dark-muted">Parcela</p>
              <p className="mt-0.5 text-[10px] font-semibold text-brand-accent">{valorParcela}</p>
            </div>
          </div>
        </div>

        {/* Footer: emissor */}
        <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-dark-border/40 mt-auto">
          {emissor ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <Avatar name={emissor} src={apolice.profiles?.avatar_url || ''} size="sm" />
              <span className="text-[10px] text-dark-muted font-medium truncate max-w-[72px]">
                {emissor.split(' ')[0]}
              </span>
            </div>
          ) : (
            <span className="text-[9px] text-status-warning font-semibold tracking-wide uppercase">Livre</span>
          )}

          {/* BotÃ£o expandir */}
          {!isDragOverlay && (
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); setExpandido(v => !v) }}
              className="text-[9px] text-dark-muted hover:text-dark-text transition-colors px-1.5 py-0.5 rounded-md hover:bg-dark-surface2"
            >
              {expandido ? 'â–²' : 'â–¼ Detalhes'}
            </button>
          )}
        </div>

        {/* SeÃ§Ã£o expansÃ­vel */}
        {expandido && !isDragOverlay && (
          <div className="space-y-0.5 pt-1.5 mt-1.5 border-t border-dark-border/40 animate-fade-in">
            {(apolice.fichas?.cpf || apolice.fichas?.cnpj) && (
              <p className="text-[9px] text-dark-muted font-mono">
                {apolice.fichas.cnpj ? 'CNPJ' : 'CPF'}: {apolice.fichas.cnpj || apolice.fichas.cpf}
              </p>
            )}
            {apolice.fichas?.celular && (
              <p className="text-[9px] text-dark-muted">Tel: {apolice.fichas.celular}</p>
            )}
            {apolice.fichas?.tipo_imovel && (
              <p className="text-[9px] text-dark-muted">ImÃ³vel: {apolice.fichas.tipo_imovel}</p>
            )}
            {apolice.fichas?.cep && (
              <p className="text-[9px] text-dark-muted font-mono">CEP: {apolice.fichas.cep}</p>
            )}
            {apolice.valor_parcela && (
              <p className="text-[9px] text-dark-muted">
                Parcela: {formatMoneyBR(apolice.valor_parcela)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// â”€â”€ DraggableCard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function DraggableCard({ apolice, onDetalhe, resolverNome }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: apolice.id,
    data: { type: 'card' },
  })
  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.25 : 1, transition: isDragging ? 'none' : 'opacity 0.2s ease' }}
    >
      <ApoliceCard
        apolice={apolice}
        onDetalhe={onDetalhe}
        resolverNome={resolverNome}
        dragListeners={listeners}
        dragAttributes={attributes}
      />
    </div>
  )
}

// â”€â”€ Column â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function DroppableColumn({ col, apolices, onDetalhe, resolverNome, colIndex, collapsed, onToggleCollapse }) {
  const { isOver, setNodeRef: setDropRef } = useDroppable({ id: col.id })
  const { attributes: colAttrs, listeners: colListeners, setNodeRef: setDragRef, isDragging: isColDragging } = useDraggable({
    id: 'col::' + col.id,
    data: { type: 'column', colId: col.id },
  })
  const combinedRef = useCallback((node) => { setDragRef(node); setDropRef(node) }, [setDragRef, setDropRef])
  const anim = { animationDelay: `${colIndex * 30}ms`, animationFillMode: 'both', scrollSnapAlign: 'start' }

  if (collapsed) {
    return (
      <div
        ref={combinedRef}
        className="animate-fade-in flex flex-col flex-shrink-0"
        style={{ width: '52px', ...anim, opacity: isColDragging ? 0.25 : 1, transition: 'opacity 0.2s' }}
      >
        <button
          onClick={onToggleCollapse}
          title={`${col.label} (${apolices.length})`}
          className="flex flex-col items-center gap-1.5 py-3 px-1.5 rounded-t-xl border border-b-0 hover:opacity-80 transition-opacity"
          style={{ background: col.color + '14', borderColor: col.color + '45' }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: col.color, boxShadow: `0 0 5px ${col.color}80` }} />
          <span className="text-[10px] font-mono font-bold" style={{ color: col.color }}>{apolices.length}</span>
        </button>
        <div
          className="flex-1 rounded-b-xl border transition-colors"
          style={{
            minHeight: '60px',
            borderColor: isOver ? col.color + '70' : 'rgb(var(--color-border))',
            backgroundColor: isOver ? col.color + '14' : 'rgb(var(--color-surface2) / 0.3)',
          }}
        />
      </div>
    )
  }

  return (
    <div
      ref={combinedRef}
      className="kanban-col animate-fade-in flex flex-col"
      style={{ ...anim, opacity: isColDragging ? 0.25 : 1, transition: 'opacity 0.2s ease' }}
    >
      <div
        className="kanban-col-header"
        style={{ background: col.color + '12', borderColor: col.color + '40' }}
      >
        <button
          {...colListeners}
          {...colAttrs}
          className="kanban-col-drag-handle"
          onClick={e => e.stopPropagation()}
          tabIndex={-1}
          aria-label={`Arrastar coluna ${col.label}`}
        >
          <GripVertical className="w-3 h-3" />
        </button>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color, boxShadow: `0 0 6px ${col.color}90` }} />
          <span className="text-[11px] font-bold tracking-wide truncate" style={{ color: col.color }}>{col.label}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md" style={{ background: col.color + '22', color: col.color }}>
            {apolices.length}
          </span>
          <button onClick={onToggleCollapse} className="kanban-col-collapse" style={{ color: col.color }} title="Colapsar">
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div
        className="kanban-col-body flex-1 p-1.5 space-y-1.5 overflow-y-auto"
        style={{
          border:          isOver ? `1.5px dashed ${col.color}70` : '1px solid rgb(var(--color-border))',
          borderTop:       'none',
          borderRadius:    '0 0 12px 12px',
          backgroundColor: isOver ? col.color + '0a' : 'rgb(var(--color-surface2) / 0.35)',
          boxShadow:       isOver ? `inset 0 0 0 1px ${col.color}20, 0 0 20px ${col.color}10` : 'none',
          transition:      'border-color 0.12s ease, background 0.12s ease, box-shadow 0.12s ease',
        }}
      >
        {apolices.length === 0 ? (
          <div className="kanban-empty">
            <LayoutGrid className="w-5 h-5 kanban-empty-icon" />
            <span className="kanban-empty-text">Vazia</span>
          </div>
        ) : apolices.map(a => (
          <DraggableCard key={a.id} apolice={a} onDetalhe={onDetalhe} resolverNome={resolverNome} />
        ))}
      </div>
    </div>
  )
}

// â”€â”€ Modal Iniciar EmissÃ£o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ModalIniciarEmissao({ onClose, onCriado, toast }) {
  const { getAliases } = useImobiliaria()
  const { user } = useAuth()
  const [profiles,          setProfiles]          = useState([])
  const [imobFiltro,        setImobFiltro]        = useState('')
  const [busca,             setBusca]             = useState('')
  const [debouncedBusca,    setDebouncedBusca]    = useState('')
  const [fichasEncontradas, setFichasEncontradas] = useState([])
  const [fichaSelecionada,  setFichaSelecionada]  = useState(null)
  const [buscando,          setBuscando]          = useState(false)
  const [criando,           setCriando]           = useState(false)
  const [emitidoPor,        setEmitidoPor]        = useState(user?.id || '')

  // Campos adicionais preenchidos ao iniciar emissÃ£o
  const [numeroOrcamento, setNumeroOrcamento] = useState('')
  const [valorParcela,    setValorParcela]    = useState('')
  const [premioLiquido,   setPremioLiquido]   = useState('')
  const [pctComissao,     setPctComissao]     = useState('')
  const [pctDesconto,     setPctDesconto]     = useState('')
  const [parcelamento,    setParcelamento]    = useState('')
  const [seguradora,      setSeguradora]      = useState('')
  const [formaPagamento,  setFormaPagamento]  = useState('fatura_sem_entrada')
  const [pdfFile,         setPdfFile]         = useState(null)
  const [extraindo,       setExtraindo]       = useState(false)
  const [extracaoExtras,  setExtracaoExtras]  = useState(null)
  const [extracaoErro,    setExtracaoErro]    = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    supabase.from('profiles').select('id, nome, avatar_url').order('nome').then(({ data }) => setProfiles(data || []))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedBusca(busca.trim()), 400)
    return () => clearTimeout(t)
  }, [busca])

  useEffect(() => {
    let cancelled = false
    async function carregarFichas() {
      setBuscando(true)
      try {
        let aliasesFilter = null
        if (imobFiltro) {
          const aliases = await getAliases(imobFiltro)
          aliasesFilter = aliases.length ? aliases : [imobFiltro]
        }
        const data = await fetchFichasAprovadasEmissao({
          search: debouncedBusca,
          imobiliarias: aliasesFilter,
        })
        if (!cancelled) setFichasEncontradas(data)
      } catch (error) {
        if (!cancelled) {
          setFichasEncontradas([])
          toast({ type: 'error', title: 'Erro ao carregar fichas aprovadas', message: error?.message || 'Tente atualizar a pÃ¡gina.' })
        }
      } finally {
        if (!cancelled) setBuscando(false)
      }
    }
    carregarFichas()
    return () => { cancelled = true }
  }, [debouncedBusca, imobFiltro, getAliases])

  function selecionarFicha(f) {
    setFichaSelecionada(f)
    const auto = buildFormDataFromFicha(f, f.seguradora || '')
    setNumeroOrcamento(auto.numeroOrcamento)
    setEmitidoPor(user?.id || '')
  }

  function handleSeguradoraChange(value) {
    setSeguradora(value)
  }

  async function handlePreencherInfo() {
    if (!pdfFile || !seguradora) return
    setExtraindo(true)
    setExtracaoErro('')
    setExtracaoExtras(null)
    try {
      const { campos, extras, semParser } = await parseApolice(seguradora, pdfFile)
      if (semParser) {
        setExtracaoErro(`Seguradora "${seguradora}" ainda nÃ£o possui parser configurado.`)
        return
      }
      if (isLikelyPolicyNumber(campos.numero_proposta)) setNumeroOrcamento(campos.numero_proposta)
      else if (isLikelyPolicyNumber(campos.numero_apolice)) setNumeroOrcamento(campos.numero_apolice)
      if (campos.valor_parcela) setValorParcela(campos.valor_parcela)
      if (campos.parcelamento) setParcelamento(campos.parcelamento)
      if (campos.premio_liquido) setPremioLiquido(campos.premio_liquido)
      if (campos.forma_pagamento) setFormaPagamento(campos.forma_pagamento)
      if (campos.seguradora) setSeguradora(campos.seguradora)
      if (extras.cep || extras.tipo_imovel || extras.valor_aluguel != null) {
        setExtracaoExtras(extras)
      }
    } catch (err) {
      setExtracaoErro('Erro ao ler o PDF. Verifique se o arquivo Ã© vÃ¡lido.')
    } finally {
      setExtraindo(false)
    }
  }

  function limparFiltro() {
    setImobFiltro('')
    setBusca('')
    setDebouncedBusca('')
    setFichaSelecionada(null)
    setNumeroOrcamento('')
    setSeguradora('')
    setFormaPagamento('fatura_sem_entrada')
    setPdfFile(null)
    setExtracaoExtras(null)
    setExtracaoErro('')
    setEmitidoPor(user?.id || '')
  }

  async function criar() {
    if (!fichaSelecionada) return
    setCriando(true)
    const { error } = await criarApolice({
      ficha_id:         fichaSelecionada.id,
      imobiliaria:      fichaSelecionada.imobiliaria,
      status_emissao:   'recebida',
      nome_interessado: fichaSelecionada.nome_interessado || fichaSelecionada.nome_empresa || fichaSelecionada.raw_data?.nome_interessado || fichaSelecionada.raw_data?.nome_empresa || null,
      // Campos preenchidos no modal
      numero_proposta:  numeroOrcamento.trim() || null,
      emitido_por:      emitidoPor || user?.id || null,
      // Defaults obrigatÃ³rios no banco enquanto migraÃ§Ã£o 09 nÃ£o for rodada
      numero_apolice:   null,
      seguradora:       seguradora || 'Outras',
      data_emissao:     null,
      premio_total:     null,
      valor_producao:   null,
      valor_comissao:   null,
      forma_pagamento:  formaPagamento || null,
    })
    setCriando(false)
    if (error) { toast({ type: 'error', title: 'Erro ao criar', message: error.message }); return }
    toast({ type: 'success', title: 'EmissÃ£o iniciada!' })
    onCriado()
    onClose()
  }

  const fichaResumo = fichaSelecionada ? resolveFichaEmissao(fichaSelecionada) : null

  return (
    <div className="animate-fade-in">
      <div className="glass-panel rounded-2xl overflow-hidden">

        <div className="flex items-center gap-3 px-6 py-4 border-b border-dark-border">
          <button onClick={onClose} className="p-1.5 rounded-xl text-dark-muted hover:text-dark-text hover:bg-dark-surface2 transition-all flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="font-bold text-dark-text">Iniciar EmissÃ£o</h2>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="rounded-2xl border border-brand-accent/15 bg-brand-secondary/5 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Busca de fichas aprovadas</p>
                <p className="text-sm text-dark-text">Aqui aparecem fichas, nÃ£o apÃ³lices, de todos os produtos.</p>
              </div>
              <div className="text-xs text-dark-muted">
                {buscando ? 'Carregando...' : `${fichasEncontradas.length} ficha${fichasEncontradas.length !== 1 ? 's' : ''}`}
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <FieldShell label="ImobiliÃ¡ria">
              <ImobiliariaSelect value={imobFiltro} onChange={setImobFiltro} className="w-full" />
            </FieldShell>

            <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
              <div className={`flex items-center gap-2 bg-dark-surface2 border rounded-2xl px-3 py-2.5 transition-colors ${
                busca && busca !== debouncedBusca ? 'border-brand-accent/50' : 'border-dark-border'
              }`}>
                {busca && busca !== debouncedBusca ? (
                  <svg className="w-4 h-4 animate-spin text-brand-accent flex-shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : (
                  <Search className="w-4 h-4 text-dark-muted flex-shrink-0" />
                )}
                <input
                  type="text"
                  placeholder="Nome, CPF, CNPJ, imobiliÃ¡ria ou seguradora..."
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  className="text-sm flex-1 outline-none bg-transparent text-dark-text placeholder-dark-muted"
                />
                {busca && (
                  <button
                    onClick={limparFiltro}
                    className="text-dark-muted hover:text-dark-text transition-colors flex-shrink-0 text-xs"
                  >
                    Ã—
                  </button>
                )}
              </div>
              {debouncedBusca && (
                <span className="text-[10px] text-brand-accent/70 pl-1">
                  Buscando em fichas aprovadas Â· {fichasEncontradas.length} resultado{fichasEncontradas.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-dark-border/70 bg-dark-surface2/20 overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-dark-border/70">
              <div>
                <p className="text-sm font-semibold text-dark-text">Fichas aprovadas</p>
                <p className="text-xs text-dark-muted">Selecione uma ficha para preencher o nÃºmero do orÃ§amento.</p>
              </div>
              <span className="text-xs text-dark-muted">
                {buscando ? 'Carregando...' : `${fichasEncontradas.length} ficha${fichasEncontradas.length !== 1 ? 's' : ''}`}
              </span>
            </div>

            <div className="max-h-72 overflow-y-auto p-3">
              {buscando ? (
                <p className="text-xs text-dark-muted text-center py-8">Buscando fichas aprovadas...</p>
              ) : fichasEncontradas.length === 0 ? (
                <div className="rounded-xl border border-dashed border-dark-border/80 bg-white/60 px-4 py-8 text-center">
                  <p className="text-sm font-medium text-dark-text">Nenhuma ficha aprovada encontrada</p>
                  <p className="mt-1 text-xs text-dark-muted">Tente outra imobiliÃ¡ria ou altere o termo de busca.</p>
                </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {fichasEncontradas.map(f => {
                      const resumo = resolveFichaEmissao(f)
                      const selecionada = fichaSelecionada?.id === f.id
                      return (
                        <button
                          key={f.id}
                          onClick={() => selecionarFicha(f)}
                          className={`rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
                            selecionada
                              ? 'border-brand-accent bg-brand-secondary/10 shadow-sm'
                              : 'border-dark-border bg-white hover:border-brand-accent/40'
                          }`}
                          >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <Avatar
                                name={resumo.nome}
                                src={resumo.avatarUrl || ''}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-dark-text">
                                  {resumo.nome}
                                </p>
                              </div>
                            </div>
                            <span className="badge text-[9px] bg-status-success/15 text-status-success">
                              Aprovada
                            </span>
                          </div>
                          <div className="mt-3 space-y-1">`r`n                            <p className="text-xs font-medium text-dark-text truncate">{f.imobiliaria || '—'}</p>`r`n                            <p className="text-[10px] text-dark-muted">`r`n                              {resumo.numeroOrcamento ? `N° do orçamento: ${resumo.numeroOrcamento}` : 'Sem número de orçamento'}`r`n                            </p>`r`n                          </div>`r`n                        </button>
                      )
                    })}
                  </div>
                )}
            </div>
          </div>          {fichaSelecionada ? (
            <div className="rounded-xl bg-status-success/10 border border-status-success/25 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-status-success/20">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-status-success/80">Dados da ficha</p>
                  <p className="text-sm font-semibold text-dark-text truncate">
                    {fichaResumo?.nome || '—'}
                  </p>
                </div>
                <button
                  onClick={() => { setFichaSelecionada(null); setNumeroOrcamento(''); setSeguradora(''); setFormaPagamento('fatura_sem_entrada'); setEmitidoPor(user?.id || '') }}
                  className="flex-shrink-0 ml-2 text-dark-muted hover:text-dark-text"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-3 py-2.5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-dark-border/60 bg-white/80 px-3 py-2">
                  <span className="text-dark-muted">Nome</span>
                  <p className="mt-1 text-dark-text font-medium truncate">{fichaResumo?.nome || '—'}</p>
                </div>
                <div className="rounded-xl border border-dark-border/60 bg-white/80 px-3 py-2">
                  <span className="text-dark-muted">Imobiliária</span>
                  <p className="mt-1 text-dark-text font-medium truncate">{fichaSelecionada.imobiliaria || '—'}</p>
                </div>
                <div className="rounded-xl border border-dark-border/60 bg-white/80 px-3 py-2 sm:col-span-2">
                  <span className="text-dark-muted">N° do orçamento</span>
                  <p className="mt-1 text-dark-text font-semibold truncate">{numeroOrcamento || '—'}</p>
                </div>
              </div>
            </div>
          ) : null}

          {fichaSelecionada ? (
          <div className="rounded-2xl border border-brand-secondary/20 bg-brand-secondary/5 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-secondary">Resumo automático</p>
                <p className="text-xs text-dark-muted">Somente nome, imobiliária e número do orçamento selecionado.</p>
              </div>
            </div>
          </div>
          ) : null}

          <div className="space-y-3">
            <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider">Dados da EmissÃ£o</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <EditField
                label="NÂ° do OrÃ§amento"
                value={numeroOrcamento}
                onChange={setNumeroOrcamento}
                placeholder="Ex: 12345"
              />
              <div className="sm:col-span-2">
                <SelectField
                  label="Emissor"
                  value={emitidoPor}
                  onChange={setEmitidoPor}
                  options={profiles.map(p => ({ value: p.id, label: p.nome }))}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <FieldShell label="Seguradora aprovada" required>
                  <SeguradoraSelect
                    value={seguradora}
                    onChange={handleSeguradoraChange}
                    produto={fichaSelecionada?.produto}
                    required
                  />
                </FieldShell>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-dark-border">
          <button onClick={onClose} className="btn-secondary text-sm">Cancelar</button>
          <button onClick={criar} disabled={!fichaSelecionada || criando || !numeroOrcamento.trim() || !seguradora} className="btn-primary text-sm">
            {criando ? 'Criando...' : 'Criar SolicitaÃ§Ã£o'}
          </button>
        </div>
      </div>
    </div>
  )
}

// â”€â”€ Modal Finalizar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ModalFinalizar({ apoliceId, apolice, onClose, onFinalizado, toast }) {
  const [proprietarioNome,  setProprietarioNome]  = useState('')
  const [proprietarioCel,   setProprietarioCel]   = useState('')
  const [numeroApolice,     setNumeroApolice]      = useState(apolice?.numero_apolice || '')
  const [numeroProposta,    setNumeroProposta]     = useState(apolice?.numero_proposta || '')
  const [endereco,          setEndereco]           = useState(apolice?.endereco || '')
  const [inicioVigencia,    setInicioVigencia]     = useState(apolice?.inicio_vigencia || '')
  const [fimVigencia,       setFimVigencia]        = useState(apolice?.fim_vigencia || '')
  const [valorParcela,      setValorParcela]       = useState(apolice?.valor_parcela || '')
  const [parcelamento,      setParcelamento]       = useState(apolice?.parcelamento || '')
  const [premioLiquido,     setPremioLiquido]      = useState(apolice?.premio_liquido || '')
  const [pctComissao,       setPctComissao]        = useState(apolice?.pct_comissao || '')
  const [pctDesconto,       setPctDesconto]        = useState(apolice?.pct_desconto || '')
  const [formaPagamento,    setFormaPagamento]     = useState(apolice?.forma_pagamento || '')
  const [seguradora,        setSeguradora]         = useState(apolice?.seguradora || '')
  const [salvando,          setSalvando]           = useState(false)
  const [pdfFile,           setPdfFile]            = useState(null)
  const [extraindo,         setExtraindo]          = useState(false)
  const [extracaoExtras,    setExtracaoExtras]     = useState(null)
  const [extracaoErro,      setExtracaoErro]       = useState('')
  const fileInputRef = useRef(null)

  const meses = calcularMeses(inicioVigencia, fimVigencia)
  const qtdParcelas = toNumber(parcelamento) || 0
  const valorParcelaNum = toNumber(valorParcela) || 0
  const premioLiquidoNum = toNumber(premioLiquido) || 0
  const premioTotal = calculatePremioTotal(valorParcelaNum, qtdParcelas)
  const valorComissao = calculateValorComissao(premioLiquidoNum, pctComissao)

  const obrigatoriosOK = proprietarioNome.trim() && numeroApolice.trim()
    && inicioVigencia && fimVigencia && parcelamento && valorParcela && formaPagamento && seguradora
    && premioLiquido !== '' && pctComissao !== '' && pctDesconto !== ''

  async function confirmar() {
    if (!obrigatoriosOK) return
    setSalvando(true)
    const numeroApoliceFinal = numeroApolice.trim() || apolice?.numero_apolice || null
    const err = await moverStatusApolice(apoliceId, 'emitida', {
      proprietario_nome:    proprietarioNome.trim(),
      proprietario_cel:     proprietarioCel.trim() || null,
      numero_apolice:       numeroApoliceFinal,
      numero_proposta:      numeroProposta.trim() || null,
      endereco:             endereco.trim() || null,
      inicio_vigencia:      inicioVigencia,
      fim_vigencia:         fimVigencia,
      tempo_vigencia_meses: meses,
      parcelamento:         qtdParcelas || null,
      valor_parcela:        valorParcelaNum || null,
      forma_pagamento:      formaPagamento,
      seguradora,
      premio_liquido:      premioLiquidoNum || null,
      pct_comissao:        pctComissao === '' ? null : toNumber(pctComissao),
      pct_desconto:        pctDesconto === '' ? null : toNumber(pctDesconto),
      premio_total:        premioTotal,
      valor_producao:      premioTotal,
      valor_comissao:      valorComissao,
      data_emissao:        new Date().toISOString().slice(0, 10),
    })
    setSalvando(false)
    if (err) { toast({ type: 'error', title: 'Erro ao emitir' }); return }
    toast({ type: 'success', title: 'ApÃ³lice emitida!' })
    onFinalizado()
    onClose()
  }

  async function handlePreencherInfo() {
    if (!pdfFile || !seguradora) return
    setExtraindo(true)
    setExtracaoErro('')
    setExtracaoExtras(null)
    try {
      const { campos, extras, semParser } = await parseApolice(seguradora, pdfFile)
      if (semParser) {
        setExtracaoErro(`Seguradora "${seguradora}" ainda nÃ£o possui parser configurado.`)
        return
      }
      if (campos.nome_proprietario) setProprietarioNome(campos.nome_proprietario)
      if (campos.proprietario_cel) setProprietarioCel(campos.proprietario_cel)
      if (campos.numero_apolice)   setNumeroApolice(campos.numero_apolice)
      if (isLikelyPolicyNumber(campos.numero_proposta)) setNumeroProposta(campos.numero_proposta)
      if (campos.endereco)         setEndereco(campos.endereco)
      if (campos.inicio_vigencia)  setInicioVigencia(campos.inicio_vigencia)
      if (campos.fim_vigencia)     setFimVigencia(campos.fim_vigencia)
      if (campos.parcelamento)     setParcelamento(campos.parcelamento)
      if (campos.valor_parcela)    setValorParcela(campos.valor_parcela)
      if (campos.premio_liquido)   setPremioLiquido(campos.premio_liquido)
      if (campos.forma_pagamento)  setFormaPagamento(campos.forma_pagamento)
      if (extras.cep || extras.tipo_imovel || extras.valor_aluguel != null) {
        setExtracaoExtras(extras)
      }
    } catch (err) {
      setExtracaoErro('Erro ao ler o PDF. Verifique se o arquivo Ã© vÃ¡lido.')
    } finally {
      setExtraindo(false)
    }
  }

  const LabelReq = ({ children }) => (
    <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1">
      {children} <span className="text-status-danger">*</span>
    </label>
  )
  const LabelOpt = ({ children }) => (
    <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1">{children}</label>
  )

  return (
    <div className="animate-fade-in">
      <div className="glass-panel rounded-2xl overflow-hidden">

        <div className="flex items-center gap-3 px-6 py-4 border-b border-dark-border">
          <button onClick={onClose} className="p-1.5 rounded-xl text-dark-muted hover:text-dark-text hover:bg-dark-surface2 transition-all flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="font-bold text-dark-text">Emitir ApÃ³lice</h2>
        </div>

        <div className="px-6 py-5 space-y-4">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <EditField label="Nome do ProprietÃ¡rio" value={proprietarioNome} onChange={setProprietarioNome} placeholder="JoÃ£o da Silva" required />
            <EditField label="Celular do ProprietÃ¡rio" value={proprietarioCel} onChange={setProprietarioCel} placeholder="(11) 99999-9999" />
            <EditField label="NÃºmero da ApÃ³lice" value={numeroApolice} onChange={setNumeroApolice} placeholder="000000000" required />
            <EditField label="NÃºmero da Proposta" value={numeroProposta} onChange={setNumeroProposta} placeholder="Opcional" />
            <div className="sm:col-span-2">
              <EditField label="EndereÃ§o do ImÃ³vel" value={endereco} onChange={setEndereco} placeholder="Rua, nÃºmero, bairro, cidade" />
            </div>
            <EditField label="InÃ­cio da VigÃªncia" type="date" value={inicioVigencia} onChange={setInicioVigencia} required />
            <EditField label="Fim da VigÃªncia" type="date" value={fimVigencia} onChange={setFimVigencia} required />
            <div>
              <LabelOpt>Tempo de VigÃªncia</LabelOpt>
              <div className="input text-sm text-dark-muted bg-dark-surface2/50">{meses > 0 ? `${meses} meses` : 'â€”'}</div>
            </div>
            <EditField label="Parcelamento (vezes)" type="number" value={parcelamento} onChange={setParcelamento} placeholder="Ex: 12" required />
              <EditField label="Valor da Parcela (R$)" type="text" inputMode="decimal" value={valorParcela} onChange={setValorParcela} placeholder="0,00" required />
              <EditField label="PrÃªmio LÃ­quido (R$)" type="text" inputMode="decimal" value={premioLiquido} onChange={setPremioLiquido} placeholder="0,00" required />
            <EditField label="% ComissÃ£o" type="text" inputMode="decimal" value={pctComissao} onChange={setPctComissao} placeholder="Ex: 10,00" required />
            <EditField label="% Desconto" type="text" inputMode="decimal" value={pctDesconto} onChange={setPctDesconto} placeholder="Ex: 5,00" required />
            <div className="rounded-2xl border border-dark-border/70 bg-dark-surface2/30 px-4 py-3 text-sm text-dark-text">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-muted">PrÃªmio total</p>
              <p className="mt-1 font-semibold">{premioTotal != null ? formatMoneyBR(premioTotal) : 'â€”'}</p>
            </div>
            <div className="rounded-2xl border border-dark-border/70 bg-dark-surface2/30 px-4 py-3 text-sm text-dark-text">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-muted">ComissÃ£o calculada</p>
              <p className="mt-1 font-semibold">{valorComissao != null ? formatMoneyBR(valorComissao) : 'â€”'}</p>
            </div>
            <SelectField
              label="Forma de Pagamento"
              value={formaPagamento}
              onChange={setFormaPagamento}
              options={[
                { value: '', label: 'Selecione...' },
                { value: 'fatura_sem_entrada', label: 'Fatura sem entrada' },
                { value: 'fatura_com_entrada', label: 'Fatura com entrada' },
                { value: 'cartao_credito', label: 'CartÃ£o de crÃ©dito' },
              ]}
              required
            />
            <FieldShell label="Seguradora" required>
              <SeguradoraSelect value={seguradora} onChange={setSeguradora} produto={apolice?.produto || apolice?.fichas?.produto} required />
            </FieldShell>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-dark-border">
          <button onClick={onClose} className="btn-secondary text-sm">Cancelar</button>
          <button onClick={confirmar} disabled={!obrigatoriosOK || salvando} className="btn-primary text-sm">
            {salvando ? 'Salvando...' : 'Confirmar EmissÃ£o'}
          </button>
        </div>
      </div>
    </div>
  )
}

// â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function ApoicesGestao() {
  const navigate                             = useNavigate()
  const toast                                = useToast()
  const { resolverNome, getAliases } = useImobiliaria()

  const [apolices,       setApolices]       = useState([])
  const [loading,        setLoading]        = useState(true)
  const [filtro,         setFiltro]         = useState('semana')
  const [imobFiltro,     setImobFiltro]     = useState('')
  const [activeId,       setActiveId]       = useState(null)
  const [modalIniciar,   setModalIniciar]   = useState(false)
  const [modalFinalizar, setModalFinalizar] = useState(null) // { id, apolice }
  const [pendingMove,    setPendingMove]    = useState(null) // { id, fromStatus }
  const [collapsed,      setCollapsed]      = useState(new Set())
  const [colOrder,       setColOrder]       = useState(() => {
    try {
      const s = localStorage.getItem('kanban-apolices-col-order')
      if (s) { const p = JSON.parse(s); if (COLUNAS.every(c => p.includes(c.id)) && p.length === COLUNAS.length) return p }
    } catch {}
    return COLUNAS.map(c => c.id)
  })

  const scrollRef    = useRef(null)
  const [canScrollL, setCanScrollL] = useState(false)
  const [canScrollR, setCanScrollR] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const getAliasesRef = useRef(getAliases)
  getAliasesRef.current = getAliases

  const load = useCallback(async () => {
    setLoading(true)
    const [dateFrom, dateTo] = getPeriodDates(filtro)
    let imobiliariasFilter
    if (imobFiltro) {
      imobiliariasFilter = await getAliasesRef.current(imobFiltro)
      if (!imobiliariasFilter.length) imobiliariasFilter = [imobFiltro]
    }
    const data = await fetchApolicesKanban({ dateFrom, dateTo, imobiliarias: imobiliariasFilter })
    setApolices(data)
    setLoading(false)
  }, [filtro, imobFiltro])

  useEffect(() => { load() }, [load])

  function checkScroll() {
    const el = scrollRef.current; if (!el) return
    setCanScrollL(el.scrollLeft > 5)
    setCanScrollR(el.scrollLeft < el.scrollWidth - el.clientWidth - 5)
  }
  useEffect(() => {
    const el = scrollRef.current; if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll, { passive: true })
    const ro = new ResizeObserver(checkScroll); ro.observe(el)
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect() }
  }, [loading])

  const groups = Object.fromEntries(COLUNAS.map(c => [c.id, []]))
  apolices.forEach(a => { if (groups[a.status_emissao] !== undefined) groups[a.status_emissao].push(a) })

  async function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over) return

    // â”€â”€ Column reorder â”€â”€
    if (active.data.current?.type === 'column') {
      const fromColId = active.data.current.colId
      const toColId   = over.id
      if (fromColId !== toColId && COLUNAS.some(c => c.id === toColId)) {
        setCollapsed(prev => prev) // keep state, just reorder display
        // Persist reorder
        setApolices(prev => [...prev]) // trigger re-render with new colOrder
        setColOrder(prev => {
          const fi = prev.indexOf(fromColId), ti = prev.indexOf(toColId)
          if (fi === -1 || ti === -1) return prev
          const next = [...prev]; next.splice(fi, 1); next.splice(ti, 0, fromColId)
          try { localStorage.setItem('kanban-apolices-col-order', JSON.stringify(next)) } catch {}
          return next
        })
      }
      return
    }

    // â”€â”€ Card move â”€â”€
    const id         = active.id
    const novoStatus = over.id
    const apolice    = apolices.find(a => a.id === id)
    if (!apolice || apolice.status_emissao === novoStatus) return
    if (!COLUNAS.some(c => c.id === novoStatus)) return

    if (novoStatus === 'emitida') {
      setPendingMove({ id, fromStatus: apolice.status_emissao })
      setModalFinalizar({ id, apolice })
      return
    }

    setApolices(prev => prev.map(a =>
      a.id === id ? { ...a, status_emissao: novoStatus } : a
    ))
    const err = await moverStatusApolice(id, novoStatus)
    if (err) { toast({ type: 'error', title: 'Erro ao mover apÃ³lice' }); load() }
  }

  function handleFinalizarSuccess() {
    setPendingMove(null)
    setModalFinalizar(null)
    load()
  }

  function handleFinalizarClose() {
    // Rollback: nÃ£o mover
    setPendingMove(null)
    setModalFinalizar(null)
  }

  function toggleCollapse(colId) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(colId)) next.delete(colId)
      else next.add(colId)
      return next
    })
  }

  const activeCard = (!activeId || activeId.startsWith('col::')) ? null : apolices.find(a => a.id === activeId)

  if (modalIniciar) return (
    <ModalIniciarEmissao onClose={() => setModalIniciar(false)} onCriado={load} toast={toast} />
  )
  if (modalFinalizar) return (
    <ModalFinalizar
      apoliceId={modalFinalizar.id}
      apolice={modalFinalizar.apolice}
      onClose={handleFinalizarClose}
      onFinalizado={handleFinalizarSuccess}
      toast={toast}
    />
  )

  return (
    <div className="space-y-4 animate-fade-in">

      {/* â”€â”€ Header â”€â”€ */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="title-page text-dark-text">GestÃ£o de ApÃ³lices</h1>
          <p className="text-xs text-dark-muted mt-0.5">Arraste as apÃ³lices entre as colunas para atualizar o status</p>
        </div>
      </div>

      {/* â”€â”€ Filtros â”€â”€ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-dark-surface2 border border-dark-border rounded-lg p-0.5">
          {['hoje','semana','mes'].map(f => (
            <button key={f} onClick={() => setFiltro(f)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      filtro === f ? 'bg-brand-secondary text-white shadow-sm' : 'text-dark-muted hover:text-dark-text'
                    }`}>
              {f === 'hoje' ? 'Hoje' : f === 'semana' ? 'Semana' : 'MÃªs'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <ImobiliariaSelect value={imobFiltro} onChange={setImobFiltro} className="text-sm" />
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dark-border text-xs text-dark-muted hover:text-dark-text transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
          <button onClick={() => setModalIniciar(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Iniciar EmissÃ£o
          </button>
        </div>
      </div>

      {/* â”€â”€ Kanban â”€â”€ */}
      {loading ? (
        <KanbanSkeleton />
      ) : (
        <div className="relative">
          {canScrollL && (
            <>
              <div className="absolute left-0 top-0 bottom-4 w-16 z-10 pointer-events-none"
                   style={{ background: 'linear-gradient(to right, rgb(var(--color-bg)), transparent)' }} />
              <button onClick={() => scrollRef.current?.scrollBy({ left: -280, behavior: 'smooth' })}
                      className="absolute left-0.5 top-[60px] z-20 w-7 h-7 rounded-full bg-dark-surface border border-dark-border shadow-md flex items-center justify-center text-dark-muted hover:text-dark-text transition-all">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          )}
          {canScrollR && (
            <>
              <div className="absolute right-0 top-0 bottom-4 w-16 z-10 pointer-events-none"
                   style={{ background: 'linear-gradient(to left, rgb(var(--color-bg)), transparent)' }} />
              <button onClick={() => scrollRef.current?.scrollBy({ left: 280, behavior: 'smooth' })}
                      className="absolute right-0.5 top-[60px] z-20 w-7 h-7 rounded-full bg-dark-surface border border-dark-border shadow-md flex items-center justify-center text-dark-muted hover:text-dark-text transition-all">
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          <div ref={scrollRef} className="kanban-scroll overflow-x-auto pb-4">
    <DndContext
      sensors={sensors}
      collisionDetection={kanbanPointerCollision}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
            >
              <div className="flex gap-3 min-w-max px-1">
                {colOrder.map((colId, i) => {
                  const col = COLUNAS.find(c => c.id === colId)
                  if (!col) return null
                  return (
                    <DroppableColumn
                      key={col.id}
                      col={col}
                      apolices={groups[col.id] || []}
                      onDetalhe={id => navigate(`/apolices/${id}`)}
                      resolverNome={resolverNome}
                      colIndex={i}
                      collapsed={collapsed.has(col.id)}
                      onToggleCollapse={() => toggleCollapse(col.id)}
                    />
                  )
                })}
              </div>
              <DragOverlay dropAnimation={null} modifiers={KANBAN_DRAG_OVERLAY_MODIFIERS}>
                {activeId?.startsWith?.('col::') ? (() => {
                  const cid = activeId.replace('col::', '')
                  const col = COLUNAS.find(c => c.id === cid)
                  if (!col) return null
                  return (
                    <div className="kanban-col flex flex-col" style={{ transform: 'rotate(2deg)', opacity: 0.9, filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.4))' }}>
                      <div className="kanban-col-header" style={{ background: col.color + '20', borderColor: col.color + '60' }}>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                          <span className="text-[11px] font-bold" style={{ color: col.color }}>{col.label}</span>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md" style={{ background: col.color + '30', color: col.color }}>
                          {groups[cid]?.length ?? 0}
                        </span>
                      </div>
                      <div className="p-1.5 rounded-b-xl border border-t-0 min-h-[60px]" style={{ background: col.color + '06', borderColor: col.color + '30' }}>
                        {(groups[cid] || []).slice(0, 3).map(a => (
                          <div key={a.id} className="text-[10px] text-dark-muted truncate py-1 px-2 rounded-lg mb-1" style={{ background: 'rgb(var(--color-surface2) / 0.6)' }}>
                            {normalizeDisplayText(a.fichas?.nome_interessado || a.nome_interessado) || 'â€”'}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })() : activeCard ? (
                  <div style={{ width: 'var(--kanban-col-w, 286px)', pointerEvents: 'none', '--kanban-accent': PRODUTO_COLOR[produtoApolice(activeCard)] || '#4A90D9' }}>
                    <ApoliceCard apolice={activeCard} isDragOverlay resolverNome={resolverNome} />
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

