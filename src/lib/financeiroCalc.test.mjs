import test from 'node:test'
import assert from 'node:assert/strict'
import {
  pad2, parseYmd, primeiroDiaMes, addMeses, formatMesAno,
  somarPorMes, projetarProximosMeses,
  toNumber, pctNormalizado, premioLiquidoApolice, parcelasApolice,
  comissaoTotalApolice, comissaoMensalApolice, producaoApolice,
} from './financeiroCalc.js'

test('pad2 adiciona zero à esquerda', () => {
  assert.equal(pad2(3), '03')
  assert.equal(pad2(12), '12')
})

test('parseYmd interpreta YYYY-MM-DD como data local', () => {
  const d = parseYmd('2026-07-15')
  assert.equal(d.getFullYear(), 2026)
  assert.equal(d.getMonth(), 6) // julho = 6
  assert.equal(d.getDate(), 15)
  assert.equal(parseYmd(''), null)
  assert.equal(parseYmd('texto'), null)
})

test('primeiroDiaMes retorna o dia 01 do mês', () => {
  assert.equal(primeiroDiaMes('2026-07-15'), '2026-07-01')
  assert.equal(primeiroDiaMes('2026-12-31'), '2026-12-01')
})

test('addMeses soma meses com virada de ano', () => {
  assert.equal(addMeses('2026-07-01', 1), '2026-08-01')
  assert.equal(addMeses('2026-12-01', 1), '2027-01-01')
  assert.equal(addMeses('2026-07-15', 6), '2027-01-01')
})

test('formatMesAno formata abreviado', () => {
  assert.equal(formatMesAno('2026-07-01'), 'Jul/2026')
  assert.equal(formatMesAno('2026-01-10'), 'Jan/2026')
  assert.equal(formatMesAno(''), '—')
})

test('somarPorMes agrupa por mês, soma e conta parcelas, ordenado asc', () => {
  const rows = [
    { mes_referencia: '2026-08-01', valor_previsto: 20 },
    { mes_referencia: '2026-07-01', valor_previsto: 20 },
    { mes_referencia: '2026-08-01', valor_previsto: '30' },
    { mes_referencia: 'invalido',  valor_previsto: 99 },
  ]
  const out = somarPorMes(rows)
  assert.equal(out.length, 2)
  assert.deepEqual(out[0], { mes: '2026-07-01', total: 20, parcelas: 1, label: 'Jul/2026' })
  assert.deepEqual(out[1], { mes: '2026-08-01', total: 50, parcelas: 2, label: 'Ago/2026' })
})

test('projetarProximosMeses sempre retorna N meses preenchendo zeros', () => {
  const rows = [{ mes_referencia: '2026-09-01', valor_previsto: 100 }]
  const out = projetarProximosMeses(rows, { mesesAFrente: 3, referencia: '2026-08-10' })
  assert.equal(out.length, 3)
  assert.deepEqual(out.map(o => o.mes), ['2026-08-01', '2026-09-01', '2026-10-01'])
  assert.deepEqual(out.map(o => o.total), [0, 100, 0])
  assert.equal(out[1].parcelas, 1)
})

test('toNumber converte BR/number e zera inválidos', () => {
  assert.equal(toNumber('1.234,56'), 1234.56)
  assert.equal(toNumber('20'), 20)
  assert.equal(toNumber(null), 0)
  assert.equal(toNumber('abc'), 0)
})

test('pctNormalizado trata inteiro como percentual e fração como fração', () => {
  assert.equal(pctNormalizado(5), 0.05)
  assert.equal(pctNormalizado(0.05), 0.05)
  assert.equal(pctNormalizado('12,5'), 0.125)
  assert.equal(pctNormalizado(0), 0)
})

test('premioLiquidoApolice usa fallback premio_total / valor_producao', () => {
  assert.equal(premioLiquidoApolice({ premio_liquido: 500 }), 500)
  assert.equal(premioLiquidoApolice({ premio_total: 580 }), 580)
  assert.equal(premioLiquidoApolice({ valor_producao: 600 }), 600)
  assert.equal(premioLiquidoApolice({}), 0)
})

test('comissaoTotalApolice = % comissão × prêmio líquido', () => {
  assert.equal(comissaoTotalApolice({ premio_liquido: 1000, pct_comissao: 5 }), 50)
  assert.equal(comissaoTotalApolice({ premio_liquido: 1000, pct_comissao: 0.05 }), 50)
  // sem prêmio/pct → cai no valor_comissao já gravado
  assert.equal(comissaoTotalApolice({ valor_comissao: 42 }), 42)
})

test('parcelasApolice nunca é menor que 1', () => {
  assert.equal(parcelasApolice({ parcelamento: 29 }), 29)
  assert.equal(parcelasApolice({ parcelamento: 0 }), 1)
  assert.equal(parcelasApolice({}), 1)
})

test('comissaoMensalApolice = total ÷ parcelas', () => {
  // 580 de prêmio líquido, 100% comissão, 29 parcelas → 20/mês
  assert.equal(comissaoMensalApolice({ premio_liquido: 580, pct_comissao: 100, parcelamento: 29 }), 20)
})

test('producaoApolice usa premio_total ou fallback parcela × parcelas', () => {
  assert.equal(producaoApolice({ premio_total: 580 }), 580)
  assert.equal(producaoApolice({ valor_parcela: 20, parcelamento: 29 }), 580)
  assert.equal(producaoApolice({}), 0)
})
