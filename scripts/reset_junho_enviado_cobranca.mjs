import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

function loadEnvFile() {
  const envPath = path.join(ROOT, '.env.local')
  const env = {}
  if (!existsSync(envPath)) return env

  readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
    const match = line.match(/^([^#=\s]+)\s*=\s*(.+)$/)
    if (!match) return
    env[match[1].trim()] = match[2].trim()
  })

  return env
}

function parseArgs(argv) {
  const args = { year: 2026, month: 6, dryRun: false }
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (current === '--year') args.year = Number(argv[index + 1] || args.year)
    if (current === '--month') args.month = Number(argv[index + 1] || args.month)
    if (current === '--dry-run') args.dryRun = true
  }
  return args
}

function getMonthRange(year, month) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)).toISOString()
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString()
  return { start, end }
}

function buildResetPatch(rawData = {}) {
  return {
    raw_data: {
      ...rawData,
      recovered_after_cobranca: false,
      recovered_after_cobranca_em: null,
      cobranca_started_at: null,
      imobiliaria_retornou: false,
      imobiliaria_retornou_em: null,
    },
  }
}

async function main() {
  const env = loadEnvFile()
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Configure .env.local com SUPABASE_SERVICE_ROLE_KEY ou VITE_SUPABASE_ANON_KEY e VITE_SUPABASE_URL.')
  }

  const { year, month, dryRun } = parseArgs(process.argv.slice(2))
  const { start, end } = getMonthRange(year, month)
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: fichas, error: fichasError } = await supabase
    .from('fichas')
    .select('id, status, created_at, numero_apolice, data_emissao, raw_data')
    .gte('created_at', start)
    .lte('created_at', end)

  if (fichasError) throw fichasError

  const fichasEmCobranca = (fichas || []).filter(item => Boolean(item?.raw_data?.cobranca_started_at))
  const fichaIds = fichasEmCobranca.map(item => item.id).filter(Boolean)
  const apolicesByFicha = new Set()

  if (fichaIds.length > 0) {
    const { data: apolices, error: apolicesError } = await supabase
      .from('apolices')
      .select('ficha_id, status_emissao, numero_apolice')
      .in('ficha_id', fichaIds)
      .in('status_emissao', ['emitida', 'enviada'])

    if (apolicesError) throw apolicesError

    ;(apolices || []).forEach(item => {
      if (item?.ficha_id && item?.numero_apolice) apolicesByFicha.add(item.ficha_id)
    })
  }

  const targetFichas = fichasEmCobranca.filter(item => {
    const hasPolicy = Boolean(item?.numero_apolice || item?.data_emissao || apolicesByFicha.has(item.id))
    return !hasPolicy
  })

  console.log('Periodo:', year + '-' + String(month).padStart(2, '0'))
  console.log('Fichas com Enviado Cobranca:', fichasEmCobranca.length)
  console.log('Fichas elegiveis para reset:', targetFichas.length)

  if (dryRun || targetFichas.length === 0) {
    targetFichas.forEach(item => console.log('-', item.id, '| status=' + item.status, '| created_at=' + item.created_at))
    return
  }

  for (const ficha of targetFichas) {
    const patch = buildResetPatch(ficha.raw_data || {})
    const { error } = await supabase.from('fichas').update(patch).eq('id', ficha.id)
    if (error) throw error
    console.log('Resetada:', ficha.id)
  }
}

main().catch(error => {
  console.error(error?.message || error)
  process.exit(1)
})
