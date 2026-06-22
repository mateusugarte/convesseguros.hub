import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  BriefcaseBusiness,
  Building2,
  BrainCircuit,
  CarFront,
  CircleDollarSign,
  Crown,
  FileText,
  Handshake,
  ListFilter,
  Plus,
  RefreshCw,
  Search,
  Target,
  Users,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import {
  canManageCommercial,
  COMERCIAL_PRODUTO_OPTIONS,
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
  { value: 'base', label: 'Base comercial' },
  { value: 'fianca', label: 'Seguro Fiança' },
  { value: 'apolices', label: 'Apólices emitidas' },
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

function sourceBadge(source) {
  if (source === 'fianca') return 'Seguro Fiança'
  if (source === 'apolices') return 'Apólices emitidas'
  return 'Base comercial'
}

function objectiveStorage() {
  try {
    const raw = localStorage.getItem(batchStorageKey)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch {
    return []
  }
}

function historyStorage() {
  try {
    const raw = localStorage.getItem(historyStorageKey)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function toLeadSummary(row, extra = {}) {
  const baseName = row?.nome_interessado || row?.nome || row?.lead_nome || 'Lead sem nome'
  const empresa = row?.nome_empresa || ''
  const cidade = row?.raw_data?.cidade || row?.cidade || ''
  const renda = row?.raw_data?.renda || row?.renda || ''
  const veiculo = row?.raw_data?.veiculo || row?.veiculo || row?.marca_veiculo || ''
  const parts = [empresa, cidade, renda ? `Renda ${formatMoney(renda)}` : '', veiculo].filter(Boolean)

  return {
    id: row.id,
    nome: baseName,
    tipoPessoa: leadTypeFromRow(row, extra.tipoPessoa),
    origem: extra.source === 'fianca' ? 'Seguro Fiança' : extra.source === 'apolices' ? 'Apólices emitidas' : row?.origem || row?.setor_origem || 'Base comercial',
    setorOrigem: row?.setor_origem || extra.source || '',
    produtoInteresse: extra.productId || row?.produto_interesse || row?.produto || '',
    possuiApolice: Boolean(row?.possui_apolice || row?.numero_apolice || row?.apolice_ativa || row?.numero_apolice),
    numeroApolice: row?.numero_apolice || row?.nome_apolice || '',
    celular: row?.celular || row?.telefone || row?.raw_data?.celular || '',
    cpf: row?.cpf || row?.raw_data?.cpf || '',
    cnpj: row?.cnpj || row?.raw_data?.cnpj || '',
    email: row?.email || row?.raw_data?.email || '',
    renda: row?.renda || row?.raw_data?.renda || null,
    veiculo: row?.veiculo || row?.raw_data?.veiculo || '',
    imobiliaria: row?.imobiliaria || row?.imobiliaria_origem || row?.raw_data?.imobiliaria || '',
    resumo: row?.resumo || row?.raw_data?.observacoes || row?.observacoes || '',
    informacoesImportantes: row?.informacoes_importantes || row?.raw_data?.observacoes || '',
    objetivo: extra.objective || '',
    responsavelId: extra.responsavelId || '',
    responsavelNome: extra.responsavelNome || '',
    source: extra.source,
    raw: row,
  }
}

async function fetchRowsBySource(source) {
  if (source === 'fianca') {
    const { data, error } = await supabase
      .from('fichas')
      .select('id, created_at, produto, imobiliaria, nome_interessado, nome_empresa, cpf, cnpj, celular, email, valor_aluguel, valor_iptu, valor_condominio, status, orcamentista_forms, assumida, orcamentista_id, raw_data')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) throw error
    return (data || []).map(row => ({
      ...row,
      tipo: row.produto === 'pessoa_juridica' ? 'pj' : 'pf',
      setor_origem: 'Seguro Fiança',
      possui_apolice: Boolean(row.assumida || row.status === 'emitido'),
      numero_apolice: row.raw_data?.numero_apolice || '',
    }))
  }

  if (source === 'apolices') {
    const { data, error } = await supabase
      .from('apolices')
      .select('id, created_at, produto, seguradora, numero_apolice, imobiliaria, nome_interessado, nome_empresa, cpf, cnpj, celular, email, vigencia, vencimento, status, raw_data')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) throw error
    return (data || []).map(row => ({
      ...row,
      tipo: row.produto === 'pessoa_juridica' ? 'pj' : 'pf',
      setor_origem: 'Apólices emitidas',
      possui_apolice: true,
      numero_apolice: row.numero_apolice || '',
    }))
  }

  const { data, error } = await supabase
    .from('comercial_leads')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(500)

  if (error) throw error
  return data || []
}

export default function GestaoComercial() {
  const { profile, user } = useAuth()
  const toast = useToast()
  const state = useComercial()
  const navigate = useNavigate()

  const [tab, setTab] = useState('painel')
  const [profiles, setProfiles] = useState([])
  const [loadingProfiles, setLoadingProfiles] = useState(false)
  const [objectives, setObjectives] = useState(() => objectiveStorage().length ? objectiveStorage() : DEFAULT_OBJECTIVES)
  const [newObjective, setNewObjective] = useState('')
  const [source, setSource] = useState('fianca')
  const [tipoPessoa, setTipoPessoa] = useState('todos')
  const [objective, setObjective] = useState(DEFAULT_OBJECTIVES[0])
  const [sellerId, setSellerId] = useState('')
  const [search, setSearch] = useState('')
  const [batchLimit, setBatchLimit] = useState(30)
  const [loadingBatch, setLoadingBatch] = useState(false)
  const [batchRows, setBatchRows] = useState([])
  const [rowAssignments, setRowAssignments] = useState({})
  const [history, setHistory] = useState(() => historyStorage())

  const isManager = canManageCommercial(profile)

  useEffect(() => {
    localStorage.setItem(batchStorageKey, JSON.stringify(objectives))
  }, [objectives])

  useEffect(() => {
    localStorage.setItem(historyStorageKey, JSON.stringify(history.slice(0, 15)))
  }, [history])

  useEffect(() => {
    let cancelled = false
    setLoadingProfiles(true)
    supabase
      .from('profiles')
      .select('id, nome, is_admin, areas_atuacao, comercial_produtos, avatar_url')
      .order('nome')
      .then(({ data, error }) => {
        if (!cancelled) {
          if (error) {
            toast({ type: 'error', title: 'Erro ao carregar equipe', message: error.message })
          } else {
            setProfiles(Array.isArray(data) ? data : [])
          }
          setLoadingProfiles(false)
        }
      })
    return () => { cancelled = true }
  }, [toast])

  const sellers = useMemo(
    () => profiles.filter(item => !item.is_admin || item.id === user?.id),
    [profiles, user?.id]
  )

  const visibleLeads = state.leads || []
  const visibleSales = state.sales || []

  const teamOverview = useMemo(() => {
    return sellers.map(member => {
      const ownerLeads = visibleLeads.filter(lead => lead.responsavelId === member.id || lead.user_id === member.id)
      const sales = visibleSales.filter(sale => sale.user_id === member.id)
      const stale = ownerLeads.filter(lead => lead.ultimaAtividade && (Date.now() - new Date(lead.ultimaAtividade).getTime()) >= 7 * 86400000).length
      return {
        id: member.id,
        nome: member.nome,
        leads: ownerLeads.length,
        vendas: sales.length,
        stale,
      }
    })
  }, [sellers, visibleLeads, visibleSales])

  const partnerOverview = useMemo(() => {
    const map = new Map()
    visibleLeads.filter(lead => lead.imobiliaria).forEach(lead => {
      const key = lead.imobiliaria
      const current = map.get(key) || { nome: key, leads: 0, vendas: 0 }
      current.leads += 1
      map.set(key, current)
    })
    return [...map.values()].sort((a, b) => b.leads - a.leads).slice(0, 10)
  }, [visibleLeads])

  const filteredBatch = useMemo(() => {
    return batchRows.filter(row => {
      const term = search.trim().toLowerCase()
      if (!term) return true
      return [
        row.nome,
        row.cpf,
        row.cnpj,
        row.celular,
        row.imobiliaria,
        row.origem,
        row.setorOrigem,
      ].some(value => String(value || '').toLowerCase().includes(term))
    })
  }, [batchRows, search])

  function updateAssignment(rowId, nextSellerId) {
    setRowAssignments(prev => ({ ...prev, [rowId]: nextSellerId }))
  }

  function addObjective() {
    const value = newObjective.trim()
    if (!value) return
    setObjectives(prev => Array.from(new Set([value, ...prev])))
    setNewObjective('')
    toast({ type: 'success', title: 'Objetivo criado' })
  }

  async function generateBatch() {
    setLoadingBatch(true)
    try {
      const rows = await fetchRowsBySource(source)
      const normalized = rows
        .map(row => toLeadSummary(row, {
          source,
          productId: source === 'apolices' ? row.produto || 'seguro_auto' : source === 'fianca' ? 'seguro_fianca' : row.produto_interesse || 'seguro_fianca',
          tipoPessoa,
          objective,
          responsavelId: sellerId || user?.id || '',
          responsavelNome: profiles.find(item => item.id === sellerId)?.nome || profile?.nome || '',
        }))
        .filter(row => {
          if (tipoPessoa === 'pf' && row.tipoPessoa !== 'pf') return false
          if (tipoPessoa === 'pj' && row.tipoPessoa !== 'pj') return false
          return true
        })
        .slice(0, Math.max(1, batchLimit))

      setBatchRows(normalized)
      const nextAssignments = {}
      normalized.forEach(row => { nextAssignments[row.id] = sellerId || user?.id || '' })
      setRowAssignments(nextAssignments)
      toast({ type: 'success', title: 'Lote gerado', message: `${normalized.length} leads preparados para distribuição.` })
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
        const responsavelNome = profiles.find(item => item.id === responsavelId)?.nome || ''
        return leadAdd({
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
          produtoInteresse: row.produtoInteresse,
          responsavelId,
          responsavelNome,
          distribuidoPor: user?.id || null,
          distribuidoEm: new Date().toISOString(),
          listaPeriodo: 'gestao',
          listaOrigem: source,
          objetivo: row.objetivo || objective,
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
        })
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
      toast({ type: 'success', title: 'Lote distribuído', message: `${imported} leads enviados para o comercial.` })
    } catch (error) {
      toast({ type: 'error', title: 'Erro ao distribuir lote', message: error.message })
    }
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
            description="Essa tela organiza o planejamento, a inteligência comercial, a relação com imobiliárias e a distribuição dos lotes."
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
          <CrmMetricCard icon={Handshake} label="Imobiliárias" value={partnerOverview.length} accent="#7C3AED" helper="Relacionamentos ativos" />

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
                <CrmEmptyState
                  icon={Users}
                  title="Sem equipe mapeada"
                  description="Assim que os usuários forem sincronizados, o painel de desempenho aparece aqui."
                  compact
                />
              )}
            </div>
          </CrmSectionCard>

          <CrmSectionCard title="Top imobiliárias" subtitle="Relações mais acionadas pela operação." className="md:col-span-2 xl:col-span-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {partnerOverview.map(item => (
                <div key={item.nome} className="rounded-[20px] border border-dark-border/50 bg-white/60 p-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-brand-accent" />
                    <p className="truncate text-sm font-semibold text-dark-text">{item.nome}</p>
                  </div>
                  <p className="mt-2 text-2xl font-black text-dark-text">{item.leads}</p>
                  <p className="text-xs text-dark-muted">leads no período</p>
                </div>
              ))}
              {!partnerOverview.length && (
                <CrmEmptyState
                  icon={Building2}
                  title="Sem imobiliárias"
                  description="A leitura das imobiliárias entra assim que a base tiver leads com esse vínculo."
                  compact
                />
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
                <Select
                  value={objective}
                  onChange={setObjective}
                  options={objectives.map(item => ({ value: item, label: item }))}
                />
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
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={batchLimit}
                    onChange={event => setBatchLimit(Number(event.target.value))}
                    className="input w-full"
                  />
                </div>
                <div className="flex items-end">
                  <button type="button" onClick={generateBatch} disabled={loadingBatch} className="btn-primary w-full">
                    {loadingBatch ? 'Gerando...' : 'Gerar lote'}
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-dark-muted">Objetivos salvos</p>
                <div className="flex flex-wrap gap-2">
                  {objectives.map(item => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setObjective(item)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                        objective === item ? 'bg-brand-accent text-white' : 'bg-slate-900/[0.04] text-dark-muted hover:text-dark-text'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={newObjective}
                    onChange={event => setNewObjective(event.target.value)}
                    className="input flex-1"
                    placeholder="Novo objetivo"
                  />
                  <button type="button" onClick={addObjective} className="btn-secondary">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </CrmSectionCard>

          <CrmSectionCard
            title="Lote gerado"
            subtitle="Confira as informações e ajuste o responsável por lead antes de distribuir."
            action={batchRows.length > 0 && (
              <button type="button" onClick={distributeBatch} className="btn-primary text-sm">
                Distribuir lote
              </button>
            )}
            className="min-h-[420px]"
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[260px] max-w-md flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-muted" />
                  <input
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    className="input w-full pl-9"
                    placeholder="Buscar por nome, CPF, imobiliária..."
                  />
                </div>
                <span className="badge badge-info">{filteredBatch.length} leads</span>
              </div>

              {filteredBatch.length === 0 ? (
                <CrmEmptyState
                  icon={BrainCircuit}
                  title="Nenhum lote gerado ainda"
                  description="Configure a fonte e clique em gerar lote para montar a lista comercial."
                  compact
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-dark-border/60 text-left">
                        {['Lead', 'Origem', 'Contato', 'Documento', 'Imobiliária', 'Responsável', 'Objetivo', 'Info'].map(header => (
                          <th key={header} className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-dark-muted">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBatch.map(row => (
                        <tr key={row.id} className="border-b border-dark-border/40 align-top last:border-b-0">
                          <td className="px-3 py-4">
                            <p className="font-semibold text-dark-text">{row.nome}</p>
                            <p className="mt-1 text-xs text-dark-muted">{row.tipoPessoa.toUpperCase()} · {row.source === 'apolices' ? 'Apólice' : row.source === 'fianca' ? 'Fiança' : 'Base'}</p>
                            <p className="mt-1 text-xs text-dark-muted">{row.produtoInteresse ? COMERCIAL_PRODUTO_OPTIONS.find(product => product.id === row.produtoInteresse)?.label || row.produtoInteresse : 'Sem produto'}</p>
                          </td>
                          <td className="px-3 py-4 text-xs text-dark-muted">{sourceBadge(row.source)}</td>
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
                              onChange={value => updateAssignment(row.id, value)}
                              searchable
                              options={[{ value: '', label: 'Sem responsável' }, ...sellers.map(item => ({ value: item.id, label: item.nome }))]}
                            />
                          </td>
                          <td className="px-3 py-4 text-xs text-dark-muted">{row.objetivo || objective}</td>
                          <td className="max-w-[220px] px-3 py-4 text-xs text-dark-muted">
                            <p className="line-clamp-3">{row.informacoesImportantes || row.resumo || '—'}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CrmSectionCard>
        </div>
      )}

      {tab === 'imobiliarias' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <CrmSectionCard title="Relacionamento com imobiliárias" subtitle="Controle a carteira atual e enxergue o potencial de reativação.">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {partnerOverview.map(item => (
                <div key={item.nome} className="rounded-[22px] border border-dark-border/50 bg-white/60 p-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-brand-accent" />
                    <p className="font-semibold text-dark-text">{item.nome}</p>
                  </div>
                  <p className="mt-2 text-sm text-dark-muted">{item.leads} lead(s) observados na base.</p>
                </div>
              ))}
            </div>
          </CrmSectionCard>
          <CrmSectionCard title="Prospecção" subtitle="Novas imobiliárias para a rotina do gestor.">
            <div className="space-y-3 text-sm text-dark-muted">
              <div className="rounded-[18px] border border-dark-border/50 bg-white/60 p-4">
                <p className="font-semibold text-dark-text">Reativar imobiliárias dormentes</p>
                <p className="mt-1 text-sm text-dark-muted">Use a inteligência para separar as imobiliárias que já estão habilitadas, mas ainda não produzem no ritmo ideal.</p>
              </div>
              <div className="rounded-[18px] border border-dark-border/50 bg-white/60 p-4">
                <p className="font-semibold text-dark-text">Novas parcerias</p>
                <p className="mt-1 text-sm text-dark-muted">Cadastre contatos, mensagens padrão e argumento de abordagem em uma etapa futura do módulo.</p>
              </div>
            </div>
          </CrmSectionCard>
        </div>
      )}

      {tab === 'growth' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <CrmSectionCard title="Planning & Growth" subtitle="Define foco, cadência e prioridades do mês.">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[22px] border border-dark-border/50 bg-white/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dark-muted">Foco mensal</p>
                <p className="mt-2 text-sm font-semibold text-dark-text">Selecionar produto foco, setor foco e lista foco por vendedor.</p>
              </div>
              <div className="rounded-[22px] border border-dark-border/50 bg-white/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dark-muted">Cadência</p>
                <p className="mt-2 text-sm font-semibold text-dark-text">Semana: distribuição. Mês: acompanhamento. Trimestre: revisão de estratégia.</p>
              </div>
              <div className="rounded-[22px] border border-dark-border/50 bg-white/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dark-muted">Inteligência</p>
                <p className="mt-2 text-sm font-semibold text-dark-text">Separar geração, qualificação e distribuição para não misturar operação com prospecção.</p>
              </div>
              <div className="rounded-[22px] border border-dark-border/50 bg-white/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dark-muted">Growth</p>
                <p className="mt-2 text-sm font-semibold text-dark-text">Mensurar campanhas, listas e conversão por vendedor, por origem e por produto.</p>
              </div>
            </div>
          </CrmSectionCard>

          <CrmSectionCard title="Histórico de lotes" subtitle="Últimas distribuições registradas no cockpit.">
            {history.length === 0 ? (
              <CrmEmptyState
                icon={RefreshCw}
                title="Sem histórico ainda"
                description="Quando os lotes forem distribuídos, as execuções recentes aparecem aqui."
                compact
              />
            ) : (
              <div className="space-y-3">
                {history.map(item => (
                  <div key={item.id} className="rounded-[18px] border border-dark-border/50 bg-white/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-dark-text">{sourceBadge(item.source)}</p>
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
