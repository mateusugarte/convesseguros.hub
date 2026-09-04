import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { agruparLinhas } from './pdfLayout.js'
import {
  ehLayoutYelum, extrairCoberturasYelum, extrairPagamentoYelum, parseCotacaoYelum,
} from './orcamentoYelumParser.js'
import { ESTADO_COBERTURA, montarCategorias, validarCotacao } from './orcamentoComparativo.js'

const FX = JSON.parse(fs.readFileSync(new URL('./__fixtures__/yelum.json', import.meta.url)))
const linhas = () => agruparLinhas(FX.itens)
const parse = () => parseCotacaoYelum(FX)

test('reconhece Yelum pelo CNPJ e pelo título do produto', () => {
  assert.equal(ehLayoutYelum(FX.texto), true)
  assert.equal(ehLayoutYelum('Liberty Seguros sem cotação Auto Perfil'), false)
})

test('extrai as sete coberturas contratadas', () => {
  const coberturas = extrairCoberturasYelum(linhas())
  assert.equal(coberturas.length, 7)
  assert.equal(coberturas.find(c => c.categoria === 'colisao')?.lmi_percentual, 100)
  assert.equal(coberturas.find(c => /DANOS MATERIAIS/i.test(c.nome_original_seguradora))?.valor_lmi, 150000)
})

test('LMI ausente nao usa o premio da cobertura como limite', () => {
  const linhasSemLmi = agruparLinhas([
    { pagina: 1, y: 350, x: 60, texto: 'DANOS MATERIAIS' },
    { pagina: 1, y: 350, x: 452, texto: 'R$ 367,67' },
  ])
  const [cobertura] = extrairCoberturasYelum(linhasSemLmi)
  assert.equal(cobertura.valor_lmi, null)
  assert.equal(cobertura.premio, 367.67)
})

test('preserva Danos Morais e Estéticos mesmo com o nome quebrado em duas linhas', () => {
  const moral = extrairCoberturasYelum(linhas()).find(c => /MORAIS/i.test(c.nome_original_seguradora))
  assert.match(moral.nome_original_seguradora, /ESTÉTICOS/)
  assert.equal(moral.valor_lmi, 5000)
})

test('lê até doze parcelas no cartão e não desloca as colunas', () => {
  const pagamentos = Object.fromEntries(extrairPagamentoYelum(linhas()).map(p => [p.meio, p.planos]))
  assert.equal(pagamentos['Cartão de crédito'].at(-1).n, 12)
  assert.equal(pagamentos['Cartão de crédito'].at(-1).valor_parcela, 155.68)
  assert.equal(pagamentos['Débito em conta'].at(-1).n, 10)
})

test('preenche segurado, condutor, veículo e renovação', () => {
  const cot = parse()
  assert.equal(cot.segurado.nome, 'NEUZA FRANCISCA DOS SANTOS LINS')
  assert.equal(cot.condutor_principal.nome, 'BEATRIZ SANTOS LINS')
  assert.equal(cot.veiculo.placa, 'EKL6036')
  assert.equal(cot.cotacao.tipo_operacao, 'renovacao')
  assert.deepEqual(cot.vigencia, { inicio: '2026-08-27', fim: '2027-08-27' })
})

test('usa a validade declarada nas informações gerais, não a vigência', () => {
  assert.equal(parse().cotacao.validade, '2026-08-30')
})

test('premiação e franquia batem com o demonstrativo', () => {
  const valores = parse().valores
  assert.equal(valores.premio_liquido, 1739.75)
  assert.equal(valores.iof, 128.39)
  assert.equal(valores.premio_total, 1868.14)
  assert.equal(valores.franquia, 2340)
  assert.equal(valores.franquia_tipo, 'FACULTATIVA')
})

test('detalhe de vidros mantém as franquias por peça', () => {
  const vidro = parse().coberturas.find(c => c.categoria === 'vidros')
  assert.match(vidro.observacoes, /Para-brisa R\$340,00/i)
  assert.match(vidro.observacoes, /Retrovisores R\$130,00/i)
})

test('plano intermediario leva o limite de reboque para a revisao', () => {
  const cot = parse()
  const assistencia = cot.coberturas.find(c => c.categoria === 'assistencia')
  assert.equal(cot.assistencia_24h.limite_reboque_km, 500)
  assert.match(assistencia.observacoes, /500 km/)
})

test('as categorias obrigatórias são explícitas e a cotação pode ser gerada', () => {
  const cot = parse()
  for (const categoria of montarCategorias(cot).categorias.filter(c => !c.opcional)) {
    assert.equal(categoria.estado, ESTADO_COBERTURA.INCLUIDA, categoria.key)
  }
  assert.equal(validarCotacao(cot).podeGerar, true)
})

test('logo e cor vêm do cadastro', () => {
  const cot = parseCotacaoYelum({ ...FX, seguradoraMeta: { id: 'y1', nome_canonico: 'Yelum Seguros S.A.', logo_url: '/y.svg', cor_destaque: '#00a0af' } })
  assert.equal(cot.seguradora.logo_url, '/y.svg')
  assert.equal(cot.seguradora.cor_destaque, '#00a0af')
})
