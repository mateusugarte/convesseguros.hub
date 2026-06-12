# Plano de Redesign - CRM Comercial Premium

## Etapa

Diagnostico e planejamento

## Escopo confirmado

- Redesenhar apenas o modulo comercial.
- Preservar `Sidebar`, `Topbar`, `AppShell`, `Theme`, `Dashboard Geral`, `Fichas`, `Apolices`, `Relatorios`, `Imobiliarias`, `Seguradoras` e o design system global.
- Reutilizar a infraestrutura atual de dados em `src/lib/comercial.js`.
- Criar apenas componentes exclusivos do comercial.

## Diagnostico tecnico

- O modulo comercial ja possui boa base funcional e um contrato de dados centralizado em `src/lib/comercial.js`.
- As telas estao monoliticas e concentram UI, estados locais e subcomponentes inline na mesma pagina.
- O CRM ainda nao tem uma camada propria de componentes premium reutilizaveis.
- O React Flow de jornadas e lead detalhe ja existe e pode ser evoluido sem alterar regras.

## Monolitos atuais mapeados

- `src/pages/comercial/ComercialDashboard.jsx`: 715 linhas
- `src/pages/comercial/Pipeline.jsx`: 790 linhas
- `src/pages/comercial/BaseLeads.jsx`: 648 linhas
- `src/pages/comercial/LeadDetalhe.jsx`: 1123 linhas
- `src/pages/comercial/Vendas.jsx`: 212 linhas
- `src/pages/comercial/Calendario.jsx`: 660 linhas
- `src/pages/comercial/Jornadas.jsx`: 999 linhas

## Estrategia de execucao

### Fase 1 - Fundacao visual exclusiva do comercial

- Criar `src/components/comercial/` como biblioteca isolada do CRM.
- Extrair shells, cards, headers, paineis laterais e estados vazios do modulo comercial.
- Criar uma linguagem visual premium propria do CRM sem tocar em tokens globais.
- Padronizar microinteracoes, densidade visual, grids e hierarquia de informacao.

### Fase 2 - Dashboard Comercial e Vendas

- Transformar `ComercialDashboard.jsx` em central de vendas.
- Criar topo de indicadores, centro analitico, painel de atividades e resumo do pipeline.
- Evoluir `Vendas.jsx` para um dashboard executivo com metas, ranking e performance.

### Fase 3 - Pipeline e Lead Detalhe

- Reestruturar o pipeline com colunas premium, resumo por coluna, valor potencial e indicadores operacionais.
- Criar card de lead mais rico com score, origem, responsavel, ultima atividade e proxima acao.
- Redesenhar `LeadDetalhe.jsx` com header executivo, centro por abas e lateral premium de score, insights e pendencias.
- Manter `leadMover`, `leadUpdate`, `saleAdd`, `eventAdd` e demais acoes existentes.

### Fase 4 - Base de Leads e Calendario

- Reorganizar `BaseLeads.jsx` com filtros persistentes, segmentacoes, tags e modos de visualizacao mais claros.
- Redesenhar `Calendario.jsx` com visoes diaria, semanal e mensal mais sofisticadas, mantendo a logica atual de eventos.
- Melhorar navegacao, busca, leitura de densidade e feedbacks de selecao.

### Fase 5 - Jornadas e React Flow

- Preservar toda a logica atual de jornadas.
- Evoluir apenas nodes, conexoes, espacamento, mini painel e configuracao lateral.
- Aproximar a experiencia do n8n com acabamento mais corporativo.

### Fase 6 - Polimento e responsividade

- Ajustar desktop, notebook e tablet.
- Refinar hover, active states, transicoes e empty states.
- Validar consistencia entre dashboard, pipeline, lead detalhe, calendario e jornadas.

## Componentes previstos

- `src/components/comercial/CrmPageHeader.jsx`
- `src/components/comercial/CrmMetricCard.jsx`
- `src/components/comercial/CrmSectionCard.jsx`
- `src/components/comercial/CrmActivityFeed.jsx`
- `src/components/comercial/CrmScorePanel.jsx`
- `src/components/comercial/CrmLeadIdentityCard.jsx`
- `src/components/comercial/CrmPipelineLane.jsx`
- `src/components/comercial/CrmPipelineLeadCard.jsx`
- `src/components/comercial/CrmFilterBar.jsx`
- `src/components/comercial/CrmEmptyState.jsx`
- `src/components/comercial/CrmCalendarHeader.jsx`
- `src/components/comercial/CrmJourneyNode.jsx`
- `src/components/comercial/CrmJourneySidebar.jsx`

## Regras de seguranca de escopo

- Nao alterar `src/components/Layout.jsx`.
- Nao alterar `tailwind.config.js`.
- Nao alterar componentes de `src/components/ui/` sem necessidade critica.
- Nao alterar contratos, rotas, auth ou consultas do Supabase sem aprovacao explicita.

## Ordem recomendada

1. Fundacao visual comercial
2. Dashboard Comercial
3. Vendas
4. Pipeline
5. Lead Detalhe
6. Base de Leads
7. Calendario
8. Jornadas
9. Polimento final

## Documentacao desta etapa

### Componentes criados

- `src/components/comercial/CrmPageHeader.jsx`
- `src/components/comercial/CrmMetricCard.jsx`
- `src/components/comercial/CrmSectionCard.jsx`
- `src/components/comercial/CrmEmptyState.jsx`
- `src/components/comercial/CrmSegmentedControl.jsx`
- `src/components/comercial/CrmAvatarBadge.jsx`
- `src/components/comercial/index.js`

### Componentes alterados

- `src/pages/comercial/ComercialDashboard.jsx`
- `src/pages/comercial/Vendas.jsx`
- `src/pages/comercial/Pipeline.jsx`
- `src/pages/comercial/LeadDetalhe.jsx`
- `src/pages/comercial/BaseLeads.jsx`
- `src/pages/comercial/Calendario.jsx`

### Arquivos alterados

- `docs/CURRENT_TASK.md`
- `artifacts/comercial_crm_redesign_plan.md`
- `src/components/comercial/CrmPageHeader.jsx`
- `src/components/comercial/CrmMetricCard.jsx`
- `src/components/comercial/CrmSectionCard.jsx`
- `src/components/comercial/CrmEmptyState.jsx`
- `src/components/comercial/CrmSegmentedControl.jsx`
- `src/components/comercial/CrmAvatarBadge.jsx`
- `src/components/comercial/index.js`
- `src/pages/comercial/ComercialDashboard.jsx`
- `src/pages/comercial/Vendas.jsx`
- `src/pages/comercial/Pipeline.jsx`
- `src/pages/comercial/LeadDetalhe.jsx`
- `src/pages/comercial/BaseLeads.jsx`
- `src/pages/comercial/Calendario.jsx`

### Melhorias UX planejadas

- Leitura executiva imediata no dashboard.
- Menor friccao operacional em pipeline, agenda e detalhe do lead.
- Melhor hierarquia visual para atividades, score, proxima acao e pendencias.

### Melhorias UI planejadas

- Camada visual premium exclusiva do CRM.
- Cards, paineis e listas com densidade corporativa.
- React Flow comercial com aparencia mais sofisticada.

### Ganhos operacionais esperados

- Gestor entende a operacao em poucos segundos.
- Time comercial executa follow-up com menos cliques e menos ambiguidade.
- Maior consistencia entre pipeline, agenda, lead detalhe e vendas.

---

## Execucao atual

### Etapas entregues

- Fase 1 - Fundacao visual exclusiva do comercial
- Fase 2 - Dashboard Comercial e Vendas

### Melhorias UX entregues

- Header executivo dedicado para o CRM comercial com CTA contextual.
- Indicadores com leitura instantanea de operacao, conversao, ticket medio, atividades e ranking.
- Dashboard reorganizado em estrutura executiva: topo de indicadores, centro analitico, lateral operacional e base com pipeline overview.
- Pagina de vendas convertida em cockpit executivo com metas, ranking, performance por produto e modal de registro mais rico.

### Melhorias UI entregues

- Biblioteca visual exclusiva do comercial sem tocar em `Sidebar`, `Topbar`, `AppShell`, tema ou tokens globais.
- Cards premium com hierarquia mais corporativa e superfices dedicadas ao CRM.
- Graficos e blocos executivos consistentes entre dashboard e vendas.

### Ganhos operacionais entregues

- Melhor leitura de volume, gargalo e performance sem sair do modulo comercial.
- Meta comercial agora ajustavel diretamente na tela de vendas usando a infraestrutura local existente.
- Vendas e dashboard passam a compartilhar linguagem visual e componentes proprios do CRM.

### Validacao

- `npm.cmd run build` executado com sucesso.
- Validacao visual no Browser in-app nao foi concluida porque o alvo `iab` estava indisponivel nesta sessao.

---

## Execucao complementar

### Etapas entregues

- Fase 3 - Pipeline e Lead Detalhe
- Fase 4 - Base de Leads e Calendario

### Melhorias UX entregues

- `Pipeline` ganhou leitura executiva com metricas, overview por etapa e painel lateral de atencao sem alterar drag and drop.
- `LeadDetalhe` foi reorganizado com header executivo, metricas-chave, funil visivel e centro por abas em shell premium.
- `BaseLeads` passou a operar com topografia mais clara entre segmentacao, filtros ativos, recorte da base e tabela operacional.
- `Calendario` ganhou visoes diaria, semanal e mensal com apresentacao mais corporativa e navegação consistente.

### Melhorias UI entregues

- Reuso da biblioteca exclusiva `src/components/comercial/` nas quatro telas.
- Novos shells de secao, hero, metricas e paineis aplicados ao CRM sem tocar na camada global.
- Cards de lead no pipeline mais ricos, com ultima atividade, proxima acao e resumo visivel.

### Ganhos operacionais entregues

- Gestor enxerga gargalos do pipeline sem abrir cada lead.
- O detalhe do lead passou a concentrar operacao, score e contexto em menos passos.
- A base de leads ficou mais preparada para triagem e exportacao por recorte.
- O calendario agora suporta leitura diaria explicita, alem das visoes semanal e mensal.

### Limitacoes assumidas

- `responsavel` e `valor potencial` nao existem hoje no store comercial. O redesign nao inventou esses campos nem alterou banco/contrato.

### Validacao adicional

- `npm.cmd run build` executado com sucesso apos as Fases 3 e 4.
