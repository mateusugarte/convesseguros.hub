# ADR - Core System Design Premium Redesign

## Status

Proposto

## Contexto

O Conves System precisa elevar a area operacional para um padrao premium de SaaS sem alterar regras de negocio, banco, queries, integracoes ou APIs.

O escopo desta trilha cobre:

- Dashboard Geral
- Fichas
- Minhas Fichas
- Ficha Detalhe
- Apolices Dashboard
- Apolices Gestao
- Apolices Pesquisa
- Apolice Detalhe
- Imobiliarias
- Imobiliaria Detalhe
- Seguradoras
- Relatorios
- Design system
- Componentes compartilhados operacionais

Ficam fora do escopo:

- Comercial
- Pipeline
- Base de Leads
- Vendas
- Calendario
- Jornadas
- React Flow
- Componentes exclusivos do comercial

## Diagnostico atual

1. O design system atual esta fortemente acoplado a uma identidade laranja/azul em `src/styles/tokens.css`, `tailwind.config.js` e `src/index.css`, distante da nova assinatura pedida com `#FF2D55` como accent.
2. O `Layout.jsx` e compartilhado entre operacao e comercial. Alteracoes globais de shell, sidebar e topbar afetam as rotas bloqueadas se nao forem escopadas por rota.
3. As paginas principais concentram layout, regras visuais e microcomponentes inline em arquivos grandes, o que dificulta consistencia:
   - `src/pages/Fichas.jsx`
   - `src/pages/ApoicesGestao.jsx`
   - `src/pages/Imobiliarias.jsx`
   - `src/pages/Dashboard.jsx`
4. Existem dois kanbans operacionais com estruturas parecidas, mas nao unificadas:
   - `src/components/KanbanFichas.jsx`
   - `src/components/KanbanBoard.jsx`
5. Ha base reutilizavel em `src/components/ui`, mas ela ainda nao cobre o nivel de pagina premium exigido: metric cards, page headers, data shells, filter bars, empty states, drawers e tabelas compostas.

## Decisoes

1. A nova identidade visual sera aplicada primeiro no design system e no shell operacional, com escopo por rota para nao quebrar o modulo comercial.
2. O accent `#FF2D55` sera usado como cor de destaque e sinalizacao, nao como cor dominante de fundo.
3. O tema claro sera o padrao de referencia. O tema escuro sera premium e neutro, sem preto puro.
4. O redesign sera feito por fases, com componentes compartilhados antes das paginas.
5. Nenhuma fase altera query, shape de dados, rotas, auth, contratos, automacoes ou integracoes.

## Direcao visual aprovada para implementacao

### Tema claro

- background principal: `#FFF7FA`
- background secundario: `#FFFBFC`
- cards: `#FFFFFF`
- hover suave: `#FFF1F5`
- bordas: tons rosados muito leves com neutros frios
- accent principal: `#FF2D55`
- texto principal: neutro escuro com alto contraste

### Tema escuro

- background principal: `#12080D`
- surface primaria: `#1A1016`
- surface secundaria: `#24161F`
- bordas: vinho dessaturado / grafite
- accent principal: `#FF2D55`
- highlight secundario: champagne frio para dados e divisores

### Tipografia

- heading: manter `Plus Jakarta Sans`
- body: manter `Inter`
- numeros e metricas: `JetBrains Mono`

## Estrategia tecnica

### Fase 1 - Fundacao visual

Objetivo:
Consolidar tokens, shell e primitives de pagina sem tocar em regras de negocio.

Componentes a criar:

- `src/components/ui/PageHeader.jsx`
- `src/components/ui/MetricCard.jsx`
- `src/components/ui/DataCard.jsx`
- `src/components/ui/SectionHeading.jsx`
- `src/components/ui/EmptyState.jsx`
- `src/components/ui/FilterBar.jsx`

Componentes a alterar:

- `src/components/Layout.jsx`
- `src/index.css`
- `src/styles/tokens.css`
- `tailwind.config.js`
- `src/components/ui/Button.jsx`
- `src/components/ui/Card.jsx`
- `src/components/ui/FormFields.jsx`
- `src/components/ui/Modal.jsx`

Melhorias de UX/UI:

- Sidebar hibrida com estado compacto e expandido mais consistente
- Topbar mais limpa e orientada a busca/acao
- Escopo visual por rota para manter comercial preservado
- Estados vazios, loading e shells de dados padronizados

Decisao tecnica:

- O shell compartilhado precisa identificar rotas operacionais versus rotas comerciais antes de aplicar o novo visual.

### Fase 2 - Dashboard Geral

Objetivo:
Transformar o dashboard em central operacional.

Arquivos previstos:

- `src/pages/Dashboard.jsx`
- possiveis componentes locais em `src/components/dashboard/`

Estrutura alvo:

- Hero Metrics
- Operational Metrics
- Main Analytics
- Recent Activity
- Alerts
- User Ranking
- Production Breakdown
- Upcoming Deadlines

Melhorias de UX/UI:

- Hierarquia visual forte de metricas
- Graficos mais limpos com foco operacional
- Agrupamento por prioridade e urgencia

### Fase 3 - Fichas e Minhas Fichas

Objetivo:
Criar mesa operacional premium e consistente.

Arquivos previstos:

- `src/pages/Fichas.jsx`
- `src/pages/MinhasFichas.jsx`
- `src/components/KanbanFichas.jsx`
- `src/components/KanbanBoard.jsx`
- `src/components/DetalhesFicha.jsx`
- `src/components/ModalFicha.jsx`
- `src/components/ModalFinalizar.jsx`
- `src/components/ModalAssumir.jsx`

Melhorias de UX/UI:

- Toolbar de filtros mais objetiva
- Cards de ficha com leitura rapida
- Kanban com resumo de coluna, contagem e indicadores
- Lista e drawer com mais prioridade visual

Decisao tecnica:

- Unificar o visual dos kanbans operacionais sem tocar no pipeline comercial.

### Fase 4 - Ficha Detalhe

Objetivo:
Transformar a ficha detalhe em pagina ancora do sistema.

Arquivos previstos:

- `src/pages/FichaDetalhePage.jsx`
- `src/components/SecaoDocumentos.jsx`
- `src/components/SeguradoraBadge.jsx`
- `src/components/SeguradoraSelect.jsx`

Estrutura alvo:

- coluna esquerda: resumo, cliente, imobiliaria, produto, seguradora
- centro: timeline, notas, eventos, historico, acoes
- direita: score, proxima acao, pendencias, indicadores

### Fase 5 - Suite de Apolices

Objetivo:
Dar identidade propria ao modulo de apolices.

Arquivos previstos:

- `src/pages/ApolicesDashboard.jsx`
- `src/pages/ApoicesGestao.jsx`
- `src/pages/ApolicesLista.jsx`
- `src/pages/ApoliceDetalhe.jsx`

Melhorias de UX/UI:

- Dashboard com foco em emissao, renovacao, pendencia e cancelamento
- Gestao em kanban premium
- Pesquisa com filtros avancados e tabela moderna
- Detalhe com blocos mais claros de vigencia, seguradora, pagamento e documentos

### Fase 6 - Imobiliarias, Seguradoras e Relatorios

Objetivo:
Elevar consistencia e clareza sem mudar fluxos centrais.

Arquivos previstos:

- `src/pages/Imobiliarias.jsx`
- `src/pages/ImobiliariaDetalhe.jsx`
- `src/pages/Seguradoras.jsx`
- `src/pages/Relatorio.jsx`

Melhorias de UX/UI:

- Tabelas mais legiveis
- Cards e filtros mais claros
- Alertas, urgencias e cobrancas mais evidentes

## Riscos e mitigacoes

1. `Layout.jsx` e compartilhado com comercial.
Mitigacao: aplicar variacao visual por rota e preservar markup/links do comercial.

2. Tokens globais podem alterar telas fora do escopo.
Mitigacao: mover a mudanca para tokens semanticos novos e migrar operacao primeiro.

3. Paginas grandes elevam risco de regressao visual.
Mitigacao: quebrar em components/patterns antes de reestruturar JSX principal.

4. Kanbans compartilham linguagem com outras areas.
Mitigacao: criar base visual operacional reutilizavel sem tocar nos componentes comerciais.

## Arquivos lidos no diagnostico

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
- `src/pages/Dashboard/CONTEXT.md`
- `src/pages/Fichas/CONTEXT.md`
- `src/pages/FichaDetalhePage/CONTEXT.md`
- `src/pages/MinhasFichas/CONTEXT.md`
- `src/pages/ApolicesDashboard/CONTEXT.md`
- `src/pages/ApoicesGestao/CONTEXT.md`
- `src/pages/ApolicesLista/CONTEXT.md`
- `src/pages/ApoliceDetalhe/CONTEXT.md`
- `src/pages/Imobiliarias/CONTEXT.md`
- `src/pages/ImobiliariaDetalhe/CONTEXT.md`
- `src/pages/Seguradoras/CONTEXT.md`
- `src/pages/Relatorio/CONTEXT.md`

## Proxima acao

Aguardar aprovacao do plano para iniciar a Fase 1.

## Execucao - Fase 1

Status:
Concluida

Componentes criados:

- `src/components/ui/PageHeader.jsx`
- `src/components/ui/MetricCard.jsx`
- `src/components/ui/DataCard.jsx`
- `src/components/ui/SectionHeading.jsx`
- `src/components/ui/EmptyState.jsx`
- `src/components/ui/FilterBar.jsx`

Componentes alterados:

- `src/components/Layout.jsx`
- `src/components/ui/Button.jsx`
- `src/components/ui/Card.jsx`
- `src/components/ui/FormFields.jsx`
- `src/components/ui/Modal.jsx`
- `src/components/ui/DatePicker.jsx`
- `src/components/ui/Select.jsx`
- `src/components/ui/WorkspacesSelect.jsx`
- `src/components/ui/index.js`

Arquivos alterados:

- `src/styles/tokens.css`
- `src/index.css`
- `tailwind.config.js`

Melhorias de UX:

- Shell operacional isolado por rota para nao contaminar o comercial
- Sidebar e topbar com leitura mais premium e hierarquia mais clara
- Nova base de page headers, metric cards, data cards e filter bars para reduzir repeticao
- Form controls, modais e surfaces alinhados ao mesmo sistema visual

Melhorias de UI:

- Accent operacional migrado para `#FF2D55` sem dominar a interface
- Tema claro com fundos rosados suaves e cards mais leves
- Tema escuro premium para operacao sem preto puro
- Sombras, bordas e brilhos reequilibrados para uma aparencia mais SaaS premium

Decisoes tomadas:

- Tokens visuais ficaram escopados em `.ops-shell` para preservar o modulo comercial
- `Layout.jsx` foi regravado para remover acoplamento direto a valores hardcoded de tema
- O design system passou a expor primitives de pagina antes da refacao das paginas finais

Validacao:

- `npm run build` concluido com sucesso
- Verificacao visual automatizada no Browser plugin nao foi concluida porque a instancia `iab` nao estava disponivel nesta sessao

## Execucao - Fase 2

Status:
Concluida

Componentes criados:

- nenhum componente novo fora da pagina

Componentes alterados:

- `src/pages/Dashboard.jsx`

Arquivos alterados:

- `src/pages/Dashboard.jsx`

Melhorias de UX:

- Dashboard reorganizado como central operacional com narrativa de prioridades
- Leitura separada entre hero metrics, analytics, alerts, production breakdown, ranking recente, activity feed e deadlines
- Fichas em cotacao com CTA direto para finalizar sem sair da tela
- Alertas derivados de backlog, pendencias 48h+ e envelhecimento da carteira pessoal

Melhorias de UI:

- Hero premium ancorado em `PageHeader` e `MetricCard`
- Cards analiticos padronizados com `DataCard` e `FilterBar`
- Graficos reconstruidos com paleta alinhada ao novo accent `#FF2D55`
- Blocos de imobiliarias destaque, ranking recente e deadlines com hierarquia visual mais forte

Decisoes tomadas:

- O ranking de usuarios foi apresentado como "ranking recente" porque as queries atuais nao expoem um ranking global consolidado
- O dashboard manteve apenas dados vindos das queries ja existentes, sem criar ou alterar contratos
- A janela mensal continua controlando o mesmo recorte existente para KPIs, distribuicao e top imobiliarias

Validacao:

- `npm run build` concluido com sucesso
- Validacao visual automatizada nao foi concluida porque o Browser plugin continuou sem disponibilizar a instancia `iab`
