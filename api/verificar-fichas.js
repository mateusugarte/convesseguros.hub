import { createClient } from '@supabase/supabase-js'
import { conciliarFichas, inicioDaBusca, extrairCampos, DIAS_PADRAO } from '../src/lib/fichasConciliacao.js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const DIAS_MAX = 180
const LIMITE_IMPORTACAO = 50
const TIMEOUT_MS = 30000

function json(res, status, body) {
  res.status(status).json(body)
}

/**
 * Fontes = uma por formulario. Formato preferido, JSON na env FICHAS_SHEETS:
 *   [{"id":"residencial","nome":"Residencial PF","url":"https://script.google.com/.../exec",
 *     "token":"...","webhook":"https://n8n.../webhook/e8ed448d-..."}]
 * Para uma fonte so, as envs simples abaixo bastam.
 */
function carregarFontes() {
  const bruto = process.env.FICHAS_SHEETS
  if (bruto) {
    const lista = JSON.parse(bruto)
    if (!Array.isArray(lista)) throw new Error('FICHAS_SHEETS precisa ser um array JSON')
    return lista.map((f, i) => ({
      id: f.id || `fonte-${i + 1}`,
      nome: f.nome || f.id || `Formulario ${i + 1}`,
      url: f.url,
      token: f.token,
      webhook: f.webhook || process.env.FICHAS_WEBHOOK_URL || '',
    }))
  }

  if (!process.env.FICHAS_SHEET_URL) return []
  return [{
    id: 'residencial',
    nome: process.env.FICHAS_SHEET_NOME || 'Residencial PF',
    url: process.env.FICHAS_SHEET_URL,
    token: process.env.FICHAS_SHEET_TOKEN,
    webhook: process.env.FICHAS_WEBHOOK_URL || '',
  }]
}

async function comTimeout(url, opcoes = {}) {
  const controle = new AbortController()
  const timer = setTimeout(() => controle.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...opcoes, signal: controle.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** Le uma fonte (Apps Script Web App) e devolve as linhas da janela. */
async function lerPlanilha(fonte, dias) {
  if (!fonte.url) throw new Error(`Fonte "${fonte.nome}" sem URL configurada.`)
  if (!fonte.token) throw new Error(`Fonte "${fonte.nome}" sem token configurado.`)

  const url = new URL(fonte.url)
  url.searchParams.set('token', fonte.token)
  url.searchParams.set('dias', String(dias))

  // O Apps Script responde 302 para googleusercontent; o fetch segue por padrao.
  const resposta = await comTimeout(url.toString(), { redirect: 'follow' })
  const texto = await resposta.text()

  let payload
  try {
    payload = JSON.parse(texto)
  } catch {
    // Login do Google devolve HTML: sinal classico de implantacao com acesso
    // restrito, que precisa ser "Qualquer pessoa".
    const dica = texto.includes('<html')
      ? 'O endpoint devolveu HTML em vez de JSON. Confira se a implantacao do Apps Script esta como "Qualquer pessoa" e se a URL termina em /exec.'
      : 'Resposta nao e JSON valido.'
    throw new Error(`Falha ao ler "${fonte.nome}": ${dica}`)
  }

  if (!payload?.ok) {
    throw new Error(`Falha ao ler "${fonte.nome}": ${payload?.erro || 'erro desconhecido'}`)
  }
  return payload
}

/** Fichas do periodo, com a margem de seguranca contra falso "faltante". */
async function buscarFichas(client, dias) {
  const inicio = inicioDaBusca(dias).toISOString()
  const { data, error } = await client
    .from('fichas')
    .select('id, created_at, produto, nome_interessado, cpf, celular, status, imobiliaria')
    .gte('created_at', inicio)
    .order('created_at', { ascending: true })
    .limit(5000)

  if (error) throw new Error(`Falha ao ler fichas: ${error.message}`)
  return data || []
}

async function verificar(client, fontes, dias) {
  const fichas = await buscarFichas(client, dias)

  const resultados = await Promise.all(fontes.map(async fonte => {
    try {
      const planilha = await lerPlanilha(fonte, dias)
      const conciliacao = conciliarFichas({ linhas: planilha.linhas || [], fichas })
      return {
        fonte: fonte.id,
        nome: fonte.nome,
        ok: true,
        planilha: planilha.planilha,
        aba: planilha.aba,
        importavel: Boolean(fonte.webhook),
        ...conciliacao,
      }
    } catch (err) {
      return { fonte: fonte.id, nome: fonte.nome, ok: false, erro: String(err.message || err) }
    }
  }))

  const totais = resultados.reduce((acc, r) => {
    if (!r.ok) return { ...acc, comErro: acc.comErro + 1 }
    return {
      total: acc.total + r.resumo.total,
      faltantes: acc.faltantes + r.resumo.faltantes,
      encontradas: acc.encontradas + r.resumo.encontradas,
      incertas: acc.incertas + r.resumo.incertas,
      comErro: acc.comErro,
    }
  }, { total: 0, faltantes: 0, encontradas: 0, incertas: 0, comErro: 0 })

  return { ok: true, janela_dias: dias, verificado_em: new Date().toISOString(), totais, fontes: resultados }
}

/**
 * Reenvia as linhas escolhidas pelo webhook oficial do n8n — mesmo caminho de um
 * envio real do Forms, entao a normalizacao de imobiliaria e o mapeamento de
 * campos continuam sendo os mesmos, sem uma segunda implementacao para manter.
 */
async function importar(client, fontes, dias, alvos) {
  if (!Array.isArray(alvos) || alvos.length === 0) {
    throw new Error('Nenhuma linha enviada para importacao.')
  }
  if (alvos.length > LIMITE_IMPORTACAO) {
    throw new Error(`Importe no maximo ${LIMITE_IMPORTACAO} linhas por vez.`)
  }

  // O cliente manda apenas referencias {fonte, linha}. O conteudo vem da leitura
  // do servidor: assim o que entra no sistema e obrigatoriamente o que esta na
  // planilha, e nao um payload que o navegador poderia ter alterado no caminho.
  const fichas = await buscarFichas(client, dias)
  const idsFontes = [...new Set(alvos.map(a => a.fonte).filter(Boolean))]
  const alvoPorFonte = idsFontes.length ? idsFontes : [fontes[0].id]

  const resultados = []

  for (const idFonte of alvoPorFonte) {
    const fonte = fontes.find(f => f.id === idFonte) || fontes[0]
    // Dedup: a mesma linha pedida duas vezes no lote geraria ficha duplicada.
    const pedidas = [...new Set(
      alvos
        .filter(a => (a.fonte || fontes[0].id) === fonte.id)
        .map(a => Number(a.linha))
        .filter(n => Number.isFinite(n)),
    )]

    let faltantesPorLinha
    try {
      const planilha = await lerPlanilha(fonte, dias)
      const conciliacao = conciliarFichas({ linhas: planilha.linhas || [], fichas })
      // Reconferencia imediatamente antes de gravar: entre a verificacao e o
      // clique a ficha pode ter entrado (outro usuario importando, ou o n8n
      // voltando a funcionar) — sem isso, o botao duplicaria a ficha.
      faltantesPorLinha = new Map(conciliacao.faltantes.map(f => [Number(f.linha), f]))
    } catch (err) {
      for (const linha of pedidas) {
        resultados.push({ fonte: fonte.id, linha, ok: false, erro: String(err.message || err) })
      }
      continue
    }

    for (const linha of pedidas) {
      const faltante = faltantesPorLinha.get(linha)
      const nome = faltante ? extrairCampos(faltante.dados).nome : ''

      if (!fonte.webhook) {
        resultados.push({ fonte: fonte.id, linha, ok: false, nome, erro: 'Webhook do n8n nao configurado para esta fonte.' })
        continue
      }
      if (!faltante) {
        resultados.push({ fonte: fonte.id, linha, ok: false, nome, erro: 'Linha nao consta mais como faltante. Verifique novamente antes de importar.' })
        continue
      }

      try {
        const resposta = await comTimeout(fonte.webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(faltante.dados),
        })
        const corpo = await resposta.text()
        if (!resposta.ok) {
          throw new Error(`webhook respondeu ${resposta.status}: ${corpo.slice(0, 200)}`)
        }
        resultados.push({ fonte: fonte.id, linha, ok: true, nome })
      } catch (err) {
        resultados.push({ fonte: fonte.id, linha, ok: false, nome, erro: String(err.message || err) })
      }
    }
  }

  return {
    ok: true,
    importadas: resultados.filter(r => r.ok).length,
    falhas: resultados.filter(r => !r.ok).length,
    resultados,
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' })
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(res, 500, { error: 'Server not configured' })
  }

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    return json(res, 401, { error: 'Missing auth token' })
  }

  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await client.auth.getUser(token)
  if (userError || !userData?.user?.id) {
    return json(res, 401, { error: 'Invalid session' })
  }

  let fontes
  try {
    fontes = carregarFontes()
  } catch (err) {
    return json(res, 500, { error: `Configuracao invalida das fontes: ${String(err.message || err)}` })
  }

  if (!fontes.length) {
    return json(res, 503, {
      error: 'Nenhuma planilha configurada. Defina FICHAS_SHEET_URL e FICHAS_SHEET_TOKEN (ou FICHAS_SHEETS) nas variaveis de ambiente.',
    })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
  const dias = Math.min(Math.max(parseInt(body.dias, 10) || DIAS_PADRAO, 1), DIAS_MAX)
  const acao = body.acao === 'importar' ? 'importar' : 'verificar'

  try {
    const payload = acao === 'importar'
      ? await importar(client, fontes, dias, body.linhas)
      : await verificar(client, fontes, dias)
    return json(res, 200, payload)
  } catch (err) {
    return json(res, 400, { error: String(err.message || err) })
  }
}
