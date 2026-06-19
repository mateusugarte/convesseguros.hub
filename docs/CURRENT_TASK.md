# CURRENT TASK

## Responsavel Atual

Claude

## Pagina

Dashboard.jsx, ApolicesDashboard.jsx, ComercialDashboard.jsx

## Objetivo

Melhorar design e microfuncoes dos tres dashboards do sistema.

## Status

Concluido.

## Alteracoes Realizadas

### Dashboard.jsx
- Titulos em ingles traduzidos para portugues:
  - "Main Analytics" → "Analytics de fichas"
  - "Alerts" → "Alertas operacionais"
  - "Hero Metrics" → "Metricas principais"
  - "Production Breakdown" → "Producao por produto"
  - "Status Mix" → "Distribuicao de status"
  - "Recent Activity" → "Atividade recente"
  - "User Ranking" → "Ranking da equipe"
  - "Upcoming Deadlines" → "Fila de cotacoes"
  - "Operational Metrics" → "Metricas operacionais"
  - "Imobiliarias Destaque" → "Imobiliarias em destaque"
- Linhas de "Atividade recente" agora sao clicaveis e navegam para /fichas/:id
- Linhas de "Fila de cotacoes" agora permitem clicar no nome para ver a ficha
- AlertCard agora suporta botoes de acao com navegacao direta (href)
- Alertas de pendencias e backlog tem links para /fichas e /minhas-fichas
- Botao de refresh (icone) adicionado na FilterBar com animate-spin quando refetching
- Link "Ver todas" em "Atividade recente" navega para /fichas
- Link "Minha carteira" em "Fila de cotacoes" navega para /minhas-fichas
- useNavigate importado e usado

### ApolicesDashboard.jsx
- Card "Periodo" removido — filtro integrado direto no header (PageHeader actions)
- Altura do grafico de area: 140px → 240px
- CartesianGrid adicionado ao grafico de area
- strokeWidth e activeDot melhorados
- Altura do grafico de producao por seguradora: 190px → 260px
- CartesianGrid adicionado ao grafico de producao
- Top 5 Imobiliarias redesenhado: de grafico horizontal para lista com mini progress bars
  - Cada item e clicavel (navega para /apolices/lista)
  - Barra de progresso relativa ao primeiro colocado
  - Cores graduadas por posicao

### ComercialDashboard.jsx
- Badge de aviso "!" aparece na contagem de "Parados" quando stale > 0
- Idade media fica em amber quando >= 7 dias

## Proximos Passos

- Verificar se todas as rotas de navegacao existem corretamente
- Testar responsividade dos dashboards em tela menor
- Avaliar adicionar animacao de entrada nas metricas (count-up)
