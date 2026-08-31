import test from 'node:test'
import assert from 'node:assert/strict'

import {
  AUTO_EMISSION_STAGES,
  PREFERENCIAS_PIPELINE_PADRAO,
  alternarColunaRecolhida,
  etapaVizinha,
  gravarPreferenciasPipeline,
  lerPreferenciasPipeline,
  resumoFinanceiroEtapa,
} from './autoPipelineBoard.js'

function comStorage(executar) {
  const memoria = new Map()
  globalThis.window = {
    localStorage: {
      getItem: chave => (memoria.has(chave) ? memoria.get(chave) : null),
      setItem: (chave, valor) => { memoria.set(chave, valor) },
      removeItem: chave => { memoria.delete(chave) },
    },
  }
  try {
    return executar(memoria)
  } finally {
    delete globalThis.window
  }
}

// ─── navegacao entre etapas ──────────────────────────────────────────────

test('avanca e volta uma etapa na ordem real do funil', () => {
  assert.equal(etapaVizinha('pendentes', 1), 'cotacao_feita')
  assert.equal(etapaVizinha('cotacao_feita', 1), 'negociando')
  assert.equal(etapaVizinha('proposta_transmitida', 1), 'apolice_emitida')
  assert.equal(etapaVizinha('negociando', -1), 'cotacao_feita')
})

test('as pontas do funil nao tem vizinha', () => {
  assert.equal(etapaVizinha('pendentes', -1), null)
  assert.equal(etapaVizinha('apolice_emitida', 1), null)
})

test('coluna virtual de renovacao nao entra na navegacao de etapas', () => {
  assert.equal(AUTO_EMISSION_STAGES.includes('renovacoes'), false)
  assert.equal(etapaVizinha('renovacoes', 1), null)
  assert.equal(etapaVizinha('renovacoes_para_enviar', -1), null)
  assert.equal(etapaVizinha(undefined, 1), null)
})

// ─── resumo financeiro ───────────────────────────────────────────────────

test('soma premio e comissao dos cards da coluna', () => {
  const cards = [
    { premio_liquido: 1200.5, valor_comissao: 240.1 },
    { premio_liquido: 800, valor_comissao: 160 },
  ]
  const resumo = resumoFinanceiroEtapa(cards, card => ({ premio: card.premio_liquido, comissao: card.valor_comissao }))
  assert.equal(resumo.total, 2)
  assert.equal(Math.round(resumo.premio * 100) / 100, 2000.5)
  assert.equal(Math.round(resumo.comissao * 100) / 100, 400.1)
})

test('valor ausente ou invalido conta zero em vez de virar NaN no cabecalho', () => {
  const resumo = resumoFinanceiroEtapa(
    [{}, { premio_liquido: 'abc' }, { premio_liquido: null }, { premio_liquido: 500 }],
    card => ({ premio: card.premio_liquido, comissao: card.valor_comissao }),
  )
  assert.equal(resumo.total, 4)
  assert.equal(resumo.premio, 500)
  assert.equal(resumo.comissao, 0)
})

test('coluna vazia devolve zeros', () => {
  assert.deepEqual(resumoFinanceiroEtapa(), { total: 0, premio: 0, comissao: 0 })
})

// ─── colunas recolhidas ──────────────────────────────────────────────────

test('recolhe e expande a mesma coluna', () => {
  const recolhidas = alternarColunaRecolhida([], 'negociando')
  assert.deepEqual(recolhidas, ['negociando'])
  assert.deepEqual(alternarColunaRecolhida(recolhidas, 'negociando'), [])
})

test('nunca recolhe a ultima coluna visivel', () => {
  const quaseTudo = ['pendentes', 'cotacao_feita']
  // Com 3 colunas no total, recolher a terceira deixaria o quadro vazio.
  assert.deepEqual(alternarColunaRecolhida(quaseTudo, 'negociando', 3), quaseTudo)
  // Com 6, ainda sobram colunas abertas.
  assert.deepEqual(alternarColunaRecolhida(quaseTudo, 'negociando', 6), [...quaseTudo, 'negociando'])
})

test('nao duplica uma coluna ja recolhida', () => {
  assert.deepEqual(alternarColunaRecolhida(['negociando', 'negociando'], 'pendentes', 6), ['negociando', 'pendentes'])
})

// ─── preferencias ────────────────────────────────────────────────────────

test('grava e le a densidade e as colunas recolhidas', () => {
  comStorage(() => {
    assert.equal(gravarPreferenciasPipeline({ densidade: 'compact', recolhidas: ['negociando'] }), true)
    assert.deepEqual(lerPreferenciasPipeline(), { densidade: 'compact', recolhidas: ['negociando'] })
  })
})

test('preferencia corrompida cai no padrao em vez de quebrar o quadro', () => {
  comStorage(memoria => {
    memoria.set('conves:auto:pipeline-preferencias', '{isso nao e json')
    assert.deepEqual(lerPreferenciasPipeline(), PREFERENCIAS_PIPELINE_PADRAO)
  })
})

test('densidade desconhecida e lista invalida sao normalizadas na leitura', () => {
  comStorage(memoria => {
    memoria.set('conves:auto:pipeline-preferencias', JSON.stringify({ densidade: 'gigante', recolhidas: 'negociando' }))
    assert.deepEqual(lerPreferenciasPipeline(), { densidade: 'comfortable', recolhidas: [] })
  })
})

test('sem storage o quadro abre no padrao e nao lanca', () => {
  assert.deepEqual(lerPreferenciasPipeline(), PREFERENCIAS_PIPELINE_PADRAO)
  assert.equal(gravarPreferenciasPipeline({ densidade: 'compact' }), false)
})
