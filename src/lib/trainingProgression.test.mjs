import test from 'node:test'
import assert from 'node:assert/strict'
import {
  QUIZ_PASSING_SCORE_PCT,
  sortNodesByOrdem,
  getChildrenByType,
  buildProgressMap,
  getNodeProgressStatus,
  isLicaoUnlocked,
  isModuloUnlocked,
  getModuloQuizNode,
  getSetorQuizNode,
  isModuloConcluded,
  isSetorQuizUnlocked,
  getSetorProgressPct,
  getNextRecommendedNode,
  gradeQuiz,
  getActiveQuizQuestions,
} from './trainingProgression.js'

// Fixture: 1 produto, 2 setores (A com 2 módulos, B com 1 módulo), cada módulo
// com 2 lições reais + 1 quiz de módulo sintético, cada setor com 1 quiz final.
const PRODUTO = { id: 'produto-1', tipo: 'produto', parent_id: null, produto: 'seguro_fianca', ordem: 0 }

const SETOR_A = { id: 'setor-a', tipo: 'setor', parent_id: 'produto-1', ordem: 1 }
const SETOR_B = { id: 'setor-b', tipo: 'setor', parent_id: 'produto-1', ordem: 2 }

const MOD_A1 = { id: 'mod-a1', tipo: 'modulo', parent_id: 'setor-a', ordem: 1 }
const MOD_A2 = { id: 'mod-a2', tipo: 'modulo', parent_id: 'setor-a', ordem: 2 }
const MOD_B1 = { id: 'mod-b1', tipo: 'modulo', parent_id: 'setor-b', ordem: 1 }

const LIC_A1_1 = { id: 'lic-a1-1', tipo: 'licao', parent_id: 'mod-a1', ordem: 1, eh_quiz_modulo: false, eh_quiz_final_setor: false }
const LIC_A1_2 = { id: 'lic-a1-2', tipo: 'licao', parent_id: 'mod-a1', ordem: 2, eh_quiz_modulo: false, eh_quiz_final_setor: false }
const QUIZ_A1 = { id: 'quiz-a1', tipo: 'licao', parent_id: 'mod-a1', ordem: 3, eh_quiz_modulo: true, eh_quiz_final_setor: false }

const LIC_A2_1 = { id: 'lic-a2-1', tipo: 'licao', parent_id: 'mod-a2', ordem: 1, eh_quiz_modulo: false, eh_quiz_final_setor: false }
const QUIZ_A2 = { id: 'quiz-a2', tipo: 'licao', parent_id: 'mod-a2', ordem: 2, eh_quiz_modulo: true, eh_quiz_final_setor: false }

const QUIZ_SETOR_A = { id: 'quiz-setor-a', tipo: 'licao', parent_id: 'setor-a', ordem: 3, eh_quiz_modulo: false, eh_quiz_final_setor: true }

const LIC_B1_1 = { id: 'lic-b1-1', tipo: 'licao', parent_id: 'mod-b1', ordem: 1, eh_quiz_modulo: false, eh_quiz_final_setor: false }
const QUIZ_B1 = { id: 'quiz-b1', tipo: 'licao', parent_id: 'mod-b1', ordem: 2, eh_quiz_modulo: true, eh_quiz_final_setor: false }
const QUIZ_SETOR_B = { id: 'quiz-setor-b', tipo: 'licao', parent_id: 'setor-b', ordem: 2, eh_quiz_modulo: false, eh_quiz_final_setor: true }

const ALL_NODES = [
  PRODUTO, SETOR_A, SETOR_B,
  MOD_A1, MOD_A2, MOD_B1,
  LIC_A1_1, LIC_A1_2, QUIZ_A1,
  LIC_A2_1, QUIZ_A2,
  QUIZ_SETOR_A,
  LIC_B1_1, QUIZ_B1,
  QUIZ_SETOR_B,
]

function progress(rows) {
  return buildProgressMap(rows.map(([node_id, status]) => ({ node_id, status })))
}

test('sortNodesByOrdem ordena por ordem, sem mutar o array original', () => {
  const input = [{ id: 'b', ordem: 2 }, { id: 'a', ordem: 1 }]
  const sorted = sortNodesByOrdem(input)
  assert.deepEqual(sorted.map(n => n.id), ['a', 'b'])
  assert.equal(input[0].id, 'b') // original não mutado
})

test('getChildrenByType filtra por parent_id e tipo, ordenado', () => {
  const licoes = getChildrenByType(ALL_NODES, 'mod-a1', 'licao')
  assert.deepEqual(licoes.map(l => l.id), ['lic-a1-1', 'lic-a1-2', 'quiz-a1'])
})

test('getNodeProgressStatus retorna nao_iniciado como default', () => {
  const map = progress([])
  assert.equal(getNodeProgressStatus('lic-a1-1', map), 'nao_iniciado')
})

// ---- Lição sequencial dentro do módulo -------------------------------------

test('isLicaoUnlocked: primeira lição do módulo está sempre desbloqueada', () => {
  const map = progress([])
  const siblingLicoes = getChildrenByType(ALL_NODES, 'mod-a1', 'licao')
  assert.equal(isLicaoUnlocked({ licao: LIC_A1_1, siblingLicoes, progressMap: map }), true)
})

test('isLicaoUnlocked: segunda lição trancada até a primeira ser concluída', () => {
  const siblingLicoes = getChildrenByType(ALL_NODES, 'mod-a1', 'licao')
  const semProgresso = progress([])
  assert.equal(isLicaoUnlocked({ licao: LIC_A1_2, siblingLicoes, progressMap: semProgresso }), false)

  const comPrimeiraConcluida = progress([['lic-a1-1', 'concluido']])
  assert.equal(isLicaoUnlocked({ licao: LIC_A1_2, siblingLicoes, progressMap: comPrimeiraConcluida }), true)
})

test('isLicaoUnlocked: o quiz de módulo (último irmão) segue a mesma regra sequencial, sem caso especial', () => {
  const siblingLicoes = getChildrenByType(ALL_NODES, 'mod-a1', 'licao')
  const so1Concluida = progress([['lic-a1-1', 'concluido']])
  assert.equal(isLicaoUnlocked({ licao: QUIZ_A1, siblingLicoes, progressMap: so1Concluida }), false)

  const ambasConcluidas = progress([['lic-a1-1', 'concluido'], ['lic-a1-2', 'concluido']])
  assert.equal(isLicaoUnlocked({ licao: QUIZ_A1, siblingLicoes, progressMap: ambasConcluidas }), true)
})

// ---- Módulo sequencial dentro do setor -------------------------------------

test('isModuloUnlocked: primeiro módulo do setor está sempre desbloqueado', () => {
  const siblingModulos = getChildrenByType(ALL_NODES, 'setor-a', 'modulo')
  const map = progress([])
  assert.equal(isModuloUnlocked({ modulo: MOD_A1, siblingModulos, nodes: ALL_NODES, progressMap: map }), true)
})

test('isModuloUnlocked: módulo 2 continua trancado mesmo com todas as lições do módulo 1 concluídas, se o QUIZ do módulo 1 não foi', () => {
  const siblingModulos = getChildrenByType(ALL_NODES, 'setor-a', 'modulo')
  const licoesConcluidasSemQuiz = progress([
    ['lic-a1-1', 'concluido'],
    ['lic-a1-2', 'concluido'],
    // quiz-a1 NÃO concluído
  ])
  assert.equal(
    isModuloUnlocked({ modulo: MOD_A2, siblingModulos, nodes: ALL_NODES, progressMap: licoesConcluidasSemQuiz }),
    false,
    'módulo 2 deveria continuar trancado sem o quiz do módulo 1'
  )

  const comQuizConcluido = progress([
    ['lic-a1-1', 'concluido'],
    ['lic-a1-2', 'concluido'],
    ['quiz-a1', 'concluido'],
  ])
  assert.equal(
    isModuloUnlocked({ modulo: MOD_A2, siblingModulos, nodes: ALL_NODES, progressMap: comQuizConcluido }),
    true
  )
})

test('isModuloUnlocked: setor B não tem trava cruzada com o setor A (módulo 1 de B sempre desbloqueado, independente do progresso em A)', () => {
  const siblingModulosB = getChildrenByType(ALL_NODES, 'setor-b', 'modulo')
  const semNenhumProgresso = progress([])
  assert.equal(isModuloUnlocked({ modulo: MOD_B1, siblingModulos: siblingModulosB, nodes: ALL_NODES, progressMap: semNenhumProgresso }), true)
})

// ---- Lookup de nós de quiz --------------------------------------------------

test('getModuloQuizNode / getSetorQuizNode: lookup correto', () => {
  assert.equal(getModuloQuizNode(ALL_NODES, 'mod-a1').id, 'quiz-a1')
  assert.equal(getSetorQuizNode(ALL_NODES, 'setor-a').id, 'quiz-setor-a')
})

test('getModuloQuizNode / getSetorQuizNode: retornam undefined (sem lançar) quando não há quiz semeado', () => {
  const nodesSemQuiz = ALL_NODES.filter(n => !n.eh_quiz_modulo && !n.eh_quiz_final_setor)
  assert.equal(getModuloQuizNode(nodesSemQuiz, 'mod-a1'), undefined)
  assert.equal(getSetorQuizNode(nodesSemQuiz, 'setor-a'), undefined)
})

// ---- Quiz final de setor ----------------------------------------------------

test('isSetorQuizUnlocked: depende só do ÚLTIMO módulo do setor, não do primeiro', () => {
  const map = progress([
    // módulo 1 (mod-a1) completo, módulo 2 (mod-a2, o último) NÃO
    ['lic-a1-1', 'concluido'], ['lic-a1-2', 'concluido'], ['quiz-a1', 'concluido'],
  ])
  assert.equal(isSetorQuizUnlocked({ nodes: ALL_NODES, setorId: 'setor-a', progressMap: map }), false)

  const mapCompleto = progress([
    ['lic-a1-1', 'concluido'], ['lic-a1-2', 'concluido'], ['quiz-a1', 'concluido'],
    ['lic-a2-1', 'concluido'], ['quiz-a2', 'concluido'],
  ])
  assert.equal(isSetorQuizUnlocked({ nodes: ALL_NODES, setorId: 'setor-a', progressMap: mapCompleto }), true)
})

// ---- Agregados ---------------------------------------------------------------

test('getSetorProgressPct: 0%, parcial e 100%, sem dividir por zero em setor sem módulos', () => {
  assert.equal(getSetorProgressPct({ nodes: ALL_NODES, setorId: 'setor-a', progressMap: progress([]) }), 0)

  const umModuloConcluido = progress([['lic-a1-1', 'concluido'], ['lic-a1-2', 'concluido'], ['quiz-a1', 'concluido']])
  assert.equal(getSetorProgressPct({ nodes: ALL_NODES, setorId: 'setor-a', progressMap: umModuloConcluido }), 50)

  const nodesSemModulos = ALL_NODES.filter(n => n.parent_id !== 'setor-b' && n.id !== 'setor-b')
  assert.equal(getSetorProgressPct({ nodes: nodesSemModulos, setorId: 'setor-vazio', progressMap: progress([]) }), 0)
})

// ---- Próximo nó recomendado --------------------------------------------------

test('getNextRecommendedNode: sem progresso, recomenda a primeira lição do primeiro setor/módulo', () => {
  const next = getNextRecommendedNode({ nodes: ALL_NODES, progressMap: progress([]), produto: 'seguro_fianca' })
  assert.equal(next?.id, 'lic-a1-1')
})

test('getNextRecommendedNode: cruza para o setor B depois que o setor A termina inteiro (incl. quiz final)', () => {
  const setorATodoConcluido = progress([
    ['lic-a1-1', 'concluido'], ['lic-a1-2', 'concluido'], ['quiz-a1', 'concluido'],
    ['lic-a2-1', 'concluido'], ['quiz-a2', 'concluido'],
    ['quiz-setor-a', 'concluido'],
  ])
  const next = getNextRecommendedNode({ nodes: ALL_NODES, progressMap: setorATodoConcluido, produto: 'seguro_fianca' })
  assert.equal(next?.id, 'lic-b1-1')
})

test('getNextRecommendedNode: retorna null quando tudo (incl. os 2 quizzes finais de setor) está concluído', () => {
  const tudoConcluido = progress([
    ['lic-a1-1', 'concluido'], ['lic-a1-2', 'concluido'], ['quiz-a1', 'concluido'],
    ['lic-a2-1', 'concluido'], ['quiz-a2', 'concluido'],
    ['quiz-setor-a', 'concluido'],
    ['lic-b1-1', 'concluido'], ['quiz-b1', 'concluido'],
    ['quiz-setor-b', 'concluido'],
  ])
  const next = getNextRecommendedNode({ nodes: ALL_NODES, progressMap: tudoConcluido, produto: 'seguro_fianca' })
  assert.equal(next, null)
})

// ---- Correção de quiz ---------------------------------------------------------

test('gradeQuiz: no limite exato de 70% passa, 69% (arredondado) falha', () => {
  // 7/10 = 70% exatos -> passa
  const questions10 = Array.from({ length: 10 }, (_, i) => ({ id: `q${i}`, respostaCorreta: 'a' }))
  const answers7 = Object.fromEntries(questions10.slice(0, 7).map(q => [q.id, 'a']))
  const resultado70 = gradeQuiz({ questions: questions10, answers: answers7 })
  assert.equal(resultado70.scorePct, 70)
  assert.equal(resultado70.passed, true)

  // 2/3 = 66.67% arredonda para 67%, abaixo de 70 -> falha
  const questions3 = Array.from({ length: 3 }, (_, i) => ({ id: `q${i}`, respostaCorreta: 'a' }))
  const answers2 = Object.fromEntries(questions3.slice(0, 2).map(q => [q.id, 'a']))
  const resultado67 = gradeQuiz({ questions: questions3, answers: answers2 })
  assert.equal(resultado67.scorePct, 67)
  assert.equal(resultado67.passed, false)
})

test('gradeQuiz: 100% de acerto passa', () => {
  const questions = Array.from({ length: 4 }, (_, i) => ({ id: `q${i}`, respostaCorreta: 'a' }))
  const answers = Object.fromEntries(questions.map(q => [q.id, 'a']))
  const resultado = gradeQuiz({ questions, answers })
  assert.equal(resultado.scorePct, 100)
  assert.equal(resultado.passed, true)
})

test('gradeQuiz: totalCount 0 nunca "passa" por acidente — reason explícito no_questions', () => {
  const resultado = gradeQuiz({ questions: [], answers: {} })
  assert.equal(resultado.passed, false)
  assert.equal(resultado.reason, 'no_questions')
  assert.equal(resultado.scorePct, 0)
})

test('gradeQuiz: resposta ausente conta como errada, não lança', () => {
  const questions = [{ id: 'q0', respostaCorreta: 'a' }, { id: 'q1', respostaCorreta: 'b' }]
  const resultado = gradeQuiz({ questions, answers: { q0: 'a' } }) // q1 sem resposta
  assert.equal(resultado.correctCount, 1)
  assert.equal(resultado.totalCount, 2)
  assert.equal(resultado.passed, false)
})

test('QUIZ_PASSING_SCORE_PCT é 70, fonte única da regra de corte', () => {
  assert.equal(QUIZ_PASSING_SCORE_PCT, 70)
})

// ---- Curadoria de perguntas ---------------------------------------------------

test('getActiveQuizQuestions: filtra só status "ativa", ignora "sugerida" e status ausente', () => {
  const quiz = [
    { id: 'q1', status: 'ativa' },
    { id: 'q2', status: 'sugerida' },
    { id: 'q3', status: 'ativa' },
    { id: 'q4' }, // sem status — não deve vazar como ativa
  ]
  assert.deepEqual(getActiveQuizQuestions(quiz).map(q => q.id), ['q1', 'q3'])
})

test('getActiveQuizQuestions: array vazio ou default retorna vazio, sem lançar', () => {
  assert.deepEqual(getActiveQuizQuestions([]), [])
  assert.deepEqual(getActiveQuizQuestions(), [])
})
