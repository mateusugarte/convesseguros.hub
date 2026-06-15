# CURRENT TASK

## Responsavel Atual

Codex

## Pagina

Base do sistema - tema global

## Objetivo

Garantir que o sistema carregue em tema claro por padrao e que o modo escuro so seja ativado quando o usuario selecionar explicitamente, sem alterar regras de negocio.

## Status

Concluido - bootstrap global de tema corrigido e validado por build em 2026-06-15

## Atualizacao de Execucao

- O bootstrap em `index.html` foi corrigido para nao forcar `dark` quando nao existe preferencia salva.
- `ThemeContext` ja nasce em `light` por padrao e continua permitindo troca manual.
- `Login` e `Configuracoes` ja foram alinhadas ao padrao visual claro.
- O build do projeto passou com `npm.cmd exec vite build -- --configLoader runner`.
- A validacao visual no browser in-app continua dependente de o alvo `iab` ficar disponivel.

## Arquivos em uso

- `docs/IA_ORCHESTRATOR.md`
- `docs/PROJECT_CONTEXT.md`
- `ROADMAP.md`
- `docs/CURRENT_TASK.md`
- `index.html`
- `src/pages/Login.jsx`
- `src/pages/Configuracoes.jsx`
- `src/contexts/ThemeContext.jsx`
- `src/components/Layout.jsx`

## Proximo Responsavel

Codex

## Proxima Tarefa

Seguir para a proxima auditoria visual de design nas telas restantes que ainda destoarem do shell premium, priorizando refinamentos de consistencia e largura nos modulos ja convertidos.

## Observacoes

O escopo desta trilha e visual e estrutural. Nao alterar regras de negocio, auth, rotas, banco ou contratos.

O escopo desta trilha continua visual e estrutural. Nao alterar regras de negocio, auth, rotas, banco ou contratos.

---

## Execucao Paralela - Agente B CRM Comercial

### Responsavel Atual

Codex - Agente B CRM Comercial

### Pagina

Modulo Comercial

### Objetivo

Mapear o estado atual do CRM comercial e definir um plano de redesign premium para dashboard, pipeline, base de leads, vendas, calendario, jornadas e lead detalhe, utilizando apenas a infraestrutura existente e componentes exclusivos do comercial.

### Status

Concluída - validada com build em 2026-06-15

## Atualizacao de Execucao

- O plano comercial premium permaneceu documentado como trilha paralela separada do núcleo operacional.
- `Jornadas` e o fluxo de React Flow seguem como próximo foco dessa frente quando ela for retomada.
- O build desta sessão continuou validado após as mudanças no núcleo operacional.
- A validação visual no browser in-app segue dependente de o alvo `iab` estar disponível.

## Arquivos em uso

- `docs/CURRENT_TASK.md`
- `artifacts/comercial_crm_redesign_plan.md`
- `src/components/comercial/`
- `src/pages/comercial/ComercialDashboard.jsx`
- `src/pages/comercial/Vendas.jsx`
- `src/pages/comercial/Pipeline.jsx`
- `src/pages/comercial/BaseLeads.jsx`
- `src/pages/comercial/LeadDetalhe.jsx`
- `src/pages/comercial/Calendario.jsx`
- `src/pages/comercial/Jornadas.jsx`
- `src/pages/comercial/ComercialDashboard/CONTEXT.md`
- `src/pages/comercial/Pipeline/CONTEXT.md`
- `src/pages/comercial/BaseLeads/CONTEXT.md`
- `src/pages/comercial/LeadDetalhe/CONTEXT.md`
- `src/pages/comercial/Vendas/CONTEXT.md`
- `src/pages/comercial/Calendario/CONTEXT.md`
- `src/pages/comercial/Jornadas/CONTEXT.md`

### Proximo Responsavel

Codex

### Proxima Tarefa

Retomar `Jornadas` e o React Flow comercial quando essa trilha voltar ao foco.

### Observacoes

Trilha paralela ao redesenho do nucleo operacional. Nao alterar Sidebar, Topbar, AppShell, Theme, Dashboard Geral, Fichas, Apolices, Relatorios, Imobiliarias, Seguradoras ou tokens globais.
Entrega inicial concluida com componentes exclusivos do comercial e redesign de `ComercialDashboard` e `Vendas`.
Build validado com `npm.cmd run build`. Validacao visual no Browser in-app nao foi concluida porque o alvo `iab` estava indisponivel nesta sessao.
Fases 3 e 4 concluidas com foco em `Pipeline`, `LeadDetalhe`, `BaseLeads` e `Calendario`.
Build validado novamente com `npm.cmd run build`. Validacao visual no Browser in-app segue pendente porque o alvo `iab` continuou indisponivel nesta sessao.
Execucao retomada para a Fase 5 com foco em `Jornadas` e React Flow premium dentro do modulo comercial.

---

## Agente C — Modulo Seguro Auto (NOVO)

### Responsavel Atual

Claude Code

### Pagina

Modulo Seguro Auto

### Objetivo

Implementar o modulo completo de Seguro Auto: 5 tabelas Supabase + triggers automaticos + 5 paginas React (Dashboard, Renovacoes, Emissoes, Cotacoes, Sinistros).

### Status

Concluido - build validado em 2026-06-15

### Atualizacao de Execucao

- Arquitetura definida: Opcao A (tabelas separadas por entidade).
- 5 tabelas criadas em `supabase/auto_tables.sql` (executar no Supabase).
- 2 triggers criados em `supabase/auto_triggers.sql` (executar no Supabase).
- RLS configurada em `supabase/auto_rls.sql` (executar no Supabase).
- `src/lib/auto.js` criado com todas as queries do modulo.
- 5 paginas React criadas em `src/pages/auto/`.
- Rotas registradas em `src/App.jsx`.
- Grupo "Auto" adicionado na sidebar em `src/components/Layout.jsx`.
- Build validado com `npm run build` sem erros.

### Arquivos criados/modificados

- `supabase/auto_tables.sql` (EXECUTAR NO SUPABASE)
- `supabase/auto_triggers.sql` (EXECUTAR NO SUPABASE)
- `supabase/auto_rls.sql` (EXECUTAR NO SUPABASE)
- `src/lib/auto.js`
- `src/pages/auto/AutoDashboard.jsx`
- `src/pages/auto/AutoRenovacoes.jsx`
- `src/pages/auto/AutoEmissoes.jsx`
- `src/pages/auto/AutoCotacoes.jsx`
- `src/pages/auto/AutoSinistros.jsx`
- `src/App.jsx` (rotas adicionadas)
- `src/components/Layout.jsx` (grupo Auto na sidebar)

### Proximo Responsavel

Codex

### Proxima Tarefa

Aplicar redesign premium nas paginas do modulo Auto seguindo o mesmo padrao visual do shell premium ja adotado nos outros modulos. Nao alterar logica, queries ou integracao.

### Pendencias

- Executar os 3 arquivos SQL no Supabase (tabelas, triggers, RLS)
- Validacao visual no browser apos execucao do SQL
