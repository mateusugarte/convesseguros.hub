# CURRENT TASK

## Responsavel Atual

Claude

## Pagina

`src/pages/auto/AutoEmissoes.jsx`

## Objetivo

Redesign completo do kanban de emissoes Auto com: detalhe do cliente, resultado da cotacao, seguradoras cotadas, cores por tipo.

## Status

Implementado — aguardando execucao da migracao SQL e teste pelo usuario.

## Proxima Acao OBRIGATORIA

Nenhuma pendente.

## Alteracoes Realizadas

### Reorganizacao de pastas (root) — 2026-06-16

**Problema:** raiz do projeto estava com 30+ arquivos soltos (SQLs de import, CSVs, video, docs de agentes, script .mjs).

**Solucao — arquivos movidos:**

| De (root) | Para |
|-----------|------|
| `apolices_parte*.sql` (5 arquivos) | `data/imports/` |
| `import_*.sql` (8 arquivos) | `data/imports/` |
| `update_seg_*.sql` (5 arquivos) | `data/imports/` |
| `fichas_residencial_90dias.sql` | `data/imports/` |
| `*.csv` (4 arquivos) | `data/assets/` |
| `*.mp4` (1 arquivo) | `data/assets/` |
| `AGENT_*.md` + `AGENTS.md` + `PILARES.md` | `docs/agents/` |
| `importar_apolices.mjs` | `scripts/` |

**Root apos limpeza contem apenas:**
`CLAUDE.md`, `ROADMAP.md`, `index.html`, `package.json`, `package-lock.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `vercel.json`, `settings.json`, `.env.*`, `.gitignore`

**Nenhum arquivo de codigo foi alterado. Nenhum import quebrado.**

### Migracoes SQL anteriores (sessao de hoje)

- `supabase/16_cotacoes_cliente_direto.sql` — muda cliente_id para TEXT, adiciona campos de cliente em cotacoes_auto
- `supabase/17_cotacoes_status_aberta.sql` — adiciona 'aberta' na constraint de status
- `supabase/18_fix_emissoes_completo.sql` — consolida tudo + recria trigger + backfill emissoes (EXECUTADO)

## Observacoes

- `supabase/` continua com os arquivos de migracao numerados — pasta ja estava bem organizada
- Pages em `src/pages/` nao foram movidas pois usam imports relativos (`'../lib/...'`) que quebrariam
