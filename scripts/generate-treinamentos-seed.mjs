// Gera supabase/52_treinamentos_seed_fianca.sql a partir de docs/TREINAMENTOS_CONTEUDO_FIANCA.md.
//
// Uso: node scripts/generate-treinamentos-seed.mjs > supabase/52_treinamentos_seed_fianca.sql
//
// Não toca o Supabase — só lê o markdown local e escreve um .sql local.
// IDs são UUIDv5 determinísticos derivados do caminho de slug de cada nó, então
// o SQL gerado é idempotente (INSERT ... ON CONFLICT (id) DO UPDATE): rodar de
// novo depois de corrigir o .md fonte não duplica nada.
//
// Nota de fidelidade: a seção "**variacoes_por_seguradora:**" só é estruturada
// em `variacoes_por_seguradora: [{rotulo, texto}]` quando a lição usa
// literalmente esse marcador em negrito. Lições que descrevem variação por
// seguradora de outra forma (ex.: lista de bullets sem o marcador formal)
// preservam o texto integralmente dentro de `conteudo_geral` — nada é
// descartado, só nem tudo vira estrutura. Rótulos combinados ("Porto / Junto")
// ou bullets sem seguradora nomeada são preservados como escritos, sem tentar
// adivinhar a qual seguradora pertencem.

import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SOURCE_MD = path.join(ROOT, 'docs', 'TREINAMENTOS_CONTEUDO_FIANCA.md')
const PRODUTO = 'seguro_fianca'
const PRODUTO_TITULO = 'Fiança'

// ---------------------------------------------------------------------------
// UUIDv5 determinístico (RFC 4122), sem dependência externa.
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
  bytes[6] = (bytes[6] & 0x0f) | 0x50 // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant RFC4122
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

// ---------------------------------------------------------------------------
// Parser do markdown
// ---------------------------------------------------------------------------

function parseLicaoBody(rawLines) {
  let i = 0
  let n = rawLines.length
  while (i < n && rawLines[i].trim() === '') i++
  while (n > i && rawLines[n - 1].trim() === '') n--
  const body = rawLines.slice(i, n)

  let idx = 0
  let tipoConteudoNota = null
  let tipoConteudo = null

  if (body[idx] && /^\*\*tipo_conteudo:\*\*/.test(body[idx])) {
    tipoConteudoNota = body[idx].replace(/^\*\*tipo_conteudo:\*\*\s*/, '').trim()
    const lower = tipoConteudoNota.toLowerCase()
    if (lower.startsWith('conceitual')) tipoConteudo = 'conceitual'
    else if (lower.startsWith('operacional')) tipoConteudo = 'operacional'
    idx++
    while (idx < body.length && body[idx].trim() === '') idx++
  }

  let variacoesStart = -1
  for (let j = idx; j < body.length; j++) {
    if (/^\*\*variacoes_por_seguradora:\*\*/.test(body[j])) { variacoesStart = j; break }
  }

  const conteudoEnd = variacoesStart === -1 ? body.length : variacoesStart
  let cgLines = body.slice(idx, conteudoEnd)
  while (cgLines.length && cgLines[0].trim() === '') cgLines.shift()
  if (cgLines.length && /^\*\*conteudo_geral:\*\*/.test(cgLines[0])) {
    cgLines[0] = cgLines[0].replace(/^\*\*conteudo_geral:\*\*\s*/, '')
  }
  while (cgLines.length && cgLines[cgLines.length - 1].trim() === '') cgLines.pop()
  const conteudoGeral = cgLines.join('\n').trim()

  let variacoes = []
  let afterVariacoesIdx = body.length
  if (variacoesStart !== -1) {
    let j = variacoesStart + 1
    while (j < body.length && body[j].trim() === '') j++
    while (j < body.length) {
      const line = body[j]
      if (line.trim() === '') { j++; continue }
      const bulletMatch = line.match(/^-\s+\*\*(.+?)\*\*:?\s*(.*)$/)
      if (bulletMatch) {
        variacoes.push({ rotulo: bulletMatch[1].trim(), texto: bulletMatch[2].trim() })
        j++
        continue
      }
      const plainBulletMatch = line.match(/^-\s+(.*)$/)
      if (plainBulletMatch) {
        variacoes.push({ rotulo: null, texto: plainBulletMatch[1].trim() })
        j++
        continue
      }
      break
    }
    afterVariacoesIdx = j
  }

  let notasLines = body.slice(afterVariacoesIdx)
  while (notasLines.length && notasLines[0].trim() === '') notasLines.shift()
  while (notasLines.length && notasLines[notasLines.length - 1].trim() === '') notasLines.pop()
  const notas = notasLines.join('\n').trim()

  return {
    tipo_conteudo: tipoConteudo,
    tipo_conteudo_nota: tipoConteudoNota,
    conteudo_geral: conteudoGeral || null,
    variacoes_por_seguradora: variacoes.length ? variacoes : null,
    notas: notas || null,
  }
}

function parseMarkdown(md) {
  const lines = md.split('\n')
  const setores = []
  let curSetor = null
  let curModulo = null
  let curLicao = null // { titulo, lines: [] }

  function flushLicao() {
    if (curLicao && curModulo) {
      curModulo.licoes.push({
        titulo: curLicao.titulo,
        ordem: curModulo.licoes.length + 1,
        ...parseLicaoBody(curLicao.lines),
      })
    }
    curLicao = null
  }

  for (const line of lines) {
    const setorMatch = line.match(/^## SETOR:\s*(.+?)(?:\s*→\s*MÓDULO:\s*(.+))?\s*$/)
    if (setorMatch) {
      flushLicao()
      curSetor = { titulo: setorMatch[1].trim(), ordem: setores.length + 1, modulos: [] }
      setores.push(curSetor)
      curModulo = null
      if (setorMatch[2]) {
        curModulo = { titulo: setorMatch[2].trim(), ordem: 1, licoes: [] }
        curSetor.modulos.push(curModulo)
      }
      continue
    }

    if (/^## (?!SETOR:)/.test(line)) {
      // Seções fora da árvore (Fontes lidas, Glossário técnico, gaps, próximos
      // passos) — encerra a coleta de conteúdo estruturado.
      flushLicao()
      curSetor = null
      curModulo = null
      continue
    }

    if (line.trim() === '---') {
      flushLicao()
      continue
    }

    const moduloMatch = line.match(/^### MÓDULO(?:\s+\d+| NOVO)? — (.+)$/)
    if (moduloMatch && curSetor) {
      flushLicao()
      curModulo = { titulo: moduloMatch[1].trim(), ordem: curSetor.modulos.length + 1, licoes: [] }
      curSetor.modulos.push(curModulo)
      continue
    }

    const licaoMatch = line.match(/^#### Lição:\s*(.+)$/)
    if (licaoMatch && curModulo) {
      flushLicao()
      curLicao = { titulo: licaoMatch[1].trim(), lines: [] }
      continue
    }

    if (curLicao) curLicao.lines.push(line)
  }
  flushLicao()

  return setores
}

// ---------------------------------------------------------------------------
// Construção da árvore de nós (com quiz sintético por módulo/setor)
// ---------------------------------------------------------------------------

function buildNodes(setores) {
  const nodes = []
  const produtoSlug = PRODUTO
  const produtoNodeId = nodeId(produtoSlug)

  nodes.push({
    id: produtoNodeId,
    parent_id: null,
    tipo: 'produto',
    titulo: PRODUTO_TITULO,
    ordem: 0,
    tipo_conteudo: null,
    tipo_conteudo_nota: null,
    conteudo: {},
    eh_quiz_modulo: false,
    eh_quiz_final_setor: false,
  })

  setores.forEach((setor, setorIdx) => {
    const setorSlugPath = `${produtoSlug}/${slugify(setor.titulo)}`
    const setorNodeId = nodeId(setorSlugPath)
    nodes.push({
      id: setorNodeId,
      parent_id: produtoNodeId,
      tipo: 'setor',
      titulo: setor.titulo,
      ordem: setorIdx + 1,
      tipo_conteudo: null,
      tipo_conteudo_nota: null,
      conteudo: {},
      eh_quiz_modulo: false,
      eh_quiz_final_setor: false,
    })

    setor.modulos.forEach((modulo, moduloIdx) => {
      const moduloSlugPath = `${setorSlugPath}/${slugify(modulo.titulo)}`
      const moduloNodeId = nodeId(moduloSlugPath)
      nodes.push({
        id: moduloNodeId,
        parent_id: setorNodeId,
        tipo: 'modulo',
        titulo: modulo.titulo,
        ordem: moduloIdx + 1,
        tipo_conteudo: null,
        tipo_conteudo_nota: null,
        conteudo: {},
        eh_quiz_modulo: false,
        eh_quiz_final_setor: false,
      })

      modulo.licoes.forEach((licao, licaoIdx) => {
        const licaoSlugPath = `${moduloSlugPath}/${slugify(licao.titulo)}`
        nodes.push({
          id: nodeId(licaoSlugPath),
          parent_id: moduloNodeId,
          tipo: 'licao',
          titulo: licao.titulo,
          ordem: licaoIdx + 1,
          tipo_conteudo: licao.tipo_conteudo,
          tipo_conteudo_nota: licao.tipo_conteudo_nota,
          conteudo: {
            conteudo_geral: licao.conteudo_geral,
            variacoes_por_seguradora: licao.variacoes_por_seguradora,
            notas: licao.notas,
          },
          eh_quiz_modulo: false,
          eh_quiz_final_setor: false,
        })
      })

      // Quiz sintético de módulo — último irmão da lista de lições.
      const quizModuloSlugPath = `${moduloSlugPath}/__quiz_modulo__`
      nodes.push({
        id: nodeId(quizModuloSlugPath),
        parent_id: moduloNodeId,
        tipo: 'licao',
        titulo: `Quiz — ${modulo.titulo}`,
        ordem: modulo.licoes.length + 1,
        tipo_conteudo: null,
        tipo_conteudo_nota: null,
        conteudo: { quiz: [] },
        eh_quiz_modulo: true,
        eh_quiz_final_setor: false,
      })
    })

    // Quiz sintético final de setor — filho direto do setor, irmão dos módulos.
    const quizSetorSlugPath = `${setorSlugPath}/__quiz_final_setor__`
    nodes.push({
      id: nodeId(quizSetorSlugPath),
      parent_id: setorNodeId,
      tipo: 'licao',
      titulo: `Quiz final — ${setor.titulo}`,
      ordem: setor.modulos.length + 1,
      tipo_conteudo: null,
      tipo_conteudo_nota: null,
      conteudo: { quiz: [] },
      eh_quiz_modulo: false,
      eh_quiz_final_setor: true,
    })
  })

  return nodes
}

// ---------------------------------------------------------------------------
// Geração de SQL
// ---------------------------------------------------------------------------

const DOLLAR_TAG = '$conves_tr$'

function sqlDollar(value) {
  if (value === null || value === undefined) return 'NULL'
  return `${DOLLAR_TAG}${value}${DOLLAR_TAG}`
}

function sqlJsonb(obj) {
  return `${DOLLAR_TAG}${JSON.stringify(obj)}${DOLLAR_TAG}::jsonb`
}

function sqlBool(value) {
  return value ? 'TRUE' : 'FALSE'
}

function sqlUuidOrNull(value) {
  return value === null || value === undefined ? 'NULL' : `'${value}'`
}

function generateSql(nodes) {
  const header = `-- ============================================================
-- CONVES SYSTEM — 52_treinamentos_seed_fianca.sql
-- GERADO AUTOMATICAMENTE por scripts/generate-treinamentos-seed.mjs
-- Fonte: docs/TREINAMENTOS_CONTEUDO_FIANCA.md — NÃO editar este arquivo à mão;
-- corrija o .md fonte e rode o gerador de novo.
--
-- ATENÇÃO: arquivo criado para REVISÃO. NÃO deve ser executado no SQL Editor
-- do Supabase sem aprovação explícita do usuário (mesma regra da migration
-- 51_treinamentos_schema.sql — precisa rodar DEPOIS dela).
--
-- Idempotente: pode ser gerado e rodado de novo após corrigir o .md fonte;
-- IDs são UUIDv5 determinísticos por caminho de slug, então nós existentes
-- são atualizados (ON CONFLICT ... DO UPDATE), nunca duplicados.
--
-- Nós gerados: ${nodes.length} (produto/setor/módulo/lição, incluindo quiz de
-- módulo e quiz final de setor sintéticos, semeados com conteudo.quiz = []
-- — nenhuma pergunta de avaliação foi inventada nesta rodada).
-- ============================================================

`

  const rows = nodes.map((node) => {
    const columns = [
      'id', 'parent_id', 'tipo', 'produto', 'titulo', 'ordem',
      'tipo_conteudo', 'tipo_conteudo_nota', 'conteudo',
      'knowledge_document_ids', 'eh_quiz_modulo', 'eh_quiz_final_setor',
    ]
    const values = [
      `'${node.id}'`,
      sqlUuidOrNull(node.parent_id),
      sqlDollar(node.tipo),
      sqlDollar(PRODUTO),
      sqlDollar(node.titulo),
      String(node.ordem),
      sqlDollar(node.tipo_conteudo),
      sqlDollar(node.tipo_conteudo_nota),
      sqlJsonb(node.conteudo),
      `'{}'::text[]`,
      sqlBool(node.eh_quiz_modulo),
      sqlBool(node.eh_quiz_final_setor),
    ]

    return `INSERT INTO public.training_nodes (${columns.join(', ')})
VALUES (${values.join(', ')})
ON CONFLICT (id) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  tipo = EXCLUDED.tipo,
  produto = EXCLUDED.produto,
  titulo = EXCLUDED.titulo,
  ordem = EXCLUDED.ordem,
  tipo_conteudo = EXCLUDED.tipo_conteudo,
  tipo_conteudo_nota = EXCLUDED.tipo_conteudo_nota,
  conteudo = EXCLUDED.conteudo,
  eh_quiz_modulo = EXCLUDED.eh_quiz_modulo,
  eh_quiz_final_setor = EXCLUDED.eh_quiz_final_setor,
  updated_at = NOW();
`
  })

  return header + rows.join('\n')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const md = readFileSync(SOURCE_MD, 'utf8')
const setores = parseMarkdown(md)
const nodes = buildNodes(setores)
const sql = generateSql(nodes)

process.stdout.write(sql)

// Estatísticas para stderr (não polui o SQL gerado no stdout)
const totalLicoes = setores.reduce((acc, s) => acc + s.modulos.reduce((a, m) => a + m.licoes.length, 0), 0)
const totalModulos = setores.reduce((acc, s) => acc + s.modulos.length, 0)
console.error(`OK — ${setores.length} setores, ${totalModulos} módulos, ${totalLicoes} lições reais, ${nodes.length} nós no total (com quizzes sintéticos).`)
