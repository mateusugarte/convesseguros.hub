/**
 * importar_apolices.mjs
 *
 * Lê o CSV de apólices históricas e insere na tabela `apolices` do Supabase.
 * Pula duplicatas (mesmo numero_apolice + nome_interessado).
 *
 * Uso:
 *   node importar_apolices.mjs
 *
 * Requer:
 *   .env.local com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
 *   (ou use a service_role key para evitar restrições de RLS)
 */

import { createClient }     from '@supabase/supabase-js'
import { readFileSync }      from 'fs'
import { fileURLToPath }     from 'url'
import { dirname, join }     from 'path'

// ── Config ────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url))

// Lê .env.local manualmente (sem dependência de dotenv)
function lerEnv() {
  try {
    const env = readFileSync(join(__dirname, '.env.local'), 'utf-8')
    const vars = {}
    env.split('\n').forEach(line => {
      const m = line.match(/^([^#=\s]+)\s*=\s*(.+)$/)
      if (m) vars[m[1].trim()] = m[2].trim()
    })
    return vars
  } catch { return {} }
}

const env = lerEnv()
const SUPABASE_URL = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const CSV_FILE = join(__dirname, 'APOLICES EMITIDAS - FIANÇA - CONVES SEGUROS - Página1.csv')

// ── Parser CSV (suporta campos com vírgulas e quebras de linha entre aspas) ───

function parseCSV(text) {
  const records = []
  let i = 0

  while (i < text.length) {
    const fields = []

    // Pula linhas em branco
    while (i < text.length && (text[i] === '\r' || text[i] === '\n')) i++
    if (i >= text.length) break

    // Lê campos da linha
    while (i < text.length && text[i] !== '\n' && text[i] !== '\r') {
      let field = ''

      if (text[i] === '"') {
        // Campo com aspas — pode conter vírgulas e quebras de linha
        i++
        while (i < text.length) {
          if (text[i] === '"' && text[i + 1] === '"') {
            field += '"'; i += 2
          } else if (text[i] === '"') {
            i++; break
          } else {
            if (text[i] === '\n' || text[i] === '\r') field += ' '
            else field += text[i]
            i++
          }
        }
      } else {
        // Campo sem aspas
        while (i < text.length && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
          field += text[i]; i++
        }
      }

      fields.push(field.trim())

      if (text[i] === ',') i++
    }

    // Avança fim de linha
    if (text[i] === '\r') i++
    if (text[i] === '\n') i++

    if (fields.some(f => f.length > 0)) records.push(fields)
  }

  return records
}

// ── Normalização ──────────────────────────────────────────────────────────────

function normSeguradora(seg) {
  const s = (seg || '').trim().toUpperCase()
  if (!s) return null
  if (s.startsWith('TOKIO')) return 'Tokio Marine'
  if (['PORTO','POTRO','POTIO','PORTRO','PORTO SEGURO'].includes(s) || s.startsWith('PORTO ')) return 'Porto Seguro'
  if (['POTTENCIAL','PONTTENCIAL','POTTENCIL','PONTTECIAL','POTENCIAL'].includes(s)) return 'Potencial'
  if (s === 'TOO') return 'TOO'
  if (s.includes('JUNTO')) return 'Junto Seguros'
  // Fallback: retornar como está (evitar perda de dado)
  return seg.trim()
}

function parseDateBR(str) {
  if (!str) return null
  const parts = str.trim().split('/')
  if (parts.length !== 3) return null
  const [d, m, y] = parts
  if (!d || !m || !y) return null
  const year = parseInt(y, 10)
  // Datas com ano claramente inválido (ex: 0206 do typo)
  if (isNaN(year) || year < 1990 || year > 2100) return null
  const iso = `${String(year).padStart(4,'0')}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  if (isNaN(new Date(iso).getTime())) return null
  return iso
}

function limparNumero(num) {
  if (!num) return null
  // Remove trailing dots
  const c = num.trim().replace(/\.\s*$/, '').trim()
  return c || null
}

function normImob(imob) {
  if (!imob) return null
  const t = imob.trim()
  const INVALIDOS = ['SEM IMOB', 'SEM IMOB.', 'N/A', 'SEM IMOBILIARIA', '']
  if (INVALIDOS.includes(t.toUpperCase())) return null
  return t || null
}

// ── Calcular meses de vigência ────────────────────────────────────────────────

function calcMeses(inicio, fim) {
  if (!inicio || !fim) return null
  const d1 = new Date(inicio)
  const d2 = new Date(fim)
  const meses = Math.round((d2 - d1) / (1000 * 60 * 60 * 24 * 30))
  return Math.max(0, meses) || null
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📂 Lendo CSV...')
  const text    = readFileSync(CSV_FILE, 'utf-8')
  const records = parseCSV(text)

  if (records.length < 2) {
    console.error('❌ CSV vazio ou não encontrado em:', CSV_FILE)
    process.exit(1)
  }

  // Remover header
  const [header, ...rows] = records
  console.log(`📋 Linhas no CSV (sem header): ${rows.length}`)
  console.log(`📌 Header: ${header.join(' | ')}`)

  // ── Carregar existentes para deduplicação ──────────────────────────────────
  console.log('\n🔍 Carregando apólices existentes no banco...')
  let existentes = []
  let from = 0
  const PAGE = 1000

  while (true) {
    const { data, error } = await supabase
      .from('apolices')
      .select('numero_apolice, nome_interessado')
      .not('numero_apolice', 'is', null)
      .range(from, from + PAGE - 1)

    if (error) { console.error('Erro ao carregar existentes:', error.message); break }
    if (!data || data.length === 0) break
    existentes = existentes.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }

  const existenteSet = new Set(
    existentes.map(a => `${(a.numero_apolice||'').toLowerCase()}|${(a.nome_interessado||'').toLowerCase()}`)
  )
  console.log(`✅ ${existenteSet.size} registros já existentes no banco`)

  // ── Processar linhas ───────────────────────────────────────────────────────
  const paraInserir = []
  let puladas     = 0
  let invalidas   = 0

  for (const row of rows) {
    // Colunas: TRANSMISSÃO, FINAL VIGENCIA, LOCATÁRIO, APOLICE, IMOBILIARIA, TIPO, SEGURADORA
    const [transmissao, fimVig, nomeRaw, numRaw, imobRaw, , segRaw] = row

    const numero = limparNumero(numRaw)
    const nome   = (nomeRaw || '').trim()
      .replace(/,$/, '')   // remove vírgula trailing de nomes com aspas
      .trim()

    if (!numero || !nome) { invalidas++; continue }

    const chave = `${numero.toLowerCase()}|${nome.toLowerCase()}`
    if (existenteSet.has(chave)) { puladas++; continue }

    const inicio = parseDateBR(transmissao)
    const fim    = parseDateBR(fimVig)

    const registro = {
      nome_interessado:      nome,
      numero_apolice:        numero,
      imobiliaria:           normImob(imobRaw),
      seguradora:            normSeguradora(segRaw),
      status_emissao:        'enviada',
      data_emissao:          inicio,
      inicio_vigencia:       inicio,
      fim_vigencia:          fim,
      data_transmissao:      inicio ? `${inicio}T00:00:00` : null,
      tempo_vigencia_meses:  calcMeses(inicio, fim),
      // campos obrigatórios do sistema
      ficha_id:              null,
      produto:               null,
    }

    paraInserir.push(registro)
    existenteSet.add(chave) // evitar duplicatas dentro do próprio CSV
  }

  console.log(`\n📊 Resumo:`)
  console.log(`   Para inserir: ${paraInserir.length}`)
  console.log(`   Já existentes (puladas): ${puladas}`)
  console.log(`   Inválidas (sem número ou nome): ${invalidas}`)

  if (paraInserir.length === 0) {
    console.log('\n✅ Nada a inserir — banco já está atualizado.')
    return
  }

  // ── Inserir em lotes ───────────────────────────────────────────────────────
  console.log(`\n⬆️  Inserindo em lotes de 100...`)
  const BATCH    = 100
  let   inseridos = 0
  let   erros    = 0
  const erroDetalhe = []

  for (let i = 0; i < paraInserir.length; i += BATCH) {
    const lote = paraInserir.slice(i, i + BATCH)
    const { error } = await supabase.from('apolices').insert(lote)

    if (error) {
      erros += lote.length
      erroDetalhe.push({ lote: Math.floor(i / BATCH) + 1, msg: error.message })
      console.error(`\n❌ Lote ${Math.floor(i/BATCH)+1}: ${error.message}`)
    } else {
      inseridos += lote.length
      process.stdout.write(`\r   ${inseridos}/${paraInserir.length} inseridos...  `)
    }
  }

  console.log(`\n\n🎉 Importação concluída!`)
  console.log(`   Inseridos com sucesso: ${inseridos}`)
  if (erros > 0) {
    console.log(`   Com erro: ${erros}`)
    erroDetalhe.forEach(e => console.log(`   Lote ${e.lote}: ${e.msg}`))
    console.log('\n💡 Se o erro for "row-level security", você precisa usar a service_role key.')
    console.log('   Substitua SUPABASE_KEY pela service_role key do seu projeto Supabase.')
  }
}

main().catch(err => {
  console.error('❌ Erro fatal:', err)
  process.exit(1)
})
