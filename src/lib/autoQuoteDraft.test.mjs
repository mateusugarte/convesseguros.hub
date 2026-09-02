import test from 'node:test'
import assert from 'node:assert/strict'

import {
  RASCUNHO_VERSAO,
  chaveRascunhoLocal,
  ehColunaAusente,
  gravarRascunhoLocal,
  lerRascunhoLocal,
  limparRascunhoLocal,
  rascunhoMaisRecente,
  rascunhoSemLeituras,
  rascunhoTemTrabalho,
  restaurarRascunho,
  serializarRascunho,
} from './autoQuoteDraft.js'

function workspace(overrides = {}) {
  return {
    step: 'review',
    sides: {
      atual: { seguradora: 'HDI', arquivo_nome: 'hdi.pdf', campos: { segurado_nome: 'Ana', franquia: '2.500,00' } },
      concorrente: { seguradora: 'Tokio Marine', arquivo_nome: 'tokio.pdf', campos: { segurado_nome: 'Ana', franquia: '3.100,00' } },
    },
    parsers: { atual: 'hdi', concorrente: 'tokio' },
    leituras: {
      atual: { suportado: true, seguradora: 'HDI', ofertas: [], cotacao: { numero: '123' } },
      concorrente: { suportado: true, seguradora: 'Tokio Marine', ofertas: [], cotacao: { numero: '456' } },
    },
    ...overrides,
  }
}

// ─── serializacao ────────────────────────────────────────────────────────

test('serializa os dois lados com campos, parser e cotacao extraida', () => {
  const rascunho = serializarRascunho(workspace())

  assert.equal(rascunho.versao, RASCUNHO_VERSAO)
  assert.equal(rascunho.step, 'review')
  assert.equal(rascunho.lados.atual.parser_id, 'hdi')
  assert.equal(rascunho.lados.atual.arquivo_nome, 'hdi.pdf')
  assert.equal(rascunho.lados.concorrente.campos.franquia, '3.100,00')
  assert.equal(rascunho.lados.concorrente.leitura.cotacao.numero, '456')
  assert.ok(rascunho.salvo_em)
})

test('serializacao nunca perde um lado, mesmo com workspace vazio', () => {
  const rascunho = serializarRascunho({})
  assert.deepEqual(Object.keys(rascunho.lados), ['atual', 'concorrente'])
  assert.equal(rascunho.step, 'upload')
  assert.equal(rascunho.lados.atual.leitura, null)
})

test('preserva opções adicionais escolhidas pelo corretor', () => {
  const extra = { seguradora: 'Porto Seguro', arquivo_nome: 'porto.pdf', campos: { premio_total: 2500 } }
  const rascunho = serializarRascunho({
    ...workspace(),
    roles: ['atual', 'concorrente', 'opcao_3'],
    sides: { ...workspace().sides, opcao_3: extra },
    parsers: { ...workspace().parsers, opcao_3: 'porto' },
    leituras: { ...workspace().leituras, opcao_3: { suportado: true, cotacao: { numero: '789' } } },
  })
  const restaurado = restaurarRascunho(rascunho, { baseSides: workspace().sides })

  assert.deepEqual(restaurado.roles, ['atual', 'concorrente', 'opcao_3'])
  assert.equal(restaurado.sides.opcao_3.seguradora, 'Porto Seguro')
  assert.equal(restaurado.parsers.opcao_3, 'porto')
  assert.equal(restaurado.leituras.opcao_3.cotacao.numero, '789')
})

test('step invalido cai para upload em vez de gravar lixo', () => {
  assert.equal(serializarRascunho({ step: 'qualquer' }).step, 'upload')
})

// ─── trabalho humano ─────────────────────────────────────────────────────

test('rascunho semeado so pelo cadastro nao conta como trabalho', () => {
  const rascunho = serializarRascunho({
    sides: { atual: { seguradora: '', campos: { segurado_nome: 'Ana' } }, concorrente: { campos: {} } },
    parsers: { atual: '', concorrente: '' },
    leituras: { atual: null, concorrente: null },
  })
  assert.equal(rascunhoTemTrabalho(rascunho), false)
})

test('escolher a seguradora do PDF ja conta como trabalho a preservar', () => {
  const rascunho = serializarRascunho({ parsers: { atual: 'hdi' } })
  assert.equal(rascunhoTemTrabalho(rascunho), true)
})

test('rascunho nulo ou sem lados nao tem trabalho', () => {
  assert.equal(rascunhoTemTrabalho(null), false)
  assert.equal(rascunhoTemTrabalho({}), false)
})

// ─── restauracao ─────────────────────────────────────────────────────────

test('restaura campos por cima do estado semeado pela cotacao', () => {
  const baseSides = {
    atual: { seguradora: '', arquivo_nome: '', campos: { segurado_nome: 'Cadastro', veiculo_placa: 'ABC1D23', campo_novo: '' } },
    concorrente: { seguradora: '', arquivo_nome: '', campos: { segurado_nome: 'Cadastro', veiculo_placa: 'ABC1D23', campo_novo: '' } },
  }
  const restaurado = restaurarRascunho(serializarRascunho(workspace()), { baseSides })

  assert.equal(restaurado.step, 'review')
  assert.equal(restaurado.sides.atual.campos.segurado_nome, 'Ana')
  // O que o rascunho nao tinha continua vindo do cadastro.
  assert.equal(restaurado.sides.atual.campos.veiculo_placa, 'ABC1D23')
  // Uma chave nova de REVIEW_FIELDS nao volta como undefined.
  assert.equal(restaurado.sides.atual.campos.campo_novo, '')
  assert.equal(restaurado.parsers.concorrente, 'tokio')
  assert.equal(restaurado.leituras.atual.cotacao.numero, '123')
})

test('leitura sem cotacao extraida volta como ausente, nao como objeto vazio', () => {
  const rascunho = serializarRascunho(workspace({
    leituras: { atual: { suportado: false, motivo: 'PDF rasterizado' }, concorrente: null },
  }))
  const restaurado = restaurarRascunho(rascunho, { baseSides: {} })
  assert.equal(restaurado.leituras.atual, null)
  assert.equal(restaurado.leituras.concorrente, null)
})

test('rascunho de versao diferente e descartado em vez de restaurado torto', () => {
  const antigo = { ...serializarRascunho(workspace()), versao: 0 }
  assert.equal(restaurarRascunho(antigo, {}), null)
  assert.equal(restaurarRascunho(null, {}), null)
  assert.equal(restaurarRascunho({ versao: RASCUNHO_VERSAO }, {}), null)
})

test('guarda o orcamento ja gravado para nao queimar um segundo numero CV', () => {
  const comOrcamento = serializarRascunho(workspace({ orcamento: { id: 'orc-1', referencia: 'CV-2026-0042' } }))
  assert.deepEqual(comOrcamento.orcamento, { id: 'orc-1', referencia: 'CV-2026-0042' })
  assert.deepEqual(restaurarRascunho(comOrcamento, {}).orcamento, { id: 'orc-1', referencia: 'CV-2026-0042' })

  // Sem id nao ha linha em auto_orcamentos para atualizar depois.
  assert.equal(serializarRascunho(workspace()).orcamento, null)
  assert.equal(serializarRascunho(workspace({ orcamento: { referencia: 'CV-2026-0043' } })).orcamento, null)
})

test('ida e volta preserva o que o operador revisou', () => {
  const original = workspace()
  const restaurado = restaurarRascunho(serializarRascunho(original), { baseSides: original.sides })
  assert.deepEqual(restaurado.sides.atual.campos, original.sides.atual.campos)
  assert.deepEqual(restaurado.parsers, original.parsers)
})

// ─── volume ──────────────────────────────────────────────────────────────

test('rascunhoSemLeituras larga o texto do PDF e mantem a revisao', () => {
  const enxuto = rascunhoSemLeituras(serializarRascunho(workspace()))
  assert.equal(enxuto.lados.atual.leitura, null)
  assert.equal(enxuto.lados.atual.campos.franquia, '2.500,00')
  assert.equal(enxuto.lados.concorrente.parser_id, 'tokio')
})

// ─── conflito local x servidor ───────────────────────────────────────────

test('entre local e servidor vence o rascunho mais recente', () => {
  const antigo = { lados: {}, salvo_em: '2026-08-30T10:00:00.000Z' }
  const novo = { lados: {}, salvo_em: '2026-08-31T10:00:00.000Z' }
  assert.equal(rascunhoMaisRecente(antigo, novo), novo)
  assert.equal(rascunhoMaisRecente(novo, antigo), novo)
  assert.equal(rascunhoMaisRecente(null, antigo), antigo)
  assert.equal(rascunhoMaisRecente(null, undefined), null)
})

// ─── storage ─────────────────────────────────────────────────────────────

test('grava, le e limpa o rascunho local', () => {
  const memoria = new Map()
  globalThis.window = {
    localStorage: {
      getItem: chave => (memoria.has(chave) ? memoria.get(chave) : null),
      setItem: (chave, valor) => { memoria.set(chave, valor) },
      removeItem: chave => { memoria.delete(chave) },
    },
  }
  try {
    const rascunho = serializarRascunho(workspace())
    assert.equal(gravarRascunhoLocal('cot-1', rascunho), true)
    assert.equal(memoria.has(chaveRascunhoLocal('cot-1')), true)
    assert.equal(lerRascunhoLocal('cot-1').lados.atual.parser_id, 'hdi')
    limparRascunhoLocal('cot-1')
    assert.equal(lerRascunhoLocal('cot-1'), null)
  } finally {
    delete globalThis.window
  }
})

test('cota estourada regrava sem as leituras em vez de perder tudo', () => {
  const memoria = new Map()
  let primeiraTentativa = true
  globalThis.window = {
    localStorage: {
      getItem: chave => (memoria.has(chave) ? memoria.get(chave) : null),
      setItem: (chave, valor) => {
        if (primeiraTentativa) {
          primeiraTentativa = false
          throw new Error('QuotaExceededError')
        }
        memoria.set(chave, valor)
      },
      removeItem: chave => { memoria.delete(chave) },
    },
  }
  try {
    assert.equal(gravarRascunhoLocal('cot-2', serializarRascunho(workspace())), true)
    const salvo = lerRascunhoLocal('cot-2')
    assert.equal(salvo.lados.atual.leitura, null)
    assert.equal(salvo.lados.atual.campos.franquia, '2.500,00')
  } finally {
    delete globalThis.window
  }
})

test('storage indisponivel nao derruba a tela', () => {
  globalThis.window = {
    get localStorage() { throw new Error('acesso negado pela politica do navegador') },
  }
  try {
    assert.equal(lerRascunhoLocal('cot-3'), null)
    assert.equal(gravarRascunhoLocal('cot-3', serializarRascunho(workspace())), false)
    assert.doesNotThrow(() => limparRascunhoLocal('cot-3'))
  } finally {
    delete globalThis.window
  }
})

test('sem window (SSR/testes) o modulo continua inerte', () => {
  assert.equal(lerRascunhoLocal('cot-4'), null)
  assert.equal(gravarRascunhoLocal('cot-4', {}), false)
})

// ─── migration ainda nao rodada ──────────────────────────────────────────

test('reconhece a coluna ausente antes da migration 72', () => {
  assert.equal(ehColunaAusente({ message: "Could not find the 'orcamento_rascunho' column of 'cotacoes_auto' in the schema cache" }), true)
  assert.equal(ehColunaAusente({ message: 'column cotacoes_auto.orcamento_rascunho does not exist' }), true)
})

test('erro real de gravacao nao e confundido com coluna ausente', () => {
  assert.equal(ehColunaAusente({ message: 'new row violates row-level security policy' }), false)
  assert.equal(ehColunaAusente({ message: 'Could not find the \'outra_coluna\' column' }), false)
  assert.equal(ehColunaAusente(null), false)
})
