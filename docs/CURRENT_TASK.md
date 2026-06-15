# CURRENT TASK

## Responsavel Atual

Codex

## Pagina

Layout global

## Objetivo

Corrigir o layout global do sistema para remover a faixa em branco lateral e fazer as areas ocuparem toda a largura disponivel sem alterar regras de negocio, dados, queries ou integracoes.

## Status

Em andamento - ajuste global de layout iniciado em 2026-06-15

## Atualizacao de Execucao

- O shell global foi reestruturado para manter a sidebar em fluxo no desktop e o conteúdo em `flex-1`, eliminando a faixa lateral residual.
- O overlay da sidebar segue apenas no mobile, sem reservar espaço vazio no workspace.
- O build será revalidado após a correção.
- A validação visual final no browser in-app segue dependente do alvo `iab` ficar disponível.

## Arquivos em uso

- `docs/IA_ORCHESTRATOR.md`
- `docs/PROJECT_CONTEXT.md`
- `ROADMAP.md`
- `docs/CURRENT_TASK.md`
- `src/index.css`
- `src/styles/tokens.css`
- `tailwind.config.js`
- `src/components/Layout.jsx`
- `src/components/KanbanFichas.jsx`
- `src/components/KanbanBoard.jsx`
- `src/components/ui/Button.jsx`
- `src/components/ui/Card.jsx`
- `src/components/ui/FormFields.jsx`
- `src/components/ui/Modal.jsx`
- `src/components/ui/index.js`
- `src/components/ui/PageHeader.jsx`
- `src/components/ui/MetricCard.jsx`
- `src/components/ui/DataCard.jsx`
- `src/components/ui/SectionHeading.jsx`
- `src/components/ui/EmptyState.jsx`
- `src/components/ui/FilterBar.jsx`
- `src/components/ui/DatePicker.jsx`
- `src/components/ui/Select.jsx`
- `src/components/ui/WorkspacesSelect.jsx`
- `artifacts/adr_core_system_design_operational_redesign.md`
- `src/pages/Dashboard.jsx`
- `src/pages/Dashboard/CONTEXT.md`
- `src/lib/fichas.js`
- `src/pages/Fichas.jsx`
- `src/pages/Fichas/CONTEXT.md`
- `src/pages/MinhasFichas.jsx`
- `src/pages/MinhasFichas/CONTEXT.md`
- `src/components/KanbanFichas.jsx`
- `src/components/KanbanBoard.jsx`
- `src/components/DetalhesFicha.jsx`
- `src/components/ModalFicha.jsx`
- `src/components/ModalFinalizar.jsx`
- `src/components/ModalAssumir.jsx`

## Proximo Responsavel

Codex

## Proxima Tarefa

Revalidar visualmente o sistema no browser in-app quando o alvo `iab` estiver disponível e confirmar que a faixa lateral em branco sumiu.

## Observacoes

Este ajuste é global e impacta todas as páginas do shell operacional. Comercial permanece fora do escopo desta trilha.

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


