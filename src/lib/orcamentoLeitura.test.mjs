import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { aplicarEscolha, camposDaCotacao } from './orcamentoLeitura.js'
import { parseCotacaoAllianz } from './orcamentoAllianzParser.js'
import { montarCategorias, criarCotacaoOrcamento } from './orcamentoComparativo.js'

const FX = JSON.parse(fs.readFileSync(new URL('./__fixtures__/allianz.json', import.meta.url)))
const campos = oferta => camposDaCotacao(
  parseCotacaoAllianz({ itens: FX.itens, texto: FX.texto, oferta }),
  { montarCategorias },
)

// As chaves espelham `REVIEW_FIELDS` em `AutoQuoteComparison.jsx`. O teste existe
// para o dia em que alguem renomear um campo la e a revisao passar a mostrar
// "Não informado" num campo que o parser preencheu — falha silenciosa, porque a
// tela continuaria funcionando e so o dado sumiria.
const CHAVES_DA_REVISAO = [
  'numero', 'validade', 'vigencia_inicio', 'vigencia_fim',
  'premio_liquido', 'iof', 'premio_total', 'premio_parcelado',
  'franquia', 'franquia_tipo', 'indenizacao_integral',
  'assistencia', 'carro_reserva', 'vidros', 'danos_terceiros', 'nao_inclusos',
]

test('preenche exatamente os campos que a coluna de revisao mostra', () => {
  assert.deepEqual(Object.keys(campos('Completo')).sort(), [...CHAVES_DA_REVISAO].sort())
})

test('leva os valores da cotacao para a revisao', () => {
  const c = campos('Completo')
  assert.equal(c.numero, '493446723')
  assert.equal(c.premio_total, 4236.87)
  assert.equal(c.franquia, 3161.89)
  assert.equal(c.franquia_tipo, '50% da Normal')
  assert.equal(c.vigencia_inicio, '2026-08-30')
  assert.equal(c.indenizacao_integral, 'Inclusa — 100% da FIPE')
  assert.match(c.danos_terceiros, /Responsabilidade Civil Facultativa/)
  assert.match(c.assistencia, /Plano 2/)
})

// Trocar a oferta tem de trocar o que vai para a revisao — e o ponto inteiro de
// perguntar. Se os campos nao mudassem, a pergunta seria decorativa.
test('trocar a oferta troca o premio e as coberturas na revisao', () => {
  const barata = campos('Roubo e Furto')
  const cara = campos('Exclusivo')
  assert.equal(barata.premio_total, 2453.03)
  assert.equal(cara.premio_total, 4866.50)
  assert.match(barata.danos_terceiros, /R\$\s*100\.000,00/)
  assert.match(cara.danos_terceiros, /R\$\s*1\.000\.000,00/)
})

// A cotacao NEGA carro reserva; a revisao tem de dizer isso com palavras, e nao
// deixar o campo em branco — em branco parece campo que ninguem leu ainda.
test('cobertura negada no PDF chega a revisao como negacao, nao como vazio', () => {
  assert.match(campos('Completo').carro_reserva, /[Nn]ão contratado/)
})

// Sem oferta escolhida nao ha premio nem cobertura: preencher qualquer coisa
// aqui seria inventar. O campo fica vazio e a revisao cobra.
test('sem oferta escolhida os campos que dependem dela ficam vazios', () => {
  const c = campos(null)
  assert.equal(c.premio_total, '')
  assert.equal(c.premio_parcelado, '')
  assert.equal(c.danos_terceiros, '')
  // O que nao depende da oferta ja vem preenchido.
  assert.equal(c.numero, '493446723')
  assert.equal(c.franquia, 3161.89)
})

test('cotacao sem nada nao inventa campo nenhum', () => {
  const c = camposDaCotacao(criarCotacaoOrcamento(), { montarCategorias })
  assert.equal(c.premio_total, '')
  assert.equal(c.indenizacao_integral, '')
  assert.equal(c.numero, '')
})

test('camposDaCotacao devolve null quando nao ha cotacao', () => {
  assert.equal(camposDaCotacao(null, { montarCategorias }), null)
})

test('aplica a escolha de produto nos parsers que não são Allianz', async () => {
  const hdi = JSON.parse(fs.readFileSync(new URL('./__fixtures__/hdi.json', import.meta.url)))
  const leitura = await aplicarEscolha({
    suportado: true,
    parser_id: 'hdi',
    itens: hdi.itens,
    texto: hdi.texto,
    cotacao: { escolha_pendente: { campo: 'produto' } },
  }, 'determinado')
  assert.equal(leitura.cotacao.produto_selecionado.id, 'determinado')
  assert.equal(leitura.cotacao.valores.premio_total, 1664.71)
})
