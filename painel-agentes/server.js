const http = require('http')
const fs = require('fs')
const path = require('path')
const { WebSocketServer } = require('ws')
const { spawn } = require('child_process')

const PORT = 3001
const ROOT = path.join(__dirname, '..')
const MAX_HISTORY = 30  // máx de entradas para não explodir o contexto

const SYSTEM_CONTEXT = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8')

const AGENT_LABELS = {
  sistemas:    'AGENTE SISTEMAS 🔧',
  seguranca:   'AGENTE SEGURANÇA 🛡️',
  performance: 'AGENTE PERFORMANCE ⚡',
  melhorias:   'AGENTE MELHORIAS 💡',
}

function loadAgentContext(agentName) {
  const file = path.join(ROOT, `AGENT_${agentName.toUpperCase()}.md`)
  try { return fs.readFileSync(file, 'utf8') } catch { return '' }
}

function normalizeAgent(name) {
  const n = name.toLowerCase().trim()
  if (n.includes('sist')) return 'sistemas'
  if (n.includes('seg') || n.includes('guard')) return 'seguranca'
  if (n.includes('perf') || n.includes('veloc')) return 'performance'
  if (n.includes('melh') || n.includes('ux')) return 'melhorias'
  return n
}

function detectAgent(message) {
  const msg = message.toLowerCase()
  if (msg.startsWith('/sistemas') || msg.includes('banco') || msg.includes('n8n') || msg.includes('webhook') || msg.includes('supabase') || msg.includes('integra')) return 'sistemas'
  if (msg.startsWith('/segurança') || msg.startsWith('/seguranca') || msg.includes('risco') || msg.includes('vulnerab') || msg.includes('rls')) return 'seguranca'
  if (msg.startsWith('/performance') || msg.includes('lento') || msg.includes('velocidade') || msg.includes('responsiv') || msg.includes('query') || msg.includes('otimiz')) return 'performance'
  if (msg.startsWith('/melhorias') || msg.includes('melhoria') || msg.includes('feature') || msg.includes('funcionalidade')) return 'melhorias'
  if (msg.startsWith('/reuniao') || msg.startsWith('/reunião')) return 'reuniao'
  return 'sistemas'
}

// Formata o histórico em bloco de texto legível para o Claude
function formatHistory(history) {
  if (!history.length) return ''

  const lines = history.map(entry => {
    if (entry.role === 'user') return `[USUÁRIO]: ${entry.text}`
    const label = AGENT_LABELS[entry.agent] || `AGENTE ${entry.agent.toUpperCase()}`
    return `[${label}]: ${entry.text}`
  })

  return `
=== HISTÓRICO DA CONVERSA ===
${lines.join('\n\n')}
=== FIM DO HISTÓRICO — responda considerando tudo acima ===
`
}

// Remove prefixo "AGENTE: xxx |" para guardar texto limpo no histórico
function extractCleanText(raw) {
  const match = raw.match(/^AGENTE:\s*\w+\s*\|\s*/im)
  if (match) return raw.slice(match.index + match[0].length).trim()
  return raw.trim()
}

function buildPrompt(message, agent, history) {
  const historyBlock = formatHistory(history)

  if (agent === 'reuniao') {
    const tema = message.replace(/\/reuni[aã]o/i, '').trim() || 'estado geral do sistema'
    const allContexts = ['sistemas', 'seguranca', 'performance', 'melhorias']
      .map(a => loadAgentContext(a))
      .join('\n\n---\n\n')

    return `${SYSTEM_CONTEXT}

${allContexts}
${historyBlock}
Você é o orquestrador dos 4 agentes do Conves Hub.
Foi convocada uma reunião sobre: "${tema}"

Considere o histórico completo da conversa acima ao formular as respostas de cada agente.

Responda como CADA agente em sequência — EXATAMENTE neste formato (uma linha por agente, sem quebras de linha extras entre elas):
AGENTE: sistemas | [resposta — máx 4 linhas]
AGENTE: seguranca | [resposta — máx 4 linhas]
AGENTE: performance | [resposta — máx 4 linhas]
AGENTE: melhorias | [resposta — máx 4 linhas]

Tema: ${tema}`
  }

  const agentContext = loadAgentContext(agent)

  return `${SYSTEM_CONTEXT}

${agentContext}
${historyBlock}
Você é o Agente ${agent.toUpperCase()} do Conves Hub.
Responda usando o formato e comportamento definido no seu documento de skill.
SEMPRE comece a resposta com: AGENTE: ${agent} |
Use o histórico da conversa para dar respostas coerentes e conectadas ao que já foi discutido.

Nova mensagem: ${message}`
}

async function askClaude(prompt) {
  return new Promise((resolve, reject) => {
    const claude = spawn('claude', ['--print', '--dangerously-skip-permissions'], {
      cwd: ROOT,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let output = ''
    let error = ''

    claude.stdin.write(prompt)
    claude.stdin.end()

    claude.stdout.on('data', (d) => { output += d.toString() })
    claude.stderr.on('data', (d) => { error += d.toString() })

    const timer = setTimeout(() => {
      claude.kill()
      reject(new Error('Timeout: Claude Code não respondeu em 90s'))
    }, 90000)

    claude.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0 || output.trim()) resolve(output.trim())
      else reject(new Error(error.trim() || `Claude encerrou com código ${code}`))
    })
  })
}

// HTTP — serve index.html
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'))
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
    return
  }
  res.writeHead(404)
  res.end('Not found')
})

// WebSocket com histórico por conexão
const wss = new WebSocketServer({ server })
const connectionHistory = new Map()

wss.on('connection', (ws) => {
  connectionHistory.set(ws, [])
  console.log('[painel] cliente conectado')

  ws.on('message', async (data) => {
    let parsed
    try { parsed = JSON.parse(data) } catch { parsed = { message: data.toString() } }

    // Comando para limpar histórico
    if (parsed.type === 'clear') {
      connectionHistory.set(ws, [])
      ws.send(JSON.stringify({ type: 'cleared' }))
      console.log('[painel] histórico limpo')
      return
    }

    const message = parsed.message
    if (!message || !message.trim()) return

    const history = connectionHistory.get(ws) || []
    const agent = detectAgent(message)
    console.log(`[painel] agente: ${agent} | histórico: ${history.length} | msg: ${message.slice(0, 60)}`)

    // Registra mensagem do usuário antes de chamar o Claude
    history.push({ role: 'user', text: message })

    ws.send(JSON.stringify({ type: 'thinking', agent }))

    try {
      const prompt = buildPrompt(message, agent, history)
      const raw = await askClaude(prompt)

      // Adiciona resposta(s) ao histórico
      if (agent === 'reuniao') {
        const lineRegex = /^AGENTE:\s*(\w+)\s*\|\s*(.+)/gim
        const matches = [...raw.matchAll(lineRegex)]
        if (matches.length) {
          matches.forEach(m => {
            history.push({ role: 'agent', agent: normalizeAgent(m[1]), text: m[2].trim() })
          })
        } else {
          history.push({ role: 'agent', agent: 'orquestrador', text: raw })
        }
      } else {
        history.push({ role: 'agent', agent, text: extractCleanText(raw) })
      }

      // Trunca histórico se estiver muito longo
      if (history.length > MAX_HISTORY) {
        history.splice(0, history.length - MAX_HISTORY)
      }

      connectionHistory.set(ws, history)
      ws.send(JSON.stringify({ type: 'response', raw, agent }))

    } catch (err) {
      console.error('[painel] erro:', err.message)
      // Reverte a mensagem do usuário se deu erro
      history.pop()
      connectionHistory.set(ws, history)
      ws.send(JSON.stringify({ type: 'error', message: err.message, agent }))
    }
  })

  ws.on('close', () => {
    connectionHistory.delete(ws)
    console.log('[painel] cliente desconectado')
  })

  ws.on('error', (err) => console.error('[painel] ws error:', err.message))
})

server.listen(PORT, () => {
  console.log(`\n✅ Painel de Agentes rodando em http://localhost:${PORT}\n`)
})
