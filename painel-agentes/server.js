const http = require('http')
const fs = require('fs')
const path = require('path')
const { WebSocketServer } = require('ws')
const { spawn } = require('child_process')

const PORT = 3001
const ROOT = path.join(__dirname, '..')

const SYSTEM_CONTEXT = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8')

function loadAgentContext(agentName) {
  const file = path.join(ROOT, `AGENT_${agentName.toUpperCase()}.md`)
  try { return fs.readFileSync(file, 'utf8') } catch { return '' }
}

function detectAgent(message) {
  const msg = message.toLowerCase()
  if (msg.startsWith('/sistemas') || msg.includes('banco') || msg.includes('n8n') || msg.includes('webhook') || msg.includes('supabase') || msg.includes('integra')) return 'sistemas'
  if (msg.startsWith('/segurança') || msg.startsWith('/seguranca') || msg.includes('risco') || msg.includes('vulnerab') || msg.includes('rls') || msg.includes('segur')) return 'seguranca'
  if (msg.startsWith('/performance') || msg.includes('lento') || msg.includes('velocidade') || msg.includes('responsiv') || msg.includes('query') || msg.includes('otimiz')) return 'performance'
  if (msg.startsWith('/melhorias') || msg.includes('melhoria') || msg.includes('ux') || msg.includes('experiencia') || msg.includes('feature') || msg.includes('funcionalidade')) return 'melhorias'
  if (msg.startsWith('/reuniao') || msg.startsWith('/reunião')) return 'reuniao'
  return 'sistemas'
}

function buildPrompt(message, agent) {
  const agentContext = loadAgentContext(agent === 'reuniao' ? 'sistemas' : agent)

  if (agent === 'reuniao') {
    const tema = message.replace(/\/reuni[aã]o/i, '').trim()
    return `${SYSTEM_CONTEXT}

Você é o orquestrador dos 4 agentes do Conves Hub.
Foi convocada uma reunião sobre: "${tema || 'estado geral do sistema'}"

Responda como CADA agente em sequência, usando EXATAMENTE este formato para cada um (uma linha por agente):
AGENTE: sistemas | [resposta focada do agente de sistemas — máx 4 linhas]
AGENTE: seguranca | [resposta focada do agente de segurança — máx 4 linhas]
AGENTE: performance | [resposta focada do agente de performance — máx 4 linhas]
AGENTE: melhorias | [resposta focada do agente de melhorias — máx 4 linhas]

Cada resposta deve ser direta, prática e com foco no tema.
Tema da reunião: ${tema || 'estado geral do sistema'}`
  }

  return `${SYSTEM_CONTEXT}

${agentContext}

Você é o Agente ${agent.toUpperCase()} do Conves Hub.
Responda usando o formato e comportamento definido no seu documento de skill.
SEMPRE comece a resposta com: AGENTE: ${agent} |

Pergunta/Solicitação: ${message}`
}

async function askClaude(prompt) {
  return new Promise((resolve, reject) => {
    // Usa claude --print passando o prompt via stdin para evitar problemas com args longos
    const claude = spawn('claude', ['--print', '--dangerously-skip-permissions'], {
      cwd: ROOT,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let output = ''
    let error = ''

    claude.stdin.write(prompt)
    claude.stdin.end()

    claude.stdout.on('data', (data) => { output += data.toString() })
    claude.stderr.on('data', (data) => { error += data.toString() })

    claude.on('close', (code) => {
      if (code === 0 || output.trim()) resolve(output.trim())
      else reject(new Error(error.trim() || `Claude encerrou com código ${code}`))
    })

    // Timeout de 90s
    const timer = setTimeout(() => {
      claude.kill()
      reject(new Error('Timeout: Claude Code não respondeu em 90s'))
    }, 90000)

    claude.on('close', () => clearTimeout(timer))
  })
}

// Servidor HTTP — serve index.html
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

// WebSocket
const wss = new WebSocketServer({ server })

wss.on('connection', (ws) => {
  console.log('[painel] cliente conectado')

  ws.on('message', async (data) => {
    let message
    try {
      message = JSON.parse(data).message
    } catch {
      message = data.toString()
    }

    if (!message || !message.trim()) return

    const agent = detectAgent(message)
    console.log(`[painel] agente: ${agent} | mensagem: ${message.slice(0, 60)}`)

    ws.send(JSON.stringify({ type: 'thinking', agent }))

    try {
      const prompt = buildPrompt(message, agent)
      const response = await askClaude(prompt)
      ws.send(JSON.stringify({ type: 'response', raw: response, agent }))
    } catch (err) {
      console.error('[painel] erro:', err.message)
      ws.send(JSON.stringify({ type: 'error', message: err.message, agent }))
    }
  })

  ws.on('close', () => console.log('[painel] cliente desconectado'))
  ws.on('error', (err) => console.error('[painel] ws error:', err.message))
})

server.listen(PORT, () => {
  console.log(`\n✅ Painel de Agentes rodando em http://localhost:${PORT}\n`)
})
