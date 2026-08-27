import test from 'node:test'
import assert from 'node:assert/strict'
import { ehRotaInterna, resolverRetorno, rotaAtual } from './navegacaoRetorno.js'

test('a origem declarada em state.from vence o historico', () => {
  const plano = resolverRetorno({ from: '/auto', historyIndex: 5, fallback: '/auto/cotacoes' })
  assert.deepEqual(plano, { modo: 'rota', destino: '/auto' })
})

test('preserva a query string da origem declarada', () => {
  const plano = resolverRetorno({ from: '/auto/gestao?mes=2026-08', historyIndex: 0, fallback: '/auto/emissoes' })
  assert.equal(plano.destino, '/auto/gestao?mes=2026-08')
})

test('REGRESSAO: sem state.from, recua no historico em vez de ir para a lista fixa', () => {
  // O caso reclamado: abrir a cotacao pela Visao Geral e ser jogado em
  // /auto/cotacoes, uma tela onde o usuario nunca esteve.
  const plano = resolverRetorno({ historyIndex: 3, fallback: '/auto/cotacoes' })
  assert.deepEqual(plano, { modo: 'historico', destino: -1 })
})

test('na primeira entrada do historico usa o destino fixo', () => {
  // idx 0 e link colado, aba nova ou F5 na propria tela de detalhe: recuar
  // levaria o usuario para fora do sistema.
  const plano = resolverRetorno({ historyIndex: 0, fallback: '/auto/cotacoes' })
  assert.deepEqual(plano, { modo: 'fallback', destino: '/auto/cotacoes' })
})

test('historico ausente ou nao numerico cai no destino fixo', () => {
  for (const historyIndex of [undefined, null, NaN, '2', 1.5]) {
    assert.equal(resolverRetorno({ historyIndex, fallback: '/auto' }).modo, 'fallback')
  }
})

test('REGRESSAO: origem apontando para fora do sistema e ignorada', () => {
  // Sem a guarda, `//evil.com` vira endereco absoluto no navegador e o "Voltar"
  // tira o usuario do sistema.
  for (const from of ['//evil.com', 'https://evil.com', 'javascript:alert(1)', 'auto/cotacoes', '', '   ']) {
    assert.equal(resolverRetorno({ from, historyIndex: 0, fallback: '/auto' }).destino, '/auto')
  }
})

test('origem que nao e string nao quebra a decisao', () => {
  for (const from of [null, undefined, 42, {}, ['/auto']]) {
    assert.equal(resolverRetorno({ from, historyIndex: 0, fallback: '/auto' }).modo, 'fallback')
  }
})

test('ehRotaInterna aceita so caminho com uma barra', () => {
  assert.equal(ehRotaInterna('/auto/cotacoes/1'), true)
  assert.equal(ehRotaInterna(' /auto '), true)
  assert.equal(ehRotaInterna('//auto'), false)
  assert.equal(ehRotaInterna('http://x/auto'), false)
})

test('rotaAtual junta caminho, query e hash', () => {
  assert.equal(rotaAtual({ pathname: '/auto/gestao', search: '?mes=2026-08', hash: '#kanban' }), '/auto/gestao?mes=2026-08#kanban')
  assert.equal(rotaAtual({ pathname: '/auto' }), '/auto')
  assert.equal(rotaAtual(), '/')
})
