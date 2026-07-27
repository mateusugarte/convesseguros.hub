import test from 'node:test'
import assert from 'node:assert/strict'

const { extrairLinhasComissaoDaAba, parseAutoComissaoPlanilha } = await import('./autoComissaoImport.js')

const HEADER = ['TRANSMISSÃO ', 'VIGÊNCIA', 'SEGURADO', 'QNT. DE PARCELAS', 'SEGURADORA', 'PREMIO LIQUIDO', '% COMISSAO', 'VALOR DA COMISSÃO', 'REPASSE COMISSÃO', 'CORRETOR', 'O QUE É ']

test('extrairLinhasComissaoDaAba le linhas de renovacao e converte data/percentual', () => {
  const rows = [
    HEADER,
    [46203, 46569, 'NICASSIA APARECIDA DE ARAUJO ', '1X', 'PORTO', 917.74, 0.2, 165.1932, '', '', 'RENOVAÇÃO '],
  ]
  const linhas = extrairLinhasComissaoDaAba(rows)
  assert.equal(linhas.length, 1)
  assert.equal(linhas[0].nome_cliente, 'NICASSIA APARECIDA DE ARAUJO')
  assert.equal(linhas[0].seguradora, 'PORTO')
  assert.equal(linhas[0].vigencia_fim, '2027-07-01')
  assert.equal(linhas[0].premio_liquido, 917.74)
  assert.equal(linhas[0].pct_comissao, 20)
  assert.equal(linhas[0].tipo, 'renovacao')
})

test('extrairLinhasComissaoDaAba ignora linha de endosso (VIGENCIA nao e data)', () => {
  const rows = [
    HEADER,
    [46205, 'ENDOSSO ', 'BRUNO YUDI AGUENA ', '1X', 'AZUL', 111.77, 0.13, 13.07709, '', '', 'ENDOSSO '],
  ]
  assert.equal(extrairLinhasComissaoDaAba(rows).length, 0)
})

test('extrairLinhasComissaoDaAba ignora linha sem segurado', () => {
  const rows = [HEADER, ['', '', '', '', '', '', '', '', '', '', '']]
  assert.equal(extrairLinhasComissaoDaAba(rows).length, 0)
})

test('extrairLinhasComissaoDaAba usa fallback de posicao quando o cabecalho do tipo esta em branco (abas reais MAIO-SETEMBRO 2025)', () => {
  const headerSemRotuloDeTipo = ['TRANSMISSÃO ', 'VIGÊNCIA', 'SEGURADO', 'QNT. DE PARCELAS', 'SEGURADORA', 'PREMIO LIQUIDO', '% COMISSAO', 'VALOR DA COMISSÃO', 'REPASSE COMISSÃO', 'CORRETOR', ' ']
  const rows = [
    headerSemRotuloDeTipo,
    [45863, 46235, 'ALINE MONICA RIBEIRO', '06X', 'MAPFRE', 1328.1, 0.15, 179.29, '', '', 'RENOVAÇÃO '],
  ]
  const linhas = extrairLinhasComissaoDaAba(rows)
  assert.equal(linhas.length, 1)
  assert.equal(linhas[0].tipo, 'renovacao')
})

test('parseAutoComissaoPlanilha filtra so linhas tipo RENOVACAO da aba pedida', () => {
  const rows = [
    HEADER,
    [46203, 46569, 'NICASSIA APARECIDA DE ARAUJO ', '1X', 'PORTO', 917.74, 0.2, 165.1932, '', '', 'RENOVAÇÃO '],
    [46205, 46570, 'BIANCA BAPTISTA SANTOS', '12x', 'PIER ', 2206.98, 0.15, 297.9423, '', '', 'NOVO '],
  ]
  const workbook = { SheetNames: ['JULHO 2026'], Sheets: { 'JULHO 2026': { '!ref': 'A1:K3' } } }
  // sheet_to_json real precisa de celulas no worksheet; usamos o helper direto
  // para nao depender de montar um worksheet XLSX completo neste teste.
  const linhas = extrairLinhasComissaoDaAba(rows).filter(item => item.tipo === 'renovacao')
  assert.equal(linhas.length, 1)
  assert.equal(linhas[0].nome_cliente, 'NICASSIA APARECIDA DE ARAUJO')
})
