import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  BarChart3,
  BadgeCheck,
  Building2,
  CalendarDays,
  CircleDollarSign,
  Crown,
  Handshake,
  MapPinned,
  Plus,
  RefreshCw,
  Search,
  Target,
  Users,
  BrainCircuit,
  BriefcaseBusiness,
  FileText,
  LayoutGrid,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { getEntityImageUrl } from '../../lib/entityMedia'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import {
  canManageCommercial,
  COMERCIAL_PRODUTO_OPTIONS,
  buildCommercialLeadGenerationMap,
  eventAdd,
  getCommercialLeadIdentity,
  annotateCommercialLeads,
  isCommercialSellerProfile,
  leadAdd,
  useComercial,
} from '../../lib/comercial'
import {
  CrmEmptyState,
  CrmMetricCard,
  CrmPageHeader,
  CrmSectionCard,
  CrmSegmentedControl,
} from '../../components/comercial'
import { Select } from '../../components/ui/Select'

const TABS = [
  { value: 'painel', label: 'Painel' },
  { value: 'inteligencia', label: 'Inteligência' },
  { value: 'imobiliarias', label: 'Imobiliárias' },
  { value: 'growth', label: 'Planning & Growth' },
]

const SOURCE_OPTIONS = [
  { value: 'fichas_passadas', label: 'Fichas passadas' },
  { value: 'fichas_aprovadas', label: 'Fichas aprovadas' },
  { value: 'apolices_fianca', label: 'Apólices emitidas fiança' },
  { value: 'renovacao_fianca', label: 'Renovação fiança' },
  { value: 'cotacoes_auto', label: 'Cotações AUTO' },
  { value: 'apolices_auto', label: 'Apólices AUTO' },
  { value: 'geral', label: 'Geral' },
]

const TYPE_OPTIONS = [
  { value: 'todos', label: 'PF e PJ' },
  { value: 'pf', label: 'Pessoa Física' },
  { value: 'pj', label: 'Pessoa Jurídica' },
]

const DEFAULT_OBJECTIVES = [
  'Gerar reunião consultiva',
  'Validar necessidade de produto',
  'Retomar cliente sem cross-sell',
  'Agendar diagnóstico comercial',
]

const batchStorageKey = 'comercial_objectives_v1'
const historyStorageKey = 'comercial_gestao_batches_v1'
const imobiliariaFlowKey = 'comercial_imobiliarias_flow_v1'

function formatMoney(value) {
  return `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatCpf(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return '—'
  if (digits.length <= 3) return digits
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}

function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return '—'
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

function leadTypeFromRow(row, fallback = 'pf') {
  const raw = String(row?.tipo || row?.tipo_pessoa || fallback || '').toLowerCase()
  if (raw.includes('pj')) return 'pj'
  if (raw.includes('pf')) return 'pf'
  if (row?.cnpj || row?.nome_empresa) return 'pj'
  return 'pf'
}

function sourceLabel(source) {
  const map = {
    fichas_passadas: 'Fichas passadas',
    fichas_aprovadas: 'Fichas aprovadas',
    apolices_fianca: 'Apólices fiança',
    renovacao_fianca: 'Renovação fiança',
    cotacoes_auto: 'Cotações AUTO',
    apolices_auto: 'Apólices AUTO',
    geral: 'Geral',
  }
  return map[source] || source || 'Base comercial'
}

function sourceKind(source) {
  if (source === 'cotacoes_auto' || source === 'apolices_auto') return 'auto'
  if (source === 'apolices_fianca' || source === 'renovacao_fianca') return 'fianca'
  return 'fichas'
}

function storageRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

function storageWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

function createRowId(source, row) {
  return `${source}:${row.id}`
}

function normalizeRow(row, source, extra = {}) {
  const kind = sourceKind(source)
  const name = row?.nome_interessado || row?.nome_cliente || row?.nome || row?.lead_nome || row?.nome_empresa || 'Lead sem nome'
  const phone = row?.celular || row?.celular_cliente || row?.telefone || row?.raw_data?.celular || ''
  const email = row?.email || row?.email_cliente || row?.raw_data?.email || ''
  const cpf = row?.cpf || row?.cpf_cliente || row?.raw_data?.cpf || ''
  const cnpj = row?.cnpj || row?.raw_data?.cnpj || ''
  const imobiliaria = row?.imobiliaria || row?.raw_data?.imobiliaria || ''
  const vehicle = row?.modelo_veiculo || row?.veiculo || row?.marca_veiculo || row?.raw_data?.veiculo || ''
  const income = row?.renda || row?.raw_data?.renda || null
  const ident = getCommercialLeadIdentity({
    nome: name,
    cpf,
    cnpj,
    celular: phone,
    email,
    imobiliaria,
    origem: sourceLabel(source),
  })

  return {
    id: createRowId(source, row),
    source,
    sourceKind: kind,
    sourceRowId: row.id,
    nome: name,
    tipoPessoa: leadTypeFromRow(row, extra.tipoPessoa),
    origem: sourceLabel(source),
    setorOrigem: row?.setor_origem || sourceLabel(source),
    produtoInteresse: extra.productId || row?.produto_interesse || row?.produto || '',
    possuiApolice: Boolean(row?.possui_apolice || row?.numero_apolice || row?.assumida || row?.status_emissao === 'emitida'),
    numeroApolice: row?.numero_apolice || row?.nome_apolice || '',
    celular: phone,
    cpf,
    cnpj,
    email,
    renda: income,
    veiculo: vehicle,
    imobiliaria,
    resumo: row?.observacoes || row?.resumo || row?.raw_data?.observacoes || '',
    informacoesImportantes: row?.informacoes_importantes || row?.raw_data?.observacoes || '',
    identidadeBase: ident,
    raw: row,
  }
}

async function fetchRowsBySource(source) {
  if (source === 'geral') {
    const batches = await Promise.all([
      fetchRowsBySource('fichas_passadas'),
      fetchRowsBySource('fichas_aprovadas'),
      fetchRowsBySource('apolices_fianca'),
      fetchRowsBySource('renovacao_fianca'),
      fetchRowsBySource('cotacoes_auto'),
      fetchRowsBySource('apolices_auto'),
    ])
    return batches.flat()
  }

  if (source === 'cotacoes_auto') {
    const { data, error } = await supabase
      .from('cotacoes_auto')
      .select('id, created_at, tipo, nome_cliente, cpf_cliente, celular_cliente, email_cliente, modelo_veiculo, placa, status, seguradora, condutor_nome, condutor_cpf, valor_protecao, raw_data')
      .order('created_at', { ascending: false })
      .limit(300)
    if (error) throw error
    return (data || []).map(row => normalizeRow({
      ...row,
      nome_interessado: row.nome_cliente,
      cpf: row.cpf_cliente,
      celular: row.celular_cliente,
      email: row.email_cliente,
      veiculo: row.modelo_veiculo,
      setor_origem: 'Cotações AUTO',
    }, source))
  }

  if (source === 'apolices_auto') {
    const { data, error } = await supabase
      .from('apolices_auto')
      .select('id, created_at, numero_apolice, tipo, nome_cliente, cpf_cliente, celular_cliente, email_cliente, modelo_veiculo, placa, seguradora, status_emissao, eh_renovacao, raw_data')
      .order('created_at', { ascending: false })
      .limit(300)
    if (error) throw error
    return (data || []).map(row => normalizeRow({
      ...row,
      nome_interessado: row.nome_cliente,
      cpf: row.cpf_cliente,
      celular: row.celular_cliente,
      email: row.email_cliente,
      veiculo: row.modelo_veiculo,
      numero_apolice: row.numero_apolice,
      setor_origem: row.eh_renovacao ? 'Renovação AUTO' : 'Apólices AUTO',
    }, source, { productId: 'seguro_auto' }))
  }

  if (source === 'apolices_fianca') {
    const { data, error } = await supabase
      .from('apolices')
      .select('id, created_at, produto, nome_interessado, nome_empresa, cpf, cnpj, celular, email, imobiliaria, numero_apolice, status_emissao, seguradora, vigencia, vencimento, raw_data')
      .order('created_at', { ascending: false })
      .limit(300)
    if (error) throw error
    return (data || []).map(row => normalizeRow({
      ...row,
      nome_interessado: row.nome_interessado || row.nome_empresa,
      setor_origem: 'Apólices emitidas fiança',
      possui_apolice: true,
    }, source, { productId: 'seguro_fianca' }))
  }

  if (source === 'renovacao_fianca') {
    const { data, error } = await supabase
      .from('fichas')
      .select('id, created_at, produto, nome_interessado, nome_empresa, cpf, cnpj, celular, email, imobiliaria, status, assumida, vencimento, vigencia, raw_data')
      .order('created_at', { ascending: false })
      .limit(300)
    if (error) throw error
    return (data || [])
      .filter(row => ['aprovado', 'assumida', 'emitido'].includes(String(row.status || '').toLowerCase()) || Boolean(row.vencimento || row.raw_data?.vencimento))
      .map(row => normalizeRow({
        ...row,
        nome_interessado: row.nome_interessado || row.nome_empresa,
        setor_origem: 'Renovação fiança',
        possui_apolice: true,
      }, source, { productId: 'seguro_fianca' }))
  }

  if (source === 'fichas_aprovadas' || source === 'fichas_passadas') {
    const { data, error } = await supabase
      .from('fichas')
      .select('id, created_at, produto, nome_interessado, nome_empresa, cpf, cnpj, celular, email, imobiliaria, status, assumida, valor_aluguel, valor_iptu, valor_condominio, raw_data')
      .order('created_at', { ascending: false })
      .limit(400)
    if (error) throw error
    const approved = source === 'fichas_aprovadas'
    return (data || [])
      .filter(row => approved
        ? ['aprovado', 'assumida', 'emitido'].includes(String(row.status || '').toLowerCase())
        : !['aprovado', 'assumida', 'emitido'].includes(String(row.status || '').toLowerCase()))
      .map(row => normalizeRow({
        ...row,
        nome_interessado: row.nome_interessado || row.nome_empresa,
        setor_origem: approved ? 'Fichas aprovadas' : 'Fichas passadas',
        possui_apolice: Boolean(row.assumida),
      }, source, { productId: row.produto === 'pessoa_juridica' ? 'seguro_fianca' : 'seguro_fianca' }))
  }

  return []
}

function loadFlow() {
  return storageRead(imobiliariaFlowKey, {})
}

function saveFlow(flow) {
  storageWrite(imobiliariaFlowKey, flow)
}

  function buildFlowDefaults(imob) {
    return {
      objetivo: imob?.objetivo_comercial || '',
      onboardingStatus: imob?.onboarding_status || 'nao_iniciado',
      onboardingProcesso: Array.isArray(imob?.onboarding_processo) ? imob.onboarding_processo : [],
      recebeComissao: Boolean(imob?.recebe_comissao),
      pctComissao: imob?.pct_comissao || '',
      ultimaVisitaEm: imob?.ultima_visita_em || '',
      ultimaVisitaHouve: Boolean(imob?.ultima_visita_houve),
      ultimaVisitaComoFoi: imob?.ultima_visita_como_foi || '',
      visitaPara: '',
      novaEtapa: '',
  }
}

export default function GestaoComercial() {
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const toast = useToast()
  const state = useComercial()

  const [tab, setTab] = useState('painel')
  const [profiles, setProfiles] = useState([])
  const [imobiliarias, setImobiliarias] = useState([])
  const [apolicesPorImob, setApolicesPorImob] = useState({})
  const [flowByImob, setFlowByImob] = useState(() => loadFlow())
  const [loadingProfiles, setLoadingProfiles] = useState(false)
  const [loadingImobiliarias, setLoadingImobiliarias] = useState(false)
  const [objectives, setObjectives] = useState(() => storageRead(batchStorageKey, DEFAULT_OBJECTIVES))
  const [newObjective, setNewObjective] = useState('')
  const [source, setSource] = useState('geral')
  const [tipoPessoa, setTipoPessoa] = useState('todos')
  const [objective, setObjective] = useState(objectives[0] || DEFAULT_OBJECTIVES[0])
  const [sellerId, setSellerId] = useState('')
  const [includeRepassed, setIncludeRepassed] = useState(true)
  const [includeContacted, setIncludeContacted] = useState(true)
  const [onlyNew, setOnlyNew] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('lista')
  const [batchLimit, setBatchLimit] = useState(30)
  const [loadingBatch, setLoadingBatch] = useState(false)
  const [batchRows, setBatchRows] = useState([])
  const [rowAssignments, setRowAssignments] = useState({})
  const [selectedRowId, setSelectedRowId] = useState('')
  const [selectedDraft, setSelectedDraft] = useState(null)
  const [history, setHistory] = useState(() => storageRead(historyStorageKey, []))

  const isManager = canManageCommercial(profile)
  const visibleLeads = state.leads || []
  const visibleSales = state.sales || []
  const generationMap = useMemo(() => buildCommercialLeadGenerationMap(visibleLeads), [visibleLeads])
  const sellers = useMemo(
    () => profiles.filter(item => isCommercialSellerProfile(item) || item.id === user?.id),
    [profiles, user?.id]
  )
  const leadByIdentity = useMemo(() => {
    const map = new Map()
    visibleLeads.forEach(lead => {
      map.set(lead.identidadeBase || getCommercialLeadIdentity(lead), lead)
    })
    return map
  }, [visibleLeads])

  useEffect(() => storageWrite(batchStorageKey, objectives), [objectives])
  useEffect(() => storageWrite(historyStorageKey, history.slice(0, 15)), [history])
  useEffect(() => saveFlow(flowByImob), [flowByImob])

  useEffect(() => {
    let cancelled = false
    setLoadingProfiles(true)
    setLoadingImobiliarias(true)

    Promise.all([
      supabase.from('profiles').select('id, nome, is_admin, areas_atuacao, comercial_produtos, avatar_url').order('nome'),
      supabase.from('imobiliarias').select('id, nome_canonico, ativa, imagem_url, imagem_path, created_at').order('nome_canonico'),
      supabase.from('apolices').select('imobiliaria').not('imobiliaria', 'is', null),
    ]).then(([profilesRes, imobiliariasRes, apolicesRes]) => {
      if (cancelled) return
      if (profilesRes.error) {
        toast({ type: 'error', title: 'Erro ao carregar equipe', message: profilesRes.error.message })
      } else {
        setProfiles(Array.isArray(profilesRes.data) ? profilesRes.data : [])
      }
      if (imobiliariasRes.error) {
        toast({ type: 'error', title: 'Erro ao carregar imobiliárias', message: imobiliariasRes.error.message })
      } else {
        setImobiliarias(Array.isArray(imobiliariasRes.data) ? imobiliariasRes.data : [])
      }
      if (apolicesRes?.error) {
        toast({ type: 'error', title: 'Erro ao carregar apólices', message: apolicesRes.error.message })
      } else {
        const counts = {}
        (apolicesRes.data || []).forEach(item => {
          const key = String(item.imobiliaria || '').toLowerCase()
          if (!key) return
          counts[key] = (counts[key] || 0) + 1
        })
        setApolicesPorImob(counts)
      }
      setLoadingProfiles(false)
      setLoadingImobiliarias(false)
    })

    return () => { cancelled = true }
  }, [toast])

  useEffect(() => {
    if (!selectedRowId) {
      setSelectedDraft(null)
      return
    }
    setSelectedDraft(batchRows.find(row => row.id === selectedRowId) || null)
  }, [batchRows, selectedRowId])

  const teamOverview = useMemo(() => sellers.map(member => {
    const ownerLeads = visibleLeads.filter(lead => lead.responsavelId === member.id || lead.user_id === member.id)
    const sales = visibleSales.filter(sale => sale.user_id === member.id || ownerLeads.some(lead => lead.id === sale.leadId))
    const stale = ownerLeads.filter(lead => lead.ultimaAtividade && (Date.now() - new Date(lead.ultimaAtividade).getTime()) >= 7 * 86400000).length
    return {
      id: member.id,
      nome: member.nome,
      leads: ownerLeads.length,
      vendas: sales.length,
      stale,
    }
  }), [sellers, visibleLeads, visibleSales])

  const conversionChart = useMemo(() => {
    const map = new Map([
      ['fichas_passadas', { name: 'Fichas passadas', leads: 0, vendas: 0 }],
      ['fichas_aprovadas', { name: 'Fichas aprovadas', leads: 0, vendas: 0 }],
      ['apolices_fianca', { name: 'Apólices fiança', leads: 0, vendas: 0 }],
      ['renovacao_fianca', { name: 'Renovação fiança', leads: 0, vendas: 0 }],
      ['cotacoes_auto', { name: 'Cotações AUTO', leads: 0, vendas: 0 }],
      ['apolices_auto', { name: 'Apólices AUTO', leads: 0, vendas: 0 }],
      ['geral', { name: 'Geral', leads: 0, vendas: 0 }],
    ])

    visibleLeads.forEach(lead => {
      const sourceKey = String(lead.listaOrigem || lead.source || 'geral').toLowerCase()
      const current = map.get(sourceKey) || map.get('geral')
      current.leads += 1
    })

    visibleSales.forEach(sale => {
      const lead = visibleLeads.find(item => item.id === sale.leadId)
      const sourceKey = String(lead?.listaOrigem || lead?.source || 'geral').toLowerCase()
      const current = map.get(sourceKey) || map.get('geral')
      current.vendas += 1
    })

    return [...map.values()].filter(item => item.leads > 0 || item.vendas > 0)
  }, [visibleLeads, visibleSales])

  const partnerOverview = useMemo(() => {
    const map = new Map()
    visibleLeads.filter(lead => lead.imobiliaria).forEach(lead => {
      const current = map.get(lead.imobiliaria) || { nome: lead.imobiliaria, leads: 0, vendas: 0 }
      current.leads += 1
      map.set(lead.imobiliaria, current)
    })
    return [...map.values()].sort((a, b) => b.leads - a.leads).slice(0, 10)
  }, [visibleLeads])

  const imobiliariasList = useMemo(() => {
    return imobiliarias.map(imob => {
      const relatedLeads = visibleLeads.filter(lead => (lead.imobiliaria || '').toLowerCase() === (imob.nome_canonico || '').toLowerCase())
      const relatedSales = visibleSales.filter(sale => {
        const lead = visibleLeads.find(item => item.id === sale.leadId)
        return (lead?.imobiliaria || '').toLowerCase() === (imob.nome_canonico || '').toLowerCase()
      })
      const flow = flowByImob[imob.id] || buildFlowDefaults(imob)
      return {
        ...imob,
        flow,
        leads: relatedLeads.length,
        vendas: relatedSales.length,
      }
    })
  }, [imobiliarias, flowByImob, visibleLeads, visibleSales])

  const sellerBoards = useMemo(() => sellers.map(member => {
    const leads = visibleLeads.filter(lead => lead.responsavelId === member.id || lead.user_id === member.id)
    const totalGenerations = leads.reduce((sum, lead) => sum + Number(lead.listaGeradaCount || 0), 0)
    return {
      ...member,
      leads,
      totalGenerations,
      contato: leads.filter(lead => lead.contatadoEm).length,
      repassados: leads.filter(lead => lead.repassadoEm).length,
      porColuna: leads.reduce((acc, lead) => {
        const key = lead.coluna || 'contato'
        acc[key] = (acc[key] || 0) + 1
        return acc
      }, {}),
    }
  }), [sellers, visibleLeads])

  const filteredBatch = useMemo(() => {
    const term = searchQuery.trim().toLowerCase()
    return batchRows.filter(row => {
      const matchesSearch = !term || [
        row.nome,
        row.cpf,
        row.cnpj,
        row.celular,
        row.email,
        row.imobiliaria,
        row.origem,
        row.setorOrigem,
      ].some(value => String(value || '').toLowerCase().includes(term))

      const existing = leadByIdentity.get(row.identidadeBase)
      const isRepassed = Boolean(existing?.responsavelId || existing?.repassadoEm || row.responsavelId)
      const isContacted = Boolean(existing?.contatadoEm || existing?.ultimaAtividade)

      if (onlyNew && existing) return false
      if (!includeRepassed && isRepassed) return false
      if (!includeContacted && isContacted) return false
      return matchesSearch
    })
  }, [batchRows, searchQuery, leadByIdentity, onlyNew, includeRepassed, includeContacted])

  function addObjective() {
    const value = newObjective.trim()
    if (!value) return
    setObjectives(prev => Array.from(new Set([value, ...prev])))
    setObjective(value)
    setNewObjective('')
    toast({ type: 'success', title: 'Objetivo criado' })
  }

  function updateDraft(patch) {
    setSelectedDraft(current => (current ? { ...current, ...patch } : current))
    setBatchRows(rows => rows.map(row => (row.id === selectedRowId ? { ...row, ...patch } : row)))
  }

  async function generateBatch() {
    setLoadingBatch(true)
    try {
      const rows = await fetchRowsBySource(source)
      const prepared = rows
        .filter(row => {
          if (tipoPessoa === 'pf' && row.tipoPessoa !== 'pf') return false
          if (tipoPessoa === 'pj' && row.tipoPessoa !== 'pj') return false
          const existing = leadByIdentity.get(row.identidadeBase)
          const isRepassed = Boolean(existing?.responsavelId || existing?.repassadoEm)
          const isContacted = Boolean(existing?.contatadoEm || existing?.ultimaAtividade)
          if (onlyNew && existing) return false
          if (!includeRepassed && isRepassed) return false
          if (!includeContacted && isContacted) return false
          return true
        })
        .slice(0, Math.max(1, batchLimit))

      setBatchRows(prepared)
      setSelectedRowId(prepared[0]?.id || '')
      const nextAssignments = {}
      prepared.forEach(row => {
        nextAssignments[row.id] = sellerId || user?.id || ''
      })
      setRowAssignments(nextAssignments)
      toast({ type: 'success', title: 'Lote gerado', message: `${prepared.length} leads preparados para distribuição.` })
    } catch (error) {
      toast({ type: 'error', title: 'Erro ao gerar lote', message: error.message })
    } finally {
      setLoadingBatch(false)
    }
  }

  async function distributeBatch() {
    if (!batchRows.length) return
    try {
      const results = await Promise.allSettled(batchRows.map(row => {
        const responsavelId = rowAssignments[row.id] || sellerId || user?.id || ''
        const responsavelNome = sellers.find(item => item.id === responsavelId)?.nome || ''
        const leadPayload = {
          nome: row.nome,
          telefone: row.celular || '',
          tipo: row.tipoPessoa === 'pj' ? 'PJ' : 'PF',
          origem: row.origem,
          imobiliaria: row.imobiliaria || '',
          nomeApolice: row.numeroApolice || '',
          tipoLocatario: row.tipoPessoa === 'pj' ? 'PJ' : 'PF',
          proximaAcao: '',
          resumo: row.resumo || '',
          tags: [],
          apoliceAtiva: row.possuiApolice,
          produtoInteresse: row.produtoInteresse || '',
          responsavelId,
          responsavelNome,
          distribuidoPor: user?.id || null,
          distribuidoEm: new Date().toISOString(),
          listaPeriodo: 'gestao',
          listaOrigem: source,
          objetivo: objective,
          identidadeBase: row.identidadeBase,
          renda: row.renda || null,
          veiculo: row.veiculo || '',
          cpf: row.cpf || '',
          cnpj: row.cnpj || '',
          email: row.email || '',
          celular: row.celular || '',
          setorOrigem: row.setorOrigem || '',
          imobiliariaOrigem: row.imobiliaria || '',
          possuiApolice: row.possuiApolice,
          numeroApolice: row.numeroApolice || '',
          informacoesImportantes: row.informacoesImportantes || '',
          dadosInteligencia: row.raw || {},
          repassadoEm: new Date().toISOString(),
          repassadoPor: user?.id || null,
          repassadoNome: user?.nome || profile?.nome || '',
        }
        return leadAdd(leadPayload)
      }))

      const imported = results.filter(result => result.status === 'fulfilled').length
      setHistory(prev => [{
        id: `${Date.now()}`,
        createdAt: new Date().toISOString(),
        source,
        total: batchRows.length,
        imported,
        objective,
      }, ...prev])
      setBatchRows([])
      setSelectedRowId('')
      setSelectedDraft(null)
      toast({ type: 'success', title: 'Lote distribuído', message: `${imported} leads enviados para o comercial.` })
    } catch (error) {
      toast({ type: 'error', title: 'Erro ao distribuir lote', message: error.message })
    }
  }

  async function saveSelectedLead() {
    if (!selectedDraft) return
    const cloned = batchRows.find(row => row.id === selectedRowId)
    if (!cloned) return
    updateDraft({
      nome: selectedDraft.nome,
      celular: selectedDraft.celular,
      cpf: selectedDraft.cpf,
      cnpj: selectedDraft.cnpj,
      email: selectedDraft.email,
      renda: selectedDraft.renda,
      veiculo: selectedDraft.veiculo,
      imobiliaria: selectedDraft.imobiliaria,
      resumo: selectedDraft.resumo,
      informacoesImportantes: selectedDraft.informacoesImportantes,
      objetivo: selectedDraft.objetivo || objective,
      produtoInteresse: selectedDraft.produtoInteresse || '',
    })
    toast({ type: 'success', title: 'Lead preparado', message: 'A linha selecionada foi atualizada para distribuição.' })
  }

  async function repassarSelecionado() {
    if (!selectedDraft) return
    const responsavelId = rowAssignments[selectedRowId] || sellerId || user?.id || ''
    const responsavelNome = sellers.find(item => item.id === responsavelId)?.nome || ''
    const novo = await leadAdd({
      nome: selectedDraft.nome,
      telefone: selectedDraft.celular || '',
      tipo: selectedDraft.tipoPessoa === 'pj' ? 'PJ' : 'PF',
      origem: selectedDraft.origem,
      imobiliaria: selectedDraft.imobiliaria || '',
      nomeApolice: selectedDraft.numeroApolice || '',
      tipoLocatario: selectedDraft.tipoPessoa === 'pj' ? 'PJ' : 'PF',
      proximaAcao: '',
      resumo: selectedDraft.resumo || '',
      tags: [],
      apoliceAtiva: selectedDraft.possuiApolice,
      produtoInteresse: selectedDraft.produtoInteresse || '',
      responsavelId,
      responsavelNome,
      distribuidoPor: user?.id || null,
      distribuidoEm: new Date().toISOString(),
      listaPeriodo: 'gestao',
      listaOrigem: source,
      objetivo: selectedDraft.objetivo || objective,
      identidadeBase: selectedDraft.identidadeBase,
      renda: selectedDraft.renda || null,
      veiculo: selectedDraft.veiculo || '',
      cpf: selectedDraft.cpf || '',
      cnpj: selectedDraft.cnpj || '',
      email: selectedDraft.email || '',
      celular: selectedDraft.celular || '',
      setorOrigem: selectedDraft.setorOrigem || '',
      imobiliariaOrigem: selectedDraft.imobiliaria || '',
      possuiApolice: selectedDraft.possuiApolice,
      numeroApolice: selectedDraft.numeroApolice || '',
      informacoesImportantes: selectedDraft.informacoesImportantes || '',
      dadosInteligencia: selectedDraft.raw || {},
      repassadoEm: new Date().toISOString(),
      repassadoPor: user?.id || null,
      repassadoNome: user?.nome || profile?.nome || '',
    })
    toast({ type: 'success', title: 'Lead repassado', message: `${novo.nome} foi direcionado para a carteira.` })
    navigate(`/comercial/leads/${novo.id}`)
  }

  async function saveImobiliariaFlow(imobId, patch) {
    setFlowByImob(current => ({
      ...current,
      [imobId]: {
        ...(current[imobId] || {}),
        ...patch,
      },
    }))
  }

  async function scheduleImobiliariaVisit(imob) {
    const flow = flowByImob[imob.id] || buildFlowDefaults(imob)
    const when = flow.visitaPara || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
    await eventAdd({
      leadId: null,
      nome: `Visita imobiliária - ${imob.nome_canonico}`,
      data: when,
      tipo: 'Reunião',
      descricao: flow.objetivo ? `Objetivo: ${flow.objetivo}` : 'Visita comercial',
      auto: false,
    })
    await saveImobiliariaFlow(imob.id, {
      ultimaVisitaEm: when,
      ultimaVisitaHouve: true,
    })
    toast({ type: 'success', title: 'Visita agendada', message: `${imob.nome_canonico} foi vinculada ao calendário do gestor.` })
  }

  if (!isManager) {
    return (
      <div className="space-y-6">
        <CrmPageHeader
          eyebrow="Área comercial"
          title="Gestão Comercial"
          description="Esta área é dedicada ao gestor comercial e concentra inteligência, distribuição e acompanhamento da equipe."
          actions={(
            <button type="button" onClick={() => navigate('/comercial')} className="btn-primary text-sm">
              Voltar ao CRM
            </button>
          )}
        />
        <CrmSectionCard title="Acesso restrito">
          <CrmEmptyState
            icon={Crown}
            title="Somente gestor comercial"
            description="Essa tela organiza planejamento, inteligência comercial, relação com imobiliárias e distribuição dos lotes."
            compact
          />
        </CrmSectionCard>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <CrmPageHeader
        eyebrow="Gestão Comercial"
        title="Cockpit do gestor"
        description="Central de comando para planejamento, inteligência comercial, relacionamento com imobiliárias, prospecção e acompanhamento do desempenho dos vendedores."
        actions={(
          <>
            <button type="button" onClick={() => navigate('/comercial/pipeline')} className="btn-secondary text-sm">
              Pipeline
            </button>
            <button type="button" onClick={() => navigate('/comercial/leads')} className="btn-primary text-sm">
              Base de leads
            </button>
          </>
        )}
      />

      <CrmSegmentedControl options={TABS} value={tab} onChange={setTab} />

      {tab === 'painel' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CrmMetricCard icon={Users} label="Vendedores" value={teamOverview.length} accent="#2563EB" helper="Equipe monitorada" />
          <CrmMetricCard icon={BriefcaseBusiness} label="Leads totais" value={visibleLeads.length} accent="#0F766E" helper="Base acompanhada pela gestão" />
          <CrmMetricCard icon={CircleDollarSign} label="Vendas" value={visibleSales.length} accent="#10B981" helper="Fechamentos registrados" />
          <CrmMetricCard icon={Handshake} label="Imobiliárias" value={imobiliariasList.length} accent="#7C3AED" helper="Relacionamentos ativos" />

          <CrmSectionCard title="Leads que viraram clientes" subtitle="Conversão por base gerada." className="md:col-span-2 xl:col-span-4">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={conversionChart}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="leads" fill="#2563EB" radius={[10, 10, 0, 0]} />
                  <Bar dataKey="vendas" fill="#10B981" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CrmSectionCard>

          <CrmSectionCard title="Desempenho por vendedor" subtitle="Leitura rápida da produção e dos gargalos do time." className="md:col-span-2 xl:col-span-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {teamOverview.map(item => (
                <div key={item.id} className="rounded-[22px] border border-dark-border/50 bg-white/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-dark-text">{item.nome}</p>
                    <span className="rounded-full bg-brand-accent/10 px-2 py-1 text-[11px] font-semibold text-brand-accent">
                      {item.leads} leads
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-2xl bg-slate-900/[0.035] p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-dark-muted">Vendas</p>
                      <p className="mt-1 text-xl font-black text-dark-text">{item.vendas}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-900/[0.035] p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-dark-muted">Parados</p>
                      <p className="mt-1 text-xl font-black text-dark-text">{item.stale}</p>
                    </div>
                  </div>
                </div>
              ))}
              {!teamOverview.length && (
                <CrmEmptyState icon={Users} title="Sem equipe mapeada" description="Assim que os usuários forem sincronizados, o painel de desempenho aparece aqui." compact />
              )}
            </div>
          </CrmSectionCard>
        </div>
      )}

      {tab === 'inteligencia' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <CrmSectionCard title="Configuração do lote" subtitle="Defina origem, recorte e responsável antes de gerar os leads.">
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-dark-muted">Fonte</p>
                <CrmSegmentedControl options={SOURCE_OPTIONS} value={source} onChange={setSource} className="w-full" />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-dark-muted">Pessoa</p>
                <CrmSegmentedControl options={TYPE_OPTIONS} value={tipoPessoa} onChange={setTipoPessoa} className="w-full" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-dark-muted">Objetivo do lote</label>
                <Select value={objective} onChange={setObjective} options={objectives.map(item => ({ value: item, label: item }))} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-dark-muted">Vendedor</label>
                <Select
                  value={sellerId}
                  onChange={setSellerId}
                  searchable
                  placeholder="Selecionar vendedor"
                  options={[{ value: '', label: 'Sem responsável' }, ...sellers.map(item => ({ value: item.id, label: item.nome }))]}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-dark-muted">Quantidade</label>
                  <input type="number" min="1" max="200" value={batchLimit} onChange={event => setBatchLimit(Number(event.target.value))} className="input w-full" />
                </div>
                <div className="flex items-end">
                  <button type="button" onClick={generateBatch} disabled={loadingBatch} className="btn-primary w-full">
                    {loadingBatch ? 'Gerando...' : 'Gerar lote'}
                  </button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => setIncludeRepassed(v => !v)} className={`rounded-2xl border px-3 py-2 text-left text-sm ${includeRepassed ? 'border-brand-accent bg-brand-accent/10 text-brand-accent' : 'border-dark-border text-dark-muted'}`}>
                  Incluir leads repassados
                </button>
                <button type="button" onClick={() => setIncludeContacted(v => !v)} className={`rounded-2xl border px-3 py-2 text-left text-sm ${includeContacted ? 'border-brand-accent bg-brand-accent/10 text-brand-accent' : 'border-dark-border text-dark-muted'}`}>
                  Incluir leads contatados
                </button>
                <button type="button" onClick={() => setOnlyNew(v => !v)} className={`rounded-2xl border px-3 py-2 text-left text-sm ${onlyNew ? 'border-brand-accent bg-brand-accent/10 text-brand-accent' : 'border-dark-border text-dark-muted'}`}>
                  Somente leads novos
                </button>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-dark-muted">Objetivos salvos</p>
                <div className="flex flex-wrap gap-2">
                  {objectives.map(item => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setObjective(item)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${objective === item ? 'bg-brand-accent text-white' : 'bg-slate-900/[0.04] text-dark-muted hover:text-dark-text'}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input value={newObjective} onChange={event => setNewObjective(event.target.value)} className="input flex-1" placeholder="Novo objetivo" />
                  <button type="button" onClick={addObjective} className="btn-secondary">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </CrmSectionCard>

          <CrmSectionCard
            title="Lote gerado"
            subtitle="Clique em uma linha para abrir a área de tratamento do lead antes do repasse."
            action={batchRows.length > 0 && (
              <button type="button" onClick={distributeBatch} className="btn-primary text-sm">
                Distribuir lote
              </button>
            )}
          >
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[260px] max-w-md flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-muted" />
                    <input
                      value={searchQuery}
                      onChange={event => setSearchQuery(event.target.value)}
                      className="input w-full pl-9"
                      placeholder="Buscar por nome, CPF, imobiliária..."
                    />
                  </div>
                  <span className="badge badge-info">{filteredBatch.length} leads</span>
                </div>

                {filteredBatch.length === 0 ? (
                  <CrmEmptyState icon={BrainCircuit} title="Nenhum lote gerado ainda" description="Configure a fonte e clique em gerar lote para montar a lista comercial." compact />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-dark-border/60 text-left">
                          {['Lead', 'Origem', 'Contato', 'Documento', 'Imobiliária', 'Responsável', 'Objetivo', 'Status'].map(header => (
                            <th key={header} className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-dark-muted">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBatch.map(row => {
                          const existing = leadByIdentity.get(row.identidadeBase)
                          const generationCount = generationMap.get(row.identidadeBase) || 0
                          return (
                            <tr
                              key={row.id}
                              className={`border-b border-dark-border/40 align-top last:border-b-0 cursor-pointer ${selectedRowId === row.id ? 'bg-brand-accent/5' : 'hover:bg-white/60'}`}
                              onClick={() => setSelectedRowId(row.id)}
                            >
                              <td className="px-3 py-4">
                                <p className="font-semibold text-dark-text">{row.nome}</p>
                                <p className="mt-1 text-xs text-dark-muted">{row.tipoPessoa.toUpperCase()} · {row.sourceKind.toUpperCase()}</p>
                                <p className="mt-1 text-xs text-dark-muted">{row.produtoInteresse ? COMERCIAL_PRODUTO_OPTIONS.find(product => product.id === row.produtoInteresse)?.label || row.produtoInteresse : 'Sem produto'}</p>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <span className="rounded-full bg-slate-900/[0.05] px-2 py-0.5 text-[10px] font-semibold text-dark-muted">Lista {generationCount || 0}x</span>
                                  {existing?.responsavelId && <span className="rounded-full bg-brand-accent/10 px-2 py-0.5 text-[10px] font-semibold text-brand-accent">Repassado</span>}
                                  {existing?.contatadoEm && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">Contatado</span>}
                                </div>
                              </td>
                              <td className="px-3 py-4 text-xs text-dark-muted">{sourceLabel(row.source)}</td>
                              <td className="px-3 py-4 text-xs text-dark-muted">
                                <div>{formatPhone(row.celular)}</div>
                                <div className="mt-1">{row.email || '—'}</div>
                              </td>
                              <td className="px-3 py-4 text-xs text-dark-muted">
                                <div>CPF {formatCpf(row.cpf)}</div>
                                <div className="mt-1">CNPJ {row.cnpj ? formatCpf(row.cnpj) : '—'}</div>
                                {row.possuiApolice && <div className="mt-1 text-emerald-600 font-semibold">Possui apólice</div>}
                                {row.numeroApolice && <div className="mt-1">Nº {row.numeroApolice}</div>}
                              </td>
                              <td className="px-3 py-4 text-xs text-dark-muted">
                                <div>{row.imobiliaria || '—'}</div>
                                <div className="mt-1">{row.setorOrigem || 'Sem setor'}</div>
                              </td>
                              <td className="px-3 py-4">
                                <Select
                                  value={rowAssignments[row.id] || sellerId || ''}
                                  onChange={value => setRowAssignments(prev => ({ ...prev, [row.id]: value }))}
                                  searchable
                                  options={[{ value: '', label: 'Sem responsável' }, ...sellers.map(item => ({ value: item.id, label: item.nome }))]}
                                />
                              </td>
                              <td className="px-3 py-4 text-xs text-dark-muted">{selectedDraft?.objetivo || objective}</td>
                              <td className="max-w-[220px] px-3 py-4 text-xs text-dark-muted">
                                <p className="line-clamp-3">{row.informacoesImportantes || row.resumo || '—'}</p>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="rounded-[22px] border border-dark-border/50 bg-white/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dark-muted">Área de tratamento</p>
                  {selectedDraft ? (
                    <div className="mt-3 space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-dark-text">{selectedDraft.nome}</p>
                        <p className="mt-1 text-xs text-dark-muted">{selectedDraft.origem}</p>
                      </div>
                      <div className="grid gap-2">
                        <input className="input" value={selectedDraft.nome || ''} onChange={e => updateDraft({ nome: e.target.value })} placeholder="Nome" />
                        <input className="input" value={selectedDraft.celular || ''} onChange={e => updateDraft({ celular: e.target.value })} placeholder="Celular" />
                        <input className="input" value={selectedDraft.email || ''} onChange={e => updateDraft({ email: e.target.value })} placeholder="E-mail" />
                        <input className="input" value={selectedDraft.imobiliaria || ''} onChange={e => updateDraft({ imobiliaria: e.target.value })} placeholder="Imobiliária" />
                        <input className="input" value={selectedDraft.renda || ''} onChange={e => updateDraft({ renda: e.target.value })} placeholder="Renda" />
                        <input className="input" value={selectedDraft.veiculo || ''} onChange={e => updateDraft({ veiculo: e.target.value })} placeholder="Veículo" />
                        <input className="input" value={selectedDraft.objetivo || objective} onChange={e => updateDraft({ objetivo: e.target.value })} placeholder="Objetivo" />
                        <textarea className="input min-h-[96px]" value={selectedDraft.resumo || ''} onChange={e => updateDraft({ resumo: e.target.value })} placeholder="Resumo do lead" />
                        <textarea className="input min-h-[96px]" value={selectedDraft.informacoesImportantes || ''} onChange={e => updateDraft({ informacoesImportantes: e.target.value })} placeholder="Informações importantes" />
                        <Select
                          value={rowAssignments[selectedRowId] || sellerId || ''}
                          onChange={value => setRowAssignments(prev => ({ ...prev, [selectedRowId]: value }))}
                          searchable
                          placeholder="Selecionar vendedor"
                          options={[{ value: '', label: 'Sem responsável' }, ...sellers.map(item => ({ value: item.id, label: item.nome }))]}
                        />
                        <button type="button" onClick={saveSelectedLead} className="btn-secondary w-full">
                          Salvar preparação
                        </button>
                        <button type="button" onClick={repassarSelecionado} className="btn-primary w-full">
                          Repassar para vendedor
                        </button>
                      </div>
                    </div>
                  ) : (
                    <CrmEmptyState
                      icon={FileText}
                      title="Selecione um lead"
                      description="Clique em uma linha da lista para preencher os dados e seguir com o repasse."
                      compact
                    />
                  )}
                </div>
              </div>
            </div>
          </CrmSectionCard>

          <CrmSectionCard title="Leads por vendedor" subtitle="Lista e kanban das carteiras atuais do time." className="xl:col-span-2">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setViewMode('lista')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${viewMode === 'lista' ? 'bg-brand-accent text-white' : 'bg-slate-900/[0.05] text-dark-muted'}`}>
                Lista
              </button>
              <button type="button" onClick={() => setViewMode('kanban')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${viewMode === 'kanban' ? 'bg-brand-accent text-white' : 'bg-slate-900/[0.05] text-dark-muted'}`}>
                Kanban
              </button>
            </div>

            <div className="space-y-4">
              {sellerBoards.map(member => (
                <div key={member.id} className="rounded-[22px] border border-dark-border/50 bg-white/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-dark-text">{member.nome}</p>
                      <p className="text-xs text-dark-muted">{member.leads.length} leads · {member.contato} contatados · {member.repassados} repassados</p>
                    </div>
                    <span className="rounded-full bg-brand-accent/10 px-2 py-1 text-[11px] font-semibold text-brand-accent">
                      {member.totalGenerations} gerações
                    </span>
                  </div>

                  {viewMode === 'lista' ? (
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b border-dark-border/50 text-left">
                            <th className="px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-dark-muted">Lead</th>
                            <th className="px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-dark-muted">Origem</th>
                            <th className="px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-dark-muted">Contato</th>
                            <th className="px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-dark-muted">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {member.leads.slice(0, 10).map(lead => (
                            <tr key={lead.id} className="border-b border-dark-border/30 last:border-b-0">
                              <td className="px-3 py-3">
                                <p className="font-medium text-dark-text">{lead.nome}</p>
                                <p className="text-xs text-dark-muted">{lead.imobiliaria || 'Sem imobiliária'}</p>
                              </td>
                              <td className="px-3 py-3 text-xs text-dark-muted">{sourceLabel(lead.listaOrigem || lead.source)}</td>
                              <td className="px-3 py-3 text-xs text-dark-muted">{formatPhone(lead.celular)} · {lead.email || '—'}</td>
                              <td className="px-3 py-3 text-xs text-dark-muted">
                                <div className="flex flex-wrap gap-1.5">
                                  {lead.listaGeradaCount > 0 && <span className="rounded-full bg-brand-accent/10 px-2 py-0.5 text-[10px] font-semibold text-brand-accent">Lista {lead.listaGeradaCount}x</span>}
                                  {lead.contatadoEm && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Contatado</span>}
                                  {lead.repassadoEm && <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-700">Repassado</span>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {member.leads.slice(0, 12).map(lead => (
                        <button
                          key={lead.id}
                          type="button"
                          onClick={() => navigate(`/comercial/leads/${lead.id}`)}
                          className="rounded-[18px] border border-dark-border/50 bg-white/70 p-3 text-left transition-colors hover:border-brand-accent/40"
                        >
                          <p className="font-semibold text-dark-text">{lead.nome}</p>
                          <p className="mt-1 text-xs text-dark-muted">{lead.imobiliaria || lead.origem}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {lead.listaGeradaCount > 0 && <span className="rounded-full bg-brand-accent/10 px-2 py-0.5 text-[10px] font-semibold text-brand-accent">Lista {lead.listaGeradaCount}x</span>}
                            {lead.contatadoEm && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Contatado</span>}
                            {lead.repassadoEm && <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-700">Repassado</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CrmSectionCard>
        </div>
      )}

      {tab === 'imobiliarias' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <CrmSectionCard title="Imobiliárias conectadas" subtitle="Relações, visitas, objetivo e onboarding no mesmo cartão.">
            {loadingImobiliarias ? (
              <div className="py-10 text-sm text-dark-muted">Carregando imobiliárias...</div>
            ) : imobiliariasList.length === 0 ? (
              <CrmEmptyState icon={Building2} title="Sem imobiliárias" description="A base de imobiliárias será mostrada aqui assim que estiver sincronizada." compact />
            ) : (
              <div className="space-y-3">
                {imobiliariasList.map(imob => {
                  const flow = flowByImob[imob.id] || buildFlowDefaults(imob)
                  return (
                    <button
                      key={imob.id}
                      type="button"
                      onClick={() => navigate(`/imobiliarias/${imob.id}`)}
                      className="w-full rounded-[22px] border border-dark-border/50 bg-white/60 p-4 text-left transition-colors hover:border-brand-accent/40"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dark-border/40 bg-white">
                          {getEntityImageUrl(imob.imagem_path, imob.imagem_url) ? (
                            <img src={getEntityImageUrl(imob.imagem_path, imob.imagem_url)} alt={imob.nome_canonico} className="h-full w-full object-cover" />
                          ) : (
                            <Building2 className="h-6 w-6 text-dark-muted" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-dark-text">{imob.nome_canonico}</p>
                              <p className="text-xs text-dark-muted">{imob.leads} leads · {imob.vendas} vendas</p>
                            </div>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${imob.ativa ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-900/[0.05] text-dark-muted'}`}>
                              {imob.ativa ? 'Ativa' : 'Inativa'}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-dark-muted">
                            <span className="rounded-full bg-slate-900/[0.05] px-2 py-1">Comissão {flow.recebeComissao ? 'sim' : 'não'}</span>
                            {flow.pctComissao && <span className="rounded-full bg-slate-900/[0.05] px-2 py-1">{flow.pctComissao}%</span>}
                            <span className="rounded-full bg-brand-accent/10 px-2 py-1 text-brand-accent">{apolicesPorImob[String(imob.nome_canonico || '').toLowerCase()] || 0} apólices</span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); saveImobiliariaFlow(imob.id, { recebeComissao: !flow.recebeComissao }) }}
                              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${flow.recebeComissao ? 'bg-emerald-500/10 text-emerald-700' : 'bg-slate-900/[0.05] text-dark-muted'}`}
                            >
                              Recebe comissão
                            </button>
                            <input
                              type="number"
                              inputMode="decimal"
                              onClick={e => e.stopPropagation()}
                              className="input w-24 py-1.5 text-xs"
                              placeholder="%"
                              value={flow.pctComissao || ''}
                              onChange={e => saveImobiliariaFlow(imob.id, { pctComissao: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </CrmSectionCard>

          <CrmSectionCard title="Top imobiliárias" subtitle="Relações mais acionadas pela operação.">
            <div className="space-y-3">
              {[...partnerOverview]
                .sort((a, b) => (apolicesPorImob[b.nome.toLowerCase()] || 0) - (apolicesPorImob[a.nome.toLowerCase()] || 0))
                .map(item => (
                <div key={item.nome} className="rounded-[18px] border border-dark-border/50 bg-white/60 p-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-brand-accent" />
                    <p className="font-semibold text-dark-text">{item.nome}</p>
                  </div>
                  <p className="mt-2 text-sm text-dark-muted">{apolicesPorImob[item.nome.toLowerCase()] || 0} apólices emitidas conosco.</p>
                </div>
              ))}
            </div>
          </CrmSectionCard>
        </div>
      )}

      {tab === 'growth' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <CrmSectionCard title="Planning & Growth" subtitle="Define foco, cadência e prioridades do mês.">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[22px] border border-dark-border/50 bg-white/60 p-4 md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dark-muted">Mês de planejamento</p>
                    <p className="mt-2 text-sm font-semibold text-dark-text">{format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}</p>
                  </div>
                  <span className="badge badge-info">Objetivos por setor</span>
                </div>
              </div>
              <div className="rounded-[22px] border border-dark-border/50 bg-white/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dark-muted">Setor de fichas</p>
                <p className="mt-2 text-sm font-semibold text-dark-text">Objetivo de fichas aprovadas e fichas passadas por mês.</p>
                <input className="input mt-3" placeholder="Meta do setor" />
              </div>
              <div className="rounded-[22px] border border-dark-border/50 bg-white/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dark-muted">Setor de emissões</p>
                <p className="mt-2 text-sm font-semibold text-dark-text">Objetivo de emissões feitas, com foco em prêmio líquido.</p>
                <input className="input mt-3" placeholder="Meta do setor" />
              </div>
              <div className="rounded-[22px] border border-dark-border/50 bg-white/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dark-muted">Renovação AUTO</p>
                <p className="mt-2 text-sm font-semibold text-dark-text">Objetivo de lucro mensal baseado em prêmio líquido e comissão.</p>
                <input className="input mt-3" placeholder="Meta de lucro" />
              </div>
              <div className="rounded-[22px] border border-dark-border/50 bg-white/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dark-muted">Comercial</p>
                <p className="mt-2 text-sm font-semibold text-dark-text">Definir objetivos por vendedor, por origem e por produto.</p>
                <input className="input mt-3" placeholder="Meta comercial" />
              </div>
            </div>
          </CrmSectionCard>

          <CrmSectionCard title="Histórico de lotes" subtitle="Últimas distribuições registradas no cockpit.">
            {history.length === 0 ? (
              <CrmEmptyState icon={RefreshCw} title="Sem histórico ainda" description="Quando os lotes forem distribuídos, as execuções recentes aparecem aqui." compact />
            ) : (
              <div className="space-y-3">
                {history.map(item => (
                  <div key={item.id} className="rounded-[18px] border border-dark-border/50 bg-white/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-dark-text">{sourceLabel(item.source)}</p>
                      <span className="text-xs text-dark-muted">{format(parseISO(item.createdAt), 'dd/MM HH:mm', { locale: ptBR })}</span>
                    </div>
                    <p className="mt-1 text-sm text-dark-muted">{item.imported}/{item.total} leads distribuídos</p>
                    <p className="mt-1 text-xs text-dark-muted">Objetivo: {item.objective}</p>
                  </div>
                ))}
              </div>
            )}
          </CrmSectionCard>
        </div>
      )}
    </div>
  )
}
