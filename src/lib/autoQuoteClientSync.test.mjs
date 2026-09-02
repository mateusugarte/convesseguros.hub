import test from 'node:test'
import assert from 'node:assert/strict'

import {
  clientPatchFromQuotePatch,
  extractedQuoteClientPatch,
  planExtractedQuoteClientSync,
} from './autoQuoteClientSync.js'

const extracted = {
  segurado_nome: 'Luciene Tereza da Silva',
  segurado_cpf: '183.005.068-02',
  condutor_nome: 'Carlos Augusto da Silva',
  veiculo_modelo: 'Hyundai HB20 Evolution',
  veiculo_placa: 'RNB0B53',
  veiculo_uso: 'Particular',
  veiculo_cep_pernoite: '04917-020',
  veiculo_tipo_residencia: 'Apartamento',
  veiculo_passagem_leilao: 'Não',
  veiculo_financiado: 'Sim',
  veiculo_kit_gas: 'Não',
  veiculo_blindagem: 'Não',
  veiculo_isento_imposto: 'Não',
  veiculo_garagem_residencia: 'Sim',
  veiculo_garagem_trabalho: 'Não',
  veiculo_garagem_estudo: 'Não',
  vigencia_inicio: '2026-09-03',
}

test('traduz somente dados pessoais e do risco extraidos do PDF', () => {
  assert.deepEqual(extractedQuoteClientPatch({ ...extracted, premio_total: 2690.65 }), {
    nome_cliente: 'Luciene Tereza da Silva',
    cpf_cliente: '183.005.068-02',
    condutor_nome: 'Carlos Augusto da Silva',
    modelo_veiculo: 'Hyundai HB20 Evolution',
    placa: 'RNB0B53',
    uso_veiculo: 'Particular',
    cep_pernoite: '04917-020',
    tipo_residencia: 'Apartamento',
    passagem_leilao: 'Não',
    veiculo_financiado: 'Sim',
    possui_kit_gas: 'Não',
    possui_blindagem: 'Não',
    isento_imposto: 'Não',
    garagem_residencia: 'Sim',
    garagem_trabalho: 'Não',
    garagem_estudo: 'Não',
    vigencia_inicio: '2026-09-03',
  })
})

test('campo vazio e preenchido automaticamente e divergencia pede confirmacao', () => {
  const plan = planExtractedQuoteClientSync({
    nome_cliente: 'Luciene Tereza da Silva',
    cpf_cliente: null,
    modelo_veiculo: 'Honda HR-V',
  }, extracted)

  assert.equal(plan.automaticPatch.cpf_cliente, '183.005.068-02')
  assert.equal(plan.automaticPatch.condutor_nome, 'Carlos Augusto da Silva')
  assert.equal(plan.conflicts.length, 1)
  assert.deepEqual(plan.conflicts[0], {
    field: 'modelo_veiculo',
    label: 'Veículo',
    current: 'Honda HR-V',
    extracted: 'Hyundai HB20 Evolution',
  })
})

test('formatacao de CPF, placa e caixa nao cria conflito falso', () => {
  const plan = planExtractedQuoteClientSync({
    nome_cliente: 'LUCIENE TEREZA DA SILVA',
    cpf_cliente: '18300506802',
    placa: 'rnb-0b53',
  }, extracted)
  assert.equal(plan.conflicts.some(item => ['nome_cliente', 'cpf_cliente', 'placa'].includes(item.field)), false)
})

test('usa o cliente vinculado como fonte antes de considerar o campo vazio', () => {
  const plan = planExtractedQuoteClientSync({
    clientes_auto: { nome_completo: 'Outra Pessoa', cpf: '99999999999' },
  }, extracted)
  assert.deepEqual(plan.conflicts.map(item => item.field).sort(), ['cpf_cliente', 'nome_cliente'])
})

test('separa os campos que tambem pertencem ao cadastro mestre do cliente', () => {
  assert.deepEqual(clientPatchFromQuotePatch({
    nome_cliente: 'Luciene', cpf_cliente: '123', modelo_veiculo: 'HB20',
  }), { nome_completo: 'Luciene', cpf: '123' })
})
