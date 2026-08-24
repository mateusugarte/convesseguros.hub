import test from 'node:test'
import assert from 'node:assert/strict'

import { cotacaoDeExtracao, resumoExtracao, mesmaSeguradora, CAMPOS_MANUAIS } from './orcamentoExtracao.js'
import { validarCotacao, corDaSeguradora } from './orcamentoComparativo.js'

// Saida realista de `parseOrcamentoAutoText`
const extracao = {
  tipo: 'orcamento',
  layout: 'tokio',
  seguradora: 'Tokio Marine',
  campos: {
    nome_cliente: 'Priscila Cunha dos Santos',
    cpf_cliente: '123.456.789-00',
    condutor_nome: 'Aguinosvan A. dos Santos',
    condutor_cpf: '987.654.321-00',
    modelo_veiculo: 'Ford EcoSport SE 1.5 12V Flex Aut.',
    placa: 'GAO-1151',
    cep_pernoite: '04849-015',
    vigencia_inicio: '2026-09-01',
    vigencia_fim: '2027-09-01',
  },
  seguradora_cotada: {
    nome: 'Tokio Marine',
    premio_liquido: '4.200,00',
    valor_total: '4.660,70',
    parcelamentos: 'Em até 12x sem juros no cartão',
  },
  avisos: [],
  _text: 'PROPOSTA DE SEGURO AUTO — Renovação Congênere — Tokio Marine',
}

test('traduz identificacao, veiculo, vigencia e valores', () => {
  const cot = cotacaoDeExtracao(extracao)
  assert.equal(cot.segurado.nome, 'Priscila Cunha dos Santos')
  assert.equal(cot.condutor_principal.nome, 'Aguinosvan A. dos Santos')
  assert.equal(cot.veiculo.placa, 'GAO-1151')
  assert.equal(cot.vigencia.fim, '2027-09-01')
  assert.equal(cot.valores.premio_total, 4660.7, 'moeda pt-BR convertida')
  assert.equal(cot.valores.premio_liquido, 4200)
})

test('reconhece o tipo de operacao pelo texto bruto do PDF', () => {
  assert.equal(cotacaoDeExtracao(extracao).cotacao.tipo_operacao, 'renovacao')
})

test('tipo de operacao desconhecido volta vazio, nunca chutado', () => {
  const cot = cotacaoDeExtracao({ ...extracao, _text: 'documento qualquer' })
  assert.equal(cot.cotacao.tipo_operacao, '')
})

test('logo e cor vem do cadastro, nunca do PDF', () => {
  const cot = cotacaoDeExtracao(extracao, {
    seguradoraMeta: { id: 'abc', nome_canonico: 'Tokio Marine', logo_url: 'https://cdn/tokio.png', cor_destaque: '#956e26' },
  })
  assert.equal(cot.seguradora.id, 'abc')
  assert.equal(cot.seguradora.logo_url, 'https://cdn/tokio.png')
  assert.equal(corDaSeguradora(cot.seguradora), '#956e26')
})

test('sem seguradora no cadastro, usa a detectada mas fica sem logo', () => {
  const cot = cotacaoDeExtracao(extracao)
  assert.equal(cot.seguradora.nome, 'Tokio Marine')
  assert.equal(cot.seguradora.logo_url, '')
})

// ─── O ponto central: nao inventar cobertura ───────────────────────────

test('nenhuma cobertura e inventada a partir do texto do PDF', () => {
  const cot = cotacaoDeExtracao({
    ...extracao,
    _text: 'texto citando carro reserva, assistencia 24 horas, vidros e blindagem',
  })
  assert.deepEqual(cot.coberturas, [], 'a citacao no texto nao pode virar cobertura')
  assert.deepEqual(cot.assistencias, [])
  assert.deepEqual(cot.nao_incluso, [])
  assert.equal(cot.indenizacao_integral.incluida, null)
  assert.equal(cot.valores.franquia, null)
})

test('cotacao so extraida NAO passa na validacao — a revisao e obrigatoria', () => {
  const v = validarCotacao(cotacaoDeExtracao(extracao))
  assert.equal(v.podeGerar, false)
  assert.ok(v.bloqueios.some(b => b.caminho === 'indenizacao_integral.incluida'))
})

// ─── Resumo para a tela de revisao ─────────────────────────────────────

test('resumo separa o que veio do PDF do que sobrou para o corretor', () => {
  const cot = cotacaoDeExtracao(extracao)
  const r = resumoExtracao(cot, extracao)
  assert.ok(r.preenchidos.includes('segurado.nome'))
  assert.ok(r.preenchidos.includes('valores.premio_total'))
  assert.equal(r.layout, 'tokio')
  assert.ok(r.cobertura > 0 && r.cobertura <= 100)
  assert.equal(r.manuais, CAMPOS_MANUAIS)
})

test('o resumo sempre avisa que as coberturas nao vieram do PDF', () => {
  const r = resumoExtracao(cotacaoDeExtracao(extracao), extracao)
  assert.ok(r.avisos.some(a => /coberturas não são extraídas/i.test(a)))
})

test('avisos do parser sao preservados junto com o fixo', () => {
  const comAviso = { ...extracao, avisos: ['Seguradora não identificada no PDF — confira o campo antes de salvar.'] }
  const r = resumoExtracao(cotacaoDeExtracao(comAviso), comAviso)
  assert.equal(r.avisos.length, 2)
})

test('campo que o parser nao achou aparece em faltando', () => {
  const semPlaca = { ...extracao, campos: { ...extracao.campos, placa: '' } }
  const r = resumoExtracao(cotacaoDeExtracao(semPlaca), semPlaca)
  assert.ok(r.faltando.includes('veiculo.placa'))
})

test('extracao vazia nao quebra e devolve schema completo', () => {
  const cot = cotacaoDeExtracao(null)
  assert.equal(cot.segurado.nome, '')
  assert.equal(cot.valores.premio_total, null)
  assert.deepEqual(cot.coberturas, [])
})

// ─── Mesma seguradora dos dois lados ───────────────────────────────────

test('avisa quando os dois PDFs sao da mesma seguradora', () => {
  const a = cotacaoDeExtracao(extracao)
  const b = cotacaoDeExtracao(extracao)
  assert.equal(mesmaSeguradora(a, b), true)
})

test('seguradoras diferentes nao disparam o aviso', () => {
  const a = cotacaoDeExtracao(extracao)
  const b = cotacaoDeExtracao({ ...extracao, seguradora: 'Porto Seguro', seguradora_cotada: { nome: 'Porto Seguro' } })
  assert.equal(mesmaSeguradora(a, b), false)
})

test('lado vazio nunca conta como "mesma seguradora"', () => {
  assert.equal(mesmaSeguradora(cotacaoDeExtracao(null), cotacaoDeExtracao(null)), false)
})
