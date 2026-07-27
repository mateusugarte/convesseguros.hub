import test from 'node:test'
import assert from 'node:assert/strict'

const { calcularValorComissaoAuto } = await import('./autoCalc.js')

test('calcularValorComissaoAuto aplica percentual e retira 10% do resultado', () => {
  // premio 917.74, comissao 20% => 183.548, menos 10% => 165.1932 (bate com a planilha real)
  assert.equal(Math.round(calcularValorComissaoAuto(917.74, 20) * 10000) / 10000, 165.1932)
})

test('calcularValorComissaoAuto trata premio ou comissao ausentes como zero', () => {
  assert.equal(calcularValorComissaoAuto(null, 20), 0)
  assert.equal(calcularValorComissaoAuto(1000, null), 0)
  assert.equal(calcularValorComissaoAuto('', ''), 0)
})

test('calcularValorComissaoAuto bate com a linha NOVO da planilha real (JULHO 2026)', () => {
  // premio 2206.98, comissao 15% => 331.047, menos 10% => 297.9423
  assert.equal(Math.round(calcularValorComissaoAuto(2206.98, 15) * 10000) / 10000, 297.9423)
})
