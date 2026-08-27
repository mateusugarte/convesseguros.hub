import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildClientVerificationPairs,
  clientNameSimilarity,
  clientVerificationPairKey,
  normalizeClientVerificationName,
} from './autoClientVerification.js'

test('normaliza acentos, conectivos e pontuacao do nome', () => {
  assert.equal(normalizeClientVerificationName(' José  da Silva '), 'jose silva')
  assert.equal(normalizeClientVerificationName('JOSE-DE-SILVA'), 'jose silva')
})

test('identifica nome igual e variacoes proximas', () => {
  assert.equal(clientNameSimilarity('José da Silva', 'JOSE SILVA'), 1)
  assert.ok(clientNameSimilarity('Marcelo Almeida', 'Marcelo de Almeida') >= 0.9)
  assert.ok(clientNameSimilarity('Marcelo Almeida', 'Marcelo Ameida') >= 0.72)
  assert.ok(clientNameSimilarity('Marcelo Almeida', 'Mariana Costa') < 0.72)
})

test('chave do par independe da ordem dos clientes', () => {
  assert.equal(clientVerificationPairKey('b', 'a'), 'a:b')
  assert.equal(clientVerificationPairKey('a', 'b'), 'a:b')
})

test('monta pares candidatos e anexa decisoes existentes', () => {
  const clients = [
    { id: '1', nome_completo: 'Ana Paula Souza' },
    { id: '2', nome_completo: 'Ana P. Souza' },
    { id: '3', nome_completo: 'Carlos Lima' },
  ]
  const decisions = [{ id: 'v1', cliente_a_id: '1', cliente_b_id: '2', decisao: 'mesmo_cliente' }]
  const pairs = buildClientVerificationPairs(clients, decisions)
  assert.equal(pairs.length, 1)
  assert.equal(pairs[0].verificacao?.decisao, 'mesmo_cliente')
})

test('sempre exibe dois cadastros com o mesmo nome como um par pendente', () => {
  const pairs = buildClientVerificationPairs([
    { id: 'cliente-a', nome_completo: 'Maria das Dores Souza' },
    { id: 'cliente-b', nome_completo: 'MARIA DORES SOUZA' },
  ])
  assert.equal(pairs.length, 1)
  assert.equal(pairs[0].tipoCorrespondencia, 'nome_igual')
  assert.equal(pairs[0].verificacao, null)
})
