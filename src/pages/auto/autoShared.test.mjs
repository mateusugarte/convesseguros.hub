import test from 'node:test'
import assert from 'node:assert/strict'

const {
  isApoliceAtiva,
  getClienteStatusAuto,
  formatMonthYearBR,
  diasParaVencer,
  formatDiasParaVencer,
  getRenovacaoUrgencia,
  getRenewalQuoteStatus,
  getMesAlvoRenovacao,
  getRenovacaoAreaStatus,
  getComissaoAtualAnterior,
} = await import('./autoShared.js')

test('isApoliceAtiva true quando vigencia_fim e hoje ou no futuro', () => {
  assert.equal(isApoliceAtiva({ vigencia_fim: '2026-07-17' }, '2026-07-17'), true)
  assert.equal(isApoliceAtiva({ vigencia_fim: '2026-08-01' }, '2026-07-17'), true)
})

test('isApoliceAtiva false quando vigencia_fim ja passou ou esta ausente', () => {
  assert.equal(isApoliceAtiva({ vigencia_fim: '2026-07-01' }, '2026-07-17'), false)
  assert.equal(isApoliceAtiva({ vigencia_fim: null }, '2026-07-17'), false)
  assert.equal(isApoliceAtiva({}, '2026-07-17'), false)
})

test('getClienteStatusAuto ativo quando ao menos uma apolice esta vigente', () => {
  const apolices = [{ vigencia_fim: '2025-01-01' }, { vigencia_fim: '2027-01-01' }]
  assert.equal(getClienteStatusAuto(apolices, '2026-07-17'), 'ativo')
})

test('getClienteStatusAuto inativo quando todas as apolices ja venceram', () => {
  const apolices = [{ vigencia_fim: '2024-01-01' }, { vigencia_fim: '2025-01-01' }]
  assert.equal(getClienteStatusAuto(apolices, '2026-07-17'), 'inativo')
})

test('getClienteStatusAuto null sem apolices', () => {
  assert.equal(getClienteStatusAuto([], '2026-07-17'), null)
})

test('formatMonthYearBR formata mes e ano por extenso', () => {
  assert.equal(formatMonthYearBR('2020-10-15'), 'outubro de 2020')
})

test('formatMonthYearBR retorna traco para valor vazio ou invalido', () => {
  assert.equal(formatMonthYearBR(null), '—')
  assert.equal(formatMonthYearBR(''), '—')
  assert.equal(formatMonthYearBR('lixo'), '—')
})

test('diasParaVencer calcula por dia de calendario, ignorando o horario atual', () => {
  const hoje = new Date('2026-07-21T23:59:00')
  assert.equal(diasParaVencer('2026-07-21', hoje), 0)
  assert.equal(diasParaVencer('2026-07-22', hoje), 1)
  assert.equal(diasParaVencer('2026-07-11', hoje), -10)
  assert.equal(diasParaVencer('2026-08-21', hoje), 31)
})

test('diasParaVencer atravessa virada de ano corretamente', () => {
  const hoje = new Date('2026-12-28T08:00:00')
  assert.equal(diasParaVencer('2027-01-04', hoje), 7)
})

test('diasParaVencer null para valor vazio ou invalido', () => {
  assert.equal(diasParaVencer(null), null)
  assert.equal(diasParaVencer(''), null)
  assert.equal(diasParaVencer('lixo'), null)
})

test('formatDiasParaVencer usa textos especiais para hoje/amanha/vencida', () => {
  assert.equal(formatDiasParaVencer(0), 'Vence hoje')
  assert.equal(formatDiasParaVencer(1), 'Vence amanha')
  assert.equal(formatDiasParaVencer(10), 'Faltam 10 dias')
  assert.equal(formatDiasParaVencer(-1), 'Vencida ha 1 dia')
  assert.equal(formatDiasParaVencer(-3), 'Vencida ha 3 dias')
  assert.equal(formatDiasParaVencer(null), 'Sem data')
})

test('getRenovacaoUrgencia segue a hierarquia concluida > vencida > urgente > mes', () => {
  assert.equal(getRenovacaoUrgencia({ dias: 5, concluida: true }), 'concluida')
  assert.equal(getRenovacaoUrgencia({ dias: -2 }), 'vencida')
  assert.equal(getRenovacaoUrgencia({ dias: 0 }), 'urgente')
  assert.equal(getRenovacaoUrgencia({ dias: 10 }), 'urgente')
  assert.equal(getRenovacaoUrgencia({ dias: 11 }), 'mes_atual')
  assert.equal(getRenovacaoUrgencia({ dias: 11, proximoMes: true }), 'proximo_mes')
  assert.equal(getRenovacaoUrgencia({ dias: null, proximoMes: true }), 'proximo_mes')
  assert.equal(getRenovacaoUrgencia({}), 'mes_atual')
})

test('getRenewalQuoteStatus nao cotada quando nao ha cotacao vinculada', () => {
  assert.equal(getRenewalQuoteStatus({}), 'nao_cotada')
  assert.equal(getRenewalQuoteStatus({ cotacoes_auto: null }), 'nao_cotada')
})

test('getRenewalQuoteStatus reflete o status da cotacao vinculada', () => {
  assert.equal(getRenewalQuoteStatus({ cotacoes_auto: { status: 'perdida' } }), 'perdida')
  assert.equal(getRenewalQuoteStatus({ cotacoes_auto: { status: 'convertida' } }), 'concluida')
  assert.equal(getRenewalQuoteStatus({ cotacoes_auto: { status: 'pendente' } }), 'em_andamento')
})

test('getRenewalQuoteStatus usa a coluna da emissao para "aguardando retorno"', () => {
  assert.equal(
    getRenewalQuoteStatus({ cotacoes_auto: { status: 'aberta', emissoes_auto: [{ coluna: 'negociando' }] } }),
    'aguardando_retorno'
  )
  assert.equal(
    getRenewalQuoteStatus({ cotacoes_auto: { status: 'aberta', emissoes_auto: { coluna: 'aguardando_vistoria' } } }),
    'aguardando_retorno'
  )
  assert.equal(
    getRenewalQuoteStatus({ cotacoes_auto: { status: 'aberta', emissoes_auto: [{ coluna: 'cotacao_feita' }] } }),
    'em_andamento'
  )
})

test('getMesAlvoRenovacao retorna null quando nenhuma janela abriu ainda', () => {
  const hoje = new Date(2026, 6, 10) // 10/jul, mais de 15 dias antes de 01/ago
  assert.equal(getMesAlvoRenovacao(hoje, {}), null)
})

test('getMesAlvoRenovacao retorna o mes seguinte quando faltam <=15 dias para virar', () => {
  const hoje = new Date(2026, 6, 17) // 17/jul, 15 dias antes de 01/ago
  assert.equal(getMesAlvoRenovacao(hoje, {}), '2026-08')
})

test('getMesAlvoRenovacao ignora mes ja concluido e volta pro mes atual', () => {
  const hoje = new Date(2026, 6, 20)
  const status = { '2026-08': { concluido_em: '2026-07-18T00:00:00Z' } }
  // mes atual (2026-07) nunca foi concluido e sua janela ja abriu ha muito tempo
  assert.equal(getMesAlvoRenovacao(hoje, status), '2026-07')
})

test('getMesAlvoRenovacao retorna null quando tudo ate o mes seguinte esta concluido', () => {
  const hoje = new Date(2026, 6, 20)
  const status = {
    '2026-05': { concluido_em: '2026-05-01T00:00:00Z' },
    '2026-06': { concluido_em: '2026-06-01T00:00:00Z' },
    '2026-07': { concluido_em: '2026-07-01T00:00:00Z' },
    '2026-08': { concluido_em: '2026-07-18T00:00:00Z' },
  }
  assert.equal(getMesAlvoRenovacao(hoje, status), null)
})

test('getRenovacaoAreaStatus retorna puxado quando nao ha cotacao vinculada e nao venceu', () => {
  const renovacao = { status_renovacao: 'pendente', vigencia_fim: '2099-01-01', cotacoes_auto: null }
  assert.equal(getRenovacaoAreaStatus(renovacao, '2026-07-24'), 'puxado')
})

test('getRenovacaoAreaStatus retorna vencido quando passou da vigencia sem cotacao', () => {
  const renovacao = { status_renovacao: 'pendente', vigencia_fim: '2026-01-01', cotacoes_auto: null }
  assert.equal(getRenovacaoAreaStatus(renovacao, '2026-07-24'), 'vencido')
})

test('getRenovacaoAreaStatus reflete a coluna real do kanban quando ha cotacao em andamento', () => {
  const renovacao = {
    status_renovacao: 'pendente',
    vigencia_fim: '2099-01-01',
    cotacoes_auto: { status: 'pendente', emissoes_auto: { coluna: 'negociando' } },
  }
  assert.equal(getRenovacaoAreaStatus(renovacao, '2026-07-24'), 'negociando')
})

test('getRenovacaoAreaStatus retorna renovado quando status_renovacao=renovada', () => {
  const renovacao = { status_renovacao: 'renovada', vigencia_fim: '2026-01-01' }
  assert.equal(getRenovacaoAreaStatus(renovacao, '2026-07-24'), 'renovado')
})

test('getRenovacaoAreaStatus retorna cancelado quando status_renovacao=nao_renovada', () => {
  const renovacao = { status_renovacao: 'nao_renovada', vigencia_fim: '2026-01-01' }
  assert.equal(getRenovacaoAreaStatus(renovacao, '2026-07-24'), 'cancelado')
})

test('getComissaoAtualAnterior usa a apolice vinculada quando existir', () => {
  const renovacao = {
    pct_comissao_anterior: 99,
    apolices_auto: {
      pct_comissao: 20,
      renovacao_premio_liquido_ano_anterior: 1000,
      renovacao_comissao_ano_anterior: 150,
    },
  }
  const resultado = getComissaoAtualAnterior(renovacao)
  assert.equal(resultado.atual, 20)
  assert.equal(resultado.anterior, 15)
})

test('getComissaoAtualAnterior cai para os dados da planilha quando nao ha apolice vinculada', () => {
  const renovacao = { pct_comissao_anterior: 18, apolices_auto: null }
  const resultado = getComissaoAtualAnterior(renovacao)
  assert.equal(resultado.atual, 18)
  assert.equal(resultado.anterior, null)
})
