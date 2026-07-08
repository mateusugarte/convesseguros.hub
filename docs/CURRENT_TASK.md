# CURRENT TASK

**Bugfix #2 — relatório (`/relatorio`) só buscava fichas `aprovado`/`emitido`
(2026-07-08, Claude):** após o bugfix #1 (abaixo) o usuário reportou que ainda
faltavam fichas e pediu garantia explícita: **todo status deve aparecer no
relatório, exceto `recusado`**. Causa raiz adicional (independente do bugfix
#1): a query de `/relatorio` (`src/pages/Relatorio.jsx`) usava
`REPORT_STATUSES = ['aprovado', 'emitido']` como *allowlist* — qualquer ficha
`pendente`, `em_cotacao`, `em_analise`, `cancelado`, `cpf_invalido` (ou
`expirada` já no cadastro) nunca era buscada no banco, ficasse ela expirada ou
não. Mesmo se buscada, `getFichaOperationalState`
(`src/lib/fichaOperational.js`) retornava `null` para `pendente`/`em_cotacao`/
`em_analise`/`emitido`-sem-apólice-ainda, e `COLUNAS` (blocos da tela) não
tinha bucket para `desistiu`/`cpf_invalido`/`recusada` — então mesmo uma ficha
buscada podia ser descartada silenciosamente por `isEligibleReportRow`
(`Boolean(getColuna(ficha))`) ou cair fora de `columnMap` na hora de renderizar.

Corrigido em duas frentes:
1. `fichaOperational.js`: `getFichaOperationalState` ganhou branches para
   `pendente`, `em_cotacao`, `em_analise`, `cpf_invalido` e para `emitido` sem
   apólice vinculada ainda — agora só retorna `null` se o `status` da ficha for
   um valor fora do domínio conhecido (nunca mais para os 8 status válidos que
   não são `recusado`). Testado (`getFichaOperationalState resolve um bucket
   não-nulo para todo status exceto recusado`, `fichaOperational.test.mjs`).
2. `Relatorio.jsx`: troca de `.in('status', REPORT_STATUSES)` por
   `.neq('status', EXCLUDED_REPORT_STATUS)` (`EXCLUDED_REPORT_STATUS =
   'recusado'`) nas duas queries de fichas; `COLUNAS` ganhou 5 blocos novos
   (`Pendentes`, `Em Cotação`, `Em Análise`, `Desistências`, `CPF Inválido`),
   totalizando 10 blocos na tela de detalhe por imobiliária. Nada nos outros
   componentes (`BlocoRelatorio`/`LinhaRelatorio`/toggles de cobrança) assume
   uma lista fechada de 5 colunas — todos os `coluna.id === 'x'` têm fallback
   seguro, então os novos blocos renderizam sem mudança adicional.

**Importante — o que essa garantia cobre e o que não cobre:** agora toda ficha
com `status != 'recusado'` que esteja dentro do intervalo de datas
(`created_at`) e (na tela de detalhe) cujo campo `imobiliaria` bata com um dos
aliases resolvidos da imobiliária SEMPRE aparece em algum dos 10 blocos. Isso
NÃO cobre: fichas cujo `imobiliaria` no banco não corresponda a nenhum alias
cadastrado da imobiliária (mismatch de nome/alias — não investigado nesta
rodada, diferente do bug de status); nem mudanças de RLS/permissão de leitura.

`node --test src/lib/fichaOperational.test.mjs` (14/14) e `npm test` completo
(64/64) verdes; `npm run build` verde. `package.json`/`Dashboard.jsx` que
apareciam corrompidos (BOM) durante o bugfix #1 foram resolvidos por edição
concorrente externa a este agente antes desta rodada — build e testes
completos puderam rodar normalmente desta vez.

**Smoke test pendente (recomendado antes de considerar encerrado):** abrir
`/relatorio/:id` de uma imobiliária com fichas em `pendente`/`em_cotacao`/
`em_analise`/`cancelado`/`cpf_invalido` no período e confirmar que aparecem
nos novos blocos; confirmar que uma ficha `recusado` continua não aparecendo
(comportamento esperado); se o ambiente testado for a URL de produção (não
`localhost`), confirmar que houve deploy do commit mais recente antes de
validar — mudança em código só reflete em produção depois do build/deploy.

---

**Bugfix #1 — fichas aprovadas somem do relatório de meses passados (2026-07-08,
Claude):** usuário reportou que 2 fichas (imobiliárias A e D, junho) apareciam
no "Relatório Mensal de Fichas" (dentro de Fichas) mas não em `/relatorio`.
Causa raiz: `isFichaExpiredOperational` (`src/lib/fichaOperational.js`) sempre
calculava a idade da ficha contra a data real de **hoje**, nunca contra o
período do relatório sendo visualizado. Resultado: uma ficha `aprovado` sem
seguradora definida (limiar padrão de 30 dias) aprovada em junho, vista em
julho (>30 dias reais depois), era reclassificada "ao vivo" para `expirada` e
sumia do bloco "Aprovadas"/contador "Fichas aprovadas" — mesmo revisando o
mesmo mês repetidas vezes. Confirmado meses depois via checagem manual do
usuário (ficha aparecia em "Expiradas", não em "Aprovadas").

Corrigido com `getReportEffectiveNow(rangeEndYmd, realNow)` (novo, exportado
em `fichaOperational.js`, testado em `fichaOperational.test.mjs`): para
períodos já encerrados (mês/ano passados), a idade é calculada até o fim
daquele período, não até hoje; para o período corrente ou histórico, segue
usando a data real normalmente. `src/pages/Relatorio.jsx` passa esse
`effectiveNow` para `getOperacionalStatus`/`getColuna` uma única vez (em
`rowsWithHelpers`, via novo campo `_oper` cacheado por linha — todas as outras
~15 chamadas a `getColuna`/`isApprovedFicha`/etc. no arquivo reusam esse valor
sem precisar de mudança). Escopo contido em `Relatorio.jsx`; nenhuma outra tela
que usa `fichaOperational.js` (Kanban de Fichas, detalhe de ficha) foi
alterada — essas continuam com o comportamento "ao vivo" correto.

`node --test src/lib/fichaOperational.test.mjs` (11/11) verde. `npm test`
completo e `npm run build` **não puderam ser validados**: no momento desta
correção, `package.json` e `src/pages/Dashboard.jsx` apareceram modificados
sem intervenção deste agente (provável edição concorrente do Codex, mesmo
padrão de BOM já documentado neste arquivo em passes anteriores), quebrando o
build (`Unexpected token '﻿'` no `package.json`) e o `npm test` (import
sem extensão em `imobiliariasMapeamento.js`, arquivo novo não rastreado) por
motivos não relacionados a esta mudança. Verificado isoladamente com
`esbuild` que `Relatorio.jsx` e `fichaOperational.js` têm sintaxe válida.
**Recomenda-se rodar `npm test`/`npm run build` novamente depois que o
trabalho concorrente for commitado/resolvido, e validar manualmente**: abrir
`/relatorio/:id` de uma imobiliária com ficha aprovada antiga em um mês
passado e confirmar que ela aparece em "Aprovadas" (não "Expiradas").

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

**Expiracao automatica de fichas aprovadas por seguradora (2026-07-06, Claude):**
regra de negocio alterada para fichas com `status = 'aprovado'` sem apolice
emitida: o prazo de expiracao deixa de ser fixo (45 dias desde `created_at`) e
passa a ser por seguradora — Porto 45 dias, demais (Tokio/Too/Pottencial/Junto/Nao
informado) 30 dias — contado de `finalizada_em` com fallback para `created_at`.
Calculo unificado em `getFichaExpirationThresholdDays`/`isFichaExpiredOperational`
(`src/lib/fichaOperational.js`); `normalizeSeguradoraBucket` centralizado nesse
arquivo e reaproveitado por `src/lib/fichas.js` (que deixou de redefinir a
propria versao, eliminando duplicacao). Cobertura de teste em
`src/lib/fichaOperational.test.mjs` (limiares Porto 44/45 e demais 29/30,
fallback de ancora, ficha com apolice emitida nunca expira, nao regressao do
prazo antigo para outros status), script novo registrado em `package.json`.
`npm test` verde.

**Risco nao resolvido (aguardando decisao) — migracao 49 nao executada:** a
regra acima hoje so existe calculada ao vivo em JS; para persisti-la no banco
(expirar fichas mesmo sem ninguem abrir a tela) foi criado
`supabase/49_fichas_expiracao_por_seguradora.sql`, que habilita a extensao
`pg_cron`, cria a funcao `public.expirar_fichas_aprovadas()` (`SECURITY
DEFINER`) e agenda um job diario (`cron.schedule`, 06:00 UTC) reproduzindo o
mesmo criterio (Porto 45 dias / demais 30 dias, `finalizada_em` com fallback
`created_at`, apenas `status = 'aprovado'` sem `numero_apolice`). Mesmo
tratamento da migracao 48 (nao executada em banco) — ambas criadas apenas para
revisao. Migracao 49, diferente de 48, foi commitada ao git sob decisao
explicita do usuario, mas permanece aguardando aprovacao antes de execucao no
SQL Editor do Supabase (regra de "Seguranca" do CLAUDE.md: banco/RLS/dados
pessoais param para plano + aprovacao).

**Revisao de entrega do Codex — Auto (perfil de cliente/apolice) + ImobiliariaDetalhe
(2026-07-06, Claude):** Codex entregou (nao commitado ainda): paginas novas
`AutoApoliceDetalhe.jsx` e `AutoClienteDetalhe.jsx` com rotas `/auto/apolices/:id`
e `/auto/clientes/:id`; filtro de mes no `AutoDashboard`/`AutoRenovacoes`
(`getDashboardAutoMetrics`, `getRenovacoesAuto`, `getGraficoEmissoesMensais`,
`getGraficoCotacoesStatus` agora aceitam `mes`); e em `ImobiliariaDetalhe.jsx` uma
troca da lista simples de codigos por seguradora por cards de cadastro (ativar
seguradora de fianca + codigo + observacoes, tabela `imobiliaria_seguradoras`).
Revisao encontrou e corrigiu: (1) bug de crash — `AutoEmissoes.jsx` (tabela
"Ultimas emissoes") chamava `onOpenApolice(item.id)` num `<tr onClick>`, mas essa
funcao so existe como prop dentro do componente `ModalApolices`; qualquer clique
na linha lancava `ReferenceError` (build/testes nao pegam, so em runtime) —
trocado para `abrirDetalhe(item)` (mesmo handler do botao "Abrir" da propria
linha) com `stopPropagation` nos botoes de acao; (2) regressao de acentuacao —
`ImobiliariaDetalhe.jsx` teve dezenas de strings visiveis ao usuario gravadas sem
acento pelo editor do Codex ("Variacao", "Imobiliaria", "Observacoes", "fianca",
etc.), inconsistente com o resto do arquivo (e com os outros arquivos do mesmo
lote, que ganharam acentos corretos) e com os passes de encoding anteriores;
acentos restaurados em todo texto de UI (labels, titulos, toasts, placeholders),
sem tocar nas chaves/colunas `codigo`/`observacoes` (essas continuam sem acento,
pois espelham o nome real da coluna no Supabase). Build (`npm run build`) e
testes (`npm test`, 44/44) verdes apos as correcoes.

**Risco nao resolvido (aguardando decisao) — migracao pendente:** a nova UI de
"Cadastros em seguradoras de fianca" em `ImobiliariaDetalhe.jsx` grava
`observacoes` em `imobiliaria_codigos`, mas essa coluna nao existe em nenhuma
migracao rastreada (`supabase/11_imob_codigos.sql` só tem `codigo`). O código em
`src/lib/imobiliariasCodigos.js` já tem fallback silencioso para coluna ausente,
então não quebra, mas as observações digitadas pelo usuário nunca são salvas até
a coluna existir. Criado `supabase/48_imobiliaria_codigos_observacoes.sql`
(`ALTER TABLE ... ADD COLUMN IF NOT EXISTS observacoes TEXT`) para revisão — **não
executado**; aguardando aprovação do usuário para rodar no Supabase SQL Editor.
A tabela `imobiliaria_seguradoras` usada pelo toggle de cadastro já existe
(`supabase/09_apolices_kanban.sql`), então essa parte não tem risco de schema.

**Revisão de entrega do Codex — commit `258b570` (Relatorio/cobranca + Auto +
ImobiliariaDetalhe), 2026-07-06/07, Claude:** revisão completa (encoding + lógica
+ performance + UX) do maior lote entregue pelo Codex até aqui. Achados e
correções, por área:

*Bugs críticos de perda/sumiço de dado (corrigidos):*
1. `buildRelatorioMovePatch('expirada')` gravava `status: 'expirada'` direto na
   ficha; como `REPORT_STATUSES = ['aprovado', 'emitido']` (`Relatorio.jsx`) não
   inclui `'expirada'`, a ficha sumia do relatório em qualquer refetch (troca de
   período, reload) — perda de dado visível ao usuário, sem erro no console.
   Corrigido: o move para "Expirada" agora só grava um marcador em
   `raw_data.manually_expired` (mesmo padrão dos outros patches deste arquivo,
   nunca escrevia em `status` real); `status` da ficha nunca muda. Isso também
   destravou o "voltar para Aprovada", que antes recaía sempre em Expirada por
   causa do `status` já corrompido; agora só bloqueia a restauração quando a
   ficha é *genuinamente* vencida (45+ dias reais), com toast explicando o
   motivo. `fichaOperational.js`: removido um branch de `expirada` que havia
   ficado duplicado/redundante nesse mesmo commit do Codex.
2. `AutoApoliceDetalhe.jsx`: `buildForm` não carregava `tipo` nem
   `seguradoras_cotadas` da emissão; ao salvar qualquer edição de uma emissão
   manual (sem cotação vinculada), `tipo` era resetado para `'novo'` e
   `seguradoras_cotadas` era zerado — perda de dado real, não só de exibição.
   Corrigido preservando os dois campos no form.
3. `AutoApoliceDetalhe.jsx`/`auto.js`: salvar uma apólice **sem** emissão
   vinculada chamava `atualizarApoliceAuto(id, form)` com o form inteiro, que
   inclui `email_cliente`/`origem_lead` — colunas que só existem em
   `cotacoes_auto`, não em `apolices_auto`; toda tentativa de salvar por esse
   caminho falhava com erro de coluna inexistente do Postgrest, e também não
   recalculava `valor_comissao`. Criada `atualizarApoliceAutoSemEmissao` em
   `auto.js`, reaproveitando o payload builder já existente (`buildApoliceAutoPayload`),
   restrito às colunas reais de `apolices_auto` e recalculando a comissão.
4. `auto.js`: filtro "Vencidas" (`getRenovacoesAuto({periodo:'passadas'})`) usava
   `parseMonthRef(mes)`, que sempre resolve para o dia 1 do mês — como
   `AutoRenovacoes.jsx` sempre manda um mês (nunca vazio), o corte virava
   "antes do dia 1 do mês selecionado" em vez de "antes de hoje"; renovações
   vencidas depois do dia 1 do mês corrente sumiam da aba Vencidas. Revertido
   para usar a data real de hoje, como era antes deste commit do Codex.
5. `getClienteAutoDetalhe` (auto.js): para clientes agrupados só por nome (sem
   `cliente_id`/CPF em nenhum registro — grupo criado por `clientKey` em
   `AutoClientes.jsx`), o código caía em `.eq('id', ref)` com `ref` sendo uma
   string de nome contra uma coluna `uuid`, e como os erros dessas queries
   *eram* checados, a função lançava e a página sempre mostrava "Cliente não
   encontrado" para um cliente que existia. Corrigido: só usa `id` como filtro
   quando `ref` é um UUID válido; para o caso "só nome", usa `nome_cliente` nas
   tabelas que têm essa coluna (`apolices_auto`, `emissoes_auto`,
   `cotacoes_auto`) e não bate em `renovacoes_auto` (que só tem `cliente_id`,
   sem nome) com um filtro que sempre falharia. Também parou de engolir erros
   nas 4 queries de resolução do cliente (antes só desestruturava `{ data }`).

*Encoding:* removido BOM (UTF-8 byte-order-mark) introduzido pelo editor do
Codex em `fichaOperational.js`, `relatorioCobranca.js`,
`relatorioCobranca.test.mjs` e `Relatorio.jsx`. Revertido mojibake extenso (210
ocorrências, ~109 linhas) em `Relatorio.jsx` e 5 descrições de teste em
`relatorioCobranca.test.mjs`, via script determinístico de reversão
UTF-8-como-CP1252 (mesma técnica dos passes anteriores) — sem nenhum caractere
U+FFFD (perda de dado irreversível) encontrado desta vez. Corrigidos também 2
typos literais de "?" (ASCII puro, não mojibake) na modal de confirmação de
cobrança em `Relatorio.jsx`, e acentos faltando em texto novo de UI:
`auto.js:1094` (`Renovação`, `apólice` x2) e `AutoEmissoes.jsx` (`Vigência`,
`Prêmio líquido`, `Comissão` nos cards de emissão recente).

*Performance:* `Relatorio.jsx` deixou de buscar as mesmas fichas duas vezes
(query final agora só busca os ids "extras" que não vieram no primeiro fetch);
removida a dependência de `imobiliarias` no efeito de fetch principal (causava
um segundo fetch completo assim que a lista de imobiliárias carregava — agora
lida via `ref`); removido `retorno_enviado` do SELECT (não é mais lido desde o
refactor que separou esse campo de `cobranca_started_at`). `auto.js`:
`getApoliceAutoDetalhe`/`getClienteAutoDetalhe` trocaram `select('*', embed(*))`
por listas de colunas explícitas (regra do projeto); removida variável
duplicada em `getDashboardAutoMetrics`. Item "trocar `todasRenovacoes` por
`count`" do plano original **não foi aplicado**: essa lista alimenta também a
seção "Acompanhar" (lista completa + contadores por status), não só as 2
métricas de vencimento — trocar por `count` quebraria aquela seção.

*UX/limpeza:* gating do botão "Mover" (dropdown de mover ficha) agora respeita
`canConfirmCobranca` quando o destino é "Enviado Cobrança", igual ao botão
dedicado; guard de colunas "movíveis" em `moveSelected` passou a derivar de
`MANUAL_REPORT_MOVE_OPTIONS` em vez de manter uma segunda lista hardcoded à
parte. `ImobiliariaDetalhe.jsx`: `carregarCadastros` ganhou try/catch + toast de
erro + estado de loading próprio (antes um erro de rede/RLS travava a seção
silenciosamente, e o "nenhuma seguradora encontrada" sempre piscava antes dos
dados chegarem); placeholder de campo vazio revertido de `-` para `—`
(consistência visual, tinha sido trocado neste commit do Codex).
`imobiliariasCodigos.js`: `hasMissingColumn` apertado para checar
código de erro (`42703`/`PGRST204`) e padrões específicos de mensagem, em vez
de casar qualquer erro que mencione a palavra "observacoes". Removidas
`buildCobrancaResetPatch` (relatorioCobranca.js), `fetchSeguradoras` e
`deletarCodigo` (imobiliariasCodigos.js) — exportadas mas nunca chamadas.
`CONTEXT.md` de `ImobiliariaDetalhe` atualizado para refletir os componentes e
queries atuais.

`npm test` (54/54) e `npm run build` verdes após todas as correções.
`npm run check:page-contexts` continua com as mesmas pendências pré-existentes
já conhecidas (todo `src/pages/auto/*`, incluindo as 2 páginas novas deste
commit, e `GestaoComercial.jsx` nunca tiveram `CONTEXT.md`) — não é regressão
desta revisão, só não foi resolvido agora (criar `CONTEXT.md` para o módulo Auto
inteiro é um esforço à parte). Smoke test manual no navegador **não foi feito**
(sem `.env`/credenciais Supabase neste ambiente) — recomenda-se validar antes de
considerar encerrado, em especial: mover ficha para Expirada e trocar de
período; salvar emissão manual e apólice sem emissão vinculada no Auto; aba
Vencidas em Renovações Auto; abrir `/auto/clientes/:id` de um cliente sem
CPF/cliente_id.

---

**Data de emissão editável + extração automática por seguradora (2026-07-07,
Claude):** `apoliceParser.js` passou a extrair `data_emissao` do PDF de cada
seguradora: Porto ("Data de Emissão: DD/MM/AAAA"), Pottencial ("Apólice
transmitida eletronicamente dia: DD/MM/AAAA"), Too ("Data da Emissão:
DD/MM/AAAA") e Tokio (`parseTokioMarineV3`, padrão tolerante a mojibake igual
aos demais campos desse parser — texto exato não confirmado com um PDF real,
recomenda-se validar na primeira emissão Tokio pós-deploy). Como esse campo já
não era destructurado em `extras`, ele passa a fluir automaticamente para
`campos.data_emissao` sem mudança em `parseApoliceText`.

`ApoliceDetalhe.jsx`: novo campo editável "Data de Emissão" (Dados da Apólice,
ao lado de Número da Apólice/Proposta); carregado do banco no `load()`,
preenchido automaticamente pelo upload de PDF (`handlePreencherInfo`) e usado
no `salvar()` no lugar do antigo comportamento fixo ("hoje" toda vez que o
status vira emitida/enviada, perdendo qualquer data real). `ApoicesGestao.jsx`
(fluxo "Upload direto" do Kanban): `data_emissao` na criação da apólice agora
usa `dadosExtraidos.data_emissao` (extraído do PDF) com fallback para hoje
quando o parser não encontrar a data.

**Risco de negócio a validar:** `data_emissao` alimenta cálculo de produção e
faturas por mês em Financeiro (`financeiroProducaoCalc.js`,
`financeiroFaturasCalc.js`). Até agora era sempre "data do upload/mudança de
status"; a partir de agora pode ser a data real de emissão impressa no PDF, que
pode cair em mês diferente do upload — isso pode mover uma apólice de mês na
produção/fatura em relação ao comportamento anterior. Comportamento pedido
explicitamente pelo usuário; sinalizar caso gere divergência inesperada em
Financeiro.

**Correção de encoding não relacionada, feita de passagem:** `ApolicesLista.jsx`
tinha 42 ocorrências de U+FFFD (perda de dado irreversível, uncommitted) mais
setas (`←`/`→`) trocadas por `?` literal — corrupção introduzida no editor após
o último commit, achada porque o arquivo precisava ser tocado por este mesmo
trabalho. Texto recuperado comparando com `git show HEAD` (sem alterar as
adições novas do mesmo diff: coluna `% Comissão`/`fmtPct`, `pct_comissao`).
`npm test` (54/54) e `npm run build` verdes após todas as mudanças.

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
