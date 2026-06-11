import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import ReactFlow, {
  Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  Handle, Position, ReactFlowProvider,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useComercial, journeyAdd, journeyUpdate, journeyDelete, scriptAdd, PIPELINE_COLS } from '../../lib/comercial'
import { useToast } from '../../contexts/ToastContext'
import {
  Plus, ArrowLeft, FileText, Tag, Users, Map, Layers,
  Pencil, Copy, Play, Pause, X, Zap, GitBranch, Clock,
  Mail, Phone, MoveRight, UserCheck, CheckSquare, CircleDot, Save, Trash2,
  MapPin, UserPlus, RefreshCw, Heart, Car, Truck, Shield, Smartphone, Package, Flame, PhoneCall,
} from 'lucide-react'
import { Select } from '../../components/ui/Select'

// ── Helpers ───────────────────────────────────────────────────────────────────

const isWorkflow = j => j.etapas && typeof j.etapas === 'object' && !Array.isArray(j.etapas)
const getWorkflowData = j => {
  if (!j.etapas) return { status: 'rascunho', nodes: [], edges: [] }
  if (j.etapas._type === 'workflow') return j.etapas  // compatibilidade legada
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
    label: 'Gatilhos', category: 'trigger', color: '#F59E0B',
    items: [
      { tipo: 'trigger_ficha',     label: 'Ficha Aprovada',    Icon: CheckSquare },
      { tipo: 'trigger_criado',    label: 'Lead Criado',       Icon: UserPlus },
      { tipo: 'trigger_movido',    label: 'Lead Movido',       Icon: MoveRight },
      { tipo: 'trigger_renovacao', label: 'Renovação Próxima', Icon: RefreshCw },
      { tipo: 'trigger_manual',    label: 'Manual',            Icon: Play },
    ],
  },
  {
    label: 'Etapas', category: 'stage', color: '#6B7280',
    items: [
      { tipo: 'stage_etapa', label: 'Etapa', Icon: MapPin },
    ],
  },
  {
    label: 'Produtos', category: 'product', color: '#10B981',
    items: [
      { tipo: 'product_saude_pf',      label: 'Saúde PF',          Icon: Heart },
      { tipo: 'product_saude_pj',      label: 'Saúde PJ',          Icon: Heart },
      { tipo: 'product_auto',          label: 'Auto Individual',    Icon: Car },
      { tipo: 'product_auto_frota',    label: 'Auto Frota',         Icon: Truck },
      { tipo: 'product_vida',          label: 'Seguro de Vida',     Icon: Shield },
      { tipo: 'product_celular',       label: 'Seguro Celular',     Icon: Smartphone },
      { tipo: 'product_consorcio',     label: 'Consórcio',          Icon: Layers },
      { tipo: 'product_transporte',    label: 'Seg. Transporte',    Icon: Package },
      { tipo: 'product_incendio',      label: 'Seg. Incêndio',      Icon: Flame },
    ],
  },
  {
    label: 'Contato', category: 'contact', color: '#3B82F6',
    items: [
      { tipo: 'contact_whatsapp', label: 'WhatsApp',   Icon: Phone },
      { tipo: 'contact_email',    label: 'Email',      Icon: Mail },
      { tipo: 'contact_ligacao',  label: 'Ligação',    Icon: PhoneCall },
    ],
  },
  {
    label: 'Ações', category: 'action', color: '#4A90D9',
    items: [
      { tipo: 'action_tarefa',   label: 'Criar Tarefa',   Icon: CheckSquare },
      { tipo: 'action_mover',    label: 'Mover Pipeline', Icon: MoveRight },
      { tipo: 'action_atribuir', label: 'Atribuir',       Icon: UserCheck },
    ],
  },
  {
    label: 'Controle', category: 'control', color: '#8B5CF6',
    items: [
      { tipo: 'control_aguardar', label: 'Aguardar',  Icon: Clock },
      { tipo: 'control_condicao', label: 'Condição',  Icon: GitBranch },
      { tipo: 'control_fim',      label: 'Fim',       Icon: CircleDot },
    ],
  },
]

const ALL_ITEMS = NODE_GROUPS.flatMap(g => g.items.map(i => ({ ...i, category: g.category, color: g.color })))
const findNodeInfo = tipo => ALL_ITEMS.find(i => i.tipo === tipo) || { tipo, label: tipo, Icon: Zap, category: 'action', color: '#3B82F6' }

// ── Custom React Flow Node ─────────────────────────────────────────────────────

function WorkflowNode({ id, data, selected }) {
  const { label, Icon, color, tipo, config = {} } = data
  const isCondition = tipo === 'control_condicao'
  const isTrigger   = (data.category || '') === 'trigger'
  const isFim       = tipo === 'control_fim'

  const configSummary = useMemo(() => {
    const entries = Object.entries(config).filter(([, v]) => v)
    return entries.slice(0, 2).map(([k, v]) => `${v}`).join(' · ')
  }, [config])

  return (
    <div
      style={{ borderColor: color, minWidth: 180 }}
      className={`relative rounded-xl border-2 shadow-lg transition-shadow ${selected ? 'shadow-[0_0_0_3px_rgba(99,102,241,0.4)]' : ''}`}
      data-nodeid={id}
    >
      {/* Target handle (top) — hidden for triggers */}
      {!isTrigger && (
        <Handle type="target" position={Position.Top}
          style={{ background: color, width: 12, height: 12, border: '2.5px solid white', top: -7 }} />
      )}

      {/* Header */}
      <div
        style={{ background: color + '18', borderBottom: `1px solid ${color}22` }}
        className="px-3 py-2 rounded-t-[10px]"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon style={{ color }} className="w-3.5 h-3.5 flex-shrink-0" />}
          <span style={{ color }} className="text-xs font-bold leading-none">{label}</span>
        </div>
        {data.category === 'stage' && (
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full mt-1 inline-block" style={{ background: 'rgba(107,114,128,0.2)', color: '#9CA3AF' }}>Marco manual</span>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-2 bg-dark-surface rounded-b-[10px]" style={{ minHeight: 36 }}>
        {configSummary ? (
          <p className="text-[11px] text-dark-muted leading-relaxed">{configSummary}</p>
        ) : (
          <p className="text-[11px] text-dark-muted/50 italic">Clique para configurar</p>
        )}
      </div>

      {/* Source handle(s) (bottom) — hidden for fim */}
      {!isFim && !isCondition && (
        <Handle type="source" position={Position.Bottom}
          style={{ background: color, width: 12, height: 12, border: '2.5px solid white', bottom: -7 }} />
      )}
      {isCondition && (
        <>
          <Handle id="yes" type="source" position={Position.Bottom}
            style={{ background: '#10B981', width: 12, height: 12, border: '2.5px solid white', bottom: -7, left: '30%' }} />
          <Handle id="no" type="source" position={Position.Bottom}
            style={{ background: '#EF4444', width: 12, height: 12, border: '2.5px solid white', bottom: -7, left: '70%' }} />
          <div className="absolute -bottom-5 flex w-full px-2 pointer-events-none">
            <span style={{ left: 'calc(30% - 10px)' }} className="absolute text-[10px] font-bold text-status-success">Sim</span>
            <span style={{ left: 'calc(70% - 8px)' }} className="absolute text-[10px] font-bold text-status-error">Não</span>
          </div>
        </>
      )}
    </div>
  )
}

const nodeTypes = { workflowNode: WorkflowNode }

// ── Painel Nós (left sidebar in editor) ──────────────────────────────────────

function PainelNos() {
  const getSubtitle = (item, group) => {
    if (group.category === 'stage') return 'Marco manual'
    return null
  }

  return (
    <div className="w-56 flex-shrink-0 border-r border-dark-border bg-dark-surface flex flex-col overflow-y-auto">
      <div className="px-3 py-3 border-b border-dark-border">
        <p className="text-xs font-bold text-dark-muted uppercase tracking-wider">Componentes</p>
        <p className="text-[10px] text-dark-muted/60 mt-0.5">Arraste para o canvas</p>
      </div>
      {NODE_GROUPS.map((group, gi) => (
        <div key={group.label}>
          {gi > 0 && <div className="mx-2 border-t border-dark-border/40" />}
          <div className="px-2 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5 px-1" style={{ color: group.color }}>
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const subtitle = getSubtitle(item, group)
                return (
                  <div
                    key={item.tipo}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData('application/workflow-tipo', item.tipo)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-grab active:cursor-grabbing hover:bg-dark-surface2 transition-colors select-none"
                  >
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: group.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <item.Icon style={{ color: group.color, width: 14, height: 14 }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-dark-text leading-tight">{item.label}</p>
                      {subtitle && <p className="text-[9px] text-dark-muted/70 leading-tight">{subtitle}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Painel Config (right sidebar in editor) ────────────────────────────────────

function PainelConfig({ node, onUpdate, onClose, onDelete }) {
  const { tipo, config = {} } = node.data
  const set = (k, v) => onUpdate(node.id, { config: { ...config, [k]: v } })

  return (
    <div className="w-72 flex-shrink-0 border-l border-dark-border bg-dark-surface flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-3 py-3 border-b border-dark-border">
        <p className="text-xs font-bold text-dark-text">{node.data.label}</p>
        <button onClick={onClose} className="p-1 rounded-lg text-dark-muted hover:text-dark-text hover:bg-dark-surface2 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 px-3 py-3 space-y-3 overflow-y-auto">
        {/* action_tarefa */}
        {tipo === 'action_tarefa' && (
          <>
            <ConfigField label="Título da tarefa" value={config.titulo || ''} onChange={v => set('titulo', v)} />
            <ConfigField label="Descrição" value={config.descricao || ''} onChange={v => set('descricao', v)} textarea />
          </>
        )}

        {/* action_whatsapp */}
        {tipo === 'action_whatsapp' && (
          <ConfigField label="Mensagem" value={config.mensagem || ''} onChange={v => set('mensagem', v)} textarea
            placeholder="Olá {nome}, ..." />
        )}

        {/* action_email */}
        {tipo === 'action_email' && (
          <>
            <ConfigField label="Assunto" value={config.assunto || ''} onChange={v => set('assunto', v)} />
            <ConfigField label="Corpo" value={config.corpo || ''} onChange={v => set('corpo', v)} textarea />
          </>
        )}

        {/* action_mover */}
        {tipo === 'action_mover' && (
          <div>
            <label className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider block mb-1">Coluna destino</label>
            <Select
              value={config.coluna || ''}
              onChange={v => set('coluna', v)}
              placeholder="Selecionar..."
              options={[{ value: '', label: 'Selecionar...' }, ...PIPELINE_COLS.map(c => ({ value: c.id, label: c.label }))]}
            />
          </div>
        )}

        {/* action_atribuir */}
        {tipo === 'action_atribuir' && (
          <ConfigField label="Responsável" value={config.responsavel || ''} onChange={v => set('responsavel', v)} />
        )}

        {/* control_aguardar */}
        {tipo === 'control_aguardar' && (
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider block mb-1">Quantidade</label>
              <input type="number" min="1" value={config.quantidade || ''} onChange={e => set('quantidade', e.target.value)}
                className="input w-full text-sm" placeholder="1" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider block mb-1">Unidade</label>
              <Select
                value={config.unidade || 'dias'}
                onChange={v => set('unidade', v)}
                options={[
                  { value: 'horas', label: 'Horas' },
                  { value: 'dias', label: 'Dias' },
                  { value: 'semanas', label: 'Semanas' },
                ]}
              />
            </div>
          </div>
        )}

        {/* control_condicao */}
        {tipo === 'control_condicao' && (
          <>
            <div>
              <label className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider block mb-1">Campo</label>
              <Select
                value={config.campo || ''}
                onChange={v => set('campo', v)}
                placeholder="Selecionar..."
                options={[
                  { value: '', label: 'Selecionar...' },
                  { value: 'score', label: 'Score do lead' },
                  { value: 'coluna', label: 'Estágio' },
                  { value: 'origem', label: 'Origem' },
                  { value: 'tipoCliente', label: 'Tipo cliente' },
                ]}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider block mb-1">Operador</label>
              <Select
                value={config.operador || ''}
                onChange={v => set('operador', v)}
                placeholder="Selecionar..."
                options={[
                  { value: '', label: 'Selecionar...' },
                  { value: 'eq', label: 'É igual a' },
                  { value: 'gt', label: 'Maior que' },
                  { value: 'lt', label: 'Menor que' },
                  { value: 'contains', label: 'Contém' },
                ]}
              />
            </div>
            <ConfigField label="Valor" value={config.valor || ''} onChange={v => set('valor', v)} />
          </>
        )}

        {/* stage_etapa */}
        {tipo === 'stage_etapa' && (
          <ConfigField label="Nome da etapa" value={config.nome || ''} onChange={v => set('nome', v)} placeholder="ex: Contato Inicial" />
        )}

        {/* product_saude */}
        {(tipo === 'product_saude_pf' || tipo === 'product_saude_pj') && (
          <>
            <ConfigField label="Operadora" value={config.operadora || ''} onChange={v => set('operadora', v)} />
            <ConfigField label="Observação" value={config.observacao || ''} onChange={v => set('observacao', v)} textarea />
          </>
        )}

        {/* product_auto / vida / transporte / incendio */}
        {['product_auto', 'product_auto_frota', 'product_vida', 'product_transporte', 'product_incendio'].includes(tipo) && (
          <>
            <ConfigField label="Seguradora" value={config.seguradora || ''} onChange={v => set('seguradora', v)} />
            <ConfigField label="Observação" value={config.observacao || ''} onChange={v => set('observacao', v)} textarea />
          </>
        )}

        {/* product_celular */}
        {tipo === 'product_celular' && (
          <>
            <ConfigField label="Modelo do aparelho" value={config.modelo || ''} onChange={v => set('modelo', v)} />
            <ConfigField label="Observação" value={config.observacao || ''} onChange={v => set('observacao', v)} textarea />
          </>
        )}

        {/* product_consorcio */}
        {tipo === 'product_consorcio' && (
          <>
            <div>
              <label className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider block mb-1">Tipo</label>
              <Select
                value={config.tipo_consorcio || ''}
                onChange={v => set('tipo_consorcio', v)}
                options={[
                  { value: '', label: 'Selecionar...' },
                  { value: 'Auto', label: 'Auto' },
                  { value: 'Residência', label: 'Residência' },
                  { value: 'Campanha', label: 'Campanha' },
                ]}
              />
            </div>
            {config.tipo_consorcio === 'Campanha' && (
              <ConfigField label="Nome da campanha" value={config.nome_campanha || ''} onChange={v => set('nome_campanha', v)} />
            )}
            <ConfigField label="Observação" value={config.observacao || ''} onChange={v => set('observacao', v)} textarea />
          </>
        )}

        {/* contact_whatsapp */}
        {tipo === 'contact_whatsapp' && (
          <ConfigField label="Mensagem" value={config.mensagem || ''} onChange={v => set('mensagem', v)} textarea placeholder="Olá {nome}, ..." />
        )}

        {/* contact_email */}
        {tipo === 'contact_email' && (
          <>
            <ConfigField label="Assunto" value={config.assunto || ''} onChange={v => set('assunto', v)} />
            <ConfigField label="Corpo" value={config.corpo || ''} onChange={v => set('corpo', v)} textarea />
          </>
        )}

        {/* contact_ligacao */}
        {tipo === 'contact_ligacao' && (
          <ConfigField label="Roteiro" value={config.roteiro || ''} onChange={v => set('roteiro', v)} textarea placeholder="Pontos a abordar na ligação..." />
        )}

        {/* triggers */}
        {tipo.startsWith('trigger_') && tipo !== 'trigger_manual' && (
          <p className="text-xs text-dark-muted/60 italic">Este gatilho não requer configuração adicional.</p>
        )}
        {tipo === 'trigger_manual' && (
          <ConfigField label="Etiqueta" value={config.etiqueta || ''} onChange={v => set('etiqueta', v)} placeholder="ex: Início do fluxo" />
        )}
      </div>

      {/* Delete */}
      <div className="px-3 py-3 border-t border-dark-border">
        <button onClick={() => onDelete(node.id)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-status-error hover:bg-status-error/10 transition-colors text-xs font-semibold">
          <X className="w-3.5 h-3.5" /> Remover nó
        </button>
      </div>
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

  const initNodes = useMemo(() => (wf.nodes || []).map(n => {
    const info = findNodeInfo(n.data?.tipo)
    return { ...n, type: 'workflowNode', data: { ...info, ...n.data } }
  }), [])
  const initEdges = useMemo(() => wf.edges || [], [])

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges)
  const [nome, setNome]             = useState(journey.nome)
  const [selectedId, setSelectedId] = useState(null)
  const [dirty, setDirty]           = useState(false)
  const [saving, setSaving]         = useState(false)
  const [addMenuOpen, setAddMenuOpen]   = useState(false)
  const [addMenuGroup, setAddMenuGroup] = useState(null)
  const wrapperRef  = useRef(null)
  const rfInstanceRef = useRef(null)
  const addMenuRef  = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target)) {
        setAddMenuOpen(false)
        setAddMenuGroup(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function addNodeFromMenu(tipo) {
    if (!rfInstanceRef.current || !wrapperRef.current) return
    const bounds = wrapperRef.current.getBoundingClientRect()
    const position = rfInstanceRef.current.project({ x: bounds.width / 2, y: bounds.height / 2 })
    const info = findNodeInfo(tipo)
    setNodes(ns => [...ns, { id: crypto.randomUUID(), type: 'workflowNode', position, data: { ...info, config: {} } }])
    setDirty(true)
    setAddMenuOpen(false)
    setAddMenuGroup(null)
  }

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedId) || null, [nodes, selectedId])

  const onConnect = useCallback(params => {
    setEdges(es => addEdge({ ...params, style: { stroke: '#6366f1', strokeWidth: 2 }, animated: true }, es))
    setDirty(true)
  }, [setEdges])

  const onNodeClick = useCallback((_, node) => setSelectedId(node.id), [])
  const onPaneClick = useCallback(() => setSelectedId(null), [])

  const handleNodesChange = useCallback(changes => {
    onNodesChange(changes)
    if (changes.some(c => c.type !== 'select')) setDirty(true)
  }, [onNodesChange])

  const handleEdgesChange = useCallback(changes => {
    onEdgesChange(changes)
    setDirty(true)
  }, [onEdgesChange])

  function updateNodeData(nodeId, patch) {
    setNodes(ns => ns.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n))
    setDirty(true)
  }

  function deleteNode(nodeId) {
    setNodes(ns => ns.filter(n => n.id !== nodeId))
    setEdges(es => es.filter(e => e.source !== nodeId && e.target !== nodeId))
    setSelectedId(null)
    setDirty(true)
  }

  const handleDrop = useCallback(e => {
    e.preventDefault()
    const tipo = e.dataTransfer.getData('application/workflow-tipo')
    if (!tipo || !rfInstanceRef.current || !wrapperRef.current) return

    const bounds = wrapperRef.current.getBoundingClientRect()
    const position = rfInstanceRef.current.project({
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top,
    })

    const info = findNodeInfo(tipo)
    setNodes(ns => [...ns, {
      id: crypto.randomUUID(),
      type: 'workflowNode',
      position,
      data: { ...info, config: {} },
    }])
    setDirty(true)
  }, [setNodes])

  async function persistWorkflow(newStatus) {
    setSaving(true)
    try {
      const status = newStatus || wf.status || 'rascunho'
      const etapas = {
        status,
        nodes: nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
        edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle, style: e.style, animated: e.animated })),
      }
      await journeyUpdate(journey.id, { nome, etapas })
      setDirty(false)
      toast({ type: 'success', title: newStatus === 'ativa' ? 'Jornada publicada!' : 'Jornada salva!' })
    } catch {
      toast({ type: 'error', title: 'Erro ao salvar jornada' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('Excluir esta jornada? Esta ação não pode ser desfeita.')) return
    try {
      await journeyDelete(journey.id)
      toast({ type: 'success', title: 'Jornada excluída' })
      onBack()
    } catch {
      toast({ type: 'error', title: 'Erro ao excluir jornada' })
    }
  }

  function handleBack() {
    if (dirty && !window.confirm('Sair sem salvar as alterações?')) return
    onBack()
  }

  const currentStatus = wf.status || 'rascunho'

  return (
    <div className="flex flex-col -m-4 md:-m-6" style={{ height: 'calc(100vh - 56px)' }}>
      {/* Editor header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-dark-border bg-dark-surface flex-shrink-0">
        <button onClick={handleBack}
          className="p-1.5 rounded-xl text-dark-muted hover:text-dark-text hover:bg-dark-surface2 transition-all flex-shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <input
          value={nome}
          onChange={e => { setNome(e.target.value); setDirty(true) }}
          className="flex-1 bg-transparent font-bold text-dark-text text-sm focus:outline-none focus:ring-1 focus:ring-brand-accent/50 rounded px-1 min-w-0"
        />
        <StatusBadge status={currentStatus} />
        {dirty && <span className="text-[10px] text-amber-500 font-medium flex-shrink-0">Não salvo</span>}
        <button onClick={() => persistWorkflow()} disabled={saving}
          className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 flex-shrink-0">
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button onClick={handleDelete}
          className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 flex-shrink-0 text-status-error border-status-error/30 hover:bg-status-error/10">
          <Trash2 className="w-3.5 h-3.5" />
          Excluir
        </button>
        <button onClick={() => persistWorkflow('ativa')} disabled={saving}
          className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 flex-shrink-0">
          <Play className="w-3.5 h-3.5" />
          Publicar
        </button>
      </div>

      {/* Editor body */}
      <div className="flex flex-1 overflow-hidden">
        <PainelNos />

        {/* Canvas */}
        <div
          ref={wrapperRef}
          className="flex-1 bg-dark-bg relative"
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
        >
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
            fitView
            deleteKeyCode="Delete"
            defaultEdgeOptions={{ style: { stroke: '#6366f1', strokeWidth: 2 }, animated: true }}
          >
            <Background color="#334155" gap={20} size={1} />
            <Controls className="!bg-dark-surface !border-dark-border !shadow-xl" />
            <MiniMap
              nodeColor={n => findNodeInfo(n.data?.tipo)?.color || '#6366f1'}
              maskColor="rgba(0,0,0,0.6)"
              className="!bg-dark-surface !border-dark-border !rounded-xl"
            />
          </ReactFlow>

          {/* Floating + button */}
          <div ref={addMenuRef} style={{ position: 'absolute', bottom: 80, right: 16, zIndex: 10 }}>
            <button
              onClick={() => { setAddMenuOpen(o => !o); setAddMenuGroup(null) }}
              style={{ width: 40, height: 40, borderRadius: '50%', background: '#1A3A6B', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
            >
              <Plus className="w-5 h-5 text-white" />
            </button>
            {addMenuOpen && (
              <div style={{ position: 'absolute', bottom: 48, right: 0, width: 210, background: 'var(--dark-surface)', border: '1px solid var(--dark-border)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                {addMenuGroup === null ? (
                  NODE_GROUPS.map(group => (
                    <button key={group.label} onClick={() => setAddMenuGroup(group.label)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                      className="hover:bg-dark-surface2 transition-colors">
                      <span style={{ width: 28, height: 28, borderRadius: 6, background: group.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <group.items[0].Icon style={{ color: group.color, width: 14, height: 14 }} />
                      </span>
                      <div>
                        <p style={{ color: group.color, fontWeight: 700, fontSize: 11, margin: 0 }}>{group.label}</p>
                        <p style={{ color: 'var(--dark-muted)', fontSize: 10, margin: 0 }}>{group.items.length} tipos</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <>
                    <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--dark-border)' }}>
                      <button onClick={() => setAddMenuGroup(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dark-muted)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                        ← Voltar
                      </button>
                    </div>
                    {NODE_GROUPS.find(g => g.label === addMenuGroup)?.items.map(item => {
                      const grp = NODE_GROUPS.find(g => g.label === addMenuGroup)
                      return (
                        <button key={item.tipo} onClick={() => addNodeFromMenu(item.tipo)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                          className="hover:bg-dark-surface2 transition-colors">
                          <item.Icon style={{ color: grp?.color, width: 14, height: 14 }} />
                          <span style={{ color: 'var(--dark-text)', fontSize: 12 }}>{item.label}</span>
                        </button>
                      )
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {selectedNode && (
          <PainelConfig
            node={selectedNode}
            onUpdate={updateNodeData}
            onClose={() => setSelectedId(null)}
            onDelete={deleteNode}
          />
        )}
      </div>

      {/* Empty canvas hint */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ left: 224, right: selectedNode ? 288 : 0 }}>
          <div className="text-center">
            <GitBranch className="w-12 h-12 text-dark-muted/20 mx-auto mb-2" />
            <p className="text-sm text-dark-muted/40">Arraste componentes para iniciar</p>
          </div>
        </div>
      )}
    </div>
  )
}

function EditorJornada(props) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  )
}

// ── Journey Card (grid listing) ───────────────────────────────────────────────

function JourneyCard({ journey, leads, onEdit, onDuplicate, onToggle }) {
  const [confirmArquivar, setConfirmArquivar] = useState(false)
  const status   = getStatus(journey)
  const wf       = getWorkflowData(journey)
  const nodesQty = (wf.nodes || []).length
  const vinculados = leads.filter(l => l.jornadaId === journey.id).length

  const CATEGORY_ICONS = { trigger: Zap, action: MoveRight, control: GitBranch }
  const categoryBreakdown = NODE_GROUPS.map(g => ({
    label: g.label, color: g.color,
    count: (wf.nodes || []).filter(n => g.items.some(i => i.tipo === n.data?.tipo)).length,
  })).filter(x => x.count > 0)

  return (
    <div className="card flex flex-col overflow-hidden group hover:border-brand-accent/30 transition-colors">
      {/* Header gradient */}
      <div className="h-1.5 w-full rounded-t-[inherit]" style={{ background: 'linear-gradient(90deg, #6366f1, #8B5CF6)' }} />

      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-brand-accent/10">
            <Map className="w-5 h-5 text-brand-accent" />
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Name + desc */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-dark-text text-sm leading-snug">{journey.nome}</p>
          {journey.descricao && (
            <p className="text-xs text-dark-muted mt-1 line-clamp-2">{journey.descricao}</p>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-dark-muted">
          <span className="flex items-center gap-1">
            <GitBranch className="w-3.5 h-3.5" />
            {nodesQty} {nodesQty === 1 ? 'nó' : 'nós'}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {vinculados} leads
          </span>
        </div>

        {/* Category breakdown */}
        {categoryBreakdown.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {categoryBreakdown.map(c => (
              <span key={c.label} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: c.color + '18', color: c.color }}>
                {c.count} {c.label}
              </span>
            ))}
          </div>
        )}

        {/* Legacy etapas (array) */}
        {Array.isArray(journey.etapas) && journey.etapas.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {journey.etapas.slice(0, 4).map((e, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-md bg-dark-surface2 text-dark-muted border border-dark-border">
                {typeof e === 'string' ? e : (e.nome || String(e))}
              </span>
            ))}
            {journey.etapas.length > 4 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-dark-surface2 text-dark-muted">+{journey.etapas.length - 4}</span>
            )}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-4 py-3 border-t border-dark-border flex items-center gap-1">
        <button onClick={() => onEdit(journey)}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold text-dark-muted hover:text-brand-accent hover:bg-brand-accent/10 transition-colors">
          <Pencil className="w-3.5 h-3.5" /> Editar
        </button>
        <button onClick={() => onDuplicate(journey)}
          className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-dark-muted hover:text-dark-text hover:bg-dark-surface2 transition-colors">
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onToggle(journey)}
          className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors ${
            status === 'ativa'
              ? 'text-amber-500 hover:bg-amber-500/10'
              : 'text-status-success hover:bg-status-success/10'
          }`}>
          {status === 'ativa' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        {confirmArquivar ? (
          <div className="flex items-center gap-1">
            <button onClick={async () => {
              await journeyUpdate(journey.id, { etapas: { ...getWorkflowData(journey), status: 'arquivada' } })
              setConfirmArquivar(false)
            }} className="text-[10px] px-2 py-1 rounded-lg bg-status-error/10 text-status-error font-semibold hover:bg-status-error/20 transition-colors">
              Sim
            </button>
            <button onClick={() => setConfirmArquivar(false)}
              className="text-[10px] px-2 py-1 rounded-lg bg-dark-surface2 text-dark-muted font-semibold hover:bg-dark-surface2/80 transition-colors">
              Não
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmArquivar(true)}
            className="flex items-center justify-center px-2 py-1.5 rounded-lg text-xs text-dark-muted/60 hover:text-status-error hover:bg-status-error/10 transition-colors">
            <X className="w-3.5 h-3.5" />
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
                    form.tipoCliente === t
                      ? 'bg-brand-accent text-white border-brand-accent'
                      : 'border-dark-border text-dark-muted hover:border-brand-accent/50'
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
            <Select
              value={form.tipo}
              onChange={v => set('tipo', v)}
              options={['Abordagem', 'Follow Up', 'Proposta', 'Fechamento', 'Objeção']}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Conteúdo *</label>
            <textarea value={form.conteudo} onChange={e => set('conteudo', e.target.value)} rows={5} className="input w-full resize-none"
              placeholder="Olá {nome}, ..." />
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

  // If editor is open, render editor
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
      {/* Modals */}
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
        <>
          {visibleJourneys.length === 0 ? (
            <div className="text-center py-16 text-dark-muted">
              <Map className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma jornada cadastrada</p>
              <button onClick={() => setModal('Jornadas')} className="mt-3 btn-secondary text-xs">
                <Plus className="w-3.5 h-3.5 inline mr-1" /> Criar primeira jornada
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
          )}

          {/* Tags */}
          {state.tags.length > 0 && (
            <div className="glass-panel p-4">
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-4 h-4 text-dark-muted" />
                <p className="text-sm font-semibold text-dark-text">Etiquetas Disponíveis</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {state.tags.map(t => (
                  <span key={t.id} className="px-2 py-1 rounded-lg text-xs font-semibold"
                    style={{ background: t.cor + '22', color: t.cor, border: `1px solid ${t.cor}44` }}>
                    {t.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
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

