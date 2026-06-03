import { supabase } from './supabase'

export const STATUS_EMISSAO_LABELS = {
  recebida:             { label: 'Recebida',             color: '#3B82F6' },
  proposta_transmitida: { label: 'Proposta Transmitida', color: '#F59E0B' },
  emitida:              { label: 'Apólice Emitida',      color: '#8B5CF6' },
  enviada:              { label: 'Apólice Enviada',      color: '#10B981' },
}

export const FORMA_PAGAMENTO_LABELS = {
  fatura_sem_entrada: 'Fatura sem entrada',
  fatura_com_entrada: 'Fatura com entrada',
  cartao_credito:     'Cartão de crédito',
}

export const SEGURADORAS_APOLICE = [
  'Porto Seguro', 'Pottencial Seguros', 'TOO Seguros', 'Junto Seguros', 'Tokio Marine', 'Outras',
]

// ── KPIs ─────────────────────────────────────────────────────────────────────

export async function fetchKPIsApolices(inicioMes, fimMes) {
  const inicio90 = new Date()
  inicio90.setDate(inicio90.getDate() - 90)

  const inicioMesAnt = new Date(new Date(inicioMes).getFullYear(), new Date(inicioMes).getMonth() - 1, 1).toISOString()
  const fimMesAnt    = new Date(new Date(inicioMes).getFullYear(), new Date(inicioMes).getMonth(), 0, 23, 59, 59).toISOString()

  const [mesSel, ult90, total, mesAnt] = await Promise.all([
    supabase.from('apolices').select('*', { count: 'exact', head: true })
      .gte('data_emissao', inicioMes).lte('data_emissao', fimMes),
    supabase.from('apolices').select('*', { count: 'exact', head: true })
      .gte('data_emissao', inicio90.toISOString()),
    supabase.from('apolices').select('*', { count: 'exact', head: true }),
    supabase.from('apolices').select('*', { count: 'exact', head: true })
      .gte('data_emissao', inicioMesAnt).lte('data_emissao', fimMesAnt),
  ])

  const mesSelecionado = mesSel.count  || 0
  const mesAnterior    = mesAnt.count  || 0
  const variacaoMes    = mesAnterior > 0
    ? Math.round(((mesSelecionado - mesAnterior) / mesAnterior) * 100)
    : null

  return {
    mesSelecionado,
    ultimos90:  ult90.count  || 0,
    totalGeral: total.count  || 0,
    variacaoMes,
  }
}

export async function fetchApolicesPorDia(inicioMes, fimMes) {
  const { data } = await supabase
    .from('apolices')
    .select('data_emissao')
    .gte('data_emissao', inicioMes)
    .lte('data_emissao', fimMes)
    .not('data_emissao', 'is', null)

  if (!data) return []

  const contagem = {}
  data.forEach(a => {
    const dia = String(a.data_emissao).slice(0, 10)
    contagem[dia] = (contagem[dia] || 0) + 1
  })

  const resultado = []
  const d = new Date(inicioMes)
  const fim = new Date(fimMes)
  while (d <= fim) {
    const key = d.toISOString().slice(0, 10)
    resultado.push({ dia: key, total: contagem[key] || 0 })
    d.setDate(d.getDate() + 1)
  }
  return resultado
}

export async function fetchTopImobiliariasApolices(inicioMes, fimMes, limite = 5) {
  const { data } = await supabase
    .from('apolices')
    .select('imobiliaria')
    .gte('data_emissao', inicioMes)
    .lte('data_emissao', fimMes)
    .not('imobiliaria', 'is', null)

  if (!data) return []
  const cnt = {}
  data.forEach(a => { cnt[a.imobiliaria] = (cnt[a.imobiliaria] || 0) + 1 })
  return Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, limite)
    .map(([nome, total]) => ({ nome, total }))
}

export async function fetchPorSeguradora(inicioMes, fimMes) {
  let q = supabase.from('apolices').select('seguradora')
  if (inicioMes) q = q.gte('data_emissao', inicioMes)
  if (fimMes)    q = q.lte('data_emissao', fimMes)
  const { data } = await q
  if (!data) return []
  const cnt = {}
  data.forEach(a => { const s = a.seguradora || 'Outras'; cnt[s] = (cnt[s] || 0) + 1 })
  return Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([seguradora, value]) => ({ seguradora, value }))
}

// ── Kanban ────────────────────────────────────────────────────────────────────

export async function fetchApolicesKanban({ dateFrom, dateTo, imobiliarias } = {}) {
  let q = supabase
    .from('apolices')
    .select(`
      id, status_emissao, created_at, data_transmissao,
      imobiliaria, numero_apolice, seguradora, valor_parcela,
      proprietario_nome, inicio_vigencia, fim_vigencia, produto,
      nome_interessado, emitido_por,
      fichas!ficha_id(nome_interessado, nome_empresa, cpf, cnpj, produto, celular, cep, tipo_imovel),
      profiles!emitido_por(nome)
    `)
    .order('created_at', { ascending: false })

  if (dateFrom)           q = q.gte('created_at', dateFrom)
  if (dateTo)             q = q.lte('created_at', dateTo)
  if (imobiliarias?.length) q = q.in('imobiliaria', imobiliarias)

  const { data } = await q
  return data || []
}

// ── Lista ─────────────────────────────────────────────────────────────────────

export async function fetchApolicesLista({ dateFrom, dateTo, imobiliarias, seguradora, statusEmissao, busca, page = 0, pageSize = 50 } = {}) {
  let q = supabase
    .from('apolices')
    .select(`
      id, data_emissao, imobiliaria, numero_apolice,
      seguradora, status_emissao, valor_parcela, created_at,
      nome_interessado, emitido_por,
      fichas!ficha_id(nome_interessado, nome_empresa, cpf, cnpj),
      profiles!emitido_por(nome)
    `, { count: 'exact' })
    .order('data_emissao', { ascending: false, nullsLast: true })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (dateFrom) q = q.gte('data_emissao', dateFrom)
  if (dateTo)   q = q.lte('data_emissao', dateTo)
  if (imobiliarias?.length) q = q.in('imobiliaria', imobiliarias)
  if (seguradora)   q = q.eq('seguradora', seguradora)
  if (statusEmissao) q = q.eq('status_emissao', statusEmissao)
  if (busca?.trim()) q = q.or(`numero_apolice.ilike.%${busca.trim()}%,nome_interessado.ilike.%${busca.trim()}%`)

  const { data, count } = await q
  return { data: data || [], count: count || 0 }
}

// ── Detalhe ───────────────────────────────────────────────────────────────────

export async function fetchApoliceDetalhe(id) {
  const { data } = await supabase
    .from('apolices')
    .select(`*, fichas!ficha_id(*), profiles!emitido_por(nome)`)
    .eq('id', id)
    .single()
  return data
}

// ── Imobiliárias distintas nas apólices ──────────────────────────────────────

export async function fetchImobiliariasApolices() {
  const { data } = await supabase
    .from('apolices')
    .select('imobiliaria')
    .not('imobiliaria', 'is', null)
  if (!data) return []
  return [...new Set(data.map(a => a.imobiliaria))].sort()
}

// ── Busca de fichas para o modal iniciar emissão ──────────────────────────────

export async function buscarFichasParaEmissao(nome, imobiliarias) {
  let q = supabase
    .from('fichas')
    .select('id, nome_interessado, nome_empresa, cpf, cnpj, produto, imobiliaria, valor_aluguel, celular, cep, tipo_imovel, numero_apolice')
    .in('status', ['aprovado', 'emitido'])
    .limit(15)

  if (nome?.trim()) {
    q = q.or(`nome_interessado.ilike.%${nome.trim()}%,nome_empresa.ilike.%${nome.trim()}%`)
  }
  if (Array.isArray(imobiliarias) && imobiliarias.length) q = q.in('imobiliaria', imobiliarias)
  else if (typeof imobiliarias === 'string' && imobiliarias) q = q.eq('imobiliaria', imobiliarias)

  const { data } = await q
  return data || []
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function criarApolice(dados) {
  const { data, error } = await supabase.from('apolices').insert(dados).select().single()
  return { data, error }
}

export async function atualizarApolice(id, dados) {
  const { error } = await supabase.from('apolices').update(dados).eq('id', id)
  return error
}

export async function excluirApolice(id) {
  const { error } = await supabase.from('apolices').delete().eq('id', id)
  return error
}

export async function moverStatusApolice(id, novoStatus, dadosExtras = {}) {
  const update = { status_emissao: novoStatus, ...dadosExtras }
  // Registra data de transmissão ao mover para "Apólice Enviada"
  if (novoStatus === 'enviada' && !update.data_transmissao) {
    update.data_transmissao = new Date().toISOString()
  }
  const { error } = await supabase.from('apolices').update(update).eq('id', id)
  return error
}
