import { supabase } from './supabase'
import { limparNomeSegurado, normalizeCompareText, somarUmAno } from './autoHistoricoImport.js'
import { calcularValorComissaoAuto } from './autoCalc.js'

export { calcularValorComissaoAuto }

function parseMonthRef(monthRef) {
  if (typeof monthRef !== 'string') return null
  const match = monthRef.match(/^(\d{4})-(\d{2})$/)
  if (!match) return null
  const [, year, month] = match
  const date = new Date(Number(year), Number(month) - 1, 1)
  return Number.isNaN(date.getTime()) ? null : date
}

function toMonthRef(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function inicioFimMes(offset = 0, baseDate = new Date()) {
  const base = baseDate instanceof Date ? baseDate : new Date(baseDate)
  const ano = base.getFullYear()
  const mes = base.getMonth() + offset
  return {
    inicio: new Date(ano, mes, 1).toISOString().split('T')[0],
    fim: new Date(ano, mes + 1, 0).toISOString().split('T')[0],
  }
}

function getRangeFromMonthRef(monthRef, offset = 0) {
  return inicioFimMes(offset, parseMonthRef(monthRef) || new Date())
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

function normalizeCpf(value) {
  return String(value ?? '').replace(/\D/g, '')
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function toFloatOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeImportText(value) {
  return String(value ?? '').trim()
}

function normalizeStatusRenovacaoAuto(value) {
  const status = normalizeImportText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (status.includes('renov') || status.includes('fechado') || status.includes('vendeu')) {
    return { status_cotacao: 'cotada_enviada', status_renovacao: 'renovada' }
  }
  if (status.includes('enviado')) return { status_cotacao: 'cotada_enviada', status_renovacao: 'pendente' }
  if (status.includes('cotado')) return { status_cotacao: 'cotada_nao_enviada', status_renovacao: 'pendente' }
  if (status.includes('cancel') || status.includes('nao renov') || status.includes('n�o renov')) {
    return { status_cotacao: 'nao_cotada', status_renovacao: 'nao_renovada' }
  }
  return { status_cotacao: 'nao_cotada', status_renovacao: 'pendente' }
}
const AUTO_RENEWAL_COMPARE_FIELDS = [
  'renovacao_premio_liquido_ano_anterior',
  'renovacao_comissao_ano_anterior',
  'renovacao_premio_liquido_ano_atual',
  'renovacao_comissao_ano_atual',
  'renovacao_diferenca_premio_liquido',
  'renovacao_diferenca_comissao',
]

const APOLICE_AUTO_COLUMNS = 'id, emissao_id, cliente_id, seguradora, numero_apolice, data_emissao, vigencia_inicio, vigencia_fim, premio_liquido, pct_comissao, valor_comissao, forma_pagamento, parcelamento, tipo_producao, responsavel, eh_renovacao, tem_repasse, pct_repasse, nome_repasse, valor_repasse, nome_cliente, cpf_cliente, celular_cliente, condutor_nome, condutor_cpf, modelo_veiculo, placa, renovacao_premio_liquido_ano_anterior, renovacao_comissao_ano_anterior, renovacao_premio_liquido_ano_atual, renovacao_comissao_ano_atual, renovacao_diferenca_premio_liquido, renovacao_diferenca_comissao, origem_pre_sistema, created_at, updated_at'

const EMISSAO_AUTO_COLUMNS = 'id, cotacao_id, cliente_id, tipo, coluna, nome_cliente, cpf_cliente, celular_cliente, condutor_nome, condutor_cpf, modelo_veiculo, placa, seguradora, numero_apolice, vigencia_inicio, vigencia_fim, premio_liquido, pct_comissao, valor_comissao, forma_pagamento, parcelamento, tem_repasse, pct_repasse, nome_repasse, valor_repasse, resultado, seguradoras_cotadas, renovacao_premio_liquido_ano_anterior, renovacao_comissao_ano_anterior, renovacao_premio_liquido_ano_atual, renovacao_comissao_ano_atual, renovacao_diferenca_premio_liquido, renovacao_diferenca_comissao, created_at, updated_at'

const COTACAO_AUTO_COLUMNS = 'id, cliente_id, tipo, origem_lead, nome_cliente, cpf_cliente, celular_cliente, email_cliente, estado_civil_cliente, profissao_cliente, condutor_nome, condutor_cpf, estado_civil_condutor, cep_pernoite, uso_veiculo, garagem_residencia, garagem_trabalho, garagem_estudo, jovens_18_26, modelo_veiculo, placa, veiculo_financiado, possui_kit_gas, possui_blindagem, isento_imposto, seguradora_preferencial, seguradora_mais_barata, vigencia_inicio, vigencia_fim, status, created_at, updated_at'

const RENOVACAO_AUTO_COLUMNS = 'id, apolice_id, cliente_id, seguradora, vigencia_fim, status_cotacao, status_renovacao, created_at'

function pickDefined(source, fields) {
  return fields.reduce((acc, field) => {
    if (source[field] !== undefined) acc[field] = source[field]
    return acc
  }, {})
}

function omitKeys(source, keys) {
  const blacklist = new Set(keys)
  return Object.fromEntries(Object.entries(source).filter(([key]) => !blacklist.has(key)))
}

function isMissingColumnError(error, table, columns = []) {
  const message = String(error?.message || '')
  if (!message.includes(`column of '${table}'`)) return false
  if (!columns.length) return true
  return columns.some(column => message.includes(`'${column}'`))
}

// Colunas de apolices_auto que podem ainda nao existir no ambiente (migration
// pendente). Cada grupo nasce junto na mesma migration, entao, se o Postgres
// reclamar de uma coluna do grupo, o grupo inteiro sai do payload no retry.
const APOLICE_AUTO_FALLBACK_GROUPS = [AUTO_RENEWAL_COMPARE_FIELDS, ['data_emissao']]

function apoliceColunasAusentes(error) {
  if (!error) return []
  return APOLICE_AUTO_FALLBACK_GROUPS
    .filter(grupo => isMissingColumnError(error, 'apolices_auto', grupo))
    .flat()
}

// Erro de coluna inexistente num SELECT tem formato diferente do erro de
// insert/update (que passa pelo cache de schema do PostgREST antes de
// chegar no Postgres): aqui e o erro cru do Postgres (42703), sem a frase
// "column of 'tabela'" que isMissingColumnError procura. Quando a tabela e
// referenciada via embed (ex.: apolices_auto dentro de emissoes_auto), o
// Postgres alias a tabela como "apolices_auto_1" — o regex aceita o sufixo
// numerico opcional.
function isMissingSelectColumnError(error, table, columns = []) {
  if (error?.code !== '42703') return false
  const message = String(error?.message || '')
  return columns.some(column => new RegExp(`${table}(_\\d+)?\\.${column}\\b`).test(message))
}

function apoliceColunasAusentesSelect(error) {
  if (!error) return []
  return APOLICE_AUTO_FALLBACK_GROUPS
    .filter(grupo => isMissingSelectColumnError(error, 'apolices_auto', grupo))
    .flat()
}

function apoliceAutoColunasSemGrupos(removidas) {
  if (!removidas.length) return APOLICE_AUTO_COLUMNS
  const remover = new Set(removidas)
  return APOLICE_AUTO_COLUMNS.split(', ').filter(coluna => !remover.has(coluna)).join(', ')
}

// Roda um SELECT que usa APOLICE_AUTO_COLUMNS tolerando colunas que ainda nao
// existem no banco (migration pendente): a cada erro de "coluna inexistente",
// remove o grupo correspondente da lista de colunas e repete a consulta.
// `executar(colunas)` recebe a string de colunas e monta/roda a query.
async function selecionarComFallbackApolice(executar) {
  let removidas = []
  let resultado = await executar(apoliceAutoColunasSemGrupos(removidas))
  for (let tentativa = 0; tentativa < APOLICE_AUTO_FALLBACK_GROUPS.length; tentativa += 1) {
    const ausentes = apoliceColunasAusentesSelect(resultado.error).filter(coluna => !removidas.includes(coluna))
    if (!ausentes.length) return resultado
    removidas = removidas.concat(ausentes)
    resultado = await executar(apoliceAutoColunasSemGrupos(removidas))
  }
  return resultado
}

// Executa um insert/update em apolices_auto tolerando colunas que ainda nao
// existem no banco: a cada erro de "coluna inexistente", remove o grupo
// correspondente do payload e repete, ate acabarem os grupos conhecidos.
async function escreverApoliceAutoComFallback(payload, executar) {
  let removidas = []
  let resultado = await executar(payload)
  for (let tentativa = 0; tentativa < APOLICE_AUTO_FALLBACK_GROUPS.length; tentativa += 1) {
    const ausentes = apoliceColunasAusentes(resultado.error).filter(coluna => !removidas.includes(coluna))
    if (!ausentes.length) return resultado
    removidas = removidas.concat(ausentes)
    resultado = await executar(omitKeys(payload, removidas))
  }
  return resultado
}

function buildApoliceAutoPayload(payload, clienteId, premioLiquido, pctComissao, valorComissao, comparativoRenovacao, valorRepasse) {
  return {
    emissao_id: payload.emissao_id || null,
    cliente_id: clienteId,
    seguradora: payload.seguradora || null,
    numero_apolice: payload.numero_apolice || null,
    data_emissao: payload.data_emissao || null,
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
    pct_repasse: payload.tem_repasse ? parseFloat(payload.pct_repasse) || null : null,
    nome_repasse: payload.tem_repasse ? payload.nome_repasse || null : null,
    valor_repasse: payload.tem_repasse ? valorRepasse : null,
    nome_cliente: payload.nome_cliente || null,
    cpf_cliente: payload.cpf_cliente || null,
    celular_cliente: payload.celular_cliente || null,
    condutor_nome: payload.condutor_nome || null,
    condutor_cpf: payload.condutor_cpf || null,
    modelo_veiculo: payload.modelo_veiculo || null,
    placa: payload.placa || null,
    ...comparativoRenovacao,
  }
}

async function uploadApoliceDocumento(payload, apoliceId) {
  const file = payload.documento_apolice
  if (!file || !apoliceId) return null

  return uploadDocumento({
    file,
    apoliceId,
    cpfCnpj: payload.cpf_cliente || payload.cpf || payload.cnpj || null,
    userId: payload.user_id || payload.emitido_por || null,
  })
}

function buildRenewalComparisonPayload(payload = {}, premioLiquidoAtual = 0, comissaoAtual = 0) {
  if (!payload.eh_renovacao) {
    return {
      renovacao_premio_liquido_ano_anterior: null,
      renovacao_comissao_ano_anterior: null,
      renovacao_premio_liquido_ano_atual: null,
      renovacao_comissao_ano_atual: null,
      renovacao_diferenca_premio_liquido: null,
      renovacao_diferenca_comissao: null,
    }
  }

  const premioAnterior = toFloatOrNull(payload.renovacao_premio_liquido_ano_anterior)
  const comissaoAnterior = toFloatOrNull(payload.renovacao_comissao_ano_anterior)
  const premioAtual = toFloatOrNull(payload.renovacao_premio_liquido_ano_atual) ?? premioLiquidoAtual
  const comissaoAtualFinal = toFloatOrNull(payload.renovacao_comissao_ano_atual) ?? comissaoAtual

  return {
    renovacao_premio_liquido_ano_anterior: premioAnterior,
    renovacao_comissao_ano_anterior: comissaoAnterior,
    renovacao_premio_liquido_ano_atual: premioAtual,
    renovacao_comissao_ano_atual: comissaoAtualFinal,
    renovacao_diferenca_premio_liquido: (premioAtual ?? 0) - (premioAnterior ?? 0),
    renovacao_diferenca_comissao: (comissaoAtualFinal ?? 0) - (comissaoAnterior ?? 0),
  }
}

async function resolverClienteAutoId(payload = {}) {
  if (isUuid(payload.cliente_id)) return payload.cliente_id

  const cpf = normalizeCpf(payload.cpf_cliente || payload.cpf)
  if (!cpf) {
    throw new Error('CPF do cliente é obrigatório para salvar o registro do seguro auto.')
  }

  const nomeCompleto = payload.nome_cliente || payload.nome_completo || payload.nome || cpf
  const celular = payload.celular_cliente || payload.celular || null
  const email = payload.email_cliente || payload.email || null

  const { data: existente, error: buscarError } = await supabase
    .from('clientes_auto')
    .select('*')
    .eq('cpf', cpf)
    .maybeSingle()

  if (buscarError) throw buscarError

  if (existente?.id) {
    const updates = {}
    if (nomeCompleto && nomeCompleto !== existente.nome_completo) updates.nome_completo = nomeCompleto
    if (celular && celular !== existente.celular) updates.celular = celular
    if (email && email !== existente.email) updates.email = email
    if (payload.estado_civil && payload.estado_civil !== existente.estado_civil) updates.estado_civil = payload.estado_civil
    if (payload.profissao && payload.profissao !== existente.profissao) updates.profissao = payload.profissao

    if (Object.keys(updates).length) {
      const { error: updateError } = await supabase
        .from('clientes_auto')
        .update(updates)
        .eq('id', existente.id)
      if (updateError) throw updateError
    }

    return existente.id
  }

  const { data, error } = await supabase
    .from('clientes_auto')
    .insert({
      nome_completo: nomeCompleto,
      cpf,
      telefone: payload.telefone || null,
      celular,
      email,
      estado_civil: payload.estado_civil || null,
      profissao: payload.profissao || null,
    })
    .select()
    .single()

  if (error) throw error
  return data.id
}

// Quando uma cotacao de renovacao vira apolice emitida: marca a cotacao como
// convertida (fecha o funil de conversao) e a renovacao que a originou como
// concluida, para que ela pare de aparecer como pendente em /auto/renovacoes.
async function concluirCotacaoEVincularRenovacao(cotacaoId) {
  if (!cotacaoId) return

  const { error: statusError } = await supabase
    .from('cotacoes_auto')
    .update({ status: 'convertida' })
    .eq('id', cotacaoId)
  if (statusError) throw statusError

  const { error: renovacaoError } = await supabase
    .from('renovacoes_auto')
    .update({ status_renovacao: 'renovada' })
    .eq('cotacao_id', cotacaoId)
  if (renovacaoError) throw renovacaoError
}

export function getEmissaoColuna(item) {
  const raw = item?.coluna
  if (typeof raw !== 'string') return 'pendentes'
  const trimmed = raw.trim()
  if (!trimmed) return 'pendentes'
  if (trimmed === 'pendente') return 'pendentes'
  if (trimmed === 'cotacao_feita' && !item?.resultado) {
    return 'pendentes'
  }
  return trimmed
}

function toMonthSeries(items, { meses = 6, getDate, getValue, endMonth } = {}) {
  const base = parseMonthRef(endMonth) || new Date()
  const resultado = []
  for (let i = meses - 1; i >= 0; i--) {
    const referencia = new Date(base.getFullYear(), base.getMonth() - i, 1)
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
  return data ?? []
}

export async function criarCotacaoAuto(payload) {
  const clienteId = await resolverClienteAutoId(payload)
  const insertPayload = {
    cliente_id: clienteId,
    tipo: payload.tipo || 'novo',
    status: payload.status || 'pendente',
    ...pickDefined(payload, [
      'origem_lead',
      'nome_cliente',
      'cpf_cliente',
      'celular_cliente',
      'email_cliente',
      'estado_civil_cliente',
      'profissao_cliente',
      'condutor_nome',
      'condutor_cpf',
      'estado_civil_condutor',
      'cep_pernoite',
      'uso_veiculo',
      'garagem_residencia',
      'garagem_trabalho',
      'garagem_estudo',
      'jovens_18_26',
      'modelo_veiculo',
      'placa',
      'veiculo_financiado',
      'possui_kit_gas',
      'possui_blindagem',
      'isento_imposto',
      'seguradora_preferencial',
      'seguradora_mais_barata',
      'vigencia_inicio',
      'vigencia_fim',
    ]),
  }
  const { data, error } = await supabase
    .from('cotacoes_auto')
    .insert(insertPayload)
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

  const emissaoIds = (emissoes ?? []).map(item => item.id).filter(Boolean)

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
  if (!cotacoes?.length) return

  const cotacaoIds = cotacoes.map(item => item.id).filter(Boolean)
  if (!cotacaoIds.length) return

  const { data: emissoesExistentes, error: emissoesError } = await supabase
    .from('emissoes_auto')
    .select('cotacao_id')
    .in('cotacao_id', cotacaoIds)

  if (emissoesError) throw emissoesError

  const existentes = new Set((emissoesExistentes ?? []).map(item => item.cotacao_id).filter(Boolean))
  const faltantes = cotacoes.filter(item => !existentes.has(item.id))

  if (!faltantes.length) return

  const payload = await Promise.all(faltantes.map(async item => ({
    cotacao_id: item.id,
    cliente_id: await resolverClienteAutoId(item),
    tipo: item.tipo,
    coluna: null,
    created_at: item.created_at,
    updated_at: item.created_at,
  })))

  const { error: insertError } = await supabase
    .from('emissoes_auto')
    .insert(payload)

  if (insertError) throw insertError
}

export async function getEmissoesAuto({ inicio, fim } = {}) {
  await sincronizarEmissoesPendentes()

  let q = supabase
    .from('emissoes_auto')
    .select('*, cotacoes_auto(*), apolices_auto(*)')
    .order('created_at', { ascending: false })

  if (inicio) q = q.gte('created_at', `${inicio}T00:00:00`)
  if (fim) q = q.lte('created_at', `${fim}T23:59:59`)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function getEmissaoAuto(id) {
  if (!id) return null
  const { data, error } = await supabase
    .from('emissoes_auto')
    .select('*, cotacoes_auto(*), apolices_auto(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function getApoliceAutoDetalhe(id) {
  if (!id) return null

  const [{ data: apolice, error }, { data: renovacoes, error: renovacoesError }] = await Promise.all([
    selecionarComFallbackApolice(cols => supabase
      .from('apolices_auto')
      .select(`${cols}, emissoes_auto(${EMISSAO_AUTO_COLUMNS}, cotacoes_auto(${COTACAO_AUTO_COLUMNS}))`)
      .eq('id', id)
      .single()),
    supabase
      .from('renovacoes_auto')
      .select(RENOVACAO_AUTO_COLUMNS)
      .eq('apolice_id', id)
      .order('vigencia_fim', { ascending: true }),
  ])

  if (error) throw error
  if (renovacoesError) throw renovacoesError

  return {
    ...apolice,
    renovacoes_auto: renovacoes ?? [],
  }
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
      seguradoras_cotadas: seguradoras_cotadas ?? [],
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

export async function atualizarEmissaoAutoCompleta(payload) {
  const clienteId = await resolverClienteAutoId(payload)
  const premioLiquido = parseFloat(payload.premio_liquido) || 0
  const pctComissao = parseFloat(payload.pct_comissao) || 0
  const valorComissao = calcularValorComissaoAuto(premioLiquido, pctComissao)
  const comparativoRenovacao = buildRenewalComparisonPayload(payload, premioLiquido, valorComissao)
  const valorRepasse = payload.tem_repasse && payload.pct_repasse
    ? valorComissao * parseFloat(payload.pct_repasse)
    : null

  const emissaoPayload = {
    cliente_id: clienteId,
    tipo: payload.tipo || 'novo',
    coluna: payload.coluna === 'pendentes' ? null : (payload.coluna || null),
    resultado: payload.resultado || null,
    seguradoras_cotadas: Array.isArray(payload.seguradoras_cotadas) ? payload.seguradoras_cotadas : [],
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
    pct_repasse: payload.tem_repasse ? parseFloat(payload.pct_repasse) || null : null,
    nome_repasse: payload.tem_repasse ? payload.nome_repasse || null : null,
    valor_repasse: payload.tem_repasse ? valorRepasse : null,
    ...comparativoRenovacao,
    updated_at: new Date().toISOString(),
  }

  let { error: emissaoError } = await supabase
    .from('emissoes_auto')
    .update(emissaoPayload)
    .eq('id', payload.id)
  if (isMissingColumnError(emissaoError, 'emissoes_auto', AUTO_RENEWAL_COMPARE_FIELDS)) {
    ;({ error: emissaoError } = await supabase
      .from('emissoes_auto')
      .update(omitKeys(emissaoPayload, AUTO_RENEWAL_COMPARE_FIELDS))
      .eq('id', payload.id))
  }
  if (emissaoError) throw emissaoError

  if (payload.cotacao_id) {
    const primeiraSeguradora = Array.isArray(payload.seguradoras_cotadas) && payload.seguradoras_cotadas.length > 0
      ? payload.seguradoras_cotadas[0]
      : null

    const cotacaoPayload = {
      tipo: payload.eh_renovacao ? 'renovacao' : (payload.tipo || 'novo'),
      nome_cliente: payload.nome_cliente || null,
      cpf_cliente: payload.cpf_cliente || null,
      celular_cliente: payload.celular_cliente || null,
      email_cliente: payload.email_cliente || null,
      estado_civil_cliente: payload.estado_civil_cliente || null,
      profissao_cliente: payload.profissao_cliente || null,
      origem_lead: payload.origem_lead || null,
      condutor_nome: payload.condutor_nome || null,
      condutor_cpf: payload.condutor_cpf || null,
      estado_civil_condutor: payload.estado_civil_condutor || null,
      cep_pernoite: payload.cep_pernoite || null,
      uso_veiculo: payload.uso_veiculo || null,
      garagem_residencia: !!payload.garagem_residencia,
      garagem_trabalho: !!payload.garagem_trabalho,
      garagem_estudo: !!payload.garagem_estudo,
      jovens_18_26: !!payload.jovens_18_26,
      modelo_veiculo: payload.modelo_veiculo || null,
      placa: payload.placa || null,
      veiculo_financiado: !!payload.veiculo_financiado,
      possui_kit_gas: !!payload.possui_kit_gas,
      possui_blindagem: !!payload.possui_blindagem,
      isento_imposto: !!payload.isento_imposto,
      vigencia_inicio: payload.vigencia_inicio || null,
      vigencia_fim: payload.vigencia_fim || null,
      seguradora_preferencial: primeiraSeguradora ? {
        nome: primeiraSeguradora.nome || null,
        valor_total: primeiraSeguradora.valor_total || null,
        premio_liquido: primeiraSeguradora.premio_liquido || null,
        pct_comissao: primeiraSeguradora.pct_comissao || null,
        parcelamentos: primeiraSeguradora.parcelamentos || null,
        forma_pagamento: primeiraSeguradora.forma_pagamento || null,
      } : undefined,
    }

    const { error: cotacaoError } = await supabase
      .from('cotacoes_auto')
      .update(cotacaoPayload)
      .eq('id', payload.cotacao_id)
    if (cotacaoError) throw cotacaoError
  }

  const salvarApolice = payload.coluna === 'apolice_emitida' || payload.criar_apolice || payload.apolice_id
  if (salvarApolice) {
    const apolicePayload = buildApoliceAutoPayload(payload, clienteId, premioLiquido, pctComissao, valorComissao, comparativoRenovacao, valorRepasse)

    const { data: apoliceData, error: apoliceError } = await escreverApoliceAutoComFallback(apolicePayload, body => (
      payload.apolice_id
        ? supabase.from('apolices_auto').update(body).eq('id', payload.apolice_id).select().maybeSingle()
        : supabase.from('apolices_auto').insert(body).select().single()
    ))
    if (apoliceError) throw apoliceError
    const apoliceId = payload.apolice_id || apoliceData?.id || null
    if (apoliceId && payload.documento_apolice) {
      const { error: docError } = await uploadApoliceDocumento(payload, apoliceId)
      if (docError) throw docError
    }
    if (payload.coluna === 'apolice_emitida') {
      await concluirCotacaoEVincularRenovacao(payload.cotacao_id)
    }
  }
}

export async function deletarEmissaoAuto(id) {
  const { error: apolicesError } = await supabase
    .from('apolices_auto')
    .delete()
    .eq('emissao_id', id)
  if (apolicesError) throw apolicesError

  const { error } = await supabase
    .from('emissoes_auto')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// Apolices
export async function emitirApoliceAuto(payload) {
  const clienteId = await resolverClienteAutoId(payload)
  const premioLiquido = parseFloat(payload.premio_liquido) || 0
  const pctComissao = parseFloat(payload.pct_comissao) || 0
  const valorComissao = calcularValorComissaoAuto(premioLiquido, pctComissao)
  const ehRenovacao = payload.tipo === 'renovacao' || Boolean(payload.eh_renovacao)
  const payloadComTipoDerivado = { ...payload, eh_renovacao: ehRenovacao }
  const comparativoRenovacao = buildRenewalComparisonPayload(payloadComTipoDerivado, premioLiquido, valorComissao)

  const valorRepasse = payload.tem_repasse && payload.pct_repasse
    ? valorComissao * parseFloat(payload.pct_repasse)
    : null

  const colunaDestino = payload.coluna || 'apolice_emitida'
  if (payload.emissao_id) {
    const emissaoUpdate = {
      coluna: colunaDestino,
      cliente_id: clienteId,
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
      pct_repasse: payload.tem_repasse ? parseFloat(payload.pct_repasse) || null : null,
      nome_repasse: payload.tem_repasse ? payload.nome_repasse || null : null,
      valor_repasse: payload.tem_repasse ? valorRepasse : null,
      ...comparativoRenovacao,
      updated_at: new Date().toISOString(),
    }

    let { error: emissaoError } = await supabase
      .from('emissoes_auto')
      .update(emissaoUpdate)
      .eq('id', payload.emissao_id)
    if (isMissingColumnError(emissaoError, 'emissoes_auto', AUTO_RENEWAL_COMPARE_FIELDS)) {
      ;({ error: emissaoError } = await supabase
        .from('emissoes_auto')
        .update(omitKeys(emissaoUpdate, AUTO_RENEWAL_COMPARE_FIELDS))
        .eq('id', payload.emissao_id))
    }
    if (emissaoError) throw emissaoError
  }

  if (colunaDestino !== 'apolice_emitida') return { emissao: { id: payload.emissao_id }, apolice: null }

  if (payloadComTipoDerivado.tipo === 'endosso' && payload.cotacao_id) {
    const { data: endosso, error: endossoError } = await supabase
      .from('endossos_auto')
      .select('apolice_id')
      .eq('cotacao_id', payload.cotacao_id)
      .maybeSingle()
    if (endossoError) throw endossoError

    if (endosso?.apolice_id) {
      // O formulario reduzido de endosso so coleta um subconjunto das colunas da
      // apolice. Gravar o payload completo (buildApoliceAutoPayload) apagaria os
      // dados originais que o formulario nao conhece — responsavel, tipo de
      // producao, repasse, dados do segurado/condutor/veiculo e o comparativo de
      // renovacao. Por isso montamos um patch estreito: as colunas nao citadas
      // aqui simplesmente nao sao tocadas pelo update.
      const { data: apoliceOriginal, error: apoliceOriginalError } = await supabase
        .from('apolices_auto')
        .select('id, seguradora, numero_apolice')
        .eq('id', endosso.apolice_id)
        .single()
      if (apoliceOriginalError) throw apoliceOriginalError

      const patchEndosso = {
        seguradora: payloadComTipoDerivado.seguradora || apoliceOriginal?.seguradora || null,
        numero_apolice: payloadComTipoDerivado.numero_apolice || apoliceOriginal?.numero_apolice || null,
        data_emissao: payloadComTipoDerivado.data_emissao || null,
        vigencia_inicio: payloadComTipoDerivado.vigencia_inicio || null,
        vigencia_fim: payloadComTipoDerivado.vigencia_fim || null,
        premio_liquido: premioLiquido,
        pct_comissao: pctComissao,
        valor_comissao: valorComissao,
        forma_pagamento: payloadComTipoDerivado.forma_pagamento || null,
        parcelamento: payloadComTipoDerivado.parcelamento || null,
        emissao_id: payload.emissao_id || null,
      }

      const { data: apoliceAtualizada, error: updateError } = await escreverApoliceAutoComFallback(patchEndosso, body => (
        supabase.from('apolices_auto').update(body).eq('id', endosso.apolice_id).select().single()
      ))
      if (updateError) throw updateError
      if (payload.documento_apolice) {
        const { error: docError } = await uploadApoliceDocumento(payload, endosso.apolice_id)
        if (docError) throw docError
      }
      await concluirCotacaoEVincularRenovacao(payload.cotacao_id)
      return apoliceAtualizada
    }
  }

  const apolicePayload = buildApoliceAutoPayload(payloadComTipoDerivado, clienteId, premioLiquido, pctComissao, valorComissao, comparativoRenovacao, valorRepasse)
  const { data, error } = await escreverApoliceAutoComFallback(apolicePayload, body => (
    supabase.from('apolices_auto').insert(body).select().single()
  ))
  if (error) throw error
  if (payload.documento_apolice) {
    const { error: docError } = await uploadApoliceDocumento(payload, data?.id)
    if (docError) throw docError
  }
  await concluirCotacaoEVincularRenovacao(payload.cotacao_id)
  return data
}

export async function criarEmissaoManualAuto(payload) {
  const clienteId = await resolverClienteAutoId(payload)
  const premioLiquido = parseFloat(payload.premio_liquido) || 0
  const pctComissao = parseFloat(payload.pct_comissao) || 0
  const valorComissao = calcularValorComissaoAuto(premioLiquido, pctComissao)
  const comparativoRenovacao = buildRenewalComparisonPayload(payload, premioLiquido, valorComissao)
  const valorRepasse = payload.tem_repasse && payload.pct_repasse
    ? valorComissao * parseFloat(payload.pct_repasse)
    : null

  const emissaoPayload = {
    cotacao_id: null,
    cliente_id: clienteId,
    tipo: payload.tipo || 'novo',
    coluna: 'proposta_transmitida',
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
    ...comparativoRenovacao,
    forma_pagamento: payload.forma_pagamento || null,
    parcelamento: payload.parcelamento || null,
    tem_repasse: !!payload.tem_repasse,
    pct_repasse: payload.tem_repasse ? parseFloat(payload.pct_repasse) || null : null,
    nome_repasse: payload.tem_repasse ? payload.nome_repasse || null : null,
    valor_repasse: payload.tem_repasse ? valorRepasse : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  let { data: emissao, error: emissaoError } = await supabase
    .from('emissoes_auto')
    .insert(emissaoPayload)
    .select()
    .single()
  if (isMissingColumnError(emissaoError, 'emissoes_auto', AUTO_RENEWAL_COMPARE_FIELDS)) {
    ;({ data: emissao, error: emissaoError } = await supabase
      .from('emissoes_auto')
      .insert(omitKeys(emissaoPayload, AUTO_RENEWAL_COMPARE_FIELDS))
      .select()
      .single())
  }
  if (emissaoError) throw emissaoError

  const apolicePayload = {
    emissao_id: emissao.id,
    cliente_id: clienteId,
    seguradora: payload.seguradora || null,
    numero_apolice: payload.numero_apolice || null,
    data_emissao: payload.data_emissao || null,
    vigencia_inicio: payload.vigencia_inicio || null,
    vigencia_fim: payload.vigencia_fim || null,
    premio_liquido: premioLiquido,
    pct_comissao: pctComissao,
    valor_comissao: valorComissao,
    ...comparativoRenovacao,
    forma_pagamento: payload.forma_pagamento || null,
    parcelamento: payload.parcelamento || null,
    tipo_producao: payload.tipo_producao || 'individual',
    responsavel: payload.responsavel || null,
    eh_renovacao: !!payload.eh_renovacao,
    tem_repasse: !!payload.tem_repasse,
    pct_repasse: payload.tem_repasse ? parseFloat(payload.pct_repasse) || null : null,
    nome_repasse: payload.tem_repasse ? payload.nome_repasse || null : null,
    valor_repasse: payload.tem_repasse ? valorRepasse : null,
    nome_cliente: payload.nome_cliente || null,
    cpf_cliente: payload.cpf_cliente || null,
    celular_cliente: payload.celular_cliente || null,
    condutor_nome: payload.condutor_nome || null,
    condutor_cpf: payload.condutor_cpf || null,
    modelo_veiculo: payload.modelo_veiculo || null,
    placa: payload.placa || null,
  }

  const { data: apolice, error: apoliceError } = await escreverApoliceAutoComFallback(apolicePayload, body => (
    supabase.from('apolices_auto').insert(body).select().single()
  ))
  if (apoliceError) throw apoliceError

  return { emissao, apolice }
}

// Renovacoes
const RENOVACAO_LISTA_SELECT = '*, clientes_auto(nome_completo, telefone, celular, email), apolices_auto(id, emissao_id, numero_apolice, seguradora, vigencia_inicio, vigencia_fim, premio_liquido, pct_comissao, valor_comissao, forma_pagamento, parcelamento, nome_cliente, modelo_veiculo, placa, created_at, renovacao_premio_liquido_ano_anterior, renovacao_comissao_ano_anterior), cotacoes_auto:cotacao_id(id, status, tipo, created_at, emissoes_auto(coluna))'

export async function getRenovacoesAuto({ periodo, mes } = {}) {
  let q = supabase
    .from('renovacoes_auto')
    .select(RENOVACAO_LISTA_SELECT)
    .order('vigencia_fim', { ascending: true })

  if (periodo === 'proximo_mes') {
    const { inicio, fim } = getRangeFromMonthRef(mes, 1)
    q = q.gte('vigencia_fim', inicio).lte('vigencia_fim', fim)
  } else if (periodo === 'mes_atual') {
    const { inicio, fim } = getRangeFromMonthRef(mes, 0)
    q = q.gte('vigencia_fim', inicio).lte('vigencia_fim', fim)
  } else if (periodo === 'passadas') {
    const hoje = new Date().toISOString().split('T')[0]
    q = q.lt('vigencia_fim', hoje)
  }

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function atualizarStatusRenovacao(id, campos) {
  const { error } = await supabase
    .from('renovacoes_auto')
    .update(campos)
    .eq('id', id)
  if (error) throw error
}

export async function cancelarRenovacao(id, motivo) {
  const { error } = await supabase
    .from('renovacoes_auto')
    .update({ status_renovacao: 'nao_renovada', motivo_cancelamento: motivo || null })
    .eq('id', id)
  if (error) throw error
}

export async function criarCotacaoEndosso({
  cliente_id,
  apolice_id,
  motivo,
  campo_alterado,
  valor_anterior,
  valor_atual,
  valor_endosso,
}) {
  if (!apolice_id) throw new Error('Selecione a apólice a ser endossada.')
  if (!motivo || !motivo.trim()) throw new Error('Informe o motivo do endosso.')

  const { data: apolice, error: apoliceError } = await supabase
    .from('apolices_auto')
    .select('id, cliente_id, nome_cliente, cpf_cliente, celular_cliente, condutor_nome, condutor_cpf, modelo_veiculo, placa, seguradora, numero_apolice, vigencia_inicio, vigencia_fim')
    .eq('id', apolice_id)
    .single()
  if (apoliceError) throw apoliceError

  const cotacao = await criarCotacaoAuto({
    cliente_id: cliente_id || apolice.cliente_id,
    tipo: 'endosso',
    status: 'pendente',
    nome_cliente: apolice.nome_cliente,
    cpf_cliente: apolice.cpf_cliente,
    celular_cliente: apolice.celular_cliente,
    condutor_nome: apolice.condutor_nome,
    condutor_cpf: apolice.condutor_cpf,
    modelo_veiculo: apolice.modelo_veiculo,
    placa: apolice.placa,
    vigencia_inicio: apolice.vigencia_inicio,
    vigencia_fim: apolice.vigencia_fim,
    // cotacoes_auto nao tem coluna "seguradora"; a seguradora da apolice
    // endossada viaja em seguradora_preferencial para o formulario de emissao
    // do endosso ja nascer preenchido com ela.
    seguradora_preferencial: apolice.seguradora ? { nome: apolice.seguradora } : undefined,
  })

  const { data: endosso, error: endossoError } = await supabase
    .from('endossos_auto')
    .insert({
      apolice_id,
      cotacao_id: cotacao.id,
      motivo: motivo.trim(),
      campo_alterado: campo_alterado || null,
      valor_anterior: valor_anterior || null,
      valor_atual: valor_atual || null,
      valor_endosso: valor_endosso === '' || valor_endosso === undefined ? null : Number(valor_endosso),
    })
    .select()
    .single()
  if (endossoError) throw endossoError

  return { cotacao, endosso }
}

export async function getAutoRenovacaoMesStatus(mesRefs = []) {
  if (!mesRefs.length) return {}
  const { data, error } = await supabase
    .from('auto_renovacao_mes_status')
    .select('mes_ref, concluido_em, concluido_por')
    .in('mes_ref', mesRefs)
  if (error) throw error
  return Object.fromEntries((data ?? []).map(item => [item.mes_ref, item]))
}

export async function marcarMesRenovacaoConcluido(mesRef, userId) {
  const { error } = await supabase
    .from('auto_renovacao_mes_status')
    .upsert(
      { mes_ref: mesRef, concluido_em: new Date().toISOString(), concluido_por: userId || null },
      { onConflict: 'mes_ref' }
    )
  if (error) throw error
}

const PRAZO_ENVIO_ORCAMENTO_DIAS = 7

function subtrairDias(dataISO, dias) {
  const match = String(dataISO || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const [, ano, mes, dia] = match
  const date = new Date(Number(ano), Number(mes) - 1, Number(dia))
  date.setDate(date.getDate() - dias)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export async function puxarRenovacoesDoSistema(mesRef) {
  const alvo = parseMonthRef(mesRef)
  if (!alvo) throw new Error('Mes invalido.')

  const anoAnterior = new Date(alvo.getFullYear() - 1, alvo.getMonth(), 1)
  const { inicio, fim } = inicioFimMes(0, anoAnterior)

  const { data: apolices, error: apolicesError } = await supabase
    .from('apolices_auto')
    .select('id, cliente_id, seguradora, vigencia_inicio, vigencia_fim, premio_liquido, pct_comissao, nome_cliente, numero_apolice')
    .gte('vigencia_inicio', inicio)
    .lte('vigencia_inicio', fim)
    // renovacoes_auto.vigencia_fim e NOT NULL: uma apolice legada sem vigencia
    // final derrubaria o insert do lote inteiro, e nao so a propria linha.
    .not('vigencia_fim', 'is', null)
  if (apolicesError) throw apolicesError

  const apolicesElegiveis = apolices ?? []
  if (!apolicesElegiveis.length) return { encontradas: 0, criadas: 0 }

  const { data: existentes, error: existentesError } = await supabase
    .from('renovacoes_auto')
    .select('apolice_id')
    .in('apolice_id', apolicesElegiveis.map(item => item.id))
  if (existentesError) throw existentesError

  const apoliceIdsComRenovacao = new Set((existentes ?? []).map(item => item.apolice_id))
  const faltantes = apolicesElegiveis.filter(item => !apoliceIdsComRenovacao.has(item.id))
  if (!faltantes.length) return { encontradas: apolicesElegiveis.length, criadas: 0 }

  const payload = faltantes.map(apolice => ({
    apolice_id: apolice.id,
    cliente_id: apolice.cliente_id,
    seguradora: apolice.seguradora,
    vigencia_fim: apolice.vigencia_fim,
    data_limite_envio: subtrairDias(apolice.vigencia_fim, PRAZO_ENVIO_ORCAMENTO_DIAS),
    status_cotacao: 'nao_cotada',
    status_renovacao: 'pendente',
    origem: 'sistema',
    nome_segurado_anterior: apolice.nome_cliente,
    numero_apolice_anterior: apolice.numero_apolice,
    premio_liquido_anterior: apolice.premio_liquido,
    pct_comissao_anterior: apolice.pct_comissao,
  }))

  const { error: insertError } = await supabase.from('renovacoes_auto').insert(payload)
  if (insertError) throw insertError

  return { encontradas: apolicesElegiveis.length, criadas: faltantes.length }
}

export async function puxarRenovacoesDePlanilha(mesRef, rows = []) {
  if (!Array.isArray(rows) || !rows.length) return { lidas: 0, importadas: 0, duplicadas: 0, foraDoMes: 0 }

  const { inicio, fim } = getRangeFromMonthRef(mesRef, 0)

  // A dedupe abaixo so olha renovacoes existentes dentro da janela do mes-alvo.
  // Linhas com vigencia_fim fora dessa janela escapariam da dedupe e poderiam
  // ser inseridas de novo a cada re-upload, entao sao descartadas antes.
  const linhasDoMes = rows.filter(row => row?.vigencia_fim && row.vigencia_fim >= inicio && row.vigencia_fim <= fim)
  const foraDoMes = rows.length - linhasDoMes.length

  const { data: existentesDb, error: existentesError } = await supabase
    .from('renovacoes_auto')
    .select('nome_segurado_anterior, apolices_auto(nome_cliente)')
    .gte('vigencia_fim', inicio)
    .lte('vigencia_fim', fim)
  if (existentesError) throw existentesError

  const nomesExistentes = new Set(
    (existentesDb ?? [])
      .map(item => normalizeCompareText(limparNomeSegurado(item.apolices_auto?.nome_cliente || item.nome_segurado_anterior || '')))
      .filter(Boolean)
  )

  const novas = []
  let duplicadas = 0
  for (const row of linhasDoMes) {
    const nomeChave = normalizeCompareText(limparNomeSegurado(row.nome_cliente))
    if (!nomeChave || nomesExistentes.has(nomeChave)) {
      if (nomeChave) duplicadas += 1
      continue
    }
    nomesExistentes.add(nomeChave)
    novas.push({
      apolice_id: null,
      cliente_id: null,
      seguradora: row.seguradora || null,
      vigencia_fim: row.vigencia_fim,
      data_limite_envio: subtrairDias(row.vigencia_fim, PRAZO_ENVIO_ORCAMENTO_DIAS),
      status_cotacao: 'nao_cotada',
      status_renovacao: 'pendente',
      origem: 'xls',
      nome_segurado_anterior: row.nome_cliente,
      premio_liquido_anterior: row.premio_liquido,
      pct_comissao_anterior: row.pct_comissao,
    })
  }

  if (novas.length) {
    const { error: insertError } = await supabase.from('renovacoes_auto').insert(novas)
    if (insertError) throw insertError
  }

  return { lidas: rows.length, importadas: novas.length, duplicadas, foraDoMes }
}

// Busca leve de clientes_auto por nome/CPF, para autocomplete em formularios
// (ex.: "Criar renovacao manualmente"). Nao depende de nenhuma apolice
// existir — funciona mesmo com a carteira zerada.
export async function buscarClientesAuto(termo) {
  const texto = String(termo || '').trim()
  if (!texto) return []
  const { data, error } = await supabase
    .from('clientes_auto')
    .select('id, nome_completo, cpf, celular')
    .or(`nome_completo.ilike.%${texto}%,cpf.ilike.%${texto}%`)
    .order('nome_completo', { ascending: true })
    .limit(10)
  if (error) throw error
  return data ?? []
}

// Cria uma renovacao pendente direto pelo formulario "Criar manualmente" do
// painel de Renovacoes, sem depender do puxar automatico (sistema/planilha).
// cliente_id vem preenchido quando o usuario seleccionou um cliente ja
// cadastrado (busca por nome/CPF); nesse caso o nome real do cliente vira
// nome_segurado_anterior tambem, para o card exibir o nome sem precisar de
// outro join. Sem cliente_id, nomeManual e o unico nome disponivel.
export async function criarRenovacaoManual({ cliente_id, nomeManual, seguradora, vigencia_fim, data_limite_envio }) {
  if (!vigencia_fim) throw new Error('Informe a data de vencimento.')

  let nomeSegurado = nomeManual || null
  if (cliente_id) {
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes_auto')
      .select('nome_completo')
      .eq('id', cliente_id)
      .single()
    if (clienteError) throw clienteError
    nomeSegurado = cliente.nome_completo
  }
  if (!nomeSegurado) throw new Error('Selecione um cliente ou informe o nome do segurado.')

  const { data, error } = await supabase
    .from('renovacoes_auto')
    .insert({
      cliente_id: cliente_id || null,
      apolice_id: null,
      seguradora: seguradora || null,
      vigencia_fim,
      data_limite_envio: data_limite_envio || subtrairDias(vigencia_fim, PRAZO_ENVIO_ORCAMENTO_DIAS),
      status_cotacao: 'nao_cotada',
      status_renovacao: 'pendente',
      origem: 'manual',
      nome_segurado_anterior: nomeSegurado,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// Cria (ou reaproveita) a cotacao de renovacao vinculada a uma linha de
// renovacoes_auto. Usada tanto pelo botao "Cotar" na propria renovacao quanto
// pelo fluxo "Nova cotacao > Renovacao" da Gestao Auto — mesma funcao, para os
// dois pontos de entrada nunca divergirem em comportamento. Se ja existir uma
// cotacao ativa vinculada (status != 'perdida'), retorna ela em vez de criar
// outra, evitando duplicidade por clique repetido.
export async function iniciarCotacaoRenovacao(renovacaoId) {
  if (!renovacaoId) throw new Error('Renovacao invalida.')

  const { data: renovacao, error: renovacaoError } = await supabase
    .from('renovacoes_auto')
    .select(`
      id, cliente_id, apolice_id, seguradora, vigencia_fim, cotacao_id, nome_segurado_anterior,
      clientes_auto(nome_completo, cpf, celular, telefone, email),
      apolices_auto(nome_cliente, cpf_cliente, celular_cliente, condutor_nome, condutor_cpf, modelo_veiculo, placa, vigencia_inicio, vigencia_fim)
    `)
    .eq('id', renovacaoId)
    .single()
  if (renovacaoError) throw renovacaoError

  if (renovacao.cotacao_id) {
    const { data: cotacaoExistente, error: cotacaoError } = await supabase
      .from('cotacoes_auto')
      .select('id, status')
      .eq('id', renovacao.cotacao_id)
      .maybeSingle()
    if (cotacaoError) throw cotacaoError
    if (cotacaoExistente && cotacaoExistente.status !== 'perdida') {
      return { cotacaoId: cotacaoExistente.id, created: false }
    }
  }

  const apolice = renovacao.apolices_auto || {}
  const cliente = renovacao.clientes_auto || {}

  const cotacao = await criarCotacaoAuto({
    cliente_id: renovacao.cliente_id,
    tipo: 'renovacao',
    status: 'pendente',
    // Renovacao vinda de XLS nao tem apolice nem cliente vinculado: o unico
    // nome disponivel e o texto puro em nome_segurado_anterior.
    nome_cliente: apolice.nome_cliente || cliente.nome_completo || renovacao.nome_segurado_anterior || null,
    cpf_cliente: apolice.cpf_cliente || cliente.cpf || null,
    celular_cliente: apolice.celular_cliente || cliente.celular || cliente.telefone || null,
    email_cliente: cliente.email || null,
    condutor_nome: apolice.condutor_nome || null,
    condutor_cpf: apolice.condutor_cpf || null,
    modelo_veiculo: apolice.modelo_veiculo || null,
    placa: apolice.placa || null,
    vigencia_inicio: apolice.vigencia_inicio || null,
    vigencia_fim: renovacao.vigencia_fim || apolice.vigencia_fim || null,
    seguradora_preferencial: renovacao.seguradora ? { nome: renovacao.seguradora } : undefined,
  })

  const { error: linkError } = await supabase
    .from('renovacoes_auto')
    .update({ cotacao_id: cotacao.id })
    .eq('id', renovacaoId)
  if (linkError) throw linkError

  return { cotacaoId: cotacao.id, created: true }
}

export async function getRenovacoesDisponiveisParaCotacao(search = '') {
  const { data, error } = await supabase
    .from('renovacoes_auto')
    .select('id, cliente_id, seguradora, vigencia_fim, cotacao_id, clientes_auto(nome_completo, celular, telefone), apolices_auto(numero_apolice, modelo_veiculo, placa)')
    .order('vigencia_fim', { ascending: true })
    .limit(200)
  if (error) throw error

  const termo = search.trim().toLowerCase()
  const resultado = data ?? []
  if (!termo) return resultado

  return resultado.filter(item => {
    const texto = [
      item.clientes_auto?.nome_completo,
      item.seguradora,
      item.apolices_auto?.numero_apolice,
      item.apolices_auto?.modelo_veiculo,
      item.apolices_auto?.placa,
    ].filter(Boolean).join(' ').toLowerCase()
    return texto.includes(termo)
  })
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

  let result = data ?? []
  if (search) {
    const term = search.toLowerCase()
    result = result.filter(item =>
      item.nome_cliente?.toLowerCase().includes(term) ||
      item.cpf_cliente?.toLowerCase().includes(term) ||
      item.celular_cliente?.toLowerCase().includes(term) ||
      item.condutor_nome?.toLowerCase().includes(term) ||
      item.condutor_cpf?.toLowerCase().includes(term) ||
      item.modelo_veiculo?.toLowerCase().includes(term) ||
      item.placa?.toLowerCase().includes(term) ||
      item.numero_apolice?.toLowerCase().includes(term) ||
      item.seguradora?.toLowerCase().includes(term)
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

  let result = data ?? []
  if (search) {
    const term = search.toLowerCase().trim()
    if (term) {
      result = result.filter(item => {
        const c = item.emissoes_auto?.cotacoes_auto || {}
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
          item.emissoes_auto?.numero_apolice,
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

export async function importarApolicesAutoPlanilha(rows = []) {
  const resultado = {
    total: rows.length,
    importadas: 0,
    atualizadas: 0,
    ignoradas: 0,
    erros: [],
  }

  for (const [index, row] of rows.entries()) {
    const nomeCliente = normalizeImportText(row.nome_cliente)
    const seguradora = normalizeImportText(row.seguradora)
    const vigenciaFim = row.vigencia_fim || null

    if (!nomeCliente || !vigenciaFim) {
      resultado.ignoradas += 1
      resultado.erros.push({ linha: row.linha || index + 1, motivo: 'Nome do segurado ou data de vencimento ausente.' })
      continue
    }

    const premioLiquido = toFloatOrNull(row.premio_liquido) || 0
    const pctComissao = toFloatOrNull(row.pct_comissao) || 0
    const valorComissao = calcularValorComissaoAuto(premioLiquido, pctComissao)
    const statusRenovacao = normalizeStatusRenovacaoAuto(row.status)
    const observacoes = [
      row.status ? `Status planilha: ${row.status}` : '',
      row.limite ? `Limite: ${row.limite}` : '',
      row.comissao_passada !== null && row.comissao_passada !== undefined && row.comissao_passada !== '' ? `Comissao passada: ${row.comissao_passada}` : '',
      row.aba ? `Aba: ${row.aba}` : '',
    ].filter(Boolean).join(' | ')

    const payload = {
      emissao_id: null,
      cliente_id: null,
      seguradora: seguradora || null,
      numero_apolice: normalizeImportText(row.numero_apolice) || null,
      vigencia_inicio: row.vigencia_inicio || null,
      vigencia_fim: vigenciaFim,
      premio_liquido: premioLiquido,
      pct_comissao: pctComissao,
      valor_comissao: valorComissao,
      forma_pagamento: normalizeImportText(row.forma_pagamento) || observacoes || null,
      parcelamento: normalizeImportText(row.parcelamento) || null,
      tipo_producao: row.tipo_producao || 'individual',
      responsavel: normalizeImportText(row.responsavel) || null,
      eh_renovacao: true,
      tem_repasse: false,
      pct_repasse: null,
      nome_repasse: null,
      valor_repasse: null,
      nome_cliente: nomeCliente,
      cpf_cliente: normalizeImportText(row.cpf_cliente) || null,
      celular_cliente: normalizeImportText(row.celular_cliente) || null,
      condutor_nome: normalizeImportText(row.condutor_nome) || nomeCliente,
      condutor_cpf: normalizeImportText(row.condutor_cpf) || normalizeImportText(row.cpf_cliente) || null,
      modelo_veiculo: normalizeImportText(row.modelo_veiculo) || null,
      placa: normalizeImportText(row.placa) || null,
      renovacao_premio_liquido_ano_anterior: null,
      renovacao_comissao_ano_anterior: toFloatOrNull(row.comissao_passada),
      renovacao_premio_liquido_ano_atual: premioLiquido || null,
      renovacao_comissao_ano_atual: valorComissao || null,
      renovacao_diferenca_premio_liquido: null,
      renovacao_diferenca_comissao: null,
    }

    const duplicateQuery = supabase
      .from('apolices_auto')
      .select('id')
      .eq('nome_cliente', nomeCliente)
      .eq('vigencia_fim', vigenciaFim)
      .limit(1)

    const { data: duplicadas, error: duplicateError } = seguradora
      ? await duplicateQuery.eq('seguradora', seguradora)
      : await duplicateQuery
    if (duplicateError) throw duplicateError

    let apoliceId = duplicadas?.[0]?.id || null
    if (apoliceId) {
      const { error } = await escreverApoliceAutoComFallback(payload, body => (
        supabase.from('apolices_auto').update(body).eq('id', apoliceId)
      ))
      if (error) throw error
      resultado.atualizadas += 1
    } else {
      const { data, error } = await escreverApoliceAutoComFallback(payload, body => (
        supabase.from('apolices_auto').insert(body).select('id').single()
      ))
      if (error) throw error
      apoliceId = data?.id || null
      resultado.importadas += 1
    }

    if (apoliceId) {
      const { error: renovacaoError } = await supabase
        .from('renovacoes_auto')
        .update(statusRenovacao)
        .eq('apolice_id', apoliceId)
      if (renovacaoError) throw renovacaoError
    }
  }

  return resultado
}

const HISTORICO_IMPORT_CHUNK_SIZE = 200
const APOLICE_AUTO_ORIGEM_FIELDS = ['origem_pre_sistema']

export async function importarApolicesAutoHistorico(rows = []) {
  const resultado = { total: rows.length, importadas: 0, duplicadas: 0, ignoradas: 0, erros: [] }

  const candidatos = []
  rows.forEach((row, index) => {
    const nomeCliente = normalizeImportText(row.nome_cliente)
    const vigenciaInicio = row.vigencia_inicio || null
    if (!nomeCliente || !vigenciaInicio) {
      resultado.ignoradas += 1
      resultado.erros.push({ aba: row.aba || null, linha: row.linha || index + 1, motivo: 'Nome ou data ausente.' })
      return
    }
    const vigenciaFim = somarUmAno(vigenciaInicio)
    if (!vigenciaFim) {
      resultado.ignoradas += 1
      resultado.erros.push({ aba: row.aba || null, linha: row.linha || index + 1, motivo: 'Data de inicio invalida.' })
      return
    }
    candidatos.push({
      nome_cliente: nomeCliente,
      seguradora: normalizeImportText(row.seguradora) || null,
      vigencia_inicio: vigenciaInicio,
      vigencia_fim: vigenciaFim,
      pct_comissao: row.pct_comissao ?? null,
      comissao_passada: row.comissao_passada ?? null,
    })
  })

  const { data: existentes, error: existentesError } = await supabase
    .from('apolices_auto')
    .select('nome_cliente, vigencia_fim, seguradora')
    .eq('origem_pre_sistema', true)
  if (existentesError) throw existentesError

  const chavesExistentes = new Set(
    (existentes ?? []).map(item => `${normalizeCompareText(item.nome_cliente)}|${item.vigencia_fim}|${normalizeCompareText(item.seguradora)}`)
  )

  const paraInserir = []
  candidatos.forEach(candidato => {
    const chave = `${normalizeCompareText(candidato.nome_cliente)}|${candidato.vigencia_fim}|${normalizeCompareText(candidato.seguradora)}`
    if (chavesExistentes.has(chave)) {
      resultado.duplicadas += 1
      return
    }
    chavesExistentes.add(chave)
    paraInserir.push({
      emissao_id: null,
      cliente_id: null,
      seguradora: candidato.seguradora,
      numero_apolice: null,
      vigencia_inicio: candidato.vigencia_inicio,
      vigencia_fim: candidato.vigencia_fim,
      premio_liquido: null,
      pct_comissao: candidato.pct_comissao,
      valor_comissao: null,
      forma_pagamento: null,
      parcelamento: null,
      tipo_producao: 'individual',
      responsavel: null,
      eh_renovacao: true,
      tem_repasse: false,
      pct_repasse: null,
      nome_repasse: null,
      valor_repasse: null,
      nome_cliente: candidato.nome_cliente,
      cpf_cliente: null,
      celular_cliente: null,
      condutor_nome: null,
      condutor_cpf: null,
      modelo_veiculo: null,
      placa: null,
      renovacao_comissao_ano_anterior: candidato.comissao_passada,
      origem_pre_sistema: true,
    })
  })

  for (let i = 0; i < paraInserir.length; i += HISTORICO_IMPORT_CHUNK_SIZE) {
    const chunk = paraInserir.slice(i, i + HISTORICO_IMPORT_CHUNK_SIZE)
    let { error } = await supabase.from('apolices_auto').insert(chunk)
    if (isMissingColumnError(error, 'apolices_auto', APOLICE_AUTO_ORIGEM_FIELDS)) {
      ;({ error } = await supabase
        .from('apolices_auto')
        .insert(chunk.map(item => omitKeys(item, APOLICE_AUTO_ORIGEM_FIELDS))))
    }
    if (error) {
      resultado.erros.push({ aba: null, linha: null, motivo: `Lote ${Math.floor(i / HISTORICO_IMPORT_CHUNK_SIZE) + 1}: ${error.message}` })
      continue
    }
    resultado.importadas += chunk.length
  }

  return resultado
}
// Usado quando a apolice nao tem emissao vinculada (emissoes_auto ausente):
// monta um payload restrito as colunas reais de apolices_auto e recalcula
// valor_comissao/valor_repasse/comparativo de renovacao a partir do form
// editado, em vez de gravar o form inteiro (que tem campos como
// email_cliente/origem_lead que so existem em cotacoes_auto).
export async function atualizarApoliceAutoSemEmissao(id, form) {
  const premioLiquido = parseFloat(form.premio_liquido) || 0
  const pctComissao = parseFloat(form.pct_comissao) || 0
  const valorComissao = calcularValorComissaoAuto(premioLiquido, pctComissao)
  const comparativoRenovacao = buildRenewalComparisonPayload(form, premioLiquido, valorComissao)
  const valorRepasse = form.tem_repasse && form.pct_repasse
    ? valorComissao * parseFloat(form.pct_repasse)
    : null

  const payload = buildApoliceAutoPayload(form, undefined, premioLiquido, pctComissao, valorComissao, comparativoRenovacao, valorRepasse)
  delete payload.cliente_id
  delete payload.emissao_id

  const { data, error } = await escreverApoliceAutoComFallback(payload, body => (
    supabase.from('apolices_auto').update(body).eq('id', id).select().maybeSingle()
  ))
  if (error) throw error
  return data
}

export async function getClienteAutoDetalhe(ref) {
  if (!ref) return null

  const refIsUuid = isUuid(ref)
  const cpfRef = normalizeCpf(ref)
  let cliente = null

  if (refIsUuid) {
    const { data: clienteById, error: clienteByIdError } = await supabase
      .from('clientes_auto')
      .select('*')
      .eq('id', ref)
      .maybeSingle()
    if (clienteByIdError) throw clienteByIdError
    cliente = clienteById ?? null
  }

  if (!cliente && cpfRef) {
    const { data: clienteByCpf, error: clienteByCpfError } = await supabase
      .from('clientes_auto')
      .select('*')
      .eq('cpf', cpfRef)
      .maybeSingle()
    if (clienteByCpfError) throw clienteByCpfError
    cliente = clienteByCpf ?? null
  }

  if (!cliente && refIsUuid) {
    const { data: apoliceRef, error: apoliceRefError } = await supabase
      .from('apolices_auto')
      .select('id, cliente_id, nome_cliente, cpf_cliente, celular_cliente')
      .eq('id', ref)
      .maybeSingle()
    if (apoliceRefError) throw apoliceRefError

    if (apoliceRef?.cliente_id) {
      const { data: clienteByApolice, error: clienteByApoliceError } = await supabase
        .from('clientes_auto')
        .select('*')
        .eq('id', apoliceRef.cliente_id)
        .maybeSingle()
      if (clienteByApoliceError) throw clienteByApoliceError
      cliente = clienteByApolice ?? {
        id: apoliceRef.cliente_id,
        nome_completo: apoliceRef.nome_cliente || null,
        cpf: normalizeCpf(apoliceRef.cpf_cliente || ''),
        celular: apoliceRef.celular_cliente || null,
      }
    } else if (apoliceRef) {
      cliente = {
        id: null,
        nome_completo: apoliceRef.nome_cliente || null,
        cpf: normalizeCpf(apoliceRef.cpf_cliente || ''),
        celular: apoliceRef.celular_cliente || null,
      }
    }
  }

  const clientId = cliente?.id || null
  const cpf = normalizeCpf(cliente?.cpf || cpfRef)
  // Clientes agrupados so por nome (sem cliente_id/CPF em nenhum registro) chegam
  // aqui com "ref" sendo o proprio nome_cliente (ver clientKey em AutoClientes.jsx).
  // Nesse caso nao ha id/CPF valido para filtrar: usar nome_cliente como escopo
  // nas tabelas que tem essa coluna, e nao bater em renovacoes_auto (que so tem
  // cliente_id, sem nome) com um filtro que sempre falharia.
  const nomeRef = !clientId && !cpf && !refIsUuid ? ref : null

  function orFilterValue(value) {
    return `"${String(value).replace(/"/g, '\\"')}"`
  }

  function scopeByRef(query, { allowNome = false } = {}) {
    const filters = []
    if (clientId) filters.push(`cliente_id.eq.${orFilterValue(clientId)}`)
    if (cpf) filters.push(`cpf_cliente.eq.${orFilterValue(cpf)}`)
    if (refIsUuid) filters.push(`id.eq.${orFilterValue(ref)}`)
    if (allowNome && nomeRef) filters.push(`nome_cliente.eq.${orFilterValue(nomeRef)}`)
    if (filters.length === 0) return null
    return query.or(filters.join(','))
  }

  // Reconstroi as 4 queries do zero a cada tentativa: um query builder do
  // Supabase so pode ser executado uma vez, entao o retry por coluna
  // ausente (migration pendente) precisa remontar tudo, nao so reawaitar.
  function montarQueries(apoliceCols) {
    const apolicesQuery = supabase
      .from('apolices_auto')
      .select(`${apoliceCols}, emissoes_auto(${EMISSAO_AUTO_COLUMNS}, cotacoes_auto(${COTACAO_AUTO_COLUMNS}))`)
      .order('vigencia_inicio', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    const emissoesQuery = supabase
      .from('emissoes_auto')
      .select(`${EMISSAO_AUTO_COLUMNS}, cotacoes_auto(${COTACAO_AUTO_COLUMNS}), apolices_auto(${apoliceCols})`)
      .order('created_at', { ascending: false })

    const cotacoesQuery = supabase
      .from('cotacoes_auto')
      .select(COTACAO_AUTO_COLUMNS)
      .order('created_at', { ascending: false })

    const renovacoesQuery = supabase
      .from('renovacoes_auto')
      .select(`${RENOVACAO_AUTO_COLUMNS}, apolices_auto(id, numero_apolice, seguradora, vigencia_inicio, vigencia_fim), clientes_auto(nome_completo, telefone, celular, email)`)
      .order('vigencia_fim', { ascending: true })

    const scopedApolices = scopeByRef(apolicesQuery, { allowNome: true })
    const scopedEmissoes = scopeByRef(emissoesQuery, { allowNome: true })
    const scopedCotacoes = scopeByRef(cotacoesQuery, { allowNome: true })
    // renovacoes_auto nao tem coluna nome_cliente (so cliente_id) - sem escopo
    // valido, nao ha como filtrar sem sempre falhar; retorna vazio.
    const scopedRenovacoes = scopeByRef(renovacoesQuery)

    return Promise.all([
      scopedApolices ?? Promise.resolve({ data: [], error: null }),
      scopedEmissoes ?? Promise.resolve({ data: [], error: null }),
      scopedCotacoes ?? Promise.resolve({ data: [], error: null }),
      scopedRenovacoes ?? Promise.resolve({ data: [], error: null }),
    ])
  }

  let removidas = []
  let [
    { data: apolices, error: apolicesError },
    { data: emissoes, error: emissoesError },
    { data: cotacoes, error: cotacoesError },
    { data: renovacoes, error: renovacoesError },
  ] = await montarQueries(apoliceAutoColunasSemGrupos(removidas))

  for (let tentativa = 0; tentativa < APOLICE_AUTO_FALLBACK_GROUPS.length; tentativa += 1) {
    const ausentes = [...new Set([
      ...apoliceColunasAusentesSelect(apolicesError),
      ...apoliceColunasAusentesSelect(emissoesError),
    ])].filter(coluna => !removidas.includes(coluna))
    if (!ausentes.length) break
    removidas = removidas.concat(ausentes)
    ;([
      { data: apolices, error: apolicesError },
      { data: emissoes, error: emissoesError },
      { data: cotacoes, error: cotacoesError },
      { data: renovacoes, error: renovacoesError },
    ] = await montarQueries(apoliceAutoColunasSemGrupos(removidas)))
  }

  if (apolicesError) throw apolicesError
  if (emissoesError) throw emissoesError
  if (cotacoesError) throw cotacoesError
  if (renovacoesError) throw renovacoesError

  const apolicesLista = apolices ?? []
  const emissoesLista = emissoes ?? []
  const cotacoesLista = cotacoes ?? []
  const renovacoesLista = renovacoes ?? []
  const latestApolice = apolicesLista[0] || null
  const latestEmissao = emissoesLista[0] || null
  const hoje = new Date().toISOString().split('T')[0]
  const apoliceAtiva = apolicesLista.find(item => item.vigencia_inicio && item.vigencia_fim && item.vigencia_inicio <= hoje && item.vigencia_fim >= hoje) || null
  const emRenovacao = renovacoesLista.find(item => item.status_renovacao !== 'renovada') || null

  const perfil = cliente || {
    id: clientId,
    nome_completo: latestApolice?.nome_cliente || latestEmissao?.nome_cliente || cotacoesLista[0]?.nome_cliente || 'Cliente sem nome',
    cpf,
    celular: latestApolice?.celular_cliente || latestEmissao?.celular_cliente || cotacoesLista[0]?.celular_cliente || null,
    email: cotacoesLista[0]?.email_cliente || null,
  }

  const clienteDesde = apolicesLista.reduce((min, item) => {
    if (!item.vigencia_inicio) return min
    return !min || item.vigencia_inicio < min ? item.vigencia_inicio : min
  }, null)

  return {
    cliente: perfil,
    clienteDesde,
    apolices: apolicesLista,
    emissoes: emissoesLista,
    cotacoes: cotacoesLista,
    renovacoes: renovacoesLista,
    statusAtual: emRenovacao ? 'Renovação em andamento' : (apoliceAtiva ? 'Cliente com apólice ativa' : 'Sem apólice ativa no momento'),
    destaque: {
      apoliceAtiva,
      latestApolice,
      latestEmissao,
      emRenovacao,
    },
    metricas: {
      apolicesEmitidas: apolicesLista.length,
      renovacoes: renovacoesLista.length,
      cotacoes: cotacoesLista.length,
      emissoes: emissoesLista.length,
      comissaoTotal: apolicesLista.reduce((total, item) => total + (Number(item.valor_comissao) || 0), 0),
      premioTotal: apolicesLista.reduce((total, item) => total + (Number(item.premio_liquido) || 0), 0),
    },
  }
}

// Dashboard
export async function getDashboardAutoMetrics({ mes } = {}) {
  const referencia = parseMonthRef(mes) || new Date()
  const { inicio, fim } = inicioFimMes(0, referencia)
  const proximoMes = inicioFimMes(1, referencia)
  const anoAnteriorInicio = new Date(referencia.getFullYear() - 1, referencia.getMonth(), 1).toISOString().split('T')[0]
  const anoAnteriorFim = new Date(referencia.getFullYear() - 1, referencia.getMonth() + 1, 0).toISOString().split('T')[0]

  const [emissoes, cotacoesMes, renovadasMes, vencendoNoMes, vencendoProximoMes, apolicesMes, cotacoesConvertidas, renovacoesPendentes, renovacoesAnoAnterior] = await Promise.all([
    supabase.from('apolices_auto').select('id, eh_renovacao').gte('created_at', inicio).lte('created_at', fim),
    supabase.from('cotacoes_auto').select('id').gte('created_at', inicio).lte('created_at', fim),
    supabase.from('renovacoes_auto').select('id').eq('status_renovacao', 'renovada').gte('created_at', inicio).lte('created_at', fim),
    supabase.from('renovacoes_auto').select('id').gte('vigencia_fim', inicio).lte('vigencia_fim', fim),
    supabase.from('renovacoes_auto').select('id').gte('vigencia_fim', proximoMes.inicio).lte('vigencia_fim', proximoMes.fim),
    supabase.from('apolices_auto').select('*').gte('created_at', inicio).lte('created_at', fim),
    supabase.from('cotacoes_auto').select('id').eq('status', 'convertida').gte('created_at', inicio).lte('created_at', fim),
    supabase.from('renovacoes_auto').select('id').neq('status_cotacao', 'cotada_enviada'),
    supabase.from('apolices_auto').select('*').eq('eh_renovacao', true).gte('created_at', anoAnteriorInicio).lte('created_at', anoAnteriorFim),
  ])

  const totalCotacoesMes = cotacoesMes.data?.length ?? 0
  const totalConvertidas = cotacoesConvertidas.data?.length ?? 0
  const comissaoTotal = (apolicesMes.data ?? []).reduce((sum, item) => sum + (item.valor_comissao || 0), 0)
  const renovacoesMesAtual = (apolicesMes.data ?? []).filter(item => item.eh_renovacao)
  const renovacoesAnoPassado = renovacoesAnoAnterior.data ?? []
  const renovacoesComissaoMesAtual = renovacoesMesAtual.reduce((sum, item) => sum + (item.renovacao_comissao_ano_atual ?? item.valor_comissao ?? 0), 0)
  const renovacoesComissaoAnoAnterior = renovacoesAnoPassado.reduce((sum, item) => sum + (item.renovacao_comissao_ano_anterior ?? item.renovacao_comissao_ano_atual ?? item.valor_comissao ?? 0), 0)
  const renovacoesPremioLiquidoMesAtual = renovacoesMesAtual.reduce((sum, item) => sum + (item.renovacao_premio_liquido_ano_atual ?? item.premio_liquido ?? 0), 0)
  const renovacoesPremioLiquidoAnoAnterior = renovacoesAnoPassado.reduce((sum, item) => sum + (item.renovacao_premio_liquido_ano_anterior ?? item.renovacao_premio_liquido_ano_atual ?? item.premio_liquido ?? 0), 0)
  const taxaConversao = totalCotacoesMes > 0 ? Math.round((totalConvertidas / totalCotacoesMes) * 100) : 0

  return {
    novosNoMes: emissoes.data?.filter(item => !item.eh_renovacao).length ?? 0,
    renovacoesNoMes: emissoes.data?.filter(item => item.eh_renovacao).length ?? 0,
    cotacoesNoMes: totalCotacoesMes,
    renovacoesConcluidas: renovadasMes.data?.length ?? 0,
    vencendoNoMes: vencendoNoMes.data?.length ?? 0,
    vencendoProximoMes: vencendoProximoMes.data?.length ?? 0,
    comissaoTotal,
    renovacoesComissaoMesAtual,
    renovacoesComissaoAnoAnterior,
    renovacoesComissaoDiferenca: renovacoesComissaoMesAtual - renovacoesComissaoAnoAnterior,
    renovacoesPremioLiquidoMesAtual,
    renovacoesPremioLiquidoAnoAnterior,
    renovacoesPremioLiquidoDiferenca: renovacoesPremioLiquidoMesAtual - renovacoesPremioLiquidoAnoAnterior,
    taxaConversao,
    renovacoesPendentes: renovacoesPendentes.data?.length ?? 0,
  }
}

export async function getGraficoEmissoesMensais(meses = 6, mes) {
  const apolices = await supabase
    .from('apolices_auto')
    .select('id, eh_renovacao, created_at')

  const lista = apolices.data ?? []
  return toMonthSeries(lista, {
    meses,
    endMonth: mes || toMonthRef(),
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
    emitidas: emissoes.filter(item => getEmissaoColuna(item) === 'apolice_emitida').length,
    porColuna: countBy(emissoes, item => getEmissaoColuna(item)),
    porTipo: countBy(emissoes, item => item.cotacoes_auto?.tipo || item.tipo || 'novo'),
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
    taxaConversao: cotacoes.length > 0 ? cotacoes.filter(item => item.status === 'convertida').length / cotacoes.length : 0,
    porStatus: countBy(cotacoes, item => item.status || 'pendente'),
    serieMensal,
  }
}

export async function getGraficoCotacoesStatus(meses = 6, mes) {
  const cotacoes = await getCotacoesAuto({})
  return toMonthSeries(cotacoes, {
    meses,
    endMonth: mes || toMonthRef(),
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

// Etiquetas (predefinidas + manuais nos cards de emissoes_auto)
export async function getAutoTags() {
  const { data, error } = await supabase
    .from('auto_tags')
    .select('id, nome, cor, ativa, ordem, created_at, updated_at')
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function criarAutoTag({ nome, cor, ordem = 0 }) {
  const { data, error } = await supabase
    .from('auto_tags')
    .insert({ nome: nome?.trim(), cor: cor || '#4A90D9', ordem })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function atualizarAutoTag(id, changes) {
  const { data, error } = await supabase
    .from('auto_tags')
    .update(changes)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw error
  return data
}

// Remove a etiqueta predefinida e limpa a referencia em qualquer card que a
// esteja usando, para nao deixar ids orfaos em emissoes_auto.tags.
export async function excluirAutoTag(id) {
  const { data: emissoesComTag, error: buscaError } = await supabase
    .from('emissoes_auto')
    .select('id, tags')
    .contains('tags', [id])
  if (buscaError) throw buscaError

  for (const emissao of emissoesComTag ?? []) {
    const tagsRestantes = (emissao.tags ?? []).filter(tagId => tagId !== id)
    const { error: updateError } = await supabase
      .from('emissoes_auto')
      .update({ tags: tagsRestantes })
      .eq('id', emissao.id)
    if (updateError) throw updateError
  }

  const { error } = await supabase.from('auto_tags').delete().eq('id', id)
  if (error) throw error
}

export async function atualizarTagsEmissao(id, tags) {
  const { error } = await supabase
    .from('emissoes_auto')
    .update({ tags: Array.isArray(tags) ? tags : [], updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

