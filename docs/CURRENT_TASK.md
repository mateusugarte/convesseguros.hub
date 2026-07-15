# CURRENT TASK

**Ficha (`/fichas/:id`) — 2 bugs de cotação: valores/parcelas não salvavam para
Pottencial/TOO Seguros e mensagem de retorno ignorava a seguradora selecionada
manualmente (2026-07-15, Claude):** usuário reportou dois sintomas no bloco
"Cotação e retorno" de `FichaDetalhePage.jsx`. Systematic-debugging (análise
estática de código, sem `.env`/Supabase neste ambiente):

1. **Causa raiz do bug de valores não salvos:** `updateCotacao` reconstruía o
   array `raw_data.cotacoes` INTEIRO a partir do estado React `ficha` (closure
   da renderização no momento do clique), não do banco. Como cada campo do card
   (Status via `Select.onChange`, Valor da Parcela, % Desconto, Qtd. Parcelas,
   Comissão via `InlineField.onSave`) dispara sua própria chamada assíncrona
   independente e nenhuma delas aguarda a anterior, o fluxo natural de "aprovar"
   uma seguradora (mudar Status + digitar Valor + digitar Parcelas em sequência
   rápida) gerava 2-3 chamadas concorrentes partindo do MESMO `ficha` desatualizado
   — a que terminasse por último sobrescrevia `raw_data.cotacoes` inteiro,
   descartando as mudanças das chamadas anteriores (last-write-wins sobre um
   snapshot obsoleto, não sobre o dado mais recente). `editarFicha` já buscava
   `raw_data` fresco do banco antes de gravar, mas isso não ajudava porque o
   chamador sempre mandava a chave `cotacoes` inteira, sobrescrevendo qualquer
   coisa que a busca fresca tivesse. Como Pottencial/TOO Seguros são os últimos
   da lista (`COTACAO_SEGURADORAS_BASE`), são os que acumulam mais chamadas em
   voo quando o usuário preenche os cards em sequência — mas a race also podia
   afetar qualquer seguradora dependendo da velocidade de digitação.
   **Corrigido:** nova função `atualizarCotacaoFicha(id, seguradora, fields,
   userId)` em `src/lib/fichas.js` — busca `raw_data` fresco do banco e mescla
   só os campos daquela seguradora especificamente (mesmo padrão já usado por
   `editarFicha`/`salvarRetornoGeradoFicha`), em vez de reconstruir o array
   inteiro a partir do estado React. `updateCotacao` (`FichaDetalhePage.jsx`)
   passou a chamar essa função, mantendo o update otimista local.
2. **Causa raiz do bug da mensagem:** `buildCotacaoMessageData` calculava
   `seguradoraEscolhida` só pela cotação aprovada de MENOR valor total
   (`valor_parcela × parcelamento`), ignorando completamente a seguradora que o
   usuário já escolhe manualmente pelo botão "Selecionar" de cada card
   (`selecionarSeguradora`, grava em `ficha.seguradora`/
   `raw_data.seguradora_escolhida`) — por isso a mensagem sempre saía com a
   seguradora mais barata (ex. Porto Seguro) mesmo com Pottencial selecionada e
   aprovada. **Corrigido:** `buildCotacaoMessageData` agora prioriza a cotação
   aprovada que bate com `ficha.raw_data.seguradora_escolhida`/`ficha.seguradora`
   quando existir; só cai no cálculo automático de menor valor se nada foi
   selecionado manualmente (ou se a seguradora selecionada não estiver mais
   aprovada). As linhas de preço/status de todas as seguradoras continuam
   aparecendo normalmente — só o trecho "Segue link de biometria *SEGURADORA*"
   passou a refletir a escolhida.

`npm test` (89/89) e `npm run build` verdes. Nenhuma mudança de schema/RLS —
só lógica de app em `src/lib/fichas.js` e `src/pages/FichaDetalhePage.jsx`.

**Smoke test pendente (sem `.env`/Supabase neste ambiente):** abrir uma ficha,
aprovar Pottencial e TOO Seguros preenchendo Status/Valor/Parcelas em sequência
rápida, recarregar a página e confirmar que os valores persistiram; clicar
"Selecionar" em um card aprovado (ex. Pottencial) e gerar a mensagem de retorno,
confirmando que o trecho de biometria cita a seguradora selecionada mesmo se ela
não for a mais barata.

**Riscos remanescentes:** a correção fecha a race entre chamadas originadas na
mesma aba/sessão; edição simultânea da mesma ficha por duas abas/pessoas ao
mesmo tempo ainda pode colidir (fora do escopo reportado). Se dois campos do
MESMO card forem salvos com timing quase idêntico (mesmo request), ainda existe
uma janela pequena de corrida no round-trip ao banco — bem menor que antes
(era do tamanho da digitação do usuário, agora é do tamanho de uma consulta
Supabase), não eliminada por completo.

---

**Relatório (`/relatorio`) — mover para "Desistiu" + fichas "fantasma" no card por
imobiliária (2026-07-14, Claude):** usuário reportou 3 sintomas ligados: (1) não
havia como mover manualmente uma ficha para a coluna "Desistências"; (2) o card de
algumas imobiliárias na visão geral ficava vermelho mesmo depois de todas as fichas
aprovadas terem sido marcadas como cobrança enviada; (3) algumas imobiliárias
mostravam ficha(s) no card da visão geral mas, ao abrir o relatório individual,
tudo aparecia zerado (Aprovadas 0, Emitidas 0, etc). Investigação (systematic-
debugging, sem acesso a banco neste ambiente — análise estática de código):

- **Causa raiz de (2) e (3), a mesma:** a visão geral (`groupByImobiliaria`) agrupa
  fichas usando `resolverNome()` (`useImobiliaria.js`) — resolução "fuzzy" (sem
  acento/caixa, com fallback de title-case via `normalizeImobiliaria` para nomes
  ainda não cadastrados como alias). Já o detalhe por imobiliária
  (`/relatorio/:id`) buscava fichas/apólices com `.in('imobiliaria', aliases)` —
  **match exato de string** contra `imobiliaria_aliases`. Uma ficha com uma
  variação de texto ainda não virou alias (acento/caixa/espaço) era contada no
  card da visão geral (o fallback de `resolverNome` "adivinha" o nome canônico)
  mas nunca aparecia no detalhe (match exato não encontra) — o card parecia ter
  fichas fantasma, e como a ação de marcar cobrança só existe na tela de detalhe,
  essas fichas nunca podiam ser resolvidas, mantendo o card vermelho para sempre.
  Corrigido em `Relatorio.jsx`: o filtro por imobiliária no detalhe deixou de ser
  feito no banco via alias exato e passou a ser feito em memória reaplicando o
  mesmo `resolverNome`/`normalizeKey` usado na visão geral — garante que card e
  detalhe sempre concordem e nenhuma ficha aprovada fique escondida. `getAliases`
  (não usado mais neste arquivo) removido do destructuring de `useImobiliaria()`.
- **Causa raiz de (1):** `MANUAL_REPORT_MOVE_OPTIONS` só incluía
  `aprovada`/`expirada`/`enviado_cobranca`; `buildRelatorioMovePatch`
  (`relatorioCobranca.js`) não tinha caso para `desistiu`. Adicionado
  `buildDesistiuPatch` (grava `status: 'cancelado'` + `finalizada_em`, mesma
  convenção já usada pelo Kanban de Fichas ao cancelar, e limpa marcadores de
  cobrança/expiração manual) e `desistiu` foi incluído em
  `MANUAL_REPORT_MOVE_OPTIONS`, disponível no seletor "Mover para coluna..." do
  toolbar de seleção em massa. `getFichaPeriodAnchorDate` (`Relatorio.jsx`) passou
  a ancorar `cancelado` por `finalizada_em` (mesma regra de aprovado/emitido) —
  sem isso, mover uma ficha para Desistiu trocaria sua âncora de período para
  `created_at` e ela sumiria do mês sendo visto no momento do move.

**Ronda 2 (mesmo dia, feedback do usuário) — contagem errada no card:** usuário
apontou mais 2 sintomas de contagem no card da visão geral: (a) "Aprovadas"
continuava contando fichas que já tinham sido movidas para "Enviado Cobrança"
(usuário pediu um jeito de considerar essas fichas como "em cobrança" e não mais
"aprovada apenas" — perguntado se seria coluna nova no banco; usuário confirmou
que **não**, só corrigir a contagem, reaproveitando o que já existe); (b) "Emitidas"
mostrava 5 quando na verdade havia 6 apólices.

- **(a):** o card usava `imobMetrics.aprovadas` (união deliberada de
  aprovada+enviado_cobranca, mantida para a taxa de conversão) como o número
  exibido na etiqueta "Aprovadas". Já existia, calculado à parte,
  `imobMetrics.semCobrancaEnviada` (só as que NÃO foram enviadas ainda) — só não
  era esse o valor mostrado. Trocada a etiqueta "Aprovadas" do card para usar
  `semCobrancaEnviada`; `pendingCount`/cor do card continuam usando `aprovadas`
  (união ampla), sem mudança de comportamento ali.
- **(b):** `normalizeKey()` (`Relatorio.jsx`) só corrigia mojibake e baixava a
  caixa, sem remover acento. Uma apólice com `imobiliaria` gravado com uma
  variação de acento diferente da alias cadastrada caía num grupo "fantasma" no
  `groupByImobiliaria` que nunca batia com nenhuma imobiliária real da tabela —
  somava no total geral da página ("Apólices emitidas" no topo) mas sumia do card
  daquela imobiliária especificamente. Trocado `normalizeKey` para reaproveitar
  `normalizeImobiliariaKey` (`imobiliariasMapeamento.js`, já testado), que remove
  acento além de mojibake/caixa/espaço duplicado. Mesma correção aplicada em
  `useImobiliaria.js` (`resolverNome`, `resolverImobiliariaInfo`, construção do
  `aliasMap`) — é a fonte de `resolverNome` usada em várias telas além do
  relatório, então o mesmo tipo de gap por acento poderia afetar qualquer uma
  delas.

`npm test` (89/89, sem novos testes nesta ronda — mudança é só de qual campo já
calculado é exibido, e troca de uma função de normalização por outra já testada
em `imobiliariasMapeamento.test.mjs`), `npm run build` e `npm run
check:page-contexts` (mesmas pendências pré-existentes de `src/pages/auto/*`/
`GestaoComercial.jsx`, não é regressão) verdes.

**Smoke test pendente (sem `.env`/Supabase neste ambiente):** abrir uma
imobiliária que hoje mostra card com contagem mas detalhe zerado e confirmar que
os blocos passam a exibir as fichas; marcar cobrança enviada em todas as
aprovadas de uma imobiliária com card vermelho e confirmar que o card vira azul/
laranja (não fica mais preso em vermelho); selecionar fichas no detalhe, escolher
"Desistências" no seletor "Mover para coluna..." e confirmar que elas aparecem no
bloco Desistências e continuam visíveis no período atual do relatório; conferir
que "Aprovadas" no card não conta mais fichas já em "Enviado Cobrança"; achar a
imobiliária com "Emitidas" divergente do total real e confirmar que a contagem
bateu depois da correção de acento.

**Riscos remanescentes:** o filtro em memória no detalhe busca todas as fichas/
apólices do período (sem filtro de imobiliária no banco) e filtra no cliente —
mesmo padrão de custo que a visão geral já usa, mas pode pesar em bases muito
grandes; considerar um índice/RPC dedicado se o volume crescer muito. O mesmo
padrão de match exato por alias (`.in('imobiliaria', aliases)`) ainda existe em
outros pontos do app (`apolices.js`, `fichas.js`) — fora do escopo desta correção
(usuário pediu especificamente sobre Relatórios), mas pode ter o mesmo tipo de
gap se alguma tela dependente de alias exato for usada como fonte de verdade.

---

**Banco de perguntas de quiz + área admin de curadoria (TREINAMENTOS) — 2026-07-14,
Claude:** fecha o gap conhecido da entrega anterior (nenhum quiz tinha pergunta). Plano
apresentado e aprovado nesta sessão (mesmo arquivo `~/.claude/plans/deep-rolling-wind.md`,
sobrescrito para esta rodada). Pivô importante durante a conversa: o pedido original
("admin cria o quiz, a IA sugere por lição") foi reinterpretado a pedido explícito do
usuário — sem Edge Function/API de LLM em runtime; quem gera o banco de perguntas é o
próprio Claude, nesta sessão, e o admin só cura/ativa a partir do banco gerado.

1. **Conteúdo** (`docs/TREINAMENTOS_QUIZ_PERGUNTAS.md`, novo): 340 perguntas de múltipla
   escolha (alvo era 375 — 9 módulos × 15 + 6 setores × 40), geradas por 6 agentes em
   paralelo (um por setor), cada um restrito ao trecho correspondente de
   `TREINAMENTOS_CONTEUDO_FIANCA.md`, sem inventar fatos. 4 blocos ficaram abaixo do alvo
   (marcados `⚠️` no arquivo, motivo: material fonte curto — Transferência de Corretagem
   13/15, quiz final de Renovações 32/40, Endosso 28/40, Cancelamentos 27/40) —
   deliberado, não forçado. Defeito de qualidade encontrado e corrigido antes de
   compilar: 3 dos 6 rascunhos saíram com a resposta correta concentrada em poucas
   letras (Endosso: 100% em "a"); todas as alternativas dos 6 setores foram
   reembaralhadas (conteúdo preservado) para distribuição a/b/c/d equilibrada.
2. **Schema (sem migration nova — JSONB)**: cada pergunta em `conteudo.quiz` ganhou um
   campo `status: 'sugerida' | 'ativa'`. Nasce `sugerida`; só fica visível ao funcionário
   depois que um admin marca `ativa` na tela de curadoria.
3. **Seed** (`scripts/generate-treinamentos-quiz-seed.mjs` → nova migration
   `supabase/53_treinamentos_quiz_perguntas.sql`, **NÃO EXECUTADO NO SUPABASE**):
   reaproveita `uuidv5`/`slugify`/`nodeId` de `scripts/generate-treinamentos-seed.mjs`
   para recalcular os mesmos IDs dos 15 nós de quiz já semeados — verificado por
   comparação direta que os 15 IDs-alvo do UPDATE batem com os IDs já existentes em
   `52_treinamentos_seed_fianca.sql`. `UPDATE ... jsonb_set(conteudo, '{quiz}', ...)`,
   idempotente.
4. **Lógica pura**: `getActiveQuizQuestions(quiz)` em `trainingProgression.js` (+2
   testes) filtra por `status === 'ativa'`. `TreinamentosLicao.jsx` (`QuizForm`) passou a
   usar essa função em vez de `conteudo.quiz` cru.
5. **Camada Supabase**: `updateQuizQuestions({ nodeId, quiz })` em `training.js` —
   substitui `conteudo.quiz` inteiro via UPDATE; sem RLS nova, reaproveita
   `training_nodes_update_admin` já existente.
6. **UI de admin** (`src/pages/treinamentos/admin/`, `AdminRoute`, nav `adminOnly`):
   `TreinamentosAdminQuizzes` (`/treinamentos/admin`, lista os 15 nós de quiz com
   contagem sugerida/ativa) e `TreinamentosAdminQuizDetalhe`
   (`/treinamentos/admin/quiz/:nodeId`, ativa/desativa/edita/remove pergunta, salva tudo
   de uma vez). Edição é só em estado local até o "Salvar alterações".

**Pendência**: `53_treinamentos_quiz_perguntas.sql` ainda não foi rodado no Supabase —
igual ao fluxo das migrations 51/52, precisa de execução manual explícita no SQL Editor.
Sem isso, os quizzes continuam sem pergunta em produção. `npm test` (87/87), `npm run
build` e `npm run check:page-contexts` (sem novas pendências) rodados e conferidos.

---

**Base técnica de TREINAMENTOS — schema/RLS/seed aplicados no Supabase, lógica e UI
funcionais (2026-07-14, Claude + usuário):** feature nova (currículo de treinamento
para funcionários, produto Fiança). Plano técnico apresentado e aprovado nesta
sessão (`~/.claude/plans/deep-rolling-wind.md`) antes de qualquer arquivo tocar
banco — regra "Segurança" do CLAUDE.md deste projeto. **Atualização: usuário rodou
as duas migrations manualmente no SQL Editor do Supabase — `training_nodes` e
`training_progress` já existem e estão semeadas em produção/no banco do projeto.**

**Conteúdo fonte:** `docs/TREINAMENTOS_CONTEUDO_FIANCA.md` (55 lições revisadas em
sessão anterior, 6 setores, 9 módulos, produto Fiança) + `TREINAMENTOS_ARQUITETURA.md`
(desenho de dados original).

1. **Schema + RLS** (`supabase/51_treinamentos_schema.sql`, **EXECUTADO NO
   SUPABASE pelo usuário**): `training_nodes` (árvore produto→setor→módulo→lição,
   `conteudo JSONB`, `eh_quiz_modulo`/`eh_quiz_final_setor`) e `training_progress`
   (por funcionário/nó, status/quiz_score/tentativas/concluido_em). RLS:
   `training_nodes` legível por todo `authenticated`, escrita só admin
   (`is_training_content_admin()`, mesmo padrão de `is_finance_admin()` em
   `28_financeiro_apolices.sql`); `training_progress` ownership-based
   (`funcionario_id = auth.uid()`), leitura extra para admin.
   Desvios do desenho original documentados no plano: sem coluna `seguradora`
   nem `prerequisito_node_id` (tudo derivado de `parent_id`+`ordem`+flags de
   quiz); novo campo `tipo_conteudo_nota` para qualificadores híbridos da fonte.

2. **Seed** (`scripts/generate-treinamentos-seed.mjs` → `supabase/52_treinamentos_seed_fianca.sql`,
   **EXECUTADO NO SUPABASE pelo usuário**): parser do markdown fonte, gera 86 nós (produto +
   6 setores + 9 módulos + 55 lições reais + 9 quiz de módulo + 6 quiz final de
   setor sintéticos) com UUIDv5 determinístico (idempotente). Achado durante a
   implementação, fora do plano original: `variacoes_por_seguradora` não bate 1:1
   com uma seguradora só na fonte real (rótulos combinados como "Porto / Junto",
   bullets sem seguradora nomeada) — usuário decidiu por lista `[{rotulo, texto}]`
   em vez do dicionário de 5 chaves fixas do plano original, para não inventar a
   qual seguradora cada bullet ambíguo pertence.

3. **Lógica de progressão** (`src/lib/trainingProgression.js`, pura/testável —
   21/21 testes em `trainingProgression.test.mjs`, registrado em `package.json`):
   desbloqueio sequencial de lição/módulo, quiz de módulo desbloqueia o próximo
   módulo (não "todas as lições"), quiz final de setor depende do último módulo,
   nota de corte 70% (`QUIZ_PASSING_SCORE_PCT`), `gradeQuiz` nunca "passa" com 0
   perguntas (`reason: 'no_questions'`).

4. **Camada Supabase** (`src/lib/training.js`): `fetchTrainingTree`,
   `fetchTrainingProgress`, `upsertLicaoProgress`, `submitQuizAttempt`.

5. **UI funcional** (não é o acabamento final — Codex refina depois, como
   combinado): `src/pages/treinamentos/{TreinamentosDashboard,TreinamentosSetor,
   TreinamentosModulo,TreinamentosLicao}.jsx` + `CONTEXT.md` de cada uma;
   `src/components/treinamentos/{TrainingStatusBadge,TrainingBreadcrumb,
   TrainingChatButton}.jsx` (o último é o ponto de extensão pedido para o chat
   com o CONVES IA — stub desabilitado, zero chamada de rede). Rotas em
   `App.jsx` (`/treinamentos`, `/treinamentos/setores/:id`, `/modulos/:id`,
   `/licoes/:id`) e novo grupo de nav "Treinamentos" em `Layout.jsx`.

**Pendências / decisões em aberto:**
- Nenhuma pergunta de quiz foi escrita — todo nó de quiz semeado com
  `conteudo.quiz = []`. Por isso **nenhum módulo pode ser concluído ponta a
  ponta com dados reais** até uma rodada de conteúdo separada escrever as
  perguntas (mesmo rigor de "não inventar" usado no resto do currículo).
- Setores de módulo único (Renovações, Endosso, Sinistros, Cancelamentos,
  Cobrança) semeiam quiz de módulo E quiz final de setor sobre material quase
  idêntico — sinalizado no plano, ainda não resolvido.
- **Junto Seguros permanece sem fonte — decisão definitiva do usuário (2026-07-14),
  não é mais um gap em aberto.** Todas as lições ficam com essa seguradora
  ausente da lista `variacoes_por_seguradora`; não entra pauta de revisão
  futura a menos que o usuário decida trazer material da Junto novamente.

**Portão de execução:** `51_treinamentos_schema.sql` e `52_treinamentos_seed_fianca.sql`
foram criados para revisão e **rodados manualmente pelo usuário no SQL Editor do
Supabase em 2026-07-14** — mesmo fluxo já usado para outras migrations sensíveis
deste projeto. `training_nodes`/`training_progress` existem e estão semeadas.
Smoke test manual (login real, abrir `/treinamentos`) ainda não confirmado nesta
sessão — este ambiente não tem `.env`/credenciais Supabase para validar.

**Arquivos alterados/criados:** `supabase/51_treinamentos_schema.sql`,
`supabase/52_treinamentos_seed_fianca.sql`, `scripts/generate-treinamentos-seed.mjs`,
`src/lib/trainingProgression.js` (+`.test.mjs`), `src/lib/training.js`,
`src/components/treinamentos/*.jsx`, `src/pages/treinamentos/*.jsx` (+`CONTEXT.md`),
`src/App.jsx`, `src/components/Layout.jsx`, `package.json`, `docs/PROJECT_CONTEXT.md`.

**Próximo passo sugerido:** revisar os dois arquivos `.sql`; se aprovado, rodar
`51_...` e depois `52_...` manualmente no SQL Editor do Supabase; smoke test
manual (sem `.env` neste ambiente); decidir sobre as pendências acima; só então
autoria de perguntas de quiz.

---

**Responsividade cross-resolution — implementação completa (2026-07-13, Claude):**
usuário reportou que o sistema, ajustado visualmente para 1920x1080, fica "muito
pequeno ou muito grande e mal posicionado" em outras resoluções, com prioridade
explícita para notebooks. Tarefa é normalmente de especialidade Codex (UI/CSS/
responsividade), usuário optou por Claude planejar e executar. Auditoria (Layout.jsx,
index.css, tailwind.config.js + agente Explore varrendo `src/`) identificou 3 causas
raiz e todas foram corrigidas em 5 fases:

1. **Fase 0 — `Layout.jsx`/`tailwind.config.js`:** sidebar sem preferência salva
   (`localStorage 'sidebar-open'`) agora abre já recolhida (rail 92px) por padrão em
   larguras <1440px (notebooks); preferência explícita do usuário continua respeitada.
   Novo breakpoint custom `uw: '2200px'` + `uw:max-w-[1900px] uw:mx-auto` no wrapper do
   `<Outlet />` — conteúdo não estica mais sem teto em ultrawide/4K (não afeta
   notebooks nem desktop 1920 padrão).
2. **Fase 1 — `Dashboard.jsx`, `AutoDashboard.jsx`, `ComercialDashboard.jsx`:**
   adicionado breakpoint `lg:` intermediário nos grids que só tinham `xl:`
   (`xl:grid-cols-12` viravam 1 coluna forçada entre 1024-1280px — faixa exata de
   1366x768/1440x900). Também fechado `md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
   nas métricas operacionais/comerciais para scaling mais suave.
3. **Fase 2 — avaliada, sem mudança extra:** a maioria dos grids `xl:grid-cols-4`
   é de exatamente 4 itens fixos (não se beneficiam de `2xl:`); os grids com listas
   dinâmicas já tinham `2xl:` (Dashboard imobiliárias, ComercialDashboard, Relatorio,
   ApolicesLista). O teto `uw:max-w` da Fase 0 já resolve o "esticamento" em telas
   grandes sem precisar tocar cada grid.
4. **Fase 3 — `index.css`, `KanbanFichas.jsx`, `Pipeline.jsx`:** `.kanban-viewport`
   trocou `min-height: max(68vh, 640px)` (fixo, estourava em notebook 768px de altura)
   por `clamp(26rem, calc(100dvh - 18rem), 46rem)`, mesmo padrão já validado em
   `.apolices-gestao-page`. `KanbanFichas.jsx` tinha um `style={{ height: 'max(68vh,
   640px)' }}` inline pior ainda (height fixo, não min-height) — removido, herda da
   classe. `Pipeline.jsx:856` tinha `calc(100vh - 28rem)` competindo com
   `min-h-[520px]` (min-height quase sempre vencia, travando em 520px) — trocado por
   `clamp(24rem, calc(100vh - 26rem), 44rem)`. `Pipeline.jsx:242` também tinha
   `w-[296px]` fixo sobrescrevendo a largura responsiva de `.kanban-col` (var
   `--kanban-col-w`, já ajustada por media query) — removido.
5. **Fase 4 — avaliada, sem mudança:** grids `grid-cols-2/3` sem prefixo (LeadDetalhe,
   GestaoComercial) estão dentro de modais com `max-w` já responsivo (`Modal.jsx`) —
   não é problema de notebook/desktop, cosmético de mobile, fora do escopo pedido.
6. **Fase 5 — validação visual (dev server + Chrome, login real do usuário):**
   confirmado em 1366x768 e 1920x1080 nas 3 telas mais impactadas (Dashboard, Kanban de
   Fichas, Pipeline comercial). **Bug real encontrado e corrigido durante a validação**
   (pré-existente, não introduzido nesta sessão): a ordem dos cards em
   "Top imobiliárias" → "Fichas por imobiliária" (full-width) → "Atividade recente"
   deixava um vão vazio permanente ao lado de "Top imobiliárias" (CSS Grid não
   reaproveita espaço de linhas anteriores quando um item full-width força quebra de
   linha) — isso já acontecia em produção a 1920x1080, ficou mais visível ao adicionar
   o breakpoint `lg:`. Corrigido reordenando: "Top imobiliárias" + "Atividade recente"
   lado a lado primeiro (preenchem a linha inteira, 5+7 de 12 colunas / 1+2 de 3), card
   full-width por último.

`npm run build` verde a cada fase, `npm test` 64/64 verde ao final. Nenhuma mudança de
lógica de negócio, banco, RLS ou autenticação — só CSS/Tailwind/JSX de layout.

**Arquivos alterados:** `tailwind.config.js`, `src/components/Layout.jsx`,
`src/index.css`, `src/components/KanbanFichas.jsx`, `src/pages/Dashboard.jsx`,
`src/pages/auto/AutoDashboard.jsx`, `src/pages/comercial/ComercialDashboard.jsx`,
`src/pages/comercial/Pipeline.jsx`.

**Riscos remanescentes:** validação visual cobriu só notebook (1366x768) e desktop
(1920x1080) com dados reais; ultrawide (3440x1440) e 4K (3840x2160) foram corrigidos
pela análise de código (`uw:max-w` cap) mas não visualmente confirmados nesta sessão —
recomenda-se checar ao menos uma vez em monitor grande real. Outras páginas com grids
`xl:`-only não tocadas nesta rodada (fora das 3 mais usadas) podem ter o mesmo vácuo
1024-1280px em menor escala — não é regressão, é escopo não coberto.

**Próximos passos sugeridos:** validar visualmente em 1440x900 (segunda resolução de
notebook mais comum) e em um monitor ultrawide/4K real se disponível; se aparecerem
outras páginas com o mesmo sintoma, aplicar o mesmo padrão `lg:` intermediário.

---

**Upload em Lote — imobiliária por linha + duplicidade em 2 níveis (vermelho/laranja)
(2026-07-08, Claude):** redesenho do workspace `upload_lote` a pedido do usuário, mudando
uma decisão anterior (imobiliária deixa de ser única para o lote todo).

1. **Imobiliária por linha, não mais global**: removida a seleção de imobiliária do lote
   inteiro (sidebar); cada linha (`LinhaApoliceLote`) agora tem seu próprio
   `ImobiliariaSelect` (componente já existente, reaproveitado — mostra o logo da
   imobiliária no próprio seletor via `WorkspacesSelect`). Como o casamento de ficha por
   nome dependia da imobiliária escolhida, `buscarFichasParaVinculoApolice` passou a ser
   chamada 1x (sem filtro de imobiliária) ao abrir o workspace, carregando todas as fichas
   não-recusadas do sistema; por linha, ao escolher a imobiliária, resolve os aliases
   (`getAliases`) e filtra essas fichas em memória (`todasFichas.filter(f =>
   aliases.includes(f.imobiliaria))`) antes de casar por nome (`matchFichasPorNome`) — evita
   1 query por PDF.
2. **Duplicidade em 2 níveis**: antes só existia 1 aviso (laranja) para número de apólice
   já cadastrado. Agora:
   - **Vermelho** (`duplicidadeNumero`, `buscarApolicePorNumero`) — mesmo número já existe
     no sistema; continua bloqueando a seleção da linha até confirmar "É uma apólice
     diferente" no modal "Verificar dados".
   - **Laranja** (`apoliceDivergente`, nova lógica) — a ficha vinculada à linha (auto ou
     manualmente) já tem uma apólice associada (`buscarApolicePorFichaId`, já existente),
     mas com número diferente do PDF atual (comparação via `normalizeNumeroApolice`, nova
     importação de `lib/apolicesNumero.js`); não bloqueia a seleção, só avisa com um botão
     "Verificar apólice existente" (inline na linha e também replicado no modal).
3. **"Ver apólice existente" abre em nova aba** (`window.open`, não `navigate`) nos dois
   níveis — a pedido explícito do usuário ("se ele voltar, ele volta para a mesma parte de
   onde estava antes"). Como o lote em andamento nunca é desmontado (a aba do Upload em
   Lote continua aberta), não há nada pra "restaurar": o usuário só fecha a aba nova e
   continua exatamente de onde estava. Não usei `sessionStorage`/persistência de estado
   porque os `File` dos PDFs não são serializáveis e a rota do kanban desmontaria o
   workspace de qualquer forma — abrir em nova aba é a solução mais simples e robusta pro
   requisito.

`SEGURADORAS_UPLOAD_DIRETO`, `criarApolice`, `uploadDocumento`, `vincularApoliceAFicha`,
`calculateValorComissao`, `Modal`/`DadoCard` reaproveitados sem mudança. `npm run build`,
`npm test` (64/64) e `npm run check:page-contexts` (mesmas pendências pré-existentes)
verdes. `CONTEXT.md` de `ApoicesGestao` atualizado.

**Smoke test pendente (sem `.env`/Supabase neste ambiente):** subir 2+ PDFs, escolher uma
imobiliária diferente em cada linha e conferir que o logo aparece e que as fichas
candidatas mudam por linha; testar o card vermelho (subir um PDF com número já cadastrado)
e o laranja (vincular uma ficha que já tem apólice com outro número); clicar "Abrir
apólice existente"/"Verificar apólice existente" e confirmar que abre em nova aba sem
alterar o estado do lote na aba original.

---

**Habilitar Tokio Marine no Upload Direto e no Upload em Lote (2026-07-08, Claude):**
`SEGURADORAS_UPLOAD_DIRETO` (`ApoicesGestao.jsx`) ganhou `'Tokio Marine'` — o parser
`parseTokioMarineV3` já existia em `apoliceParser.js` e já está mapeado em `PARSERS`
(`tokio`/`tokio marine`), só não era oferecido nos seletores de seguradora dos dois
workspaces de upload. Grid de seguradora trocado de `grid-cols-3` para `grid-cols-2` (2x2)
nos dois workspaces para acomodar o 4º botão sem ficar desalinhado. `SeguradoraBadge`
resolve logo/iniciais dinamicamente por nome, então não precisou de mudança própria.
`npm run build` verde.

**Risco já sinalizado antes (continua valendo):** o parser da Tokio nunca foi validado
contra um PDF real (só desenvolvido por inferência de padrão) — recomenda-se conferir os
campos extraídos (`numero_apolice`, vigência, nome do locatário/proprietário, prêmio,
parcela) na primeira apólice Tokio real subida por qualquer um dos dois fluxos, e ajustar
os regexes de `parseTokioMarineV3` se algo vier vazio/errado.

---

**Upload em Lote de Apólices (até 10 PDFs) com vínculo automático de ficha (2026-07-08,
Claude):** novo workspace `upload_lote` em `ApoicesGestao.jsx` (além de
`kanban`/`iniciar`/`upload` já existentes), componentes `UploadLoteWorkspace` +
`LinhaApoliceLote`. Fluxo: usuário escolhe seguradora + imobiliária uma vez (travadas
assim que o primeiro PDF é adicionado), sobe até 10 PDFs de uma vez (`input type="file"
multiple`, corta em 10 com toast se passar do limite), o sistema extrai os dados de cada
um sequencialmente via `parseApolice` (já existente, sem mudança), casa cada apólice por
nome com fichas de qualquer status exceto `recusado` da imobiliária selecionada (nova
`buscarFichasParaVinculoApolice` + `matchFichasPorNome` em `src/lib/fichas.js` — busca
única por imobiliária, reaproveitada para todos os PDFs do lote, sem 1 query por arquivo),
destaca apólices já cadastradas pelo mesmo número (`buscarApolicePorNumero`, já existente)
e bloqueia a seleção daquele item até o usuário confirmar "é uma apólice diferente" no
modal "Verificar dados" (reaproveita `Modal`/`DadoCard` já existentes), permite comissão
(%) opcional por linha com `valor_comissao` calculado automaticamente
(`calculateValorComissao`, já existente) e cria só as selecionadas: `criarApolice` +
`uploadDocumento` (mesmo padrão do Upload Direto) e, quando há ficha vinculada,
`vincularApoliceAFicha` (nova em `src/lib/apolices.js`, extrai o mesmo update de ficha que
`registrarApoliceDaFicha` já fazia — status → `emitido`, numero_apolice, seguradora,
vigência, valor_parcela — sem alterar `registrarApoliceDaFicha`, que continua servindo só
o fluxo "Iniciar Emissão"). Itens com erro de criação ganham botão "Tentar novamente" e
continuam na lista; itens criados com sucesso saem da lista e disparam um `load()` do
kanban ao final.

Nenhuma mudança de schema, RLS ou autenticação — só lógica de app (2 funções novas de
leitura/escrita) e UI nova. `CONTEXT.md` de `ApoicesGestao` atualizado para documentar os
3 workspaces (estava desatualizado, não mencionava nem "Upload Direto"). `npm run build`,
`npm test` (64/64) e `npm run check:page-contexts` (mesmas pendências pré-existentes de
`src/pages/auto/*`/`GestaoComercial.jsx`, não é regressão) verdes.

**Smoke test pendente (sem `.env`/Supabase neste ambiente):** abrir "Upload em Lote" em
`/apolices`, escolher seguradora + imobiliária com fichas conhecidas, subir 2-3 PDFs reais
(incluindo 1 cliente com ficha não-recusada existente e 1 número de apólice já
cadastrado), conferir que a ficha candidata aparece certa, que o destaque de duplicidade
bloqueia a seleção até confirmar em "Verificar dados", que preencher comissão calcula
`valor_comissao`, e que "Registrar selecionadas" cria só as marcadas, vincula a ficha
escolhida (conferir que ela muda de status para `emitido`) e anexa o PDF de cada uma.

**Risco a sinalizar:** casamento de ficha por nome é só string-match normalizado (sem
acento/case) — nomes muito diferentes de grafia entre a ficha e o PDF não vão aparecer
como candidato automático; o usuário sempre pode ver "Nenhuma ficha correspondente
encontrada" e seguir sem vínculo, nada é vinculado sem revisão possível. Também nada
impede selecionar a mesma ficha candidata em duas linhas do mesmo lote (ex: PDF
duplicado) — não é bloqueado, fica por conta da revisão do usuário antes de registrar.

---

**Revisão de entrega do Codex — commits `12de783`/`91ae20b` (Dashboard/Relatorio/
ImobiliariaDetalhe), 2026-07-08, Claude:** revisão de performance/responsividade
+ encoding + lógica pedida pelo usuário ("deixe mais veloz, responsivo e suave").

*Encoding (BOM/mojibake introduzidos pelo editor do Codex, mesmo padrão já
documentado neste arquivo):* BOM removido de `App.jsx`, `imobiliariasSchema.js`,
`imobiliariasMapeamento.js`, `Imobiliarias.jsx` e do arquivo renomeado
`ImobiliariaDetalhe.jsx` (ver abaixo). Mojibake revertido em `App.jsx`
("Ãrea Auto"/"Ãrea Comercial" → "Área Auto"/"Área Comercial", dupla-codificação
UTF-8) e em `Dashboard.jsx` (perda real de acentuação — "imobili?ria" → "imobiliária",
"per?odo" → "período", "Cat?logo" → "Catálogo" — mais um byte de controle
invisível (0x1D) colado a caracteres de replacement (U+FFFD) que substituíam o
travessão "—" de 11 placeholders de métrica, e "Últimos 3/6 meses" corrompido
para "?altimos"). Todas as correções via inferência de contexto (palavras comuns,
inequívocas) + validadas depois com `npm test`/`npm run build`.

*Dead code:* `ImobiliariaDetalheFixed.jsx` (630 linhas, entregue pelo Codex como
arquivo novo em vez de editar `ImobiliariaDetalhe.jsx` no lugar) tinha substituído
silenciosamente o arquivo antigo no roteamento (`App.jsx` importava só o novo),
deixando `ImobiliariaDetalhe.jsx` original órfão (0 imports). Consolidado:
`ImobiliariaDetalhe.jsx` antigo removido, `ImobiliariaDetalheFixed.jsx` renomeado
para `ImobiliariaDetalhe.jsx` (função renomeada de volta para `ImobiliariaDetalhe`),
`App.jsx` e `CONTEXT.md` da página atualizados.

*Performance/responsividade (o pedido explícito do usuário):*
1. `imobiliariasSchema.js`: `fetchImobiliariaById` descobre colunas opcionais
   ausentes no banco tentando a query e removendo uma coluna por vez a cada erro
   — sequencial, sem cache. Como os 4 campos comerciais (`recebe_comissao`,
   `pct_comissao`, `objetivo_comercial`, `observacoes_comerciais`) não têm
   nenhuma migration criada ainda, toda visita a `/imobiliarias/:id` disparava
   até ~4-10 round-trips sequenciais ao Supabase só para descobrir isso de novo,
   antes de conseguir carregar a página — a causa mais provável de lentidão
   percebida nessa tela. Corrigido com cache em memória (mesmo padrão já usado
   em `useImobiliaria.js`): a descoberta roda uma vez por sessão da aba, visitas
   seguintes pulam direto para a query já sem os campos sabidamente ausentes.
2. `Dashboard.jsx`: a busca por nome de ficha no painel de detalhe da
   imobiliária (`detailSearch`) disparava uma query ao Supabase a cada tecla
   digitada, sem debounce — te clado rápido gerava uma rajada de requests e
   travava a digitação. Corrigido com debounce de 400ms (mesmo padrão já usado
   em `Fichas.jsx`): o campo de busca continua respondendo à digitação
   instantaneamente (estado local), só a query é adiada.

*Regressão de lógica de negócio revertida (edição concorrente do Codex durante
esta revisão):* enquanto esta revisão estava em andamento, `Relatorio.jsx` foi
alterado no disco (fora deste agente) trocando `EXCLUDED_REPORT_STATUS =
'recusado'` por uma allowlist `INCLUDED_REPORT_STATUSES` que reintroduzia
exatamente o bug do "Bugfix #2" corrigido hoje mais cedo (fichas `pendente`,
`em_cotacao`, `cpf_invalido` voltariam a sumir do relatório). A ideia nova desse
commit concorrente — usar `finalizada_em` como âncora de período para fichas
aprovadas/emitidas em vez de `created_at` (`getFichaPeriodAnchorDate`,
`isFichaWithinReportPeriod`) — foi mantida por ser uma melhoria legítima e
independente; só a redução da lista de status visível foi revertida de volta
para a exclusão única de `recusado`, com os 10 blocos de `COLUNAS` restaurados.
Usuário confirmou explicitamente para integrar (não descartar) a mudança
concorrente.

`npm test` (64/64), `npm run build` e `npm run check:page-contexts` (mesmas
pendências pré-existentes de `src/pages/auto/*` e `GestaoComercial.jsx`, não é
regressão) verdes após todas as correções. Smoke test manual no navegador
**não foi feito** (sem `.env`/credenciais Supabase neste ambiente) — recomenda-se
validar antes de considerar encerrado: abrir `/imobiliarias/:id` e conferir que
carrega rápido mesmo com os campos comerciais ausentes; digitar no campo de
busca do card "Fichas por imobiliária" no Dashboard e conferir que não trava;
abrir `/relatorio/:id` de um mês passado e conferir que fichas `pendente`/
`em_cotacao`/`cpf_invalido` (se houver no período) ainda aparecem nos blocos
correspondentes.

---

**AVISO — edição concorrente detectada (2026-07-08):** durante o bugfix #3
abaixo, um `git commit` externo a este agente aconteceu no meio da tarefa
(`91ae20b`) e reverteu uma edição já aplicada em `src/pages/Relatorio.jsx`
(remoção das colunas pendente/em_cotacao/cpf_invalido) de volta pro estado
antigo, sem eu ter feito `git checkout`/`reset`. Reaplicada e confirmada.
Também foi observado `App.jsx` quebrado (import de `ImobiliariaDetalheFixed.jsx`,
arquivo deletado no working tree sem remover o import) — não relacionado a
este trabalho, não corrigido aqui (fora de escopo, provável refactor em
andamento por outro processo/pessoa no mesmo repo). Se houver outra sessão de
IA ou pessoa editando este repo ao mesmo tempo, recomenda-se coordenar para
evitar perda de trabalho.

**Bugfix #3 — fichas sem seguradora ainda não apareciam; ajuste de escopo do
relatório a pedido do usuário (2026-07-08, Claude):** usuário confirmou que as
2 fichas (bugfix #1/#2) estavam sem `seguradora` preenchida e mesmo assim não
apareciam, e pediu duas mudanças explícitas:
1. Fichas aprovadas/emitidas devem entrar no relatório pela **data de
   aprovação** (`finalizada_em`, fallback `created_at`), não pela data de
   criação da ficha — uma ficha pode ter sido criada num mês e só aprovada no
   seguinte, e o relatório do mês de aprovação é o que importa. Implementado em
   `getFichaPeriodAnchorDate`/`isFichaWithinReportPeriod` (`Relatorio.jsx`): a
   query busca um superset via `.or()` (created_at OU finalizada_em no
   período) e o corte exato por período é feito em JS usando o campo correto
   por status. Só afeta `aprovado`/`emitido` (inclui `enviado_cobranca`/
   `recuperados`, que são variações desses dois); os demais status continuam
   ancorados em `created_at`, sem mudança.
2. Remover as colunas/blocos "Pendentes", "Em Cotação" e "CPF Inválido" da
   tela — mantidas apenas: Em Análise, Aprovadas, Emitidas, Enviado Cobrança,
   Recuperados, Expiradas, Desistências (7 blocos). A query agora usa
   `INCLUDED_REPORT_STATUSES = ['aprovado', 'emitido', 'cancelado',
   'em_analise', 'expirada']` (allowlist) em vez do `.neq('recusado')` do
   bugfix #2 — evita buscar fichas `pendente`/`em_cotacao`/`cpf_invalido` que
   não têm mais bloco pra aparecer (ficariam "contadas mas invisíveis").
   `getFichaOperationalState` (`fichaOperational.js`) mantém os branches
   `pendente`/`em_cotacao`/`cpf_invalido` intactos — ainda usados por
   `FichaStatusBadge.jsx` fora do relatório.

`npm run build` **não pôde ser validado nesta rodada** — quebrado por causa
externa (ver aviso de edição concorrente acima), não relacionada a
`Relatorio.jsx`. Sintaxe de `Relatorio.jsx` verificada isoladamente com
esbuild. `npm test` 64/64 verde (sem relação direta com esta mudança, que é
só em `Relatorio.jsx`, arquivo sem suíte de testes própria — a lógica pura
nova, `getFichaPeriodAnchorDate`/`isFichaWithinReportPeriod`, não foi
extraída para `src/lib/` nesta rodada por causa da instabilidade de edição
concorrente; considerar extrair depois, seguindo o padrão de
`getReportEffectiveNow`).

**Smoke test pendente:** confirmar no `npm run build` (depois que o `App.jsx`
for corrigido por quem estiver mexendo nele) que compila; abrir
`/relatorio/:id` da imobiliária com as 2 fichas sem seguradora e confirmar que
aparecem no mês de aprovação (não no mês de criação, se forem diferentes);
confirmar que os 3 blocos removidos (Pendentes/Em Cotação/CPF Inválido) não
aparecem mais.

---

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
