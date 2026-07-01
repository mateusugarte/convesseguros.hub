import test from 'node:test'
import assert from 'node:assert/strict'

globalThis.DOMMatrix ||= class DOMMatrix {}

const { parseApoliceText } = await import('./apoliceParser.js')

test('parseApoliceText Porto prioriza o aluguel declarado quando premio e parcela aparecem antes', () => {
  const text = [
    'COBERTURAS Aluguel Premio mensal R$ 231,45 Preco Total do Seguro R$ 6.943,50 Valor da Parcela R$ 231,45',
    'TIPO DE LOCACAO 1 - Residencial',
    'Aluguel R$ 4.500,00 30x',
    'PROPOSTA N? 12345',
  ].join(' ')

  const parsed = parseApoliceText('Porto Seguro', text)

  assert.equal(parsed.semParser, false)
  assert.equal(parsed.extras.valor_aluguel, 4500)
  assert.equal(parsed.campos.valor_parcela, '231.45')
})

test('parseApoliceText Porto nao reaproveita valor de premio ou parcela como aluguel', () => {
  const text = [
    'COBERTURAS Aluguel Premio mensal R$ 231,45 Preco Total do Seguro R$ 6.943,50 Valor da Parcela R$ 231,45',
    'PROPOSTA N? 12345',
  ].join(' ')

  const parsed = parseApoliceText('Porto Seguro', text)

  assert.equal(parsed.semParser, false)
  assert.equal(parsed.extras.valor_aluguel, null)
})
