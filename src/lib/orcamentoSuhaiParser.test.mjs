import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { agruparLinhas } from './pdfLayout.js'
import {
  colunasSuhai, ehLayoutSuhai, extrairCoberturasSuhai, extrairPagamentoSuhai,
  listarProdutosSuhai, parseCotacaoSuhai, PRODUTOS_SUHAI_5_COLUNAS,
  produtosSuhaiDoTexto,
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
  const rouboFurto = parse('roubo_furto')
  assert.equal(rouboFurto.valores.premio_total, 2056.80)
  assert.equal(rouboFurto.valores.franquia, null)
  assert.equal(rouboFurto.valores.franquia_nao_aplicavel, true)
  assert.equal(parse('roubo_furto_pt').valores.premio_total, 2324.93)
  assert.equal(parse('compreensiva').valores.premio_total, 2457.79)
  assert.equal(parse('compreensiva').valores.franquia, 2294.25)
  assert.equal(parse('compreensiva').valores.franquia_nao_aplicavel, false)
  assert.equal(parse('terceiros').valores.premio_total, 1502.87)
})

test('produto não compreensivo informa que a franquia não se aplica e não cria pendência falsa', () => {
  const cot = parse('roubo_furto')
  const caminhos = validarCotacao(cot).pendencias.map(p => p.caminho)
  const franquia = montarCategorias(cot).categorias.find(c => c.key === 'franquia')
  assert.equal(franquia.estado, ESTADO_COBERTURA.NAO_INCLUIDA)
  assert.match(franquia.texto, /n[ãa]o se aplica/i)
  assert.equal(caminhos.includes('valores.franquia'), false)
  assert.equal(caminhos.includes('valores.franquia_tipo'), false)
})

test('reconhece a nova grade Suhai de cinco opções sem confundir o PDF antigo', () => {
  assert.equal(produtosSuhaiDoTexto(FX.texto).length, 4)
  const moderno = 'OPÇÕES Roubo + Furto | Roubo + Furto + PT Colisão | Roubo + Furto + RCF | Roubo + Furto + PTCol(*) + RCF | Terceiros RCF'
  assert.deepEqual(
    listarProdutosSuhai(moderno).produtos.map(p => p.id),
    ['roubo_furto', 'roubo_furto_pt', 'roubo_furto_rcf', 'roubo_furto_pt_rcf', 'terceiros'],
  )
})

test('na grade de cinco opções usa o prêmio total da coluna escolhida e o valor de danos materiais decide o RCF', () => {
  const itens = []
  const add = (texto, x, y) => itens.push({ texto, x, y, pagina: 2 })
  const lmiX = [120, 220, 320, 420, 520]
  const premioX = [165, 265, 365, 465, 565]
  const totalX = [180, 280, 380, 480, 580]
  lmiX.forEach((x, i) => {
    add('LMI', x, 730)
    add('Prêmio', premioX[i], 730)
    add(['3.579,11', '4.070,93', '4.086,94', '4.578,76', '737,11'][i], totalX[i], 590)
    add(['3.843,25', '4.371,36', '4.388,56', '4.916,67', '791,51'][i], totalX[i], 575)
  })
  add('Prêmio líquido', 10, 590)
  add('Prêmio total, com IOF', 10, 575)
  add('1', 100, 400)
  add('4.388,56', 140, 400)
  add('4.388,56', 190, 400)
  add('0,000000', 240, 400)
  add('2', 100, 380)
  add('2.194,28', 140, 380)
  add('4.388,56', 190, 380)
  add('0,000000', 240, 380)
  add('RCF - Danos Materiais', 10, 665)
  ;['Não Contratado', 'Não Contratado', '25.000,00', '25.000,00', '25.000,00'].forEach((valor, i) => add(valor, lmiX[i], 665))

  const agrupadas = agruparLinhas(itens)
  const colunas = colunasSuhai(agrupadas, 5)
  assert.equal(colunas.length, 5)
  const semRcf = extrairCoberturasSuhai(agrupadas, 'roubo_furto', PRODUTOS_SUHAI_5_COLUNAS, colunas)
  const comRcf = extrairCoberturasSuhai(agrupadas, 'roubo_furto_rcf', PRODUTOS_SUHAI_5_COLUNAS, colunas)
  assert.equal(semRcf.find(c => /Danos Materiais/.test(c.nome_original_seguradora)).incluida, false)
  assert.equal(comRcf.find(c => /Danos Materiais/.test(c.nome_original_seguradora)).valor_lmi, 25000)

  const texto = 'SUHAI SEGURADORA CNPJ 16.825.255/0001-23 OPÇÕES Roubo + Furto + PTCol(*) + RCF Terceiros RCF'
  const cot = parseCotacaoSuhai({ itens, texto, produto: 'roubo_furto_rcf' })
  assert.equal(cot.valores.premio_total, 4388.56)
  assert.equal(cot.valores.premio_liquido, 4086.94)
  assert.deepEqual(cot.valores.premio_parcelado, ['Até 2x de R$ 2.194,28 sem juros'])
  assert.equal(cot.valores.franquia, null)
  assert.equal(cot.valores.franquia_nao_aplicavel, true)
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
