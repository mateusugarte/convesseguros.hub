import test from 'node:test'
import assert from 'node:assert/strict'

const { calcularValorComissaoAuto } = await import('./autoCalc.js')

test('calcularValorComissaoAuto aplica o percentual direto sobre o premio liquido', () => {
  // premio 1000, comissao 10% => 100 (exemplo confirmado pelo usuario)
  assert.equal(calcularValorComissaoAuto(1000, 10), 100)
})

test('calcularValorComissaoAuto bate com premio/comissao decimais', () => {
  // premio 917.74, comissao 20% => 183.548
  assert.equal(Math.round(calcularValorComissaoAuto(917.74, 20) * 10000) / 10000, 183.548)
})

test('calcularValorComissaoAuto trata premio ou comissao ausentes como zero', () => {
  assert.equal(calcularValorComissaoAuto(null, 20), 0)
  assert.equal(calcularValorComissaoAuto(1000, null), 0)
  assert.equal(calcularValorComissaoAuto('', ''), 0)
})

test('calcularValorComissaoAuto aplica percentuais diferentes corretamente', () => {
  // premio 2206.98, comissao 15% => 331.047
  assert.equal(Math.round(calcularValorComissaoAuto(2206.98, 15) * 10000) / 10000, 331.047)
})
