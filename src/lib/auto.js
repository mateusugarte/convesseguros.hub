import { supabase } from './supabase'

function inicioFimMes(offset = 0) {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = hoje.getMonth() + offset
  return {
    inicio: new Date(ano, mes, 1).toISOString().split('T')[0],
    fim: new Date(ano, mes + 1, 0).toISOString().split('T')[0],
  }
}

function monthKey(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'invalid'
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabelFromKey(key) {
  const [year, month] = key.split('-').map(Number)
  if (!year || !month) return key
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'short',
    year: '2-digit',
  })
}

function countBy(items, accessor) {
  return items.reduce((acc, item) => {
    const key = accessor(item)
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}

export function getEmissaoColuna(item) {
  const raw = item.coluna
  if (typeof raw !== 'string') return 'pendentes'
  const trimmed = raw.trim()
  if (!trimmed) return 'pendentes'
  if (trimmed === 'pendente') return 'pendentes'
  if (trimmed === 'cotacao_feita' && !item.resultado) {
    return 'pendentes'
  }
  return trimmed
}

function toMonthSeries(items, { meses = 6, getDate, getValue } = {}) {
  const resultado = []
  for (let i = meses - 1; i >= 0; i--) {
    const referencia = new Date()
    referencia.setMonth(referencia.getMonth() - i)
    const key = `${referencia.getFullYear()}-${String(referencia.getMonth() + 1).padStart(2, '0')}`
    const subset = items.filter(item => monthKey(getDate(item)) === key)
    resultado.push({
      mes: monthLabelFromKey(key),
      ...getValue(subset),
    })
  }
  return resultado
}

// Clientes
export async function buscarClientePorCpf(cpf) {
  const { data, error } = await supabase
    .from('clientes_auto')
    .select('*')
    .eq('cpf', cpf)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function criarClienteAuto(payload) {
  const { data, error } = await supabase
    .from('clientes_auto')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

// Cotacoes
export async function getCotacoesAuto({ tipo, status, seguradora, inicio, fim } = {}) {
  let q = supabase
    .from('cotacoes_auto')
    .select('*')
    .order('created_at', { ascending: false })

  if (tipo) q = q.eq('tipo', tipo)
  if (status) q = q.eq('status', status)
  if (seguradora) q = q.ilike('seguradora_preferencial->>nome', `%${seguradora}%`)
  if (inicio) q = q.gte('created_at', inicio)
  if (fim) q = q.lte('created_at', fim)

  const { data, error } = await q
  if (error) throw error
  return data  []
}

export async function criarCotacaoAuto(payload) {
  const { data, error } = await supabase
    .from('cotacoes_auto')
    .insert({
      ...payload,
      tipo: payload.tipo || 'novo',
      status: payload.status || 'pendente',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getCotacaoAutoPorId(id) {
  const { data, error } = await supabase
    .from('cotacoes_auto')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function atualizarCotacaoAuto(id, changes) {
  const { data, error } = await supabase
    .from('cotacoes_auto')
    .update(changes)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw error
  return data
}

export async function atualizarStatusCotacao(id, status) {
  const { error } = await supabase
    .from('cotacoes_auto')
    .update({ status })
    .eq('id', id)
  if (error) throw error
}

export async function deletarCotacaoAuto(id) {
  // A cotação pode estar referenciada por emissoes_auto e apolices_auto.
  // Remove dependências primeiro para evitar erro de FK ao excluir.
  const { data: emissoes, error: emissoesError } = await supabase
    .from('emissoes_auto')
    .select('id')
    .eq('cotacao_id', id)
  if (emissoesError) throw emissoesError

  const emissaoIds = (emissoes  []).map(item => item.id).filter(Boolean)

  if (emissaoIds.length) {
    const { error: apolicesError } = await supabase
      .from('apolices_auto')
      .delete()
      .in('emissao_id', emissaoIds)
    if (apolicesError) throw apolicesError

    const { error: emissoesDeleteError } = await supabase
      .from('emissoes_auto')
      .delete()
      .in('id', emissaoIds)
    if (emissoesDeleteError) throw emissoesDeleteError
  }

  const { error } = await supabase
    .from('cotacoes_auto')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// Emissoes
async function sincronizarEmissoesPendentes() {
  const { data: cotacoes, error: cotacoesError } = await supabase
    .from('cotacoes_auto')
    .select('id, cliente_id, tipo, created_at')
  if (cotacoesError) throw cotacoesError
  if (!cotacoes.length) return

  const cotacaoIds = cotacoes.map(item => item.id).filter(Boolean)
  if (!cotacaoIds.length) return

  const { data: emissoesExistentes, error: emissoesError } = await supabase
    .from('emissoes_auto')
    .select('cotacao_id')
    .in('cotacao_id', cotacaoIds)

  if (emissoesError) throw emissoesError

  const existentes = new Set((emissoesExistentes  []).map(item => item.cotacao_id).filter(Boolean))
  const faltantes = cotacoes.filter(item => !existentes.has(item.id))

  if (!faltantes.length) return

  const payload = faltantes.map(item => ({
    cotacao_id: item.id,
    cliente_id: item.cliente_id,
    tipo: item.tipo,
    coluna: null,
    created_at: item.created_at,
    updated_at: item.created_at,
  }))

  const { error: insertError } = await supabase
    .from('emissoes_auto')
    .insert(payload)

  if (insertError) throw insertError
}

export async function getEmissoesAuto({ inicio, fim } = {}) {
  await sincronizarEmissoesPendentes()

  let q = supabase
    .from('emissoes_auto')
    .select('*, cotacoes_auto(*)')
    .order('created_at', { ascending: false })

  if (inicio) q = q.gte('created_at', `${inicio}T00:00:00`)
  if (fim) q = q.lte('created_at', `${fim}T23:59:59`)

  const { data, error } = await q
  if (error) throw error
  return data  []
}

export async function moverEmissaoColuna(id, coluna) {
  const { error } = await supabase
    .from('emissoes_auto')
    .update({ coluna, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function salvarResultadoCotacao(id, { resultado, seguradoras_cotadas }) {
  const { error } = await supabase
    .from('emissoes_auto')
    .update({
      coluna: 'cotacao_feita',
      resultado,
      seguradoras_cotadas: seguradoras_cotadas  [],
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

// Apolices
export async function emitirApoliceAuto(payload) {
  const premioLiquido = parseFloat(payload.premio_liquido) || 0
  const pctComissao = parseFloat(payload.pct_comissao) || 0
  const valorComissao = premioLiquido * pctComissao

  const valorRepasse = payload.tem_repasse && payload.pct_repasse
     valorComissao * parseFloat(payload.pct_repasse)
    : null

  const { data, error } = await supabase
    .from('apolices_auto')
    .insert({
      ...payload,
      valor_comissao: valorComissao,
      valor_repasse: valorRepasse,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function criarEmissaoManualAuto(payload) {
  const premioLiquido = parseFloat(payload.premio_liquido) || 0
  const pctComissao = parseFloat(payload.pct_comissao) || 0
  const valorComissao = premioLiquido * pctComissao
  const valorRepasse = payload.tem_repasse && payload.pct_repasse
     valorComissao * parseFloat(payload.pct_repasse)
    : null

  const clienteId = payload.cliente_id || `${(payload.cpf_cliente || '').replace(/\D/g, '') || 'manual'}_${new Date().toISOString().split('T')[0]}`

  const emissaoPayload = {
    cotacao_id: null,
    cliente_id: clienteId,
    tipo: payload.tipo || 'novo',
    coluna: 'emitida',
    nome_cliente: payload.nome_cliente || null,
    cpf_cliente: payload.cpf_cliente || null,
    celular_cliente: payload.celular_cliente || null,
    condutor_nome: payload.condutor_nome || null,
    condutor_cpf: payload.condutor_cpf || null,
    modelo_veiculo: payload.modelo_veiculo || null,
    placa: payload.placa || null,
    seguradora: payload.seguradora || null,
    numero_apolice: payload.numero_apolice || null,
    vigencia_inicio: payload.vigencia_inicio || null,
    vigencia_fim: payload.vigencia_fim || null,
    premio_liquido: premioLiquido,
    pct_comissao: pctComissao,
    valor_comissao: valorComissao,
    forma_pagamento: payload.forma_pagamento || null,
    parcelamento: payload.parcelamento || null,
    tem_repasse: !!payload.tem_repasse,
    pct_repasse: payload.tem_repasse  parseFloat(payload.pct_repasse) || null : null,
    nome_repasse: payload.tem_repasse  payload.nome_repasse || null : null,
    valor_repasse: payload.tem_repasse  valorRepasse : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { data: emissao, error: emissaoError } = await supabase
    .from('emissoes_auto')
    .insert(emissaoPayload)
    .select()
    .single()
  if (emissaoError) throw emissaoError

  const apolicePayload = {
    emissao_id: emissao.id,
    cliente_id: clienteId,
    seguradora: payload.seguradora || null,
    numero_apolice: payload.numero_apolice || null,
    vigencia_inicio: payload.vigencia_inicio || null,
    vigencia_fim: payload.vigencia_fim || null,
    premio_liquido: premioLiquido,
    pct_comissao: pctComissao,
    valor_comissao: valorComissao,
    forma_pagamento: payload.forma_pagamento || null,
    parcelamento: payload.parcelamento || null,
    tipo_producao: payload.tipo_producao || 'individual',
    responsavel: payload.responsavel || null,
    eh_renovacao: !!payload.eh_renovacao,
    tem_repasse: !!payload.tem_repasse,
    pct_repasse: payload.tem_repasse  parseFloat(payload.pct_repasse) || null : null,
    nome_repasse: payload.tem_repasse  payload.nome_repasse || null : null,
    valor_repasse: payload.tem_repasse  valorRepasse : null,
    nome_cliente: payload.nome_cliente || null,
    cpf_cliente: payload.cpf_cliente || null,
    celular_cliente: payload.celular_cliente || null,
    condutor_nome: payload.condutor_nome || null,
    condutor_cpf: payload.condutor_cpf || null,
    modelo_veiculo: payload.modelo_veiculo || null,
    placa: payload.placa || null,
  }

  const { data: apolice, error: apoliceError } = await supabase
    .from('apolices_auto')
    .insert(apolicePayload)
    .select()
    .single()
  if (apoliceError) throw apoliceError

  return { emissao, apolice }
}

// Renovacoes
export async function getRenovacoesAuto({ periodo } = {}) {
  let q = supabase
    .from('renovacoes_auto')
    .select('*, clientes_auto(nome_completo, telefone, celular, email), apolices_auto(numero_apolice, seguradora)')
    .order('vigencia_fim', { ascending: true })

  if (periodo === 'proximo_mes') {
    const { inicio, fim } = inicioFimMes(1)
    q = q.gte('vigencia_fim', inicio).lte('vigencia_fim', fim)
  } else if (periodo === 'mes_atual') {
    const { inicio, fim } = inicioFimMes(0)
    q = q.gte('vigencia_fim', inicio).lte('vigencia_fim', fim)
  } else if (periodo === 'passadas') {
    const hoje = new Date().toISOString().split('T')[0]
    q = q.lt('vigencia_fim', hoje)
  }

  const { data, error } = await q
  if (error) throw error
  return data  []
}

export async function atualizarStatusRenovacao(id, campos) {
  const { error } = await supabase
    .from('renovacoes_auto')
    .update(campos)
    .eq('id', id)
  if (error) throw error
}

// Apolices
export async function getApolicesAuto({ search, inicio, fim } = {}) {
  let q = supabase
    .from('apolices_auto')
    .select('*')
    .order('created_at', { ascending: false })

  if (inicio) q = q.gte('created_at', `${inicio}T00:00:00`)
  if (fim) q = q.lte('created_at', `${fim}T23:59:59`)

  const { data, error } = await q
  if (error) throw error

  let result = data  []
  if (search) {
    const term = search.toLowerCase()
    result = result.filter(item =>
      item.nome_cliente.toLowerCase().includes(term) ||
      item.cpf_cliente.toLowerCase().includes(term) ||
      item.celular_cliente.toLowerCase().includes(term) ||
      item.condutor_nome.toLowerCase().includes(term) ||
      item.condutor_cpf.toLowerCase().includes(term) ||
      item.modelo_veiculo.toLowerCase().includes(term) ||
      item.placa.toLowerCase().includes(term) ||
      item.numero_apolice.toLowerCase().includes(term) ||
      item.seguradora.toLowerCase().includes(term)
    )
  }
  return result
}

export async function getAutoCarteiraClientes({ search, seguradora, inicio, fim } = {}) {
  let q = supabase
    .from('apolices_auto')
    .select('*, emissoes_auto(*, cotacoes_auto(*))')
    .order('vigencia_inicio', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (inicio) q = q.gte('vigencia_inicio', inicio)
  if (fim) q = q.lte('vigencia_inicio', fim)
  if (seguradora) q = q.ilike('seguradora', `%${seguradora}%`)

  const { data, error } = await q
  if (error) throw error

  let result = data  []
  if (search) {
    const term = search.toLowerCase().trim()
    if (term) {
      result = result.filter(item => {
        const c = item.emissoes_auto.cotacoes_auto || {}
        const text = [
          item.nome_cliente,
          item.cpf_cliente,
          item.celular_cliente,
          item.condutor_nome,
          item.condutor_cpf,
          item.modelo_veiculo,
          item.placa,
          item.numero_apolice,
          item.seguradora,
          item.emissoes_auto.numero_apolice,
          c.nome_cliente,
          c.cpf_cliente,
          c.celular_cliente,
          c.condutor_nome,
          c.condutor_cpf,
          c.modelo_veiculo,
          c.placa,
          c.origem_lead,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return text.includes(term)
      })
    }
  }

  return result
}

export async function atualizarApoliceAuto(id, changes) {
  const { data, error } = await supabase
    .from('apolices_auto')
    .update(changes)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw error
  return data
}

// Dashboard
export async function getDashboardAutoMetrics() {
  const { inicio, fim } = inicioFimMes(0)
  const proximoMes = inicioFimMes(1)

  const [emissoes, cotacoesMes, renovadasMes, vencendoProximoMes, apolicesMes, cotacoesConvertidas, renovacoesPendentes] = await Promise.all([
    supabase.from('apolices_auto').select('id, eh_renovacao').gte('created_at', inicio).lte('created_at', fim),
    supabase.from('cotacoes_auto').select('id').gte('created_at', inicio).lte('created_at', fim),
    supabase.from('renovacoes_auto').select('id').eq('status_renovacao', 'renovada').gte('created_at', inicio).lte('created_at', fim),
    supabase.from('renovacoes_auto').select('id').gte('vigencia_fim', proximoMes.inicio).lte('vigencia_fim', proximoMes.fim),
    supabase.from('apolices_auto').select('valor_comissao').gte('created_at', inicio).lte('created_at', fim),
    supabase.from('cotacoes_auto').select('id').eq('status', 'convertida').gte('created_at', inicio).lte('created_at', fim),
    supabase.from('renovacoes_auto').select('id').neq('status_cotacao', 'cotada_enviada'),
  ])

  const totalCotacoesMes = cotacoesMes.data.length  0
  const totalConvertidas = cotacoesConvertidas.data.length  0
  const comissaoTotal = (apolicesMes.data  []).reduce((sum, item) => sum + (item.valor_comissao || 0), 0)
  const taxaConversao = totalCotacoesMes > 0  Math.round((totalConvertidas / totalCotacoesMes) * 100) : 0

  return {
    novosNoMes: emissoes.data.filter(item => !item.eh_renovacao).length  0,
    renovacoesNoMes: emissoes.data.filter(item => item.eh_renovacao).length  0,
    cotacoesNoMes: totalCotacoesMes,
    renovacoesConcluidas: renovadasMes.data.length  0,
    vencendoProximoMes: vencendoProximoMes.data.length  0,
    comissaoTotal,
    taxaConversao,
    renovacoesPendentes: renovacoesPendentes.data.length  0,
  }
}

export async function getGraficoEmissoesMensais(meses = 6) {
  const apolices = await supabase
    .from('apolices_auto')
    .select('id, eh_renovacao, created_at')

  const lista = apolices.data  []
  return toMonthSeries(lista, {
    meses,
    getDate: item => item.created_at,
    getValue: subset => ({
      novos: subset.filter(item => !item.eh_renovacao).length,
      renovacoes: subset.filter(item => item.eh_renovacao).length,
    }),
  })
}

export async function getAutoRenovacoesResumo({ periodo } = {}) {
  const renovacoes = await getRenovacoesAuto({ periodo })
  const hoje = new Date()
  const trintaDias = new Date()
  trintaDias.setDate(hoje.getDate() + 30)

  return {
    total: renovacoes.length,
    vencendo30: renovacoes.filter(item => {
      const vencimento = new Date(`${item.vigencia_fim}T12:00:00`)
      return vencimento >= hoje && vencimento <= trintaDias
    }).length,
    atrasadas: renovacoes.filter(item => {
      const vencimento = new Date(`${item.vigencia_fim}T12:00:00`)
      return vencimento < hoje && item.status_renovacao !== 'renovada'
    }).length,
    statusCotacao: countBy(renovacoes, item => item.status_cotacao || 'nao_cotada'),
    statusRenovacao: countBy(renovacoes, item => item.status_renovacao || 'pendente'),
    serieMensal: toMonthSeries(renovacoes, {
      meses: 6,
      getDate: item => `${item.vigencia_fim}T12:00:00`,
      getValue: subset => ({ total: subset.length }),
    }),
  }
}

export async function getAutoEmissoesResumo() {
  const emissoes = await getEmissoesAuto()
  return {
    total: emissoes.length,
    pendentes: emissoes.filter(item => getEmissaoColuna(item) === 'pendentes').length,
    emitidas: emissoes.filter(item => getEmissaoColuna(item) === 'emitida').length,
    porColuna: countBy(emissoes, item => getEmissaoColuna(item)),
    porTipo: countBy(emissoes, item => item.cotacoes_auto.tipo || item.tipo || 'novo'),
  }
}

export async function getAutoCotacoesResumo({ tipo, inicio, fim } = {}) {
  const cotacoes = await getCotacoesAuto({ tipo, inicio, fim })
  const agora = new Date()
  const mesKeyAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
  const cotacoesMes = cotacoes.filter(item => monthKey(item.created_at) === mesKeyAtual)

  const serieMensal = Object.entries(
    cotacoes.reduce((acc, item) => {
      const key = monthKey(item.created_at)
      if (!acc[key]) {
        acc[key] = { mes: monthLabelFromKey(key), total: 0, convertidas: 0, perdidas: 0 }
      }
      acc[key].total += 1
      if (item.status === 'convertida') acc[key].convertidas += 1
      if (item.status === 'perdida') acc[key].perdidas += 1
      return acc
    }, {})
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value)

  return {
    total: cotacoes.length,
    mesAtual: cotacoesMes.length,
    pendentes: cotacoes.filter(item => item.status === 'pendente' || item.status === 'aberta').length,
    abertas: cotacoes.filter(item => item.status === 'pendente' || item.status === 'aberta').length,
    convertidas: cotacoes.filter(item => item.status === 'convertida').length,
    perdidas: cotacoes.filter(item => item.status === 'perdida').length,
    taxaConversao: cotacoes.length > 0  cotacoes.filter(item => item.status === 'convertida').length / cotacoes.length : 0,
    porStatus: countBy(cotacoes, item => item.status || 'pendente'),
    serieMensal,
  }
}

export async function getGraficoCotacoesStatus(meses = 6) {
  const cotacoes = await getCotacoesAuto({})
  return toMonthSeries(cotacoes, {
    meses,
    getDate: item => item.created_at,
    getValue: subset => ({
      abertas: subset.filter(item => item.status === 'pendente' || item.status === 'aberta').length,
      convertidas: subset.filter(item => item.status === 'convertida').length,
      perdidas: subset.filter(item => item.status === 'perdida').length,
    }),
  })
}

export async function getAutoCotacoesMensais({ tipo, meses = 6 } = {}) {
  const cotacoes = await getCotacoesAuto({ tipo })
  return toMonthSeries(cotacoes, {
    meses,
    getDate: item => item.created_at,
    getValue: subset => ({
      total: subset.length,
      convertidas: subset.filter(item => item.status === 'convertida').length,
      perdidas: subset.filter(item => item.status === 'perdida').length,
    }),
  })
}
