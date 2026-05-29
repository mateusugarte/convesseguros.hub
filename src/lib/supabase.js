import { createClient } from '@supabase/supabase-js'

const url  = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anon) {
  throw new Error(
    '[Conves] Variáveis de ambiente ausentes.\n' +
    '  Local: verifique .env.local (copie de .env.example e preencha os valores).\n' +
    '  Vercel: Settings → Environment Variables → adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY → Redeploy.'
  )
}

export const supabase = createClient(url, anon)
