import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { ehLayoutPier, listarProdutosPier, parseCotacaoPier, textoAssistencia} from './orcamentoPierParser.js'
import { ProdutoOrcamentoObrigatorioError } from './orcamentoProdutos.js'
import { montarCategorias, validarCotacao, ESTADO_COBERTURA } from './orcamentoComparativo.js'

const FX = JSON.parse(fs.readFileSync(new URL('./__fixtures__/pier.json', import.meta.url)))
const parse = (produto = 'personalizado', dadosProduto = null) => parseCotacaoPier({ ...FX, produto, dadosProduto })

test('reconhece o layout Pier pelo texto institucional e de assistência', () => {
  assert.equal(ehLayoutPier(FX.texto), true)
  assert.equal(ehLayoutPier('Cotação de Seguro Suhai'), false)
})

test('expõe os dois produtos e exige escolha explícita', () => {
  const lista = listarProdutosPier()
  assert.equal(lista.requer_selecao, true)
  assert.deepEqual(lista.produtos.map(p => p.id), ['personalizado', 'completo'])
  assert.throws(
    () => parseCotacaoPier(FX),
    erro => erro instanceof ProdutoOrcamentoObrigatorioError && erro.produtos.length === 2,
  )
})

test('preenche segurado, condutor, veículo e tipo de operação', () => {
  const cot = parse()
  assert.equal(cot.segurado.nome, 'ELIANA MOTA FERREIRA')
  assert.equal(cot.condutor_principal.nome, 'ELIANA MOTA FERREIRA')
  assert.equal(cot.veiculo.marca_modelo, 'GM - Chevrolet ONIX SEDAN Plus 1.0 12V TB Flex Aut.')
  assert.equal(cot.veiculo.placa, 'BDW1G70')
  assert.equal(cot.veiculo.cep_pernoite, '07085-330')
  assert.equal(cot.cotacao.tipo_operacao, 'novo')
  assert.equal(cot.cotacao.validade, '2026-08-26')
})

test('lê a franquia da página textual, sem copiar preço da amostra raster', () => {
  const cot = parse('completo')
  assert.equal(cot.valores.franquia, 3625.62)
  assert.equal(cot.valores.premio_total, null)
  assert.equal(cot.avisos_extracao[0].code, 'PAGINA_PRODUTO_RASTER')
  assert.equal(validarCotacao(cot).podeGerar, false)
})

test('OCR ou revisão pode entregar os campos do produto sem trocar sua identidade', () => {
  const cot = parse('completo', {
    premio_total: 'R$ 1.996,13',
    percentual_fipe: 100,
    carro_reserva: true,
    carro_reserva_detalhe: '7 dias de carro reserva.',
  })
  assert.equal(cot.produto_selecionado.id, 'completo')
  assert.equal(cot.valores.premio_total, 1996.13)
  assert.equal(cot.indenizacao_integral.percentual_fipe, 100)
  assert.equal(cot.avisos_extracao.length, 0)
  assert.equal(montarCategorias(cot).categorias.find(c => c.key === 'carro_reserva')?.estado, ESTADO_COBERTURA.INCLUIDA)
})

// Corrigido em 27/08 apos conferir o PDF: a Pier LISTA carro reserva em
// "Coberturas adicionais", com texto proprio. O teste anterior afirmava
// NAO_INFORMADO por supor que a cobertura vinha do nome do produto — nao vem, vem
// do documento. O que o PDF nao diz e a categoria e o numero de diarias, e isso
// continua saindo da revisao.
test('carro reserva vem do que o PDF lista, nao do nome do produto', () => {
  const cot = parse('completo')
  const carro = montarCategorias(cot).categorias.find(c => c.key === 'carro_reserva')
  assert.equal(carro.estado, ESTADO_COBERTURA.INCLUIDA)
  assert.match(carro.texto, /Incluso/i)
})

test('danos a terceiros sem valor NAO conta como informado', () => {
  // Regra nova: a linha de terceiros existe para mostrar o LIMITE. A Pier so
  // descreve a cobertura em texto — o valor esta na pagina rasterizada. Deixar a
  // descricao passar por informacao poria prosa de um lado do comparativo contra
  // "R$ 150.000,00" do outro, como se as duas informassem a mesma coisa.
  const estados = Object.fromEntries(montarCategorias(parse()).categorias.map(c => [c.key, c.estado]))
  assert.equal(estados.terceiros, ESTADO_COBERTURA.NAO_INFORMADO)
  assert.equal(estados.colisao, ESTADO_COBERTURA.INCLUIDA)
  assert.equal(estados.assistencia, ESTADO_COBERTURA.INCLUIDA)
  assert.equal(estados.franquia, ESTADO_COBERTURA.INCLUIDA)
  assert.equal(estados.vidros, ESTADO_COBERTURA.INCLUIDA)
})

test('logo e cor vêm do cadastro', () => {
  const cot = parseCotacaoPier({ ...FX, produto: 'personalizado', seguradoraMeta: { id: 'p1', nome_canonico: 'Pier Seguradora', logo_url: '/p.svg', cor_destaque: '#222222' } })
  assert.equal(cot.seguradora.logo_url, '/p.svg')
  assert.equal(cot.seguradora.cor_destaque, '#222222')
})

// A Pier nao imprime se a franquia e reduzida ou normal, e o campo e critico:
// sai no documento do cliente e as outras seguradoras do comparativo declaram.
// Deduzir do valor seria invencao; o parser pergunta.
test('Pier pede o tipo de franquia quando ele nao vem informado', () => {
  const cot = parseCotacaoPier({ itens: FX.itens, texto: FX.texto, produto: 'completo' })
  assert.equal(cot.valores.franquia_tipo, '')
  assert.equal(cot.escolha_pendente.campo, 'franquia_tipo')
  assert.deepEqual(cot.escolha_pendente.opcoes.map(o => o.indice), ['reduzida', 'normal'])
})

test('Pier aceita o tipo de franquia escolhido e encerra a pendencia', () => {
  const cot = parseCotacaoPier({ itens: FX.itens, texto: FX.texto, produto: 'completo', franquia_tipo: 'reduzida' })
  assert.equal(cot.valores.franquia_tipo, 'Reduzida')
  assert.equal(cot.escolha_pendente, null)
})

test('assistencia informa quantos acionamentos por ano, lidos do PDF', () => {
  const cot = parse('completo')
  const a = montarCategorias(cot).categorias.find(c => c.key === 'assistencia')
  assert.match(a.texto, /3 acionamentos por ano/)
})

test('sem o limite no documento, a assistencia nao inventa um numero', () => {
  assert.equal(textoAssistencia('texto sem limite nenhum').includes('acionamentos'), false)
  assert.match(textoAssistencia('Quantas vezes pode ser acionado? 5 acionamentos/ano'), /5 acionamentos por ano/)
})
