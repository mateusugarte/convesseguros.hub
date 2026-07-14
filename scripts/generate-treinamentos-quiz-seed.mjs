// Gera supabase/53_treinamentos_quiz_perguntas.sql a partir de docs/TREINAMENTOS_QUIZ_PERGUNTAS.md.
//
// Uso: node scripts/generate-treinamentos-quiz-seed.mjs > supabase/53_treinamentos_quiz_perguntas.sql
//
// Não toca o Supabase — só lê o markdown local e escreve um .sql local. Recalcula os
// mesmos IDs determinísticos (UUIDv5 do caminho de slug) já usados em
// scripts/generate-treinamentos-seed.mjs para os nós de quiz (`.../__quiz_modulo__` e
// `.../__quiz_final_setor__`), então não precisa consultar o Supabase para achar o ID
// certo — só substitui `conteudo.quiz` desses nós via UPDATE + jsonb_set.
//
// Todas as perguntas entram com status "sugerida": nenhuma fica visível para
// funcionários até um admin ativá-la na tela de curadoria (`/treinamentos/admin`).

import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SOURCE_MD = path.join(ROOT, 'docs', 'TREINAMENTOS_QUIZ_PERGUNTAS.md')
const PRODUTO = 'seguro_fianca'

// ---------------------------------------------------------------------------
// UUIDv5 determinístico (RFC 4122) — idêntico a generate-treinamentos-seed.mjs.
// ---------------------------------------------------------------------------
const DNS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

function uuidToBytes(uuid) {
  const hex = uuid.replace(/-/g, '')
  const bytes = Buffer.alloc(16)
  for (let i = 0; i < 16; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  return bytes
}

function uuidv5(name, namespace = DNS_NAMESPACE) {
  const nsBytes = uuidToBytes(namespace)
  const nameBytes = Buffer.from(name, 'utf8')
  const hash = createHash('sha1').update(Buffer.concat([nsBytes, nameBytes])).digest()
  const bytes = Buffer.from(hash.subarray(0, 16))
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function slugify(text) {
  return String(text || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function nodeId(slugPath) {
  return uuidv5(slugPath)
}

function quizModuloNodeId(setorTitulo, moduloTitulo) {
  const slugPath = `${PRODUTO}/${slugify(setorTitulo)}/${slugify(moduloTitulo)}/__quiz_modulo__`
  return nodeId(slugPath)
}

function quizSetorNodeId(setorTitulo) {
  const slugPath = `${PRODUTO}/${slugify(setorTitulo)}/__quiz_final_setor__`
  return nodeId(slugPath)
}

// ---------------------------------------------------------------------------
// Parser do markdown de perguntas
// ---------------------------------------------------------------------------

function parseQuizMarkdown(md) {
  const lines = md.split('\n')
  // blocks: array de { targetKey, setorTitulo, moduloTitulo|null, questions: [] }
  const blocks = []
  let curBlock = null
  let curQuestion = null
  let i = 0

  function flushQuestion() {
    if (curQuestion && curBlock) curBlock.questions.push(curQuestion)
    curQuestion = null
  }

  while (i < lines.length) {
    const line = lines[i]

    const moduloHeading = line.match(/^## QUIZ MÓDULO — (.+?) > (.+)$/)
    if (moduloHeading) {
      flushQuestion()
      curBlock = { kind: 'modulo', setorTitulo: moduloHeading[1].trim(), moduloTitulo: moduloHeading[2].trim(), questions: [] }
      blocks.push(curBlock)
      i++
      continue
    }

    const setorHeading = line.match(/^## QUIZ FINAL DE SETOR — (.+)$/)
    if (setorHeading) {
      flushQuestion()
      curBlock = { kind: 'setor', setorTitulo: setorHeading[1].trim(), moduloTitulo: null, questions: [] }
      blocks.push(curBlock)
      i++
      continue
    }

    if (/^## /.test(line)) {
      // Outra seção de nível 2 fora da grammar de quiz (ex.: cabeçalho/tabela de resumo) — ignora.
      flushQuestion()
      curBlock = null
      i++
      continue
    }

    const questionHeading = line.match(/^### Q\d+$/)
    if (questionHeading && curBlock) {
      flushQuestion()
      curQuestion = { pergunta: null, opcoes: [], respostaCorreta: null }
      i++
      continue
    }

    if (curQuestion) {
      const perguntaMatch = line.match(/^\*\*Pergunta:\*\*\s*(.+)$/)
      if (perguntaMatch) { curQuestion.pergunta = perguntaMatch[1].trim(); i++; continue }

      const altMatch = line.match(/^-\s+([a-d])\)\s*(.+)$/)
      if (altMatch) { curQuestion.opcoes.push({ id: altMatch[1], texto: altMatch[2].trim() }); i++; continue }

      const corretaMatch = line.match(/^\*\*Correta:\*\*\s*([a-d])$/)
      if (corretaMatch) { curQuestion.respostaCorreta = corretaMatch[1]; i++; continue }
    }

    i++
  }
  flushQuestion()

  return blocks.filter(b => b.questions.length > 0)
}

// ---------------------------------------------------------------------------
// Geração de SQL
// ---------------------------------------------------------------------------

const DOLLAR_TAG = '$conves_tr_quiz$'

function sqlDollarJson(value) {
  return `${DOLLAR_TAG}${JSON.stringify(value)}${DOLLAR_TAG}`
}

function buildQuizArray(questions) {
  return questions.map((q, idx) => {
    if (q.opcoes.length !== 4) {
      throw new Error(`Pergunta "${q.pergunta}" tem ${q.opcoes.length} alternativas (esperado 4)`)
    }
    if (!q.respostaCorreta || !q.opcoes.some(o => o.id === q.respostaCorreta)) {
      throw new Error(`Pergunta "${q.pergunta}" sem resposta correta válida`)
    }
    return {
      id: `q${idx + 1}`,
      pergunta: q.pergunta,
      opcoes: q.opcoes,
      respostaCorreta: q.respostaCorreta,
      status: 'sugerida',
    }
  })
}

function generateSql(blocks) {
  const out = []
  out.push('-- Gerado por scripts/generate-treinamentos-quiz-seed.mjs a partir de docs/TREINAMENTOS_QUIZ_PERGUNTAS.md')
  out.push('-- Não roda automaticamente contra o Supabase — revisar e executar manualmente no SQL Editor.')
  out.push('-- Substitui conteudo.quiz inteiro dos nós de quiz (idempotente: rodar de novo após corrigir o .md não duplica nada).')
  out.push('')

  let totalQuestions = 0
  const seenIds = new Set()

  for (const block of blocks) {
    const id = block.kind === 'modulo'
      ? quizModuloNodeId(block.setorTitulo, block.moduloTitulo)
      : quizSetorNodeId(block.setorTitulo)

    if (seenIds.has(id)) {
      throw new Error(`ID de nó duplicado/colisão: ${block.kind} ${block.setorTitulo} > ${block.moduloTitulo || ''} (${id})`)
    }
    seenIds.add(id)

    const quiz = buildQuizArray(block.questions)
    totalQuestions += quiz.length

    const label = block.kind === 'modulo'
      ? `Quiz módulo — ${block.setorTitulo} > ${block.moduloTitulo}`
      : `Quiz final de setor — ${block.setorTitulo}`

    out.push(`-- ${label} (${quiz.length} perguntas)`)
    out.push(`UPDATE public.training_nodes SET`)
    out.push(`  conteudo = jsonb_set(conteudo, '{quiz}', ${sqlDollarJson(quiz)}::jsonb),`)
    out.push(`  updated_at = NOW()`)
    out.push(`WHERE id = '${id}';`)
    out.push('')
  }

  out.push(`-- Total: ${blocks.length} nós de quiz, ${totalQuestions} perguntas, todas com status 'sugerida'.`)
  return out.join('\n') + '\n'
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const md = readFileSync(SOURCE_MD, 'utf8')
const blocks = parseQuizMarkdown(md)
if (blocks.length !== 15) {
  process.stderr.write(`Aviso: esperados 15 blocos de quiz (9 módulo + 6 setor), encontrados ${blocks.length}.\n`)
}
const sql = generateSql(blocks)
process.stdout.write(sql)
