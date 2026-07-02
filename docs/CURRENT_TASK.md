# CURRENT TASK

## Frente ativa (Claude) — Auditoria global UI/UX + encoding

Auditoria/redesign premium modulo a modulo (plano em `~/.claude/plans/projeto-de-eventual-koala.md`).
Modulos concluidos: Dashboard, Fichas, Relatorio, Apolices, Imob/Seg, Auto, Comercial,
Financeiro, Config/Login, Shell.

**Pass de encoding (2026-06-30):** mojibake corrigido nos arquivos de exibicao
(`fichas.js` labels/mensagens/comentarios, `RelatorioMensal.jsx`, `ModalFicha.jsx`,
`DetalhesFicha.jsx`) via reversao byte-a-byte (Latin-1 + CP1252). NAO tocados de proposito:
`text.js` (normalizador de mojibake), `apoliceParser.js` (regex tolerante a mojibake do PDF)
e `financeiroProducaoCalc.test.mjs` (texto correto). Build verde.

**Pass de encoding #2 (2026-07-02, Claude):** varredura completa de `src/` e `scripts/`
por mojibake residual. Corrigido em `src/components/Layout.jsx`, `src/pages/auto/AutoEmissoes.jsx`,
`src/pages/ApoicesGestao.jsx`, `src/pages/MinhasFichas.jsx` e `src/lib/financeiroFaturasCalc.test.mjs`
(labels de UI, mensagens de toast, comentarios de secao `───`, separadores ` · `/` — `/` → `),
incluindo 3 ocorrencias de caractere de substituicao U+FFFD (perda de dado, nao reversivel -
corrigidas por inferencia de contexto em nomes de teste). Escopo combinado com o usuario: apenas
codigo de aplicacao, sem tocar documentacao (ConvesSystemBrain, docs/, .md da raiz). Mantidos
intocados de proposito (mesma razao do pass #1): `text.js`, `apoliceParser.js`,
`financeiroProducaoCalc.test.mjs`. `npm run build` e `npm test` (42/42) verdes apos a correcao.

**Relatorio por imobiliaria — kanban para blocos de lista (2026-07-01):** tela
`/relatorio/:imobiliariaId` (`src/pages/Relatorio.jsx`) trocou o kanban
drag-and-drop (`@dnd-kit`) pelos 5 blocos empilhados (Aprovadas, Emitidas,
Enviado Cobranca, Recuperados, Expiradas), com toggles de cobranca
enviada/imobiliaria retornou e fotos de orcamentista/emissor por linha.
Logica pura extraida para `src/lib/relatorioCobranca.js` (testada,
`npm test`). Spec e plano em `docs/superpowers/specs/2026-07-01-relatorio-blocos-lista-design.md`
e `docs/superpowers/plans/2026-07-01-relatorio-blocos-lista.md`. Merge feito
na main (commit `06f4fbd`), 37 testes passando, build verde. Smoke test
manual no navegador NAO foi feito (sem `.env`/credenciais Supabase no
ambiente) — recomenda-se conferir visualmente antes de considerar encerrado.

**Revisao de entrega do Codex — Kanban/Apolices/Relatorio/Fichas (2026-07-02, Claude):**
Codex entregou refactor que separa `retorno_enviado` (retorno ao cliente) de
`cobranca_started_at`/`imobiliaria_retornou` (rastreio de cobranca) — logica
correta, 44/44 testes verdes, build verde. Revisao encontrou e corrigiu:
(1) `KanbanFichas.jsx` — a edicao do Codex converteu 27 bytes de mojibake ja
existentes (recuperaveis via CP1252/Latin-1) em caracteres U+FFFD irreversiveis;
recuperado o texto correto via arqueologia de git + reversao byte-a-byte, sem
tocar na logica que o Codex mudou; (2) typos literais introduzidos pelo Codex:
"N?o" em `FichaDetalhePage.jsx` e "Inverter sele??o" em `Relatorio.jsx` (texto
visivel ao usuario), mais 6 descricoes de teste em `relatorioCobranca.test.mjs`;
(3) BOM (UTF-8 byte-order-mark) introduzido pelo editor do Codex em 6 arquivos
(`apolices.js`, `ApolicesLista.jsx`, `KanbanBoard.jsx`, `ModalFinalizar.jsx`,
`ApoicesGestao.jsx`, `Relatorio.jsx`) — removido; (4) badge "Retorno enviado" em
`FichaDetalhePage.jsx` usava cores emerald fora do padrao do modulo — trocado
para tokens `status-success`. Build e testes conferidos verdes apos as correcoes.

**Risco nao resolvido (aguardando decisao):** `scripts/reset_junho_enviado_cobranca.mjs`
(novo, nao rastreado) usa `SUPABASE_SERVICE_ROLE_KEY` direto de `.env.local` fora
do n8n — viola a regra "service_role somente no n8n" deste CLAUDE.md. Nao foi
alterado nem executado; aguardando aprovacao/plano do usuario.

---

## Responsavel Atual

Codex (entrega revisada por Claude — ver acima)

## Pagina

`src/pages/Financeiro/` - modulo financeiro (redesign)

## Objetivo

Reestruturacao do modulo financeiro do Seguro Fianca para controlar comissoes,
producao por imobiliaria/seguradora, faturas mensais, repasses e pagamento.

## Status

Refinamento v2 concluido. Dois bugs criticos corrigidos em 2026-06-29 (ver rodada 4).

### Rodada 4 (bugfix — 2026-06-29)
- Faturas: `fetchFaturasLedger` corrigido para chamar `fetchApolicesParaFatura` em vez de `fetchApolicesAtivas`. Agora filtra por `forma_pagamento IN ('fatura_sem_entrada','fatura_com_entrada')` e exclui boletos/à vista.
- Producao: removida dependencia de `catalogo` do efeito principal de fetch. `catalogo` tinha cache em memoria (resolve instantaneamente na segunda visita) e cancelava o fetch de dados antes dos numeros aparecerem. Separado em efeito proprio so para setar `pct` default do catalogo.
- 30 testes passando; build verde.

### Rodada 3 (refinamento v2 — 2026-06-26)
- Faturas: corrigido bug crítico — `fetchFaturasLedger` agora filtra por `forma_pagamento IN ('fatura_sem_entrada','fatura_com_entrada')` via nova função `fetchApolicesParaFatura`. Campo `forma_pagamento` adicionado ao SELECT e ao normalizeApoliceRow.
- Producao: lista de apolices emitidas no periodo adicionada inline abaixo de Evolucao (sem nova query, reutiliza `rows` ja carregados).
- ApolicesListView: novas colunas `Emissao` e `Comissao/mes`; props `showEmissao`, `showComissaoMensal`, `showVigencia`.
- Visao Geral: redesign completo — KpiCard com destaque visual, gráficos 280px, ranking com barra proporcional e seta de navegacao.
- Faturas: seletor de seguradora em pills que filtra KPIs, estimativa e lista de apolices; apólices elegíveis exibidas em tabela diretamente na pagina.
- FinanceiroFaturasLista: header modernizado.
- 29 testes passando; build verde.

### Rodada 2 (refino)
- Comissao Estimada (Producao) agora e do PROXIMO MES: soma da comissao mensal das apolices ativas que ainda billam no mes seguinte (inclui emitidas no mes atual). Helper `comissaoEstimadaProximoMes`.
- Estimativa de fatura = fatura atual + parcelas das novas emissoes do mes (nao recalcula do zero).
- "Ver Apolices Ativas" deixou de ser modal: pagina dedicada `/financeiro/producao/:imobiliaria/apolices?tipo=ativas|emitidas`, com clique -> detalhe da apolice preservando imobiliaria, periodo (na URL) e scroll (sessionStorage).
- Faturas por seguradora foram movidas para dentro da area da imobiliaria (cards expansiveis), com qtd ativas, fatura, estimativa e lista de apolices. Pagina/rota separada removida.
- Botao "Apolices ativas" em verde escuro; barras/medalhas nos rankings; logos das imobiliarias/seguradoras em todos os rankings.
- 29 testes passando; build verde.



- Base de calculo migrada para a FONTE REAL `apolices` (corrige bug que lia `status_apolice` do ledger `apolices_comissoes`). Calculo via `% comissao x premio liquido / parcelas`.
- Visao Geral: KPIs corrigidos (comissao gerada, recebida estimada, producao) + 2 graficos por seguradora.
- Producao: lista de imobiliarias com busca -> area detalhada com filtro de periodo (mes/intervalo), metricas, rankings por seguradora e botoes de apolices ativas/emitidas.
- Faturas: lista de imobiliarias -> fatura por imobiliaria (mes, valor, estimativa do proximo mes, apolices que contam, conferencia). Conferencia geral preservada em `/financeiro/faturas/conferencia`.
- Faturas por seguradora: `/financeiro/faturas/seguradora/:seguradora` com fatura por imobiliaria e metrica de apolices ativas.

Validacao local mais recente:

- `npm.cmd test` - 27 testes passando (17 + 10 novos de calculo/parcelas).
- `npm.cmd run build` - build verde.
- `npm.cmd run check:page-contexts` - revisar (pendencias pre-existentes fora de Financeiro: `src/pages/auto/*` e `src/pages/comercial/GestaoComercial.jsx`).

## Banco

Migracoes 42, 45, 46, 47 ja aplicadas no Supabase (confirmado pelo usuario). O calculo
nao depende mais do ledger `apolices_comissoes`; le direto de `apolices`.

## Smoke test pendente

Com usuario admin:

1. `/financeiro`: conferir Producao, Comissao Gerada e Recebida Estimada do mes != 0 e coerentes; ver os 2 graficos por seguradora.
2. `/financeiro/producao`: buscar imobiliaria, abrir detalhe, trocar periodo (mes e intervalo), conferir metricas e rankings; abrir "Apolices Ativas" e "Emitidas" e filtrar por seguradora; salvar percentual.
3. `/financeiro/faturas`: buscar imobiliaria, abrir fatura do mes, conferir valor, "Estimativa do mes que vem" e "Apolices que contam"; informar valor real e marcar pago/reabrir.
4. `/financeiro/faturas/seguradora/:seguradora`: conferir fatura por imobiliaria e a metrica de apolices ativas.
5. Validar com uma apolice real: `comissao total = pct x premio liquido` e `mensal = total / parcelas`.

## Risco a conferir no smoke test

- `pct_comissao` pode estar gravado como inteiro (5) ou fracao (0.05); `pctNormalizado` trata ambos, mas conferir numa amostra real.
- "Estimativa do mes que vem" segue a definicao literal (apolices emitidas no mes selecionado).
