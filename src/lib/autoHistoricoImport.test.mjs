import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'

const {
  limparNomeSegurado,
  normalizeCompareText,
  somarUmAno,
  isCelulaVerde,
  extrairLinhasHistoricoDaAba,
  parseAutoHistoricoPlanilha,
} = await import('./autoHistoricoImport.js')

test('limparNomeSegurado corta a partir do primeiro traço', () => {
  assert.equal(limparNomeSegurado('MARIA JOSE RODRIGUES - PATY'), 'MARIA JOSE RODRIGUES')
  assert.equal(limparNomeSegurado('TRANS CONEXAO - 24.250'), 'TRANS CONEXAO')
  assert.equal(limparNomeSegurado('REDONDO TELECOMUNICACOES LTDA ME- CAP'), 'REDONDO TELECOMUNICACOES LTDA ME')
  assert.equal(limparNomeSegurado('JAIME MOTA FERREIRA -'), 'JAIME MOTA FERREIRA')
})

test('limparNomeSegurado mantem nome sem traco, so normaliza espacos', () => {
  assert.equal(limparNomeSegurado('  NICASSIA   APARECIDA  ARAUJO '), 'NICASSIA APARECIDA ARAUJO')
})

test('limparNomeSegurado preserva nome composto com hifen sem espaco nos dois lados', () => {
  assert.equal(limparNomeSegurado('ANA-BEATRIZ SOUZA'), 'ANA-BEATRIZ SOUZA')
})

test('normalizeCompareText remove acento e caixa para comparacao', () => {
  assert.equal(normalizeCompareText('José  DA Silva'), 'jose da silva')
})

test('somarUmAno soma um ano preservando mes/dia', () => {
  assert.equal(somarUmAno('2026-07-01'), '2027-07-01')
})

test('somarUmAno ajusta 29/fev para ano nao bissexto', () => {
  assert.equal(somarUmAno('2024-02-29'), '2025-02-28')
})

test('somarUmAno retorna null para data invalida ou vazia', () => {
  assert.equal(somarUmAno(''), null)
  assert.equal(somarUmAno(null), null)
  assert.equal(somarUmAno('lixo'), null)
})

test('isCelulaVerde reconhece as duas cores verdes usadas na planilha', () => {
  assert.equal(isCelulaVerde({ patternType: 'solid', fgColor: { rgb: '00B050' } }), true)
  assert.equal(isCelulaVerde({ patternType: 'solid', fgColor: { rgb: '92d050' } }), true)
})

test('isCelulaVerde rejeita outras cores e celulas sem estilo', () => {
  assert.equal(isCelulaVerde({ patternType: 'solid', fgColor: { rgb: 'FF0000' } }), false)
  assert.equal(isCelulaVerde(undefined), false)
  assert.equal(isCelulaVerde({}), false)
})

test('extrairLinhasHistoricoDaAba so inclui linhas com celula verde na coluna SEGURADO', () => {
  const rows = [
    ['DATA', 'CIA', 'SEGURADO', 'STATUS', 'LIMITE', 'COMISSAO', 'COM PASSADA'],
    [46204, 'PORTO', 'NICASSIA APARECIDA ARAUJO', 'RENOVADO', 46197, 0.2, 0.2],
    [46205, 'AZUL', 'CLIENTE PERDIDO - CAP', 'CANCELADO', 46198, 0.2, 0.15],
  ]
  const worksheet = {
    C2: { v: 'NICASSIA APARECIDA ARAUJO', s: { patternType: 'solid', fgColor: { rgb: '00B050' } } },
    C3: { v: 'CLIENTE PERDIDO - CAP', s: { patternType: 'solid', fgColor: { rgb: 'FF0000' } } },
  }
  const result = extrairLinhasHistoricoDaAba('JULHO 2026', worksheet, rows)
  assert.equal(result.length, 1)
  assert.equal(result[0].nome_cliente, 'NICASSIA APARECIDA ARAUJO')
  assert.equal(result[0].seguradora, 'PORTO')
  assert.equal(result[0].vigencia_inicio, '2026-07-01')
  assert.equal(result[0].pct_comissao, 0.2)
})

test('extrairLinhasHistoricoDaAba lida com dois blocos (quinzenas) na mesma aba', () => {
  const rows = [
    ['DATA', 'CIA', 'SEGURADO', 'COTACAO', 'PRAZO', null, 'DATA', 'CIA', 'SEGURADO', 'COTACAO', 'PRAZO'],
    [44835, 'PORTO', 'CLIENTE UM', '', '', null, 44850, 'AZUL', 'CLIENTE DOIS', '', ''],
  ]
  const worksheet = {
    C2: { v: 'CLIENTE UM', s: { patternType: 'solid', fgColor: { rgb: '00B050' } } },
    I2: { v: 'CLIENTE DOIS', s: { patternType: 'solid', fgColor: { rgb: '92D050' } } },
  }
  const result = extrairLinhasHistoricoDaAba('MAIO 2021', worksheet, rows)
  assert.equal(result.length, 2)
  assert.deepEqual(result.map(r => r.nome_cliente), ['CLIENTE UM', 'CLIENTE DOIS'])
})

test('parseAutoHistoricoPlanilha percorre todas as abas do workbook', () => {
  const wb = XLSX.utils.book_new()
  const data = [
    ['DATA', 'CIA', 'SEGURADO', 'STATUS', 'LIMITE', 'COMISSAO'],
    [46204, 'PORTO', 'CLIENTE VERDE', 'RENOVADO', 46197, 0.2],
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws.C2.s = { patternType: 'solid', fgColor: { rgb: '00B050' } }
  XLSX.utils.book_append_sheet(wb, ws, 'JULHO 2026')
  const result = parseAutoHistoricoPlanilha(wb)
  assert.equal(result.length, 1)
  assert.equal(result[0].aba, 'JULHO 2026')
  assert.equal(result[0].nome_cliente, 'CLIENTE VERDE')
})
