import { supabase } from './supabase'
import { normalizeDisplayText } from './text'
import { parseDecimalBR } from './numberInput'

export const STATUS_EMISSAO_LABELS = {
  recebida:             { label: 'Recebida',             color: '#3B82F6' },
  proposta_transmitida: { label: 'Proposta Transmitida', color: '#F59E0B' },
  emitida:              { label: 'Apólice Emitida',      color: '#8B5CF6' },
  enviada:              { label: 'Apólice Enviada',      color: '#059669' },
}

export const FORMA_PAGAMENTO_LABELS = {
  fatura_sem_entrada: 'Fatura sem entrada',
  fatura_com_entrada: 'Fatura com entrada',
  cartao_credito:     'Cartão de crédito',
}

export const SEGURADORAS_APOLICE = [
  'Porto Seguro', 'Pottencial Seguros', 'TOO Seguros', 'Junto Seguros', 'Tokio Marine', 'Outras',
]

export function toNumber(value) {
  return parseDecimalBR(value)
}

export function normalizePercent(value) {
  const parsed = toNumber(value)
  if (parsed === null) return null
  return parsed > 1 ? parsed / 100 : parsed
}

export function calculatePremioTotal(valorParcela, parcelamento) {
  const parcela = toNumber(valorParcela)
  const parcelas = toNumber(parcelamento)
  if (!parcela || !parcelas) return null
  return parcela * parcelas
}

export function calculateValorComissao(premioLiquido, pctComissao) {
  const premio = toNumber(premioLiquido)
  const pct = normalizePercent(pctComissao)
  if (!premio || pct === null) return null
  return premio * pct
}

export function formatMoneyBR(v) {
  if (v === null || v === undefined || v === '') return '—'
  const parsed = toNumber(v)
  if (parsed === null || !Number.isFinite(parsed)) return '—'
  return `R$ ${parsed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── KPIs ─────────────────────────────────────────────────────────────────────

export async function fetchKPIsApolices(inicioMes, fimMes) {
  const inicio90 = new Date()
  inicio90.setDate(inicio90.getDate() - 90)

  const inicioMesAnt = new Date(new Date(inicioMes).getFullYear(), new Date(inicioMes).getMonth() - 1, 1).toISOString()
  const fimMesAnt    = new Date(new Date(inicioMes).getFullYear(), new Date(inicioMes).getMonth(), 0, 23, 59, 59).toISOString()

  const [mesSel, ult90, total, mesAnt] = await Promise.all([
    supabase.from('apolices').select('id', { count: 'exact', head: true })
      .in('status_emissao', ['emitida', 'enviada'])
      .gte('data_emissao', inicioMes).lte('data_emissao', fimMes),
    supabase.from('apolices').select('id', { count: 'exact', head: true })
      .in('status_emissao', ['emitida', 'enviada'])
      .gte('data_emissao', inicio90.toISOString()),
    supabase.from('apolices').select('id', { count: 'exact', head: true })
      .in('status_emissao', ['emitida', 'enviada']),
    supabase.from('apolices').select('id', { count: 'exact', head: true })
      .in('status_emissao', ['emitida', 'enviada'])
      .gte('data_emissao', inicioMesAnt).lte('data_emissao', fimMesAnt),
  ])

  const mesSelecionado = mesSel.count  || 0
  const mesAnterior    = mesAnt.count  || 0
  const variacaoMes    = mesAnterior > 0
    ? Math.round(((mesSelecionado - mesAnterior) / mesAnterior) * 100)
    : null

  const [producaoMes, comissaoMes] = await Promise.all([
    supabase.from('apolices').select('valor_producao', { count: 'exact' })
      .in('status_emissao', ['emitida', 'enviada'])
      .gte('data_emissao', inicioMes).lte('data_emissao', fimMes),
    supabase.from('apolices').select('valor_comissao', { count: 'exact' })
      .in('status_emissao', ['emitida', 'enviada'])
      .gte('data_emissao', inicioMes).lte('data_emissao', fimMes),
  ])

  const totalProducaoPremio = (producaoMes.data || []).reduce((sum, item) => sum + (toNumber(item.premio_total ?? item.valor_producao) || 0), 0)
  const totalComissao = (comissaoMes.data || []).reduce((sum, item) => sum + (toNumber(item.valor_comissao) || 0), 0)

  return {
    mesSelecionado,
    ultimos90:  ult90.count  || 0,
    totalGeral: total.count  || 0,
    variacaoMes,
    totalProducao: totalProducaoPremio || totalProducao,
    totalComissao,
  }
}

export async function fetchApolicesPorDia(inicioMes, fimMes) {
  const { data } = await supabase
    .from('apolices')
    .select('data_emissao')
    .in('status_emissao', ['emitida', 'enviada'])
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
    .in('status_emissao', ['emitida', 'enviada'])
    .gte('data_emissao', inicioMes)
    .lte('data_emissao', fimMes)
    .not('imobiliaria', 'is', null)

  if (!data) return []
  const cnt = {}
  data.forEach(a => { cnt[a.imobiliaria] = (cnt[a.imobiliaria] || 0) + 1 })
  return Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, limite)
    .map(([nome, total]) => ({ nome, total }))
}

export async function fetchProducaoPorSeguradora(inicioMes, fimMes) {
  let q = supabase
    .from('apolices')
    .select('seguradora, premio_total, valor_producao')
    .in('status_emissao', ['emitida', 'enviada'])
    .not('seguradora', 'is', null)
    .neq('seguradora', '')
    .or('premio_total.not.is.null,valor_producao.not.is.null')
  if (inicioMes) q = q.gte('data_emissao', inicioMes)
  if (fimMes)    q = q.lte('data_emissao', fimMes)
  const { data } = await q
  if (!data) return []
  const cnt = {}
  data.forEach(a => {
    cnt[a.seguradora] = (cnt[a.seguradora] || 0) + (toNumber(a.premio_total ?? a.valor_producao) || 0)
  })
  return Object.entries(cnt)
    .sort((a, b) => b[1] - a[1])
    .map(([seguradora, value]) => ({ seguradora, value }))
}

// ── Kanban ────────────────────────────────────────────────────────────────────

export async function fetchApolicesKanban({ dateFrom, dateTo, imobiliarias } = {}) {
  let q = supabase
    .from('apolices')
    .select(`
      id, status_emissao, created_at, data_transmissao,
      imobiliaria, numero_apolice, seguradora, valor_parcela, parcelamento,
      premio_liquido, premio_total, valor_producao, valor_comissao, pct_comissao, pct_desconto,
      proprietario_nome, inicio_vigencia, fim_vigencia, produto,
      nome_interessado, emitido_por, celular, cpf, cep, tipo_imovel, valor_aluguel,
      fichas!ficha_id(nome_interessado, nome_empresa, cpf, cnpj, produto, celular, cep, tipo_imovel, valor_aluguel),
      profiles!emitido_por(nome, avatar_url)
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
      seguradora, status_emissao, valor_parcela, parcelamento, premio_liquido,
      premio_total, valor_producao, valor_comissao, pct_comissao, pct_desconto, created_at,
      nome_interessado, emitido_por, ficha_id,
      fichas!ficha_id(nome_interessado, nome_empresa, cpf, cnpj),
      profiles!emitido_por(nome, avatar_url)
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
    .select(`*, fichas!ficha_id(*), profiles!emitido_por(nome, avatar_url)`)
    .eq('id', id)
    .single()
  return data
}

export async function fetchFinanceiroComissoes({ inicio, fim, seguradora } = {}) {
  let q = supabase
    .from('apolices_comissoes')
    .select('*')
    .order('data_emissao', { ascending: false })

  if (inicio) q = q.gte('data_emissao', inicio)
  if (fim) q = q.lte('data_emissao', fim)
  if (seguradora) q = q.eq('seguradora', seguradora)

  const { data } = await q
  return data || []
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

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

async function fetchAllRows(queryFactory, pageSize = 500) {
  let all = []
  let offset = 0
  while (true) {
    const { data, error } = await queryFactory().range(offset, offset + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < pageSize) break
    offset += pageSize
  }
  return all
}

export async function buscarFichasParaEmissao(termo, imobiliarias, modo = 'nome') {
  const termoNormalizado = modo === 'cpf' || modo === 'cnpj'
    ? onlyDigits(termo)
    : normalizeSearchText(termo?.trim())

  const imobiliariasFilter = Array.isArray(imobiliarias)
    ? imobiliarias.filter(Boolean)
    : (typeof imobiliarias === 'string' && imobiliarias ? [imobiliarias] : null)

  const data = await fetchAllRows(() => {
    let q = supabase
      .from('fichas')
      .select('id, nome_interessado, nome_empresa, cpf, cnpj, produto, imobiliaria, valor_aluguel, celular, cep, tipo_imovel, numero_apolice, vigencia, vencimento, origem_lead, observacoes, pct_comissao, pct_desconto, parcelamento, status, raw_data, created_at')
      .eq('status', 'aprovado')
      .order('created_at', { ascending: false })

    if (imobiliariasFilter?.length) q = q.in('imobiliaria', imobiliariasFilter)
    return q
  })
  if (!data.length) return []

  const term = modo === 'cpf' || modo === 'cnpj'
    ? termoNormalizado
    : termoNormalizado

  const filtered = data.filter(f => {
    if (!term) return true

    if (modo === 'cpf') {
      return onlyDigits(f.cpf) === term
    }

    if (modo === 'cnpj') {
      return onlyDigits(f.cnpj) === term
    }

    const rd = f.raw_data || {}
    const haystack = [
      f.nome_interessado,
      f.nome_empresa,
      rd.nome,
      rd.nome_interessado,
      rd.nome_empresa,
      rd.razao_social,
      rd.empresa,
      rd.nome_fantasia,
      f.imobiliaria,
      f.seguradora,
    ]
      .map(normalizeSearchText)
      .join(' ')

    return haystack.includes(term)
  })

  return filtered
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

export async function registrarApoliceDaFicha({
  ficha,
  numeroApolice,
  numeroProposta,
  seguradora,
  dataEmissao,
  emitidoPor,
  proprietarioNome,
  proprietarioCel,
  endereco,
  inicioVigencia,
  fimVigencia,
  parcelamento,
  valorParcela,
  premioLiquido,
  pctComissao,
  pctDesconto,
  formaPagamento,
  observacoes,
}) {
  if (!ficha?.id) return { error: new Error('Ficha invalida') }

  const nomeInteressado = normalizeDisplayText(
    ficha.nome_empresa || ficha.nome_interessado || ficha.raw_data?.nome_empresa || ficha.raw_data?.nome_interessado || ''
  ) || ficha.nome_empresa || ficha.nome_interessado || null

  const apolicePayload = {
    ficha_id: ficha.id,
    imobiliaria: ficha.imobiliaria || null,
    produto: ficha.produto || null,
    nome_interessado: nomeInteressado,
    proprietario_nome: proprietarioNome?.trim() || null,
    proprietario_cel: proprietarioCel?.trim() || null,
    numero_apolice: numeroApolice?.trim() || null,
    numero_proposta: numeroProposta?.trim() || null,
    seguradora: seguradora?.trim() || null,
    emitido_por: emitidoPor || null,
    status_emissao: 'emitida',
    data_emissao: dataEmissao || new Date().toISOString().slice(0, 10),
    endereco: endereco?.trim() || null,
    inicio_vigencia: inicioVigencia || null,
    fim_vigencia: fimVigencia || null,
    tempo_vigencia_meses: inicioVigencia && fimVigencia
      ? Math.max(0, Math.round((new Date(fimVigencia) - new Date(inicioVigencia)) / (1000 * 60 * 60 * 24 * 30)))
      : null,
    parcelamento: parcelamento ? toNumber(parcelamento) : null,
    valor_parcela: valorParcela ?? null,
    premio_liquido: premioLiquido ? toNumber(premioLiquido) : null,
    pct_comissao: pctComissao === '' || pctComissao === undefined ? null : pctComissao,
    pct_desconto: pctDesconto === '' || pctDesconto === undefined ? null : pctDesconto,
    forma_pagamento: formaPagamento?.trim() || null,
    premio_total: valorParcela && parcelamento ? toNumber(valorParcela) * toNumber(parcelamento) : null,
    valor_producao: valorParcela && parcelamento ? toNumber(valorParcela) * toNumber(parcelamento) : null,
    valor_comissao: premioLiquido && pctComissao !== '' ? calculateValorComissao(premioLiquido, pctComissao) : null,
  }

  const { data: existente, error: buscaError } = await supabase
    .from('apolices')
    .select('id')
    .eq('ficha_id', ficha.id)
    .maybeSingle()

  if (buscaError) return { error: buscaError }

  let apolice
  if (existente?.id) {
    const { data, error } = await supabase
      .from('apolices')
      .update(apolicePayload)
      .eq('id', existente.id)
      .select()
      .single()
    if (error) return { error }
    apolice = data
  } else {
    const { data, error } = await supabase
      .from('apolices')
      .insert(apolicePayload)
      .select()
      .single()
    if (error) return { error }
    apolice = data
  }

  const fichaUpdate = {
    status: 'emitido',
    numero_apolice: numeroApolice?.trim() || null,
    seguradora: seguradora?.trim() || null,
    data_emissao: dataEmissao || new Date().toISOString().slice(0, 10),
    ...(observacoes !== undefined ? { observacoes: observacoes?.trim() || null } : {}),
  }

  if (inicioVigencia !== undefined) fichaUpdate.inicio_vigencia = inicioVigencia || null
  if (fimVigencia !== undefined) fichaUpdate.fim_vigencia = fimVigencia || null
  if (valorParcela !== undefined) fichaUpdate.valor_parcela = valorParcela ?? null

  const { error: fichaError } = await supabase.from('fichas').update(fichaUpdate).eq('id', ficha.id)
  if (fichaError) return { error: fichaError, apolice }

  return { apolice, error: null }
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
