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

export const TAGS_DEFAULT = [
  { id: 'urgente',        label: 'Urgente',        cor: '#EF4444' },
  { id: 'alto_potencial', label: 'Alto Potencial', cor: '#10B981' },
  { id: 'renovacao',      label: 'Renovação',      cor: '#3B82F6' },
  { id: 'empresarial',    label: 'Empresarial',    cor: '#8B5CF6' },
  { id: 'indicacao',      label: 'Indicação',      cor: '#F59E0B' },
  { id: 'followup',       label: 'Follow Up',      cor: '#06B6D4' },
]

export const ORIGENS          = ['Seguro Fiança', 'Indicação', 'Prospecção', 'Outros Produtos']
export const MOTIVOS_RECUSA   = ['Preço', 'Concorrência', 'Sem Interesse', 'Sem Retorno', 'Outro']
export const TIPOS_EVENTO     = ['Reunião', 'Ligação', 'Prospecção', 'Follow Up', 'Tarefa']
export const CORES_EVENTO     = { 'Reunião': '#3B82F6', 'Ligação': '#10B981', 'Prospecção': '#8B5CF6', 'Follow Up': '#F59E0B', 'Tarefa': '#6B7280' }

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
  if (score <= 30) return { label: 'Frio',   color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   emoji: '🧊' }
  if (score <= 60) return { label: 'Morno',  color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  emoji: '🌡️' }
  return             { label: 'Quente', color: '#10B981', bg: 'rgba(16,185,129,0.12)', emoji: '🔥' }
}

export function diffDias(iso) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

// ── UserId namespacing ────────────────────────────────────────────────────────

let _userId     = null
let _storageKey = 'conves_comercial_v3'

export function initComercialStore(userId) {
  if (!userId || _userId === userId) return
  _userId     = userId
  _storageKey = `conves_comercial_v3_${userId}`
  _state      = loadState()
  notify()
}

// ── Estado inicial ────────────────────────────────────────────────────────────

const d = (n) => new Date(Date.now() - n * 86400000).toISOString()

const INITIAL_LEADS = [
  { id: 'l1',  nome: 'Ana Costa',         telefone: '(11) 98765-4321', tipo: 'PF', origem: 'Seguro Fiança', imobiliaria: 'Imob São Paulo', nomeApolice: '2024-0091', tipoLocatario: 'Locatário',   coluna: 'contato',        tags: ['indicacao'],                score: 0, proximaAcao: 'Ligar amanhã cedo',              observacoes: 'Muito receptiva', resumo: 'Locatária com bom histórico, alta chance de cross-sell', ultimaAtividade: d(1),  apoliceAtiva: true,  criadoEm: d(5),  historico: [{ data: d(5), desc: 'Lead criado' }, { data: d(1), desc: 'Contato realizado por telefone' }] },
  { id: 'l2',  nome: 'Carlos Mendes',     telefone: '(21) 99887-6543', tipo: 'PF', origem: 'Indicação',    imobiliaria: '',               nomeApolice: '',          tipoLocatario: '',             coluna: 'relacionamento', tags: ['alto_potencial'],           score: 0, proximaAcao: 'Enviar proposta de seguro de vida',              observacoes: 'Indicado pela Dra. Beatriz', resumo: 'Médico, alta renda, potencial para seguro de vida', ultimaAtividade: d(2),  apoliceAtiva: false, criadoEm: d(8),  historico: [{ data: d(8), desc: 'Lead criado via indicação' }] },
  { id: 'l3',  nome: 'Tech Solutions LTDA', telefone: '(11) 3344-5566', tipo: 'PJ', origem: 'Prospecção', imobiliaria: '',               nomeApolice: '',          tipoLocatario: '',             coluna: 'oferta',         tags: ['empresarial', 'alto_potencial'], score: 0, proximaAcao: 'Aguardar retorno proposta RC', observacoes: '50 funcionários', resumo: 'Empresa de tecnologia, necessita RC e seguro incêndio', ultimaAtividade: d(4),  apoliceAtiva: false, criadoEm: d(12), propostaEnviada: d(3), historico: [{ data: d(12), desc: 'Lead criado' }, { data: d(3), desc: 'Proposta enviada' }] },
  { id: 'l4',  nome: 'Maria Oliveira',    telefone: '(31) 97766-5544', tipo: 'PF', origem: 'Seguro Fiança', imobiliaria: 'MG Imóveis',   nomeApolice: '2023-0412', tipoLocatario: 'Locatário',   coluna: 'negociando',     tags: ['urgente', 'renovacao'],    score: 0, proximaAcao: 'Fechar proposta até sexta',               observacoes: 'Contrato vence em 30 dias', resumo: 'Renovação urgente, cliente fidelizada', ultimaAtividade: d(1),  apoliceAtiva: true,  criadoEm: d(10), historico: [{ data: d(10), desc: 'Lead criado' }, { data: d(1), desc: 'Em negociação de valores' }] },
  { id: 'l5',  nome: 'Roberto Alves',     telefone: '(11) 95555-4444', tipo: 'PF', origem: 'Prospecção',   imobiliaria: '',               nomeApolice: '',          tipoLocatario: '',             coluna: 'followup',       tags: ['followup'],                score: 0, proximaAcao: 'Tentar contato novamente na 3ª feira',          observacoes: 'Pediu tempo', resumo: 'Cliente em avaliação, sem urgência aparente', ultimaAtividade: d(8),  apoliceAtiva: false, criadoEm: d(20), historico: [{ data: d(20), desc: 'Lead criado' }, { data: d(8), desc: 'Proposta recusada, segue em follow up' }] },
  { id: 'l6',  nome: 'Silvana Ferreira',  telefone: '(41) 98866-7755', tipo: 'PF', origem: 'Indicação',    imobiliaria: '',               nomeApolice: '',          tipoLocatario: '',             coluna: 'contato',        tags: ['indicacao', 'alto_potencial'], score: 0, proximaAcao: 'Agendar reunião inicial',            observacoes: 'Indicada pela Maria', resumo: 'Médica, renda elevada, potencial premium', ultimaAtividade: d(0),  apoliceAtiva: false, criadoEm: d(2),  historico: [{ data: d(2), desc: 'Lead criado via indicação' }] },
  { id: 'l7',  nome: 'Grupo Rio Comércio', telefone: '(21) 3322-1100', tipo: 'PJ', origem: 'Outros Produtos', imobiliaria: '',            nomeApolice: '',          tipoLocatario: '',             coluna: 'recusou',        tags: ['empresarial'],             score: 0, proximaAcao: '',                                               observacoes: 'Optou pela concorrência', resumo: 'Grande empresa, perdida por preço', ultimaAtividade: d(15), apoliceAtiva: false, criadoEm: d(30), jaRecusou: true, motivoRecusa: 'Concorrência', historico: [{ data: d(30), desc: 'Lead criado' }, { data: d(15), desc: 'Recusou — Concorrência' }] },
  { id: 'l8',  nome: 'Fernando Lima',     telefone: '(85) 99944-3322', tipo: 'PF', origem: 'Seguro Fiança', imobiliaria: 'Imob Fortaleza', nomeApolice: '2022-1100', tipoLocatario: 'Locatário',  coluna: 'relacionamento', tags: ['renovacao'],               score: 0, proximaAcao: 'Reativar contato com nova proposta',             observacoes: 'Locatário há 3 anos', resumo: 'Cliente fiel, parado há 11 dias', ultimaAtividade: d(11), apoliceAtiva: true,  criadoEm: d(25), historico: [{ data: d(25), desc: 'Lead criado' }] },
  { id: 'l9',  nome: 'Beatriz Santos',    telefone: '(48) 98777-6655', tipo: 'PF', origem: 'Indicação',    imobiliaria: '',               nomeApolice: '',          tipoLocatario: '',             coluna: 'oferta',         tags: ['indicacao'],               score: 0, proximaAcao: 'Ligar para saber decisão',               observacoes: 'Quer plano para família', resumo: 'Família de 4 pessoas, busca plano saúde', ultimaAtividade: d(6),  apoliceAtiva: false, criadoEm: d(14), propostaEnviada: d(4), historico: [{ data: d(14), desc: 'Lead criado' }, { data: d(4), desc: 'Proposta enviada' }] },
  { id: 'l10', nome: 'Construtora Norte', telefone: '(92) 3355-7788', tipo: 'PJ', origem: 'Prospecção',   imobiliaria: '',               nomeApolice: '',          tipoLocatario: '',             coluna: 'venda',          tags: ['empresarial', 'alto_potencial'], score: 0, proximaAcao: 'Oferecer seguro incêndio', observacoes: 'Fechou RC completo', resumo: 'Construtora de médio porte, 120 funcionários', ultimaAtividade: d(0),  apoliceAtiva: false, criadoEm: d(18), vendaRealizada: true, historico: [{ data: d(18), desc: 'Lead criado' }, { data: d(0), desc: 'Venda realizada — RC Empresarial' }] },
]

const INITIAL_EVENTS = [
  { id: 'ev1', nome: 'Reunião — Ana Costa',       data: new Date(new Date().setHours(10, 0, 0, 0)).toISOString(), tipo: 'Reunião',    descricao: 'Apresentar proposta seguro de vida', leadId: 'l1', auto: false },
  { id: 'ev2', nome: 'Ligação — Carlos Mendes',   data: new Date(new Date().setHours(14,30, 0, 0)).toISOString(), tipo: 'Ligação',    descricao: 'Follow up da proposta', leadId: 'l2', auto: false },
  { id: 'ev3', nome: 'Follow Up — Tech Solutions', data: new Date(Date.now() + 1*86400000).toISOString(),          tipo: 'Follow Up',  descricao: 'Auto: acompanhar proposta RC', leadId: 'l3', auto: true  },
  { id: 'ev4', nome: 'Reunião — Maria Oliveira',   data: new Date(Date.now() + 2*86400000).toISOString(),          tipo: 'Reunião',    descricao: 'Fechar renovação seguro fiança', leadId: 'l4', auto: false },
  { id: 'ev5', nome: 'Prospecção — Zona Sul',      data: new Date(Date.now() + 3*86400000).toISOString(),          tipo: 'Prospecção', descricao: 'Visitar imobiliárias região sul', leadId: null, auto: false },
]

const INITIAL_SALES = [
  { id: 'sv1', leadId: 'l10', leadNome: 'Construtora Norte', produto: 'rc_empresarial', valor: 8500, comissao: 12, dataEmissao: d(0),  proximoProduto: 'seguro_incendio', observacoes: 'Pacote empresarial' },
  { id: 'sv2', leadId: 'l4',  leadNome: 'Maria Oliveira',    produto: 'seguro_vida',    valor: 1200, comissao: 15, dataEmissao: d(5),  proximoProduto: 'plano_saude',     observacoes: '' },
  { id: 'sv3', leadId: 'l2',  leadNome: 'Carlos Mendes',     produto: 'seguro_auto',    valor: 2400, comissao: 10, dataEmissao: d(10), proximoProduto: null,              observacoes: 'Cliente satisfeito' },
]

const INITIAL_JOURNEYS = [
  { id: 'jn1', nome: 'Jornada Seguro Fiança', tipoCliente: 'PF', descricao: 'Abordar clientes existentes de seguro fiança para oferecer proteção complementar', etapas: ['Primeiro Contato', 'Envio de Proposta', 'Follow Up'] },
  { id: 'jn2', nome: 'Abordagem Empresarial',  tipoCliente: 'PJ', descricao: 'Jornada para empresas que precisam de cobertura de responsabilidade civil e patrimônio', etapas: ['Diagnóstico Gratuito', 'Proposta RC', 'Fechamento'] },
]

const INITIAL_SCRIPTS = [
  { id: 'sc1', titulo: 'Primeiro Contato — Indicação',  tipo: 'Abordagem',   conteudo: 'Olá [Nome]! Meu nome é [Seu Nome] da Conves Seguros. [Indicador] me passou seu contato pois acredito que posso te ajudar com proteção financeira. Você tem 5 minutos?' },
  { id: 'sc2', titulo: 'Objeção de Preço — Playbook',   tipo: 'Objeção',     conteudo: '1. Reconheça: "Entendo sua preocupação com o investimento"\n2. Pergunte: "Comparando com o quê?"\n3. Apresente valor: mostre coberturas e exemplos de sinistros\n4. Parcele: ofereça opções de pagamento\n5. Urgência: "Imprevistos não avisam"' },
  { id: 'sc3', titulo: 'Benefícios Seguro de Vida',      tipo: 'Material',    conteudo: 'Coberturas:\n• Morte natural e acidental\n• Invalidez permanente total\n• Doenças graves (câncer, infarto, AVC)\n• Assistência funeral\n\nDiferenciais Conves: prazo de carência reduzido, atendimento 24h, rede nacional' },
  { id: 'sc4', titulo: 'Treinamento — Rapport Inicial',  tipo: 'Treinamento', conteudo: 'Os primeiros 30 segundos definem o tom da conversa:\n1. Tom de voz: confiante mas amigável\n2. Espelhamento: adapte seu ritmo ao do cliente\n3. Nome: use o nome do cliente pelo menos 3x\n4. Escuta ativa: faça perguntas abertas\n5. Anotações: demonstre interesse genuíno' },
]

function createInitial() {
  return { leads: INITIAL_LEADS, events: INITIAL_EVENTS, sales: INITIAL_SALES, journeys: INITIAL_JOURNEYS, scripts: INITIAL_SCRIPTS, tags: TAGS_DEFAULT, meta: 10 }
}

// ── Reactive store ────────────────────────────────────────────────────────────

function loadState() {
  try {
    const s = localStorage.getItem(_storageKey)
    return s ? JSON.parse(s) : createInitial()
  } catch { return createInitial() }
}

let _state     = loadState()
let _listeners = new Set()

function persist() { localStorage.setItem(_storageKey, JSON.stringify(_state)) }
function notify()  { _listeners.forEach(fn => fn()) }

export function getState()  { return _state }

export function setState(updater) {
  _state = updater(_state)
  persist()
  notify()
}

export function useComercial() {
  const [, tick] = useState(0)
  useEffect(() => {
    const fn = () => tick(n => n + 1)
    _listeners.add(fn)
    return () => _listeners.delete(fn)
  }, [])
  return _state
}

// ── CRUD helpers ──────────────────────────────────────────────────────────────

export const leadAdd = (lead) => {
  const novo = { ...lead, id: `l${Date.now()}`, score: 0, coluna: lead.coluna || 'contato', criadoEm: new Date().toISOString(), ultimaAtividade: new Date().toISOString(), historico: [{ data: new Date().toISOString(), desc: 'Lead criado' }] }
  setState(s => ({ ...s, leads: [novo, ...s.leads] }))
  return novo
}

export const leadUpdate = (id, changes) =>
  setState(s => ({ ...s, leads: s.leads.map(l => l.id === id ? { ...l, ...changes, ultimaAtividade: new Date().toISOString() } : l) }))

export const leadMover = (id, coluna, extra = {}) =>
  setState(s => ({ ...s, leads: s.leads.map(l => l.id === id
    ? { ...l, coluna, ultimaAtividade: new Date().toISOString(), historico: [...(l.historico || []), { data: new Date().toISOString(), desc: `Movido para ${PIPELINE_COLS.find(c => c.id === coluna)?.label || coluna}` }], ...extra }
    : l
  )}))

export const eventAdd    = (ev)  => setState(s => ({ ...s, events: [...s.events, { ...ev, id: `ev${Date.now()}` }] }))
export const eventUpdate = (id, changes) => setState(s => ({ ...s, events: s.events.map(e => e.id === id ? { ...e, ...changes } : e) }))
export const eventDelete = (id)  => setState(s => ({ ...s, events: s.events.filter(e => e.id !== id) }))

export const saleAdd = (sale) => setState(s => ({ ...s, sales: [{ ...sale, id: `sv${Date.now()}` }, ...s.sales] }))

export const journeyAdd    = (j) => { const novo = { ...j, id: `jn${Date.now()}`, etapas: j.etapas || [] }; setState(s => ({ ...s, journeys: [novo, ...s.journeys] })); return novo }
export const journeyUpdate = (id, changes) => setState(s => ({ ...s, journeys: s.journeys.map(j => j.id === id ? { ...j, ...changes } : j) }))

export const scriptAdd = (sc) => setState(s => ({ ...s, scripts: [{ ...sc, id: `sc${Date.now()}` }, ...s.scripts] }))
export const tagAdd    = (tag) => setState(s => ({ ...s, tags: [...s.tags, { ...tag, id: `tg${Date.now()}` }] }))
export const metaSet   = (n)   => setState(s => ({ ...s, meta: n }))

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
