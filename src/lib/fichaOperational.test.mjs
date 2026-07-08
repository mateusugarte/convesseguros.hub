import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSeguradoraBucket, isFichaExpiredOperational, getReportEffectiveNow, getFichaOperationalState } from './fichaOperational.js'

test('normalizeSeguradoraBucket reconhece Porto, Tokio, Too, Pottencial e Junto', () => {
  assert.equal(normalizeSeguradoraBucket('Porto Seguro'), 'Porto')
  assert.equal(normalizeSeguradoraBucket('Tokio Marine'), 'Tokio')
  assert.equal(normalizeSeguradoraBucket('TOO Seguros'), 'Too')
  assert.equal(normalizeSeguradoraBucket('Pottencial Seguradora'), 'Pottencial')
  assert.equal(normalizeSeguradoraBucket('Potencial'), 'Pottencial')
  assert.equal(normalizeSeguradoraBucket('Junto Seguros'), 'Junto')
})

test('normalizeSeguradoraBucket cai em Não informado para vazio/nulo/desconhecido', () => {
  assert.equal(normalizeSeguradoraBucket(''), 'Não informado')
  assert.equal(normalizeSeguradoraBucket(null), 'Não informado')
  assert.equal(normalizeSeguradoraBucket(undefined), 'Não informado')
  assert.equal(normalizeSeguradoraBucket('Outra Seguradora XYZ'), 'Não informado')
})

test('ficha aprovada da Porto expira com 45 dias desde finalizada_em, não com 44', () => {
  const now = new Date('2026-07-06T00:00:00.000Z')

  const dia44 = { status: 'aprovado', seguradora: 'Porto Seguro', finalizada_em: '2026-05-23T00:00:00.000Z' }
  assert.equal(isFichaExpiredOperational(dia44, { now }), false)

  const dia45 = { status: 'aprovado', seguradora: 'Porto Seguro', finalizada_em: '2026-05-22T00:00:00.000Z' }
  assert.equal(isFichaExpiredOperational(dia45, { now }), true)
})

test('ficha aprovada da Pottencial/Too/Tokio/Junto expira com 30 dias, não com 29', () => {
  const now = new Date('2026-07-06T00:00:00.000Z')
  for (const seguradora of ['Pottencial', 'Too Seguros', 'Tokio Marine', 'Junto Seguros', '']) {
    const dia29 = { status: 'aprovado', seguradora, finalizada_em: '2026-06-07T00:00:00.000Z' }
    assert.equal(isFichaExpiredOperational(dia29, { now }), false, seguradora)

    const dia30 = { status: 'aprovado', seguradora, finalizada_em: '2026-06-06T00:00:00.000Z' }
    assert.equal(isFichaExpiredOperational(dia30, { now }), true, seguradora)
  }
})

test('ficha aprovada sem finalizada_em usa created_at como fallback', () => {
  const now = new Date('2026-07-06T00:00:00.000Z')
  const semFinalizadaEm = { status: 'aprovado', seguradora: 'Pottencial', created_at: '2026-06-06T00:00:00.000Z' }
  assert.equal(isFichaExpiredOperational(semFinalizadaEm, { now }), true)
})

test('ficha aprovada com apólice emitida nunca expira, mesmo passado o prazo', () => {
  const now = new Date('2026-07-06T00:00:00.000Z')
  const comApolice = { status: 'aprovado', seguradora: 'Pottencial', finalizada_em: '2026-01-01T00:00:00.000Z', numero_apolice: '12345' }
  assert.equal(isFichaExpiredOperational(comApolice, { now }), false)
})

test('status diferente de aprovado mantém a regra antiga de 45 dias desde created_at', () => {
  const now = new Date('2026-07-06T00:00:00.000Z')
  const pendenteDia44 = { status: 'pendente', seguradora: 'Pottencial', created_at: '2026-05-23T00:00:00.000Z' }
  assert.equal(isFichaExpiredOperational(pendenteDia44, { now }), false)

  const pendenteDia45 = { status: 'pendente', seguradora: 'Pottencial', created_at: '2026-05-22T00:00:00.000Z' }
  assert.equal(isFichaExpiredOperational(pendenteDia45, { now }), true)
})

test('getReportEffectiveNow ancora no fim do período do relatório quando ele já passou', () => {
  const realNow = new Date('2026-07-08T12:00:00.000Z')
  const rangeEndJunho = '2026-06-30'
  const effective = getReportEffectiveNow(rangeEndJunho, realNow)
  assert.equal(effective.getTime(), new Date('2026-06-30T23:59:59').getTime())
})

test('getReportEffectiveNow usa a data real quando o período ainda não terminou (mês corrente)', () => {
  const realNow = new Date('2026-07-08T12:00:00.000Z')
  const rangeEndJulho = '2026-07-31'
  const effective = getReportEffectiveNow(rangeEndJulho, realNow)
  assert.equal(effective.toISOString(), realNow.toISOString())
})

test('getReportEffectiveNow usa a data real quando não há período (histórico)', () => {
  const realNow = new Date('2026-07-08T12:00:00.000Z')
  const effective = getReportEffectiveNow(null, realNow)
  assert.equal(effective.toISOString(), realNow.toISOString())
})

test('getFichaOperationalState resolve um bucket não-nulo para todo status exceto recusado', () => {
  const now = new Date('2026-07-08T12:00:00.000Z')
  const criadoRecente = { created_at: '2026-07-01T00:00:00.000Z' }
  const statusComBucket = {
    pendente: 'pendente',
    em_cotacao: 'em_cotacao',
    em_analise: 'em_analise',
    aprovado: 'aprovada',
    emitido: 'emitida',
    cancelado: 'desistiu',
    cpf_invalido: 'cpf_invalido',
    expirada: 'expirada',
  }
  for (const [status, esperado] of Object.entries(statusComBucket)) {
    const ficha = { ...criadoRecente, status }
    const meta = getFichaOperationalState(ficha, { now })
    assert.equal(meta?.id, esperado, `status=${status} deveria resolver para "${esperado}", veio ${meta?.id}`)
  }
})

test('getFichaOperationalState: recusado ainda resolve para "recusada" (a tela de relatório é quem decide excluir)', () => {
  const meta = getFichaOperationalState({ status: 'recusado', created_at: '2026-07-01T00:00:00.000Z' })
  assert.equal(meta?.id, 'recusada')
})

test('ficha "emitido" sem apólice vinculada ainda (lag de digitação) cai em "emitida", não em bucket nulo', () => {
  const ficha = { status: 'emitido', created_at: '2026-07-01T00:00:00.000Z' }
  const meta = getFichaOperationalState(ficha, { now: new Date('2026-07-08T00:00:00.000Z') })
  assert.equal(meta?.id, 'emitida')
})

test('regressão: ficha aprovada em junho não expira ao visualizar o relatório de junho em julho', () => {
  // Reproduz o bug relatado: ficha aprovada 05/06, sem seguradora (limiar padrão 30 dias),
  // vista no relatório de junho já em julho (>30 dias reais depois) não deve expirar,
  // pois o relatório de um mês fechado deve refletir o estado "congelado" daquele mês.
  const realNow = new Date('2026-07-08T12:00:00.000Z')
  const effectiveNow = getReportEffectiveNow('2026-06-30', realNow)
  const ficha = { status: 'aprovado', seguradora: '', finalizada_em: '2026-06-05T00:00:00.000Z' }

  assert.equal(isFichaExpiredOperational(ficha, { now: effectiveNow }), false)
  // Sanity check: com a data real (bug antigo), a mesma ficha já teria expirado.
  assert.equal(isFichaExpiredOperational(ficha, { now: realNow }), true)
})
