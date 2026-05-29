# Painel de Agentes — Conves Hub

Interface visual local para consultar os 4 agentes especializados do Conves Hub via Claude Code.

## Pré-requisitos

- Node.js instalado
- Claude Code instalado e autenticado (`claude --version`)
- Projeto ConvesSystem como diretório de trabalho

## Como rodar

```bash
cd painel-agentes
npm install
npm start
```

Abrir no browser: http://localhost:3001

## Comandos disponíveis

| Comando | Agente | O que faz |
|---------|--------|-----------|
| `/melhorias` | 💡 Melhorias | Lista melhorias priorizadas por impacto |
| `/sistemas [texto]` | 🔧 Sistemas | Arquitetura, banco, n8n, integrações |
| `/segurança [texto]` | 🛡️ Segurança | Auditoria e riscos |
| `/performance [texto]` | ⚡ Performance | Velocidade, queries, otimização |
| `/reuniao [tema]` | 🤝 Todos | Todos os agentes respondem em sequência |

## Arquitetura

```
browser (http://localhost:3001)
    ↕ WebSocket (ws://localhost:3001)
server.js (Node.js + ws)
    ↕ spawn + stdin/stdout
claude --print (Claude Code CLI)
```

## Exemplos de uso

```
/reuniao próxima fase do sistema
/sistemas como funciona o pipeline n8n?
/segurança revisar RLS das fichas
/performance queries sem paginação
/melhorias
```
