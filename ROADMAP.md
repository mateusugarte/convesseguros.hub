# ROADMAP.md - Sistema de Gestao do Conves Hub

> Visao consolidada do projeto. Mantem o que esta pronto, o que esta planejado e o que ainda depende de execucao.
> Ultima atualizacao: 2026-06-22

## Prioridades imediatas

- [ ] **Campanhas** — area completa + banner no dashboard + strip no pipeline + aba no lead. Em execucao.
- [ ] **ApolicesDashboard** — finalizar metricas e graficos reais.
- [ ] **GestaoEmissoes** — landing operacional do nucleo de apolices.
- [ ] **Reformulacao Conves** — documento estrategico e estrutural para diretoria (CONVES_CONTEXTO_AGENTES.md).
- [ ] **Estrutura Comercial por Permissao** — admin define produtos por usuario, gestor distribui leads por vendedor e vendedor recebe lista automatica.

## Fases concluidas

- [x] **Fase 0** — CRM base: status owner, contatos nas imobiliarias, codigo imob por seguradora.
- [x] **Fase 1** — Dashboard comercial com metricas reais (conversao ficha-apolice, ranking imobiliarias).
- [x] **Fase 2** — Jornadas: editor visual node-based com ReactFlow.
- [x] **Fase 4** — Redesign visual completo do sistema (v12 concluido).
- [x] **Modulo Auto** — Dashboard, Cotacoes, Clientes, Emissoes, Renovacoes, Sinistros.
- [x] **Financeiro** — Dashboard de comissoes por seguradora.

## Fases em execucao

- [ ] **Fase 3** — Campanhas: area completa.

## Fases futuras

- [ ] **Fase 5** — Forecasting: projecao de apolices/comissao a partir do pipeline.
- [ ] **Fase 6** — Aquisicao estruturada: outreach automatizado + materiais comerciais.
- [ ] **Fase 7** — WhatsApp Business integration (n8n).
- [ ] **Cerebro Obsidian** — base de conhecimento interna da Conves.

## Visao geral

- Plataforma interna para fichas, apolices, imobiliarias, seguradoras, auto e area comercial.
- Entrada principal: Google Forms -> n8n -> Supabase.
- Frontend: React + Tailwind.
- Infra: Supabase + Vercel.

## Modulos atuais

### Base

- Login [pronto]
- Dashboard [pronto]
- Configuracoes [pronto]

### Fichas (Fianca)

- Fichas [pronto]
- FichaDetalhePage [pronto]
- MinhasFichas [pronto]
- GestaoEmissoes [em andamento]
- Relatorio [pronto]

### Imobiliarias e seguradoras

- Imobiliarias [pronto]
- ImobiliariaDetalhe [pronto]
- Seguradoras [pronto]

### Apolices

- ApolicesDashboard [em andamento]
- ApoicesGestao [pronto]
- ApolicesLista [pronto]
- ApoliceDetalhe [pronto]

### Comercial

- ComercialDashboard [pronto]
- Pipeline [pronto]
- BaseLeads [pronto]
- LeadDetalhe [pronto]
- Vendas [pronto]
- Calendario [pronto]
- Jornadas [pronto]
- Campanhas [planejado]

### Auto

- AutoDashboard [pronto]
- AutoCotacoes [pronto]
- AutoCotacaoDetalhe [pronto]
- AutoCotacoesConsulta [pronto]
- AutoClientes [pronto]
- AutoEmissoes [pronto]
- AutoRenovacoes [pronto]
- AutoSinistros [pronto]

### Financeiro

- Financeiro [pronto]

## Base tecnica

- Supabase como banco principal.
- RLS sempre ativa.
- `service_role` somente no n8n.
- Queries com campos explicitos e paginacao.
- Credenciais apenas em variaveis de ambiente.

## Entregas consolidadas

### Base estrutural

- Tabelas principais de `profiles`, `fichas`, `apolices`, `comercial_leads`, `imobiliarias`.
- Indices de apoio para consulta.
- Politicas de acesso no Supabase.
- Usuarios base configurados.

### Estrutura React

- Aplicacao em React + Vite + Tailwind.
- Design system com dark workspace sidebar.
- Navegacao pronta para todos os modulos ativos.

### Dashboard e Fichas

- KPIs, graficos e visao operacional.
- Lista e detalhes de fichas.
- Fluxo de assumir e finalizar fichas.

### Comercial

- Pipeline kanban com drag-and-drop.
- Base de leads com filtros avancados.
- Editor de jornadas com ReactFlow.
- Registro e analise de vendas.
- Calendario de atividades.

### Auto

- Fluxo completo: cotacao -> emissao -> renovacao -> sinistro.

### Financeiro

- Dashboard de comissoes por seguradora.

## Pendencias conhecidas

- Gestao de emissoes (landing page operacional).
- ApolicesDashboard (metricas completas).
- Campanhas (modulo completo).

## Evolucoes futuras

- Notificacoes WhatsApp via n8n.
- Relatorios PDF/Excel.
- Historico de alteracoes por ficha.
- Metricas por orcamentista.
- App mobile.
- Cerebro Conves (base de conhecimento em Obsidian).
