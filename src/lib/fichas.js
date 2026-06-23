import { supabase } from './supabase'
import { normalizeImobiliaria } from './normalizeImobiliaria'
import { normalizeDisplayText } from './text'

export { normalizeImobiliaria }

export const STATUS_LABELS = {
  pendente:     { label: 'Pendente',     color: 'badge-info' },
  em_cotacao:   { label: 'Em Cotação',   color: 'badge-warning' },
  em_analise:   { label: 'Em Análise',   color: 'badge-blue' },
  aprovado:     { label: 'Aprovado',     color: 'badge-success' },
  recusado:     { label: 'Recusado',     color: 'badge-danger' },
  emitido:      { label: 'Emitido',      color: 'badge-purple' },
  cancelado:    { label: 'Cancelado',    color: 'badge-muted' },
  cpf_invalido: { label: 'CPF Inválido', color: 'badge-warning' },
  expirada:     { label: 'Expirada',     color: 'badge-muted' },
}

export const PRODUTO_LABELS = {
  residencial_pf:  'Residencial PF',
  comercial_pf:    'Comercial PF',
  pessoa_juridica: 'Pessoa Jurídica',
}

export const SEGURADORAS = [
  'Porto Seguro',
  'Tokio Marine',
  'TOO',
  'Junto Seguros',
  'Potencial',
]

// "Em Aberto" = fichas que ainda precisam de atenção
export const STATUS_EM_ABERTO = ['pendente', 'em_cotacao']

// "Passadas" = fichas já finalizadas/encerradas
export const STATUS_PASSADOS = ['em_analise', 'aprovado', 'recusado', 'emitido', 'cancelado', 'cpf_invalido', 'expirada']

// ── KPIs ─────────────────────────────────────────────────────────────────────

export async function fetchKPIs(inicioFiltro, fimFiltro) {
  const hoje = new Date()
  const inicioHoje   = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString()
  const inicioSemana = (() => {
    const d = new Date(); const day = d.getDay()
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); d.setHours(0,0,0,0); return d.toISOString()
  })()
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  // Aplica filtro de período quando fornecido
  const applyRange = (q) => {
    if (inicioFiltro) q = q.gte('created_at', inicioFiltro)
    if (fimFiltro)    q = q.lte('created_at', fimFiltro)
    return q
  }

  const [{ count: total }, { count: hoje_ }, { count: semana }, { count: mes }, { count: emAberto }] = await Promise.all([
    applyRange(supabase.from('fichas').select('*', { count: 'exact', head: true })),
    applyRange(supabase.from('fichas').select('*', { count: 'exact', head: true })).gte('created_at', inicioHoje),
    applyRange(supabase.from('fichas').select('*', { count: 'exact', head: true })).gte('created_at', inicioSemana),
    applyRange(supabase.from('fichas').select('*', { count: 'exact', head: true })).gte('created_at', inicioMes),
    applyRange(supabase.from('fichas').select('*', { count: 'exact', head: true })).in('status', STATUS_EM_ABERTO),
  ])

  return { total, hoje: hoje_, semana, mes, emAberto }
}

export async function fetchEmitidas(inicio, fim) {
  const now = new Date()
  const defaultInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  let q = supabase.from('fichas').select('*', { count: 'exact', head: true })
    .eq('status', 'emitido')
    .gte('created_at', inicio || defaultInicio)
  if (fim) q = q.lte('created_at', fim)
  const { count } = await q
  return count || 0
}

// ── Batch helper — bypasses Supabase max_rows=1000 via pagination ─────────────

async function fetchAllRows(queryFactory, pageSize = 1000) {
  let all = []
  let offset = 0
  while (true) {
    const { data } = await queryFactory().range(offset, offset + pageSize - 1)
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < pageSize) break
    offset += pageSize
  }
  return all
}

// ── Charts ────────────────────────────────────────────────────────────────────

export async function fetchFichasPorDia(dias = 30) {
  const inicio = new Date()
  inicio.setDate(inicio.getDate() - dias)

  const data = await fetchAllRows(() =>
    supabase.from('fichas').select('created_at, status')
      .gte('created_at', inicio.toISOString()).order('created_at')
  )

  const contagem = {}
  data.forEach(f => {
    const dia = f.created_at.slice(0, 10)
    if (!contagem[dia]) contagem[dia] = { total: 0, aprovadas: 0, recusadas: 0 }
    contagem[dia].total++
    if (f.status === 'aprovado') contagem[dia].aprovadas++
    if (f.status === 'recusado') contagem[dia].recusadas++
  })

  const resultado = []
  for (let i = dias; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    resultado.push({ dia: key, total: contagem[key]?.total || 0, aprovadas: contagem[key]?.aprovadas || 0, recusadas: contagem[key]?.recusadas || 0 })
  }
  return resultado
}

export async function fetchTopImobiliarias(limite = 5, inicioFiltro, fimFiltro) {
  const data = await fetchAllRows(() => {
    let q = supabase.from('fichas').select('imobiliaria').eq('status', 'aprovado').not('imobiliaria', 'is', null)
    if (inicioFiltro) q = q.gte('created_at', inicioFiltro)
    if (fimFiltro)    q = q.lte('created_at', fimFiltro)
    return q
  })
  const contagem = {}
  data.forEach(f => {
    const nome = normalizeImobiliaria(f.imobiliaria) || f.imobiliaria
    contagem[nome] = (contagem[nome] || 0) + 1
  })
  return Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, limite).map(([name, total]) => ({ name, total }))
}

export async function fetchDistribuicaoStatus(inicioFiltro, fimFiltro) {
  const statuses = Object.keys(STATUS_LABELS)
  const results = await Promise.all(
    statuses.map(s => {
      let q = supabase.from('fichas').select('*', { count: 'exact', head: true }).eq('status', s)
      if (inicioFiltro) q = q.gte('created_at', inicioFiltro)
      if (fimFiltro)    q = q.lte('created_at', fimFiltro)
      return q
    })
  )
  return statuses
    .map((s, i) => ({ status: s, label: STATUS_LABELS[s]?.label ?? s, value: results[i].count || 0 }))
    .filter(x => x.value > 0)
    .sort((a, b) => b.value - a.value)
}

const APROVACAO_SEGURADORAS = [
  'Porto',
  'Tokio',
  'Too',
  'Pottencial',
  'Junto',
  'Não informado',
]

function normalizeSeguradoraAprovacao(seguradora) {
  const raw = normalizeDisplayText(seguradora) || ''
  if (!raw) return 'Não informado'

  const text = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  if (text.includes('porto')) return 'Porto'
  if (text.includes('tokio')) return 'Tokio'
  if (text.includes('too')) return 'Too'
  if (text.includes('pottencial') || text.includes('potencial')) return 'Pottencial'
  if (text.includes('junto')) return 'Junto'

  return 'Não informado'
}

export async function fetchAprovacoesPorSeguradora(inicioFiltro, fimFiltro) {
  const data = await fetchAllRows(() => {
    let q = supabase
      .from('fichas')
      .select('seguradora')
      .eq('status', 'aprovado')

    if (inicioFiltro) q = q.gte('created_at', inicioFiltro)
    if (fimFiltro) q = q.lte('created_at', fimFiltro)
    return q
  })

  const contagem = Object.fromEntries(APROVACAO_SEGURADORAS.map(nome => [nome, 0]))
  let total = 0

  data.forEach(item => {
    const bucket = normalizeSeguradoraAprovacao(item.seguradora)
    contagem[bucket] = (contagem[bucket] || 0) + 1
    total += 1
  })

  return APROVACAO_SEGURADORAS.map(seguradora => ({
    seguradora,
    total: contagem[seguradora] || 0,
    value: total ? Math.round(((contagem[seguradora] || 0) / total) * 100) : 0,
  }))
}

export async function fetchFichasPorProdutoMes() {
  const now = new Date()
  const inicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const fim    = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
  const data = await fetchAllRows(() =>
    supabase.from('fichas').select('produto, status').gte('created_at', inicio).lte('created_at', fim)
  )
  const produtos = ['residencial_pf', 'comercial_pf', 'pessoa_juridica']
  return produtos.map(p => {
    const fs = data.filter(f => f.produto === p)
    return {
      name: PRODUTO_LABELS[p],
      total:     fs.length,
      aprovadas: fs.filter(f => f.status === 'aprovado').length,
      recusadas: fs.filter(f => f.status === 'recusado').length,
    }
  })
}

export async function fetchMetricas() {
  const limite48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const [finalizadas_r, aprovadas_r, recusadas_r, semResposta_r, comTempo] = await Promise.all([
    supabase.from('fichas').select('*', { count: 'exact', head: true }).in('status', STATUS_PASSADOS),
    supabase.from('fichas').select('*', { count: 'exact', head: true }).eq('status', 'aprovado'),
    supabase.from('fichas').select('*', { count: 'exact', head: true }).eq('status', 'recusado'),
    supabase.from('fichas').select('*', { count: 'exact', head: true }).eq('status', 'pendente').lte('created_at', limite48h),
    fetchAllRows(() =>
      supabase.from('fichas').select('assumida_em, finalizada_em')
        .not('assumida_em', 'is', null).not('finalizada_em', 'is', null)
    ),
  ])

  const finalizadas    = finalizadas_r.count || 0
  const aprovadas      = aprovadas_r.count || 0
  const recusadas      = recusadas_r.count || 0
  const taxaAprovacao  = finalizadas ? Math.round((aprovadas / finalizadas) * 100) : 0
  const taxaRecusa     = finalizadas ? Math.round((recusadas / finalizadas) * 100) : 0

  let tempoMedio = null
  if (comTempo.length) {
    const mediaMs = comTempo.reduce((a, f) => a + (new Date(f.finalizada_em) - new Date(f.assumida_em)), 0) / comTempo.length
    tempoMedio = Math.round(mediaMs / (1000 * 60 * 60))
  }

  return { taxaAprovacao, taxaRecusa, tempoMedio, semResposta: semResposta_r.count || 0 }
}

export async function fetchAtividadeRecente(limite = 10) {
  const { data } = await supabase
    .from('fichas')
    .select('id, created_at, nome_interessado, produto, imobiliaria, status, profiles!orcamentista_id(nome, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(limite)
  return data || []
}

// ── Product counts ────────────────────────────────────────────────────────────

export async function fetchContagemProdutos() {
  const produtos = ['residencial_pf', 'comercial_pf', 'pessoa_juridica']
  const queries = []
  for (const p of produtos) {
    queries.push(
      supabase.from('fichas').select('*', { count: 'exact', head: true }).eq('produto', p),
      supabase.from('fichas').select('*', { count: 'exact', head: true }).eq('produto', p).in('status', STATUS_EM_ABERTO),
    )
  }
  queries.push(
    supabase.from('fichas').select('*', { count: 'exact', head: true }),
    supabase.from('fichas').select('*', { count: 'exact', head: true }).in('status', STATUS_EM_ABERTO),
  )
  const results = await Promise.all(queries)
  const result = {}
  produtos.forEach((p, i) => {
    result[p] = { total: results[i * 2].count || 0, emAberto: results[i * 2 + 1].count || 0 }
  })
  result.todos = { total: results[6].count || 0, emAberto: results[7].count || 0 }
  return result
}

// ── User fichas ───────────────────────────────────────────────────────────────

export async function fetchFichasDoOrcamentista(orcamentistaId) {
  const { data } = await supabase
    .from('fichas')
    .select('id,created_at,produto,imobiliaria,nome_interessado,cpf,status,assumida,orcamentista_id,assumida_em,seguradora,retorno_enviado,profiles!orcamentista_id(nome, avatar_url)')
    .eq('orcamentista_id', orcamentistaId)
    .eq('status', 'em_cotacao')
    .order('assumida_em', { ascending: false })
  return data || []
}

export async function fetchContagemAbertaOrcamentista(orcamentistaId) {
  const { count } = await supabase.from('fichas').select('*', { count: 'exact', head: true })
    .eq('orcamentista_id', orcamentistaId).eq('status', 'em_cotacao')
  return count || 0
}

// ── Main fichas query ─────────────────────────────────────────────────────────

export async function fetchFichas({ produto, ano, mes, dateFrom, dateTo, tipo, search, imobiliaria, orcamentistaId, semSeguradora, page = 0, pageSize = 30, sortOrder = 'recentes' }) {
  let q = supabase
    .from('fichas')
    .select('id,created_at,produto,imobiliaria,nome_interessado,nome_empresa,cpf,cnpj,status,assumida,orcamentista_id,assumida_em,seguradora,retorno_enviado,raw_data,profiles!orcamentista_id(nome, avatar_url)', { count: 'exact' })
    .order('created_at', { ascending: sortOrder === 'antigas' })

  if (produto && produto !== 'todos') q = q.eq('produto', produto)

  const term = search?.trim()
  if (term) {
    // Busca em todos os campos relevantes
    q = q.or(
      `nome_interessado.ilike.%${term}%,` +
      `nome_empresa.ilike.%${term}%,` +
      `cpf.ilike.%${term}%,` +
      `cnpj.ilike.%${term}%,` +
      `imobiliaria.ilike.%${term}%,` +
      `seguradora.ilike.%${term}%`
    )
  }

  if (imobiliaria) q = q.ilike('imobiliaria', `%${imobiliaria}%`)

  if (dateFrom || dateTo) {
    if (dateFrom) q = q.gte('created_at', dateFrom)
    if (dateTo) q = q.lte('created_at', dateTo)
  } else if (ano && mes && mes !== -1) {
    q = q.gte('created_at', new Date(ano, mes - 1, 1).toISOString())
         .lte('created_at', new Date(ano, mes, 0, 23, 59, 59).toISOString())
  } else if (ano) {
    q = q.gte('created_at', new Date(ano, 0, 1).toISOString())
         .lte('created_at', new Date(ano, 11, 31, 23, 59, 59).toISOString())
  }

  if (tipo === 'passadas') {
    q = q.in('status', STATUS_PASSADOS)
  } else if (tipo === 'abertas') {
    q = q.in('status', STATUS_EM_ABERTO)
  } else if (tipo === 'passadas_por_mim' && orcamentistaId) {
    // Inclui fichas onde o usuário assumiu OU finalizou
    q = q.in('status', STATUS_PASSADOS)
         .or(`orcamentista_id.eq.${orcamentistaId},finalizado_por.eq.${orcamentistaId}`)
  }

  if (semSeguradora) q = q.is('seguradora', null)

  const from = page * pageSize
  q = q.range(from, from + pageSize - 1)

  const { data, count } = await q
  return { data: data || [], count: count || 0 }
}

export async function fetchFichasAprovadasEmissao({ search, imobiliarias } = {}) {
  let q = supabase
    .from('fichas')
    .select(`
      id, created_at, produto, imobiliaria,
      nome_interessado, nome_empresa, cpf, cnpj,
      status, assumida, orcamentista_id, assumida_em,
      seguradora, retorno_enviado, raw_data,
      profiles!orcamentista_id(nome, avatar_url)
    `)
    .eq('status', 'aprovado')
    .order('created_at', { ascending: false })

  if (Array.isArray(imobiliarias) && imobiliarias.length) {
    q = q.in('imobiliaria', imobiliarias)
  }

  const term = search?.trim()
  if (term) {
    q = q.or(
      `nome_interessado.ilike.%${term}%,` +
      `nome_empresa.ilike.%${term}%,` +
      `cpf.ilike.%${term}%,` +
      `cnpj.ilike.%${term}%,` +
      `imobiliaria.ilike.%${term}%,` +
      `seguradora.ilike.%${term}%`
    )
  }

  const data = await fetchAllRows(() => q)
  return data || []
}

export async function fetchFichaDetalhe(id) {
  const { data } = await supabase.from('fichas').select('*, profiles!orcamentista_id(nome, orcamentista_label, avatar_url)').eq('id', id).single()
  return data
}

export async function fetchAnosDisponiveis(produto) {
  const data = await fetchAllRows(() => {
    let q = supabase.from('fichas').select('created_at')
    if (produto && produto !== 'todos') q = q.eq('produto', produto)
    return q
  })
  return [...new Set(data.map(f => new Date(f.created_at).getFullYear()))].sort((a, b) => b - a)
}

export async function fetchMesesDisponiveis(produto, ano) {
  const data = await fetchAllRows(() => {
    let q = supabase.from('fichas').select('created_at')
    if (produto && produto !== 'todos') q = q.eq('produto', produto)
    if (ano) {
      q = q.gte('created_at', new Date(ano, 0, 1).toISOString())
           .lte('created_at', new Date(ano, 11, 31, 23, 59, 59).toISOString())
    }
    return q
  })
  return [...new Set(data.map(f => new Date(f.created_at).getMonth() + 1))].sort((a, b) => a - b)
}

export async function fetchFichasKanban({ produto, dateFrom, dateTo }) {
  return fetchAllRows(() => {
    let q = supabase
      .from('fichas')
      .select('id,created_at,finalizada_em,produto,imobiliaria,nome_interessado,nome_empresa,cpf,cnpj,status,assumida,orcamentista_id,assumida_em,seguradora,retorno_enviado,profiles!orcamentista_id(nome, avatar_url)')
      .order('created_at', { ascending: false })
    if (produto && produto !== 'todos') q = q.eq('produto', produto)
    if (dateFrom) q = q.gte('created_at', dateFrom)
    if (dateTo)   q = q.lte('created_at', dateTo)
    return q
  })
}

export async function fetchKPIsVisaoGeral(inicioFiltro, fimFiltro) {
  const agora = new Date()
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).toISOString()
  const inicioSemana = (() => {
    const d = new Date(); const day = d.getDay()
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); d.setHours(0, 0, 0, 0); return d.toISOString()
  })()
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString()
  const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1).toISOString()
  const fimMesAnterior = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59).toISOString()

  // Aplica filtro de período nas queries quando fornecido
  const applyRange = (q) => {
    if (inicioFiltro) q = q.gte('created_at', inicioFiltro)
    if (fimFiltro)    q = q.lte('created_at', fimFiltro)
    return q
  }

  const results = await Promise.all([
    applyRange(supabase.from('fichas').select('*', { count: 'exact', head: true })),
    applyRange(supabase.from('fichas').select('*', { count: 'exact', head: true })).gte('created_at', inicioMesAnterior).lte('created_at', fimMesAnterior),
    applyRange(supabase.from('fichas').select('*', { count: 'exact', head: true })).gte('created_at', inicioHoje),
    applyRange(supabase.from('fichas').select('*', { count: 'exact', head: true })).gte('created_at', inicioSemana),
    applyRange(supabase.from('fichas').select('*', { count: 'exact', head: true })).eq('status', 'pendente'),
    applyRange(supabase.from('fichas').select('*', { count: 'exact', head: true })).eq('status', 'em_cotacao'),
  ])

  const [totalMes, totalMesAnterior, hoje, semana, pendentes, emCotacao] = results.map(r => r.count || 0)
  const variacaoMes = totalMesAnterior
    ? Math.round(((totalMes - totalMesAnterior) / totalMesAnterior) * 100)
    : null

  return { totalMes, variacaoMes, hoje, semana, pendentes, emCotacao }
}

// ── Lookup helpers ────────────────────────────────────────────────────────────

export async function fetchImobiliariasDistintas() {
  const data = await fetchAllRows(() =>
    supabase.from('fichas').select('imobiliaria').not('imobiliaria', 'is', null)
  )
  const raw = [...new Set(data.map(f => f.imobiliaria).filter(Boolean))]
  return raw.map(n => normalizeImobiliaria(n) || n).filter(Boolean).sort()
}

// Retorna todos os registros {imobiliaria} para contagem na página de Imobiliárias
export async function fetchNomesImobiliariasAll() {
  return fetchAllRows(() =>
    supabase.from('fichas').select('imobiliaria').not('imobiliaria', 'is', null)
  )
}

export async function fetchProfiles() {
  const { data } = await supabase.from('profiles').select('id, nome').order('nome')
  return data || []
}

// ── Auditoria ─────────────────────────────────────────────────────────────────

// Registra ação crítica no audit_log. Nunca bloqueia a operação principal.
async function registrarAudit(action, fichaId, dadosAntes, dadosDepois) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action,
      ficha_id: fichaId,
      dados_antes: dadosAntes ?? null,
      dados_depois: dadosDepois ?? null,
    })
  } catch (_) {
    // auditoria nunca bloqueia a operação principal
  }
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function assumirFicha(id, orcamentistaId) {
  const payload = {
    assumida: true,
    orcamentista_id: orcamentistaId,
    status: 'em_cotacao',
    assumida_em: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('fichas')
    .update(payload)
    .eq('id', id)
    .select('id')

  if (error) return error
  if (!data || data.length === 0) return new Error('Sem permissao para assumir esta ficha')
  registrarAudit('assumir_ficha', id, { assumida: false }, payload)
  return null
}

async function buildRawDataUpdate(id, rawDataPatch) {
  if (!rawDataPatch || Object.keys(rawDataPatch).length === 0) return {}

  const { data: current, error } = await supabase
    .from('fichas')
    .select('raw_data')
    .eq('id', id)
    .single()

  if (error) return { error }

  return {
    raw_data: {
      ...(current?.raw_data || {}),
      ...rawDataPatch,
    },
  }
}

export async function finalizarFicha(id, { status, seguradora, retorno_enviado, userId, rawDataPatch }) {
  const rawDataUpdate = await buildRawDataUpdate(id, rawDataPatch)
  if (rawDataUpdate.error) return rawDataUpdate.error

  const { error } = await supabase.from('fichas').update({
    status, seguradora, retorno_enviado,
    finalizada_em: new Date().toISOString(),
    finalizado_por: userId || null,
    ...rawDataUpdate,
  }).eq('id', id)
  if (!error) registrarAudit('finalizar_ficha', id, null, { status, seguradora, retorno_enviado })
  return error
}

export async function moverFichaStatus(fichaId, novoStatus, { assumir = false, userId, rawDataPatch } = {}) {
  const update = { status: novoStatus }
  if (assumir && userId) {
    update.orcamentista_id = userId
    update.assumida = true
    update.assumida_em = new Date().toISOString()
  }
  if (novoStatus === 'pendente') {
    update.assumida = false
    update.orcamentista_id = null
    update.assumida_em = null
  }
  // Detecta falha silenciosa de RLS (0 rows affected = sem permissão)
  const { data, error } = await supabase.from('fichas').update(update).eq('id', fichaId).select('id')
  if (error) return error
  if (!data || data.length === 0) return new Error('Sem permissão para mover esta ficha')
  return null
}

export async function moverFichaStatusComRawData(fichaId, novoStatus, { assumir = false, userId, rawDataPatch } = {}) {
  const update = { status: novoStatus }
  if (assumir && userId) {
    update.orcamentista_id = userId
    update.assumida = true
    update.assumida_em = new Date().toISOString()
  }
  if (novoStatus === 'pendente') {
    update.assumida = false
    update.orcamentista_id = null
    update.assumida_em = null
  }

  if (rawDataPatch && Object.keys(rawDataPatch).length > 0) {
    const { data: current, error: currentError } = await supabase
      .from('fichas')
      .select('raw_data')
      .eq('id', fichaId)
      .single()
    if (currentError) return currentError
    update.raw_data = {
      ...(current?.raw_data || {}),
      ...rawDataPatch,
    }
  }

  const { data, error } = await supabase.from('fichas').update(update).eq('id', fichaId).select('id')
  if (error) return error
  if (!data || data.length === 0) return new Error('Sem permissao para mover esta ficha')
  return null
}

export async function finalizarFichaComRawData(id, { status, seguradora, retorno_enviado, userId, rawDataPatch }) {
  const update = {
    status,
    seguradora,
    retorno_enviado,
    finalizada_em: new Date().toISOString(),
    finalizado_por: userId || null,
  }

  if (rawDataPatch && Object.keys(rawDataPatch).length > 0) {
    const { data: current, error: currentError } = await supabase
      .from('fichas')
      .select('raw_data')
      .eq('id', id)
      .single()
    if (currentError) return currentError
    update.raw_data = {
      ...(current?.raw_data || {}),
      ...rawDataPatch,
    }
  }

  const { error } = await supabase.from('fichas').update(update).eq('id', id)
  if (!error) registrarAudit('finalizar_ficha', id, null, { status, seguradora, retorno_enviado })
  return error
}

export async function marcarRetornoEnviado(id) {
  const { error } = await supabase.from('fichas').update({ retorno_enviado: true }).eq('id', id)
  return error
}

export async function criarFicha(dados) {
  const { data, error } = await supabase.from('fichas').insert(dados).select().single()
  return { data, error }
}

export async function editarFicha(id, dados, userId) {
  let payload = { ...dados }
  if (userId) {
    const { data: cur } = await supabase.from('fichas').select('raw_data').eq('id', id).single()
    const raw = cur?.raw_data || {}
    const hist = Array.isArray(raw._edit_history) ? raw._edit_history : []
    hist.push({ editado_em: new Date().toISOString(), editado_por: userId })
    payload.raw_data = dados?.raw_data
      ? { ...raw, ...dados.raw_data, _edit_history: hist }
      : { ...raw, _edit_history: hist }
  }
  const { data, error } = await supabase.from('fichas').update(payload).eq('id', id).select('id')
  if (error) return error
  // RLS bloqueou silenciosamente (0 linhas afetadas sem erro)
  if (!data || data.length === 0) return { message: 'Sem permissão para editar esta ficha.' }
  return null
}

export async function salvarRetornoGeradoFicha(id, retornoGerado, userId) {
  const { data: cur } = await supabase.from('fichas').select('raw_data').eq('id', id).single()
  const raw = cur?.raw_data || {}
  const hist = Array.isArray(raw._edit_history) ? raw._edit_history : []

  if (userId) {
    hist.push({ editado_em: new Date().toISOString(), editado_por: userId, acao: 'gerar_retorno' })
  }

  const payload = {
    raw_data: {
      ...raw,
      retorno_gerado: {
        texto: retornoGerado?.texto || '',
        biometria_url: retornoGerado?.biometria_url || '',
        gerado_em: retornoGerado?.gerado_em || new Date().toISOString(),
        seguradora_escolhida: retornoGerado?.seguradora_escolhida || null,
        status: retornoGerado?.status || null,
        cotacoes_snapshot: Array.isArray(retornoGerado?.cotacoes_snapshot)
          ? retornoGerado.cotacoes_snapshot
          : [],
      },
      _edit_history: hist,
    },
  }

  const { data, error } = await supabase.from('fichas').update(payload).eq('id', id).select('id')
  if (error) return error
  if (!data || data.length === 0) return { message: 'Sem permissão para editar esta ficha.' }
  return null
}

export async function limparRetornoGeradoFicha(id, userId) {
  const { data: cur } = await supabase.from('fichas').select('raw_data').eq('id', id).single()
  const raw = cur?.raw_data || {}
  const hist = Array.isArray(raw._edit_history) ? raw._edit_history : []

  if (userId) {
    hist.push({ editado_em: new Date().toISOString(), editado_por: userId, acao: 'limpar_retorno' })
  }

  const nextRaw = { ...raw }
  delete nextRaw.retorno_gerado
  nextRaw._edit_history = hist

  const { data, error } = await supabase.from('fichas').update({ raw_data: nextRaw }).eq('id', id).select('id')
  if (error) return error
  if (!data || data.length === 0) return { message: 'Sem permissÃ£o para editar esta ficha.' }
  return null
}

export async function deletarFicha(id) {
  const { data: fichaAntes } = await supabase.from('fichas').select('id, produto, nome_interessado, status, imobiliaria').eq('id', id).single()
  const { error } = await supabase.from('fichas').delete().eq('id', id)
  if (!error) registrarAudit('deletar_ficha', id, fichaAntes, null)
  return error
}

// ── Relatório por Imobiliária ─────────────────────────────────────────────────

const STATUS_RELATORIO = ['aprovado', 'emitido', 'cancelado', 'expirada']

export async function fetchAnosRelatorio() {
  const data = await fetchAllRows(() =>
    supabase.from('fichas').select('created_at').in('status', STATUS_RELATORIO)
  )
  return [...new Set(data.map(f => new Date(f.created_at).getFullYear()))].sort((a, b) => b - a)
}

export async function fetchMesesRelatorio(ano) {
  const data = await fetchAllRows(() =>
    supabase.from('fichas').select('created_at')
      .in('status', STATUS_RELATORIO)
      .gte('created_at', new Date(ano, 0, 1).toISOString())
      .lte('created_at', new Date(ano, 11, 31, 23, 59, 59).toISOString())
  )
  return [...new Set(data.map(f => new Date(f.created_at).getMonth() + 1))].sort((a, b) => a - b)
}

export async function fetchImobiliariasRelatorio(ano, mes) {
  const inicio = new Date(ano, mes - 1, 1).toISOString()
  const fim    = new Date(ano, mes, 0, 23, 59, 59).toISOString()
  const data   = await fetchAllRows(() =>
    supabase.from('fichas').select('imobiliaria')
      .gte('created_at', inicio).lte('created_at', fim)
      .in('status', STATUS_RELATORIO)
      .not('imobiliaria', 'is', null)
  )
  return [...new Set(data.map(f => f.imobiliaria))].sort()
}

export async function fetchFichasRelatorio(ano, mes, imobiliarias) {
  // imobiliarias: string[] — aliases da imobiliária canônica; null/[] carrega todas
  const inicio = new Date(ano, mes - 1, 1).toISOString()
  const fim    = new Date(ano, mes, 0, 23, 59, 59).toISOString()
  const lista  = Array.isArray(imobiliarias) && imobiliarias.length ? imobiliarias : null
  let q = supabase
    .from('fichas')
    .select('id, nome_interessado, cpf, cnpj, imobiliaria, status, produto, created_at, retorno_enviado, orcamentista_forms, valor_aluguel, numero_apolice, data_emissao')
    .gte('created_at', inicio)
    .lte('created_at', fim)
    .in('status', STATUS_RELATORIO)
    .order('created_at', { ascending: false })
  if (lista) q = q.in('imobiliaria', lista)
  const { data } = await q
  return data || []
}

// ── Relatório Mensal ──────────────────────────────────────────────────────────

export async function fetchRelatorioMensal({ ano, mes, produto }) {
  const inicio = new Date(ano, mes - 1, 1).toISOString()
  const fim    = new Date(ano, mes, 0, 23, 59, 59).toISOString()

  let q = supabase
    .from('fichas')
    .select('id, created_at, nome_interessado, cpf, cnpj, imobiliaria, status, produto, retorno_enviado, assumida, orcamentista_forms')
    .gte('created_at', inicio)
    .lte('created_at', fim)
    .order('imobiliaria', { ascending: true })
    .order('created_at', { ascending: true })

  if (produto && produto !== 'todos') q = q.eq('produto', produto)

  const { data } = await q
  return data || []
}

export async function fetchRankingEquipeMensal(inicioFiltro, fimFiltro) {
  const data = await fetchAllRows(() => {
    let q = supabase
      .from('fichas')
      .select('status, created_at, orcamentista_id, profiles!orcamentista_id(nome, avatar_url)')
      .in('status', ['aprovado', 'emitido'])

    if (inicioFiltro) q = q.gte('created_at', inicioFiltro)
    if (fimFiltro) q = q.lte('created_at', fimFiltro)
    return q
  })

  const summary = new Map()

  data.forEach(item => {
    const name = item.profiles?.nome || 'Sem responsavel'
    const current = summary.get(name) || {
      name,
      approved: 0,
      emitted: 0,
      total: 0,
      latestAt: item.created_at,
    }

    if (item.status === 'aprovado') current.approved += 1
    if (item.status === 'emitido') current.emitted += 1
    current.total = current.approved + current.emitted
    if (new Date(item.created_at) > new Date(current.latestAt)) current.latestAt = item.created_at

    summary.set(name, current)
  })

  return [...summary.values()]
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      return new Date(b.latestAt) - new Date(a.latestAt)
    })
    .slice(0, 5)
}

export async function fetchRankingFichasMensal(inicioFiltro, fimFiltro) {
  const data = await fetchAllRows(() => {
    let q = supabase
      .from('fichas')
      .select('status, created_at, orcamentista_id, profiles!orcamentista_id(nome, avatar_url)')
      .in('status', STATUS_PASSADOS)

    if (inicioFiltro) q = q.gte('created_at', inicioFiltro)
    if (fimFiltro) q = q.lte('created_at', fimFiltro)
    return q
  })

  const summary = new Map()

  data.forEach(item => {
    const id = item.orcamentista_id || 'sem-responsavel'
    const name = item.profiles?.nome || 'Sem responsável'
    const current = summary.get(id) || {
      id,
      name,
      approved: 0,
      refused: 0,
      passed: 0,
      latestAt: item.created_at,
    }

    current.passed += 1
    if (item.status === 'aprovado') current.approved += 1
    if (item.status === 'recusado') current.refused += 1
    if (new Date(item.created_at) > new Date(current.latestAt)) current.latestAt = item.created_at

    summary.set(id, current)
  })

  return [...summary.values()].sort((a, b) => {
    if (b.approved !== a.approved) return b.approved - a.approved
    if (b.passed !== a.passed) return b.passed - a.passed
    if (a.refused !== b.refused) return a.refused - b.refused
    return new Date(b.latestAt) - new Date(a.latestAt)
  })
}
