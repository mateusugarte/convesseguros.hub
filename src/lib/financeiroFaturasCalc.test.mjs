import test from 'node:test'
import assert from 'node:assert/strict'
import { apoliceBilladaNoMes, apoliceContaNaFaturaNoMes, montarFaturasMes } from './financeiroFaturasCalc.js'

test('apoliceBilladaNoMes: 1ª parcela no mês seguinte, durante parcelamento meses', () => {
  const row = { data_emissao: '2026-01-15', parcelamento: 3 }
  assert.equal(apoliceBilladaNoMes(row, '2026-01-01'), false)
  assert.equal(apoliceBilladaNoMes(row, '2026-02-01'), true)
  assert.equal(apoliceBilladaNoMes(row, '2026-04-01'), true)
  assert.equal(apoliceBilladaNoMes(row, '2026-05-01'), false)
})

test('apoliceBilladaNoMes: parcelamento ausente conta como 1', () => {
  const row = { data_emissao: '2026-06-10' }
  assert.equal(apoliceBilladaNoMes(row, '2026-07-01'), true)
  assert.equal(apoliceBilladaNoMes(row, '2026-08-01'), false)
})

test('apoliceContaNaFaturaNoMes ignora apólice cancelada mesmo com parcela no ciclo', () => {
  const row = { data_emissao: '2026-01-15', parcelamento: 12, status_apolice: 'cancelada' }
  assert.equal(apoliceContaNaFaturaNoMes(row, '2026-03-01'), false)
})

test('montarFaturasMes agrupa por imobiliária, soma parcelas e aplica %', () => {
  const rows = [
    { imobiliaria: 'Alpha', valor_parcela: 200, parcelamento: 12, data_emissao: '2026-01-10', status_apolice: 'ativa' },
    { imobiliaria: 'Alpha', valor_parcela: 300, parcelamento: 12, data_emissao: '2026-01-20', status_apolice: 'ativa' },
    { imobiliaria: 'Beta', valor_parcela: 100, parcelamento: 12, data_emissao: '2026-01-05', status_apolice: 'ativa' },
    { imobiliaria: 'Beta', valor_parcela: 999, parcelamento: 1, data_emissao: '2025-01-01', status_apolice: 'ativa' },
  ]
  const out = montarFaturasMes({
    rows,
    mesRef: '2026-03-01',
    pctMap: { Alpha: 10, Beta: 20 },
    statusMap: {
      Alpha: {
        status: 'pago',
        data_pagamento: '2026-03-02',
        valor_real_fatura: 650,
        valor_fatura_calculado: 500,
        pct_comissao: 10,
        valor_a_pagar: 50,
        observacao: 'conferido',
      },
    },
  })
  assert.equal(out.length, 2)
  assert.equal(out[0].imobiliaria, 'Alpha')
  assert.equal(out[0].valorFatura, 500)
  assert.equal(out[0].valorAPagar, 50)
  assert.equal(out[0].status, 'pago')
  assert.equal(out[0].valorRealFatura, 650)
  assert.equal(out[0].valorFaturaSnapshot, 500)
  assert.equal(out[0].valorAPagarSnapshot, 50)
  assert.equal(out[0].observacao, 'conferido')
  assert.equal(out[1].imobiliaria, 'Beta')
  assert.equal(out[1].valorFatura, 100)
  assert.equal(out[1].valorAPagar, 20)
  assert.equal(out[1].status, 'pendente')
})

test('montarFaturasMes: sem % ? valorAPagar 0 e pct null', () => {
  const rows = [{ imobiliaria: 'Alpha', valor_parcela: 200, parcelamento: 12, data_emissao: '2026-01-10', status_apolice: 'ativa' }]
  const out = montarFaturasMes({ rows, mesRef: '2026-03-01', pctMap: {}, statusMap: {} })
  assert.equal(out[0].pct, null)
  assert.equal(out[0].valorAPagar, 0)
})
