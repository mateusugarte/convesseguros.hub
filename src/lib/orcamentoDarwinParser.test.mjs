import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { agruparLinhas } from './pdfLayout.js'
import {
  ehLayoutDarwin, extrairCoberturasDarwin, extrairFranquiasVidrosDarwin,
  extrairPagamentoDarwin, parseCotacaoDarwin,
} from './orcamentoDarwinParser.js'
import { montarCategorias, validarCotacao, ESTADO_COBERTURA } from './orcamentoComparativo.js'

const FX = JSON.parse(fs.readFileSync(new URL('./__fixtures__/darwin.json', import.meta.url)))
const linhas = () => agruparLinhas(FX.itens)
const parse = () => parseCotacaoDarwin(FX)

test('reconhece a cotacao Darwin pelo CNPJ e pela marca', () => {
  assert.equal(ehLayoutDarwin(FX.texto), true)
  assert.equal(ehLayoutDarwin('Cotação Pier Seguros'), false)
})

test('extrai as dez coberturas da grade e preserva Morte como não contratada', () => {
  const coberturas = extrairCoberturasDarwin(linhas())
  assert.equal(coberturas.length, 11)
  assert.equal(coberturas.find(c => c.nome_original_seguradora === 'Morte')?.incluida, false)
  assert.equal(coberturas.find(c => /Danos Materiais/.test(c.nome_original_seguradora))?.valor_lmi, 150000)
})

test('não confunde a repetição de Vidros na seção de franquias com nova cobertura', () => {
  const contratadas = parse().coberturas.filter(c => c.categoria === 'vidros')
  assert.equal(contratadas.length, 1)
})

test('lê franquias de vidros por peça', () => {
  const franquias = Object.fromEntries(extrairFranquiasVidrosDarwin(linhas()).map(item => [item.nome, item.valor]))
  assert.equal(franquias.Parabrisa, 385)
  assert.equal(franquias.Retrovisor, 330)
})

test('lê as dez parcelas sem juros por coluna', () => {
  const planos = extrairPagamentoDarwin(linhas())
  assert.equal(planos.at(-1).n, 10)
  assert.equal(planos.at(-1).valor_parcela, 355.26)
  assert.equal(planos.at(-1).total, 3552.64)
})

test('preenche identificação, veículo, vigência e tipo de operação', () => {
  const cot = parse()
  assert.equal(cot.segurado.nome, 'Jaime Mota Ferreira')
  assert.equal(cot.condutor_principal.cpf, '455.115.600-06')
  assert.equal(cot.veiculo.placa, 'BDW1G70')
  assert.equal(cot.veiculo.cep_pernoite, '07085-330')
  assert.equal(cot.cotacao.tipo_operacao, 'renovacao')
  assert.deepEqual(cot.vigencia, { inicio: '2026-08-19', fim: '2027-08-19' })
})

test('totais fecham e a franquia vem da linha de perdas parciais', () => {
  const valores = parse().valores
  assert.equal(valores.premio_liquido, 3308.47)
  assert.equal(valores.iof, 244.17)
  assert.equal(valores.premio_total, 3552.64)
  assert.equal(valores.franquia, 7500)
})

test('a afirmação de 100% da tabela sustenta a indenização integral', () => {
  assert.deepEqual(parse().indenizacao_integral, { incluida: true, percentual_fipe: 100, observacao: '' })
})

test('as seis categorias obrigatórias ficam incluídas e a cotação pode ser gerada', () => {
  const cot = parse()
  const categorias = montarCategorias(cot).categorias.filter(c => !c.opcional)
  assert.equal(categorias.length, 6)
  for (const categoria of categorias) assert.equal(categoria.estado, ESTADO_COBERTURA.INCLUIDA, categoria.key)
  assert.equal(validarCotacao(cot).podeGerar, true)
})

test('logo e cor são sempre do cadastro', () => {
  const cot = parseCotacaoDarwin({ ...FX, seguradoraMeta: { id: 'd1', nome_canonico: 'Darwin Seguros S.A.', logo_url: '/d.svg', cor_destaque: '#ff007a' } })
  assert.deepEqual(cot.seguradora, { id: 'd1', nome: 'Darwin Seguros S.A.', logo_url: '/d.svg', cor_destaque: '#ff007a' })
})

