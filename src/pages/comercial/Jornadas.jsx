import { useState, useCallback, useRef, useMemo, useEffect, createContext, useContext } from 'react'
import ReactFlow, {
  Background, BackgroundVariant, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  Handle, Position, ReactFlowProvider,
  getBezierPath, BaseEdge, EdgeLabelRenderer,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useComercial, journeyAdd, journeyUpdate, journeyDelete, scriptAdd, PIPELINE_COLS } from '../../lib/comercial'
import { useToast } from '../../contexts/ToastContext'
import {
  Plus, ArrowLeft, FileText, Tag, Users, Map, Layers,
  Pencil, Copy, Play, Pause, X, Zap, GitBranch, Clock,
  Mail, ArrowRight, UserCheck, CheckSquare, Save, Trash2,
  UserPlus, RefreshCw, ChevronDown, ChevronRight,
  CheckCircle, FileCheck, Hand, MessageCircle, ClipboardList, Flag,
  Circle,
} from 'lucide-react'
import { Select } from '../../components/ui/Select'
import {
  CrmEmptyState,
  CrmMetricCard,
  CrmPageHeader,
  CrmSectionCard,
  CrmSegmentedControl,
} from '../../components/comercial'

// ── CSS keyframes injetado localmente (sem tocar index.css) ──────────────────

const EDITOR_STYLES = `
  @keyframes jrn-slide-right {
    from { transform: translateX(20px); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }
  @keyframes jrn-slide-left {
    from { transform: translateX(-20px); opacity: 0; }
    to   { transform: translateX(0);     opacity: 1; }
  }
  @keyframes jrn-fade-up {
    from { transform: translateY(8px); opacity: 0; }
    to   { transform: translateY(0);   opacity: 1; }
  }
  .jrn-lib-item {
    transition: transform 0.15s cubic-bezier(0.25,0.46,0.45,0.94),
                box-shadow 0.15s ease,
                border-color 0.15s ease;
  }
  .jrn-lib-item:hover {
    transform: translateX(4px);
    box-shadow: 0 3px 10px rgba(6,10,32,0.09) !important;
  }
  .jrn-lib-item:active {
    transform: translateX(2px) scale(0.985);
    cursor: grabbing !important;
  }
  .react-flow__controls {
    border-radius: 14px !important;
    overflow: hidden !important;
    border: 1px solid rgba(210,225,232,0.92) !important;
    box-shadow: 0 2px 14px rgba(6,10,32,0.09) !important;
    backdrop-filter: blur(8px) !important;
  }
  .react-flow__controls-button {
    background: rgba(255,255,255,0.96) !important;
    border: none !important;
    border-bottom: 1px solid rgba(210,225,232,0.65) !important;
    color: rgba(8,15,44,0.75) !important;
    transition: background 0.12s ease !important;
    padding: 7px !important;
  }
  .react-flow__controls-button:last-child { border-bottom: none !important; }
  .react-flow__controls-button:hover { background: rgba(239,246,250,1) !important; color: rgba(0,0,121,1) !important; }
  .react-flow__controls-button svg { fill: currentColor !important; }
  .react-flow__minimap {
    border-radius: 14px !important;
    overflow: hidden !important;
    border: 1px solid rgba(210,225,232,0.92) !important;
    box-shadow: 0 2px 14px rgba(6,10,32,0.09) !important;
  }
  .react-flow__edge-path {
    transition: stroke 0.18s ease, stroke-width 0.15s ease;
  }
  .react-flow__handle {
    transition: box-shadow 0.15s ease, transform 0.12s ease;
  }
  .react-flow__handle:hover {
    transform: scale(1.25) !important;
  }
  .react-flow__attribution { display: none !important; }
  .jrn-node-selected .react-flow__handle {
    box-shadow: 0 0 0 3px rgba(43,91,168,0.22) !important;
  }
`

// ── Helpers ───────────────────────────────────────────────────────────────────

const getWorkflowData = j => {
  if (!j.etapas || Array.isArray(j.etapas)) return { status: 'rascunho', nodes: [], edges: [] }
  return j.etapas
}
const getStatus = j => getWorkflowData(j).status || 'rascunho'

const STATUS_CONFIG = {
  ativa:     { label: 'Ativa',     bg: 'bg-status-success/15', text: 'text-status-success', dot: 'bg-status-success' },
  pausada:   { label: 'Pausada',   bg: 'bg-amber-500/15',      text: 'text-amber-500',      dot: 'bg-amber-500' },
  rascunho:  { label: 'Rascunho',  bg: 'bg-dark-surface2',     text: 'text-dark-muted',     dot: 'bg-dark-muted' },
  arquivada: { label: 'Arquivada', bg: 'bg-dark-surface2',     text: 'text-dark-muted',     dot: 'bg-dark-muted' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.rascunho
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ── Node definitions ──────────────────────────────────────────────────────────

const NODE_GROUPS = [
  {
    label: 'Gatilhos', category: 'trigger', color: '#1A3A6B',
    items: [
      { tipo: 'trigger_ficha',     label: 'Ficha Aprovada',    Icon: CheckCircle },
      { tipo: 'trigger_lead',      label: 'Lead Criado',       Icon: UserPlus },
      { tipo: 'trigger_movido',    label: 'Lead Movido',       Icon: ArrowRight },
      { tipo: 'trigger_renovacao', label: 'Renovação Próxima', Icon: RefreshCw },
      { tipo: 'trigger_apolice',   label: 'Apólice Emitida',   Icon: FileCheck },
      { tipo: 'trigger_manual',    label: 'Manual',            Icon: Hand },
    ],
  },
  {
    label: 'Ações', category: 'action', color: '#2B5BA8',
    items: [
      { tipo: 'action_tarefa',    label: 'Criar Tarefa',         Icon: CheckSquare },
      { tipo: 'action_whatsapp',  label: 'Enviar WhatsApp',      Icon: MessageCircle },
      { tipo: 'action_email',     label: 'Enviar Email',         Icon: Mail },
      { tipo: 'action_mover',     label: 'Mover no Pipeline',    Icon: Layers },
      { tipo: 'action_atribuir',  label: 'Atribuir Responsável', Icon: UserCheck },
      { tipo: 'action_etiqueta',  label: 'Adicionar Etiqueta',   Icon: Tag },
      { tipo: 'action_atividade', label: 'Registrar Atividade',  Icon: ClipboardList },
    ],
  },
  {
    label: 'Controle', category: 'control', color: '#64748B',
    items: [
      { tipo: 'control_aguardar', label: 'Aguardar',       Icon: Clock },
      { tipo: 'control_condicao', label: 'Condição',       Icon: GitBranch },
      { tipo: 'control_fim',      label: 'Fim da Jornada', Icon: Flag },
    ],
  },
]

const ALL_ITEMS = NODE_GROUPS.flatMap(g => g.items.map(i => ({ ...i, category: g.category, color: g.color })))
const findNodeInfo = tipo => ALL_ITEMS.find(i => i.tipo === tipo) || { tipo, label: tipo, Icon: Zap, category: 'action', color: '#2B5BA8' }

// ── Editor context ────────────────────────────────────────────────────────────

const EditorContext = createContext({ deleteNode: () => {}, deleteEdge: () => {} })

// ── Custom deletable edge — brand palette ─────────────────────────────────────

function DeletableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, selected }) {
  const { deleteEdge } = useContext(EditorContext)
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          strokeWidth: selected ? 2.5 : 2,
          stroke: selected ? '#1A3A6B' : '#2B5BA8',
          opacity: selected ? 1 : 0.72,
          ...style,
        }}
      />
      {selected && (
        <EdgeLabelRenderer>
          <button
            className="nodrag nopan absolute w-5 h-5 rounded-full border flex items-center justify-center shadow-sm transition-colors"
            style={{
              transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              background: '#fff',
              borderColor: 'rgba(210,225,232,0.92)',
              color: 'rgba(8,15,44,0.45)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(210,225,232,0.92)'; e.currentTarget.style.color = 'rgba(8,15,44,0.45)' }}
            onClick={e => { e.stopPropagation(); deleteEdge(id) }}
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

// ── Custom React Flow Node ─────────────────────────────────────────────────────

function WorkflowNode({ id, data, selected }) {
  const { deleteNode } = useContext(EditorContext)
  const [hovered, setHovered] = useState(false)
  const { label, Icon, color, tipo, config = {}, isInitial } = data
  const isCondition = tipo === 'control_condicao'
  const isTrigger   = (data.category || '') === 'trigger'
  const isFim       = tipo === 'control_fim'

  const configSummary = useMemo(() => {
    const entries = Object.entries(config).filter(([, v]) => v)
    return entries.slice(0, 2).map(([, v]) => String(v)).join(' · ')
  }, [config])

  const shadowStyle = selected
    ? `0 0 0 2.5px ${color}55, 0 0 0 5px ${color}18, 0 12px 32px ${color}20, 0 4px 10px rgba(6,10,32,0.10)`
    : hovered
    ? `0 8px 24px rgba(6,10,32,0.13), 0 2px 6px rgba(6,10,32,0.06), inset 0 1px 0 rgba(255,255,255,0.92)`
    : `0 4px 16px rgba(6,10,32,0.08), 0 1px 4px rgba(6,10,32,0.05), inset 0 1px 0 rgba(255,255,255,0.90)`

  return (
    <div
      style={{
        minWidth: 220,
        borderLeft: `3px solid ${color}`,
        borderTop: `1px solid ${color}28`,
        borderRight: `1px solid ${color}18`,
        borderBottom: `1px solid ${color}18`,
        borderRadius: 16,
        background: 'linear-gradient(160deg, rgba(255,255,255,0.99) 0%, rgba(248,251,254,0.97) 100%)',
        boxShadow: shadowStyle,
        transform: selected ? 'translateY(-1px)' : hovered ? 'translateY(-1px)' : 'none',
        transition: 'box-shadow 0.18s ease, transform 0.15s ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-nodeid={id}
    >
      {/* Delete button on hover */}
      {hovered && !isInitial && (
        <button
          className="nodrag absolute -top-2.5 -right-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white text-dark-muted shadow-md transition-colors hover:text-status-danger"
          style={{ border: '1px solid rgba(210,225,232,0.92)' }}
          onClick={e => { e.stopPropagation(); deleteNode(id) }}
        >
          <Trash2 className="w-2.5 h-2.5" />
        </button>
      )}

      {/* Target handle */}
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Top}
          style={{
            background: color,
            width: 10,
            height: 10,
            border: '2px solid #ffffff',
            boxShadow: `0 0 0 2px ${color}28`,
            top: -6,
          }}
        />
      )}

      {/* Header */}
      <div
        style={{
          background: `linear-gradient(135deg, ${color}1a 0%, rgba(255,255,255,0.70) 100%)`,
          borderBottom: `1px solid ${color}1e`,
          borderRadius: '13px 13px 0 0',
        }}
        className="flex items-center gap-2.5 px-3 py-2.5"
      >
        {Icon && (
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 30,
              height: 30,
              borderRadius: 10,
              background: `${color}14`,
              border: `1px solid ${color}20`,
            }}
          >
            <Icon style={{ color, width: 14, height: 14 }} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <span
            style={{ color }}
            className="block truncate text-xs font-bold leading-none tracking-tight"
          >
            {label}
          </span>
          <span className="mt-1 block text-[10px] uppercase tracking-[0.16em] text-dark-muted/70 leading-none">
            {isTrigger ? 'Trigger' : isCondition ? 'Condição' : isFim ? 'Fim' : 'Ação'}
          </span>
        </div>
        {isInitial && (
          <span
            className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
            style={{ background: color + '22', color }}
          >
            início
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-2.5" style={{ minHeight: 52 }}>
        {configSummary ? (
          <p className="text-[11px] text-dark-muted leading-relaxed">{configSummary}</p>
        ) : (
          <p className="text-[11px] italic" style={{ color: 'rgba(78,89,117,0.42)' }}>
            Clique para configurar
          </p>
        )}
      </div>

      {/* Source handles */}
      {!isFim && !isCondition && (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            background: color,
            width: 10,
            height: 10,
            border: '2px solid #ffffff',
            boxShadow: `0 0 0 2px ${color}28`,
            bottom: -6,
          }}
        />
      )}
      {isCondition && (
        <>
          <Handle
            id="yes"
            type="source"
            position={Position.Bottom}
            style={{
              background: '#10B981',
              width: 10,
              height: 10,
              border: '2px solid #ffffff',
              boxShadow: '0 0 0 2px rgba(16,185,129,0.28)',
              bottom: -6,
              left: '30%',
            }}
          />
          <Handle
            id="no"
            type="source"
            position={Position.Bottom}
            style={{
              background: '#EF4444',
              width: 10,
              height: 10,
              border: '2px solid #ffffff',
              boxShadow: '0 0 0 2px rgba(239,68,68,0.28)',
              bottom: -6,
              left: '70%',
            }}
          />
          <div className="absolute -bottom-5 flex w-full px-2 pointer-events-none">
            <span style={{ left: 'calc(30% - 10px)' }} className="absolute text-[10px] font-bold text-status-success">Sim</span>
            <span style={{ left: 'calc(70% - 8px)' }}  className="absolute text-[10px] font-bold text-status-danger">Não</span>
          </div>
        </>
      )}
    </div>
  )
}

const nodeTypes = { workflowNode: WorkflowNode }
const edgeTypes = { deletable: DeletableEdge }

// ── Painel Nós (left sidebar) ─────────────────────────────────────────────────

function PainelNos() {
  return (
    <div
      className="flex flex-shrink-0 flex-col overflow-y-auto"
      style={{
        width: 248,
        background: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(12px)',
        borderRight: '1px solid rgba(210,225,232,0.88)',
        boxShadow: '4px 0 18px rgba(6,10,32,0.05)',
        animation: 'jrn-slide-left 0.24s cubic-bezier(0.25,0.46,0.45,0.94)',
      }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 px-4 py-4"
        style={{ borderBottom: '1px solid rgba(210,225,232,0.70)' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center"
            style={{ background: 'rgba(0,0,121,0.10)' }}
          >
            <Layers className="w-3 h-3" style={{ color: '#000079' }} />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.20em]" style={{ color: '#000079' }}>
            Biblioteca
          </p>
        </div>
        <p className="text-[11px] text-dark-muted leading-relaxed" style={{ paddingLeft: 28 }}>
          Arraste para montar o fluxo
        </p>
      </div>

      {/* Node groups */}
      {NODE_GROUPS.map((group, gi) => (
        <div key={group.label}>
          {gi > 0 && <div style={{ height: 1, background: 'rgba(210,225,232,0.55)', margin: '0 12px' }} />}
          <div className="px-3 py-3">
            <p
              className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ color: group.color }}
            >
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map(item => (
                <div
                  key={item.tipo}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData('application/workflow-tipo', item.tipo)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  className="jrn-lib-item flex cursor-grab select-none items-center gap-2.5 rounded-xl bg-white px-3 py-2"
                  style={{
                    borderLeft: `3px solid ${group.color}`,
                    borderTop: '1px solid rgba(210,225,232,0.55)',
                    borderRight: '1px solid rgba(210,225,232,0.40)',
                    borderBottom: '1px solid rgba(210,225,232,0.40)',
                    boxShadow: '0 1px 4px rgba(6,10,32,0.04)',
                  }}
                >
                  <div
                    className="flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: group.color + '14',
                    }}
                  >
                    <item.Icon style={{ color: group.color, width: 13, height: 13 }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold leading-tight text-dark-text">{item.label}</p>
                    <p className="mt-0.5 text-[10px] text-dark-muted/70">{group.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Painel Config (right sidebar) ─────────────────────────────────────────────

function PainelConfig({ node, onUpdate, onClose, deleteNode }) {
  const { tipo, config = {}, isInitial } = node.data
  const set = (k, v) => onUpdate(node.id, { config: { ...config, [k]: v } })
  const nodeInfo = findNodeInfo(tipo)
  const accentColor = nodeInfo.color || '#2B5BA8'

  const pipelineOpts = [{ value: '', label: 'Selecionar...' }, ...PIPELINE_COLS.map(c => ({ value: c.id, label: c.label }))]
  const destOpts = [{ value: '', label: 'Selecionar...' }, { value: 'cliente', label: 'Cliente' }, { value: 'responsavel', label: 'Responsável interno' }]

  return (
    <div
      className="flex flex-shrink-0 flex-col overflow-y-auto"
      style={{
        width: 320,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(12px)',
        borderLeft: '1px solid rgba(210,225,232,0.88)',
        boxShadow: '-4px 0 18px rgba(6,10,32,0.06)',
        animation: 'jrn-slide-right 0.22s cubic-bezier(0.25,0.46,0.45,0.94)',
      }}
    >
      {/* Color strip top */}
      <div
        style={{
          height: 3,
          background: `linear-gradient(90deg, ${accentColor}, ${accentColor}55)`,
          flexShrink: 0,
        }}
      />

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(210,225,232,0.65)' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {nodeInfo.Icon && (
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: 30,
                height: 30,
                borderRadius: 10,
                background: accentColor + '14',
                border: `1px solid ${accentColor}20`,
              }}
            >
              <nodeInfo.Icon style={{ color: accentColor, width: 14, height: 14 }} />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-dark-muted/70">Configuração</p>
            <p className="text-sm font-bold text-dark-text truncate">{node.data.label}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 rounded-xl p-1.5 text-dark-muted transition-colors hover:text-dark-text"
          style={{ background: 'rgba(210,225,232,0.30)' }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Fields */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">

        {(tipo === 'trigger_ficha' || tipo === 'trigger_lead') && (
          <>
            <div>
              <label className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider block mb-1">Perfil alvo</label>
              <Select value={config.perfil || ''} onChange={v => set('perfil', v)} options={[
                { value: '', label: 'Todos' },
                { value: 'locatario_pf', label: 'Locatário PF' },
                { value: 'locatario_pj', label: 'Locatário PJ' },
                { value: 'proprietario_pf', label: 'Proprietário PF' },
                { value: 'proprietario_pj', label: 'Proprietário PJ' },
              ]} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider block mb-1">Produto</label>
              <Select value={config.produto || ''} onChange={v => set('produto', v)} options={[
                { value: '', label: 'Todos' },
                { value: 'residencial_pf', label: 'Residencial PF' },
                { value: 'comercial_pf', label: 'Comercial PF' },
                { value: 'pessoa_juridica', label: 'Pessoa Jurídica' },
              ]} />
            </div>
          </>
        )}

        {tipo === 'trigger_movido' && (
          <>
            <div>
              <label className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider block mb-1">De qual coluna</label>
              <Select value={config.de || ''} onChange={v => set('de', v)} options={pipelineOpts} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider block mb-1">Para qual coluna</label>
              <Select value={config.para || ''} onChange={v => set('para', v)} options={pipelineOpts} />
            </div>
          </>
        )}

        {tipo === 'trigger_renovacao' && (
          <div>
            <label className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider block mb-1">Dias antes do vencimento</label>
            <input type="number" min="1" value={config.dias || ''} onChange={e => set('dias', e.target.value)}
              className="input w-full text-sm" placeholder="30" />
          </div>
        )}

        {(tipo === 'trigger_apolice' || tipo === 'trigger_manual') && (
          <p className="text-xs text-dark-muted/60 italic">Este gatilho não requer configuração adicional.</p>
        )}

        {tipo === 'action_tarefa' && (
          <>
            <ConfigField label="Título da tarefa" value={config.titulo || ''} onChange={v => set('titulo', v)} />
            <ConfigField label="Responsável" value={config.responsavel || ''} onChange={v => set('responsavel', v)} placeholder="Nome do responsável" />
            <div>
              <label className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider block mb-1">Prazo (dias após gatilho)</label>
              <input type="number" min="0" value={config.prazo || ''} onChange={e => set('prazo', e.target.value)}
                className="input w-full text-sm" placeholder="3" />
            </div>
          </>
        )}

        {tipo === 'action_whatsapp' && (
          <>
            <div>
              <label className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider block mb-1">Destinatário</label>
              <Select value={config.destinatario || ''} onChange={v => set('destinatario', v)} options={destOpts} />
            </div>
            <ConfigField label="Mensagem" value={config.mensagem || ''} onChange={v => set('mensagem', v)} textarea
              placeholder="Olá {{nome}}, ..." />
            <p className="text-[10px] text-dark-muted/60">Variáveis: {'{{nome}}'}, {'{{produto}}'}, {'{{telefone}}'}</p>
          </>
        )}

        {tipo === 'action_email' && (
          <>
            <div>
              <label className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider block mb-1">Destinatário</label>
              <Select value={config.destinatario || ''} onChange={v => set('destinatario', v)} options={destOpts} />
            </div>
            <ConfigField label="Assunto" value={config.assunto || ''} onChange={v => set('assunto', v)} />
            <ConfigField label="Corpo" value={config.corpo || ''} onChange={v => set('corpo', v)} textarea />
          </>
        )}

        {tipo === 'action_mover' && (
          <div>
            <label className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider block mb-1">Coluna destino</label>
            <Select value={config.coluna || ''} onChange={v => set('coluna', v)} options={pipelineOpts} />
          </div>
        )}

        {tipo === 'action_atribuir' && (
          <ConfigField label="Responsável" value={config.responsavel || ''} onChange={v => set('responsavel', v)} />
        )}

        {tipo === 'action_etiqueta' && (
          <ConfigField label="Etiqueta" value={config.etiqueta || ''} onChange={v => set('etiqueta', v)} placeholder="ex: Urgente" />
        )}

        {tipo === 'action_atividade' && (
          <ConfigField label="Descrição da atividade" value={config.descricao || ''} onChange={v => set('descricao', v)} textarea />
        )}

        {tipo === 'control_aguardar' && (
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider block mb-1">Quantidade</label>
              <input type="number" min="1" value={config.quantidade || ''} onChange={e => set('quantidade', e.target.value)}
                className="input w-full text-sm" placeholder="1" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider block mb-1">Unidade</label>
              <Select value={config.unidade || 'dias'} onChange={v => set('unidade', v)} options={[
                { value: 'horas',   label: 'Horas' },
                { value: 'dias',    label: 'Dias' },
                { value: 'semanas', label: 'Semanas' },
              ]} />
            </div>
          </div>
        )}

        {tipo === 'control_condicao' && (
          <>
            <div>
              <label className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider block mb-1">Campo a verificar</label>
              <Select value={config.campo || ''} onChange={v => set('campo', v)} options={[
                { value: '', label: 'Selecionar...' },
                { value: 'apolice', label: 'Tem apólice' },
                { value: 'produto', label: 'Produto' },
                { value: 'status',  label: 'Status' },
                { value: 'etiqueta',label: 'Etiqueta' },
              ]} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider block mb-1">Operador</label>
              <Select value={config.operador || ''} onChange={v => set('operador', v)} options={[
                { value: '', label: 'Selecionar...' },
                { value: 'eq',  label: 'É' },
                { value: 'neq', label: 'Não é' },
              ]} />
            </div>
            <ConfigField label="Valor" value={config.valor || ''} onChange={v => set('valor', v)} />
          </>
        )}

        {tipo === 'control_fim' && (
          <p className="text-xs text-dark-muted/60 italic">Marca o encerramento do fluxo para este lead.</p>
        )}
      </div>

      {/* Delete zone */}
      {!isInitial && (
        <div
          className="flex-shrink-0 px-4 py-3"
          style={{ borderTop: '1px solid rgba(210,225,232,0.65)' }}
        >
          <button
            onClick={() => deleteNode(node.id)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-status-danger text-xs font-semibold transition-colors hover:bg-status-danger/8"
            style={{ border: '1px solid rgba(239,68,68,0.16)' }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remover nó
          </button>
        </div>
      )}
    </div>
  )
}

function ConfigField({ label, value, onChange, textarea, placeholder }) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider block mb-1">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
          className="input w-full text-sm resize-none" placeholder={placeholder} />
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)} className="input w-full text-sm" placeholder={placeholder} />
      )}
    </div>
  )
}

// ── Editor de Jornada ─────────────────────────────────────────────────────────

function EditorInner({ journey, onBack, toast }) {
  const wf = getWorkflowData(journey)

  const initNodes = useMemo(() => {
    const saved = (wf.nodes || []).map(n => {
      const info = findNodeInfo(n.data?.tipo)
      const deletable = !(n.data?.isInitial || false)
      return { ...n, type: 'workflowNode', deletable, data: { ...n.data, ...info } }
    })
    if (saved.length === 0) {
      const info = findNodeInfo('trigger_ficha')
      return [{
        id: 'node_initial',
        type: 'workflowNode',
        position: { x: 300, y: 150 },
        deletable: false,
        data: { ...info, config: {}, isInitial: true },
      }]
    }
    return saved
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const initEdges = useMemo(() => (wf.edges || []).map(e => ({ ...e, type: 'deletable', animated: true })), []) // eslint-disable-line react-hooks/exhaustive-deps

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges)
  const [nome, setNome]             = useState(journey.nome)
  const [selectedId, setSelectedId] = useState(null)
  const [dirty, setDirty]           = useState(false)
  const [saving, setSaving]         = useState(false)
  const wrapperRef    = useRef(null)
  const rfInstanceRef = useRef(null)

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedId) || null, [nodes, selectedId])

  const deleteNode = useCallback((nodeId) => {
    setNodes(ns => {
      const node = ns.find(n => n.id === nodeId)
      if (node?.data?.isInitial) return ns
      return ns.filter(n => n.id !== nodeId)
    })
    setEdges(es => es.filter(e => e.source !== nodeId && e.target !== nodeId))
    setSelectedId(null)
    setDirty(true)
  }, [setNodes, setEdges])

  const deleteEdge = useCallback((edgeId) => {
    setEdges(es => es.filter(e => e.id !== edgeId))
    setDirty(true)
  }, [setEdges])

  const onConnect = useCallback(params => {
    setEdges(es => addEdge({ ...params, type: 'deletable', animated: true }, es))
    setDirty(true)
  }, [setEdges])

  const onNodeClick  = useCallback((_, node) => setSelectedId(node.id), [])
  const onPaneClick  = useCallback(() => setSelectedId(null), [])

  const handleNodesChange = useCallback(changes => {
    onNodesChange(changes)
    if (changes.some(c => c.type !== 'select')) setDirty(true)
  }, [onNodesChange])

  const handleEdgesChange = useCallback(changes => {
    onEdgesChange(changes)
    if (changes.some(c => c.type !== 'select')) setDirty(true)
  }, [onEdgesChange])

  function updateNodeData(nodeId, patch) {
    setNodes(ns => ns.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n))
    setDirty(true)
  }

  const handleDrop = useCallback(e => {
    e.preventDefault()
    const tipo = e.dataTransfer.getData('application/workflow-tipo')
    if (!tipo || !rfInstanceRef.current) return
    const position = rfInstanceRef.current.screenToFlowPosition
      ? rfInstanceRef.current.screenToFlowPosition({ x: e.clientX, y: e.clientY })
      : rfInstanceRef.current.project({ x: e.clientX - wrapperRef.current.getBoundingClientRect().left, y: e.clientY - wrapperRef.current.getBoundingClientRect().top })
    const info = findNodeInfo(tipo)
    setNodes(ns => [...ns, { id: crypto.randomUUID(), type: 'workflowNode', position, data: { ...info, config: {} } }])
    setDirty(true)
  }, [setNodes])

  async function persistWorkflow(newStatus) {
    setSaving(true)
    try {
      const status = newStatus || wf.status || 'rascunho'
      const etapas = {
        status,
        nodes: nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: { tipo: n.data.tipo, config: n.data.config || {}, isInitial: n.data.isInitial || false } })),
        edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle })),
      }
      await journeyUpdate(journey.id, { nome, etapas })
      setDirty(false)
      toast({ type: 'success', title: newStatus === 'ativa' ? 'Jornada publicada!' : 'Rascunho salvo!' })
    } catch {
      toast({ type: 'error', title: 'Erro ao salvar jornada' })
    } finally {
      setSaving(false)
    }
  }

  function handleBack() {
    if (dirty && !window.confirm('Sair sem salvar as alterações?')) return
    onBack()
  }

  const currentStatus = wf.status || 'rascunho'

  return (
    <EditorContext.Provider value={{ deleteNode, deleteEdge }}>
      <style>{EDITOR_STYLES}</style>

      <div
        className="flex flex-col"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 250,
          background: 'linear-gradient(160deg, rgb(var(--color-bg)) 0%, rgb(var(--color-surface2)) 100%)',
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center gap-3 px-4 py-0 flex-shrink-0"
          style={{
            height: 52,
            background: 'rgba(255,255,255,0.93)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(210,225,232,0.80)',
            boxShadow: '0 1px 8px rgba(6,10,32,0.05)',
          }}
        >
          {/* Left: back + breadcrumb + name */}
          <button
            onClick={handleBack}
            className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-xl text-dark-muted transition-colors hover:text-dark-text"
            style={{ background: 'rgba(210,225,232,0.38)' }}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div
            className="h-4 w-px flex-shrink-0"
            style={{ background: 'rgba(210,225,232,0.80)' }}
          />

          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-dark-muted/60 leading-none mb-0.5">
              Editor de Jornada
            </span>
            <input
              value={nome}
              onChange={e => { setNome(e.target.value); setDirty(true) }}
              className="w-full min-w-0 bg-transparent text-sm font-bold text-dark-text focus:outline-none leading-none"
              style={{ letterSpacing: '-0.01em' }}
            />
          </div>

          {/* Right: status + dirty + actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={currentStatus} />

            {dirty && (
              <span
                className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309' }}
              >
                <span className="w-1 h-1 rounded-full bg-amber-500" />
                Não salvo
              </span>
            )}

            <button
              onClick={() => persistWorkflow()}
              disabled={saving}
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 h-8"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Salvando...' : 'Rascunho'}
            </button>

            <button
              onClick={() => persistWorkflow('ativa')}
              disabled={saving}
              className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 h-8"
            >
              <Zap className="w-3.5 h-3.5" />
              Publicar
            </button>
          </div>
        </div>

        {/* ── Body: 3-column ── */}
        <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
          <PainelNos />

          {/* Canvas */}
          <div
            ref={wrapperRef}
            className="flex-1 relative overflow-hidden"
            style={{
              background: `
                radial-gradient(ellipse 60% 45% at 14% 0%, rgba(0,0,121,0.055) 0%, transparent 54%),
                radial-gradient(ellipse 50% 38% at 88% 102%, rgba(195,240,242,0.16) 0%, transparent 52%),
                #F1F5F9
              `,
            }}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
          >
            {/* Floating stats pill */}
            <div
              className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-3 px-3 py-2 rounded-2xl"
              style={{
                background: 'rgba(255,255,255,0.88)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(210,225,232,0.80)',
                boxShadow: '0 2px 12px rgba(6,10,32,0.07)',
              }}
            >
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#2B5BA8' }} />
                <span className="text-[11px] font-semibold text-dark-text">{nodes.length} nós</span>
              </div>
              <div className="w-px h-3" style={{ background: 'rgba(210,225,232,0.80)' }} />
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#64748B' }} />
                <span className="text-[11px] font-semibold text-dark-text">{edges.length} conexões</span>
              </div>
            </div>

            <div style={{ position: 'absolute', inset: 0 }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              onInit={instance => { rfInstanceRef.current = instance }}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              deleteKeyCode="Delete"
              defaultEdgeOptions={{ type: 'deletable', animated: true }}
            >
              <Background
                variant={BackgroundVariant.Dots}
                color="#94A3B8"
                gap={24}
                size={1.5}
              />
              <Controls />
              <MiniMap
                nodeColor={n => findNodeInfo(n.data?.tipo)?.color || '#2B5BA8'}
                maskColor="rgba(241,245,249,0.80)"
                nodeStrokeWidth={0}
              />
            </ReactFlow>
            </div>
          </div>

          {selectedNode && (
            <PainelConfig
              node={selectedNode}
              onUpdate={updateNodeData}
              onClose={() => setSelectedId(null)}
              deleteNode={deleteNode}
            />
          )}
        </div>
      </div>
    </EditorContext.Provider>
  )
}

function EditorJornada(props) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  )
}

// ── Journey Card ──────────────────────────────────────────────────────────────

function JourneyCard({ journey, leads, onEdit, onDuplicate, onToggle }) {
  const [confirmExcluir, setConfirmExcluir] = useState(false)
  const status   = getStatus(journey)
  const wf       = getWorkflowData(journey)
  const nodesQty = (wf.nodes || []).length
  const vinculados = leads.filter(l => l.jornada_id === journey.id).length

  return (
    <div className="card flex flex-col overflow-hidden group hover:border-brand-accent/30 transition-colors">
      {/* Accent strip */}
      <div className="h-0.5 w-full rounded-t-[inherit]" style={{ background: 'linear-gradient(90deg, #000079, #2B5BA8, rgba(195,240,242,0.60))' }} />

      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Icon + status */}
        <div className="flex items-start justify-between gap-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(0,0,121,0.08)', border: '1px solid rgba(0,0,121,0.12)' }}
          >
            <Map className="w-4.5 h-4.5" style={{ color: '#000079' }} />
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Name + description */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-dark-text text-sm leading-snug">{journey.nome}</p>
          {journey.descricao && (
            <p className="text-xs text-dark-muted mt-1 line-clamp-2">{journey.descricao}</p>
          )}
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-dark-muted">
          {journey.tipoCliente && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" /> {journey.tipoCliente}
            </span>
          )}
          <span className="flex items-center gap-1">
            <GitBranch className="w-3 h-3" />
            {nodesQty} {nodesQty === 1 ? 'nó' : 'nós'}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {vinculados} leads
          </span>
        </div>
      </div>

      {/* Footer actions */}
      <div className="px-4 py-3 border-t border-dark-border flex items-center gap-1">
        <button onClick={() => onEdit(journey)}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold text-dark-muted hover:text-brand-accent hover:bg-brand-accent/10 transition-colors">
          <Pencil className="w-3.5 h-3.5" /> Editar
        </button>
        <button onClick={() => onDuplicate(journey)}
          className="flex items-center justify-center px-2 py-1.5 rounded-lg text-xs text-dark-muted hover:text-dark-text hover:bg-dark-surface2 transition-colors"
          title="Duplicar">
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onToggle(journey)}
          className={`flex items-center justify-center px-2 py-1.5 rounded-lg text-xs transition-colors ${
            status === 'ativa' ? 'text-amber-500 hover:bg-amber-500/10' : 'text-status-success hover:bg-status-success/10'
          }`}
          title={status === 'ativa' ? 'Pausar' : 'Ativar'}
        >
          {status === 'ativa' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        {confirmExcluir ? (
          <div className="flex items-center gap-1">
            <button onClick={async () => {
              await journeyUpdate(journey.id, { etapas: { ...getWorkflowData(journey), status: 'arquivada' } })
              setConfirmExcluir(false)
            }} className="text-[10px] px-2 py-1 rounded-lg bg-status-danger/10 text-status-danger font-semibold hover:bg-status-danger/20">
              Sim
            </button>
            <button onClick={() => setConfirmExcluir(false)}
              className="text-[10px] px-2 py-1 rounded-lg bg-dark-surface2 text-dark-muted font-semibold">
              Não
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmExcluir(true)}
            className="flex items-center justify-center px-2 py-1.5 rounded-lg text-xs text-dark-muted/60 hover:text-status-danger hover:bg-status-danger/10 transition-colors"
            title="Excluir">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Script Card ───────────────────────────────────────────────────────────────

function ScriptCard({ script }) {
  const [open, setOpen] = useState(false)
  const tipo = script.tipo || script.categoria || '—'
  return (
    <div className="card overflow-hidden">
      <button className="w-full flex items-center gap-3 p-4 text-left hover:bg-dark-surface2 transition-colors"
        onClick={() => setOpen(o => !o)}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-violet-500/10">
          <FileText className="w-4 h-4 text-violet-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-dark-text text-sm truncate">{script.titulo}</p>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-500">{tipo}</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-dark-muted" /> : <ChevronRight className="w-4 h-4 text-dark-muted" />}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-dark-border">
          <div className="mt-3 p-3 rounded-xl bg-dark-surface2 text-xs text-dark-text whitespace-pre-wrap leading-relaxed">
            {script.conteudo}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Modals ────────────────────────────────────────────────────────────────────

function ModalJornada({ onClose, onSave }) {
  const [form, setForm] = useState({ nome: '', descricao: '', tipoCliente: 'PF' })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="relative glass-modal rounded-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-dark-border">
          <button onClick={onClose} className="p-1.5 rounded-xl text-dark-muted hover:text-dark-text hover:bg-dark-surface2 transition-all">
            <X className="w-5 h-5" />
          </button>
          <h2 className="font-bold text-dark-text">Nova Jornada</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Nome *</label>
            <input value={form.nome} onChange={e => set('nome', e.target.value)} className="input w-full" autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Descrição</label>
            <textarea value={form.descricao} onChange={e => set('descricao', e.target.value)} rows={2} className="input w-full resize-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Tipo de cliente</label>
            <div className="flex gap-2">
              {['PF', 'PJ', 'Ambos'].map(t => (
                <button key={t} onClick={() => set('tipoCliente', t)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${
                    form.tipoCliente === t ? 'bg-brand-accent text-white border-brand-accent' : 'border-dark-border text-dark-muted hover:border-brand-accent/50'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={() => form.nome.trim() && onSave(form)} disabled={!form.nome.trim()} className="btn-primary flex-1">
              Criar Jornada
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ModalScript({ onClose, onSave }) {
  const [form, setForm] = useState({ titulo: '', tipo: 'Abordagem', conteudo: '' })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const valido = form.titulo.trim() && form.conteudo.trim()
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="relative glass-modal rounded-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-dark-border">
          <button onClick={onClose} className="p-1.5 rounded-xl text-dark-muted hover:text-dark-text hover:bg-dark-surface2 transition-all">
            <X className="w-5 h-5" />
          </button>
          <h2 className="font-bold text-dark-text">Novo Script</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Título *</label>
            <input value={form.titulo} onChange={e => set('titulo', e.target.value)} className="input w-full" autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Tipo</label>
            <Select value={form.tipo} onChange={v => set('tipo', v)}
              options={['Abordagem', 'Follow Up', 'Proposta', 'Fechamento', 'Objeção']} />
          </div>
          <div>
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Conteúdo *</label>
            <textarea value={form.conteudo} onChange={e => set('conteudo', e.target.value)} rows={5}
              className="input w-full resize-none" placeholder="Olá {nome}, ..." />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={() => valido && onSave(form)} disabled={!valido} className="btn-primary flex-1">Criar Script</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

const TABS = ['Jornadas', 'Scripts', 'Materiais']

export default function Jornadas() {
  const state  = useComercial()
  const toast  = useToast()
  const [tab,      setTab]      = useState('Jornadas')
  const [modal,    setModal]    = useState(null)
  const [editorId, setEditorId] = useState(null)

  const materiais = state.scripts.filter(s => (s.tipo || s.categoria) === 'Material')
  const scripts   = state.scripts.filter(s => (s.tipo || s.categoria) !== 'Material')
  const visibleJourneys = state.journeys.filter(j => getStatus(j) !== 'arquivada')

  const editorJourney = editorId ? state.journeys.find(j => j.id === editorId) : null
  if (editorJourney) {
    return <EditorJornada journey={editorJourney} onBack={() => setEditorId(null)} toast={toast} />
  }

  async function handleAddJornada(form) {
    try {
      await journeyAdd({ nome: form.nome, descricao: form.descricao, tipoCliente: form.tipoCliente, etapas: [] })
      toast({ type: 'success', title: 'Jornada criada!' })
    } catch {
      toast({ type: 'error', title: 'Erro ao criar jornada' })
    }
    setModal(null)
  }

  async function handleAddScript(form) {
    try {
      await scriptAdd(form)
      toast({ type: 'success', title: 'Script salvo!' })
    } catch {
      toast({ type: 'error', title: 'Erro ao salvar script' })
    }
    setModal(null)
  }

  async function handleDuplicate(journey) {
    try {
      await journeyAdd({ nome: journey.nome + ' (cópia)', descricao: journey.descricao, tipoCliente: journey.tipoCliente, etapas: journey.etapas })
      toast({ type: 'success', title: 'Jornada duplicada!' })
    } catch {
      toast({ type: 'error', title: 'Erro ao duplicar jornada' })
    }
  }

  async function handleToggle(journey) {
    const wf = getWorkflowData(journey)
    const newStatus = wf.status === 'ativa' ? 'pausada' : 'ativa'
    await journeyUpdate(journey.id, { etapas: { ...wf, status: newStatus } })
    toast({ type: 'success', title: newStatus === 'ativa' ? 'Jornada ativada' : 'Jornada pausada' })
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {modal === 'Jornadas' && <ModalJornada onClose={() => setModal(null)} onSave={handleAddJornada} />}
      {modal === 'Scripts'  && <ModalScript  onClose={() => setModal(null)} onSave={f => handleAddScript({ ...f, tipo: tab === 'Materiais' ? 'Material' : f.tipo })} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="title-page text-dark-text">Jornadas & Materiais</h1>
          <p className="text-xs text-dark-muted mt-0.5">Playbooks, scripts e conteúdos de apoio</p>
        </div>
        {tab !== 'Materiais' && (
          <button onClick={() => setModal(tab)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            {tab === 'Jornadas' ? 'Nova Jornada' : 'Novo Script'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-dark-surface2 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t ? 'bg-dark-glass text-dark-text shadow-sm' : 'text-dark-muted hover:text-dark-text'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* Jornadas grid */}
      {tab === 'Jornadas' && (
        visibleJourneys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-brand-accent/10 flex items-center justify-center mb-4">
              <GitBranch className="w-8 h-8 text-brand-accent/40" />
            </div>
            <p className="font-semibold text-dark-text mb-1">Nenhuma jornada criada</p>
            <p className="text-xs text-dark-muted mb-4">Crie fluxos automatizados para engajar seus leads</p>
            <button onClick={() => setModal('Jornadas')} className="btn-primary text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> Criar primeira jornada
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleJourneys.map(j => (
              <JourneyCard key={j.id} journey={j} leads={state.leads}
                onEdit={j => setEditorId(j.id)}
                onDuplicate={handleDuplicate}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )
      )}

      {/* Scripts */}
      {tab === 'Scripts' && (
        <div className="space-y-3">
          {scripts.length === 0 ? (
            <div className="text-center py-16 text-dark-muted">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum script cadastrado</p>
            </div>
          ) : scripts.map(s => <ScriptCard key={s.id} script={s} />)}
        </div>
      )}

      {/* Materiais */}
      {tab === 'Materiais' && (
        <div className="space-y-3">
          {materiais.length === 0 ? (
            <div className="text-center py-16 text-dark-muted">
              <Layers className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum material cadastrado</p>
            </div>
          ) : materiais.map(s => <ScriptCard key={s.id} script={s} />)}
          <button onClick={() => setModal('Scripts')} className="btn-secondary text-sm">
            <Plus className="w-4 h-4 inline mr-1" /> Adicionar Material
          </button>
        </div>
      )}
    </div>
  )
}
