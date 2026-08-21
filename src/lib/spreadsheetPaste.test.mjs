import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSpreadsheetNumber } from './spreadsheetPaste.js'

test('preserva valores monetarios pt-BR copiados do Excel', () => {
  assert.equal(normalizeSpreadsheetNumber('R$ 2.629,02'), '2629.02')
  assert.equal(normalizeSpreadsheetNumber('R$ 1.460,30'), '1460.3')
  assert.equal(normalizeSpreadsheetNumber('3.177,89'), '3177.89')
})

test('aceita moeda e separadores em diferentes padroes', () => {
  assert.equal(normalizeSpreadsheetNumber('2,629.02'), '2629.02')
  assert.equal(normalizeSpreadsheetNumber('2629,02'), '2629.02')
  assert.equal(normalizeSpreadsheetNumber('2629.02'), '2629.02')
  assert.equal(normalizeSpreadsheetNumber('R$\u00a08.112,75'), '8112.75')
})

test('aceita percentual, vazio contábil e negativo entre parenteses', () => {
  assert.equal(normalizeSpreadsheetNumber('15%'), '15')
  assert.equal(normalizeSpreadsheetNumber('R$ -'), '')
  assert.equal(normalizeSpreadsheetNumber('(R$ 1.234,56)'), '-1234.56')
})
