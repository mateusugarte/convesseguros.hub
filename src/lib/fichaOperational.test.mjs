import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSeguradoraBucket } from './fichaOperational.js'

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
