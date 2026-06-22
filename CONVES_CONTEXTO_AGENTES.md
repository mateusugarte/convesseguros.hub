# CONVES — Documento de Contexto para Agentes de IA
> Lido por Claude Code e Codex antes de qualquer sessão de trabalho.
> Fonte de verdade do projeto. Atualizar a cada decisão relevante.

---

## 1. QUEM É A CONVES

**Conves Corretora de Seguros** — 10+ anos de mercado, 3000+ clientes ativos, ~11 pessoas (9 funcionários + 2 gestores).

**Diferencial central:**
> *"A Conves resolve o que não é problema dela."*
A corretora assume o problema junto com o cliente, mesmo quando o erro não foi dela. Isso não é marketing — é o que acontece na prática e precisa virar cultura documentada.

**Produto principal:** Seguro Fiança — ~500 fichas/mês, ~200-250 apólices emitidas/mês
**Outros produtos:** Auto, Saúde PF/PJ, Consórcio, Incêndio, Vida
**Parceiros:** ~100 imobiliárias (50 ativas, 30 esporádicas)

**Equipe do sistema:**

| Usuário | Setor principal |
|---------|----------------|
| Davi | Fichas |
| Dayana | Emissões |
| Eduardo | Comercial |
| Mateus | Comercial + coordenação do sistema |
| Laís | Renovações |
| Marcos | Comercial |
| Luciano | Comercial |
| Patricia Dantas | Cadastro + Emissões |
| Patricia Barbara | Sinistros |

---

## 2. SISTEMA — CONVES HUB

Sistema interno que substitui planilhas por uma plataforma web estruturada com banco de dados real.

### Stack

```
Frontend:  React + Vite + Tailwind CSS + Lucide React
Banco:     Supabase (PostgreSQL + Auth + RLS + Realtime)
Automação: n8n self-hosted
Deploy:    Vercel
Agentes:   Claude Code (backend/infraestrutura) + Codex (UI/frontend)
```

### Repositório

```
C:\ConvesSystem\   ← clonar diretamente em C:\ (evitar paths com espaço)
```

### Webhooks n8n ativos

```
Residencial PF:  /webhook/e8ed448d-ac27-4b52-91d0-b846d5628d15
Comercial PF:    /webhook/399752ad-6715-4e39-bef7-d61f900cddb4
Pessoa Jurídica: /webhook/1a03d494-e0a6-4039-b1e0-3a56bf9f7d6f
```

### Módulos do sistema (ordem de prioridade)

| # | Módulo | Status |
|---|--------|--------|
| 1 | Fichas (Kanban) | ✅ em desenvolvimento |
| 2 | Emissões (Apólices) | ⏳ próxima fase |
| 3 | Renovações | ⏳ planejado |
| 4 | Comercial (CRM) | ⏳ planejado |
| 5 | Cadastro de Imobiliárias | ⏳ área básica feita |
| 6 | Sinistros | ⏳ futuro |

---

## 3. BANCO DE DADOS — MODELO DE DADOS

### Tabela `fichas` (principal)

```sql
id, created_at, produto, imobiliaria, nome_interessado,
nome_empresa, cpf, cnpj, cpf_socios, celular, email,
cep, valor_aluguel, valor_iptu, valor_condominio,
tipo_imovel, observacoes, orcamentista_forms,
atividade, opcao_tributaria, total_rendimentos,
capital_social, motivo_locacao, vigencia,
status, assumida, orcamentista_id, assumida_em,
seguradora, retorno_enviado, finalizada_em, raw_data
```

**Campo `produto` — valores válidos:**
```
residencial_pf | comercial_pf | pessoa_juridica
```

**Campo `status` — fluxo:**
```
pendente → em_cotacao → em_analise | aprovado | recusado | emitido | cancelado | cpf_invalido | expirada
```

**Fichas em aberto:** todos os status exceto `em_analise`, `aprovado`, `recusado`
**Fichas passadas:** `em_analise`, `aprovado`, `recusado`

### Tabela `profiles`
```sql
id (UUID → auth.users), nome, orcamentista_label, created_at
```

### Tabelas planejadas
- `apolices` — emissões (próxima fase)
- `imobiliarias` — parceiros
- `comercial_leads` — pipeline comercial
- `comercial_campanhas` — campanhas

### Regras de negócio críticas

1. Qualquer usuário autenticado pode **assumir** ficha em aberto não assumida
2. Ao assumir: `assumida=true`, `orcamentista_id=auth.uid()`, `status=em_cotacao`, `assumida_em=NOW()`
3. Só o orçamentista que assumiu pode **finalizar**
4. `orcamentista_forms` é o nome selecionado no Google Forms — não tem relação com o login
5. **Imobiliárias são parceiros de canal, não clientes** — distinção crítica no modelo

### RLS (Row Level Security) — NUNCA desabilitar

```
fichas: SELECT (authenticated) | INSERT (service_role via n8n) | UPDATE (authenticated)
profiles: SELECT (authenticated) | UPDATE (próprio perfil)
```

---

## 4. REGRAS DE CÓDIGO — OBRIGATÓRIAS

### Segurança
- `service_role key` → apenas no n8n. **Nunca no frontend.**
- `anon key` → apenas no frontend
- RLS ativa em **todas** as tabelas. Nunca desabilitar.
- Variáveis de ambiente para todas as credenciais
- Dados pessoais (CPF, CNPJ, celular) → mascarar na UI

### Queries Supabase — padrão obrigatório
```javascript
// ✅ CORRETO — campos específicos + paginação
const { data, count } = await supabase
  .from('fichas')
  .select('id, nome_interessado, imobiliaria, status, created_at', { count: 'exact' })
  .range(page * 50, (page + 1) * 50 - 1)
  .order('created_at', { ascending: false })

// ❌ ERRADO — SELECT * sem paginação
const { data } = await supabase.from('fichas').select('*')
```

### Kanban — regras absolutas
- Colunas **sempre abertas**, nunca colapsar
- Scroll interno por coluna (`overflow-y: auto` por coluna)
- Board: `height: calc(100vh - 200px)`
- Drag com `@dnd-kit/core` — proteger Realtime com `isDraggingRef` durante drag

### Componentes React
- Funcionais, sem over-engineering
- Comentar toda lógica de negócio
- Rota nova → React.lazy() obrigatório

---

## 5. DESIGN SYSTEM — CONVES HUB

```css
/* Cores principais */
PRIMARY:    #1A3A6B   /* azul escuro — logo Conves */
SECONDARY:  #2B5BA8   /* azul médio */
ACCENT:     #4A90D9   /* azul claro — destaque */
GOLD:       #C9A84C   /* dourado — estrela da logo */

/* Fundos */
BG_DARK:    #0A0F1E   /* sidebar / painéis escuros */
BG_LIGHT:   #FFFFFF

/* Status */
SUCCESS:    #10B981
WARNING:    #F59E0B
DANGER:     #EF4444
INFO:       #3B82F6
```

**Navegação (Sidebar):** Dark Workspace — dual-column (rail de ícones + painel expandido), fundos escuros, sem bibliotecas de ícone externas (SVGs próprios).

**Referências visuais:** Linear, Notion, Vercel — SaaS enterprise clean.

---

## 6. AGENTES DO SISTEMA

O projeto usa 4 agentes especializados (definidos em `AGENTS.md`):

| Agente | Símbolo | Papel | Gatilho |
|--------|---------|-------|---------|
| Sistemas | 🔧 | Arquitetura, banco, n8n, integrações | `/sistemas` |
| Segurança | 🛡️ | Monitora TODA alteração. Tem poder de veto. | automático |
| Performance | ⚡ | Velocidade, responsividade, queries | `/performance` |
| Melhorias | 💡 | UX, features, experiência do usuário | `/melhorias` |

**Regra de ouro:** Agente de Segurança tem poder de veto. Nenhuma execução prossegue com alerta ativo sem aprovação explícita do Mateus.

---

## 7. ESTADO ATUAL DO DESENVOLVIMENTO

### O que está feito
- Banco Supabase configurado (fichas, profiles, RLS, índices)
- Webhooks n8n ativos para os 3 produtos
- Autenticação com Supabase Auth
- Kanban de fichas com drag-and-drop (`@dnd-kit`)
- Sidebar dark com navegação por módulos
- Módulo comercial em construção (`comercial_leads`, `comercial_campanhas`)
- Editor de jornadas com ReactFlow (canvas + biblioteca + configuração)
- Área básica de cadastro de imobiliárias

### Bugs e pendências conhecidas

**Kanban — drag bug:**
Supabase Realtime dispara UPDATE durante o drag, resetando estado via `setFichas()`.
Fix: `isDraggingRef` bloqueando handlers Realtime durante drag ativo — togglear em `onDragStart`/`onDragEnd`/`onDragCancel`.

**Jornadas — layout bug:**
Sidebars sobrepondo o canvas ao invés de ficarem ao lado.
Fix: CSS/layout apenas — flex ou grid three-column no elemento pai.

**Queries:**
Refatorar SELECT * com paginação em todas as queries de listagem.

### Próximas entregas (ordem)
1. Corrigir `isDraggingRef` no Kanban
2. Corrigir layout do editor de Jornadas
3. Adicionar `campanha_id` em `comercial_leads`
4. Banner de campanhas ativas no Dashboard
5. Construir tabela `apolices` (desbloqueia módulo Emissões)
6. Automações n8n de renovação (SOP-02)

---

## 8. PROTOCOLO DE TRABALHO COM AGENTES

### Para Claude Code

**Antes de qualquer execução:**
1. Ler `CLAUDE.md` + `AGENTS.md` + arquivo de contexto do módulo atual
2. Carregar skill `token-efficiency` obrigatoriamente
3. Ler todos os arquivos relevantes antes de tocar em qualquer um

**Fluxo de execução:**
```
PLANO → aguardar aprovação → EXECUTAR → DONE
```

**Nunca tocar sem aprovação:**
- Business logic, queries Supabase, RLS policies, hooks, autenticação
- SQL migrations: apresentar antes de rodar

**Formato de output:**
```
PLANO: [lista numerada do que será feito]
SKILLS: [skill] → [por quê]
[aguardar aprovação]
---
EXECUTANDO...
---
DONE: [o que foi feito, arquivos modificados]
```

**Budget:** 40 tool calls por sessão. Checkpoint obrigatório em 30.

### Para Codex (UI/frontend)

- Foco em UI/visual — não tocar em lógica de negócio
- Liberdade criativa dentro do design system definido (seção 5)
- Ler arquivos relevantes antes de modificar
- Componentes com erros visuais acumulados: deletar e reescrever (não patchar)
- Nunca reescrever lógica de negócio ao refatorar UI

### Divisão de trabalho paralelo

| Tipo de tarefa | Agente |
|---------------|--------|
| UI, componentes, visual, CSS | Codex |
| Backend, banco, n8n, integrações | Claude Code |
| Arquitetura, decisões técnicas | Claude Code |
| Design system, experiência | Codex |

---

## 9. MÓDULO COMERCIAL — CONTEXTO ADICIONAL

### Funil de cross-sell
```
Cliente PF:  Fiança → Auto → Saúde PF → Consórcio → Vida
Cliente PJ:  qualquer entrada → Saúde Coletiva → Consórcio PJ
```

### Pipeline de status
```
NOVO → EM CONTATO → PROPOSTA ENVIADA → NEGOCIAÇÃO → FECHADO | PAUSADO
```

### Método de vendas C.O.N.V.E.S.
| Etapa | Objetivo |
|-------|----------|
| **C** Conexão | Rapport, nunca vender no 1º contato |
| **O** Observação | 3 perguntas de qualificação |
| **N** Necessidade | Cliente verbaliza a dor |
| **V** Valor | Solução como consequência da dor |
| **E** Evidência | 10 anos, 3000 clientes, casos resolvidos |
| **S** Solicitação | Próximo passo com data — nunca terminar sem compromisso |

### 3 fontes de lead
1. **Carteira ativa** — 800-1000 clientes Tier 1 (resultado imediato)
2. **Imobiliárias** — reativar 30 esporádicas + novas por indicação (30-60 dias)
3. **Outbound PJ** — saúde coletiva, locatários para auto (60-90 dias)

---

## 10. DECISÕES ARQUITETURAIS JÁ TOMADAS — NÃO REVERTER

```
✅ Supabase como banco principal (PostgreSQL + RLS + Realtime)
✅ n8n self-hosted para automações
✅ Google Forms → Apps Script → n8n → Supabase como pipeline de entrada
✅ React + Vite + Tailwind no frontend
✅ Vercel para deploy de produção
✅ @dnd-kit/core para drag-and-drop no Kanban
✅ ReactFlow v11 para editor de jornadas
✅ TanStack Query para cache e estado de servidor
✅ service_role key APENAS no n8n — nunca no frontend
✅ RLS ativa em todas as tabelas — nunca desabilitar
✅ Sidebar Dark Workspace (dual-column: rail + painel)
✅ Imobiliárias = parceiros de canal, não clientes (distinção crítica no modelo)
```

---

## 11. CÉREBRO CONVES (projeto paralelo)

Base de conhecimento em **Obsidian** conectada ao Claude Code.

**Estrutura:**
```
00-IDENTIDADE      → diferencial, produtos, perfis de cliente, método C.O.N.V.E.S.
01-CONHECIMENTO    → metodologias (Hormozi, Cialdini, SPIN)
02-OPERACIONAL     → SOPs (sinistro, renovação, onboarding de imobiliária)
03-MEMORIA-VIVA    → casos resolvidos, decisões estratégicas, aprendizados do time
04-CEREBRO-CONVES  → instruções de uso com Claude Code
```

**Script de carga:** `cerebro_conves_setup.py` — cria toda a estrutura no vault e gera loader Python para injetar contexto como system prompt.

**Uso:** `python carregar_cerebro.py --secao todas` → gera system prompt completo para sessão contextualizada.

---

*Documento vivo. Atualizar após cada decisão arquitetural, novo módulo iniciado ou mudança de rota.*
*Última atualização: 2026-06-22*
