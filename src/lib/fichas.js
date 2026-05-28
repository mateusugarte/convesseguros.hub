import { supabase } from './supabase'
import { normalizeImobiliaria } from './normalizeImobiliaria'

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
}

export const PRODUTO_LABELS = {
  residencial_pf:  'Residencial PF',
  comercial_pf:    'Comercial PF',
  pessoa_juridica: 'Pessoa Jurídica',
}

// "Em Aberto" = fichas que ainda precisam de atenção
export const STATUS_EM_ABERTO = ['pendente', 'em_cotacao']

// "Passadas" = fichas já finalizadas/encerradas
export const STATUS_PASSADOS = ['em_analise', 'aprovado', 'recusado', 'emitido', 'cancelado', 'cpf_invalido']

// ── KPIs ─────────────────────────────────────────────────────────────────────

export async function fetchKPIs() {
  const hoje = new Date()
  const inicioHoje   = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString()
  const inicioSemana = (() => {
    const d = new Date(); const day = d.getDay()
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); d.setHours(0,0,0,0); return d.toISOString()
  })()
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [{ count: total }, { count: hoje_ }, { count: semana }, { count: mes }, { count: emAberto }] = await Promise.all([
    supabase.from('fichas').select('*', { count: 'exact', head: true }),
    supabase.from('fichas').select('*', { count: 'exact', head: true }).gte('created_at', inicioHoje),
    supabase.from('fichas').select('*', { count: 'exact', head: true }).gte('created_at', inicioSemana),
    supabase.from('fichas').select('*', { count: 'exact', head: true }).gte('created_at', inicioMes),
    supabase.from('fichas').select('*', { count: 'exact', head: true }).in('status', STATUS_EM_ABERTO),
  ])

  return { total, hoje: hoje_, semana, mes, emAberto }
}

export async function fetchEmitidas() {
  const now = new Date()
  const inicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const { count } = await supabase.from('fichas').select('*', { count: 'exact', head: true })
    .eq('status', 'emitido').gte('created_at', inicio)
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

export async function fetchTopImobiliarias(limite = 5) {
  const data = await fetchAllRows(() =>
    supabase.from('fichas').select('imobiliaria').eq('status', 'aprovado').not('imobiliaria', 'is', null)
  )
  const contagem = {}
  data.forEach(f => {
    const nome = normalizeImobiliaria(f.imobiliaria) || f.imobiliaria
    contagem[nome] = (contagem[nome] || 0) + 1
  })
  return Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, limite).map(([name, total]) => ({ name, total }))
}

export async function fetchDistribuicaoStatus() {
  const statuses = Object.keys(STATUS_LABELS)
  const results = await Promise.all(
    statuses.map(s => supabase.from('fichas').select('*', { count: 'exact', head: true }).eq('status', s))
  )
  return statuses
    .map((s, i) => ({ status: s, label: STATUS_LABELS[s]?.label ?? s, value: results[i].count || 0 }))
    .filter(x => x.value > 0)
    .sort((a, b) => b.value - a.value)
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
    .select('id, created_at, nome_interessado, produto, imobiliaria, status, profiles(nome)')
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
    .from('fichas').select('*, profiles(nome)').eq('orcamentista_id', orcamentistaId)
    .eq('status', 'em_cotacao').order('assumida_em', { ascending: false })
  return data || []
}

export async function fetchContagemAbertaOrcamentista(orcamentistaId) {
  const { count } = await supabase.from('fichas').select('*', { count: 'exact', head: true })
    .eq('orcamentista_id', orcamentistaId).eq('status', 'em_cotacao')
  return count || 0
}

// ── Main fichas query ─────────────────────────────────────────────────────────

export async function fetchFichas({ produto, ano, mes, tipo, search, imobiliaria, orcamentistaId, page = 0, pageSize = 30 }) {
  let q = supabase
    .from('fichas')
    .select('id,created_at,produto,imobiliaria,nome_interessado,cpf,status,assumida,orcamentista_id,assumida_em,seguradora,retorno_enviado,profiles(nome)', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (produto && produto !== 'todos') q = q.eq('produto', produto)

  if (search?.trim()) {
    const s = search.trim()
    q = q.or(`nome_interessado.ilike.%${s}%,cpf.ilike.%${s}%,imobiliaria.ilike.%${s}%`)
  } else if (imobiliaria) {
    q = q.ilike('imobiliaria', `%${imobiliaria}%`)
  }

  if (ano && mes && mes !== -1) {
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
    q = q.in('status', STATUS_PASSADOS).eq('orcamentista_id', orcamentistaId)
  }

  const from = page * pageSize
  q = q.range(from, from + pageSize - 1)

  const { data, count } = await q
  return { data: data || [], count: count || 0 }
}

export async function fetchFichaDetalhe(id) {
  const { data } = await supabase.from('fichas').select('*, profiles(nome, orcamentista_label)').eq('id', id).single()
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
      .select('id,created_at,produto,imobiliaria,nome_interessado,cpf,status,assumida,orcamentista_id,assumida_em,retorno_enviado,profiles(nome)')
      .order('created_at', { ascending: false })
    if (produto && produto !== 'todos') q = q.eq('produto', produto)
    if (dateFrom) q = q.gte('created_at', dateFrom)
    if (dateTo)   q = q.lte('created_at', dateTo)
    return q
  })
}

// ── Lookup helpers ────────────────────────────────────────────────────────────

export async function fetchImobiliariasDistintas() {
  const data = await fetchAllRows(() =>
    supabase.from('fichas').select('imobiliaria').not('imobiliaria', 'is', null)
  )
  const raw = [...new Set(data.map(f => f.imobiliaria).filter(Boolean))]
  return raw.map(n => normalizeImobiliaria(n) || n).filter(Boolean).sort()
}

export async function fetchProfiles() {
  const { data } = await supabase.from('profiles').select('id, nome').order('nome')
  return data || []
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function assumirFicha(id, orcamentistaId) {
  const { error } = await supabase.from('fichas').update({
    assumida: true, orcamentista_id: orcamentistaId, status: 'em_cotacao', assumida_em: new Date().toISOString(),
  }).eq('id', id).or('assumida.eq.false,assumida.is.null')
  return error
}

export async function finalizarFicha(id, { status, seguradora, retorno_enviado }) {
  const { error } = await supabase.from('fichas').update({
    status, seguradora, retorno_enviado, finalizada_em: new Date().toISOString(),
  }).eq('id', id)
  return error
}

export async function moverFichaStatus(fichaId, novoStatus, { assumir = false, userId } = {}) {
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
  const { error } = await supabase.from('fichas').update(update).eq('id', fichaId)
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
  // Append edit history to raw_data
  if (userId) {
    const { data: cur } = await supabase.from('fichas').select('raw_data').eq('id', id).single()
    const raw = cur?.raw_data || {}
    const hist = Array.isArray(raw._edit_history) ? raw._edit_history : []
    hist.push({ editado_em: new Date().toISOString(), editado_por: userId })
    payload.raw_data = { ...raw, _edit_history: hist }
  }
  const { error } = await supabase.from('fichas').update(payload).eq('id', id)
  return error
}

export async function deletarFicha(id) {
  const { error } = await supabase.from('fichas').delete().eq('id', id)
  return error
}
