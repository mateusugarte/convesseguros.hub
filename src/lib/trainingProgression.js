// Lógica pura de progressão da feature TREINAMENTOS — sem import de Supabase/React,
// para ser 100% testável com `node --test` (molde: src/lib/fichaOperational.js).
//
// Modelo: training_nodes é uma árvore (produto → setor → módulo → lição), onde um
// nó de tipo 'licao' pode ser conteúdo normal, ou um quiz sintético marcado por
// eh_quiz_modulo (último irmão da lista de lições de um módulo) ou
// eh_quiz_final_setor (filho direto do setor, irmão dos módulos).

export const QUIZ_PASSING_SCORE_PCT = 70

export function sortNodesByOrdem(nodes = []) {
  return [...nodes].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
}

export function getChildrenByType(nodes = [], parentId, tipo) {
  return sortNodesByOrdem(nodes.filter(n => n.parent_id === parentId && n.tipo === tipo))
}

export function buildProgressMap(progressRows = []) {
  const map = new Map()
  for (const row of progressRows) {
    if (row?.node_id) map.set(row.node_id, row)
  }
  return map
}

export function getNodeProgressStatus(nodeId, progressMap) {
  return progressMap?.get(nodeId)?.status || 'nao_iniciado'
}

// ---------------------------------------------------------------------------
// Lição (sequencial dentro do módulo — o quiz do módulo, sendo o último irmão
// dessa mesma lista de lições, herda a regra sem caso especial).
// ---------------------------------------------------------------------------

export function isLicaoUnlocked({ licao, siblingLicoes, progressMap }) {
  const ordered = sortNodesByOrdem(siblingLicoes)
  const index = ordered.findIndex(l => l.id === licao.id)
  if (index <= 0) return true
  const previous = ordered[index - 1]
  return getNodeProgressStatus(previous.id, progressMap) === 'concluido'
}

// ---------------------------------------------------------------------------
// Módulo (sequencial dentro do setor, sem trava entre setores diferentes —
// desbloqueado quando o QUIZ DO MÓDULO ANTERIOR está concluído, não quando
// "todas as lições" do módulo anterior estão concluídas).
// ---------------------------------------------------------------------------

export function getModuloQuizNode(nodes, moduloId) {
  return nodes.find(n => n.parent_id === moduloId && n.tipo === 'licao' && n.eh_quiz_modulo === true)
}

export function getSetorQuizNode(nodes, setorId) {
  return nodes.find(n => n.parent_id === setorId && n.tipo === 'licao' && n.eh_quiz_final_setor === true)
}

export function isModuloConcluded({ modulo, nodes, progressMap }) {
  const quizNode = getModuloQuizNode(nodes, modulo.id)
  if (!quizNode) return false
  return getNodeProgressStatus(quizNode.id, progressMap) === 'concluido'
}

export function isModuloUnlocked({ modulo, siblingModulos, nodes, progressMap }) {
  const ordered = sortNodesByOrdem(siblingModulos)
  const index = ordered.findIndex(m => m.id === modulo.id)
  if (index <= 0) return true
  const previous = ordered[index - 1]
  return isModuloConcluded({ modulo: previous, nodes, progressMap })
}

// ---------------------------------------------------------------------------
// Quiz final de setor — desbloqueado quando o último módulo do setor (por
// ordem) está concluído.
// ---------------------------------------------------------------------------

export function isSetorQuizUnlocked({ nodes, setorId, progressMap }) {
  const modulos = getChildrenByType(nodes, setorId, 'modulo')
  if (modulos.length === 0) return false
  const last = modulos[modulos.length - 1]
  return isModuloConcluded({ modulo: last, nodes, progressMap })
}

// ---------------------------------------------------------------------------
// Agregados para a dashboard
// ---------------------------------------------------------------------------

export function getSetorProgressPct({ nodes, setorId, progressMap }) {
  const modulos = getChildrenByType(nodes, setorId, 'modulo')
  if (modulos.length === 0) return 0
  const concluidos = modulos.filter(modulo => isModuloConcluded({ modulo, nodes, progressMap })).length
  return Math.round((concluidos / modulos.length) * 100)
}

// Primeira lição desbloqueada e não-concluída, na ordem (setor.ordem, modulo.ordem,
// licao.ordem). Retorna null quando tudo já foi concluído.
export function getNextRecommendedNode({ nodes, progressMap, produto }) {
  const produtoNode = nodes.find(n => n.tipo === 'produto' && n.produto === produto)
  if (!produtoNode) return null

  const setores = getChildrenByType(nodes, produtoNode.id, 'setor')
  for (const setor of setores) {
    const modulos = getChildrenByType(nodes, setor.id, 'modulo')
    for (const modulo of modulos) {
      if (!isModuloUnlocked({ modulo, siblingModulos: modulos, nodes, progressMap })) continue

      const licoes = getChildrenByType(nodes, modulo.id, 'licao')
      for (const licao of licoes) {
        if (getNodeProgressStatus(licao.id, progressMap) === 'concluido') continue
        if (!isLicaoUnlocked({ licao, siblingLicoes: licoes, progressMap })) break
        return licao
      }
    }

    if (isSetorQuizUnlocked({ nodes, setorId: setor.id, progressMap })) {
      const setorQuiz = getSetorQuizNode(nodes, setor.id)
      if (setorQuiz && getNodeProgressStatus(setorQuiz.id, progressMap) !== 'concluido') {
        return setorQuiz
      }
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Curadoria de perguntas — cada pergunta em conteudo.quiz nasce com
// status 'sugerida' (gerada, não revisada) até um admin marcá-la 'ativa' na
// tela de curadoria (/treinamentos/admin). Funcionário só vê/é avaliado sobre
// perguntas ativas.
// ---------------------------------------------------------------------------

export function getActiveQuizQuestions(quiz = []) {
  return quiz.filter(q => q?.status === 'ativa')
}

// ---------------------------------------------------------------------------
// Correção de quiz — nota de corte 70%. totalCount === 0 nunca "passa" por
// acidente (nós de quiz semeados sem perguntas ainda, ver docs/TREINAMENTOS_CONTEUDO_FIANCA.md).
// ---------------------------------------------------------------------------

export function gradeQuiz({ questions = [], answers = {} } = {}) {
  const totalCount = questions.length
  if (totalCount === 0) {
    return { correctCount: 0, totalCount: 0, scorePct: 0, passed: false, reason: 'no_questions' }
  }

  const correctCount = questions.reduce((acc, question) => {
    const given = answers?.[question.id]
    return given !== undefined && given === question.respostaCorreta ? acc + 1 : acc
  }, 0)

  const scorePct = Math.round((correctCount / totalCount) * 100)
  const passed = scorePct >= QUIZ_PASSING_SCORE_PCT

  return { correctCount, totalCount, scorePct, passed }
}
