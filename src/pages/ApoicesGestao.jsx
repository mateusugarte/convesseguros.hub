import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from '@dnd-kit/core'
import {
  fetchApolicesKanban, criarApolice, moverStatusApolice,
  buscarFichasParaEmissao,
  STATUS_EMISSAO_LABELS, SEGURADORAS_APOLICE, FORMA_PAGAMENTO_LABELS,
} from '../lib/apolices'
import { useImobiliaria } from '../hooks/useImobiliaria'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { PRODUTO_LABELS } from '../lib/fichas'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Plus, ChevronLeft, ChevronRight, RefreshCw,
  Search, Home, Briefcase, Building, LayoutGrid, X, Check,
} from 'lucide-react'
import SeguradoraBadge from '../components/SeguradoraBadge'
import SeguradoraSelect from '../components/SeguradoraSelect'
import ImobiliariaSelect from '../components/ImobiliariaSelect'
import { KanbanSkeleton } from '../components/Skeleton'

// ── Constantes ────────────────────────────────────────────────────────────────

const COLUNAS = [
  { id: 'recebida',             label: 'Recebida',             color: '#3B82F6' },
  { id: 'proposta_transmitida', label: 'Proposta Transmitida', color: '#F59E0B' },
  { id: 'emitida',              label: 'Apólice Emitida',      color: '#8B5CF6' },
  { id: 'enviada',              label: 'Apólice Enviada',      color: '#10B981' },
]

const PRODUTO_ICON = { residencial_pf: Home, comercial_pf: Briefcase, pessoa_juridica: Building }
const PRODUTO_COLOR = { residencial_pf: '#4A90D9', comercial_pf: '#10B981', pessoa_juridica: '#8B5CF6' }

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

// ── Helpers nomes ─────────────────────────────────────────────────────────────

function nomeApolice(apolice) {
  return apolice.fichas?.nome_empresa
      || apolice.fichas?.nome_interessado
      || apolice.nome_interessado
      || '—'
}

function produtoApolice(apolice) {
  return apolice.fichas?.produto || apolice.produto
}

// ── Card ──────────────────────────────────────────────────────────────────────

function ApoliceCard({ apolice, isDragOverlay = false, resolverNome }) {
  const [expandido, setExpandido] = useState(false)

  const prod     = produtoApolice(apolice)
  const ProdIcon = PRODUTO_ICON[prod] || LayoutGrid
  const pColor   = PRODUTO_COLOR[prod] || '#6B7280'

  const dataTransm = apolice.data_transmissao
    ? (() => { try { return format(parseISO(apolice.data_transmissao), 'dd/MM/yyyy', { locale: ptBR }) } catch { return null } })()
    : null

  return (
    <div className={`kanban-card ${isDragOverlay ? 'scale-[1.04] rotate-1 !shadow-lg' : ''}`}>
      <div className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: pColor + '20', color: pColor }}>
          <ProdIcon className="w-2.5 h-2.5" strokeWidth={2} />
          {PRODUTO_LABELS[prod] || prod || '—'}
        </span>
        <span className="text-[10px] text-dark-muted font-mono">
          {apolice.created_at ? (() => { try { return format(parseISO(apolice.created_at), 'dd/MM', { locale: ptBR }) } catch { return '' } })() : ''}
        </span>
      </div>

      <p className="text-[11px] font-semibold text-dark-text leading-tight truncate">
        {nomeApolice(apolice)}
      </p>

      <p className="text-[10px] text-dark-muted truncate">
        {resolverNome ? resolverNome(apolice.imobiliaria) : (apolice.imobiliaria || '—')}
      </p>

      {apolice.numero_apolice && (
        <p className="text-[10px] font-mono" style={{ color: '#2B5BA8' }}>
          Apólice: {apolice.numero_apolice}
        </p>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-dark-border/50 gap-1">
        {apolice.seguradora
          ? <SeguradoraBadge nome={apolice.seguradora} size="xs" />
          : <span />
        }
        {dataTransm && (
          <span className="text-[9px] text-status-success font-mono flex-shrink-0">
            {dataTransm}
          </span>
        )}
      </div>

      {/* Emissor */}
      {apolice.profiles?.nome && (
        <p className="text-[9px] text-dark-muted truncate">
          Emissor: {apolice.profiles.nome.split(' ')[0]}
        </p>
      )}

      {/* Botão expandir (M2) */}
      {!isDragOverlay && (
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); setExpandido(v => !v) }}
          className="w-full text-[9px] text-dark-muted hover:text-dark-text transition-colors pt-1 border-t border-dark-border/50 flex items-center justify-center gap-1"
        >
          {expandido ? '▲ Menos' : '▼ Detalhes'}
        </button>
      )}

      {/* Seção expansível */}
      {expandido && !isDragOverlay && (
        <div className="space-y-0.5 pt-1 animate-fade-in">
          {(apolice.fichas?.cpf || apolice.fichas?.cnpj) && (
            <p className="text-[9px] text-dark-muted font-mono">
              {apolice.fichas.cnpj ? 'CNPJ' : 'CPF'}: {apolice.fichas.cnpj || apolice.fichas.cpf}
            </p>
          )}
          {apolice.fichas?.celular && (
            <p className="text-[9px] text-dark-muted">Tel: {apolice.fichas.celular}</p>
          )}
          {apolice.fichas?.tipo_imovel && (
            <p className="text-[9px] text-dark-muted">Imóvel: {apolice.fichas.tipo_imovel}</p>
          )}
          {apolice.fichas?.cep && (
            <p className="text-[9px] text-dark-muted font-mono">CEP: {apolice.fichas.cep}</p>
          )}
          {apolice.valor_parcela && (
            <p className="text-[9px] text-dark-muted">
              Parcela: R$ {parseFloat(apolice.valor_parcela).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── DraggableCard ─────────────────────────────────────────────────────────────

function DraggableCard({ apolice, onDetalhe, resolverNome }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: apolice.id })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
         onClick={() => onDetalhe(apolice.id)}
         style={{ opacity: isDragging ? 0.35 : 1, cursor: 'grab' }}>
      <ApoliceCard apolice={apolice} resolverNome={resolverNome} />
    </div>
  )
}

// ── Column ────────────────────────────────────────────────────────────────────

function DroppableColumn({ col, apolices, onDetalhe, resolverNome, colIndex }) {
  const { isOver, setNodeRef } = useDroppable({ id: col.id })
  const anim = { animationDelay: `${colIndex * 30}ms`, animationFillMode: 'both', scrollSnapAlign: 'start' }

  return (
    <div className="kanban-col animate-fade-in flex flex-col flex-shrink-0" style={anim}>
      <div className="flex items-center justify-between px-2.5 py-2 rounded-t-xl border border-b-0 transition-colors"
           style={{ background: col.color + '18', borderColor: col.color + '50' }}>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: col.color }} />
          <span className="text-[11px] font-semibold" style={{ color: col.color }}>{col.label}</span>
        </div>
        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
              style={{ background: col.color + '25', color: col.color }}>
          {apolices.length}
        </span>
      </div>

      <div ref={setNodeRef}
           className="kanban-col-body flex-1 space-y-1.5 p-1.5 rounded-b-xl border overflow-y-auto transition-colors duration-150"
           style={{
             borderColor:     isOver ? col.color + '80' : 'rgb(var(--color-border))',
             backgroundColor: isOver ? col.color + '08' : 'rgb(var(--color-surface2) / 0.4)',
             boxShadow:       isOver ? `inset 0 0 0 2px ${col.color}40` : 'none',
           }}>
        {apolices.length === 0 ? (
          <div className="kanban-empty">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="kanban-empty-icon">
              <rect x="3" y="3" width="18" height="18" rx="3" strokeDasharray="4 2"/>
            </svg>
            <span className="kanban-empty-text">Vazia</span>
          </div>
        ) : apolices.map(a => (
          <DraggableCard key={a.id} apolice={a} onDetalhe={onDetalhe} resolverNome={resolverNome} />
        ))}
      </div>
    </div>
  )
}

// ── Modal Iniciar Emissão ─────────────────────────────────────────────────────

function ModalIniciarEmissao({ onClose, onCriado, toast }) {
  const { getAliases } = useImobiliaria()
  const { user } = useAuth()
  const [imobFiltro,        setImobFiltro]        = useState('')
  const [busca,             setBusca]             = useState('')
  const [fichasEncontradas, setFichasEncontradas] = useState([])
  const [fichaSelecionada,  setFichaSelecionada]  = useState(null)
  const [buscando,          setBuscando]          = useState(false)
  const [criando,           setCriando]           = useState(false)

  // Campos adicionais preenchidos ao iniciar emissão
  const [numeroOrcamento, setNumeroOrcamento] = useState('')
  const [endereco,        setEndereco]        = useState('')
  const [valorParcela,    setValorParcela]    = useState('')

  useEffect(() => {
    if (!busca.trim() && !imobFiltro) { setFichasEncontradas([]); return }
    const t = setTimeout(async () => {
      setBuscando(true)
      let aliasesFilter
      if (imobFiltro) {
        aliasesFilter = await getAliases(imobFiltro)
        if (!aliasesFilter.length) aliasesFilter = [imobFiltro]
      }
      const data = await buscarFichasParaEmissao(busca, aliasesFilter)
      setFichasEncontradas(data)
      setBuscando(false)
    }, 300)
    return () => clearTimeout(t)
  }, [busca, imobFiltro, getAliases])

  function selecionarFicha(f) {
    setFichaSelecionada(f)
    // Pré-preenche endereço com CEP da ficha
    setEndereco(f.cep || '')
    // Pré-preenche número do orçamento com número da apólice da ficha (se houver)
    setNumeroOrcamento(f.numero_apolice || '')
  }

  async function criar() {
    if (!fichaSelecionada) return
    setCriando(true)
    const { error } = await criarApolice({
      ficha_id:         fichaSelecionada.id,
      imobiliaria:      fichaSelecionada.imobiliaria,
      produto:          fichaSelecionada.produto,
      status_emissao:   'recebida',
      valor_aluguel:    fichaSelecionada.valor_aluguel,
      nome_interessado: fichaSelecionada.nome_empresa || fichaSelecionada.nome_interessado,
      // Campos preenchidos no modal
      numero_proposta:  numeroOrcamento.trim() || null,
      valor_parcela:    valorParcela.trim() || null,
      endereco:         endereco.trim() || null,
      // Emissor: usuário logado que iniciou a emissão
      emitido_por:      user?.id || null,
      // Defaults obrigatórios no banco enquanto migração 09 não for rodada
      numero_apolice:   '',
      seguradora:       'Outras',
      data_emissao:     new Date().toISOString().slice(0, 10),
    })
    setCriando(false)
    if (error) { toast({ type: 'error', title: 'Erro ao criar', message: error.message }); return }
    toast({ type: 'success', title: 'Emissão iniciada!' })
    onCriado()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-dark-surface border border-dark-border rounded-2xl shadow-2xl w-full max-w-lg my-4">

        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border">
          <h2 className="font-bold text-dark-text">Iniciar Emissão</h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">Imobiliária</label>
            <ImobiliariaSelect value={imobFiltro} onChange={setImobFiltro} />
          </div>

          <div>
            <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">Buscar locatário</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Nome do locatário..."
                className="input pl-9"
                disabled={!!fichaSelecionada}
              />
            </div>
          </div>

          {fichaSelecionada ? (
            <>
              {/* Dados da ficha selecionada */}
              <div className="rounded-xl bg-status-success/10 border border-status-success/25 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-status-success/20">
                  <p className="text-sm font-semibold text-dark-text truncate">
                    {fichaSelecionada.nome_empresa || fichaSelecionada.nome_interessado}
                  </p>
                  <button
                    onClick={() => { setFichaSelecionada(null); setNumeroOrcamento(''); setEndereco(''); setValorParcela('') }}
                    className="flex-shrink-0 ml-2 text-dark-muted hover:text-dark-text"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="px-3 py-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <div>
                    <span className="text-dark-muted">Imobiliária</span>
                    <p className="text-dark-text font-medium truncate">{fichaSelecionada.imobiliaria || '—'}</p>
                  </div>
                  <div>
                    <span className="text-dark-muted">Aluguel</span>
                    <p className="text-dark-text font-medium">
                      {fichaSelecionada.valor_aluguel ? `R$ ${fichaSelecionada.valor_aluguel}` : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-dark-muted">{fichaSelecionada.cnpj ? 'CNPJ' : 'CPF'}</span>
                    <p className="text-dark-text font-mono">{fichaSelecionada.cnpj || fichaSelecionada.cpf || '—'}</p>
                  </div>
                  <div>
                    <span className="text-dark-muted">Celular</span>
                    <p className="text-dark-text">{fichaSelecionada.celular || '—'}</p>
                  </div>
                  <div>
                    <span className="text-dark-muted">Tipo de Imóvel</span>
                    <p className="text-dark-text">{fichaSelecionada.tipo_imovel || '—'}</p>
                  </div>
                  <div>
                    <span className="text-dark-muted">Produto</span>
                    <p className="text-dark-text">{PRODUTO_LABELS[fichaSelecionada.produto] || fichaSelecionada.produto || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Campos adicionais da emissão */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider">Dados da Emissão</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1">
                      N° do Orçamento
                    </label>
                    <input
                      value={numeroOrcamento}
                      onChange={e => setNumeroOrcamento(e.target.value)}
                      placeholder="Ex: 12345"
                      className="input text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1">
                      Valor da Parcela (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={valorParcela}
                      onChange={e => setValorParcela(e.target.value)}
                      placeholder="0,00"
                      className="input text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1">
                      Endereço do Imóvel
                    </label>
                    <input
                      value={endereco}
                      onChange={e => setEndereco(e.target.value)}
                      placeholder="Rua, número, bairro, cidade"
                      className="input text-sm"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-1">
              {buscando ? (
                <p className="text-xs text-dark-muted text-center py-4">Buscando...</p>
              ) : fichasEncontradas.length === 0 && (busca.trim() || imobFiltro) ? (
                <p className="text-xs text-dark-muted text-center py-4">Nenhuma ficha encontrada</p>
              ) : fichasEncontradas.map(f => (
                <button
                  key={f.id}
                  onClick={() => selecionarFicha(f)}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-dark-surface2 transition-colors border border-transparent hover:border-dark-border"
                >
                  <p className="text-sm font-medium text-dark-text truncate">
                    {f.nome_empresa || f.nome_interessado}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-dark-muted font-mono">{f.cpf || f.cnpj || '—'}</span>
                    <span className="text-[10px] text-dark-muted">·</span>
                    <span className="text-[10px] text-dark-muted truncate">{f.imobiliaria}</span>
                  </div>
                  {(f.numero_apolice || f.cep) && (
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {f.numero_apolice && (
                        <span className="text-[10px] font-mono font-semibold" style={{ color: '#2B5BA8' }}>
                          Orç: {f.numero_apolice}
                        </span>
                      )}
                      {f.numero_apolice && f.cep && <span className="text-[10px] text-dark-muted">·</span>}
                      {f.cep && (
                        <span className="text-[10px] text-dark-muted font-mono">CEP: {f.cep}</span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-dark-border">
          <button onClick={onClose} className="btn-secondary text-sm">Cancelar</button>
          <button onClick={criar} disabled={!fichaSelecionada || criando} className="btn-primary text-sm">
            {criando ? 'Criando...' : 'Criar Solicitação'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Finalizar ───────────────────────────────────────────────────────────

function ModalFinalizar({ apoliceId, apolice, onClose, onFinalizado, toast }) {
  const [proprietarioNome,  setProprietarioNome]  = useState('')
  const [proprietarioCel,   setProprietarioCel]   = useState('')
  const [numeroApolice,     setNumeroApolice]      = useState(apolice?.numero_apolice || '')
  const [numeroProposta,    setNumeroProposta]     = useState(apolice?.numero_proposta || '')
  const [endereco,          setEndereco]           = useState(apolice?.endereco || '')
  const [inicioVigencia,    setInicioVigencia]     = useState(apolice?.inicio_vigencia || '')
  const [fimVigencia,       setFimVigencia]        = useState(apolice?.fim_vigencia || '')
  const [valorParcela,      setValorParcela]       = useState(apolice?.valor_parcela || '')
  const [formaPagamento,    setFormaPagamento]     = useState(apolice?.forma_pagamento || '')
  const [seguradora,        setSeguradora]         = useState(apolice?.seguradora || '')
  const [salvando,          setSalvando]           = useState(false)

  const meses = calcularMeses(inicioVigencia, fimVigencia)

  const obrigatoriosOK = proprietarioNome.trim() && numeroApolice.trim()
    && inicioVigencia && fimVigencia && valorParcela && formaPagamento && seguradora

  async function confirmar() {
    if (!obrigatoriosOK) return
    setSalvando(true)
    const err = await moverStatusApolice(apoliceId, 'enviada', {
      proprietario_nome:    proprietarioNome.trim(),
      proprietario_cel:     proprietarioCel.trim() || null,
      numero_apolice:       numeroApolice.trim(),
      numero_proposta:      numeroProposta.trim() || null,
      endereco:             endereco.trim() || null,
      inicio_vigencia:      inicioVigencia,
      fim_vigencia:         fimVigencia,
      tempo_vigencia_meses: meses,
      valor_parcela:        parseFloat(valorParcela),
      forma_pagamento:      formaPagamento,
      seguradora,
    })
    setSalvando(false)
    if (err) { toast({ type: 'error', title: 'Erro ao finalizar' }); return }
    toast({ type: 'success', title: 'Apólice enviada!' })
    onFinalizado()
    onClose()
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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-dark-surface border border-dark-border rounded-2xl shadow-2xl w-full max-w-2xl my-4">

        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border">
          <h2 className="font-bold text-dark-text">Finalizar Apólice</h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <LabelReq>Nome do Proprietário</LabelReq>
              <input value={proprietarioNome} onChange={e => setProprietarioNome(e.target.value)} className="input" placeholder="João da Silva" />
            </div>
            <div>
              <LabelOpt>Celular do Proprietário</LabelOpt>
              <input value={proprietarioCel} onChange={e => setProprietarioCel(e.target.value)} className="input" placeholder="(11) 99999-9999" />
            </div>
            <div>
              <LabelReq>Número da Apólice</LabelReq>
              <input value={numeroApolice} onChange={e => setNumeroApolice(e.target.value)} className="input" placeholder="000000000" />
            </div>
            <div>
              <LabelOpt>Número da Proposta</LabelOpt>
              <input value={numeroProposta} onChange={e => setNumeroProposta(e.target.value)} className="input" placeholder="Opcional" />
            </div>
            <div className="sm:col-span-2">
              <LabelOpt>Endereço do Imóvel</LabelOpt>
              <input value={endereco} onChange={e => setEndereco(e.target.value)} className="input" placeholder="Rua, número, bairro, cidade" />
            </div>
            <div>
              <LabelReq>Início da Vigência</LabelReq>
              <input type="date" value={inicioVigencia} onChange={e => setInicioVigencia(e.target.value)} className="input" />
            </div>
            <div>
              <LabelReq>Fim da Vigência</LabelReq>
              <input type="date" value={fimVigencia} onChange={e => setFimVigencia(e.target.value)} className="input" />
            </div>
            <div>
              <LabelOpt>Tempo de Vigência</LabelOpt>
              <div className="input text-sm text-dark-muted bg-dark-surface2/50">{meses > 0 ? `${meses} meses` : '—'}</div>
            </div>
            <div>
              <LabelReq>Valor da Parcela (R$)</LabelReq>
              <input type="number" step="0.01" min="0" value={valorParcela} onChange={e => setValorParcela(e.target.value)} className="input" placeholder="0,00" />
            </div>
            <div>
              <LabelReq>Forma de Pagamento</LabelReq>
              <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} className="select">
                <option value="">Selecione...</option>
                <option value="fatura_sem_entrada">Fatura sem entrada</option>
                <option value="fatura_com_entrada">Fatura com entrada</option>
                <option value="cartao_credito">Cartão de crédito</option>
              </select>
            </div>
            <div>
              <LabelReq>Seguradora</LabelReq>
              <SeguradoraSelect value={seguradora} onChange={setSeguradora} required />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-dark-border">
          <button onClick={onClose} className="btn-secondary text-sm">Cancelar</button>
          <button onClick={confirmar} disabled={!obrigatoriosOK || salvando} className="btn-primary text-sm">
            {salvando ? 'Salvando...' : 'Confirmar Envio'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

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

  const scrollRef    = useRef(null)
  const [canScrollL, setCanScrollL] = useState(false)
  const [canScrollR, setCanScrollR] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

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
    const id         = active.id
    const novoStatus = over.id
    const apolice    = apolices.find(a => a.id === id)
    if (!apolice || apolice.status_emissao === novoStatus) return

    if (novoStatus === 'enviada') {
      setPendingMove({ id, fromStatus: apolice.status_emissao })
      setModalFinalizar({ id, apolice })
      return
    }

    // Otimista
    setApolices(prev => prev.map(a =>
      a.id === id ? { ...a, status_emissao: novoStatus } : a
    ))
    const err = await moverStatusApolice(id, novoStatus)
    if (err) { toast({ type: 'error', title: 'Erro ao mover apólice' }); load() }
  }

  function handleFinalizarSuccess() {
    setPendingMove(null)
    setModalFinalizar(null)
    load()
  }

  function handleFinalizarClose() {
    // Rollback: não mover
    setPendingMove(null)
    setModalFinalizar(null)
  }

  const activeCard = activeId ? apolices.find(a => a.id === activeId) : null

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-dark-text">Gestão de Apólices</h1>
          <p className="text-xs text-dark-muted mt-0.5">Arraste as apólices entre as colunas para atualizar o status</p>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-dark-surface2 border border-dark-border rounded-lg p-0.5">
          {['hoje','semana','mes'].map(f => (
            <button key={f} onClick={() => setFiltro(f)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      filtro === f ? 'bg-brand-secondary text-white shadow-sm' : 'text-dark-muted hover:text-dark-text'
                    }`}>
              {f === 'hoje' ? 'Hoje' : f === 'semana' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <ImobiliariaSelect value={imobFiltro} onChange={setImobFiltro} className="text-sm" />
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dark-border text-xs text-dark-muted hover:text-dark-text transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
          <button onClick={() => setModalIniciar(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Iniciar Emissão
          </button>
        </div>
      </div>

      {/* ── Kanban ── */}
      {loading ? (
        <KanbanSkeleton />
      ) : (
        <div className="relative">
          {canScrollL && (
            <>
              <div className="absolute left-0 top-0 bottom-4 w-16 z-10 pointer-events-none"
                   style={{ background: 'linear-gradient(to right, rgb(var(--color-bg)), transparent)' }} />
              <button onClick={() => scrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
                      className="absolute left-0.5 top-[60px] z-20 w-7 h-7 rounded-full bg-dark-surface border border-dark-border shadow-md flex items-center justify-center text-dark-muted hover:text-dark-text transition-all">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          )}
          {canScrollR && (
            <>
              <div className="absolute right-0 top-0 bottom-4 w-16 z-10 pointer-events-none"
                   style={{ background: 'linear-gradient(to left, rgb(var(--color-bg)), transparent)' }} />
              <button onClick={() => scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
                      className="absolute right-0.5 top-[60px] z-20 w-7 h-7 rounded-full bg-dark-surface border border-dark-border shadow-md flex items-center justify-center text-dark-muted hover:text-dark-text transition-all">
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          <div ref={scrollRef} className="kanban-scroll overflow-x-auto pb-4">
            <DndContext sensors={sensors}
                        onDragStart={({ active }) => setActiveId(active.id)}
                        onDragEnd={handleDragEnd}
                        onDragCancel={() => setActiveId(null)}>
              <div className="flex gap-2 min-w-max px-0.5">
                {COLUNAS.map((col, i) => (
                  <DroppableColumn key={col.id} col={col} apolices={groups[col.id] || []}
                                   onDetalhe={id => navigate(`/apolices/${id}`)}
                                   resolverNome={resolverNome} colIndex={i} />
                ))}
              </div>
              <DragOverlay dropAnimation={null}>
                {activeCard && (
                  <div style={{ width: "calc(var(--kanban-col-w, 224px) - 12px)" }}>
                    <ApoliceCard apolice={activeCard} isDragOverlay resolverNome={resolverNome} />
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          </div>
        </div>
      )}

      {/* ── Modais ── */}
      {modalIniciar && (
        <ModalIniciarEmissao onClose={() => setModalIniciar(false)} onCriado={load} toast={toast} />
      )}
      {modalFinalizar && (
        <ModalFinalizar
          apoliceId={modalFinalizar.id}
          apolice={modalFinalizar.apolice}
          onClose={handleFinalizarClose}
          onFinalizado={handleFinalizarSuccess}
          toast={toast}
        />
      )}
    </div>
  )
}
