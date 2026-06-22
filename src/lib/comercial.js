import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// ── Constantes ────────────────────────────────────────────────────────────────

export const PIPELINE_COLS = [
  { id: 'contato',        label: 'Contato Feito',            color: '#3B82F6' },
  { id: 'relacionamento', label: 'Início de Relacionamento', color: '#8B5CF6' },
  { id: 'oferta',         label: 'Oferta Feita',             color: '#F59E0B' },
  { id: 'negociando',     label: 'Negociando',               color: '#EC4899' },
  { id: 'venda',          label: 'Venda',                    color: '#10B981' },
  { id: 'followup',       label: 'Follow Up',                color: '#06B6D4' },
  { id: 'recusou',        label: 'Recusou',                  color: '#EF4444' },
]

export const PRODUTOS = [
  { id: 'seguro_vida',       label: 'Seguro de Vida',     cor: '#E74C3C' },
  { id: 'seguro_auto',       label: 'Seguro Auto',        cor: '#3498DB' },
  { id: 'plano_saude',       label: 'Plano de Saúde',     cor: '#2ECC71' },
  { id: 'seguro_celular',    label: 'Seguro Celular',     cor: '#9B59B6' },
  { id: 'consorcio',         label: 'Consórcio',          cor: '#F39C12' },
  { id: 'seguro_transporte', label: 'Seguro Transporte',  cor: '#1ABC9C' },
  { id: 'rc_empresarial',    label: 'RC Empresarial',     cor: '#34495E' },
  { id: 'seguro_incendio',   label: 'Seguro Incêndio',    cor: '#E67E22' },
]

export const COMERCIAL_PRODUTO_OPTIONS = [
  { id: 'seguro_fianca', label: 'Seguro Fiança', cor: '#2563EB' },
  ...PRODUTOS,
]

export const COMERCIAL_PAPEIS = ['vendedor', 'gestor']

export function getCommercialRole(profile) {
  const areas = Array.isArray(profile?.areas_atuacao) ? profile.areas_atuacao : []
  if (profile?.is_admin) return 'gestor'
  if (areas.includes('gestor')) return 'gestor'
  return 'vendedor'
}

export function canManageCommercial(profile) {
  return getCommercialRole(profile) === 'gestor'
}

export function normalizeCommercialProducts(value) {
  return Array.isArray(value) ? [...new Set(value.filter(Boolean))] : []
}

export function canViewCommercialLead(profile, lead, userId) {
  if (!lead) return false
  if (profile?.is_admin) return true
  if (canManageCommercial(profile)) return true
  if (lead.user_id && userId && lead.user_id === userId) return true
  if (lead.responsavelId && userId && lead.responsavelId === userId) return true
  return false
}

export function filterVisibleCommercialLeads(leads = [], profile, userId) {
  if (profile?.is_admin || canManageCommercial(profile)) return leads
  return leads.filter(lead => canViewCommercialLead(profile, lead, userId))
}

export const TAGS_DEFAULT = [
  { id: 'urgente',        label: 'Urgente',        cor: '#EF4444' },
  { id: 'alto_potencial', label: 'Alto Potencial', cor: '#10B981' },
  { id: 'renovacao',      label: 'Renovação',      cor: '#3B82F6' },
  { id: 'empresarial',    label: 'Empresarial',    cor: '#8B5CF6' },
  { id: 'indicacao',      label: 'Indicação',      cor: '#F59E0B' },
  { id: 'followup',       label: 'Follow Up',      cor: '#06B6D4' },
]

export const ORIGENS        = ['Seguro Fiança', 'Indicação', 'Prospecção', 'Outros Produtos']
export const MOTIVOS_RECUSA = ['Preço', 'Concorrência', 'Sem Interesse', 'Sem Retorno', 'Outro']
export const TIPOS_EVENTO   = ['Reunião', 'Ligação', 'Prospecção', 'Follow Up', 'Tarefa']
export const CORES_EVENTO   = { 'Reunião': '#3B82F6', 'Ligação': '#10B981', 'Prospecção': '#8B5CF6', 'Follow Up': '#F59E0B', 'Tarefa': '#6B7280' }

// ── Scoring ───────────────────────────────────────────────────────────────────

export function calcScore(lead) {
  let s = 30
  if ((lead.telefone || '').replace(/\D/g,'').length >= 10) s += 10
  if (lead.origem === 'Indicação')     s += 20
  if (lead.origem === 'Seguro Fiança') s += 15
  if (lead.apoliceAtiva)               s += 20
  if (lead.ultimaAtividade) {
    const dias = diffDias(lead.ultimaAtividade)
    if (dias <= 3)  s += 10
    if (dias >= 10) s -= 10
  }
  if (lead.jaRecusou)        s -= 20
  if (lead.propostaEnviada && diffDias(lead.propostaEnviada) >= 5) s -= 5
  return Math.max(0, Math.min(100, s))
}

export function scoreFaixa(score) {
  if (score <= 30) return { label: 'Frio',   color: '#EF4444', bg: 'rgba(239,68,68,0.12)'   }
  if (score <= 60) return { label: 'Morno',  color: '#F59E0B', bg: 'rgba(245,158,11,0.12)'  }
  return             { label: 'Quente', color: '#10B981', bg: 'rgba(16,185,129,0.12)' }
}

export function diffDias(iso) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

// ── DB row ↔ JS object mappers ─────────────────────────────────────────────────

function rowToLead(r) {
  return {
    id:              r.id,
    nome:            r.nome,
    telefone:        r.telefone        || '',
    tipo:            r.tipo            || 'PF',
    origem:          r.origem          || '',
    imobiliaria:     r.imobiliaria     || '',
    nomeApolice:     r.nome_apolice    || '',
    tipoLocatario:   r.tipo_locatario  || '',
    coluna:          r.coluna          || 'contato',
    tags:            r.tags            || [],
    score:           r.score           || 0,
    proximaAcao:     r.proxima_acao    || '',
    resumo:          r.resumo          || '',
    observacoes:     r.observacoes     || '',
    ultimaAtividade: r.ultima_atividade,
    apoliceAtiva:    r.apolice_ativa   || false,
    jaRecusou:       r.ja_recusou      || false,
    motivoRecusa:    r.motivo_recusa   || '',
    propostaEnviada: r.proposta_enviada,
    vendaRealizada:  r.venda_realizada || false,
    produtoInteresse: r.produto_interesse || '',
    responsavelId:   r.responsavel_id   || null,
    responsavelNome:  r.responsavel_nome || '',
    distribuidoPor:   r.distribuido_por  || null,
    distribuidoEm:    r.distribuido_em   || null,
    listaPeriodo:     r.lista_periodo    || '',
    listaOrigem:      r.lista_origem     || '',
    objetivo:         r.objetivo         || '',
    renda:            r.renda            ?? null,
    veiculo:          r.veiculo          || '',
    cpf:              r.cpf              || '',
    cnpj:             r.cnpj             || '',
    email:            r.email            || '',
    celular:          r.celular          || '',
    setorOrigem:      r.setor_origem     || '',
    imobiliariaOrigem:r.imobiliaria_origem || '',
    possuiApolice:    r.possui_apolice   || false,
    numeroApolice:    r.numero_apolice   || '',
    informacoesImportantes: r.informacoes_importantes || '',
    dadosInteligencia: r.dados_inteligencia || {},
    historico:            r.historico              || [],
    criadoEm:             r.criado_em,
    jornada_id:           r.jornada_id             || null,
    jornada_etapa_atual:  r.jornada_etapa_atual     || null,
  }
}

function leadToRow(lead, userId) {
  return {
    id:               lead.id,
    user_id:          userId,
    nome:             lead.nome,
    telefone:         lead.telefone        || null,
    tipo:             lead.tipo            || 'PF',
    origem:           lead.origem          || null,
    imobiliaria:      lead.imobiliaria     || null,
    nome_apolice:     lead.nomeApolice     || null,
    tipo_locatario:   lead.tipoLocatario   || null,
    coluna:           lead.coluna          || 'contato',
    tags:             lead.tags            || [],
    score:            lead.score           || 0,
    proxima_acao:     lead.proximaAcao     || null,
    resumo:           lead.resumo          || null,
    observacoes:      lead.observacoes     || null,
    ultima_atividade: lead.ultimaAtividade || null,
    apolice_ativa:    lead.apoliceAtiva    || false,
    ja_recusou:       lead.jaRecusou       || false,
    motivo_recusa:    lead.motivoRecusa    || null,
    proposta_enviada: lead.propostaEnviada || null,
    venda_realizada:  lead.vendaRealizada  || false,
    produto_interesse: lead.produtoInteresse || null,
    responsavel_id:   lead.responsavelId   || userId,
    responsavel_nome:  lead.responsavelNome || null,
    distribuido_por:   lead.distribuidoPor  || null,
    distribuido_em:    lead.distribuidoEm   || null,
    lista_periodo:     lead.listaPeriodo    || null,
    lista_origem:      lead.listaOrigem     || null,
    objetivo:          lead.objetivo        || null,
    renda:             lead.renda           ?? null,
    veiculo:           lead.veiculo         || null,
    cpf:               lead.cpf             || null,
    cnpj:              lead.cnpj            || null,
    email:             lead.email           || null,
    celular:           lead.celular         || null,
    setor_origem:      lead.setorOrigem     || null,
    imobiliaria_origem: lead.imobiliariaOrigem || null,
    possui_apolice:    lead.possuiApolice   || false,
    numero_apolice:    lead.numeroApolice   || null,
    informacoes_importantes: lead.informacoesImportantes || null,
    dados_inteligencia: lead.dadosInteligencia || {},
    historico:        lead.historico       || [],
    criado_em:        lead.criadoEm        || new Date().toISOString(),
  }
}

// Maps only the changed JS fields to their DB column equivalents
const LEAD_MAP = {
  nomeApolice: 'nome_apolice', tipoLocatario: 'tipo_locatario',
  proximaAcao: 'proxima_acao', ultimaAtividade: 'ultima_atividade',
  apoliceAtiva: 'apolice_ativa', jaRecusou: 'ja_recusou',
  motivoRecusa: 'motivo_recusa', propostaEnviada: 'proposta_enviada',
  vendaRealizada: 'venda_realizada', criadoEm: 'criado_em',
  produtoInteresse: 'produto_interesse', responsavelId: 'responsavel_id',
  responsavelNome: 'responsavel_nome', distribuidoPor: 'distribuido_por',
  distribuidoEm: 'distribuido_em', listaPeriodo: 'lista_periodo',
  listaOrigem: 'lista_origem', setorOrigem: 'setor_origem',
  imobiliariaOrigem: 'imobiliaria_origem', possuiApolice: 'possui_apolice',
  numeroApolice: 'numero_apolice', informacoesImportantes: 'informacoes_importantes',
  dadosInteligencia: 'dados_inteligencia',
}
function leadChangesToRow(changes) {
  const row = {}
  for (const [k, v] of Object.entries(changes)) row[LEAD_MAP[k] || k] = v
  return row
}

function rowToSale(r) {
  return {
    id:              r.id,
    leadId:          r.lead_id,
    leadNome:        r.lead_nome        || '',
    produto:         r.produto          || '',
    valor:           r.valor            || 0,
    comissao:        r.comissao         || 0,
    dataEmissao:     r.data_emissao,
    proximoProduto:  r.proximo_produto  || '',
    observacoes:     r.observacoes      || '',
    criadoEm:        r.criado_em,
  }
}

function saleToRow(sale, userId) {
  return {
    id:              sale.id,
    user_id:         userId,
    lead_id:         sale.leadId        || null,
    lead_nome:       sale.leadNome      || null,
    produto:         sale.produto       || null,
    valor:           sale.valor         || 0,
    comissao:        sale.comissao      || 0,
    data_emissao:    sale.dataEmissao   || new Date().toISOString(),
    proximo_produto: sale.proximoProduto || null,
    observacoes:     sale.observacoes   || null,
    criado_em:       sale.criadoEm      || new Date().toISOString(),
  }
}

function rowToEvent(r) {
  return {
    id:        r.id,
    leadId:    r.lead_id,
    nome:      r.nome,
    data:      r.data,
    tipo:      r.tipo       || '',
    descricao: r.descricao  || '',
    auto:      r.auto       || false,
    criadoEm:  r.criado_em,
  }
}

function eventToRow(ev, userId) {
  return {
    id:        ev.id,
    user_id:   userId,
    lead_id:   ev.leadId   || null,
    nome:      ev.nome,
    data:      ev.data,
    tipo:      ev.tipo     || null,
    descricao: ev.descricao || null,
    auto:      ev.auto     || false,
    criado_em: ev.criadoEm || new Date().toISOString(),
  }
}

function eventChangesToRow(changes) {
  const m = { leadId: 'lead_id', criadoEm: 'criado_em' }
  const row = {}
  for (const [k, v] of Object.entries(changes)) row[m[k] || k] = v
  return row
}

function rowToJourney(r) {
  return {
    id:          r.id,
    nome:        r.nome,
    tipoCliente: r.tipo_cliente || '',
    descricao:   r.descricao   || '',
    etapas:      r.etapas      || [],
    criadoEm:    r.criado_em,
  }
}

function journeyToRow(j, userId) {
  return {
    id:           j.id,
    user_id:      userId,
    nome:         j.nome,
    tipo_cliente: j.tipoCliente || null,
    descricao:    j.descricao   || null,
    etapas:       j.etapas      || [],
    criado_em:    j.criadoEm    || new Date().toISOString(),
  }
}

function rowToScript(r) {
  return { id: r.id, titulo: r.titulo, tipo: r.tipo || '', conteudo: r.conteudo || '', criadoEm: r.criado_em }
}

function scriptToRow(sc, userId) {
  return {
    id:        sc.id,
    user_id:   userId,
    titulo:    sc.titulo,
    tipo:      sc.tipo     || null,
    conteudo:  sc.conteudo || null,
    criado_em: sc.criadoEm || new Date().toISOString(),
  }
}

// ── Reactive store ────────────────────────────────────────────────────────────

let _userId   = null
let _loaded   = false
let _state    = { leads: [], events: [], sales: [], journeys: [], scripts: [], tags: TAGS_DEFAULT, meta: 10 }
let _listeners = new Set()

function notify()  { _listeners.forEach(fn => fn()) }
export function getState() { return _state }
export function setState(updater) { _state = updater(_state); notify() }

export function useComercial() {
  const [, tick] = useState(0)
  useEffect(() => {
    const fn = () => tick(n => n + 1)
    _listeners.add(fn)
    return () => _listeners.delete(fn)
  }, [])
  return _state
}

export async function initComercialStore(userId) {
  if (!userId) return
  if (_userId === userId && _loaded) return
  _userId = userId

  try {
    const [leadsRes, salesRes, eventsRes, journeysRes, scriptsRes] = await Promise.all([
      supabase.from('comercial_leads').select('*').order('criado_em', { ascending: false }),
      supabase.from('comercial_vendas').select('*').order('criado_em', { ascending: false }),
      supabase.from('comercial_eventos').select('*').order('data', { ascending: true }),
      supabase.from('comercial_jornadas').select('*').order('criado_em', { ascending: false }),
      supabase.from('comercial_scripts').select('*').order('criado_em', { ascending: false }),
    ])

    const meta = (() => { try { return JSON.parse(localStorage.getItem(`comercial_meta_${userId}`)) || 10 } catch { return 10 } })()

    _state = {
      leads:    (leadsRes.data    || []).map(rowToLead),
      sales:    (salesRes.data    || []).map(rowToSale),
      events:   (eventsRes.data   || []).map(rowToEvent),
      journeys: (journeysRes.data || []).map(rowToJourney),
      scripts:  (scriptsRes.data  || []).map(rowToScript),
      tags:     TAGS_DEFAULT,
      meta,
    }
    _loaded = true
  } catch (err) {
    console.error('initComercialStore:', err)
    _state = { leads: [], events: [], sales: [], journeys: [], scripts: [], tags: TAGS_DEFAULT, meta: 10 }
  }
  notify()
}

// ── CRUD: Leads ───────────────────────────────────────────────────────────────

export const leadAdd = async (lead) => {
  const now  = new Date().toISOString()
  const novo = {
    ...lead,
    id:              crypto.randomUUID(),
    score:           0,
    coluna:          lead.coluna || 'contato',
    criadoEm:        now,
    ultimaAtividade: now,
    responsavelId:   lead.responsavelId || _userId,
    historico:       [{ data: now, desc: 'Lead criado' }],
  }
  setState(s => ({ ...s, leads: [novo, ...s.leads] }))
  const { error } = await supabase.from('comercial_leads').insert(leadToRow(novo, _userId))
  if (error) {
    console.error('leadAdd:', error)
    setState(s => ({ ...s, leads: s.leads.filter(l => l.id !== novo.id) }))
    throw error
  }
  return novo
}

export const leadUpdate = async (id, changes) => {
  const now = new Date().toISOString()
  setState(s => ({ ...s, leads: s.leads.map(l => l.id === id ? { ...l, ...changes, ultimaAtividade: now } : l) }))
  const { error } = await supabase.from('comercial_leads')
    .update({ ...leadChangesToRow(changes), ultima_atividade: now })
    .eq('id', id)
  if (error) console.error('leadUpdate:', error)
}

export const leadMover = async (id, coluna, extra = {}) => {
  const now     = new Date().toISOString()
  const colLabel = PIPELINE_COLS.find(c => c.id === coluna)?.label || coluna
  const lead    = _state.leads.find(l => l.id === id)
  const newHist = [...(lead?.historico || []), { data: now, desc: `Movido para ${colLabel}` }]
  setState(s => ({
    ...s,
    leads: s.leads.map(l => l.id === id
      ? { ...l, coluna, ultimaAtividade: now, historico: newHist, ...extra }
      : l
    ),
  }))
  const { error } = await supabase.from('comercial_leads')
    .update({ coluna, ultima_atividade: now, historico: newHist, ...leadChangesToRow(extra) })
    .eq('id', id)
  if (error) console.error('leadMover:', error)
}

// ── CRUD: Vendas ──────────────────────────────────────────────────────────────

export const saleAdd = async (sale) => {
  const now  = new Date().toISOString()
  const novo = { ...sale, id: crypto.randomUUID(), criadoEm: now }
  setState(s => ({ ...s, sales: [novo, ...s.sales] }))
  const { error } = await supabase.from('comercial_vendas').insert(saleToRow(novo, _userId))
  if (error) {
    console.error('saleAdd:', error)
    setState(s => ({ ...s, sales: s.sales.filter(v => v.id !== novo.id) }))
    throw error
  }
  return novo
}

// ── CRUD: Eventos ─────────────────────────────────────────────────────────────

export const eventAdd = async (ev) => {
  const novo = { ...ev, id: crypto.randomUUID(), criadoEm: new Date().toISOString() }
  setState(s => ({ ...s, events: [...s.events, novo] }))
  const { error } = await supabase.from('comercial_eventos').insert(eventToRow(novo, _userId))
  if (error) {
    console.error('eventAdd:', error)
    setState(s => ({ ...s, events: s.events.filter(e => e.id !== novo.id) }))
    throw error
  }
  return novo
}

export const eventUpdate = async (id, changes) => {
  setState(s => ({ ...s, events: s.events.map(e => e.id === id ? { ...e, ...changes } : e) }))
  const { error } = await supabase.from('comercial_eventos').update(eventChangesToRow(changes)).eq('id', id)
  if (error) console.error('eventUpdate:', error)
}

export const eventDelete = async (id) => {
  setState(s => ({ ...s, events: s.events.filter(e => e.id !== id) }))
  const { error } = await supabase.from('comercial_eventos').delete().eq('id', id)
  if (error) console.error('eventDelete:', error)
}

// ── CRUD: Jornadas ────────────────────────────────────────────────────────────

export const journeyAdd = async (j) => {
  const novo = { ...j, id: crypto.randomUUID(), etapas: j.etapas || [], criadoEm: new Date().toISOString() }
  setState(s => ({ ...s, journeys: [novo, ...s.journeys] }))
  const { error } = await supabase.from('comercial_jornadas').insert(journeyToRow(novo, _userId))
  if (error) {
    console.error('journeyAdd:', error)
    setState(s => ({ ...s, journeys: s.journeys.filter(x => x.id !== novo.id) }))
    throw error
  }
  return novo
}

export const journeyUpdate = async (id, changes) => {
  setState(s => ({ ...s, journeys: s.journeys.map(j => j.id === id ? { ...j, ...changes } : j) }))
  const row = {}
  if ('nome'        in changes) row.nome        = changes.nome
  if ('descricao'   in changes) row.descricao   = changes.descricao
  if ('etapas'      in changes) row.etapas      = changes.etapas
  if ('tipoCliente' in changes) row.tipo_cliente = changes.tipoCliente
  const { error } = await supabase.from('comercial_jornadas').update(row).eq('id', id)
  if (error) console.error('journeyUpdate:', error)
}

export const journeyDelete = async (id) => {
  setState(s => ({ ...s, journeys: s.journeys.filter(j => j.id !== id) }))
  const { error } = await supabase.from('comercial_jornadas').delete().eq('id', id)
  if (error) console.error('journeyDelete:', error)
}

// ── CRUD: Scripts ─────────────────────────────────────────────────────────────

export const scriptAdd = async (sc) => {
  const novo = { ...sc, id: crypto.randomUUID(), criadoEm: new Date().toISOString() }
  setState(s => ({ ...s, scripts: [novo, ...s.scripts] }))
  const { error } = await supabase.from('comercial_scripts').insert(scriptToRow(novo, _userId))
  if (error) {
    console.error('scriptAdd:', error)
    setState(s => ({ ...s, scripts: s.scripts.filter(x => x.id !== novo.id) }))
    throw error
  }
  return novo
}

// ── Tags e Meta (sem persistência no banco — preferências locais) ─────────────

export const tagAdd = (tag) =>
  setState(s => ({ ...s, tags: [...s.tags, { ...tag, id: `tg${Date.now()}` }] }))

export const metaSet = (n) => {
  setState(s => ({ ...s, meta: n }))
  if (_userId) localStorage.setItem(`comercial_meta_${_userId}`, JSON.stringify(n))
}

// ── Supabase import helpers ───────────────────────────────────────────────────

export async function fetchFichasParaImport({ search = '', status = '', produto = '' } = {}) {
  let q = supabase
    .from('fichas')
    .select('id, nome_interessado, cpf, celular, imobiliaria, status, produto')
    .order('created_at', { ascending: false })
    .limit(200)
  if (search.trim()) q = q.ilike('nome_interessado', `%${search}%`)
  if (status)        q = q.eq('status', status)
  if (produto)       q = q.eq('produto', produto)
  const { data } = await q
  return data || []
}

export async function fetchApolicesParaImport({ search = '', imobiliaria = '' } = {}) {
  let q = supabase
    .from('apolices')
    .select('id, nome_interessado, numero_apolice, imobiliaria, status_emissao, produto, seguradora')
    .order('created_at', { ascending: false })
    .limit(200)
  if (search.trim()) q = q.ilike('nome_interessado', `%${search}%`)
  if (imobiliaria)   q = q.eq('imobiliaria', imobiliaria)
  const { data } = await q
  return data || []
}
