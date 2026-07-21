import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

const ROOT = process.cwd()
const EXECUTE = process.argv.includes('--execute')
const ZERO_UUID = '00000000-0000-0000-0000-000000000000'
const CHUNK_SIZE = 500

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, 'utf8')
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^([^=]+)=(.*)$/)
    if (!match) continue
    const key = match[1].trim()
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

function chunks(items) {
  const result = []
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    result.push(items.slice(i, i + CHUNK_SIZE))
  }
  return result
}

async function fetchAllIds(supabase, table, columns = 'id') {
  const rows = []
  let from = 0
  while (true) {
    const to = from + 999
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, to)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
    from += 1000
  }
  return rows
}

async function deleteByIds(supabase, table, ids) {
  let deleted = 0
  for (const part of chunks(ids)) {
    const { error } = await supabase.from(table).delete().in('id', part)
    if (error) throw new Error(`${table}: ${error.message}`)
    deleted += part.length
  }
  return deleted
}

async function main() {
  loadEnvFile(path.join(ROOT, '.env.local'))

  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('VITE_SUPABASE_URL e uma chave Supabase precisam existir no .env.local.')
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const [clientes, cotacoes, emissoes, apolices, renovacoes] = await Promise.all([
    fetchAllIds(supabase, 'clientes_auto'),
    fetchAllIds(supabase, 'cotacoes_auto'),
    fetchAllIds(supabase, 'emissoes_auto'),
    fetchAllIds(supabase, 'apolices_auto'),
    fetchAllIds(supabase, 'renovacoes_auto'),
  ])

  const apoliceIds = apolices.map(item => item.id).filter(Boolean)
  let documentos = []
  for (const part of chunks(apoliceIds)) {
    const { data, error } = await supabase
      .from('documentos')
      .select('id, url')
      .in('apolice_id', part)
    if (error) throw new Error(`documentos: ${error.message}`)
    documentos.push(...(data ?? []))
  }

  const counts = {
    documentos_auto: documentos.length,
    renovacoes_auto: renovacoes.length,
    apolices_auto: apolices.length,
    emissoes_auto: emissoes.length,
    cotacoes_auto: cotacoes.length,
    clientes_auto: clientes.length,
  }

  console.log(EXECUTE ? 'Modo: EXECUCAO' : 'Modo: DRY RUN')
  console.table(counts)

  if (!EXECUTE) {
    console.log('Nenhum dado foi apagado. Rode com --execute para confirmar.')
    return
  }

  const paths = documentos.map(item => item.url).filter(Boolean)
  let storageRemoved = 0
  for (const part of chunks(paths)) {
    const { error } = await supabase.storage.from('documentos').remove(part)
    if (error) {
      console.warn(`Aviso: falha ao remover ${part.length} arquivo(s) do storage: ${error.message}`)
      continue
    }
    storageRemoved += part.length
  }

  const result = {
    storage_documentos_removidos: storageRemoved,
    documentos_auto: await deleteByIds(supabase, 'documentos', documentos.map(item => item.id).filter(Boolean)),
    renovacoes_auto: await deleteByIds(supabase, 'renovacoes_auto', renovacoes.map(item => item.id).filter(Boolean)),
    apolices_auto: await deleteByIds(supabase, 'apolices_auto', apoliceIds),
    emissoes_auto: await deleteByIds(supabase, 'emissoes_auto', emissoes.map(item => item.id).filter(Boolean)),
    cotacoes_auto: await deleteByIds(supabase, 'cotacoes_auto', cotacoes.map(item => item.id).filter(Boolean)),
    clientes_auto: await deleteByIds(supabase, 'clientes_auto', clientes.map(item => item.id).filter(Boolean)),
  }

  const [clientesAfter, cotacoesAfter, emissoesAfter, apolicesAfter, renovacoesAfter] = await Promise.all([
    fetchAllIds(supabase, 'clientes_auto'),
    fetchAllIds(supabase, 'cotacoes_auto'),
    fetchAllIds(supabase, 'emissoes_auto'),
    fetchAllIds(supabase, 'apolices_auto'),
    fetchAllIds(supabase, 'renovacoes_auto'),
  ])

  console.log('Removidos:')
  console.table(result)
  console.log('Restante:')
  console.table({
    renovacoes_auto: renovacoesAfter.length,
    apolices_auto: apolicesAfter.length,
    emissoes_auto: emissoesAfter.length,
    cotacoes_auto: cotacoesAfter.length,
    clientes_auto: clientesAfter.length,
  })
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
