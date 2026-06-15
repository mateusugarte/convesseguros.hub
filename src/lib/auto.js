import { supabase } from './supabase'

// ── Helpers de data ───────────────────────────────────────────
function inicioFimMes(offset = 0) {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = hoje.getMonth() + offset
  return {
    inicio: new Date(ano, mes, 1).toISOString().split('T')[0],
    fim: new Date(ano, mes + 1, 0).toISOString().split('T')[0],
  }
}

// ── Clientes ──────────────────────────────────────────────────
export async function buscarClientePorCpf(cpf) {
  const { data } = await supabase
    .from('clientes_auto')
    .select('*')
    .eq('cpf', cpf)
    .maybeSingle()
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

// ── Cotações ──────────────────────────────────────────────────
export async function getCotacoesAuto({ tipo, status, seguradora, inicio, fim } = {}) {
  let q = supabase
    .from('cotacoes_auto')
    .select('*, clientes_auto(nome_completo, cpf, telefone)')
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
  const { data, error } = await supabase
    .from('cotacoes_auto')
    .insert(payload)
    .select()
    .single()
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

// ── Emissões (Kanban) ─────────────────────────────────────────
export async function getEmissoesAuto() {
  const { data, error } = await supabase
    .from('emissoes_auto')
    .select('*, clientes_auto(nome_completo, telefone), cotacoes_auto(tipo, modelo_veiculo, placa)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function moverEmissaoColuna(id, coluna) {
  const { error } = await supabase
    .from('emissoes_auto')
    .update({ coluna, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ── Apólices ──────────────────────────────────────────────────
export async function emitirApoliceAuto(payload) {
  const premioLiquido = parseFloat(payload.premio_liquido) || 0
  const pctComissao = parseFloat(payload.pct_comissao) || 0
  const valorComissao = premioLiquido * pctComissao

  const valorRepasse =
    payload.tem_repasse && payload.pct_repasse
      ? valorComissao * parseFloat(payload.pct_repasse)
      : null

  const { data, error } = await supabase
    .from('apolices_auto')
    .insert({ ...payload, valor_comissao: valorComissao, valor_repasse: valorRepasse })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Renovações ────────────────────────────────────────────────
export async function getRenovacoesAuto({ periodo } = {}) {
  let q = supabase
    .from('renovacoes_auto')
    .select('*, clientes_auto(nome_completo, telefone), apolices_auto(numero_apolice, seguradora)')
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
  return data ?? []
}

export async function atualizarStatusRenovacao(id, campos) {
  const { error } = await supabase
    .from('renovacoes_auto')
    .update(campos)
    .eq('id', id)
  if (error) throw error
}

// ── Dashboard ─────────────────────────────────────────────────
export async function getDashboardAutoMetrics() {
  const { inicio, fim } = inicioFimMes(0)
  const proximoMes = inicioFimMes(1)

  const [emissoes, cotacoes, renovadasMes, vencendoProximoMes] = await Promise.all([
    supabase
      .from('apolices_auto')
      .select('id, eh_renovacao')
      .gte('created_at', inicio)
      .lte('created_at', fim),
    supabase
      .from('cotacoes_auto')
      .select('id')
      .gte('created_at', inicio)
      .lte('created_at', fim),
    supabase
      .from('renovacoes_auto')
      .select('id')
      .eq('status_renovacao', 'renovada')
      .gte('created_at', inicio)
      .lte('created_at', fim),
    supabase
      .from('renovacoes_auto')
      .select('id')
      .gte('vigencia_fim', proximoMes.inicio)
      .lte('vigencia_fim', proximoMes.fim),
  ])

  return {
    novosNoMes: emissoes.data?.filter(e => !e.eh_renovacao).length ?? 0,
    renovacoesNoMes: emissoes.data?.filter(e => e.eh_renovacao).length ?? 0,
    cotacoesNoMes: cotacoes.data?.length ?? 0,
    renovacoesConcluidas: renovadasMes.data?.length ?? 0,
    vencendoProximoMes: vencendoProximoMes.data?.length ?? 0,
  }
}

export async function getGraficoEmissoesMensais(meses = 6) {
  const resultado = []
  for (let i = meses - 1; i >= 0; i--) {
    const { inicio, fim } = inicioFimMes(-i)
    const { data } = await supabase
      .from('apolices_auto')
      .select('id, eh_renovacao')
      .gte('created_at', inicio)
      .lte('created_at', fim)
    const label = new Date(inicio).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
    resultado.push({
      mes: label,
      novos: data?.filter(e => !e.eh_renovacao).length ?? 0,
      renovacoes: data?.filter(e => e.eh_renovacao).length ?? 0,
    })
  }
  return resultado
}
