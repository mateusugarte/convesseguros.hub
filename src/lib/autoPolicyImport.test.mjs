import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizePolicyImportIdentity,
  normalizePolicyImportPercentage,
  policyClientCandidates,
  policyImportPipelineStage,
  policyImportRelationshipReady,
  summarizePolicyImportErrors,
  suggestPolicyVehicle,
  splitInsuredAndVehicle,
} from './autoPolicyImport.js'

test('separa segurado e veiculo quando chegam unidos por tres tracos', () => {
  assert.deepEqual(splitInsuredAndVehicle('Marcelo Almeida --- HRV'), {
    insured: 'Marcelo Almeida',
    vehicle: 'HRV',
    separated: true,
  })
})

test('remove traços finais sem inventar um veículo', () => {
  assert.deepEqual(splitInsuredAndVehicle('Maria Procópio ---'), {
    insured: 'Maria Procópio',
    vehicle: '',
    separated: true,
  })
})

test('normaliza a identidade mesmo quando o texto combinado cai na coluna de veiculo', () => {
  const row = normalizePolicyImportIdentity({ nome_cliente: '', modelo_veiculo: 'Marcelo Almeida --- HRV' })
  assert.equal(row.nome_cliente, 'Marcelo Almeida')
  assert.equal(row.modelo_veiculo, 'HRV')
})

test('preserva nome hifenizado e veiculo preenchido explicitamente', () => {
  const row = normalizePolicyImportIdentity({ nome_cliente: 'Ana-Beatriz Souza', modelo_veiculo: 'T-Cross' })
  assert.equal(row.nome_cliente, 'Ana-Beatriz Souza')
  assert.equal(row.modelo_veiculo, 'T-Cross')
})

test('sugere clientes por nome normalizado antes do vinculo', () => {
  const clients = [{ id: '1', nome_completo: 'Marcelo Almeida' }, { id: '2', nome_completo: 'Maria Almeida' }]
  assert.deepEqual(policyClientCandidates('MARCELO  ALMEIDA', clients).map(item => item.id), ['1'])
})

test('identifica o mesmo veiculo por placa ou modelo', () => {
  const client = { veiculos: [{ id: 'v1', modelo_veiculo: 'Honda HR-V', placa: 'ABC1D23' }] }
  assert.equal(suggestPolicyVehicle({ modelo_veiculo: 'HR-V' }, client)?.id, 'v1')
  assert.equal(suggestPolicyVehicle({ placa: 'abc1d23' }, client)?.id, 'v1')
})

test('permite importar sem veículo depois de confirmar o cliente', () => {
  assert.equal(policyImportRelationshipReady({ cliente_confirmado: true, modelo_veiculo: '', placa: '', veiculo_confirmado: false }), true)
})

test('exige confirmação quando algum dado de veículo foi informado', () => {
  assert.equal(policyImportRelationshipReady({ cliente_confirmado: true, modelo_veiculo: 'HR-V', veiculo_confirmado: false }), false)
  assert.equal(policyImportRelationshipReady({ cliente_confirmado: true, placa: 'ABC1D23', veiculo_confirmado: true }), true)
})

test('converte percentual numerico do Excel sem reduzir 15% para 0,15%', () => {
  assert.equal(normalizePolicyImportPercentage(0.15), '15')
  assert.equal(normalizePolicyImportPercentage('15%'), '15')
  assert.equal(normalizePolicyImportPercentage('20,5%'), '20.5')
})

test('organiza status EM EMISSÃO como proposta transmitida', () => {
  assert.equal(policyImportPipelineStage('EM EMISSÃO'), 'proposta_transmitida')
  assert.equal(policyImportPipelineStage('em emissao'), 'proposta_transmitida')
})

test('status emitido ou vazio continua contabilizado como apólice emitida', () => {
  assert.equal(policyImportPipelineStage('EMITIDA'), 'apolice_emitida')
  assert.equal(policyImportPipelineStage(''), 'apolice_emitida')
})

test('agrupa os motivos das linhas ignoradas', () => {
  assert.deepEqual(summarizePolicyImportErrors([
    { motivo: 'CPF obrigatório.' },
    { motivo: 'CPF obrigatório.' },
    { motivo: 'Vigência ausente.' },
  ]), [
    { motivo: 'CPF obrigatório.', quantidade: 2 },
    { motivo: 'Vigência ausente.', quantidade: 1 },
  ])
})
