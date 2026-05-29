/**
 * update_seguradoras.mjs
 * Lê os CSVs históricos e gera 5 arquivos SQL de UPDATE para popular
 * seguradora + numero_apolice nas fichas que estão com esses campos NULL.
 *
 * Análise dos CSVs:
 *   Residencial: col 3 (RESULTADO) contém seguradora + nº apólice → UPDATE reais
 *   Comercial  : col 3 (RESULTADO) = desfecho (EMITIDO/EXPIRADA) → sem dados de seguradora
 *   Jurídica   : col 3 (RESULTADO) = desfecho                    → sem dados de seguradora
 *
 * Estratégia de matching (ambos numa única UPDATE com OR):
 *   1. id = UUID determinístico (mesmo da import_historico.mjs)
 *   2. CPF normalizado (só dígitos) + produto = residencial_pf
 *
 * Saída:
 *   update_seg_residencial_1.sql  (~1/3 das fichas residencial com seguradora)
 *   update_seg_residencial_2.sql  (~2/3)
 *   update_seg_residencial_3.sql  (restante)
 *   update_seg_comercial.sql      (fichas emitidas sem dados → update manual)
 *   update_seg_juridica.sql       (fichas emitidas sem dados → update manual)
 *
 * Uso: node scripts/update_seguradoras.mjs
 */

import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.resolve(__dirname, '..')

// ── CSV Parser (igual ao import_historico.mjs) ────────────────────────────────

function parseCSV(raw) {
  const content = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw
  const rows = []; let row = []; let field = ''; let inQuotes = false; let i = 0
  while (i < content.length) {
    const ch = content[i]; const next = content[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i += 2; continue }
      if (ch === '"') { inQuotes = false; i++; continue }
      field += ch; i++; continue
    }
    if (ch === '"')  { inQuotes = true; i++; continue }
    if (ch === ',')  { row.push(field.trim()); field = ''; i++; continue }
    if (ch === '\r') { i++; continue }
    if (ch === '\n') {
      row.push(field.trim())
      if (row.some(f => f !== '')) rows.push(row)
      row = []; field = ''; i++; continue
    }
    field += ch; i++
  }
  row.push(field.trim())
  if (row.some(f => f !== '')) rows.push(row)
  return rows
}

// ── UUID determinístico (mesmo da import_historico.mjs) ──────────────────────

function deterministicUUID(seed) {
  const hash = createHash('sha256').update(seed).digest('hex')
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseCreatedAt(v) {
  if (!v) return null
  const m = String(v).match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}.000Z`
  const d = String(v).match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (d) return `${d[3]}-${d[2]}-${d[1]}T12:00:00.000Z`
  return null
}

// Extrai seguradora do campo RESULTADO — mapeado para os nomes do sistema
function parseSeguradora(resultado) {
  const r = String(resultado || '').toUpperCase()
  if (r.includes('PORTO'))                                    return 'Porto Seguro'
  if (r.includes('POTTENCIAL') || r.includes('POTENCIAL'))   return 'Potencial'
  if (r.includes('TOKIO') || r.includes('TOKYO'))            return 'Tokio Marine'
  if (/\bTOO\b/.test(r))                                     return 'TOO'
  if (r.includes('JUNTO'))                                    return 'Junto Seguros'
  return null
}

// Extrai número de apólice do campo RESULTADO (sequência de 4+ dígitos)
function parseNumeroApolice(resultado) {
  // Limpa pontos finais e "PROP" (proposta, não é nº de apólice definitivo)
  const clean = String(resultado || '').replace(/\.+$/gm, '').replace(/PROP\s*/gi, '').trim()
  const nums  = clean.match(/\b(\d{4,})\b/g)
  return nums ? nums[0] : null
}

// Normaliza CPF para somente dígitos (para match robusto no banco)
function cpfDigits(v) {
  return String(v || '').replace(/[^0-9]/g, '')
}

// Escapa string SQL
function esc(v) {
  if (v === null || v === undefined) return 'NULL'
  const s = String(v).trim()
  if (!s) return 'NULL'
  return "'" + s.replace(/'/g, "''") + "'"
}

// ── Processador de linha do Residencial ──────────────────────────────────────

function processResidencial(cols) {
  const rawTimestamp   = cols[0] || ''
  const rawResultado   = cols[3] || ''   // col 3 = RESULTADO (seguradora+apólice)
  const rawImob        = cols[4] || ''
  const nome_interessado = cols[5] || null
  const cpf              = cols[6] || null

  const seguradora   = parseSeguradora(rawResultado)
  if (!seguradora) return null  // sem seguradora reconhecida → pular

  const numApolice   = parseNumeroApolice(rawResultado)
  const createdAt    = parseCreatedAt(rawTimestamp)
  const cpfNorm      = cpfDigits(cpf)

  // UUID determinístico — mesmo seed da import_historico.mjs
  const seed    = `${rawTimestamp}|${nome_interessado || ''}|${cpf || ''}|residencial_pf`
  const fichaId = deterministicUUID(seed)

  return {
    fichaId, seguradora, numApolice, cpfNorm,
    nome: nome_interessado, imob: rawImob.trim(),
    rawTimestamp, createdAt,
  }
}

// Processador genérico (Comercial/Juridica) — sem seguradora no CSV
function processGenerico(cols, produto) {
  const rawTimestamp     = cols[0] || ''
  const rawStatus        = (cols[2] || '').toUpperCase()
  const rawResultado     = (cols[3] || '').toUpperCase()
  const rawImob          = cols[4] || ''

  // Detecta fichas emitidas (precisam de seguradora mas CSV não tem)
  const isEmitido = rawStatus.includes('EMITIDO') || rawResultado.includes('EMITIDO')
  if (!isEmitido) return null

  let nome, cpf
  if (produto === 'comercial_pf') {
    nome = cols[5] || null
    cpf  = cols[6] || null
  } else {
    nome = cols[5] || null  // nome_empresa para PJ
    cpf  = cols[6] || null  // CNPJ para PJ
  }

  const cpfNorm  = cpfDigits(cpf)
  const seed     = `${rawTimestamp}|${nome || ''}|${cpf || ''}|${produto}`
  const fichaId  = deterministicUUID(seed)

  return { fichaId, nome, cpf: cpfNorm, imob: rawImob.trim(), rawTimestamp, produto }
}

// Sanitiza string para uso em comentário SQL — remove newlines internos
function safeLine(v, maxLen) {
  const s = String(v || '—').replace(/[\r\n\t]+/g, ' ').trim()
  return maxLen ? s.slice(0, maxLen) : s
}

// ── Gerador de SQL UPDATE (Residencial) ─────────────────────────────────────

function buildUpdateSQL(f, rowNum) {
  const cpfClause = f.cpfNorm.length >= 8
    ? `\n  OR regexp_replace(COALESCE(cpf, ''), '[^0-9]', '', 'g') = '${f.cpfNorm}'`
    : ''

  // safeLine evita que newlines internos nos campos quebrem o comentário SQL
  const nomeStr = safeLine(f.nome, 40)
  const imobStr = safeLine(f.imob)

  return `-- #${rowNum}: ${nomeStr} | ${imobStr} | ${f.seguradora}${f.numApolice ? ' #' + f.numApolice : ''}
UPDATE public.fichas SET
  seguradora     = ${esc(f.seguradora)},
  numero_apolice = ${esc(f.numApolice)}
WHERE (
  id = '${f.fichaId}'${cpfClause}
)
  AND produto = 'residencial_pf'
  AND (seguradora IS NULL OR seguradora = '');
`
}

// Gera UPDATE comentado (Comercial/Juridica — sem dados de seguradora no CSV)
function buildManualUpdateSQL(f, rowNum, produto) {
  const field = produto === 'pessoa_juridica' ? 'cnpj' : 'cpf'
  // Prefixo -- antes do OR para manter o bloco inteiro comentado
  const cpfClause = f.cpf.length >= 8
    ? `\n--   OR regexp_replace(COALESCE(${field}, ''), '[^0-9]', '', 'g') = '${f.cpf}'`
    : ''

  const nomeStr = safeLine(f.nome, 50)
  const imobStr = safeLine(f.imob)

  return `-- #${rowNum}: ${nomeStr} | ${imobStr}
-- ⚠ Seguradora NÃO disponível no CSV — preencher manualmente:
-- UPDATE public.fichas SET
--   seguradora     = 'NOME_DA_SEGURADORA',
--   numero_apolice = 'NUMERO_DA_APOLICE'
-- WHERE (
--   id = '${f.fichaId}'${cpfClause}
-- )
--   AND produto = ${esc(produto)}
--   AND (seguradora IS NULL OR seguradora = '');
`
}

// ── Salvar arquivo SQL ────────────────────────────────────────────────────────

function saveSQL({ filename, title, produto, lines, totalRows, semDados }) {
  const filepath = path.join(ROOT, filename)
  const hoje     = new Date().toLocaleDateString('pt-BR')

  const header = `-- ============================================================
-- CONVES SYSTEM — ${filename}
-- ${title} — Atualização de seguradoras (${hoje})
-- ============================================================
--
-- OBJETIVO: popular seguradora + numero_apolice em fichas que estão NULL.
-- MATCHING: por UUID determinístico (fichas importadas do CSV)
--           OU por CPF normalizado (fichas vindas pelo webhook/Forms).
-- SEGURO: todas as UPDATEs têm WHERE seguradora IS NULL — idempotente.
${semDados ? `--
-- ⚠ ATENÇÃO: O CSV de ${produto} NÃO contém dados de seguradora.
-- As UPDATEs abaixo estão COMENTADAS — preencha manualmente e descomente.
-- Ou use a interface web: Fichas → Passadas → Sem seguradora → ✏ Editar.
--` : `--
-- ${totalRows} fichas com seguradora identificadas no CSV.`}
-- ============================================================

BEGIN;

${lines.join('\n')}

-- ── Verificação ────────────────────────────────────────────────────────────
SELECT
  seguradora,
  COUNT(*) AS total
FROM public.fichas
WHERE produto = ${esc(produto)}
  AND seguradora IS NOT NULL
GROUP BY seguradora
ORDER BY total DESC;

COMMIT;
`

  fs.writeFileSync(filepath, header, 'utf8')
  const kb = (fs.statSync(filepath).size / 1024).toFixed(0)
  console.log(`  ✓ ${filename.padEnd(38)} ${totalRows} linhas — ${kb} KB`)
  return filepath
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  update_seguradoras.mjs — Conves Corretora')
  console.log('═══════════════════════════════════════════════════════════\n')

  const CSV_FILES = [
    { file: 'Dados Necessários - Residencial.csv', produto: 'residencial_pf'  },
    { file: 'Dados Necessários - Comercial.csv',   produto: 'comercial_pf'    },
    { file: 'Dados Necessários - Jurídica.csv',    produto: 'pessoa_juridica' },
  ]

  // ── 1. Processar Residencial ─────────────────────────────────────────────

  const residencialPath = path.join(ROOT, CSV_FILES[0].file)
  if (!fs.existsSync(residencialPath)) {
    console.error(`  ✗ Arquivo não encontrado: ${CSV_FILES[0].file}`)
    process.exit(1)
  }

  const resRows = parseCSV(fs.readFileSync(residencialPath, 'utf8')).slice(1)
  console.log(`▶ Residencial: ${resRows.length} linhas no CSV`)

  const comSeguradora = []
  let ignoradasRes = 0

  for (let i = 0; i < resRows.length; i++) {
    const cols = resRows[i]
    if (!cols.some(c => c)) { ignoradasRes++; continue }

    const f = processResidencial(cols)
    if (!f) { ignoradasRes++; continue }
    comSeguradora.push(f)
  }

  console.log(`  → ${comSeguradora.length} fichas com seguradora identificada`)
  console.log(`  → ${ignoradasRes} linhas sem seguradora reconhecida (recusadas, aprovadas, etc.)`)

  // Dividir em 3 partes
  const partSize = Math.ceil(comSeguradora.length / 3)
  const partes   = [
    comSeguradora.slice(0, partSize),
    comSeguradora.slice(partSize, partSize * 2),
    comSeguradora.slice(partSize * 2),
  ]

  for (let p = 0; p < 3; p++) {
    const parte  = partes[p]
    const lines  = parte.map((f, i) => buildUpdateSQL(f, i + 1 + p * partSize))
    const filename = `update_seg_residencial_${p + 1}.sql`
    saveSQL({
      filename,
      title:     `Residencial PF — parte ${p + 1}/3`,
      produto:   'residencial_pf',
      lines,
      totalRows: parte.length,
      semDados:  false,
    })
  }

  // ── 2. Processar Comercial (sem seguradora no CSV) ───────────────────────

  console.log('\n▶ Comercial: verificando fichas emitidas...')
  const comercialPath = path.join(ROOT, CSV_FILES[1].file)
  const comercialEmitidas = []

  if (fs.existsSync(comercialPath)) {
    const comRows = parseCSV(fs.readFileSync(comercialPath, 'utf8')).slice(1)
    for (const cols of comRows) {
      if (!cols.some(c => c)) continue
      const f = processGenerico(cols, 'comercial_pf')
      if (f) comercialEmitidas.push(f)
    }
    console.log(`  → ${comercialEmitidas.length} fichas emitidas identificadas (sem seguradora no CSV)`)
  }

  saveSQL({
    filename:  'update_seg_comercial.sql',
    title:     'Comercial PF — fichas emitidas sem seguradora no CSV',
    produto:   'comercial_pf',
    lines:     comercialEmitidas.map((f, i) => buildManualUpdateSQL(f, i + 1, 'comercial_pf')),
    totalRows: comercialEmitidas.length,
    semDados:  true,
  })

  // ── 3. Processar Jurídica (sem seguradora no CSV) ────────────────────────

  console.log('\n▶ Jurídica: verificando fichas emitidas...')
  const juridicaPath = path.join(ROOT, CSV_FILES[2].file)
  const juridicaEmitidas = []

  if (fs.existsSync(juridicaPath)) {
    const jurRows = parseCSV(fs.readFileSync(juridicaPath, 'utf8')).slice(1)
    for (const cols of jurRows) {
      if (!cols.some(c => c)) continue
      const f = processGenerico(cols, 'pessoa_juridica')
      if (f) juridicaEmitidas.push(f)
    }
    console.log(`  → ${juridicaEmitidas.length} fichas emitidas identificadas (sem seguradora no CSV)`)
  }

  saveSQL({
    filename:  'update_seg_juridica.sql',
    title:     'Pessoa Jurídica — fichas emitidas sem seguradora no CSV',
    produto:   'pessoa_juridica',
    lines:     juridicaEmitidas.map((f, i) => buildManualUpdateSQL(f, i + 1, 'pessoa_juridica')),
    totalRows: juridicaEmitidas.length,
    semDados:  true,
  })

  // ── Resumo ───────────────────────────────────────────────────────────────

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('  RESUMO')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`  Residencial — ${comSeguradora.length} fichas com seguradora no CSV`)
  console.log(`    Porto Seguro : ${comSeguradora.filter(f => f.seguradora === 'Porto Seguro').length}`)
  console.log(`    Potencial    : ${comSeguradora.filter(f => f.seguradora === 'Potencial').length}`)
  console.log(`    Tokio Marine : ${comSeguradora.filter(f => f.seguradora === 'Tokio Marine').length}`)
  console.log(`    TOO          : ${comSeguradora.filter(f => f.seguradora === 'TOO').length}`)
  console.log(`    Junto Seguros: ${comSeguradora.filter(f => f.seguradora === 'Junto Seguros').length}`)
  console.log(`    Com apólice  : ${comSeguradora.filter(f => f.numApolice).length}`)
  console.log(`    Sem apólice  : ${comSeguradora.filter(f => !f.numApolice).length}`)
  console.log()
  console.log(`  Comercial  — sem dados de seguradora no CSV (${comercialEmitidas.length} emitidas para revisão manual)`)
  console.log(`  Jurídica   — sem dados de seguradora no CSV (${juridicaEmitidas.length} emitidas para revisão manual)`)
  console.log()
  console.log('  ORDEM DE EXECUÇÃO NO SUPABASE SQL EDITOR:')
  console.log('    1. update_seg_residencial_1.sql')
  console.log('    2. update_seg_residencial_2.sql')
  console.log('    3. update_seg_residencial_3.sql')
  console.log('    4. update_seg_comercial.sql   (descomente e preencha seguradoras)')
  console.log('    5. update_seg_juridica.sql    (descomente e preencha seguradoras)')
  console.log('═══════════════════════════════════════════════════════════\n')
}

main().catch(err => { console.error('Erro fatal:', err); process.exit(1) })
