import test from 'node:test'
import assert from 'node:assert/strict'

const { calcularDataLimiteRenovacao, calcularValorComissaoAuto, isValidIsoDate, subtrairDiasCorridosComAjuste, subtrairDiasUteis } = await import('./autoCalc.js')

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

test('isValidIsoDate aceita data completa e valida', () => {
  assert.equal(isValidIsoDate('2027-02-01'), true)
})

test('isValidIsoDate rejeita mes/dia invalidos', () => {
  assert.equal(isValidIsoDate('2027-13-01'), false)
  assert.equal(isValidIsoDate('2027-02-30'), false)
})

test('isValidIsoDate rejeita valores parciais que o input nativo de data emite durante a digitacao do ano', () => {
  // Regressao: o input type=date dispara onChange a cada digito do ano
  // (0002 -> 0020 -> 0202 -> 2027). Anos de 1-3 digitos nao podem passar,
  // mesmo quando o ano resultante "bate" no round-trip do Date (ex. ano 202,
  // que o construtor new Date(ano, mes, dia) NAO trata como relativo a 1900
  // por estar fora do intervalo 0-99, ao contrario de anos de 1-2 digitos).
  assert.equal(isValidIsoDate('0002-02-01'), false)
  assert.equal(isValidIsoDate('0020-02-01'), false)
  assert.equal(isValidIsoDate('0202-02-01'), false)
})

test('isValidIsoDate rejeita formato incompleto/nao-ISO', () => {
  assert.equal(isValidIsoDate(''), false)
  assert.equal(isValidIsoDate(null), false)
  assert.equal(isValidIsoDate('2027-2-1'), false)
})

test('subtrairDiasUteis pula fins de semana (7 dias uteis antes de uma segunda-feira)', () => {
  // 2027-02-01 e uma segunda-feira; 7 dias uteis antes cai numa quinta.
  assert.equal(subtrairDiasUteis('2027-02-01', 7), '2027-01-21')
})

test('subtrairDiasUteis retorna null para data invalida', () => {
  assert.equal(subtrairDiasUteis('0202-02-01', 7), null)
})

test('subtrairDiasCorridosComAjuste leva sabado para a sexta anterior', () => {
  assert.equal(subtrairDiasCorridosComAjuste('2025-08-19', 10), '2025-08-08')
})

test('subtrairDiasCorridosComAjuste leva domingo para a segunda seguinte', () => {
  assert.equal(subtrairDiasCorridosComAjuste('2025-08-20', 10), '2025-08-11')
})

test('calcularDataLimiteRenovacao retorna 10 dias corridos antes do vencimento', () => {
  assert.equal(calcularDataLimiteRenovacao('2026-08-31'), '2026-08-21')
})
