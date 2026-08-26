import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { agruparLinhas } from './pdfLayout.js'
import {
  ehLayoutSuhai, extrairCoberturasSuhai, extrairPagamentoSuhai,
  listarProdutosSuhai, parseCotacaoSuhai,
} from './orcamentoSuhaiParser.js'
import { ProdutoOrcamentoObrigatorioError } from './orcamentoProdutos.js'
import { montarCategorias, validarCotacao, ESTADO_COBERTURA } from './orcamentoComparativo.js'

const FX = JSON.parse(fs.readFileSync(new URL('./__fixtures__/suhai.json', import.meta.url)))
const linhas = () => agruparLinhas(FX.itens)
const parse = produto => parseCotacaoSuhai({ ...FX, produto })

test('reconhece o layout Suhai pelo CNPJ e pela marca', () => {
  assert.equal(ehLayoutSuhai(FX.texto), true)
  assert.equal(ehLayoutSuhai('Cotação Bradesco'), false)
})

test('expõe os quatro produtos do PDF e não escolhe silenciosamente', () => {
  const lista = listarProdutosSuhai()
  assert.equal(lista.requer_selecao, true)
  assert.deepEqual(lista.produtos.map(p => p.id), ['roubo_furto', 'roubo_furto_pt', 'compreensiva', 'terceiros'])
  assert.throws(
    () => parseCotacaoSuhai(FX),
    erro => erro instanceof ProdutoOrcamentoObrigatorioError && erro.produtos.length === 4,
  )
})

test('cada produto lê seu próprio prêmio e franquia', () => {
  assert.equal(parse('roubo_furto').valores.premio_total, 2056.80)
  assert.equal(parse('roubo_furto_pt').valores.premio_total, 2324.93)
  assert.equal(parse('compreensiva').valores.premio_total, 2457.79)
  assert.equal(parse('compreensiva').valores.franquia, 2294.25)
  assert.equal(parse('terceiros').valores.premio_total, 1502.87)
})

test('colunas não misturam coberturas entre produtos', () => {
  const completa = extrairCoberturasSuhai(linhas(), 'compreensiva')
  const terceiros = extrairCoberturasSuhai(linhas(), 'terceiros')
  assert.equal(completa.find(c => /^Compreensiva/.test(c.nome_original_seguradora))?.incluida, true)
  assert.equal(terceiros.find(c => /^Compreensiva/.test(c.nome_original_seguradora))?.incluida, false)
  assert.equal(terceiros.find(c => /Danos Materiais/.test(c.nome_original_seguradora))?.valor_lmi, 150000)
})

test('parcelamento também acompanha o produto escolhido', () => {
  const completa = extrairPagamentoSuhai(linhas(), 'compreensiva')
  const terceiros = extrairPagamentoSuhai(linhas(), 'terceiros')
  assert.equal(completa.find(p => p.n === 1)?.total, 2457.79)
  assert.equal(terceiros.find(p => p.n === 1)?.total, 1502.87)
  assert.equal(completa.filter(p => p.juros === 0).at(-1)?.n, 3)
})

test('preenche identificação, veículo, vigência e renovação', () => {
  const cot = parse('compreensiva')
  assert.equal(cot.segurado.nome, 'NEUZA FRANCISCA DOS SANTOS LINS')
  assert.equal(cot.condutor_principal.nome, 'BEATRIZ SANTOS LINS')
  assert.equal(cot.veiculo.placa, 'EKL6036')
  assert.equal(cot.veiculo.cep_pernoite, '03659-070')
  assert.equal(cot.cotacao.tipo_operacao, 'renovacao')
  assert.deepEqual(cot.vigencia, { inicio: '2026-08-20', fim: '2027-08-20' })
  assert.equal(cot.cotacao.validade, '2026-08-25')
})

test('indenização integral é derivada somente da coluna escolhida', () => {
  assert.deepEqual(parse('compreensiva').indenizacao_integral, { incluida: true, percentual_fipe: 100, observacao: '' })
  assert.deepEqual(parse('terceiros').indenizacao_integral, {
    incluida: false, percentual_fipe: null, observacao: 'O produto não contrata indenização integral do veículo.',
  })
})

test('silêncio sobre carro reserva e vidros continua pendente para revisão', () => {
  const cot = parse('compreensiva')
  const estados = Object.fromEntries(montarCategorias(cot).categorias.map(c => [c.key, c.estado]))
  assert.equal(estados.colisao, ESTADO_COBERTURA.INCLUIDA)
  assert.equal(estados.terceiros, ESTADO_COBERTURA.INCLUIDA)
  assert.equal(estados.assistencia, ESTADO_COBERTURA.INCLUIDA)
  assert.equal(estados.carro_reserva, ESTADO_COBERTURA.NAO_INFORMADO)
  assert.equal(estados.vidros, ESTADO_COBERTURA.NAO_INFORMADO)
  assert.equal(validarCotacao(cot).podeGerar, false)
})

test('logo e cor vêm do cadastro', () => {
  const cot = parseCotacaoSuhai({ ...FX, produto: 'compreensiva', seguradoraMeta: { id: 's1', nome_canonico: 'Suhai Seguradora S.A.', logo_url: '/s.svg', cor_destaque: '#6b2fa0' } })
  assert.equal(cot.seguradora.logo_url, '/s.svg')
  assert.equal(cot.seguradora.cor_destaque, '#6b2fa0')
})
