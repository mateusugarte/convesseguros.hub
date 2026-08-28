import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { aplicarEscolha, aplicarRevisao, camposDaCotacao } from './orcamentoLeitura.js'
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
  'segurado_nome', 'segurado_cpf',
  'condutor_nome', 'condutor_cpf', 'condutor_estado_civil',
  'veiculo_modelo', 'veiculo_ano', 'veiculo_placa', 'veiculo_uso', 'veiculo_cep_pernoite',
  'numero', 'validade', 'vigencia_inicio', 'vigencia_fim',
  'premio_total', 'premio_parcelado',
  'franquia', 'franquia_tipo', 'indenizacao_integral',
  'assistencia', 'limite_reboque_km', 'carro_reserva', 'vidros', 'danos_terceiros', 'nao_inclusos',
]

// `premio_liquido` e `iof` saem de proposito: sao controle interno da emissao e
// nao aparecem no documento do cliente. Se voltarem a esta lista, voltam tambem
// a consumir revisao humana de graca.
test('premio liquido e IOF nao entram na revisao do orcamento', () => {
  const c = campos('Completo')
  assert.equal('premio_liquido' in c, false)
  assert.equal('iof' in c, false)
})

// REGRESSAO: o parser lia segurado, condutor e veiculo do PDF e a ponte jogava
// fora — a revisao abria em branco e esses dados nunca chegavam ao documento.
test('REGRESSAO: leva segurado, condutor e veiculo do PDF para a revisao', () => {
  const c = campos('Completo')
  assert.ok(c.segurado_nome, 'segurado deveria vir preenchido')
  assert.ok(c.veiculo_modelo, 'veiculo deveria vir preenchido')
})

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
  assert.equal(c.limite_reboque_km, 500)
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

// ─── Revisao editada volta para a cotacao ───────────────────────────────
//
// REGRESSAO: sem `aplicarRevisao` o PDF final saia com o texto EXTRAIDO e
// ignorava tudo o que o corretor corrigiu na tela — a revisao virava enfeite.

test('REGRESSAO: correcao feita na revisao chega ao documento', () => {
  const cot = parseCotacaoAllianz({ itens: FX.itens, texto: FX.texto, oferta: 'Completo' })
  const revisado = aplicarRevisao(cot, {
    segurado_nome: 'Nome Corrigido',
    veiculo_placa: 'ABC1D23',
    premio_total: '4.999,90',
    limite_reboque_km: '700',
    carro_reserva: '15 dias de carro reserva',
  })
  assert.equal(revisado.segurado.nome, 'Nome Corrigido')
  assert.equal(revisado.veiculo.placa, 'ABC1D23')
  assert.equal(revisado.valores.premio_total, 4999.90)
  assert.equal(revisado.assistencia_24h.limite_reboque_km, 700)

  const { categorias } = montarCategorias(revisado)
  assert.equal(categorias.find(c => c.key === 'carro_reserva').texto, '15 dias de carro reserva')
})

test('campo em branco na revisao nao apaga o que foi extraido', () => {
  // Em branco quer dizer "nao mexi", nunca "remova". Apagar aqui deixaria o
  // documento sair sem um dado que o PDF afirmava.
  const cot = parseCotacaoAllianz({ itens: FX.itens, texto: FX.texto, oferta: 'Completo' })
  const revisado = aplicarRevisao(cot, { segurado_nome: '', premio_total: '', franquia: '' })
  assert.equal(revisado.segurado.nome, cot.segurado.nome)
  assert.equal(revisado.valores.premio_total, cot.valores.premio_total)
  assert.equal(revisado.valores.franquia, cot.valores.franquia)
})

test('percentual corrigido na revisao atualiza a indenizacao integral', () => {
  const cot = parseCotacaoAllianz({ itens: FX.itens, texto: FX.texto, oferta: 'Completo' })
  const revisado = aplicarRevisao(cot, { indenizacao_integral: 'Inclusa — 95% da FIPE' })
  assert.equal(revisado.indenizacao_integral.incluida, true)
  assert.equal(revisado.indenizacao_integral.percentual_fipe, 95)
})

test('categoria nao informada chega vazia e visivel para revisao', () => {
  const cot = criarCotacaoOrcamento()
  const c = camposDaCotacao(cot, { montarCategorias })
  assert.equal(c.assistencia, '')
  assert.equal(c.carro_reserva, '')
  assert.equal(c.vidros, '')
  assert.equal(c.danos_terceiros, '')
})

test('texto extraido insuficiente aparece na revisao sem liberar a validacao', () => {
  const cot = criarCotacaoOrcamento()
  cot.coberturas = [
    {
      nome_original_seguradora: 'Carro reserva',
      categoria: 'carro_reserva',
      incluida: true,
      observacoes: 'Incluso — categoria e diárias conforme contratado em apólice.',
    },
    {
      nome_original_seguradora: 'Danos físicos, materiais e morais a terceiros',
      categoria: 'terceiros',
      incluida: true,
      observacoes: 'Danos físicos, materiais e morais a terceiros',
    },
  ]
  const c = camposDaCotacao(cot, { montarCategorias })
  assert.match(c.carro_reserva, /diárias conforme contratado/)
  assert.match(c.danos_terceiros, /Danos físicos/)
})

test('aplicarRevisao devolve null sem cotacao', () => {
  assert.equal(aplicarRevisao(null, { segurado_nome: 'X' }), null)
})
