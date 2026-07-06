import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSeguradoraBucket, isFichaExpiredOperational } from './fichaOperational.js'

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
