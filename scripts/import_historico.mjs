/**
 * import_historico.mjs
 * Lê os 3 CSVs históricos e gera import_fichas.sql + import_apolices.sql
 *
 * Uso: node scripts/import_historico.mjs
 *
 * Para buscar UUIDs reais dos perfis, adicione ao .env.local:
 *   SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
 *
 * Pré-requisito: rodar supabase/07_status_expirada.sql no Supabase antes de importar.
 */

import fs   from 'fs'
import https from 'https'
import path  from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.resolve(__dirname, '..')

// ── Ler .env.local ────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(ROOT, '.env.local')
  const env = {}
  if (!fs.existsSync(envPath)) return env
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) env[m[1].trim()] = m[2].trim()
  })
  return env
}

const ENV = loadEnv()
const SUPABASE_URL      = ENV.VITE_SUPABASE_URL || ''
const SUPABASE_SRV_KEY  = ENV.SUPABASE_SERVICE_ROLE_KEY || ''
const SUPABASE_ANON_KEY = ENV.VITE_SUPABASE_ANON_KEY || ''

// ── CSV Parser (suporta campos multiline entre aspas) ─────────────────────────

function parseCSV(raw) {
  // Remove BOM
  const content = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw

  const rows    = []
  let row       = []
  let field     = ''
  let inQuotes  = false
  let i         = 0

  while (i < content.length) {
    const ch   = content[i]
    const next = content[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i += 2; continue }  // "" → "
      if (ch === '"')                 { inQuotes = false; i++;  continue }
      field += ch; i++; continue
    }

    if (ch === '"')  { inQuotes = true;                                    i++; continue }
    if (ch === ',')  { row.push(field.trim()); field = '';                 i++; continue }
    if (ch === '\r') {                                                      i++; continue }
    if (ch === '\n') {
      row.push(field.trim())
      if (row.some(f => f !== '')) rows.push(row)
      row = []; field = ''
      i++; continue
    }
    field += ch; i++
  }
  // Última linha sem \n
  row.push(field.trim())
  if (row.some(f => f !== '')) rows.push(row)
  return rows
}

// ── Mapeamento de orçamentistas ───────────────────────────────────────────────

const ORC_MAP = {
  'DAVI':    'Davi',    'DAVI ':  'Davi',
  'DAYANA':  'Dayana',  'DAYANA ':'Dayana', 'DAY': 'Dayana',
  'EDU':     'Edu',     'EDU ':   'Edu',
  'LAIS':    'Lais',    'LAS':    'Lais',
  'MATEUS':  'Mateus',  'MATEUS ':'Mateus',
  'MARCOS':  'Marcos',  'MARCOS ':'Marcos',
}

function normalizeOrc(v) {
  if (!v) return null
  return ORC_MAP[v.trim().toUpperCase()] || null
}

// ── Funções de limpeza ────────────────────────────────────────────────────────

function parseStatus(s) {
  const u = String(s || '').toUpperCase().trim()
  if (u.includes('EMITIDO'))                                        return 'emitido'
  if (u.includes('CANCELAD'))                                       return 'cancelado'
  if (u.includes('CPF'))                                            return 'cpf_invalido'
  if (u.includes('EXPIRAD'))                                        return 'expirada'
  if (u.includes('ANÁLISE') || u.includes('ANALISE') || u.includes('PENDÊNCIA')) return 'em_analise'
  if (u.includes('APROVADO'))                                       return 'aprovado'
  if (u.includes('RECUSADO'))                                       return 'recusado'
  return 'recusado'  // status não reconhecido → recusado (dados históricos sem resultado claro)
}

function parseDataEmissao(v) {
  const m = String(v || '').match(/(\d{2})\/(\d{2})\/(\d{2,4})/)
  if (!m) return null
  const year = m[3].length === 2 ? '20' + m[3] : m[3]
  // Validar data
  const d = new Date(`${year}-${m[2]}-${m[1]}`)
  if (isNaN(d.getTime())) return null
  return `${year}-${m[2]}-${m[1]}`
}

function parseNumeroApolice(resultado) {
  const nums = String(resultado || '').match(/\b(\d{5,})\b/g)
  return nums ? nums[0] : null
}

function parseSeguradora(resultado) {
  const r = String(resultado || '').toUpperCase()
  if (r.includes('PORTO'))                                    return 'Porto Seguro'
  if (r.includes('POTTENCIAL') || r.includes('POTENCIAL'))   return 'Pottencial'
  if (r.includes('TOKIO') || r.includes('TOKYO'))            return 'Tokio Marine'
  if (/\bTOO\b/.test(r))                                     return 'TOO'
  if (r.includes('JUNTO'))                                   return 'Junto Seguros'
  // Se RESULTADO tem número mas não tem seguradora conhecida → Outras
  if (parseNumeroApolice(resultado))                         return 'Outras'
  return null
}

function parseNum(v) {
  if (!v) return 'NULL'
  let s = String(v).trim().replace(/[R$\s]/g, '')
  if (!s || s.toLowerCase() === 'nan' || /^(sim|não|nao|nd|-)$/i.test(s)) return 'NULL'

  // "10mil", "15mil" → 10000, 15000
  const milMatch = s.match(/^(\d+(?:[.,]\d+)?)\s*mil$/i)
  if (milMatch) {
    const base = parseFloat(milMatch[1].replace(',', '.'))
    if (!isNaN(base)) return `'${base * 1000}'`
  }

  // "40.000.00" → múltiplos pontos: último é decimal, resto são milhar
  const parts = s.split('.')
  if (parts.length > 2) {
    const decimal = parts.pop()
    s = parts.join('').replace(/,/g, '') + '.' + decimal
  }
  // Vírgula decimal BR: "1.500,00"
  else if (/,\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.')
  }
  // Ponto milhar: "15.000" (ponto + 3 dígitos no final sem vírgula)
  else if (/\.\d{3}$/.test(s) && !s.includes(',')) {
    s = s.replace(/\./g, '')
  }
  // Ponto decimal normal: "1500.00"
  // Sem alteração

  const n = parseFloat(s)
  if (isNaN(n)) return 'NULL'
  return `'${n}'`
}

function esc(v) {
  if (v === null || v === undefined) return 'NULL'
  const s = String(v).trim()
  if (!s || s.toLowerCase() === 'nan') return 'NULL'
  return "'" + s.replace(/'/g, "''") + "'"
}

function escDate(v) {
  if (!v) return 'NULL'
  return `'${v}'`
}

const PREPOSITIONS = new Set(['de','da','do','das','dos','e','em','a','o','com','por','para','ao','aos'])
function normalizeImob(nome) {
  if (!nome) return null
  const s = String(nome).trim().replace(/\s+/g, ' ')
  if (!s) return null
  return s.toLowerCase().split(' ')
    .map((w, i) => !w ? w : (i !== 0 && PREPOSITIONS.has(w)) ? w : w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

function parseCreatedAt(v) {
  if (!v) return null
  // "27/03/2026 13:48:30"
  const m = String(v).match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}.000Z`
  // "27/03/2026"
  const d = String(v).match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (d) return `${d[3]}-${d[2]}-${d[1]}T12:00:00.000Z`
  return null
}

// Gera UUID v4 determinístico baseado no conteúdo (para idempotência)
function deterministicUUID(seed) {
  const hash = createHash('sha256').update(seed).digest('hex')
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),           // version 4
    ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-')
}

// ── Buscar profiles do Supabase ───────────────────────────────────────────────

async function fetchProfiles() {
  const key = SUPABASE_SRV_KEY || SUPABASE_ANON_KEY
  if (!SUPABASE_URL || !key) return null

  return new Promise(resolve => {
    const url = new URL('/rest/v1/profiles?select=id,nome', SUPABASE_URL)
    https.get(url.toString(), {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    }, res => {
      let body = ''
      res.on('data', c => body += c)
      res.on('end', () => {
        try {
          const data = JSON.parse(body)
          if (Array.isArray(data)) resolve(data)
          else { console.warn('  ⚠ Profiles API retornou:', body.slice(0, 200)); resolve(null) }
        } catch { resolve(null) }
      })
    }).on('error', err => { console.warn('  ⚠ Erro ao buscar profiles:', err.message); resolve(null) })
  })
}

// ── Processadores por produto ─────────────────────────────────────────────────

function processRow(cols, produto, profileMap) {
  // Índices comuns (0=timestamp, 1=orc, 2=status, 3=resultado, 4=imob)
  const rawTimestamp  = cols[0] || ''
  const rawOrc        = cols[1] || ''
  const rawStatus     = cols[2] || ''
  const rawResultado  = cols[3] || ''
  const rawImob       = cols[4] || ''

  let nome_interessado = null, nome_empresa = null
  let cpf = null, cnpj = null, celular = null, email = null, cep = null
  let valor_aluguel = 'NULL', valor_iptu = 'NULL', valor_condominio = 'NULL'
  let tipo_imovel = null, observacoes = null
  let atividade = null, total_rendimentos = null, capital_social = null
  let motivo_locacao = null, vigencia = null, cpf_socios = null, opcao_tributaria = null

  if (produto === 'residencial_pf') {
    nome_interessado = cols[5]  || null
    cpf              = cols[6]  || null
    celular          = cols[7]  || null
    email            = cols[8]  || null
    cep              = cols[9]  || null
    valor_aluguel    = parseNum(cols[10])
    valor_iptu       = parseNum(cols[11])
    valor_condominio = parseNum(cols[12])
    tipo_imovel      = cols[13] || null
    observacoes      = cols[14] || null

  } else if (produto === 'comercial_pf') {
    nome_interessado = cols[5]  || null
    cpf              = cols[6]  || null
    celular          = cols[7]  || null
    email            = cols[8]  || null
    atividade        = cols[9]  || null
    total_rendimentos= cols[10] || null
    capital_social   = cols[11] || null
    motivo_locacao   = cols[12] || null
    vigencia         = cols[13] || null
    cep              = cols[14] || null
    valor_aluguel    = parseNum(cols[15])
    valor_iptu       = parseNum(cols[16])
    valor_condominio = parseNum(cols[17])
    tipo_imovel      = cols[18] || null
    observacoes      = cols[19] || null

  } else if (produto === 'pessoa_juridica') {
    nome_empresa     = cols[5]  || null
    nome_interessado = nome_empresa  // PJ: nome_empresa também vai em nome_interessado
    cnpj             = cols[6]  || null
    celular          = cols[7]  || null
    email            = cols[8]  || null
    atividade        = cols[9]  || null
    opcao_tributaria = cols[10] || null
    cpf_socios       = cols[11] || null
    total_rendimentos= cols[12] || null
    capital_social   = cols[13] || null
    motivo_locacao   = cols[14] || null
    // cols[15] = "Nome e CPF da pessoa que irá ocupar" → observacoes extra
    vigencia         = cols[16] || null
    cep              = cols[17] || null
    valor_aluguel    = parseNum(cols[18])
    valor_iptu       = parseNum(cols[19])
    valor_condominio = parseNum(cols[20])
    tipo_imovel      = cols[21] || null
    // Combinar observações: cols[22] + cols[15]
    const obs22 = cols[22] || ''
    const obs15 = cols[15] || ''
    observacoes = [obs22, obs15].filter(Boolean).join(' | ') || null
  }

  // Ignorar linha sem imobiliária E sem nome
  const hasImob = rawImob && rawImob.trim()
  const hasNome = (nome_interessado || nome_empresa || '').trim()
  if (!hasImob && !hasNome) return null

  const orcNorm     = normalizeOrc(rawOrc)
  const orcUUID     = orcNorm && profileMap ? (profileMap[orcNorm] || null) : null
  const status      = parseStatus(rawStatus)
  const dataEmissao = parseDataEmissao(rawStatus) || parseDataEmissao(rawResultado)
  const numApolice  = parseNumeroApolice(rawResultado)
  const seguradora  = (status === 'emitido') ? parseSeguradora(rawResultado) : null
  const imob        = normalizeImob(rawImob)
  const createdAt   = parseCreatedAt(rawTimestamp)

  // Fichas não pendentes = foram assumidas
  const isAtiva     = status !== 'pendente'
  const isFinal     = !['pendente', 'em_cotacao'].includes(status)

  // UUID determinístico baseado em timestamp + nome + produto (idempotente)
  const seed  = `${rawTimestamp}|${nome_interessado || nome_empresa || ''}|${cpf || cnpj || ''}|${produto}`
  const fichaId = deterministicUUID(seed)

  return {
    fichaId, produto, status, imob, createdAt,
    nome_interessado, nome_empresa, cpf, cnpj, celular, email, cep,
    valor_aluguel, valor_iptu, valor_condominio, tipo_imovel, observacoes,
    atividade, total_rendimentos, capital_social, motivo_locacao, vigencia,
    cpf_socios, opcao_tributaria,
    orcNorm, orcUUID, rawOrc,
    dataEmissao, numApolice, seguradora,
    isAtiva, isFinal,
  }
}

// ── Gerar SQL de INSERT para fichas ──────────────────────────────────────────

function fichaToSQL(f, rowNum) {
  const assumida      = f.isAtiva
  const orcId         = f.orcUUID ? `'${f.orcUUID}'` : 'NULL'
  const assumidaEm    = (f.isAtiva && f.createdAt) ? `'${f.createdAt}'` : 'NULL'
  const finalizadaEm  = (f.isFinal && f.createdAt) ? `'${f.createdAt}'` : 'NULL'
  const createdAt     = f.createdAt ? `'${f.createdAt}'` : 'NOW()'

  // Campos extras em raw_data para referência futura
  const rawExtra = {}
  if (f.atividade)         rawExtra.atividade         = f.atividade
  if (f.total_rendimentos) rawExtra.total_rendimentos  = f.total_rendimentos
  if (f.capital_social)    rawExtra.capital_social     = f.capital_social
  if (f.motivo_locacao)    rawExtra.motivo_locacao     = f.motivo_locacao
  if (f.vigencia)          rawExtra.vigencia           = f.vigencia
  if (f.cpf_socios)        rawExtra.cpf_socios         = f.cpf_socios
  if (f.opcao_tributaria)  rawExtra.opcao_tributaria   = f.opcao_tributaria
  rawExtra._importado_em = new Date().toISOString().slice(0, 10)

  const rawDataSQL = `'${JSON.stringify(rawExtra).replace(/'/g, "''")}'::jsonb`

  return `-- #${rowNum}
INSERT INTO public.fichas (
  id, created_at, produto,
  imobiliaria, nome_interessado, nome_empresa,
  cpf, cnpj, celular, email, cep,
  valor_aluguel, valor_iptu, valor_condominio,
  tipo_imovel, observacoes,
  atividade, total_rendimentos, capital_social,
  motivo_locacao, vigencia, cpf_socios, opcao_tributaria,
  orcamentista_forms, orcamentista_id,
  status, assumida, assumida_em, finalizada_em,
  seguradora, retorno_enviado,
  data_emissao, numero_apolice,
  raw_data
) VALUES (
  '${f.fichaId}', ${createdAt}, ${esc(f.produto)},
  ${esc(f.imob)}, ${esc(f.nome_interessado)}, ${esc(f.nome_empresa)},
  ${esc(f.cpf)}, ${esc(f.cnpj)}, ${esc(f.celular)}, ${esc(f.email)}, ${esc(f.cep)},
  ${f.valor_aluguel}, ${f.valor_iptu}, ${f.valor_condominio},
  ${esc(f.tipo_imovel)}, ${esc(f.observacoes)},
  ${esc(f.atividade)}, ${esc(f.total_rendimentos)}, ${esc(f.capital_social)},
  ${esc(f.motivo_locacao)}, ${esc(f.vigencia)}, ${esc(f.cpf_socios)}, ${esc(f.opcao_tributaria)},
  ${esc(f.orcNorm)}, ${orcId},
  ${esc(f.status)}, ${assumida}, ${assumidaEm}, ${finalizadaEm},
  ${esc(f.seguradora)}, ${f.status === 'emitido' ? 'TRUE' : 'FALSE'},
  ${escDate(f.dataEmissao)}, ${esc(f.numApolice)},
  ${rawDataSQL}
) ON CONFLICT (id) DO NOTHING;`
}

// ── Gerar SQL de INSERT para apolices ────────────────────────────────────────

function apoliceToSQL(f, rowNum) {
  // Só gera apólice se tiver número e seguradora válida
  if (!f.numApolice || !f.seguradora) return null
  if (!['Porto Seguro','Pottencial','Tokio Marine','TOO','Outras'].includes(f.seguradora)) return null

  const dataEm    = f.dataEmissao || (f.createdAt ? f.createdAt.slice(0, 10) : null)
  if (!dataEm) return null

  const emitidoPor = f.orcUUID ? `'${f.orcUUID}'` : 'NULL'
  const apoliceId  = deterministicUUID('apolice|' + f.fichaId)

  return `-- apólice #${rowNum}: ${f.numApolice} - ${f.seguradora}
INSERT INTO public.apolices (
  id, ficha_id,
  numero_apolice, seguradora, data_emissao, produto,
  imobiliaria, nome_interessado, nome_empresa,
  cpf, cnpj, celular, email, cep,
  tipo_imovel, valor_aluguel, vigencia,
  emitido_por, confirmacao_envio, status_apolice
) VALUES (
  '${apoliceId}', '${f.fichaId}',
  ${esc(f.numApolice)}, ${esc(f.seguradora)}, '${dataEm}', ${esc(f.produto)},
  ${esc(f.imob)}, ${esc(f.nome_interessado)}, ${esc(f.nome_empresa)},
  ${esc(f.cpf)}, ${esc(f.cnpj)}, ${esc(f.celular)}, ${esc(f.email)}, ${esc(f.cep)},
  ${esc(f.tipo_imovel)}, ${f.valor_aluguel}, ${esc(f.vigencia)},
  ${emitidoPor}, TRUE, 'ativa'
) ON CONFLICT (id) DO NOTHING;`
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  import_historico.mjs — Conves Corretora')
  console.log('═══════════════════════════════════════════════════\n')

  // 1. Buscar profiles
  console.log('▶ Buscando profiles no Supabase...')
  const profiles = await fetchProfiles()
  let profileMap = null
  const hasProfiles     = profiles && profiles.length > 0
  const usingPlaceholders = !hasProfiles

  if (hasProfiles) {
    profileMap = {}
    profiles.forEach(p => { if (p.nome) profileMap[p.nome] = p.id })
    console.log(`  ✓ ${profiles.length} profiles encontrados:`, Object.keys(profileMap).join(', '))
  } else {
    if (profiles && profiles.length === 0) {
      console.log('  ⚠ Supabase retornou 0 profiles (RLS pode estar bloqueando a anon key).')
    } else {
      console.log('  ⚠ Não foi possível buscar profiles.')
    }
    console.log('    → Adicione SUPABASE_SERVICE_ROLE_KEY ao .env.local para busca automática.')
    console.log('    → orcamentista_id ficará NULL — atualize manualmente após importar.\n')
  }

  // 2. Processar CSVs
  const CSV_FILES = [
    { file: 'Dados Necessários - Residencial.csv', produto: 'residencial_pf' },
    { file: 'Dados Necessários - Comercial.csv',   produto: 'comercial_pf'   },
    { file: 'Dados Necessários - Jurídica.csv',    produto: 'pessoa_juridica' },
  ]

  const allFichas  = []
  const stats      = { total: 0, por_produto: {}, ignoradas: 0, orc_nulo: 0, apolices: 0 }

  for (const { file, produto } of CSV_FILES) {
    const filePath = path.join(ROOT, file)
    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠ Arquivo não encontrado: ${file}`)
      continue
    }

    const raw  = fs.readFileSync(filePath, 'utf8')
    const rows = parseCSV(raw)
    // Primeira linha é o cabeçalho
    const dataRows = rows.slice(1)

    console.log(`▶ ${file}: ${dataRows.length} linhas`)

    let countProduto = 0
    for (let i = 0; i < dataRows.length; i++) {
      const cols = dataRows[i]
      if (!cols.some(c => c)) continue  // linha completamente vazia

      const f = processRow(cols, produto, profileMap)
      if (!f) { stats.ignoradas++; continue }

      if (!f.orcUUID && f.orcNorm) stats.orc_nulo++
      if (!f.orcNorm) stats.orc_nulo++

      allFichas.push(f)
      countProduto++
    }

    stats.por_produto[produto] = countProduto
    stats.total += countProduto
    console.log(`  ✓ ${countProduto} fichas processadas`)
  }

  // 3. Gerar import_fichas.sql
  console.log('\n▶ Gerando import_fichas.sql...')

  const placeholderComment = usingPlaceholders ? `
-- ⚠ ATENÇÃO: UUIDs de orçamentistas NÃO foram resolvidos automaticamente.
--   O campo orcamentista_id está como NULL para todos os registros.
--   Para resolver: adicione SUPABASE_SERVICE_ROLE_KEY ao .env.local e rode novamente,
--   ou atualize manualmente após a importação:
--   UPDATE public.fichas SET orcamentista_id = (SELECT id FROM public.profiles WHERE nome = 'Davi')
--   WHERE orcamentista_forms = 'Davi' AND orcamentista_id IS NULL;
` : `
-- ✓ UUIDs dos orçamentistas resolvidos automaticamente.
`

  const fichasHeader = `-- ============================================================
-- CONVES SYSTEM — import_fichas.sql
-- Importação histórica das planilhas (${new Date().toLocaleDateString('pt-BR')})
-- ============================================================
--
-- PRÉ-REQUISITOS:
--   1. Rodar supabase/07_status_expirada.sql ANTES deste arquivo
--   2. Verificar profiles existentes:
--      SELECT id, nome FROM public.profiles ORDER BY nome;
--
-- FICHAS A IMPORTAR:
--   residencial_pf:  ${stats.por_produto['residencial_pf'] || 0}
--   comercial_pf:    ${stats.por_produto['comercial_pf']   || 0}
--   pessoa_juridica: ${stats.por_produto['pessoa_juridica']|| 0}
--   TOTAL:           ${stats.total}
--
-- Para reverter: DELETE FROM public.fichas WHERE id IN (SELECT id FROM import_log);
-- Ou: DELETE FROM public.fichas WHERE raw_data->>'_importado_em' = '${new Date().toISOString().slice(0,10)}';
-- ============================================================
${placeholderComment}
BEGIN;
`

  const fichasLines  = [fichasHeader]
  const apolicesLines = []
  let apoliceCount  = 0

  allFichas.forEach((f, i) => {
    fichasLines.push(fichaToSQL(f, i + 1))
    fichasLines.push('')

    if (f.status === 'emitido') {
      const aSQL = apoliceToSQL(f, apoliceCount + 1)
      if (aSQL) { apolicesLines.push(aSQL); apolicesLines.push(''); apoliceCount++ }
    }
  })

  // Verificação e commit
  fichasLines.push(`
-- Verificação após importação:
SELECT produto, status, COUNT(*) as total
FROM public.fichas
WHERE raw_data->>'_importado_em' = '${new Date().toISOString().slice(0,10)}'
GROUP BY produto, status
ORDER BY produto, total DESC;

COMMIT;`)

  // 4. Gerar import_apolices.sql
  const apolicesHeader = `-- ============================================================
-- CONVES SYSTEM — import_apolices.sql
-- Apólices extraídas da importação histórica (${new Date().toLocaleDateString('pt-BR')})
-- ============================================================
--
-- PRÉ-REQUISITOS:
--   1. Rodar import_fichas.sql ANTES deste arquivo
--   2. A tabela apolices deve existir (supabase/migrations/create_apolices.sql)
--
-- APÓLICES A IMPORTAR: ${apoliceCount}
-- ============================================================

BEGIN;
`

  apolicesLines.unshift(apolicesHeader)
  apolicesLines.push(`
-- Verificação:
SELECT seguradora, COUNT(*) as total
FROM public.apolices
WHERE created_at::date = '${new Date().toISOString().slice(0,10)}'
GROUP BY seguradora ORDER BY total DESC;

COMMIT;`)

  // 5. Salvar arquivos
  const fichasPath   = path.join(ROOT, 'import_fichas.sql')
  const apolicesPath = path.join(ROOT, 'import_apolices.sql')

  fs.writeFileSync(fichasPath,   fichasLines.join('\n'),   'utf8')
  fs.writeFileSync(apolicesPath, apolicesLines.join('\n'), 'utf8')

  stats.apolices = apoliceCount

  // 6. Resumo
  console.log('\n═══════════════════════════════════════════════════')
  console.log('  RESUMO')
  console.log('═══════════════════════════════════════════════════')
  console.log(`  Fichas processadas:    ${stats.total}`)
  console.log(`    residencial_pf:      ${stats.por_produto['residencial_pf'] || 0}`)
  console.log(`    comercial_pf:        ${stats.por_produto['comercial_pf']   || 0}`)
  console.log(`    pessoa_juridica:     ${stats.por_produto['pessoa_juridica']|| 0}`)
  console.log(`  Apólices extraídas:    ${stats.apolices}`)
  console.log(`  Orçamentistas nulos:   ${stats.orc_nulo}`)
  console.log(`  Linhas ignoradas:      ${stats.ignoradas}`)
  console.log('')
  console.log(`  ✓ import_fichas.sql   → ${(fs.statSync(fichasPath).size / 1024).toFixed(0)} KB`)
  console.log(`  ✓ import_apolices.sql → ${(fs.statSync(apolicesPath).size / 1024).toFixed(0)} KB`)
  console.log('')

  if (usingPlaceholders) {
    console.log('  ⚠ ATENÇÃO: orcamentista_id = NULL em todos os registros.')
    console.log('    Adicione SUPABASE_SERVICE_ROLE_KEY ao .env.local e rode novamente.')
    console.log('    Ou atualize manualmente no Supabase após importar.')
  } else {
    if (hasProfiles) {
      console.log('  ✓ UUIDs dos orçamentistas resolvidos pelo Supabase.')
    } else {
      console.log('  ⚠ orcamentista_id = NULL em todos os registros.')
      console.log('    Para resolver, adicione ao .env.local:')
      console.log('      SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key')
      console.log('    Depois rode: node scripts/import_historico.mjs')
    }
  }

  console.log('\n  PRÓXIMO PASSO:')
  console.log('    1. Revise os SQLs gerados')
  console.log('    2. Certifique-se que 07_status_expirada.sql foi executado')
  console.log('    3. Execute import_fichas.sql no Supabase SQL Editor')
  console.log('    4. Execute import_apolices.sql no Supabase SQL Editor')
  console.log('═══════════════════════════════════════════════════\n')
}

main().catch(err => { console.error('Erro fatal:', err); process.exit(1) })
