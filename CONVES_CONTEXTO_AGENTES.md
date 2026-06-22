# CONVES — Documento de Contexto para Agentes de IA
> Lido por Claude Code e Codex antes de qualquer sessão de trabalho.
> Fonte de verdade do projeto. Atualizar a cada decisão relevante.
> Última atualização: 2026-06-22

---

# PARTE I — CONTEXTO DO PROJETO (BASE TÉCNICA)

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
C:\Users\LUCIANO JUNIOR\Desktop\ConvesSystem
```

### Webhooks n8n ativos

```
Residencial PF:  /webhook/e8ed448d-ac27-4b52-91d0-b846d5628d15
Comercial PF:    /webhook/399752ad-6715-4e39-bef7-d61f900cddb4
Pessoa Jurídica: /webhook/1a03d494-e0a6-4039-b1e0-3a56bf9f7d6f
```

### Módulos do sistema (estado atual em 2026-06-22)

| # | Módulo | Status |
|---|--------|--------|
| 1 | Fichas (Fiança) | ✅ pronto |
| 2 | Apólices | ✅ pronto (dashboard em andamento) |
| 3 | Comercial (CRM) | ✅ pronto |
| 4 | Auto | ✅ pronto |
| 5 | Financeiro | ✅ pronto |
| 6 | Imobiliárias | ✅ pronto |
| 7 | Seguradoras | ✅ pronto |
| 8 | Campanhas | ⏳ em desenvolvimento |
| 9 | Forecasting | ⏳ planejado |
| 10 | WhatsApp Integration | ⏳ futuro |

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

| Agente | Papel | Especialidade |
|--------|-------|--------------|
| Claude Code | Arquitetura, banco, n8n, integrações, estrutura | Backend / infraestrutura |
| Codex | UI, UX, componentes, CSS, responsividade | Frontend / visual |

**Protocolo de handoff:** Claude decide arquitetura e estrutura de dados. Codex executa visual. Usuário (Mateus/Luciano) decide rota final.

---

## 7. ESTADO ATUAL DO DESENVOLVIMENTO (2026-06-22)

### O que está pronto e em produção

- ✅ Banco Supabase configurado (fichas, profiles, apolices, comercial_leads, imobiliarias, RLS, índices)
- ✅ Webhooks n8n ativos para os 3 produtos de fiança
- ✅ Autenticação com Supabase Auth
- ✅ Kanban de fichas com drag-and-drop (`@dnd-kit`)
- ✅ Sidebar dark com navegação por módulos (dual-column design)
- ✅ Redesign visual v12 completo
- ✅ Módulo Comercial completo (Pipeline, BaseLeads, Vendas, Calendário, Jornadas)
- ✅ Módulo Auto completo (Dashboard, Cotações, Clientes, Emissões, Renovações, Sinistros)
- ✅ Módulo Financeiro (comissões por seguradora)
- ✅ Editor de jornadas com ReactFlow (automação de leads)

### Em andamento

- ⏳ ApolicesDashboard — métricas e gráficos completos
- ⏳ GestaoEmissoes — landing operacional do núcleo de apólices
- ⏳ Campanhas — área completa + integrações

### Próximas entregas

1. Finalizar módulo de Campanhas
2. Completar ApolicesDashboard
3. Forecasting de pipeline
4. WhatsApp Business via n8n

---

## 8. PROTOCOLO DE TRABALHO COM AGENTES

### Para Claude Code

**Antes de qualquer execução:**
1. Ler `CLAUDE.md` + `CONVES_CONTEXTO_AGENTES.md` + CONTEXT.md do módulo atual
2. Ler todos os arquivos relevantes antes de tocar em qualquer um

**Fluxo de execução:**
```
PLANO → aguardar aprovação → EXECUTAR → DONE
```

**Nunca tocar sem aprovação:**
- Business logic, queries Supabase, RLS policies, hooks, autenticação
- SQL migrations: apresentar antes de rodar

### Para Codex (UI/frontend)

- Foco em UI/visual — não tocar em lógica de negócio
- Liberdade criativa dentro do design system definido (seção 5)
- Ler arquivos relevantes antes de modificar
- Nunca reescrever lógica de negócio ao refatorar UI

### Divisão de trabalho paralelo

| Tipo de tarefa | Agente |
|---------------|--------|
| UI, componentes, visual, CSS | Codex |
| Backend, banco, n8n, integrações | Claude Code |
| Arquitetura, decisões técnicas | Claude Code |
| Design system, experiência | Codex |

---

## 9. DECISÕES ARQUITETURAIS JÁ TOMADAS — NÃO REVERTER

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

---

# PARTE II — REFORMULAÇÃO CONVES
## Documento Estratégico para Apresentação à Diretoria

> **Versão:** 1.0 — Rascunho inicial (Claude Code)
> **Data:** 2026-06-22
> **Status:** Em construção — aguardando contribuições do usuário e Codex

---

## SUMÁRIO EXECUTIVO

A Conves Corretora de Seguros está em processo de reformulação estrutural. Esta reformulação tem dois pilares principais:

1. **Sistema Online (Conves Hub)** — plataforma web centralizada que substitui planilhas e processos manuais, unificando todos os setores em um único ambiente digital.

2. **Sistema Cultural** — estruturação da cultura interna, metodologia de vendas, protocolos de atendimento e base de conhecimento que perpetuam a identidade e o diferencial da Conves.

O objetivo é transformar a Conves de uma corretora operada por pessoas e planilhas para uma corretora operada por pessoas e sistemas — mantendo o calor humano no atendimento, mas com a eficiência e rastreabilidade de uma empresa tech.

---

## OBJETIVOS EXECUTIVOS DA REFORMULAÇÃO

> Seção consolidada a partir das definições da diretoria. Não é plano de ação; é o norte estratégico da reformulação.

### Objetivo central

- Transformar a Conves em uma máquina de vendas com relacionamento superior, sem perder o diferencial humano que já existe.
- Operar comercialmente como uma empresa grande, com previsibilidade, escala e processo.

### Direcionadores principais

- Vender com previsibilidade, em vez de depender apenas de oportunidade espontânea ou indicação isolada.
- Estruturar um setor comercial completo, capaz de gerar, tratar e converter oportunidades todos os meses.
- Aumentar a eficiência operacional para suportar crescimento, novos funcionários e maior volume de produção.
- Extrair mais lucro da base atual de clientes, aproveitando o relacionamento já construído.
- Criar uma cultura interna orientada a foco, processo e acompanhamento consistente do cliente.

### Frentes estratégicas prioritárias

- Comercial: fundação do setor comercial inteiro, com processos, cadência, metas e gestão de pipeline.
- Cross-sell e expansão: aumento da venda dos produtos já existentes com melhor aproveitamento da base.
- Novas linhas rentáveis: consolidação de consórcio, financiamento e plano de saúde com previsibilidade comercial.
- Relacionamento: sistema estruturado de acompanhamento de clientes e imobiliárias, do início ao pós-venda.
- Operação: processos internos definidos para dar velocidade, clareza e escala à equipe.

### Diferenciais que precisam ser preservados

- Atendimento próximo e contínuo, acompanhando o cliente do início até depois do fim da jornada.
- Postura de não abandonar o cliente por valor, mantendo o princípio relacional da Conves.
- Uso da base e das oportunidades já geradas mensalmente como motor inicial de crescimento.

### Resultado esperado da reformulação

- Comercial funcionando com previsibilidade e gestão real.
- Operação organizada para escalar com novos colaboradores.
- Produtos de maior margem e recorrência estruturados para venda consistente.
- Sistema cultural e comercial unificado, com foco em resultado e relacionamento.

### Horizonte de validação

- A meta de referência é ter essa nova estrutura funcionando em até 6 meses.
- O trabalho de definição de metas será desenvolvido em etapa própria, com modelo específico de criação de objetivos e indicadores.

### Versão resumida para apresentação

A reformulação da Conves tem como objetivo transformar a empresa em uma operação comercial previsível, escalável e organizada, sem perder o diferencial humano que já construiu sua reputação. A empresa quer estruturar um setor comercial completo, explorar melhor a base atual de clientes e consolidar produtos rentáveis como consórcio, financiamento e plano de saúde. O foco é vender com mais previsibilidade, aumentar a eficiência operacional, criar processos claros para novos colaboradores e implementar uma cultura interna orientada a resultado, relacionamento e consistência. A expectativa é que essa nova estrutura esteja funcionando em até 6 meses, com metas e indicadores próprios a serem definidos em etapa posterior.

---

## CAPÍTULO 1 — VISÃO ESTRATÉGICA

### 1.1 Missão

Ser a corretora que resolve o que não é problema dela — entregando segurança real, não burocracia.

### 1.2 Diferencial Competitivo

A Conves não compete por preço. Compete por **confiança e resolução**. Em um mercado onde corretoras repassam problemas para seguradoras e deixam clientes à deriva, a Conves assume junto. Isso gera fidelidade e indicações que nenhuma campanha de marketing compra.

**Evidências concretas:**
- 10+ anos de mercado com base ativa de 3000+ clientes
- ~500 fichas/mês de fiança (volume que exige operação estruturada)
- ~100 imobiliárias parceiras (50 ativas)
- Equipe estável e experiente

### 1.3 Posição atual

| Dimensão | Antes da Reformulação | Depois da Reformulação |
|----------|----------------------|----------------------|
| Operação | Planilhas dispersas | Sistema centralizado (Conves Hub) |
| Comercial | Anotações e memória | CRM completo com pipeline e jornadas |
| Conhecimento | Na cabeça de cada um | Documentado no Cérebro Conves |
| Métricas | Nenhuma (ou manual) | Dashboards em tempo real |
| Automação | Zero | n8n + jornadas de lead |
| Cultura | Informal, não documentada | Método C.O.N.V.E.S. + SOPs |

### 1.4 Meta estratégica

Nos próximos 12 meses:
- 100% da operação rodando pelo Conves Hub
- Equipe comercial usando CRM ativamente
- Jornadas automatizadas de follow-up ativas
- Base de conhecimento (Cérebro Conves) alimentada e consultada
- Forecasting de receita por produto e segmento

---

## CAPÍTULO 2 — SISTEMA ONLINE: CONVES HUB

### 2.1 O que é o Conves Hub

O Conves Hub é a plataforma web interna da Conves. É o sistema operacional da corretora. Toda a operação — fichas, apólices, leads, campanhas, financeiro — passa por ele.

**Características:**
- Acesso web (qualquer dispositivo, qualquer lugar)
- Dados em tempo real (mudança em um lugar aparece para todos)
- Controle de permissões por usuário
- Histórico completo de cada ficha, lead e apólice
- Integração com Google Forms (entrada de fichas automatizada)
- Integração com n8n (automações de follow-up)

---

### 2.2 SETOR FIANÇA

> Produto principal da Conves. Volume: ~500 fichas/mês, ~200-250 apólices emitidas/mês.

**Fluxo do produto:**
```
Imobiliária → Google Forms → n8n → Banco de dados → Orçamentista assume → Cotação → Emissão
```

#### 2.2.1 Central de Fichas

**O que é:** Visão kanban (ou lista) de todas as fichas ativas do mês. É a tela de trabalho principal dos orçamentistas.

**Funções:**
- Visualizar fichas por status em colunas (Pendente, Em Cotação, Em Análise, Aprovado, Recusado, Emitido)
- Assumir ficha pendente (move para "Em Cotação" e registra responsável)
- Filtrar por produto (Residencial PF, Comercial PF, Pessoa Jurídica), imobiliária, orçamentista e mês
- Drag-and-drop para mover fichas entre status
- Atualização em tempo real (Supabase Realtime)

**Usuários:** Todos os orçamentistas (Davi, Dayana, Eduardo, Mateus, Laís, Marcos, Luciano, Patrícia Dantas)

#### 2.2.2 Minha Carteira

**O que é:** Visão pessoal de cada orçamentista — somente as fichas que ele assumiu.

**Funções:**
- Listar fichas assumidas pelo usuário logado
- Filtrar por status, produto, mês
- Acesso rápido para finalizar cotação ou registrar observação

**Usuários:** Cada orçamentista individualmente

#### 2.2.3 Detalhe da Ficha

**O que é:** Página completa de uma ficha específica com todos os dados do interessado e histórico de ações.

**Funções:**
- Exibir todos os dados do interessado (nome, CPF, endereço, renda, etc.)
- Registrar seguradora selecionada, observações e resultado
- Visualizar histórico de alterações
- Ações rápidas: assumir, finalizar, cancelar
- Dados mascarados para proteção de privacidade (CPF parcial)

**Usuários:** Orçamentistas e gestores

#### 2.2.4 Gestão de Emissões

**O que é:** Landing operacional do núcleo de apólices. Ponto de entrada para tudo relacionado a apólices emitidas.

**Funções:**
- KPIs de emissões do período
- Atalhos para: lista de apólices, gestão de apólices, dashboard de apólices
- Status visual do fluxo de emissões

**Status:** Em andamento

**Usuários:** Dayana, Patrícia Dantas, gestores

#### 2.2.5 Relatório Mensal

**O que é:** Relatório consolidado do mês por produto, orçamentista e imobiliária.

**Funções:**
- Comparativo mensal de fichas por produto
- Ranking de orçamentistas (volume e taxa de conversão)
- Ranking de imobiliárias
- Exportação futura em PDF/Excel

**Usuários:** Gestores (Luciano, Mateus)

#### 2.2.6 Apólices — Dashboard

**O que é:** Dashboard analítico das apólices emitidas.

**Funções:**
- KPIs: total emitido, prêmio acumulado, comissão, conversão
- Gráfico de emissões por dia/mês
- Top imobiliárias por volume de apólices
- Distribuição por seguradora

**Status:** Em andamento

**Usuários:** Gestores

#### 2.2.7 Apólices — Gestão e Lista

**O que é:** Telas operacionais de apólices individuais.

**Funções:**
- Listar todas as apólices com filtros
- Ver detalhe de cada apólice (dados, vigência, seguradora, parceiro)
- Gerenciar status de apólices

---

### 2.3 SETOR AUTO

> Seguro de veículos — produto em crescimento na carteira da Conves.

**Fluxo do produto:**
```
Solicitação → Cotação → Proposta → Emissão → Renovação
```

#### 2.3.1 Dashboard Auto

**O que é:** Visão geral do setor auto com métricas operacionais e comerciais.

**Funções:**
- KPIs: novas apólices no mês, renovações, cotações, taxa de conversão, comissão
- Gráfico de emissões mensais
- Gráfico de status das cotações
- Alerta de renovações vencendo próximo mês

**Usuários:** Gestores e equipe auto

#### 2.3.2 Cotações

**O que é:** Gestão do pipeline de cotações de auto.

**Funções:**
- Criar nova cotação (dados do veículo, cliente, seguradoras)
- Acompanhar status da cotação (aberta, proposta enviada, aprovada, recusada)
- Registrar resultado (emissão ou perda)

**Usuários:** Equipe comercial e operacional

#### 2.3.3 Consulta de Cotações

**O que é:** Histórico e pesquisa de cotações anteriores.

**Funções:**
- Buscar cotações por cliente, placa, período
- Reutilizar dados de cotações anteriores
- Comparar coberturas e valores

**Usuários:** Equipe operacional

#### 2.3.4 Clientes Auto

**O que é:** Base de clientes do produto auto.

**Funções:**
- Cadastrar e consultar clientes com veículos
- Histórico de apólices por cliente
- Alertas de renovação por cliente

**Usuários:** Equipe operacional

#### 2.3.5 Emissões Auto

**O que é:** Registro de apólices de auto emitidas.

**Funções:**
- Registrar emissão com dados completos (veículo, cobertura, prêmio, comissão, vigência)
- Vincular emissão ao cliente e à cotação de origem
- Controle de vigência e vencimento

**Usuários:** Dayana, Patrícia Dantas

#### 2.3.6 Renovações

**O que é:** Gestão proativa do ciclo de renovação de apólices auto.

**Funções:**
- Listar apólices vencendo nos próximos 30/60/90 dias
- Registrar tentativas de contato
- Marcar como renovada, cancelada ou em negociação
- Alertas automáticos de prioridade

**Usuários:** Laís, gestores

#### 2.3.7 Sinistros

**O que é:** Registro e acompanhamento de sinistros de auto.

**Funções:**
- Abrir ocorrência de sinistro
- Registrar histórico de contatos com seguradora
- Acompanhar status do sinistro (aberto, em análise, resolvido, negado)
- Registro de documentos e observações

**Usuários:** Patrícia Barbara

---

### 2.4 SETOR COMERCIAL (CRM)

> Motor de crescimento da Conves. Aqui entram e saem os novos negócios.

**Fluxo comercial:**
```
Lead entra → Pipeline → Jornada automatizada → Proposta → Fechamento → Venda registrada
```

#### 2.4.1 Dashboard Comercial

**O que é:** Visão executiva da operação comercial em tempo real.

**Funções:**
- KPIs: total de leads, convertidos, perdidos, taxa de conversão
- Gráfico de tendência de leads ao longo do tempo
- Funil de vendas por estágio
- Alertas de leads parados (sem contato há X dias)
- Filtros por período (semana, mês, trimestre, personalizado)

**Usuários:** Equipe comercial e gestores

#### 2.4.2 Pipeline (Kanban de Leads)

**O que é:** Board kanban visual do processo de vendas. Cada coluna representa um estágio do lead.

**Colunas:**
```
NOVO → EM CONTATO → PROPOSTA ENVIADA → NEGOCIAÇÃO → FECHADO | PERDIDO
```

**Funções:**
- Criar novo lead (manual ou importado de ficha/apólice existente)
- Mover lead entre estágios por drag-and-drop
- Ver score do lead (indicador de qualidade/urgência)
- Registrar recusa com motivo
- Fechar venda e registrar dados de emissão

**Usuários:** Patricia Dantas, Patricia Barbara, equipe comercial

#### 2.4.3 Base de Leads

**O que é:** Visão tabular de todos os leads com filtros avançados.

**Funções:**
- Listar todos os leads (ativos, convertidos, perdidos)
- Filtros por: busca textual, origem, score, período, status
- Exportação de leads (futuro)
- Navegar para detalhe do lead
- Acesso via URL com parâmetros de filtro (deep link)

**Usuários:** Equipe comercial e gestores

#### 2.4.4 Detalhe do Lead

**O que é:** Página completa de um lead com histórico de interações e jornada.

**Funções:**
- Dados completos do lead (nome, empresa, produto de interesse, origem)
- Histórico de contatos e ações registradas
- Status atual e histórico de mudanças
- Aba "Jornada do Cliente" — visualizar em qual jornada automatizada o lead está
- Registrar nova atividade (ligação, email, WhatsApp, reunião)
- Adicionar observações e tags

**Usuários:** Equipe comercial

#### 2.4.5 Vendas

**O que é:** Registro e análise de todas as vendas fechadas.

**Funções:**
- Registrar nova venda (vinculada a lead, produto, valor, comissão, data de emissão)
- KPIs de receita e comissão no período
- Histórico de vendas com filtros

**Usuários:** Equipe comercial e gestores

#### 2.4.6 Calendário

**O que é:** Agenda de atividades comerciais da equipe.

**Funções:**
- Visualizar compromissos por dia/semana/mês
- Criar atividades (ligação agendada, reunião, follow-up)
- Vincular atividade a um lead específico
- Alertas de atividades do dia

**Usuários:** Equipe comercial

#### 2.4.7 Jornadas de Automação

**O que é:** Editor visual de fluxos de automação de leads. É o "cérebro" do follow-up automático.

**Como funciona:**
Cada jornada é um grafo (estilo n8n/Zapier) com nós de ação. O lead entra na jornada e avança pelos nós conforme as ações são executadas.

**Tipos de nó disponíveis:**
- Ligação (com script de abordagem)
- E-mail (com template)
- WhatsApp (com mensagem)
- Espera (X dias)
- Etapa (checkpoint de status)

**Funções:**
- Criar jornadas do zero no editor visual
- Configurar scripts de contato por nó
- Ativar/pausar jornadas
- Vincular leads a jornadas ativas

**Usuários:** Gestores comerciais (Luciano, Mateus, Patricia Dantas)

#### 2.4.8 Campanhas *(em desenvolvimento)*

**O que é:** Área de campanhas de marketing e outreach para leads.

**Funções planejadas:**
- Criar campanha com objetivo, produto alvo e período
- Adicionar leads à campanha em lote (selecionar 20/30/50 de uma vez)
- Acompanhar métricas da campanha (disparos, respostas, conversões)
- Banner de campanha ativa no Dashboard
- Strip de campanha no Pipeline
- Aba de campanha no detalhe do lead

**Status:** Em desenvolvimento

---

### 2.5 ÁREA FINANCEIRA

> Visibilidade sobre comissões e produção por seguradora.

#### 2.5.1 Dashboard Financeiro

**O que é:** Painel de comissões da corretora por período e seguradora.

**Funções:**
- KPIs: comissão total, produção total, apólices emitidas, variação mensal
- Tabela de produção por seguradora (prêmio, comissão, número de apólices)
- Filtros por mês, ano e seguradora

**Usuários:** Gestores (Luciano, Mateus)

---

### 2.6 ÁREA DE PARCEIROS

#### 2.6.1 Imobiliárias

**O que é:** Cadastro e gestão das imobiliárias parceiras.

> **Regra crítica de negócio:** Imobiliárias são parceiros de canal, não clientes. Elas encaminham os interessados — o cliente é o locatário.

**Funções:**
- Listar imobiliárias ativas com métricas (volume de fichas, apólices, conversão)
- Cadastrar nova imobiliária (nome, contatos, código por seguradora)
- Ver detalhe da imobiliária: histórico de fichas, apólices, contatos cadastrados
- Identificar imobiliárias inativas ou esporádicas para reativação comercial

**Usuários:** Gestores, equipe comercial

#### 2.6.2 Seguradoras

**O que é:** Cadastro das seguradoras com quem a Conves opera.

**Funções:**
- Listar seguradoras ativas
- Dados de contato, produtos e condições comerciais
- Referência cruzada com apólices e fichas

**Usuários:** Equipe operacional, gestores

---

### 2.7 DASHBOARD PRINCIPAL

**O que é:** Visão executiva de toda a operação da Conves. Primeiro passo ao entrar no sistema.

**Funções:**
- KPIs globais: fichas do mês, apólices emitidas, leads ativos, conversão
- Analytics de fichas (por produto, por orçamentista, por status)
- Atividade recente (fichas movimentadas recentemente)
- Alertas operacionais (fichas pendentes sem assumir, backlog crítico)
- Fila de cotações (fichas em cotação aguardando retorno)
- Ranking da equipe (produção por orçamentista)
- Imobiliárias em destaque (top parceiros do mês)

**Usuários:** Todos

---

## CAPÍTULO 3 — SISTEMA CULTURAL

### 3.1 O Problema Cultural

Corretoras de seguros geralmente operam com conhecimento concentrado em pessoas-chave. Quando alguém sai, o conhecimento vai junto. Processos ficam na cabeça. Abordagens comerciais variam por vendedor. O atendimento ao cliente é inconsistente.

A Conves tem vantagem: uma identidade forte. Mas essa identidade precisa ser **documentada e ensinada**, não apenas vivida por quem já está há anos na empresa.

### 3.2 Método C.O.N.V.E.S.

O método de vendas oficial da Conves. Cada letra representa uma etapa da jornada comercial.

| Etapa | Nome | Objetivo | Como fazer |
|-------|------|----------|------------|
| **C** | Conexão | Rapport — nunca vender no 1º contato | Apresentar-se, entender o contexto, criar relacionamento antes de falar de produto |
| **O** | Observação | 3 perguntas de qualificação | Identificar o que o cliente já tem, o que precisa, o que o preocupa |
| **N** | Necessidade | Cliente verbaliza a dor | Fazer o cliente dizer o problema com as próprias palavras |
| **V** | Valor | Solução como consequência da dor | Apresentar o produto como resposta à dor identificada, não como catálogo |
| **E** | Evidência | Construir confiança com dados | "10 anos, 3000 clientes, resolvemos sinistros, ficamos do lado" |
| **S** | Solicitação | Próximo passo com data | Nunca terminar sem compromisso. "Posso te mandar a proposta até sexta?" |

**Regra de ouro:** Sem a etapa C e N bem feitas, as etapas V e E não têm fundação. Vender seguro para quem não sente a necessidade é força — e gera churn.

### 3.3 Funil de Cross-Sell

A Conves tem oportunidade real de aumentar receita por cliente existente. O funil de cross-sell define a sequência natural de produtos para cada perfil.

**Cliente PF (Pessoa Física):**
```
Fiança → Auto → Saúde PF → Consórcio → Vida
```

**Cliente PJ (Pessoa Jurídica):**
```
Qualquer entrada → Saúde Coletiva → Consórcio PJ → Incêndio Comercial
```

**Implicação:** Todo cliente que entra pelo produto de fiança é uma oportunidade de auto. Todo cliente de auto é uma oportunidade de saúde. O Conves Hub rastreia isso — o comercial precisa agir.

### 3.4 Fontes de Lead

Três fontes estruturais, com timelines diferentes:

| Fonte | Volume potencial | Timeline de resultado | Como ativar |
|-------|-----------------|----------------------|-------------|
| **Carteira ativa** | 800-1000 clientes Tier 1 | Imediato (30 dias) | Ligar para clientes com produtos desatualizados ou sem cross-sell |
| **Imobiliárias** | 30 esporádicas para reativar | 30-60 dias | Visita, material, parceria formalizada |
| **Outbound PJ** | Alto volume, menor conversão | 60-90 dias | Contato frio em empresas com 5+ funcionários |

### 3.5 Protocolo de Atendimento — Sinistros

Sinistros são o momento mais crítico do relacionamento com o cliente. É aqui que a Conves decide se é só mais uma corretora ou se é diferente.

**Protocolo padrão (SOP-Sinistro):**
1. Cliente comunica o sinistro → registrar imediatamente no sistema
2. Confirmar abertura na seguradora (não deixar o cliente fazer isso sozinho)
3. Acompanhar status ativamente (não esperar o cliente perguntar)
4. Comunicar cada etapa ao cliente (mesmo que seja "ainda sem novidade")
5. Em caso de negativa: apresentar recurso se houver base legal
6. Registrar resolução e colher feedback

**Resultado esperado:** O cliente que teve sinistro bem resolvido vira promotor ativo da Conves.

### 3.6 Protocolo de Onboarding de Imobiliária

Novas imobiliárias precisam de um processo claro para começar a enviar fichas com qualidade.

**SOP-Onboarding Imobiliária:**
1. Reunião de apresentação (produto, diferencial, processo)
2. Cadastro no sistema (criar imobiliária + usuário de contato)
3. Treinamento do formulário de fiança (Google Forms)
4. Primeira ficha acompanhada (orçamentista guia o processo)
5. Follow-up em 30 dias (como está indo, dúvidas, volume)
6. Ativação de campanha de relacionamento no comercial

### 3.7 Cérebro Conves — Base de Conhecimento

**O que é:** Um vault em Obsidian que concentra todo o conhecimento da Conves — produto, processos, clientes, metodologia, casos resolvidos.

**Objetivo:** Nenhum conhecimento importante fica só na cabeça de alguém. Qualquer pessoa nova na equipe consegue aprender 80% do necessário consultando o Cérebro.

**Estrutura planejada:**
```
00-IDENTIDADE      → diferencial, produtos, perfis de cliente, método C.O.N.V.E.S.
01-CONHECIMENTO    → metodologias (Hormozi, Cialdini, SPIN Selling)
02-OPERACIONAL     → SOPs (sinistro, renovação, onboarding de imobiliária, emissão)
03-MEMORIA-VIVA    → casos resolvidos, decisões estratégicas, aprendizados do time
04-CEREBRO-CONVES  → instruções de uso com Claude Code
```

**Status:** Em construção — Codex está trabalhando na integração com Obsidian.

---

## CAPÍTULO 3-A — REESTRUTURAÇÃO COMERCIAL

> Fonte: Documento "Reestruturacao_Comercial_CONVES.docx" — integrado em 2026-06-22.
> Este capítulo define a máquina comercial da Conves: setores, funções, pessoas e processos.

### 3A.1 Contexto e Objetivo

A Conves possui produção comprovada de aproximadamente **R$ 500 mil de prêmio total no setor de fiança**. O objetivo da reestruturação é deixar de depender apenas de demanda espontânea e indicações soltas, criando uma máquina comercial capaz de:

- Gerar oportunidades de forma previsível
- Qualificar clientes com critério
- Vender produtos rentáveis (Saúde e Consórcio como prioridade)
- Expandir a carteira com método — não com sorte

**Produtos prioritários para previsibilidade comercial:** Saúde e Consórcio

**Fontes de oportunidade:**
- Carteira própria de clientes
- Cotações antigas (reativação)
- Parceiros imobiliários
- Campanhas mensais sem mídia paga

---

### 3A.2 Princípio Central

> A Conves não irá estruturar o comercial apenas como um time de vendedores.
> A empresa irá estruturar uma **máquina comercial dividida por funções claras**, onde cada setor representa uma etapa da geração de receita.

| Etapa | Função comercial | Setor responsável |
|-------|-----------------|-------------------|
| Planejar onde vender | Estratégia e campanhas | Planejamento Comercial e Growth |
| Encontrar oportunidades | Dados → listas de contato | Inteligência Comercial |
| Gerar contato e qualificar | Abordagem inicial | Pré-Vendas / SDR |
| Diagnosticar, cotar e fechar | Venda consultiva | Consultoria Comercial |
| Expandir carteira | Cross-sell e indicações | Customer Success Comercial |
| Gerar via parceiros | Relacionamento com imobiliárias | Relações Imobiliárias |

---

### 3A.3 Os 6 Setores Comerciais

---

#### SETOR 1 — Planejamento Comercial e Growth

**Papel:** O cérebro estratégico do comercial. Define o que a empresa precisa vender em cada período e organiza campanhas mensais para direcionar os esforços de toda a equipe.

**Responsabilidades:**
- Definir o produto foco do mês (Saúde, Consórcio ou outro estratégico)
- Analisar produção, rentabilidade, comissão e potencial da carteira
- Criar campanhas mensais com: público-alvo, argumento comercial, oferta e meta
- Distribuir as campanhas para todos os outros setores
- Acompanhar se a campanha está gerando oportunidades, reuniões, propostas e vendas

**Entregáveis:**
- Calendário mensal de campanhas
- Metas por produto
- Briefing da campanha
- Lista de ações por canal
- Relatório de resultado da campanha

**Métricas:**
- Receita gerada por campanha
- Comissão gerada por campanha
- Oportunidades geradas
- Reuniões qualificadas
- Vendas por produto
- Taxa de conversão da campanha

---

#### SETOR 2 — Inteligência Comercial

**Papel:** Transforma dados em oportunidades comerciais. Não vende, não agenda, não fecha — descobre quem deve ser abordado, com qual produto e com qual prioridade.

**Responsabilidades:**
- Organizar, limpar e segmentar a base de clientes
- Identificar clientes com potencial para Saúde, Consórcio e outros produtos
- Separar oportunidades de: carteira, cotações antigas, renovações, parceiros e indicações
- Criar listas qualificadas para o SDR trabalhar
- Analisar quais segmentos convertem melhor

**Entregáveis:**
- Lista de oportunidades para Saúde
- Lista de oportunidades para Consórcio
- Lista de cotações perdidas para reativação
- Lista de clientes por perfil de potencial
- Relatório de potencial da carteira

**Métricas:**
- Oportunidades geradas
- Oportunidades aproveitadas pelo comercial
- Taxa de conversão por segmento
- Receita originada das listas
- Produtos por cliente
- Potencial mapeado na carteira

---

#### SETOR 3 — Pré-Vendas / SDR

**Papel:** Transforma oportunidades em conversas qualificadas e reuniões comerciais. O SDR não é alguém que manda mensagens em massa — é quem abre portas e identifica clientes com real potencial.

**Responsabilidades:**
- Fazer o primeiro contato com oportunidades geradas pela Inteligência Comercial
- Abordar clientes via WhatsApp, ligação e e-mail
- Qualificar interesse, momento de compra, perfil e potencial financeiro
- Classificar leads: quentes, mornos, frios, nutrição ou perdidos
- Agendar reuniões ou encaminhar oportunidades simples para cotação
- Registrar **todas** as interações no CRM (Conves Hub)

**Entregáveis:**
- Leads qualificados
- Reuniões agendadas
- Resumo do diagnóstico inicial
- Status atualizado no CRM
- Follow-ups programados

**Métricas:**
- Reuniões qualificadas
- Taxa de contato
- Taxa de qualificação
- Taxa de comparecimento
- Oportunidades reativadas
- Receita originada por SDR

---

#### SETOR 4 — Consultoria Comercial

**Papel:** Transforma oportunidades qualificadas em vendas. Realiza o diagnóstico completo, monta cotação, apresenta proposta, negocia e fecha o contrato.

**Responsabilidades:**
- Realizar diagnóstico comercial do cliente
- Entender necessidade real, orçamento, prazo e objeções
- Montar cotações e propostas adequadas ao perfil
- Apresentar opções com clareza (custo, benefício, encaixe no perfil)
- Negociar, fazer follow-up e conduzir o fechamento
- Registrar motivos de ganho e perda

**Entregáveis:**
- Cotações realizadas
- Propostas enviadas
- Vendas fechadas
- Registro de objeções
- Relatório de motivos de perda
- Previsão de fechamento

**Métricas:**
- Vendas fechadas
- Prêmio total vendido
- Comissão gerada
- Taxa de conversão: reunião → proposta
- Taxa de conversão: proposta → venda
- Ticket médio

---

#### SETOR 5 — Customer Success Comercial

**Papel:** Aumenta o valor da carteira existente. Na Conves, o CS tem papel comercial ativo — não é só suporte. Busca relacionamento, cross-sell, indicações e expansão de produtos por cliente.

**Responsabilidades:**
- Acompanhar clientes ativos com foco em relacionamento comercial
- Identificar clientes com apenas um produto e potencial para outros
- Gerar oportunidades de Saúde, Consórcio, Vida, Auto
- Pedir indicações de forma organizada e sistemática
- Reativar clientes antigos ou inativos
- Encaminhar oportunidades de maior porte para os consultores

**Entregáveis:**
- Lista de clientes com potencial de cross-sell
- Indicações coletadas
- Clientes reativados
- Oportunidades encaminhadas para venda
- Relatório de produtos por cliente

**Métricas:**
- Produtos por cliente (média)
- Cross-sell gerado
- Indicações recebidas
- Clientes reativados
- Receita gerada pela carteira
- Retenção comercial

---

#### SETOR 6 — Relações Imobiliárias

**Papel:** Mantém e expande o relacionamento com imobiliárias parceiras. Não existe apenas para receber fichas de fiança — deve gerar novas oportunidades comerciais para a Conves além do produto principal.

**Responsabilidades:**
- Relacionar-se com imobiliárias ativas (manter engajamento)
- Identificar parceiros com baixa produção e criar ações de retomada
- Buscar novas imobiliárias parceiras
- Criar campanhas com imobiliárias para Saúde, Consórcio e outros produtos
- Treinar parceiros para indicarem produtos além do seguro fiança
- Acompanhar produção por imobiliária

**Entregáveis:**
- Lista de imobiliárias ativas
- Lista de imobiliárias inativas (para reativação)
- Relatório de produção por parceiro
- Agenda de visitas ou contatos
- Campanhas comerciais para parceiros

**Métricas:**
- Imobiliárias ativas
- Leads gerados por imobiliária
- Prêmio gerado por parceiro
- Novas imobiliárias cadastradas
- Taxa de ativação de parceiros
- Receita originada por relacionamento imobiliário

---

### 3A.4 Equipe Comercial — Estrutura Detalhada

Os setores existem como **funções organizacionais** desde agora. As 3 pessoas acumulam funções — mas cada função tem processo, métricas e rotina próprios. Isso permite iniciar organizado e escalar sem retrabalho.

**Visão geral:**

| Pessoa | Cargo | Setores | Produtos |
|--------|-------|---------|---------|
| **Mateus Ugarte** | Gestor Comercial | Planejamento + Inteligência + Relações Imobiliárias | Todos (orientação e organização) |
| **Luciano Junior** | Executivo Comercial | Pré-Vendas + Consultoria + Customer Success | Auto + Plano de Saúde |
| **Eduardo Costa** | Executivo Comercial | Pré-Vendas + Consultoria + Customer Success | Consórcio + Financiamento |

---

### 3A.4.1 — MATEUS UGARTE | Gestor Comercial

**Setores:** Planejamento Comercial e Growth · Inteligência Comercial · Relações Imobiliárias

**Papel geral:** Mateus não vende diretamente. Ele é quem organiza o campo de batalha antes do time entrar. Seu trabalho é garantir que Luciano e Eduardo saibam **o que fazer, quando fazer e com quem falar** — com o máximo de dados e o mínimo de achismo.

---

#### PRODUTO: TODOS (Orientação e Inteligência)

**O que Mateus faz:**

**1. Planejamento mensal do comercial**
- Define o **produto foco do mês** com base em análise de carteira, sazonalidade e oportunidade (ex: "este mês atacamos Saúde PJ com empresas de 5+ funcionários")
- Cria o **briefing da campanha mensal**: público-alvo, argumento comercial, oferta, meta numérica e prazo
- Distribui o briefing para Luciano e Eduardo com orientações claras: o que abordar, como abordar e qual o resultado esperado
- **Por que importa:** Sem planejamento, cada um vai numa direção. Com planejamento, o esforço de 3 pessoas converge no mesmo ponto e multiplica resultado.

**2. Inteligência Comercial — criação de listas**
- Organiza e limpa a base de clientes no Conves Hub
- Segmenta clientes por perfil de produto: quem tem potencial de Saúde, quem tem potencial de Consórcio, quem tem potencial de Auto
- Separa oportunidades por origem: carteira ativa, cotações antigas não fechadas, renovações próximas, indicações recebidas
- Cria **listas qualificadas** prontas para Luciano e Eduardo trabalharem — não é uma lista genérica, é uma lista com priorização e contexto
- **Por que importa:** O SDR sem lista boa perde tempo com contatos frios. Com lista qualificada, o contato já começa com contexto — "vi que você tem seguro fiança conosco, queria entender se já tem plano de saúde para os funcionários."

**3. Relações com Imobiliárias**
- Mantém contato ativo com as imobiliárias parceiras — não apenas aguarda as fichas chegarem
- Identifica imobiliárias com baixa produção e cria planos de retomada
- Busca novos parceiros imobiliários por indicação ou prospecção ativa
- Cria campanhas com imobiliárias para além do seguro fiança (Saúde, Consórcio, Auto para inquilinos e proprietários)
- Treina parceiros para indicarem produtos além do fiança: "quando o inquilino aprovar, pergunte se ele precisa de seguro auto"
- Acompanha produção mensal por imobiliária e apresenta ranking para diretoria
- **Por que importa:** A imobiliária é o maior canal de entrada da Conves. Tratá-la apenas como "quem manda ficha" desperdiça o potencial de cross-sell de toda a cadeia de relacionamento.

**4. Acompanhamento e correção de rota**
- Acompanha os KPIs semanalmente: oportunidades geradas, reuniões, propostas, vendas
- Identifica gargalos no fluxo comercial (ex: "estamos gerando reuniões mas não fechando — o problema está na proposta")
- Orienta Luciano e Eduardo com base nos dados, não em impressão
- Revisão trimestral da estratégia: produtos prioritários, canais, necessidade de ajuste ou contratação
- **Por que importa:** Gestor sem dados é chefe de torcida. Com KPIs claros, a gestão é objetiva — sabe exatamente onde está o problema e o que corrigir.

**Rotina de Mateus:**

| Frequência | Atividade |
|-----------|-----------|
| Diária | Checar CRM — ver oportunidades abertas, follow-ups atrasados, reuniões do dia |
| Semanal | Reunião com Luciano e Eduardo: o que fechou, o que trava, o que priorizar |
| Mensal | Definir campanha, criar listas, distribuir briefing, analisar performance anterior |
| Trimestral | Revisão estratégica completa + relatório para diretoria |

---

### 3A.4.2 — LUCIANO JUNIOR | Executivo Comercial

**Setores:** Pré-Vendas (SDR) · Consultoria Comercial · Customer Success

**Papel geral:** Luciano é o responsável por todo o ciclo de vendas dos produtos **Auto** e **Plano de Saúde** — desde o primeiro contato até o pós-venda e a renovação. Seu trabalho começa nas listas que Mateus cria e termina no cliente fidelizado gerando novas indicações.

---

#### PRODUTO 1: SEGURO AUTO

**Divisão do produto:** O Auto tem duas frentes distintas, com objetivos e abordagens diferentes.

---

**FRENTE 1 — Seguros Novos (Aquisição)**

**O que Luciano faz:**
- Recebe as listas de oportunidades de Auto da Inteligência Comercial (clientes da carteira sem Auto, cotações antigas, indicações)
- Faz o **primeiro contato** (SDR): WhatsApp, ligação ou e-mail com abordagem personalizada e contextualizada
- Qualifica o lead: tem veículo? Já tem seguro? Com qual seguradora? Vencimento? Está satisfeito?
- Agenda reunião ou encaminha direto para cotação quando o perfil é claro
- Realiza o **diagnóstico completo**: tipo de veículo, uso, perfil do condutor principal, histórico de sinistros, coberturas desejadas
- Monta a cotação com as seguradoras mais adequadas ao perfil
- Apresenta a proposta com foco em **valor e cobertura**, não apenas preço
- Conduz negociação e fecha

**Objetivo de cada ação:**
- Primeiro contato → criar curiosidade e abrir o diálogo, não vender no primeiro contato
- Diagnóstico → entender o perfil real para cotar certo — cotação errada gera recusa ou decepção futura
- Proposta → mostrar o que o cliente GANHA, não o quanto ele paga

**Foco estratégico — Seguros Novos:**
> Cada cliente novo de Auto é uma oportunidade de criar um relacionamento de longo prazo. O seguro é o ponto de entrada, mas o cliente precisa sair da primeira interação sentindo que a Conves conhece o perfil dele e está do lado dele — não apenas vendeu e sumiu.

- Registrar no CRM: tipo de veículo, uso, perfil, coberturas contratadas e data de vencimento
- Enviar mensagem de boas-vindas após emissão
- Agendar contato de 30 dias pós-emissão para checar satisfação

---

**FRENTE 2 — Renovações (Retenção com Lucro)**

**O que Luciano faz:**
- Acompanha a fila de renovações vencendo nos próximos 30, 60 e 90 dias (via Conves Hub — módulo AutoRenovações)
- Entra em contato com antecedência (mínimo 45 dias antes do vencimento)
- Faz nova cotação com as seguradoras — mesmo que o cliente não tenha pedido
- Apresenta as opções ao cliente com clareza

**Objetivo da renovação — regra fundamental:**
> **O objetivo da renovação não é manter o cliente a qualquer custo. O objetivo é fechar com o máximo de lucro possível.**

Isso significa:
- Se a seguradora atual oferece a melhor condição para a Conves e cobre bem o cliente → renova na mesma
- Se outra seguradora oferece melhor comissão e cobertura equivalente → migra
- **Nunca reduzir comissão ou coberturas para "não perder o cliente"** — um cliente retido com margem baixa é pior que um cliente perdido
- Registrar motivo de perda quando não renovar (cliente saiu por preço? por cobertura? por insatisfação?)

**Como conduzir a renovação:**
1. Contato proativo: "Seu seguro vence em [data]. Já fizemos uma nova cotação para você."
2. Apresentar as opções sem pressão — "essa é a melhor relação cobertura/valor que encontramos para o seu perfil"
3. Se o cliente questionar preço: reforçar o que a Conves entrega além da apólice (sinistro acompanhado, consultoria, acesso direto)
4. Nunca entrar em leilão de preço com concorrente — competir em serviço, não em centavos

---

#### PRODUTO 2: PLANO DE SAÚDE

**Foco:** Venda de novos planos com ênfase em **empresas (PJ)**

**O que Luciano faz:**
- Recebe listas de oportunidades de Saúde (empresas da carteira sem plano, indicações de clientes PF com funcionários, prospecção ativa de empresas na região)
- Primeiro contato SDR: identificar se há interesse, quem é o tomador de decisão, quantos funcionários, se já tem plano e qual
- Qualificação: número de vidas, perfil dos colaboradores (faixa etária), plano atual, dores com o plano atual, orçamento
- Diagnóstico consultivo: "o que você espera de um plano de saúde para a sua equipe?" — entender rede, cobertura, valor por vida, franquias
- Cotar nas operadoras mais adequadas ao perfil levantado
- Apresentar proposta comparativa clara (cobertura, rede, valor por vida, carências)
- Conduzir negociação — geralmente é com o sócio ou RH da empresa
- Fechar contrato e acompanhar onboarding (cadastro dos beneficiários, carteirinhas)

**Por que foco em PJ:**
- Ticket médio muito superior ao PF (número de vidas × mensalidade)
- Comissão recorrente enquanto o contrato está ativo
- Empresas têm mais estabilidade que PF — menor churn
- Empresas da carteira de fiança (proprietários de imóveis com empresa) são leads naturais

**Abordagem específica para PJ:**
- Nunca abordar pelo preço — abordar pela **qualidade da rede e pela simplicidade de gestão**
- Mostrar que a Conves faz a gestão do plano junto com a empresa (inclusões, exclusões, sinistros)
- Para empresas sem plano: o argumento é benefício para retenção de talentos + custo empresarial (PJ paga menos que PF)
- Para empresas com plano ruim: o argumento é que elas já pagam mas não recebem o serviço adequado

**Pós-venda de Saúde (CS):**
- Check-in trimestral com o responsável da empresa: "está tudo funcionando? alguma dificuldade com sinistros?"
- Auxiliar em qualquer problema de atendimento na operadora — a Conves fica do lado
- Gerar indicações: "você conhece algum sócio ou amigo com empresa que também poderia se beneficiar?"

**Rotina de Luciano:**

| Frequência | Atividade |
|-----------|-----------|
| Diária | Contatos ativos (SDR), follow-ups pendentes, atualizar status no CRM |
| Diária | Checar fila de renovações com vencimento nos próximos 30 dias |
| Semanal | Revisar propostas em aberto, reuniões da semana, objeções frequentes |
| Mensal | Analisar conversão por produto, receita de renovações, cross-sell com Mateus |

---

### 3A.4.3 — EDUARDO COSTA | Executivo Comercial

**Setores:** Pré-Vendas (SDR) · Consultoria Comercial · Customer Success

**Papel geral:** Eduardo é responsável pelos produtos **Consórcio** e **Financiamento**. Sua característica central é que esses são produtos de **maior qualificação** — o cliente geralmente já tem algum relacionamento com a Conves antes de chegar até Eduardo. Isso significa que o processo de confiança está parcialmente construído, e o trabalho de Eduardo é aprofundar o diagnóstico e conduzir uma venda mais consultiva.

---

#### PRODUTO 1: CONSÓRCIO

**O que Eduardo faz:**

**Fase 1 — Prospecção e qualificação (SDR)**
- Recebe listas da Inteligência Comercial: clientes da carteira com perfil de planejamento patrimonial (compraram imóvel, têm empresa, estão em fase de crescimento)
- Primeiro contato personalizado: "você é cliente da Conves para [produto X]. Queria entender um pouco mais sobre seus planos para os próximos anos."
- Não inicia o contato falando de consórcio — inicia entendendo o momento de vida do cliente
- Qualifica se há objetivo que o consórcio atende: imóvel, veículo, expansão de empresa, reforma

**Fase 2 — Consultoria e venda**
- Diagnóstico completo: qual o objetivo? qual o prazo? qual o valor desejado? qual a capacidade de parcela?
- Explica o funcionamento do consórcio como **instrumento de planejamento**, não como alternativa barata ao financiamento
- Apresenta opções de carta, prazo, parcela e administradora
- Conduz reunião consultiva (sempre recomendada — consórcio exige entendimento do cliente para não gerar arrependimento)
- Fecha e registra a venda no CRM

**Fase 3 — Pós-venda e acompanhamento (CS)**
- Acompanha o cliente ao longo do contrato
- Registra feedbacks do cliente sobre a experiência com o consórcio
- Registra **contemplações** no portfólio da Conves: quando o cliente é contemplado, é case para uso comercial ("nosso cliente foi contemplado em X meses")
- Solicita indicação ao cliente contemplado — é o momento de maior satisfação e maior propensão a indicar
- Mantém contato regular: atualiza o cliente sobre sua posição no grupo, mudanças de taxa, estratégias de lance

**Objetivo do acompanhamento:**
> Consórcio é um produto de longo prazo (3 a 15 anos). Um cliente de consórcio bem acompanhado vira o maior promotor da Conves — ele vai indicar para família, sócios e amigos. Um cliente abandonado vai cancelar e nunca mais indicar ninguém.

**O que Eduardo NÃO faz:**
- Não vende consórcio como "mais barato que financiamento" — isso é argumento raso e cria expectativa errada
- Não fecha sem diagnóstico — o cliente que não entende o produto cancela em 6 meses

---

#### PRODUTO 2: FINANCIAMENTO

**Foco:** Novos financiamentos de imóvel e veículos

**Perfil do cliente de Eduardo para Financiamento:**
Eduardo geralmente vende para clientes que **já passaram por algum setor da Conves**. Isso é deliberado — financiamento é um produto de alta qualificação e alta confiança. Um cliente que já viu a Conves resolver um problema (sinistro, renovação, fiança) está muito mais aberto a fazer um financiamento com quem confia.

**O que Eduardo faz:**
- Identifica clientes com perfil de compra de imóvel ou veículo (carteira de fiança tem muitos locatários que vão virar proprietários; carteira de Auto tem compradores de carro)
- Qualifica: o cliente está planejando compra? Tem renda compatível? Tem entrada? Qual o prazo desejado?
- Explica as opções de financiamento (banco, cooperativa, construtora para imóvel; banco e financeira para veículo)
- Faz a simulação e apresenta as parcelas, taxas e condições
- Acompanha o processo até a aprovação e assinatura
- Registra pós-venda e mantém relacionamento

**Por que Eduardo vende para clientes qualificados:**
> Financiamento é um processo longo, com documentação e análise de crédito. Se o cliente não confia, desiste no meio do caminho. Eduardo tem a vantagem de trabalhar com quem já conhece a Conves — o processo de convencimento é mais curto e a conversão é mais alta.

**Pós-venda de Financiamento (CS):**
- Acompanhar o cliente durante o processo de financiamento (documentação, análise, aprovação)
- Manter contato pós-assinatura — o cliente que comprou imóvel vai precisar de seguro residencial; o que comprou carro vai precisar de Auto
- Cruzar automaticamente com Luciano: "Eduardo fechou um financiamento de carro → Luciano aborda o cliente para Auto"

**Rotina de Eduardo:**

| Frequência | Atividade |
|-----------|-----------|
| Diária | Contatos ativos, follow-ups, atualizar CRM com status de cada oportunidade |
| Diária | Verificar contemplações de consórcio — registrar e abordar o cliente |
| Semanal | Reuniões de consultoria, revisão de propostas em aberto, feedbacks de clientes |
| Mensal | Análise de conversão por produto, casos contemplados para portfólio, indicações coletadas |

---

### 3A.5 — Como os 3 Trabalham Juntos

A máquina comercial funciona como um sistema integrado. Cada um tem seu papel, mas os três se alimentam:

```
MATEUS
├─ Cria listas e define foco do mês
├─ Distribui para Luciano (Auto + Saúde) e Eduardo (Consórcio + Financiamento)
└─ Acompanha KPIs e corrige rota

LUCIANO                              EDUARDO
├─ Recebe lista → SDR                ├─ Recebe lista → SDR
├─ Qualifica → Consultoria           ├─ Qualifica → Consultoria
├─ Fecha → CS e renovação            ├─ Fecha → CS e portfólio
└─ Cruzamento: cliente de Auto       └─ Cruzamento: cliente contemplado
   → oportunidade de Saúde              → indicação para Auto (Luciano)
```

**Cruzamentos de produto entre Luciano e Eduardo:**
- Cliente de Financiamento de carro (Eduardo) → Auto (Luciano)
- Cliente de Financiamento de imóvel (Eduardo) → Seguro Residencial (futuro)
- Cliente de Auto renovado (Luciano) → Consórcio se está planejando novo veículo (Eduardo)
- Cliente de Saúde PJ (Luciano) → Consórcio PJ para sócios (Eduardo)

> **Regra operacional:** Todo cliente de um executivo que demonstrar potencial para o produto do outro deve ser registrado no CRM e comunicado. O cruzamento de oportunidades entre Luciano e Eduardo é um multiplicador de resultado que não tem custo adicional.

---

### 3A.5 Fluxo Comercial Padrão

```
1. PLANEJAMENTO COMERCIAL
   └─ Define produto foco do mês + meta da campanha

2. INTELIGÊNCIA COMERCIAL
   └─ Segmenta a carteira + cria listas de oportunidades

3. PRÉ-VENDAS / SDR
   └─ Entra em contato, qualifica, agenda reunião
   └─ Ou encaminha oportunidade simples diretamente para cotação

4. CONSULTORIA COMERCIAL
   └─ Diagnóstico + cotação + proposta + negociação + fechamento

5. CUSTOMER SUCCESS
   └─ Acompanha clientes ativos → cross-sell + indicações

6. RELAÇÕES IMOBILIÁRIAS
   └─ Ativa parceiros para gerar oportunidades adicionais
```

---

### 3A.6 Abordagem Comercial por Produto

#### Saúde

**Perfil de oportunidade:** Clientes PJ, empresários, famílias e clientes da carteira sem plano de saúde.

**Abordagem:**
- Consultiva — entender quantidade de vidas, plano atual, dores, rede desejada, orçamento e prazo
- Cotações simples: atendimento direto
- Oportunidades maiores (empresas, grupos): reunião consultiva obrigatória

**Por que é prioridade:** Alto potencial de recorrência e valor estratégico para a carteira.

#### Consórcio

**Perfil de oportunidade:** Clientes com perfil de compra futura — imóvel, veículo, investimento ou expansão patrimonial.

**Abordagem:**
- Começar pelo **objetivo do cliente**, não pela parcela
- Reunião consultiva recomendada quando o cliente ainda não sabe modalidade, valor ou prazo
- Nunca apresentar consórcio como "mais barato que financiamento" — apresentar como **planejamento patrimonial**

**Por que é prioridade:** Alto potencial de comissão e encaixa naturalmente no perfil de quem já é cliente de fiança ou auto.

---

### 3A.7 Rotina Comercial Recomendada

| Frequência | Atividade |
|-----------|-----------|
| **Diária** | Contatos ativos, follow-ups, atualização do CRM, acompanhamento das oportunidades abertas |
| **Semanal (segunda)** | Daily de alinhamento — objetivos da semana, prioridades e bloqueios |
| **Mensal** | Planejamento do mês — metas, produto foco, campanhas e como cada semana vai funcionar |
| **Trimestral** | Revisão da estratégia comercial, produtos prioritários, canais e necessidade de contratação |

**Regra operacional:** O CRM (Conves Hub) é o único registro oficial. Nada que não estiver no sistema conta como feito.

---

### 3A.8 — Rituais de Gestão Comercial

> Os rituais de reunião são parte do sistema cultural da Conves. Não são opcionais — são o mecanismo que mantém o time alinhado, o planejamento vivo e os resultados rastreáveis.
> **Responsável por conduzir todos os rituais:** Mateus Ugarte (Gestor Comercial).

---

#### RITUAL 1 — Daily de Segunda-feira (Semanal)

**Nome:** Daily Comercial
**Quando:** Toda segunda-feira, no início do dia
**Duração:** 30 a 45 minutos
**Participantes:** Mateus, Luciano, Eduardo
**Conduzida por:** Mateus

**Para que serve:**
A Daily de segunda não é uma reunião de cobrança — é uma reunião de alinhamento. O objetivo é garantir que os três entrem na semana sabendo **exatamente o que fazer**, com quem falar e qual é o resultado esperado. Sem daily, cada um opera no escuro. Com ela, o esforço converge.

**O que deve ser definido e discutido:**

**1. Balanço rápido da semana anterior** *(10 minutos)*
- Luciano: quantos contatos fez, quantas reuniões teve, quantas propostas enviou, o que fechou, o que travou
- Eduardo: mesmo formato
- Mateus: o que as listas geraram, como está a relação com as imobiliárias, o que o CRM mostra de gargalo
- Pergunta-chave: *"O que não andou como esperado na semana passada e por quê?"*

**2. Prioridades da semana atual** *(10 minutos)*
- Mateus define **o foco da semana** com base no planejamento mensal: qual produto está em destaque, qual lista trabalhar, se tem alguma campanha ativa
- Luciano confirma suas 3 prioridades da semana (ex: "vou focar nas 10 oportunidades de Auto renovação + 5 leads de Saúde PJ")
- Eduardo confirma suas 3 prioridades (ex: "vou retomar 7 cotações de Consórcio paradas + 3 oportunidades de Financiamento imóvel")

**3. Follow-ups críticos** *(5 minutos)*
- Cada um aponta os follow-ups que **não podem cair** nessa semana — propostas em negociação, clientes que prometeram dar resposta, renovações com vencimento urgente
- Mateus registra e monitora durante a semana

**4. Bloqueios e apoio necessário** *(5 minutos)*
- Algum cliente travado que precisa de uma abordagem diferente?
- Falta alguma lista, dado ou contexto que Mateus precisa levantar?
- Tem algum cruzamento de produto entre Luciano e Eduardo a explorar essa semana?

**5. Compromisso da semana** *(5 minutos)*
- Cada um declara seu objetivo concreto da semana: *"Minha meta essa semana é X reuniões / Y propostas / Z fechamentos"*
- Simples, mensurável, declarado em voz alta
- Na daily seguinte, cada um reporta se bateu

**Formato de condução (Mateus):**
```
1. "Luciano, como foi sua semana? O que fechou, o que travou?"
2. "Eduardo, mesmo — o que aconteceu com as oportunidades que estavam abertas?"
3. "Baseado nisso, o foco dessa semana é [X]. Luciano, suas 3 prioridades são [Y]. Eduardo, as suas são [Z]."
4. "Quais follow-ups críticos não podem cair essa semana?"
5. "Tem algum bloqueio que eu preciso resolver para vocês avançarem?"
6. "Compromisso da semana: Luciano? Eduardo?"
```

**Regra da Daily:**
> Ninguém sai da daily sem saber exatamente o que vai fazer nessa semana. Se alguém saiu sem clareza, a reunião falhou.

---

#### RITUAL 2 — Planejamento Mensal

**Nome:** Planejamento do Mês
**Quando:** Último dia útil do mês anterior (ou primeira segunda do mês, se necessário)
**Duração:** 1h30 a 2h
**Participantes:** Mateus, Luciano, Eduardo
**Conduzida por:** Mateus

**Para que serve:**
O planejamento mensal é o momento estratégico do comercial. Aqui se decide **o que a Conves vai vender no mês, para quem, como e quanto**. É a reunião que dá contexto para todas as dailys da semana. Sem esse planejamento, as dailys são só checklist. Com ele, as dailys têm direção.

**O que deve ser definido e discutido:**

**BLOCO 1 — Análise do mês anterior** *(20 minutos)*

Mateus apresenta os números consolidados do mês que fechou:

- Total de oportunidades geradas
- Total de contatos efetivos realizados
- Reuniões qualificadas
- Propostas enviadas
- Vendas fechadas
- Receita e comissão gerada (por produto e por pessoa)
- Taxa de conversão (proposta → venda)
- Principais motivos de perda registrados no CRM
- Campanha do mês: funcionou? Gerou oportunidades? Converteu?

Perguntas obrigatórias:
- *"O que funcionou esse mês e precisa ser repetido?"*
- *"O que não funcionou e precisa ser ajustado ou abandonado?"*
- *"Qual foi o maior gargalo — falta de oportunidades, falta de reuniões, ou falta de fechamento?"*

---

**BLOCO 2 — Produto foco do mês** *(15 minutos)*

Mateus define, com base na análise, **qual produto receberá atenção prioritária no mês**. Pode ser um produto que teve boa performance e deve ser acelerado, ou um produto com potencial não aproveitado.

- Produto foco de Luciano (Auto novos, Renovações, Saúde PJ): *"Este mês, Luciano, o foco é X por causa de Y"*
- Produto foco de Eduardo (Consórcio, Financiamento): *"Este mês, Eduardo, o foco é X por causa de Y"*

---

**BLOCO 3 — Metas do mês** *(15 minutos)*

Definir metas por pessoa e por produto. Metas devem ser:
- Numéricas (não "vender mais" — sim "fechar 3 vendas de Saúde PJ")
- Realistas com base no histórico
- Divididas em metas de atividade (o que cada um vai fazer) e metas de resultado (o que deve gerar)

**Formato das metas:**

| Pessoa | Meta de atividade | Meta de resultado |
|--------|------------------|------------------|
| Luciano | X contatos, Y reuniões de Auto, Z reuniões de Saúde | X vendas Auto, Y vendas Saúde, Z renovações fechadas |
| Eduardo | X contatos, Y reuniões de Consórcio, Z reuniões de Financiamento | X vendas Consórcio, Y vendas Financiamento |
| Mateus | X listas geradas, Y imobiliárias contatadas, Z campanhas criadas | Oportunidades suficientes para as metas de Luciano e Eduardo |

---

**BLOCO 4 — Campanha do mês** *(15 minutos)*

Mateus apresenta ou constrói junto o briefing da campanha do mês:

- **Produto:** qual produto será trabalhado na campanha
- **Público-alvo:** qual segmento da carteira ou mercado
- **Argumento comercial:** qual é a mensagem central (não pode ser genérico)
- **Canal:** como o contato vai acontecer (WhatsApp, ligação, e-mail, presencial)
- **Meta da campanha:** quantas oportunidades, reuniões ou vendas se espera gerar
- **Lista:** Mateus se compromete a entregar a lista segmentada até qual data

---

**BLOCO 5 — Como o mês vai funcionar semana a semana** *(15 minutos)*

O mês não é um bloco único — tem uma lógica de progressão:

| Semana | Foco |
|--------|------|
| **Semana 1** | Arranque — contatos da lista nova, reativar oportunidades paradas, agendar reuniões |
| **Semana 2** | Reuniões e propostas — executar as reuniões agendadas, enviar propostas |
| **Semana 3** | Follow-up e fechamento — perseguir as propostas em aberto, negociar, fechar |
| **Semana 4** | Encerramento e colheita — últimos fechamentos, registrar resultados, colher indicações, preparar análise para o próximo mês |

Esse ritmo não é rígido — adapta conforme o que está em aberto. Mas serve como norte para Mateus orientar as dailys de cada semana com contexto.

---

**BLOCO 6 — Compromissos do mês** *(10 minutos)*

Cada um declara seu compromisso:
- Luciano: *"Esse mês eu me comprometo a [meta de resultado] e vou fazer [meta de atividade] para chegar lá"*
- Eduardo: mesmo formato
- Mateus: *"Meu compromisso é entregar [listas, briefing, suporte] para que vocês tenham o que precisam"*

**Regra do Planejamento Mensal:**
> O planejamento só está completo quando: (1) produto foco definido, (2) metas numéricas declaradas por cada um, (3) campanha com briefing e lista mapeados, (4) cada semana tem um foco claro. Se algum desses falta, a reunião precisa de mais tempo.

---

#### RESUMO — Os 2 Rituais em uma Linha

| Ritual | Quando | Duração | Para que serve |
|--------|--------|---------|----------------|
| **Daily de Segunda** | Toda segunda | 30-45 min | Alinhar semana: o que fazer, com quem, qual o compromisso |
| **Planejamento Mensal** | Última semana do mês | 1h30-2h | Decidir o mês: produto foco, metas, campanha, ritmo semanal |

**Regra cultural:**
> Reunião sem pauta → não acontece.
> Reunião sem decisão → foi desperdício.
> Reunião sem registro no CRM → não existiu.

---

### 3A.8 Indicadores Gerais da Área Comercial

Indicadores que devem ser acompanhados pela gestão comercial:

- Oportunidades geradas
- Oportunidades trabalhadas
- Contatos efetivos
- Reuniões qualificadas
- Propostas enviadas
- Vendas fechadas
- Prêmio total vendido
- Comissão gerada
- Taxa de conversão por produto
- Produtos por cliente (média)
- Receita por campanha
- Produção por canal: carteira, cotação perdida, indicação, imobiliária e relacionamento

---

### 3A.9 Fases de Evolução da Estrutura Comercial

A estrutura começa enxuta mas já preparada para escalar. Quando houver volume previsível de oportunidades e vendas, a Conves separa pessoas dedicadas por função.

| Fase | Estrutura | Gatilho |
|------|-----------|---------|
| **Fase 1 — Atual** | 3 pessoas acumulando funções comerciais | — |
| **Fase 2** | 1 SDR dedicado + 2 consultores comerciais | Volume de oportunidades > capacidade das 3 pessoas |
| **Fase 3** | SDRs, consultores, CS e Relações Imobiliárias separados | Receita recorrente previsível de Saúde e Consórcio |
| **Fase 4** | Estrutura completa: Gestor, Inteligência, Growth, SDRs, Consultores, CS, Relações | Escala corporativa |

---

---

## CAPÍTULO 3-B — SETORES DA EMPRESA: RESPONSABILIDADES E IMPACTO NO FATURAMENTO

> Este capítulo existe para que todos na empresa entendam não apenas **o que fazem**, mas **por que isso importa para o resultado**. Cada setor tem um papel direto ou indireto na geração de receita. Conhecer esse papel é parte da cultura da Conves.

---

### VISÃO GERAL — O MOTOR DE RECEITA DA CONVES

A Conves gera receita de três formas:

```
1. OPERAÇÃO     → processar fichas e emitir apólices gera comissão de fiança (base atual)
2. RENOVAÇÃO    → manter e renovar apólices existentes gera receita recorrente
3. EXPANSÃO     → vender novos produtos para a carteira e novos clientes gera crescimento
```

Cada setor da empresa alimenta um ou mais desses três motores. O problema que a reformulação resolve é que, até agora, só o motor 1 funcionava de forma estruturada. Os motores 2 e 3 dependiam de iniciativa individual — sem processo, sem rastreamento, sem previsibilidade.

---

### SETOR 1 — CENTRAL DE FICHAS (FIANÇA)

**Responsável:** Equipe de orçamentistas (Davi, Dayana, Eduardo, Laís, Marcos, Luciano, Patrícia Dantas)
**Motor de receita:** Operação

**O que o setor faz:**
Recebe solicitações de seguro fiança vindas das imobiliárias parceiras, processa as cotações nas seguradoras e encaminha propostas. É o núcleo operacional histórico da Conves e a principal fonte de receita atual.

**Como transforma faturamento:**
Cada ficha cotada e aprovada gera uma apólice. Cada apólice gera comissão. Com ~500 fichas/mês e ~200-250 apólices emitidas, este setor sustenta a operação inteira da empresa. Uma melhora de 5% na taxa de conversão representa dezenas de apólices a mais por mês — sem nenhum custo de aquisição adicional.

**Alavancas de faturamento:**
- Aumentar a **taxa de conversão** ficha → apólice (hoje ~40-50%, meta: 55%+)
- Reduzir o **tempo médio de cotação** (fichas rápidas geram mais retorno de imobiliária)
- Reduzir fichas **abandonadas ou expiradas** por falta de follow-up

**Objetivo do setor:**
> Processar o máximo de fichas com o mínimo de perda. Cada ficha assumida deve ser trabalhada até o resultado final — aprovada, emitida ou recusada com registro. Nenhuma ficha some sem retorno à imobiliária.

**Impacto cultural:**
O orçamentista não é só quem "roda cotação". Ele é o primeiro ponto de contato da Conves com o cliente final (o inquilino). A rapidez, a qualidade do retorno e a clareza da comunicação constroem — ou destroem — a reputação da Conves junto às imobiliárias.

---

### SETOR 2 — EMISSÕES E APÓLICES

**Responsáveis:** Dayana, Patrícia Dantas
**Motor de receita:** Operação + Renovação

**O que o setor faz:**
Formaliza a emissão das apólices aprovadas — registra no sistema, encaminha para a seguradora, controla vigência e acompanha o ciclo de vida de cada apólice ativa.

**Como transforma faturamento:**
Uma ficha aprovada só vira receita quando a apólice é emitida. Atrasos ou erros na emissão significam receita travada. Além disso, o controle de vigência é o gatilho para o processo de renovação — sem apólice bem registrada, a renovação não acontece no momento certo.

**Alavancas de faturamento:**
- Emissão dentro do prazo — **zero apólices paradas por erro de processo**
- Registro completo de vigência — habilita o **alerta de renovação** no prazo certo
- Qualidade dos dados registrados — viabiliza os relatórios de comissão e produção

**Objetivo do setor:**
> Cada apólice aprovada deve ser emitida e registrada em no máximo 24h. Cada apólice ativa deve ter vigência registrada corretamente para que o processo de renovação seja acionado no tempo certo.

---

### SETOR 3 — RENOVAÇÕES (AUTO E FIANÇA)

**Responsável principal:** Laís (fiança) · Luciano Junior (auto)
**Motor de receita:** Renovação

**O que o setor faz:**
Monitora apólices próximas do vencimento, contata o cliente com antecedência, recotiza quando necessário e conduz o processo de renovação.

**Como transforma faturamento:**
Renovação é a receita mais barata que existe — o cliente já conhece a Conves, já confia no produto, já passou pelo processo. Renovar um cliente custa uma fração do que custa adquirir um novo. Uma carteira de renovações saudável é receita previsível mês a mês.

**Alavancas de faturamento:**
- Taxa de renovação alta (meta: reter acima de X% da carteira vigente)
- Renovar com **margem máxima**, não com desconto para não perder — essa é uma diretriz estratégica da Conves
- Identificar na renovação oportunidades de **upgrade de cobertura** ou **cross-sell** para outro produto

**Objetivo do setor:**
> Nenhuma apólice deve vencer sem que o cliente tenha sido contatado com pelo menos 45 dias de antecedência. O objetivo não é manter o cliente a qualquer custo — é renovar com a melhor condição possível para a Conves e para o cliente. Renovação com margem ruim não é sucesso.

**Impacto cultural:**
O setor de renovações é onde a Conves demonstra que não abandona o cliente após a venda. Um cliente renovado 3, 4, 5 vezes é um cliente que indica. A renovação não é burocracia — é relacionamento com recorrência.

---

### SETOR 4 — SINISTROS

**Responsável:** Patrícia Barbara
**Motor de receita:** Renovação (indireto)

**O que o setor faz:**
Recebe comunicações de sinistro, abre o processo na seguradora, acompanha o andamento e mantém o cliente informado até a resolução.

**Como transforma faturamento:**
Sinistro não gera receita direta — mas define se o cliente ficará ou não. Um sinistro mal conduzido é a principal causa de churn em corretoras. Um sinistro bem resolvido é a principal causa de indicação. Este setor é o diferencial mais concreto da Conves — "a corretora que fica do seu lado quando o problema acontece".

**Alavancas de faturamento (indireto):**
- **Retenção:** cliente com sinistro resolvido renova com a Conves mesmo podendo ir para outra
- **Indicação:** cliente que foi bem atendido no sinistro conta para 3 a 5 pessoas
- **Reputação junto às imobiliárias:** imobiliária que vê seus inquilinos bem atendidos manda mais fichas

**Objetivo do setor:**
> Todo sinistro deve ter acompanhamento ativo da Conves — não passivo. O cliente não pode precisar ligar para saber o que está acontecendo. A Conves liga primeiro. Nenhum sinistro fica sem atualização por mais de 48h.

**Impacto cultural:**
O diferencial da Conves não é preço. É serviço. E o serviço se prova no sinistro. Este setor carrega na prática o posicionamento que a empresa comunica: "a corretora que resolve o que não é problema dela".

---

### SETOR 5 — PLANEJAMENTO COMERCIAL E INTELIGÊNCIA (MATEUS)

**Responsável:** Mateus Ugarte
**Motor de receita:** Expansão

**O que o setor faz:**
Define o que o comercial vai vender a cada mês, para quem, e transforma os dados da carteira em listas de oportunidades qualificadas para os executivos trabalharem.

**Como transforma faturamento:**
Sem este setor, os executivos comerciais trabalham no escuro — sem saber em quem focar, qual produto tem mais potencial ou qual segmento da carteira está subaproveitado. Com ele, cada contato de Luciano e Eduardo começa com contexto e prioridade. O resultado: mais reuniões, mais propostas, mais vendas — sem aumentar o esforço bruto.

**Alavancas de faturamento:**
- **Segmentação da carteira:** identificar os 200 clientes com maior potencial de cross-sell é mais valioso que abordar 2000 clientes sem critério
- **Campanhas mensais:** produto foco + argumento + lista = esforço concentrado que gera resultado mensurável
- **Inteligência de perda:** analisar motivos de perda no CRM para corrigir abordagem, produto ou processo

**Objetivo do setor:**
> Todo mês, Luciano e Eduardo devem iniciar a semana 1 com uma lista qualificada e um briefing claro. Zero mês sem campanha definida. Zero executivo comercial sem direção de onde focar.

---

### SETOR 6 — PRÉ-VENDAS / SDR (LUCIANO + EDUARDO)

**Responsável:** Luciano Junior e Eduardo Costa (função acumulada)
**Motor de receita:** Expansão

**O que o setor faz:**
Realiza o primeiro contato com as oportunidades levantadas pela Inteligência Comercial, qualifica o interesse e potencial de cada lead, e agenda reuniões para a etapa de consultoria.

**Como transforma faturamento:**
A diferença entre uma consultoria que fecha e uma que não fecha começa aqui. Um lead bem qualificado chega à reunião de consultoria com contexto, abertura e necessidade mapeada — a venda é 3x mais fácil. Um lead não qualificado é uma reunião que provavelmente vai em círculos. O SDR protege o tempo do consultor.

**Alavancas de faturamento:**
- **Taxa de qualificação:** só avançam leads com real potencial — sem desperdiçar reunião de consultoria com quem não está no momento
- **Velocidade de contato:** quanto mais rápido o primeiro contato após a identificação da oportunidade, maior a conversão
- **Qualidade do diagnóstico inicial:** o resumo que o SDR passa para o consultor define a qualidade da reunião

**Objetivo do setor:**
> Cada lista recebida de Mateus deve ser trabalhada em no máximo 5 dias úteis. Todo lead qualificado deve ter reunião agendada ou status definido (quente/morno/frio/descartado) registrado no CRM.

---

### SETOR 7 — CONSULTORIA COMERCIAL (LUCIANO + EDUARDO)

**Responsável:** Luciano Junior (Auto + Saúde) · Eduardo Costa (Consórcio + Financiamento)
**Motor de receita:** Expansão

**O que o setor faz:**
Realiza o diagnóstico aprofundado do cliente, monta proposta adequada ao perfil, conduz a negociação e fecha o contrato.

**Como transforma faturamento:**
Este é o setor onde a receita nova é gerada. Cada venda fechada aqui representa um produto novo na carteira — seja Auto, Saúde, Consórcio ou Financiamento. O crescimento da Conves além da fiança passa inteiramente por este setor. Sem ele funcionando bem, a empresa fica dependente para sempre de um único produto.

**Alavancas de faturamento:**
- **Taxa de conversão:** reunião → proposta → venda — cada etapa tem uma taxa que pode ser medida e melhorada
- **Ticket médio:** proposta bem construída fecha em valor maior que proposta genérica
- **Velocidade de fechamento:** cada dia que a proposta fica em aberto sem resposta aumenta o risco de perda
- **Registro de objeções:** entender por que perde é tão importante quanto entender por que vende — alimenta melhoria contínua

**Objetivo do setor:**
> Taxa de conversão de reunião para proposta acima de X%. Taxa de conversão de proposta para venda acima de Y%. Todo fechamento registrado no CRM com produto, valor, comissão e data. Todo não-fechamento registrado com motivo de perda.

---

### SETOR 8 — CUSTOMER SUCCESS COMERCIAL (LUCIANO + EDUARDO)

**Responsável:** Luciano Junior e Eduardo Costa (função acumulada)
**Motor de receita:** Renovação + Expansão

**O que o setor faz:**
Acompanha clientes após a venda com foco em relacionamento, identificação de novas oportunidades de produto, coleta de indicações e retenção ativa da carteira.

**Como transforma faturamento:**
A carteira ativa da Conves tem 3000+ clientes. A maioria deles tem apenas 1 produto. Cada cliente com 1 produto é uma oportunidade de cross-sell que já existe — já tem nome, já tem histórico, já tem confiança estabelecida. Aumentar de 1 para 1,5 produtos por cliente na média já representa crescimento de 50% na receita por cliente, sem nenhum cliente novo.

**Alavancas de faturamento:**
- **Produtos por cliente:** a métrica mais importante do CS — quanto maior, mais saudável a carteira
- **Indicações:** cada indicação é um lead com taxa de conversão 2x a 3x maior que lead frio
- **Reativação:** clientes que saíram ou estão inativos são mais fáceis de reconquistar que conquistar novos
- **Antecipação de churn:** identificar cliente insatisfeito antes que ele cancele e agir

**Objetivo do setor:**
> Aumentar a média de produtos por cliente de 1 para 1,3 em 12 meses. Coletar pelo menos X indicações por mês. Registrar no CRM todo contato de pós-venda — CS que não está no sistema não aconteceu.

---

### SETOR 9 — RELAÇÕES IMOBILIÁRIAS (MATEUS)

**Responsável:** Mateus Ugarte
**Motor de receita:** Operação + Expansão

**O que o setor faz:**
Mantém e desenvolve o relacionamento com as ~100 imobiliárias parceiras. Vai além de receber fichas — atua para transformar imobiliárias em canal de múltiplos produtos.

**Como transforma faturamento:**
As imobiliárias são o maior canal de entrada de clientes da Conves. Cada imobiliária ativa representa dezenas de novos inquilinos e proprietários por mês — todos com potencial de Auto, Saúde e outros produtos. Hoje esse potencial é quase completamente ignorado. Uma imobiliária bem trabalhada não é só fonte de fiança — é canal comercial para toda a esteira de produtos.

**Alavancas de faturamento:**
- **Reativação de imobiliárias esporádicas:** 30 imobiliárias paradas são 30 fontes de fluxo que existem mas não estão gerando
- **Expansão do portfólio por parceiro:** treinar a imobiliária para indicar Auto para o inquilino que está assinando o contrato
- **Novas imobiliárias:** cada nova imobiliária ativa é um novo canal de entrada de fichas sem custo de mídia
- **Campanhas conjuntas:** a imobiliária pode ser ponto de oferta de Saúde para proprietários com empresa

**Objetivo do setor:**
> Manter um calendário de contato ativo com as 50 imobiliárias principais. Reativar pelo menos 5 imobiliárias esporádicas por trimestre. Gerar pelo menos X oportunidades de produto além do fiança por mês via canal imobiliário.

---

### MAPA CONSOLIDADO — SETORES × FATURAMENTO

| Setor | Motor | Impacto direto | Métrica-chave |
|-------|-------|----------------|---------------|
| Central de Fichas | Operação | Comissão de fiança | Taxa de conversão ficha→apólice |
| Emissões e Apólices | Operação | Receita confirmada | Tempo de emissão + qualidade do registro |
| Renovações | Renovação | Receita recorrente | Taxa de renovação + margem média |
| Sinistros | Renovação (indireto) | Retenção + indicação | % sinistros com acompanhamento ativo |
| Planejamento e Inteligência | Expansão | Direcionamento do esforço | Listas qualificadas entregues/mês |
| Pré-Vendas / SDR | Expansão | Pipeline qualificado | Reuniões qualificadas/mês |
| Consultoria Comercial | Expansão | Receita nova | Taxa de conversão proposta→venda |
| Customer Success | Renovação + Expansão | Carteira saudável | Produtos por cliente + indicações |
| Relações Imobiliárias | Operação + Expansão | Canal de entrada | Imobiliárias ativas + leads/canal |

---

### A LÓGICA QUE CONECTA TUDO

```
IMOBILIÁRIAS            CARTEIRA ATIVA           MERCADO
     ↓                        ↓                      ↓
Central de Fichas      Customer Success          SDR / Outbound
     ↓                        ↓                      ↓
Emissões           Consultoria Comercial (cross-sell)
     ↓                        ↓
Renovações         Planejamento e Inteligência
     ↓                        ↓
Sinistros ←——— FIDELIZAÇÃO E INDICAÇÃO ———→ Nova entrada
```

> Cada setor alimenta o próximo. O operacional entrega o cliente. O CS mantém o cliente. O comercial expande o cliente. O sinistros fideliza o cliente. O planejamento direciona onde atacar. Quando todos funcionam juntos e usam o mesmo sistema (Conves Hub), a empresa para de depender de memória individual e passa a operar como uma máquina.

---

---

## CAPÍTULO 3-C — PROCESSOS COMERCIAIS DETALHADOS

> Mapeamento do fluxo de cada processo comercial do início ao fim — sem scripts, com objetivos claros em cada etapa.
> Scripts e abordagens específicas serão definidos pelo Gestor Comercial após aprovação do projeto.

---

### FUNDAMENTO — COMO OS 3 TRABALHAM COMO UM TIME

Antes de mapear os processos individuais, é essencial entender a **lógica de funcionamento do time como sistema**. Os três não operam em paralelo — operam em ciclo. Um alimenta o outro.

---

#### O CICLO COMERCIAL DA CONVES

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   MATEUS                                                │
│   Analisa a base de dados e o CRM                       │
│   Identifica oportunidades por produto e perfil         │
│   Monta lista qualificada para cada vendedor            │
│   Define: quem é o lead, qual produto, qual objetivo    │
│                                                         │
│              ↓ entrega lista com briefing               │
│                                                         │
│   LUCIANO + EDUARDO                                     │
│   Recebem a lista com contexto de cada lead             │
│   Trabalham os leads conforme o planejamento            │
│   Registram tudo no CRM (contatos, reuniões, propostas) │
│                                                         │
│              ↓ dados de desempenho voltam ao CRM        │
│                                                         │
│   MATEUS                                                │
│   Lê os resultados no CRM                               │
│   Identifica onde está o gargalo                        │
│   Orienta ajustes: abordagem, produto, timing, lista    │
│                                                         │
│              ↓ executam com ajuste                      │
│                                                         │
│   LUCIANO + EDUARDO                                     │
│   Vendem mais                                           │
│   Geram receita                                         │
│   Alimentam o CRM com novos dados                       │
│                                                         │
│              ↓ ciclo reinicia                           │
└─────────────────────────────────────────────────────────┘
```

---

#### O QUE MATEUS ENTREGA NA LISTA

A lista que Mateus prepara não é uma planilha de nomes. É um **briefing de oportunidades**. Para cada lead, Mateus define:

| Campo | O que é | Por que importa |
|-------|---------|----------------|
| **Nome e contato** | Dados básicos do lead | Para o vendedor saber com quem falar |
| **Origem** | De onde veio (carteira, cotação antiga, imobiliária, indicação) | Define o nível de confiança inicial |
| **Produto-alvo** | Qual produto o vendedor vai abordar | Foco — sem isso o vendedor improvisa |
| **Contexto do lead** | O que a Conves já sabe sobre ele (produtos ativos, histórico) | O vendedor não entra em branco — já tem base |
| **Objetivo com esse lead** | O que se espera do contato (agendar reunião, cotar, reativar) | Define o critério de sucesso da abordagem |
| **Prioridade** | Alta / média / baixa | Ordena onde o vendedor começa a semana |

> **Regra:** Mateus não entrega lista sem contexto. Vendedor sem contexto desperdiça o lead. Lead desperdiçado é receita perdida que já estava na carteira.

---

#### O QUE OS VENDEDORES DEVOLVEM PARA MATEUS

O ciclo só funciona se os dados voltam. Depois de trabalhar os leads, Luciano e Eduardo registram no CRM:

- Status de cada lead (qualificado, não qualificado, reunião agendada, proposta enviada, fechado, perdido)
- Motivo quando não avançou (sem interesse, momento errado, concorrente, produto inadequado)
- Observações que mudam o contexto do lead para abordagens futuras

> **Regra:** O CRM é o canal de comunicação entre Mateus e os vendedores. O que não está no CRM, Mateus não enxerga — e não pode ajudar.

---

#### O QUE MATEUS FAZ COM OS DADOS

Mateus não espera o fim do mês para reagir. Lê o CRM semanalmente e identifica padrões:

- **Taxa de contato baixa?** — pode ser lista ruim, produto inadequado ou timing errado
- **Muitas reuniões, poucos fechamentos?** — o problema está na proposta ou na qualificação
- **Muitos "não é o momento"?** — a segmentação precisa de critério diferente
- **Um produto específico performando mal?** — revisar argumento, lista ou abordagem

Com isso, orienta os vendedores com dados — não com achismo.

---

#### POR QUE ESSE CICLO FUNCIONA

A maioria dos times comerciais opera assim: o vendedor recebe contatos genéricos, aborda sem contexto, perde muito tempo qualificando o que não deveria ser qualificado, fecha menos do que poderia e não sabe por que perdeu.

Na Conves, o ciclo muda isso:

- Mateus filtra antes → vendedor só toca em lead com potencial real
- Mateus dá contexto → vendedor entra na conversa já sabendo o que buscar
- Dados voltam ao CRM → Mateus enxerga onde está o problema
- Mateus ajusta → vendedor executa melhor na próxima semana

O resultado é um time que **melhora semana a semana por design**, não por acaso.

---

### PROCESSOS COMERCIAIS — ÍNDICE

| # | Processo | Responsável | Status |
|---|---------|-------------|--------|
| PC-01 | Ciclo de Campanha Mensal | Mateus | ✅ mapeado abaixo |
| PC-02 | Auto — Seguro Novo | Luciano | ✅ mapeado abaixo |
| PC-03 | Auto — Renovação | Luciano | ✅ mapeado abaixo |
| PC-04 | Saúde PJ | Luciano | ✅ mapeado abaixo |
| PC-05 | Consórcio | Eduardo | ✅ mapeado abaixo |
| PC-06 | Financiamento | Eduardo | ✅ mapeado abaixo |
| PC-07 | Onboarding de Imobiliária | Mateus | ✅ mapeado abaixo |

---

### PC-01 — CICLO DE CAMPANHA MENSAL

**Responsável:** Mateus Ugarte
**Objetivo geral:** Garantir que o comercial entre em cada mês sabendo exatamente o que vender, para quem e com qual argumento — transformando a carteira e o mercado em oportunidades previsíveis.

---

**ETAPA 1 — Análise do mês anterior**
- **O que acontece:** Mateus puxa os dados do CRM: oportunidades geradas, trabalhadas, reuniões, propostas, fechamentos, receita e motivos de perda
- **Objetivo:** Entender o que funcionou, o que não funcionou e onde estão os gargalos antes de planejar o próximo mês
- **Resultado esperado:** Lista de aprendizados claros — o que repetir, o que ajustar, o que abandonar

**ETAPA 2 — Definição do produto foco**
- **O que acontece:** Com base na análise, Mateus define qual produto terá prioridade no mês (pode ser um por vendedor ou um único foco para os dois)
- **Critérios de decisão:** comissão do produto, potencial da carteira, sazonalidade, metas da diretoria
- **Objetivo:** Concentrar o esforço do time onde o retorno é maior — evitar dispersão de atenção
- **Resultado esperado:** Produto foco definido para Luciano e produto foco definido para Eduardo

**ETAPA 3 — Segmentação da carteira (Inteligência Comercial)**
- **O que acontece:** Mateus acessa a base de clientes no Conves Hub, filtra por perfil relevante para o produto foco e segmenta as oportunidades por origem (carteira ativa, cotações perdidas, renovações próximas, indicações)
- **Objetivo:** Criar listas qualificadas com contexto — não listas genéricas de nomes
- **Resultado esperado:** Uma lista por vendedor com leads priorizados, contexto e objetivo definido para cada um

**ETAPA 4 — Criação do briefing da campanha**
- **O que acontece:** Mateus monta o documento de campanha do mês com: produto foco, público-alvo, argumento central, canal de abordagem, meta e prazo de entrega das listas
- **Objetivo:** Dar ao time um norte único — todos sabem qual é a mensagem e o que se espera
- **Resultado esperado:** Briefing escrito e entregue antes do início da semana 1

**ETAPA 5 — Distribuição para os vendedores**
- **O que acontece:** Mateus apresenta o briefing e as listas para Luciano e Eduardo no planejamento mensal (ou na daily de segunda da semana 1). Cada um recebe sua lista com contexto de cada lead
- **Objetivo:** Garantir que os vendedores entram na semana 1 sabendo o que fazer — sem tempo perdido descobrindo por onde começar
- **Resultado esperado:** Luciano e Eduardo saem com listas nas mãos e clareza do que cada lead representa

**ETAPA 6 — Execução e acompanhamento semanal**
- **O que acontece:** Os vendedores trabalham as listas. Mateus acompanha o CRM semanalmente e usa as dailys de segunda para ajustar rota
- **Objetivo:** Corrigir problemas em tempo real — não esperar o fim do mês para descobrir que algo não funcionou
- **Resultado esperado:** Ajustes de abordagem, prioridade ou lista feitos durante o mês, não depois

**ETAPA 7 — Encerramento e colheita de dados**
- **O que acontece:** Na semana 4, Mateus consolida os resultados: oportunidades geradas, reuniões, propostas, fechamentos, receita, motivos de perda
- **Objetivo:** Alimentar o próximo ciclo com dados reais — o ciclo se aperfeiçoa mês a mês
- **Resultado esperado:** Relatório de resultado da campanha pronto para a reunião de planejamento do próximo mês

```
ANÁLISE → PRODUTO FOCO → SEGMENTAÇÃO → BRIEFING → DISTRIBUIÇÃO → EXECUÇÃO → COLHEITA
   ↑                                                                              ↓
   └──────────────────── alimenta o próximo ciclo ───────────────────────────────┘
```

---

### PC-02 — AUTO: SEGURO NOVO

**Responsável:** Luciano Junior
**Objetivo geral:** Adquirir novos clientes de seguro auto criando desde o primeiro contato um relacionamento de confiança — o cliente deve sair da primeira venda sentindo que a Conves conhece o perfil dele, não que apenas vendeu uma apólice.

---

**ETAPA 1 — Recebimento da lista (origem: Mateus)**
- **O que acontece:** Luciano recebe a lista de oportunidades de Auto com contexto de cada lead (o que a Conves já sabe, qual o objetivo com aquele lead, qual a prioridade)
- **Objetivo:** Entrar no primeiro contato com contexto — não ligar sem saber nada sobre quem está ligando
- **Resultado esperado:** Luciano sabe, para cada lead, o que já existe de relacionamento com a Conves e o que buscar na conversa

**ETAPA 2 — Primeiro contato (SDR)**
- **O que acontece:** Luciano faz o contato inicial via WhatsApp, ligação ou e-mail — conforme perfil do lead. Apresenta-se, contextualiza a razão do contato e abre espaço para conversa
- **Objetivo:** Criar abertura — não vender, não cotar ainda. O objetivo é que o lead aceite continuar a conversa
- **Resultado esperado:** Lead responde e demonstra algum nível de interesse, ou é classificado como não momento (e registrado para futura reabordagem)

**ETAPA 3 — Qualificação**
- **O que acontece:** Luciano identifica: o lead tem veículo? Já tem seguro? Com quem? Quando vence? Está satisfeito? Qual o perfil de uso do veículo?
- **Objetivo:** Descobrir se há oportunidade real — e já coletar as informações necessárias para cotar no momento certo
- **Resultado esperado:** Lead classificado (quente / morno / frio) e informações básicas registradas no CRM

**ETAPA 4 — Diagnóstico**
- **O que acontece:** Com o lead qualificado, Luciano aprofunda: tipo e modelo do veículo, principal condutor, CEP de pernoite, histórico de sinistros, coberturas desejadas (compreensivo, terceiros, assistência), valor de referência
- **Objetivo:** Cotar com precisão — uma cotação genérica não convence; uma cotação feita para o perfil específico do cliente tem muito mais chance de fechar
- **Resultado esperado:** Ficha de diagnóstico completa para montar a cotação

**ETAPA 5 — Cotação**
- **O que acontece:** Luciano acessa as seguradoras e cota com base no perfil levantado. Seleciona as melhores opções para apresentar (geralmente 2 ou 3 — não um catálogo inteiro)
- **Objetivo:** Entregar ao cliente escolhas claras e relevantes, não volume de opções que paralisa a decisão
- **Resultado esperado:** 2 a 3 propostas prontas com comparativo claro

**ETAPA 6 — Apresentação da proposta**
- **O que acontece:** Luciano apresenta as opções ao cliente explicando o que cada uma cobre, o que diferencia uma da outra e qual se encaixa melhor no perfil e no orçamento
- **Objetivo:** O cliente deve entender o que está comprando — cliente que não entende não fecha, ou fecha e cancela
- **Resultado esperado:** Cliente com proposta em mãos e data definida para resposta

**ETAPA 7 — Follow-up e fechamento**
- **O que acontece:** Luciano acompanha a proposta até a decisão. Se o cliente não respondeu no prazo combinado, retoma o contato com contexto (não apenas "e aí, decidiu?")
- **Objetivo:** Chegar ao fechamento ou ao "não" definitivo — proposta aberta sem acompanhamento é receita perdida
- **Resultado esperado:** Venda fechada ou motivo de perda registrado no CRM

**ETAPA 8 — Pós-venda imediato**
- **O que acontece:** Após a emissão, Luciano registra o cliente no CRM com: veículo, cobertura, seguradora, data de vencimento. Envia mensagem de boas-vindas e agenda contato de 30 dias
- **Objetivo:** Iniciar o relacionamento de longo prazo — o cliente deve sentir que a Conves não sumiu depois de vender
- **Resultado esperado:** Cliente com contato agendado para 30 dias, dados completos no CRM para acionar renovação no momento certo

```
LISTA → CONTATO → QUALIFICAÇÃO → DIAGNÓSTICO → COTAÇÃO → PROPOSTA → FECHAMENTO → PÓS-VENDA
```

---

### PC-03 — AUTO: RENOVAÇÃO

**Responsável:** Luciano Junior
**Objetivo geral:** Renovar apólices de auto com a melhor margem possível — o objetivo nunca é manter o cliente a qualquer custo, mas fechar nas melhores condições para a Conves e para o cliente.

---

**ETAPA 1 — Identificação da fila de renovação**
- **O que acontece:** O Conves Hub (módulo AutoRenovações) lista automaticamente as apólices com vencimento nos próximos 90, 60 e 30 dias. Luciano acessa essa fila e prioriza por janela de vencimento
- **Objetivo:** Garantir que nenhuma apólice vença sem contato prévio — renovação reativa (cliente liga porque venceu) é sinal de processo falho
- **Resultado esperado:** Fila de renovação mapeada e priorizada por urgência

**ETAPA 2 — Nova cotação (antes de contatar o cliente)**
- **O que acontece:** Luciano recota a apólice nas seguradoras antes de ligar para o cliente — com e sem a seguradora atual
- **Objetivo:** Chegar ao cliente com informação, não com pergunta. "Já fizemos uma nova cotação para você" é muito mais forte do que "está pensando em renovar?"
- **Resultado esperado:** Comparativo pronto entre manter seguradora atual e migrar

**ETAPA 3 — Contato de renovação**
- **O que acontece:** Luciano contata o cliente com antecedência mínima de 45 dias. Apresenta que a apólice está vencendo e que já tem as opções de renovação prontas
- **Objetivo:** Ser proativo — o cliente não deve precisar lembrar que o seguro vence. Quando a Conves liga primeiro, demonstra que acompanha
- **Resultado esperado:** Cliente informado e disposto a discutir as opções

**ETAPA 4 — Apresentação das opções**
- **O que acontece:** Luciano apresenta o comparativo: manter seguradora atual (com novo valor) ou migrar para outra com melhor custo-benefício. Explica as diferenças de cobertura se houver
- **Objetivo:** Guiar a decisão com dados — não deixar o cliente tomar decisão no escuro ou só pelo preço
- **Resultado esperado:** Cliente com clareza das opções e critério para decidir

**ETAPA 5 — Decisão e fechamento**

> **Diretriz estratégica da Conves:** O critério de escolha da seguradora é a melhor condição para a Conves (comissão + cobertura adequada ao cliente). Não se reduz margem para "não perder o cliente". Se o cliente quer preço abaixo do que faz sentido para a Conves, o registro de perda é feito com motivo — e o cliente fica na base para recontato futuro.

- **O que acontece:** Cliente decide. Se aceita, Luciano encaminha para emissão. Se recusa, registra o motivo no CRM
- **Objetivo:** Fechar com margem ou registrar a perda com informação — perda sem registro não serve para nada
- **Resultado esperado:** Renovação emitida ou lead marcado com motivo de perda e data de recontato

**ETAPA 6 — Registro e próxima renovação**
- **O que acontece:** Após renovação confirmada, Luciano atualiza o CRM com nova vigência e agenda o próximo ciclo de renovação (em ~10 meses)
- **Objetivo:** O ciclo de renovação nunca para — cada renovação feita já aciona o próximo ciclo
- **Resultado esperado:** Cliente com nova vigência registrada e próxima renovação já no radar do sistema

```
FILA DE VENCIMENTO → RECOTAÇÃO → CONTATO PROATIVO → APRESENTAÇÃO → DECISÃO → REGISTRO → PRÓXIMO CICLO
```

---

### PC-04 — SAÚDE PJ

**Responsável:** Luciano Junior
**Objetivo geral:** Vender planos de saúde para empresas com abordagem consultiva — entendendo o momento e a necessidade real antes de apresentar qualquer produto.

---

**ETAPA 1 — Recebimento da lista**
- **O que acontece:** Luciano recebe de Mateus a lista de empresas com potencial de Saúde: clientes PJ da carteira sem plano, indicações, empresas identificadas pela Inteligência Comercial
- **Objetivo:** Entrar no contato sabendo que a empresa tem perfil — não abordar aleatoriamente
- **Resultado esperado:** Lista com contexto de cada empresa (porte estimado, histórico com a Conves, perfil do contato)

**ETAPA 2 — Primeiro contato e identificação do decisor**
- **O que acontece:** Luciano faz o primeiro contato — por indicação quando houver, por abordagem direta quando não. Objetivo é identificar quem decide (sócio, RH, financeiro) e criar abertura para uma conversa
- **Objetivo:** Chegar na pessoa certa — em PJ, abordar o assistente administrativo e nunca chegar no decisor é perda de tempo
- **Resultado esperado:** Contato estabelecido com o decisor ou agendamento de conversa com ele

**ETAPA 3 — Qualificação**
- **O que acontece:** Luciano qualifica: a empresa já tem plano? Quantas vidas? Qual operadora? Qual o nível de satisfação? Existe budget para benefícios? Qual o tamanho da empresa?
- **Objetivo:** Saber se há oportunidade real e qual o tamanho dela antes de investir tempo em diagnóstico e cotação
- **Resultado esperado:** Lead classificado (quente / morno / frio) com informações básicas no CRM

**ETAPA 4 — Reunião de diagnóstico**
- **O que acontece:** Reunião com o decisor para entender em profundidade: número exato de vidas, faixa etária dos colaboradores, cobertura desejada, rede hospitalar prioritária, orçamento disponível por vida, prazo para decisão
- **Objetivo:** Fazer a cotação certa — cotação feita sem diagnóstico adequado é proposta genérica que perde para qualquer concorrente que dedicar mais tempo
- **Resultado esperado:** Ficha de diagnóstico completa para montar proposta personalizada

**ETAPA 5 — Cotação e montagem da proposta**
- **O que acontece:** Luciano cota nas operadoras relevantes para o perfil levantado. Seleciona as melhores opções (2 ou 3) e monta proposta comparativa com rede, cobertura, valor por vida e diferenciais
- **Objetivo:** Proposta que responde diretamente ao que o cliente disse na reunião de diagnóstico — não um catálogo genérico
- **Resultado esperado:** Proposta personalizada pronta para apresentar

**ETAPA 6 — Apresentação da proposta**
- **O que acontece:** Luciano apresenta as opções em reunião (presencial ou vídeo). Cada opção é explicada em relação ao que o cliente disse que precisava
- **Objetivo:** O decisor deve ver que a proposta foi feita para o perfil dele — isso diferencia da concorrência que só manda PDF
- **Resultado esperado:** Decisor com proposta compreendida e data de retorno definida

**ETAPA 7 — Follow-up e fechamento**
- **O que acontece:** Luciano acompanha até a decisão. Em PJ, o processo de decisão é mais longo — pode envolver aprovação de sócios ou reunião de diretoria. Luciano mantém contato ativo sem pressão, tirando dúvidas e facilitando o processo interno
- **Objetivo:** Chegar ao fechamento — ou ao não definitivo com motivo registrado
- **Resultado esperado:** Contrato assinado ou motivo de perda documentado no CRM

**ETAPA 8 — Onboarding do plano e pós-venda**
- **O que acontece:** Após contrato, Luciano acompanha o cadastro dos beneficiários, a emissão das carteirinhas e o início do plano. Agenda check-in trimestral com o responsável da empresa
- **Objetivo:** Garantir que o início do plano seja sem atrito — empresa que tem problema na implantação cancela no primeiro ano
- **Resultado esperado:** Empresa com plano ativo, beneficiários cadastrados e check-in trimestral agendado no CRM

```
LISTA → CONTATO + DECISOR → QUALIFICAÇÃO → DIAGNÓSTICO → COTAÇÃO → PROPOSTA → FECHAMENTO → ONBOARDING → CHECK-IN
```

---

### PC-05 — CONSÓRCIO

**Responsável:** Eduardo Costa
**Objetivo geral:** Vender consórcio como instrumento de planejamento patrimonial — entendendo o objetivo de vida do cliente antes de falar de qualquer produto.

---

**ETAPA 1 — Recebimento da lista**
- **O que acontece:** Eduardo recebe de Mateus a lista de oportunidades de Consórcio: clientes da carteira com perfil de planejamento (empresários, clientes de fiança que querem comprar imóvel, clientes de auto que pensam em trocar de carro), cotações antigas de consórcio
- **Objetivo:** Chegar no contato sabendo o que o cliente já tem e o que pode estar planejando
- **Resultado esperado:** Lista com contexto — origem do lead, histórico com a Conves, produto-alvo (imóvel, veículo, empresa)

**ETAPA 2 — Primeiro contato**
- **O que acontece:** Eduardo faz o primeiro contato com base no contexto. A abertura nunca começa por "você tem interesse em consórcio?" — começa por entender o momento do cliente
- **Objetivo:** Criar abertura para uma conversa sobre os planos do cliente — não para vender um produto
- **Resultado esperado:** Cliente receptivo a continuar a conversa ou status definido (não momento, sem interesse)

**ETAPA 3 — Qualificação**
- **O que acontece:** Eduardo identifica: o cliente está planejando alguma compra? Tem objetivo patrimonial nos próximos 2-5 anos? Tem capacidade de parcela mensal? Já conhece ou já teve consórcio?
- **Objetivo:** Identificar se há objetivo concreto que o consórcio atende — consórcio sem objetivo do cliente é produto sem fundação
- **Resultado esperado:** Lead qualificado com objetivo identificado e capacidade financeira estimada

**ETAPA 4 — Reunião consultiva**
- **O que acontece:** Eduardo realiza reunião (sempre recomendada para Consórcio) para entender em profundidade: qual o objetivo, qual o prazo desejado, qual o valor da carta ideal, qual a parcela que cabe no orçamento, se já pesquisou outras opções
- **Objetivo:** Fazer uma recomendação personalizada — consórcio tem muitas variáveis (prazo, valor, lance) e o cliente que não entende cancela
- **Resultado esperado:** Eduardo sabe exatamente qual carta recomendar, em qual administradora e com qual estratégia de lance

**ETAPA 5 — Apresentação da proposta**
- **O que acontece:** Eduardo apresenta a proposta com foco no **objetivo do cliente**, não na parcela. Mostra o caminho: carta de X reais, prazo de Y meses, parcela de Z — e como isso conecta com o que o cliente quer alcançar
- **Objetivo:** O cliente deve comprar o objetivo realizado, não a parcela mensal
- **Resultado esperado:** Cliente com proposta compreendida e comprometida com data de decisão

**ETAPA 6 — Fechamento e formalização**
- **O que acontece:** Eduardo conduz a assinatura do contrato e os trâmites de formalização com a administradora
- **Objetivo:** Garantir que o contrato seja assinado sem fricção burocrática — etapa administrativa travada gera desistência
- **Resultado esperado:** Contrato assinado e registrado no CRM com dados completos (valor da carta, prazo, parcela, administradora)

**ETAPA 7 — Acompanhamento durante o contrato**
- **O que acontece:** Eduardo mantém contato regular com o cliente ao longo do contrato — atualiza sobre a posição no grupo, avisa sobre oportunidades de lance, registra feedbacks
- **Objetivo:** Cliente acompanhado não cancela e indica — cliente abandonado cancela e fala mal
- **Resultado esperado:** Cliente ativo no contrato, satisfeito e com potencial de indicação ativado

**ETAPA 8 — Registro de contemplação e indicação**
- **O que acontece:** Quando o cliente é contemplado, Eduardo registra no CRM como caso de portfólio e entra em contato para colher o feedback e pedir indicação
- **Objetivo:** Contemplação é o momento de maior satisfação do cliente — é o melhor momento para pedir indicação
- **Resultado esperado:** Caso documentado no portfólio da Conves e pelo menos 1 indicação solicitada

```
LISTA → CONTATO → QUALIFICAÇÃO → REUNIÃO CONSULTIVA → PROPOSTA → FECHAMENTO → ACOMPANHAMENTO → CONTEMPLAÇÃO + INDICAÇÃO
```

---

### PC-06 — FINANCIAMENTO

**Responsável:** Eduardo Costa
**Objetivo geral:** Vender financiamentos de imóvel e veículo para clientes que já têm relacionamento com a Conves — aproveitando a confiança existente para facilitar uma decisão de alto valor.

---

**ETAPA 1 — Identificação da oportunidade**
- **O que acontece:** A oportunidade de financiamento geralmente surge de dois caminhos: (a) Mateus identifica na carteira clientes com perfil de compra de imóvel ou veículo e inclui na lista de Eduardo; (b) o próprio cliente menciona para outro setor da Conves que está pensando em comprar
- **Objetivo:** Capturar a oportunidade no momento em que o cliente está com o assunto em mente — não esperar o cliente ir a um banco sozinho
- **Resultado esperado:** Lead identificado e registrado no CRM com contexto da oportunidade

**ETAPA 2 — Contato e confirmação do interesse**
- **O que acontece:** Eduardo entra em contato, contextualiza que a Conves também trabalha com financiamento e abre a conversa sobre o que o cliente está planejando
- **Objetivo:** Confirmar que há intenção real de compra e que o cliente está aberto a conversar sobre financiamento com a Conves
- **Resultado esperado:** Cliente aberto a continuar ou status definido

**ETAPA 3 — Qualificação financeira**
- **O que acontece:** Eduardo qualifica: o cliente tem entrada? Qual valor de imóvel ou veículo está buscando? Qual a renda familiar ou empresarial? Tem restrição de crédito? Qual o prazo desejado?
- **Objetivo:** Identificar se o cliente tem perfil de crédito aprovável antes de investir tempo em simulações — financiamento não aprovado depois de muito processo gera frustração
- **Resultado esperado:** Perfil financeiro básico mapeado para decidir se avança para simulação

**ETAPA 4 — Simulação**
- **O que acontece:** Eduardo faz a simulação nas instituições disponíveis (banco, cooperativa, construtora para imóvel; banco e financeira para veículo) e apresenta as opções de prazo, taxa e parcela
- **Objetivo:** Dar ao cliente uma visão clara do que é possível no mercado — muitos clientes não sabem o que podem financiar
- **Resultado esperado:** Simulação pronta com 2 ou 3 opções para o cliente comparar

**ETAPA 5 — Reunião de decisão**
- **O que acontece:** Eduardo apresenta a simulação e as condições, alinha expectativas sobre documentação necessária e processo de aprovação
- **Objetivo:** Cliente comprometido com o processo — financiamento exige documentação e tempo; cliente sem clareza desiste no meio
- **Resultado esperado:** Cliente decidido a avançar e ciente do que será necessário

**ETAPA 6 — Processo de aprovação**
- **O que acontece:** Eduardo acompanha o cliente em toda a documentação necessária, envio para análise de crédito e retorno da instituição financeira
- **Objetivo:** Ser o guia do processo — cliente que vai sozinho para o banco se perde na burocracia e desiste ou vai para outra corretora
- **Resultado esperado:** Documentação enviada e processo de análise aberto

**ETAPA 7 — Aprovação e assinatura**
- **O que acontece:** Aprovado o crédito, Eduardo conduz o cliente até a assinatura e formalização do contrato
- **Objetivo:** Garantir que o processo chegue ao fim — nenhuma aprovação deve ser perdida por problema na etapa final
- **Resultado esperado:** Contrato assinado e registrado no CRM

**ETAPA 8 — Cruzamento pós-venda**
- **O que acontece:** Após fechamento, Eduardo passa o lead para Luciano: cliente que financiou veículo → oportunidade de Auto; cliente que financiou imóvel → oportunidade de Seguro Residencial (futuro). Esse cruzamento é registrado no CRM
- **Objetivo:** Aproveitar o momento de compra para ativar o próximo produto — cliente que acabou de comprar um carro está com o assunto em mente e aberto a falar de seguro
- **Resultado esperado:** Lead cruzado com Luciano e oportunidade aberta no CRM

```
IDENTIFICAÇÃO → CONTATO → QUALIFICAÇÃO → SIMULAÇÃO → REUNIÃO → DOCUMENTAÇÃO → APROVAÇÃO → CRUZAMENTO PÓS-VENDA
```

---

### PC-07 — ONBOARDING DE IMOBILIÁRIA

**Responsável:** Mateus Ugarte
**Objetivo geral:** Integrar novas imobiliárias parceiras de forma estruturada, garantindo que comecem a enviar fichas com qualidade e que entendam o potencial de parceria além do fiança.

---

**ETAPA 1 — Identificação e abordagem da imobiliária**
- **O que acontece:** Mateus identifica a nova imobiliária (por indicação, prospecção ativa ou contato espontâneo). Faz o primeiro contato para apresentar a Conves e propor uma reunião
- **Objetivo:** Despertar interesse na parceria — a imobiliária precisa ver valor em trabalhar com a Conves e não com qualquer outra corretora
- **Resultado esperado:** Reunião de apresentação agendada

**ETAPA 2 — Reunião de apresentação**
- **O que acontece:** Mateus apresenta a Conves: produtos disponíveis, processo de envio de fichas, prazo de retorno, diferenciais de atendimento e cases de imobiliárias parceiras
- **Objetivo:** Deixar claro o que a parceria oferece — imobiliária que não entende o processo manda ficha errada e fica insatisfeita
- **Resultado esperado:** Imobiliária comprometida com a parceria e com entendimento básico do processo

**ETAPA 3 — Cadastro no sistema**
- **O que acontece:** Mateus cadastra a imobiliária no Conves Hub com todos os dados (nome, contatos, responsável comercial, código por seguradora)
- **Objetivo:** Imobiliária registrada = imobiliária rastreável — todo lead gerado por ela fica vinculado ao parceiro
- **Resultado esperado:** Imobiliária ativa no sistema, pronta para receber e enviar fichas

**ETAPA 4 — Treinamento do processo**
- **O que acontece:** Mateus orienta o responsável da imobiliária sobre como enviar fichas (Google Forms), o que preencher, o que acelera o processo e o que causa atraso
- **Objetivo:** Ficha bem preenchida = cotação mais rápida = imobiliária mais satisfeita = mais fichas
- **Resultado esperado:** Responsável da imobiliária treinado e com contato direto de suporte

**ETAPA 5 — Primeira ficha acompanhada**
- **O que acontece:** A primeira ficha enviada pela imobiliária é acompanhada de perto por Mateus — ele garante que o retorno chegue rápido e com qualidade
- **Objetivo:** A primeira impressão define o relacionamento. Primeira ficha bem atendida cria fidelidade; primeira ficha mal atendida cria desconfiança
- **Resultado esperado:** Imobiliária com experiência positiva na primeira interação

**ETAPA 6 — Follow-up de 30 dias**
- **O que acontece:** Mateus entra em contato 30 dias após o onboarding para checar: como está sendo a experiência, quantas fichas enviaram, se tiveram alguma dificuldade
- **Objetivo:** Identificar problemas antes que virem motivo de abandono — imobiliária que para de mandar ficha raramente diz o motivo
- **Resultado esperado:** Ajustes feitos se necessário e imobiliária engajada

**ETAPA 7 — Ativação comercial**
- **O que acontece:** Mateus apresenta a oportunidade de parceria além do fiança: como a imobiliária pode indicar Auto para inquilinos, Saúde para proprietários com empresa. Cria um plano simples de como isso pode funcionar
- **Objetivo:** Transformar a imobiliária de "canal de fiança" para "canal de múltiplos produtos" — o potencial é muito maior que o produto principal
- **Resultado esperado:** Imobiliária informada sobre os outros produtos e aberta a indicar quando surgir oportunidade

```
IDENTIFICAÇÃO → REUNIÃO → CADASTRO → TREINAMENTO → PRIMEIRA FICHA → FOLLOW-UP 30 DIAS → ATIVAÇÃO COMERCIAL
```

---

### COMO OS PROCESSOS SE CONECTAM

```
MATEUS monta listas e define produto foco
         ↓
LUCIANO trabalha Auto Novo → cliente vira portfólio
LUCIANO trabalha Renovação → receita recorrente protegida
LUCIANO trabalha Saúde PJ → nova receita mensal por empresa
         ↓
EDUARDO trabalha Consórcio → venda de longo prazo + indicação na contemplação
EDUARDO trabalha Financiamento → cruzamento automático com Auto (Luciano)
         ↓
MATEUS trabalha Imobiliárias → mais fichas de fiança + novas oportunidades de Auto e Saúde
         ↓
Dados de todos os processos voltam ao CRM
MATEUS lê, ajusta, monta nova lista → ciclo reinicia melhor
```

---

## CAPÍTULO 4 — ROADMAP DE DESENVOLVIMENTO

### 4.1 Fase atual (Q2-Q3 2026)

| Item | Status | Responsável |
|------|--------|------------|
| Módulo Fichas (Fiança) | ✅ Pronto | Claude + Codex |
| Módulo Comercial (CRM) | ✅ Pronto | Claude + Codex |
| Módulo Auto | ✅ Pronto | Claude + Codex |
| Módulo Financeiro | ✅ Pronto | Claude + Codex |
| Redesign visual v12 | ✅ Pronto | Codex |
| Módulo Campanhas | ⏳ Em desenvolvimento | Claude + Codex |
| ApolicesDashboard completo | ⏳ Em desenvolvimento | Claude + Codex |

### 4.2 Próximas fases (Q3-Q4 2026)

| Fase | Entrega | Impacto |
|------|---------|---------|
| Fase 5 | Forecasting de pipeline | Previsão de receita por produto |
| Fase 6 | Outreach automatizado | Escalar aquisição comercial |
| Fase 7 | WhatsApp Business | Automação de follow-up via mensagem |
| Paralelo | Cérebro Conves | Base de conhecimento permanente |

### 4.3 Visão de 12 meses

Em 12 meses, o Conves Hub deve:
- Ter 100% da equipe operando nele (zero planilhas paralelas)
- Gerar relatórios automáticos para a diretoria semanalmente
- Ter jornadas de automação ativas para todos os produtos
- Integrar WhatsApp para disparos e respostas
- Ter histórico completo de todos os clientes acessível em segundos

---

## CAPÍTULO 5 — MÉTRICAS E INDICADORES

### 5.1 KPIs Operacionais (Fiança)

| Métrica | Objetivo |
|---------|----------|
| Fichas recebidas/mês | ~500 |
| Apólices emitidas/mês | ~200-250 |
| Taxa de conversão ficha→apólice | >40% |
| Tempo médio de cotação | < 48h |
| Taxa de fichas sem assumir > 24h | < 5% |

### 5.2 KPIs Comerciais — Geral

| Métrica | Objetivo |
|---------|----------|
| Oportunidades geradas/mês | A definir |
| Oportunidades trabalhadas/mês | A definir |
| Contatos efetivos/mês | A definir |
| Reuniões qualificadas/mês | A definir |
| Propostas enviadas/mês | A definir |
| Vendas fechadas/mês | A definir |
| Prêmio total vendido/mês | A definir |
| Comissão gerada/mês | A definir |
| Taxa de conversão por produto | A definir |
| Produtos por cliente (média) | A definir |
| Receita por campanha | A definir |

### 5.3 KPIs por Setor Comercial

**Planejamento e Growth:**
- Campanhas ativas no mês
- Oportunidades geradas por campanha
- Taxa de conversão da campanha

**Inteligência Comercial:**
- Listas criadas/mês
- Oportunidades aproveitadas / geradas
- Taxa de conversão por segmento

**Pré-Vendas / SDR:**
- Taxa de contato
- Taxa de qualificação
- Reuniões agendadas/mês

**Consultoria Comercial:**
- Taxa de conversão reunião → proposta
- Taxa de conversão proposta → venda
- Ticket médio por produto

**Customer Success:**
- Média de produtos por cliente
- Cross-sells/mês
- Indicações recebidas/mês

**Relações Imobiliárias:**
- Imobiliárias ativas (contato no mês)
- Novas imobiliárias/mês
- Leads originados por imobiliária

### 5.4 KPIs Financeiros

| Métrica | Objetivo |
|---------|----------|
| Comissão total/mês | A definir |
| Produção (prêmio total)/mês | A definir |
| Receita por produto (%) | A definir |
| Receita por imobiliária | A definir |

> **Nota para a diretoria:** Os valores "A definir" precisam ser preenchidos pela gestão com as metas reais da empresa. Os sistemas já coletam esses dados — falta definir as metas para ativar o monitoramento de performance.

---

## CAPÍTULO 6 — ESTRUTURA DE USUÁRIOS E PERMISSÕES

### 6.1 Perfis de acesso

| Perfil | Acesso | Usuários |
|--------|--------|---------|
| **Gestor** | Acesso total + configurações | Luciano, Mateus |
| **Orçamentista** | Fichas, Minha Carteira, Relatório | Davi, Dayana, Eduardo, Laís, Marcos, Patrícia Dantas |
| **Comercial** | CRM completo + Dashboard | Eduardo, Marcos, Luciano, Patrícia Dantas, Patrícia Barbara |
| **Sinistros** | Módulo sinistros auto + histórico | Patrícia Barbara |

### 6.2 Política de dados

- Dados pessoais (CPF, CNPJ, celular) são mascarados na interface
- Nenhuma credencial de banco é exposta no frontend
- Toda autenticação via Supabase Auth (tokens por sessão)
- Logs de ação registrados por usuário

---

---

# PARTE III — ESPAÇO DE TRABALHO DOS AGENTES

> Esta seção é o canal de comunicação entre Claude Code, Codex e o usuário.
> Cada entrada deve ter: data, autor, assunto e conteúdo.

---

## REGISTRO DE CONVERSAS E DECISÕES

---

### [2026-06-22] Claude Code — Criação do documento base

**Assunto:** Estruturação inicial do documento de reformulação

**Conteúdo:**
Criado o documento CONVES_CONTEXTO_AGENTES.md com a estrutura completa da reformulação. O documento está dividido em três partes:
- **Parte I:** Contexto técnico do projeto (base para os agentes)
- **Parte II:** Reformulação estratégica (apresentação para a diretoria)
- **Parte III:** Espaço de trabalho dos agentes (este espaço)

**Atualizações feitas:**
- `docs/PROJECT_CONTEXT.md` — adicionado módulo Auto e Financeiro
- `ROADMAP.md` — atualizado com estado real (Auto pronto, Financeiro pronto, fases corretas)
- `docs/CURRENT_TASK.md` — atualizado com tarefa atual

---

### [2026-06-22] Claude Code — Integração da Reestruturação Comercial

**Assunto:** Capítulo 3-A adicionado ao documento

**Conteúdo:**
Lido e integrado o documento `Reestruturacao_Comercial_CONVES.docx`. Todo o conteúdo foi incorporado ao Capítulo 3-A do documento de reformulação, incluindo:

- Os **6 setores comerciais** com responsabilidades, entregáveis e métricas de cada um
- O **modelo de distribuição para 3 pessoas** (Gestor + Executivo Saúde + Executivo Consórcio/Parceiros)
- O **fluxo comercial padrão** (Planejamento → Inteligência → SDR → Consultoria → CS/Relações Imobiliárias)
- A **abordagem por produto** (Saúde e Consórcio com suas especificidades)
- A **rotina recomendada** (diária, semanal, mensal, trimestral)
- As **fases de evolução** da estrutura comercial (Fase 1 atual → Fase 4 corporativa)
- Atualização do Capítulo 5 com KPIs por setor comercial

**Perguntas abertas para o usuário:**
1. Quem são as 3 pessoas do comercial? (Pessoa 1 = Gestor, Pessoa 2 = Saúde, Pessoa 3 = Consórcio) — precisamos nomear
2. Os KPIs numéricos (metas) precisam ser definidos pela diretoria
3. Existe algum SOP específico do processo de cotação de Saúde que precisa ser documentado?
4. A abordagem de Consórcio tem algum diferencial específico da Conves além do que está no documento?

**Próximas contribuições esperadas:**
- Usuário: validar a distribuição dos 3 cargos e nomear as pessoas
- Codex: após conexão com Obsidian, estruturar o Cérebro Conves com este documento como base
- Usuário: definir metas numéricas para os KPIs comerciais

---

### [2026-06-22] Usuário — Definição dos 3 cargos comerciais

**Assunto:** Nomeação e descrição detalhada de cada executivo

**Conteúdo registrado:**
- **Mateus Ugarte** → Gestor Comercial (Planejamento + Inteligência + Relações Imobiliárias)
- **Luciano Junior** → Executivo Comercial (Auto novos + Renovações Auto com foco em lucro máximo + Saúde PJ)
- **Eduardo Costa** → Executivo Comercial (Consórcio + Financiamento imóvel/veículo, foco em clientes qualificados da carteira)

**Decisão estratégica registrada:**
Renovações de Auto — o objetivo não é manter o cliente a qualquer custo. O objetivo é fechar com o máximo de lucro possível. Nunca entrar em leilão de preço.

---

### [2026-06-22] Usuário — Objetivos executivos da reformulação

**Assunto:** Consolidação dos objetivos principais da reestruturação da Conves

**Conteúdo registrado:**
- Objetivo central: transformar a Conves em uma máquina de vendas com relacionamento superior, operando como empresa grande, com previsibilidade e escala
- Prioridade comercial: criar o setor comercial inteiro com processos, cadência, pipeline e metas próprias
- Prioridade operacional: estruturar processos para suportar crescimento, novos funcionários e maior eficiência da equipe
- Prioridade de receita: extrair mais lucro da base atual e consolidar produtos rentáveis sem previsibilidade atual
- Produtos estratégicos: consórcio, financiamento e plano de saúde
- Diferencial preservado: acompanhamento do cliente do início ao pós-venda, sem abandonar por valor
- Horizonte de validação: nova estrutura funcionando em até 6 meses
- Meta metodológica: desenvolver depois um modelo próprio de criação de metas

---

### [2026-06-22] Claude Code — Processos comerciais mapeados (Capítulo 3-C)

**Assunto:** 7 processos comerciais mapeados do início ao fim

**Conteúdo:**
- Adicionado o ciclo de time (Mateus → Vendedores → CRM → Mateus) como fundamento de todos os processos
- Mapeado o que Mateus entrega na lista (campo a campo) e o que os vendedores devolvem
- Todos os 7 processos comerciais mapeados: PC-01 a PC-07
- Cada processo com: objetivo geral, etapas com O que acontece + Objetivo + Resultado esperado, diagrama de fluxo
- Seção final mostrando como os processos se conectam entre si

---

### [2026-06-22] Claude Code — Mapa de setores × faturamento

**Assunto:** Capítulo 3-B adicionado — responsabilidades e impacto de cada setor no resultado

**Conteúdo:**
Criado o Capítulo 3-B com todos os 9 setores da empresa mapeados em três dimensões: o que fazem, como cada um transforma faturamento e qual é seu objetivo. Inclui mapa consolidado (tabela setores × motor de receita × métrica-chave) e diagrama da lógica que conecta todos os setores.

Scripts, abordagens e táticas serão definidos pelo gestor comercial após aprovação do projeto — registrado no documento.

---

### [2026-06-22] Usuário — Rituais de gestão definidos

**Assunto:** Estrutura de reuniões do time comercial

**Decisões registradas:**
- **Daily toda segunda-feira** (30-45min): Mateus conduz. Balanço da semana anterior, prioridades da semana, follow-ups críticos, bloqueios e compromisso declarado de cada um.
- **Planejamento mensal** (1h30-2h): Mateus conduz. 6 blocos: análise do mês anterior, produto foco, metas por pessoa, campanha do mês, ritmo semanal e compromissos.
- Regra cultural registrada: "reunião sem pauta não acontece, sem decisão foi desperdício, sem registro no CRM não existiu."

**Adicionado ao documento:** Seção 3A.8 — Rituais de Gestão Comercial, com roteiro completo de condução para cada reunião.

---

### [AGUARDANDO] Codex — Contribuições pós-Obsidian

*Após integração com Obsidian, registrar aqui a estrutura do Cérebro Conves criada.*

---

## DECISÕES ABERTAS

| # | Decisão | Status | Responsável |
|---|---------|--------|-------------|
| 1 | Nomear as 3 pessoas nos cargos comerciais | ✅ Resolvido | — |
| 2 | Definir metas numéricas de KPIs comerciais e financeiros | Aguardando diretoria | Diretoria |
| 3 | Formato final para diretoria (documento MD / PDF / slides) | Aguardando usuário | Mateus |
| 4 | SOPs adicionais: cotação Saúde, cotação Auto, renovação | Aguardando usuário | Mateus |
| 5 | Estrutura do Cérebro Conves no Obsidian | Em andamento | Codex |
| 6 | Integração CRM ↔ setores comerciais no Conves Hub | A planejar | Claude Code |

---

## GLOSSÁRIO CONVES

| Termo | Definição |
|-------|-----------|
| Ficha | Solicitação de cotação de seguro fiança, vinda de imobiliária via Google Forms |
| Apólice | Contrato de seguro emitido após aprovação da ficha |
| Orçamentista | Colaborador que assume e processa fichas de fiança |
| Imobiliária | Parceiro de canal que encaminha interessados (não é o cliente final) |
| Interessado | Pessoa que quer alugar o imóvel e precisa do seguro fiança |
| Cross-sell | Venda de produto adicional para cliente já existente na base |
| Pipeline | Funil visual de leads em diferentes etapas do processo de venda |
| Jornada | Fluxo automatizado de ações para nutrir e qualificar um lead |
| Score | Pontuação de qualidade/urgência de um lead no CRM |
| SOP | Standard Operating Procedure — protocolo padrão de operação |

---

*Documento vivo. Atualizar após cada decisão relevante, novo módulo ou mudança de rota.*
*Criado por Claude Code em 2026-06-22.*
