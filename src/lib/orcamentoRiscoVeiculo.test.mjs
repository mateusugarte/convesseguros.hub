import test from 'node:test'
import assert from 'node:assert/strict'
import { aplicarRiscoVeiculoExtraido, extrairRiscoVeiculoDoTexto } from './orcamentoRiscoVeiculo.js'

test('extrai as respostas explicitas do bloco de veiculo e risco', () => {
  const fields = extrairRiscoVeiculoDoTexto(`
    Tipo de residência Apartamento
    Veículo possui passagem por leilão Não
    Veículo está financiado Sim
    Veículo possui Kit Gás? Não
    Veículo é blindado? Sim
    Isenção de imposto Não
    Garagem na residência Sim
    Garagem no trabalho Não
    Garagem no local de estudo Sim
  `)
  assert.deepEqual(fields, {
    tipo_residencia: 'Apartamento', passagem_leilao: 'Não', financiado: 'Sim', kit_gas: 'Não',
    blindagem: 'Sim', isento_imposto: 'Não', garagem_residencia: 'Sim', garagem_trabalho: 'Não', garagem_estudo: 'Sim',
  })
})

test('entende as respostas descritivas de garagem usadas pela Suhai', () => {
  const fields = extrairRiscoVeiculoDoTexto(`
    O veículo é guardado em garagem/estacionamento fechado na residência? Sim, garagem na residência
    Veículo é guardado em garagem/estacionamento fechado quando utilizado para ir à faculdade/colégio? Utiliza para ir à faculdade/colégio, mas não guarda
    Veículo é guardado em garagem/estacionamento fechado quando utilizado para ir ao local de trabalho? Utiliza mas não guarda quando em local de trabalho/serviços externos
  `)
  assert.equal(fields.garagem_residencia, 'Sim')
  assert.equal(fields.garagem_estudo, 'Não')
  assert.equal(fields.garagem_trabalho, 'Não')
})

test('nao substitui resposta mais especifica que o parser ja encontrou', () => {
  const quote = { veiculo: { blindagem: 'Não informado pela proposta' } }
  aplicarRiscoVeiculoExtraido(quote, 'Veículo é blindado? Sim')
  assert.equal(quote.veiculo.blindagem, 'Não informado pela proposta')
})
