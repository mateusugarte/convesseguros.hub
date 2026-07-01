import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeNumeroApolice, pickApoliceDuplicadaByNumero } from './apolicesNumero.js'

test('normalizeNumeroApolice remove pontuacao e normaliza caixa', () => {
  assert.equal(normalizeNumeroApolice('59.0746.00000001234'), '59074600000001234')
  assert.equal(normalizeNumeroApolice(' ab-123/x '), 'AB123X')
})

test('pickApoliceDuplicadaByNumero encontra a mais recente mesmo com formatacao diferente', () => {
  const rows = [
    { id: '1', numero_apolice: '59.0746.00000001234', created_at: '2026-06-01T10:00:00.000Z' },
    { id: '2', numero_apolice: '59074600000001234', created_at: '2026-06-02T10:00:00.000Z' },
  ]

  const found = pickApoliceDuplicadaByNumero(rows, '59 0746 00000001234')
  assert.equal(found?.id, '2')
})

test('pickApoliceDuplicadaByNumero respeita excludeId', () => {
  const rows = [
    { id: '1', numero_apolice: '12345', created_at: '2026-06-02T10:00:00.000Z' },
    { id: '2', numero_apolice: '12345', created_at: '2026-06-01T10:00:00.000Z' },
  ]

  const found = pickApoliceDuplicadaByNumero(rows, '12345', '1')
  assert.equal(found?.id, '2')
})
