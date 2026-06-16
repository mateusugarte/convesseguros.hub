# ROADMAP.md - Sistema de Gestao do Conves Hub

> Visao consolidada do projeto. Mantem o que esta pronto, o que esta planejado e o que ainda depende de execucao.

## Visao geral

- Plataforma interna para fichas, apolices, imobiliarias, seguradoras e area comercial.
- Entrada principal: Google Forms -> n8n -> Supabase.
- Frontend: React + Tailwind.
- Infra: Supabase + Vercel.

## Auditoria rapida

- O roadmap foi reorganizado por dominio.
- Itens sem status foram normalizados.
- Redundancias claras foram removidas.
- Paginas reais do projeto foram agrupadas por modulo.

## Modulos atuais

### Base

- Login [pronto]
- Dashboard [pronto]
- Configuracoes [pronto]

### Fichas

- Fichas [pronto]
- FichaDetalhePage [pronto]
- MinhasFichas [pronto]
- GestaoEmissoes [planejado]
- Relatorio [pronto]

### Imobiliarias e seguradoras

- Imobiliarias [pronto]
- ImobiliariaDetalhe [pronto]
- Seguradoras [pronto]

### Apolices

- ApolicesDashboard [pronto]
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

## Base tecnica

- Supabase como banco principal.
- RLS sempre ativa.
- `service_role` somente no n8n.
- Queries com campos explicitos e paginacao.
- Credenciais apenas em variaveis de ambiente.

## Entregas consolidadas

### Base estrutural

- Tabelas principais de `profiles` e `fichas`.
- Indices de apoio para consulta.
- Politicas de acesso no Supabase.
- Usuarios base configurados.

### Estrutura React

- Aplicacao em React + Tailwind.
- Paginas base e organizacao de componentes.
- Navegacao pronta para os modulos ativos.

### Dashboard e Fichas

- KPIs, graficos e visao operacional.
- Lista e detalhes de fichas.
- Fluxo de assumir e finalizar fichas.

### Testes

- Login validado.
- Assumir e finalizar ficha validado.
- Filtros principais validos.
- Responsividade basica validada.

## Pendencias conhecidas

- Gestao de emissoes.

## Evolucoes futuras

- Notificacoes WhatsApp.
- Relatorios PDF/Excel.
- Historico de alteracoes por ficha.
- Metricas por orcamentista.
- Integracao com emissao de apolices.
- App mobile.

## Ordem de execucao

1. Base Supabase e autenticacao
2. Estrutura React
3. Dashboard
4. Fichas
5. Testes
6. Evolucoes futuras
