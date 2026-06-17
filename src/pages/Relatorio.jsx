import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from '@dnd-kit/core'
import {
  fetchAnosRelatorio,
  fetchMesesRelatorio,
  fetchFichasRelatorio,
  PRODUTO_LABELS,
} from '../lib/fichas'
import { registrarApoliceDaFicha } from '../lib/apolices'
import { supabase } from '../lib/supabase'
import { useImobiliaria } from '../hooks/useImobiliaria'
import ImobiliariaSelect from '../components/ImobiliariaSelect'
import { Select } from '../components/ui/Select'
import { DatePicker } from '../components/ui/DatePicker'
import { useToast } from '../contexts/ToastContext'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { BarChart2, GripVertical } from 'lucide-react'
import { PageHeader, MetricCard, DataCard } from '../components/ui'
import { kanbanPointerCollision, KANBAN_DRAG_OVERLAY_MODIFIERS } from '../lib/kanbanDnd'
import { normalizeDisplayText } from '../lib/text'
import SeguradoraSelect from '../components/SeguradoraSelect'

const MESES_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const COLUNAS = [
  { id: 'aprovada', label: 'Aprovada', color: '#0f766e' },
  { id: 'emitida', label: 'Emitida', color: '#000079' },
  { id: 'enviado_cobranca', label: 'Enviado Cobrança', color: '#2247aa' },
  { id: 'recuperados', label: 'RECUPERADOS (emitidas)', color: '#4b6cc2' },
  { id: 'desistiu', label: 'Desistiu da Locação', color: '#a2d6da' },
  { id: 'expirada', label: 'Expirada', color: '#6B7280' },
]

const COLUNA_TO_UPDATE = {
  aprovada: { status: 'aprovado', retorno_enviado: false },
  emitida: { status: 'emitido', retorno_enviado: false },
  enviado_cobranca: { status: 'emitido', retorno_enviado: true },
  recuperados: { status: 'emitido', retorno_enviado: true },
  desistiu: { status: 'cancelado', retorno_enviado: false },
  expirada: { status: 'expirada', retorno_enviado: false },
}

const PRODUTO_COLOR = {
  residencial_pf: '#000079',
  comercial_pf: '#0f766e',
  pessoa_juridica: '#7fbec4',
}

function getColuna(ficha) {
  if (ficha.status === 'aprovado') return 'aprovada'
  if (ficha.status === 'emitido' && ficha.numero_apolice) return 'recuperados'
  if (ficha.status === 'emitido' && ficha.retorno_enviado && !ficha.numero_apolice) return 'enviado_cobranca'
  if (ficha.status === 'emitido' && !ficha.retorno_enviado && !ficha.numero_apolice) return 'emitida'
  if (ficha.status === 'cancelado') return 'desistiu'
  if (ficha.status === 'expirada') return 'expirada'
  return null
}

function maskCpf(cpf) {
  if (!cpf) return null
  const d = cpf.replace(/\D/g, '')
  if (d.length === 11) return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`
  return cpf
}

function maskCnpj(cnpj) {
  if (!cnpj) return null
  const d = cnpj.replace(/\D/g, '')
  if (d.length === 14) return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/****-**`
  return cnpj
}

function docMask(ficha) {
  return ficha.produto === 'pessoa_juridica' ? maskCnpj(ficha.cnpj) : maskCpf(ficha.cpf)
}

function nomePrincipal(ficha) {
  return ficha.produto === 'pessoa_juridica'
    ? (normalizeDisplayText(ficha.nome_empresa || ficha.nome_interessado) || '—')
    : (normalizeDisplayText(ficha.nome_interessado) || '—')
}

function stringColor(str) {
  const c = ['#000079', '#0f766e', '#a2d6da', '#4b6cc2', '#c3f0f2', '#dcffff', '#2247aa']
  let h = 0
  for (let i = 0; i < (str || '').length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return c[Math.abs(h) % c.length]
}

function initials(n) {
  return (n || '').split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase() || ''
}

function RelatorioCard({ ficha, onClick, dragListeners, dragAttributes, isDragOverlay = false }) {
  const prodColor = PRODUTO_COLOR[ficha.produto] || '#6B7280'
  const doc = docMask(ficha)
  const nome = nomePrincipal(ficha)
  const orc = ficha.orcamentista_forms
  const imobiliaria = ficha.imobiliaria || 'Imobili?ria n?o informada'

  return (
    <div
      className={`kanban-card${isDragOverlay ? ' kanban-card-dragging' : ''}`}
      style={{ '--kanban-accent': prodColor }}
      onClick={onClick}
    >
      {!isDragOverlay && dragListeners && dragAttributes && (
        <button
          {...dragListeners}
          {...dragAttributes}
          type="button"
          className="kanban-grip"
          onClick={e => e.stopPropagation()}
          aria-label="Arrastar ficha"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      )}
      <div className="kanban-card-body">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span
            className="inline-flex rounded-full px-2 py-1 text-[10px] font-semibold"
            style={{ background: `${prodColor}20`, color: prodColor }}
          >
            {PRODUTO_LABELS[ficha.produto] || ficha.produto}
          </span>
          <span className="text-[10px] text-dark-muted font-mono">
            {format(parseISO(ficha.created_at), 'dd/MM', { locale: ptBR })}
          </span>
        </div>

        <div className="space-y-1.5">
          <p className="text-[12.5px] font-semibold leading-snug text-dark-text">{nome}</p>
          <p className="text-[10px] uppercase tracking-[0.14em] text-dark-muted">{imobiliaria}</p>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {doc && (
            <span className="rounded-full border border-dark-border/60 bg-dark-surface2/70 px-2 py-1 text-[10px] font-mono text-dark-muted">
              {doc}
            </span>
          )}

          {ficha.numero_apolice && (
            <span
              className="rounded-full px-2 py-1 text-[10px] font-mono"
              style={{ background: '#2247aa15', color: '#2247aa' }}
            >
            Apólice: {ficha.numero_apolice}
            </span>
        )}

        </div>

        {orc && (
          <div className="mt-3 flex items-center gap-1.5 border-t border-dark-border/50 pt-2">
            <div
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
              style={{ background: stringColor(orc) }}
            >
              {initials(orc)}
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Orcamentista</p>
              <p className="truncate text-[10px] text-dark-text">{orc}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DraggableRelatorioCard({ ficha, onFichaClick }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: ficha.id })

  return (
    <div
      ref={setNodeRef}
      onClick={() => onFichaClick(ficha.id)}
      style={{ opacity: isDragging ? 0.35 : 1, cursor: 'default', touchAction: 'none' }}
    >
      <RelatorioCard ficha={ficha} onClick={() => {}} dragListeners={listeners} dragAttributes={attributes} />
    </div>
  )
}

function KanbanColuna({ coluna, fichas, onFichaClick, colIndex }) {
  const { isOver, setNodeRef } = useDroppable({ id: coluna.id })

  return (
    <div
      className="kanban-col animate-fade-in flex flex-col"
      style={{ animationDelay: `${colIndex * 40}ms`, animationFillMode: 'both' }}
    >
      <div
        className="kanban-col-header flex items-center justify-between flex-shrink-0"
        style={{ background: `${coluna.color}18`, borderColor: `${coluna.color}50` }}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: coluna.color }} />
          <span className="text-[11px] font-semibold" style={{ color: coluna.color }}>{coluna.label}</span>
        </div>
        <span
          className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
          style={{ background: `${coluna.color}25`, color: coluna.color }}
        >
          {fichas.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className="kanban-col-body flex-1 p-1.5 space-y-1.5 overflow-y-auto transition-colors duration-150"
        style={{
          borderColor: isOver ? `${coluna.color}80` : 'rgb(var(--color-border))',
          backgroundColor: isOver ? `${coluna.color}08` : 'rgb(var(--color-surface2) / 0.4)',
          boxShadow: isOver ? `inset 0 0 0 2px ${coluna.color}40` : 'none',
        }}
      >
        {fichas.length === 0 ? (
          <div className="kanban-empty">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="kanban-empty-icon">
              <rect x="3" y="3" width="18" height="18" rx="3" strokeDasharray="4 2" />
            </svg>
            <span className="kanban-empty-text">Vazia</span>
          </div>
        ) : (
          fichas.map(f => <DraggableRelatorioCard key={f.id} ficha={f} onFichaClick={onFichaClick} />)
        )}
      </div>
    </div>
  )
}

function MesPicker({ mes, mesesDisp, onMes }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {MESES_ABBR.map((label, i) => {
        const m = i + 1
        const has = mesesDisp.includes(m)
        const active = mes === m
        return (
          <button
            key={m}
            onClick={() => has && onMes(m)}
            disabled={!has}
            title={!has ? 'Sem fichas neste mês' : MESES_FULL[i]}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              active
                ? 'bg-brand-secondary text-white shadow-sm'
                : has
                  ? 'text-dark-text hover:bg-dark-surface2'
                  : 'text-dark-muted/35 cursor-not-allowed'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function ModalEmitirApolice({ ficha, salvando, onCancelar, onConfirmar }) {
  const [numeroApolice, setNumeroApolice] = useState(ficha.numero_apolice || '')
  const [seguradora, setSeguradora] = useState(ficha.seguradora || '')
  const [dataEmissao, setDataEmissao] = useState(ficha.data_emissao || new Date().toISOString().slice(0, 10))
  const [inicioVigencia, setInicioVigencia] = useState('')
  const [fimVigencia, setFimVigencia] = useState('')
  const [valorParcela, setValorParcela] = useState(ficha.valor_aluguel ? String(ficha.valor_aluguel) : '')
  const [observacoes, setObservacoes] = useState(ficha.observacoes || '')

  const valido = numeroApolice.trim() && seguradora && dataEmissao && inicioVigencia && fimVigencia && valorParcela

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 animate-fade-in">
      <div className="modal-backdrop" onClick={!salvando ? onCancelar : undefined} />
      <div className="relative glass-modal w-full max-w-2xl overflow-hidden border border-dark-border">
        <div className="px-6 py-4 border-b border-dark-border flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Emissão pelo relatório mensal</p>
            <h3 className="mt-1 text-lg font-semibold text-dark-text">
              {normalizeDisplayText(ficha.nome_interessado || ficha.nome_empresa) || 'Ficha selecionada'}
            </h3>
          </div>
          <button onClick={onCancelar} className="text-dark-muted hover:text-dark-text" disabled={salvando}>×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Número da apólice *</span>
              <input className="input" value={numeroApolice} onChange={e => setNumeroApolice(e.target.value)} placeholder="000000000" />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Data de emissão *</span>
              <DatePicker value={dataEmissao} onChange={setDataEmissao} className="w-full" />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Seguradora *</span>
              <SeguradoraSelect value={seguradora} onChange={setSeguradora} produto={ficha.produto} required />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Início da vigência *</span>
              <DatePicker value={inicioVigencia} onChange={setInicioVigencia} className="w-full" />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Fim da vigência *</span>
              <DatePicker value={fimVigencia} onChange={setFimVigencia} className="w-full" />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Valor da parcela *</span>
              <input type="number" step="0.01" min="0" className="input" value={valorParcela} onChange={e => setValorParcela(e.target.value)} placeholder="0,00" />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Observações</span>
              <textarea className="input min-h-[100px] resize-y" value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Opcional" />
            </label>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-dark-border flex items-center justify-end gap-3">
          <button onClick={onCancelar} className="btn-secondary" disabled={salvando}>Cancelar</button>
          <button
            onClick={() => valido && onConfirmar({
              numeroApolice,
              seguradora,
              dataEmissao,
              inicioVigencia,
              fimVigencia,
              valorParcela: parseFloat(valorParcela),
              observacoes,
            })}
            disabled={!valido || salvando}
            className="btn-primary"
          >
            {salvando ? 'Salvando...' : 'Confirmar emissão'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Relatorio() {
  const navigate = useNavigate()
  const { getAliases } = useImobiliaria()
  const agora = new Date()
  const toast = useToast()

  const [ano, setAno] = useState(agora.getFullYear())
  const [mes, setMes] = useState(agora.getMonth() + 1)
  const [imobiliaria, setImobiliaria] = useState('')
  const [anos, setAnos] = useState([agora.getFullYear()])
  const [mesesDisp, setMesesDisp] = useState([agora.getMonth() + 1])
  const [fichas, setFichas] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [pendingEmissao, setPendingEmissao] = useState(null)
  const [salvandoEmissao, setSalvandoEmissao] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const scrollRef = useRef(null)
  const [canScrollL, setCanScrollL] = useState(false)
  const [canScrollR, setCanScrollR] = useState(false)

  useEffect(() => {
    fetchAnosRelatorio().then(years => {
      if (!years.length) return
      setAnos(years)
      if (!years.includes(agora.getFullYear())) setAno(years[0])
    })
  }, [])

  useEffect(() => {
    fetchMesesRelatorio(ano).then(meses => {
      setMesesDisp(meses)
      if (meses.length && !meses.includes(mes)) setMes(meses[meses.length - 1])
    })
  }, [ano])

  const getAliasesRef = useRef(getAliases)
  getAliasesRef.current = getAliases

  const carregarFichas = useCallback(async () => {
    setLoading(true)
    let aliases = null
    if (imobiliaria) {
      aliases = await getAliasesRef.current(imobiliaria)
      if (!aliases.length) aliases = [imobiliaria]
    }
    const data = await fetchFichasRelatorio(ano, mes, aliases)
    setFichas(data)
    setLoading(false)
  }, [ano, mes, imobiliaria])

  useEffect(() => {
    carregarFichas()
  }, [carregarFichas])

  function checkScroll() {
    const el = scrollRef.current
    if (!el) return
    setCanScrollL(el.scrollLeft > 5)
    setCanScrollR(el.scrollLeft < el.scrollWidth - el.clientWidth - 5)
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll, { passive: true })
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      ro.disconnect()
    }
  }, [loading, imobiliaria])

  async function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over) return
    const fichaId = active.id
    const targetCol = over.id
    const ficha = fichas.find(f => f.id === fichaId)
    if (!ficha) return
    const sourceCol = getColuna(ficha)
    if (sourceCol === targetCol) return
    const update = COLUNA_TO_UPDATE[targetCol]
    if (!update) return

    if (targetCol === 'emitida') {
      setPendingEmissao({ fichaId, ficha })
      return
    }

    setFichas(prev => prev.map(f => {
      if (f.id !== fichaId) return f
      return { ...f, status: update.status, retorno_enviado: update.retorno_enviado }
    }))

    const { error } = await supabase.from('fichas').update({
      status: update.status,
      retorno_enviado: update.retorno_enviado,
    }).eq('id', fichaId)

    if (error) {
      toast({ type: 'error', title: 'Erro ao mover ficha' })
      carregarFichas()
    } else {
      toast({ type: 'success', title: 'Ficha movida' })
    }
  }

  async function handleConfirmarEmissao(payload) {
    if (!pendingEmissao) return
    setSalvandoEmissao(true)
    const { error } = await registrarApoliceDaFicha({
      ficha: pendingEmissao.ficha,
      numeroApolice: payload.numeroApolice,
      seguradora: payload.seguradora,
      dataEmissao: payload.dataEmissao,
      inicioVigencia: payload.inicioVigencia,
      fimVigencia: payload.fimVigencia,
      valorParcela: payload.valorParcela,
      observacoes: payload.observacoes,
    })
    setSalvandoEmissao(false)
    if (error) {
      toast({ type: 'error', title: 'Erro ao registrar emissão', message: error.message })
      setPendingEmissao(null)
      carregarFichas()
      return
    }
    toast({ type: 'success', title: 'Emissão registrada' })
    setPendingEmissao(null)
    carregarFichas()
  }

  const colunaMap = Object.fromEntries(COLUNAS.map(c => [c.id, []]))
  fichas.forEach(f => {
    const col = getColuna(f)
    if (col && colunaMap[col]) colunaMap[col].push(f)
  })

  const activeFicha = activeId ? fichas.find(f => f.id === activeId) : null
  const totalAprovadas = fichas.filter(f => f.status === 'aprovado' || f.status === 'emitido').length
  const totalEmitidas = fichas.filter(f => f.status === 'emitido').length
  const totalRecuperados = fichas.filter(f => f.status === 'emitido' && f.numero_apolice).length
  const taxaRecuperacao = totalAprovadas > 0 ? ((totalRecuperados / totalAprovadas) * 100).toFixed(1) : '0.0'
  const desistiram = fichas.filter(f => f.status === 'cancelado').length
  const pendentesEmissao = fichas.filter(f => f.status === 'aprovado').length

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        eyebrow="Relatório operacional"
        title="Relatório por Imobiliária"
        description="Fichas finalizadas filtradas por imobiliária e período, com fluxo Kanban preservado."
        actions={
          <div style={{ minWidth: '220px' }}>
            <ImobiliariaSelect value={imobiliaria} onChange={setImobiliaria} />
          </div>
        }
      />

      <DataCard title="Filtros" description="Ano, mês e imobiliária controlam o recorte mensal exibido abaixo." className="space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <Select
            value={String(ano)}
            onChange={v => {
              setAno(Number(v))
              setImobiliaria('')
            }}
            options={anos.map(a => ({ value: String(a), label: String(a) }))}
            className="w-24"
          />

          <MesPicker
            mes={mes}
            mesesDisp={mesesDisp}
            onMes={m => {
              setMes(m)
              setImobiliaria('')
            }}
          />
        </div>

        <p className="text-xs text-dark-muted">
          <span className="font-medium text-dark-text">{imobiliaria || 'Todas as imobiliárias'}</span>
          {' '}· {MESES_FULL[mes - 1]} {ano}
        </p>
      </DataCard>

      {loading ? (
        <div className="flex items-center justify-center h-48 gap-2 text-dark-muted text-sm">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Carregando fichas...
        </div>
      ) : fichas.length === 0 ? (
        <DataCard className="py-16 text-center">
          <div className="flex flex-col items-center justify-center gap-2 text-dark-muted">
            <BarChart2 className="w-8 h-8 opacity-30" />
            <p className="text-sm">
              Nenhuma ficha encontrada para {imobiliaria || 'todas as imobiliárias'} em {MESES_FULL[mes - 1]} {ano}
            </p>
          </div>
        </DataCard>
      ) : (
        <div className="space-y-4">
          <DataCard title="Indicadores" description="Resumo do recorte selecionado." className="overflow-hidden">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              <MetricCard label="Total no período" value={fichas.length} />
              <MetricCard label="Aprovadas" value={totalAprovadas} />
              <MetricCard label="Aguardando emissão" value={pendentesEmissao} />
              <MetricCard label="Apólices emitidas" value={totalEmitidas} />
              <MetricCard label="Recuperados" value={totalRecuperados} />
              <MetricCard label="Taxa recuperação" value={`${taxaRecuperacao}%`} />
            </div>
            <p className="mt-3 text-xs text-dark-muted">
              {desistiram} ficha{desistiram !== 1 ? 's' : ''} desistiram no período.
            </p>
          </DataCard>

          <DataCard title="Kanban mensal" description="Arraste fichas entre colunas para atualizar o status." className="relative overflow-hidden">
            {canScrollL && (
              <div
                className="absolute left-0 top-0 bottom-4 w-12 z-10 pointer-events-none"
                style={{ background: 'linear-gradient(to right, rgb(var(--color-bg)), transparent)' }}
              />
            )}
            {canScrollR && (
              <div
                className="absolute right-0 top-0 bottom-4 w-12 z-10 pointer-events-none"
                style={{ background: 'linear-gradient(to left, rgb(var(--color-bg)), transparent)' }}
              />
            )}

            <DndContext
              sensors={sensors}
              collisionDetection={kanbanPointerCollision}
              onDragStart={({ active }) => setActiveId(active.id)}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveId(null)}
            >
              <div ref={scrollRef} className="kanban-scroll overflow-x-auto pb-4">
                <div className="flex gap-3 min-w-max px-1">
                  {COLUNAS.map((col, i) => (
                    <KanbanColuna
                      key={col.id}
                      coluna={col}
                      fichas={colunaMap[col.id] || []}
                      onFichaClick={id => navigate(`/fichas/${id}`)}
                      colIndex={i}
                    />
                  ))}
                </div>
              </div>

              <DragOverlay dropAnimation={null} modifiers={KANBAN_DRAG_OVERLAY_MODIFIERS}>
                {activeFicha && (
                  <div style={{ width: 'var(--kanban-col-w, 286px)', pointerEvents: 'none' }}>
                    <RelatorioCard ficha={activeFicha} onClick={() => {}} isDragOverlay />
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          </DataCard>
        </div>
      )}
      {pendingEmissao && (
        <ModalEmitirApolice
          ficha={pendingEmissao.ficha}
          salvando={salvandoEmissao}
          onCancelar={() => !salvandoEmissao && setPendingEmissao(null)}
          onConfirmar={handleConfirmarEmissao}
        />
      )}
    </div>
  )
}



