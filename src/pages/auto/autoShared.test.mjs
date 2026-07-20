import test from 'node:test'
import assert from 'node:assert/strict'

const { isApoliceAtiva, getClienteStatusAuto, formatMonthYearBR } = await import('./autoShared.js')

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
