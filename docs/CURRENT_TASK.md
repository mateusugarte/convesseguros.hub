# CURRENT TASK

## Responsavel Atual

Codex

## Pagina

ImobiliariaDetalhe

## Objetivo

Executar a etapa de redesign premium de `ImobiliariaDetalhe`, elevando a tela de detalhe e mapeamento de códigos ao shell premium sem alterar regras de negocio, dados, queries ou integracoes.

## Status

Em andamento - imobiliaria detalhe premium iniciado em 2026-06-15

## Atualizacao de Execucao

- `ApolicesDashboard`, `ApolicesLista` e `ApoliceDetalhe` já foram convertidas para o shell premium e seguem validadas por build.
- `Imobiliarias` e `Seguradoras` foram convertidas para o shell premium e o build voltou a passar.
- `Relatorio` também foi convertido para o shell premium com `PageHeader`, `MetricCard` e `DataCard`.
- `Imobiliarias`, `Seguradoras` e `Relatorio` já estão no shell premium e o build desta etapa segue validado.
- O foco agora é reorganizar `ImobiliariaDetalhe` no shell premium sem mexer em lógica de edição, códigos ou integrações.
- A validação visual no browser in-app segue dependente do alvo `iab` ficar disponível.
- Próximo avanço: reescrever `ImobiliariaDetalhe` com `PageHeader`, `MetricCard` e `DataCard`.

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

Revisar visualmente `ImobiliariaDetalhe` no browser in-app quando o alvo `iab` estiver disponível e aplicar ajustes finos se necessário.

## Observacoes

Fase 4 concluída como base do shell operacional premium. Foco atual restrito a `ImobiliariaDetalhe`; comercial permanece fora do escopo desta trilha.

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




