import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { agruparLinhas } from './pdfLayout.js'
import {
  ehLayoutTokio, extrairCoberturasTokio, extrairPagamentoTokio, parseCotacaoTokio,
} from './orcamentoTokioParser.js'
import { ESTADO_COBERTURA, montarCategorias, validarCotacao } from './orcamentoComparativo.js'

const FX = JSON.parse(fs.readFileSync(new URL('./__fixtures__/tokio.json', import.meta.url)))
const linhas = () => agruparLinhas(FX.itens)
const parse = () => parseCotacaoTokio(FX)

test('reconhece o layout pela marca e pelo processo SUSEP de Auto', () => {
  assert.equal(ehLayoutTokio(FX.texto), true)
  assert.equal(ehLayoutTokio('Tokio Marine Seguro Fiança'), false)
})

test('extrai coberturas contratadas e negativas explícitas', () => {
  const coberturas = extrairCoberturasTokio(linhas())
  assert.equal(coberturas.find(c => /Colisão/.test(c.nome_original_seguradora))?.lmi_percentual, 100)
  assert.equal(coberturas.find(c => /^Blindagem$/.test(c.nome_original_seguradora))?.incluida, false)
  assert.equal(coberturas.find(c => /Danos Materiais/.test(c.nome_original_seguradora))?.valor_lmi, 150000)
})

test('REGRESSÃO: 100% FIPE não vira R$ 100,00', () => {
  const casco = parse().coberturas.find(c => c.categoria === 'colisao')
  assert.equal(casco.valor_lmi, null)
  assert.match(casco.observacoes, /100,00%/)
  assert.doesNotMatch(casco.observacoes, /R\$\s*100/)
})

test('indenização integral ausente é uma negativa explícita, não campo pendente', () => {
  assert.deepEqual(parse().indenizacao_integral, { incluida: false, percentual_fipe: null, observacao: '' })
  const colisao = montarCategorias(parse()).categorias.find(c => c.key === 'colisao')
  assert.match(colisao.texto, /não possui/i)
})

test('lê os limites de parcelamento sem juros de cada meio', () => {
  const planos = extrairPagamentoTokio(linhas())
  const maximo = meio => Math.max(...planos.filter(p => p.meio === meio && /sem juros/i.test(p.juros)).map(p => p.n))
  assert.equal(maximo('Débito/Pix automático'), 5)
  assert.equal(maximo('Ficha'), 4)
  assert.equal(maximo('Cartão de crédito'), 12)
})

test('diferencia o preço antecipado do prêmio padrão', () => {
  const valores = parse().valores
  assert.equal(valores.premio_total, 4660.70)
  assert.ok(valores.descontos_aplicados.some(d => /4\.427,72/.test(d)))
})

test('preenche segurado, condutor, veículo, vigência e renovação', () => {
  const cot = parse()
  assert.equal(cot.segurado.nome, 'PRISCILA CUNHA DOS SANTOS')
  assert.equal(cot.condutor_principal.nome, 'AGUINOSVAN ALVES DOS SANTOS')
  assert.equal(cot.veiculo.placa, 'GAO-1151')
  assert.equal(cot.veiculo.cep_pernoite, '04849-015')
  assert.equal(cot.cotacao.tipo_operacao, 'renovacao')
  assert.deepEqual(cot.vigencia, { inicio: '2026-09-05', fim: '2027-09-05' })
})

test('totais e franquia batem com a cotação', () => {
  const valores = parse().valores
  assert.equal(valores.premio_liquido, 4340.39)
  assert.equal(valores.iof, 320.31)
  assert.equal(valores.premio_total, 4660.70)
  assert.equal(valores.franquia, 3373)
  assert.equal(valores.franquia_tipo, '50% da Básica')
})

test('carro reserva e vidros vêm da página de serviços', () => {
  const cot = parse()
  assert.match(cot.coberturas.find(c => c.categoria === 'carro_reserva').observacoes, /7 diárias/i)
  assert.match(cot.coberturas.find(c => c.categoria === 'vidros').observacoes, /Parabrisa R\$\s*365,00/i)
})

test('todas as categorias obrigatórias são resolvidas e a cotação pode ser gerada', () => {
  const cot = parse()
  for (const categoria of montarCategorias(cot).categorias.filter(c => !c.opcional)) {
    assert.equal(categoria.estado, ESTADO_COBERTURA.INCLUIDA, categoria.key)
  }
  assert.equal(validarCotacao(cot).podeGerar, true)
})

test('registra a referência das Condições Gerais e sua versão', () => {
  assert.match(parse().condicoes_gerais.referencia, /15414\.100335\/2004-74/)
  assert.equal(parse().condicoes_gerais.anexada_em, '2026-08-18')
})

test('logo e cor são lidas do cadastro', () => {
  const cot = parseCotacaoTokio({ ...FX, seguradoraMeta: { id: 't1', nome_canonico: 'Tokio Marine', logo_url: '/t.svg', cor_destaque: '#956e26' } })
  assert.equal(cot.seguradora.id, 't1')
  assert.equal(cot.seguradora.logo_url, '/t.svg')
})

