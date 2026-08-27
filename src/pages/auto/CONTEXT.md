# PAGE CONTEXT — Modulo Auto

## Page

- Name: Auto (Dashboard, Cotacoes, Gestao AUTO/Emissoes, Renovacoes, Clientes, Sinistros, Etiquetas)
- Route: `/auto`, `/auto/cotacoes(/:id)(/consulta)`, `/auto/gestao`, `/auto/emissoes(/:id)`, `/auto/emissoes/planilha`, `/auto/renovacoes`, `/auto/renovacoes/planilha`, `/auto/renovacoes/puxar`, `/auto/clientes(/:id)(/verificacao)`, `/auto/apolices/:id`, `/auto/sinistros`, `/auto/etiquetas`
- Domain: Seguro Auto (cotacao -> emissao -> apolice -> renovacao)

## Purpose

Um CONTEXT.md por diretorio cobre todos os arquivos `.jsx` de `src/pages/auto/`
(ver `scripts/validate-page-contexts.mjs` — a checagem e por pasta, nao por
arquivo). O modulo cobre todo o funil do seguro Auto: cotacao (seguro novo ou
renovacao), acompanhamento no kanban de Gestao AUTO, grade de transmissoes e
emissoes, carteira de renovacoes por vigencia final e etiquetas predefinidas
para classificar cards. As grades de Renovacoes e Emissoes seguem as planilhas
operacionais de agosto/2026, acrescidas do campo Veiculo.

## Components Used

- `PageHeader`, `MetricCard`, `DataCard`, `FilterBar`, `EmptyState` (`src/components/ui`).
- `SeguradoraBadge` / `SeguradoraSelect` — logo e selecao de seguradora.
- `OperationalSpreadsheet` — grade compartilhada com edicao por celula,
  navegacao por teclado, ordenacao, colagem de blocos do Excel, reconhecimento
  de datas brasileiras/seriais do Excel, linha ativa e densidade ajustavel.
- `AutoPolicyImportSheet` — revisao em grade de XLSX/CSV ou dados colados antes
  da subida; cria a apolice e organiza a emissao conforme o STATUS: `EM EMISSAO`
  fica somente em `proposta_transmitida`, enquanto emitida ou status vazio cria
  a apolice final e fica em `apolice_emitida`. Uma apolice vinculada sempre
  prevalece como evidencia de emissao concluida. A entrada visivel usa Transmissao e Vigencia;
  `vigencia_fim` e derivada internamente em +1 ano.
- `autoShared.js` — helpers puros e testados (`diasParaVencer`, `getRenovacaoUrgencia`,
  `getRenewalQuoteStatus`, formatadores de data/mes, mapas de status/tom).

## Queries / Data Access

- `src/lib/auto.js` concentra todo o acesso a `clientes_auto`, `cotacoes_auto`,
  `emissoes_auto`, `apolices_auto`, `renovacoes_auto`, `auto_tags`.
- `getAutoClientVerificationData` carrega a base de clientes, veiculos e
  decisoes humanas; `salvarAutoClientVerification` persiste somente a conclusao
  `mesmo_cliente` ou `clientes_diferentes`. A tela nunca mescla ou exclui
  cadastros automaticamente. A lista de candidatos nao depende da migration 71:
  se a tabela de decisoes ainda nao existir, os pares continuam visiveis e a
  classificacao fica temporariamente no dispositivo, com aviso explicito.
- `getRenovacoesAuto({ periodo, mes })` filtra por `vigencia_fim` considerando
  mes+ano juntos (nunca so o numero do mes) via `inicioFimMes`/`parseMonthRef`.
- `iniciarCotacaoRenovacao(renovacaoId)` e a funcao unica usada tanto pelo botao
  "Cotar" na renovacao quanto pelo fluxo "Nova cotacao > Renovacao" em
  `/auto/cotacoes` — evita duplicar logica e evita cotacao duplicada (reaproveita
  a cotacao vinculada existente se ainda nao estiver perdida).
- `emitirApoliceAuto`/`atualizarEmissaoAutoCompleta`, ao criar a apolice, chamam
  `concluirCotacaoEVincularRenovacao` para marcar `cotacoes_auto.status =
  'convertida'` e a `renovacoes_auto` de origem como `status_renovacao =
  'renovada'` — fecha o ciclo renovacao -> cotacao -> emissao.
- `getEmissoesAuto` faz backfill client-side (`sincronizarEmissoesPendentes`)
  para cotacoes sem `emissoes_auto` correspondente (rede de seguranca; o
  trigger `fn_criar_emissao_auto` ja cria a linha na maioria dos casos).
- Seguro novo usa a RPC `registrar_cotacao_auto_novo`: cliente, cotacao e card
  do Pipeline sao gravados na mesma transacao e `referencia_origem` torna os
  retries idempotentes. O workflow n8n nao faz mais dois requests independentes.
- `criarRenovacoesEmLote` recebe as linhas produzidas por
  `parseRenovacoesPaste`: aceita uma coluna de nomes ou celulas copiadas do
  Excel, ignora duplicatas do mesmo mes e preserva status/comissoes/veiculo.
- `salvarPropostaPlanilhaAuto` cria uma proposta transmitida avulsa ou atualiza
  a emissao ja ligada a uma cotacao sugerida; nunca cria uma segunda emissao
  para o mesmo card selecionado.
- `marcarRenovacaoCotada` cria/reaproveita a cotacao e chama a RPC
  `marcar_renovacao_auto_cotada`, que move renovacao e emissao para Cotacoes
  feitas na mesma transacao. `atualizarEmissaoPlanilhaAuto` faz patches
  estreitos por celula para nao apagar colunas que a grade nao esta editando.
- Etiquetas: `getAutoTags`/`criarAutoTag`/`atualizarAutoTag`/`excluirAutoTag`
  (predefinidas, tabela `auto_tags`) e `atualizarTagsEmissao` (array `tags` em
  `emissoes_auto`, aplicado manualmente pelo usuario nos cards).

## Status

- ready (fluxo completo cotacao -> emissao -> apolice -> renovacao em producao);
  Sinistros possui pre-atendimento, checklist e dossie local, mas ainda nao um
  cadastro persistido no backend (`in_progress`).

## Users

- Equipe comercial/operacional do setor Auto (cotar, mover kanban, emitir,
  acompanhar renovacoes) e admin (gerenciar etiquetas predefinidas).

## Notes

- Migration `supabase/64_auto_renovacoes_negociacao.sql` adiciona contadores de
  contatos/follow-ups/descontos, datas de relacionamento, percentual de
  desconto, notas e `cotada_em` em `renovacoes_auto`; aceita o resultado neutro
  `cotada` em `emissoes_auto` e cria a RPC atomica da passagem para Cotacoes
  feitas. Executar depois da migration 63.
- `/auto/renovacoes` e o resumo mensal somente-leitura, sem a lista duplicada de
  cards;
  o botao `ABRIR RENOVACOES` leva a grade editavel em
  `/auto/renovacoes/planilha`. `/auto/emissoes` e a entrada de Apolices e abre a grade completa em
  `/auto/emissoes/planilha` pelo botao `VER EMISSOES`.
- Na planilha de renovacoes, clicar no segurado abre
  `RenewalInsuredEditor`: o usuario escolhe nome personalizado ou pesquisa um
  cliente existente, persistindo `renovacoes_auto.cliente_id` apenas depois da
  confirmacao. A grade de `/auto/renovacoes/puxar` usa o mesmo editor e
  `suggestRenewalClientByName`; correspondencias unicas por nome aparecem como
  sugestao `Vincular`/`Nao`, nunca como vinculo automatico silencioso.

- Migration `supabase/63_auto_operacao_planilhas_pipeline.sql` e obrigatoria
  antes de publicar este codigo. Ela adiciona os campos das duas grades,
  atualiza os triggers com Veiculo, cria a RPC atomica/idempotente do n8n e
  preserva os status existentes. Depois da migration, reimporte e ative
  `n8n/workflow_conves_recebimento_auto.json`.

- Migration `supabase/55_auto_renovacao_cotacao_tags.sql` adiciona
  `renovacoes_auto.cotacao_id`, sincroniza o CHECK de `emissoes_auto.coluna`
  com os valores reais gravados pelo Kanban (`proposta_transmitida`,
  `apolice_emitida`) e cria `auto_tags` + `emissoes_auto.tags`. Precisa ser
  executada manualmente no SQL Editor do Supabase antes de os recursos de
  vinculo renovacao<->cotacao e etiquetas funcionarem em producao.
- Migration `supabase/58_auto_renovacao_origem_manual_dias_uteis.sql` corrige
  o CHECK `renovacoes_auto_origem_check` (a migration 56 nao conseguiu
  atualiza-lo em producao porque a coluna `origem` ja existia — `ADD COLUMN IF
  NOT EXISTS` pula a clausula inteira, inclusive o CHECK, quando a coluna ja
  existe) e cria a funcao SQL `subtrair_dias_uteis`, usada pelo trigger
  `fn_criar_renovacao_auto`. Precisa ser executada manualmente no SQL Editor
  antes de "Criar renovacao manualmente" funcionar em producao.
- Migration `supabase/65_auto_renovacoes_prazo_seguradoras.sql` adiciona a
  seguradora alternativa opcional, recalcula a carteira existente e protege no
  banco a regra automatica de prazo. Precisa ser executada no SQL Editor.
- Migration `supabase/69_auto_renovacoes_prazo_corrido.sql` substitui o prazo
  anterior pela regra de 10 dias corridos com ajuste de fim de semana e
  recalcula a carteira existente. Precisa ser executada depois da migration 65.
- Migration `supabase/70_auto_apolices_importadas_emitidas.sql` corrige as
  importacoes antigas que ja possuem registro em `apolices_auto`, mas ficaram
  com resultado vazio: move a emissao para `apolice_emitida` e grava resultado
  aprovado. Novas importacoes aplicam essa regra diretamente no front-end.
- Migration `supabase/71_auto_verificacao_clientes.sql` cria a memoria dos pares
  de clientes revisados, com uma decisao unica por par e RLS para usuarios
  autenticados. A deteccao de nomes iguais/semelhantes permanece no front-end;
  sem essa migration a tela usa fallback local e nao bloqueia a comparacao.
- Migration `supabase/66_auto_clientes_cpf_opcional_importacao.sql` remove o
  `NOT NULL` legado de `clientes_auto.cpf`. A subida de apolices nao pede CPF e
  deve conseguir criar o cliente apenas com o nome. O botao da pagina principal
  abre a mesma grade de revisao de `/auto/emissoes/planilha?subir=1`; nao criar
  outro atalho que envie linhas sem confirmar o vinculo do cliente.
- Data limite da cotacao de renovacao = 10 dias CORRIDOS antes do vencimento;
  se o resultado cair no sabado, antecipa para sexta, e se cair no domingo,
  posterga para segunda (sem calendario de feriados) — regra unica em
  `calcularDataLimiteRenovacao` (`src/lib/autoCalc.js`), usada tanto no
  front-end quanto no backend e no trigger da migration 69. Nao duplicar essa
  logica em componentes.
- O Kanban de `/auto/gestao` usa uma faixa horizontal com oito etapas na ordem
  definida por `AUTO_PIPELINE_STAGES`: Renovacoes futuras, Renovacoes para
  enviar hoje/atrasadas, Cotacoes pendentes (somente seguro novo), Cotacoes
  feitas, Negociando, Vistoria/rastreador, Proposta transmitida e Apolice
  emitida. As duas primeiras etapas usam o mes escolhido no seletor proprio da
  Pipeline e mostram somente renovacoes sem calculo concluido (`cotada_em` vazio;
  uma ficha apenas aberta em `cotando` ainda conta). Depois da confirmacao do
  calculo, o negocio sai dessas colunas e segue para Cotacoes feitas; seguro
  novo, renovacao e endosso usam etiquetas distintas.
- Exclusão no Auto é sempre **de grupo**: renovação, cotação, emissão (card do
  Kanban) e apólice formam um único registro lógico e saem juntas. A ordem dos
  DELETEs é montada por `planejarExclusaoGrupoAuto` (`src/lib/autoExclusao.js`,
  função pura e testada) e executada por `deletarCotacaoAuto` /
  `excluirRenovacao` / `deletarEmissaoAuto` (`src/lib/auto.js`). Motivo: as FKs
  entre essas tabelas não têm CASCADE e `renovacoes_auto.cotacao_id` é
  `ON DELETE SET NULL` — apagando só uma ponta, a outra sobrevivia (apagar a
  cotação apenas desvinculava a renovação, que reaparecia na coluna
  "Renovações"; apagar a renovação deixava cotação/emissão órfãs). Ao excluir,
  invalidar também `['auto-renovacoes-pendentes']`, `['auto-emissoes']` e
  `['auto-cotacoes']`, porque o grupo cruza várias queries.
  Duas travas propositais: renovação cuja cotação já virou apólice emitida não
  é excluída (mensagem pede para excluir a apólice antes) e grupo com sinistro
  registrado é bloqueado com mensagem legível em vez de erro cru de FK.
- `/auto/renovacoes/puxar` (`AutoRenovacoesPuxar.jsx`) é a área dedicada para
  organizar as renovações de um mês: colar varias linhas, puxar do sistema,
  puxar por planilha e criar manualmente — os blocos que antes ficavam inline em
  `/auto/renovacoes` (removido de lá). Mostra uma lista "Renovações de \<mês\>"
  que se atualiza a cada ação, para o usuário ver o que já foi adicionado sem
  precisar voltar para `/auto/renovacoes`. O botão "Puxar renovações" nessa
  outra tela e o banner do Dashboard navegam direto para cá.
- Destaque de urgencia das renovacoes segue hierarquia definida em
  `getRenovacaoUrgencia`/`RENOVACAO_URGENCIA_META` (`autoShared.js`): concluida
  > vencida > urgente (<=10 dias) > mes atual/proximo mes.
- "Etiquetas automaticas" estruturais (Seguro novo/Renovacao, status do
  card/coluna, urgencia) sao sempre derivadas em runtime a partir dos campos
  ja existentes — nunca persistidas, para nao haver risco de ficarem
  dessincronizadas. Só as etiquetas manuais (escolhidas pelo usuario a partir
  de `auto_tags`) sao persistidas em `emissoes_auto.tags`.

## Experiência da Pipeline e calendários (2026-07-29, atualizada em 2026-08-20)

- `/auto/gestao` mantém as 8 colunas na mesma faixa horizontal e não depende de scroll manual: `KANBAN_STAGES` alimenta um mapa clicável, contadores e setas que avançam/retornam uma coluna por vez.
- O contêiner do quadro acompanha a coluna visível, suporta `ArrowLeft`/`ArrowRight` pelo teclado e mantém o drag-and-drop HTML existente sem mudar os fluxos especiais de `cotacao_feita`, `proposta_transmitida` e `apolice_emitida`.
- `auto-ui.css` concentra o novo acabamento de toolbar, etapas, setas laterais, colunas, cartões, estados vazios, densidades, tema escuro e breakpoints móveis.
- O filtro personalizado da Pipeline usa `DatePicker`; o componente compartilhado recebeu rótulos completos dos dias, estados semânticos, atalhos e acessibilidade. Inputs `date`/`month` dentro de `.auto-page` também seguem a identidade visual AUTO.

## Modo comando e detalhes acionáveis (2026-08-04)

- A Pipeline possui busca transversal em todas as colunas por cliente, CPF, telefone, veículo, placa, seguradora, responsável e número de apólice. A busca filtra cards, renovações e contadores sem alterar a consulta ou a regra de período.
- `AutoCotacaoDetalhe` usa o design Auto V2 e organiza os dados em Resumo, Segurado, Veículo e risco, Seguradoras e Operação. Campos continuam com salvamento inline; status, contato e cópia de CPF/placa viraram ações diretas.
- `AutoApoliceDetalheV2` protege alterações pendentes ao fechar a página, aceita `Ctrl/Cmd + S`, mostra erro de salvamento e oferece ações rápidas para contato e cópia de apólice/placa.
- O acabamento complementar está em `auto-ui.css`, mantendo dark mode, responsividade e redução de movimento.
- `AutoCotacoes` usa `?modo=lista|novo|renovacao|endosso` como estado navegável, ainda aceita `?tab=` por compatibilidade e salva busca/filtros no `localStorage` (`auto-cotacoes-workspace-filters-v1`).
- `AutoClientesV2` salva filtros em `auto-clientes-workspace-filters-v1`, aplica debounce de 280 ms na busca remota e permite recorte por cliente ativo/inativo.
- `AutoClienteDetalheV2` concentra ações de relacionamento (telefone, e-mail, CPF, apólices) e diferencia os atalhos de nova cotação e renovação.
- `AutoPdfAutomation` apresenta upload, extracao, revisao e aplicacao dos PDFs sem bloquear a edicao manual. Orcamentos entram no comparativo e no detalhe da cotacao; propostas/apolices entram nos formularios de emissao. Imagens continuam como anexo, sem extracao.
- `autoPdfParser.js` detecta a seguradora e normaliza dados comuns do segurado, condutor, veiculo, vigencia, premios, comissao e pagamento. A configuracao/mapeamento por seguradora e tratada separadamente pela tarefa ativa registrada em `docs/CURRENT_TASK.md`.
- `AutoRenovacoes` pesquisa simultaneamente cliente, contato, apolice, veiculo, placa e seguradora; periodo e filtro de acompanhamento ficam no `localStorage`.
- `/auto/clientes` oferece o botao `Verificacao de clientes`. A rota
  `/auto/clientes/verificacao` compara nomes normalizados iguais ou semelhantes,
  mostra CPF, contato e veiculos lado a lado e exige decisao humana. Confirmar
  que e a mesma pessoa registra o fato, mas nao realiza mesclagem destrutiva.
- Nas planilhas de renovacoes, `vigencia_fim` e exibida explicitamente como
  "Data de vencimento" e aceita colagem. Na entrada de apolices, as primeiras
  colunas seguem a planilha de comissao (Transmissao ate Status), a comissao e
  calculada, CPF/data de emissao/vencimento nao aparecem e WhatsApp e a ultima
  coluna. A entrada sempre passa por revisao antes de persistir.
- Arrastar uma cotacao para Proposta transmitida abre o mesmo conjunto de
  campos operacionais da planilha de subida. Numero da apolice e veiculo sao
  opcionais nessa etapa; a apolice final so e exigida em Apolice emitida.
- A Dashboard contabiliza propostas transmitidas e apolices emitidas pela data
  de transmissao, separando Seguro novo, Renovacao e Endosso no resumo e no
  grafico mensal.
- `AutoSinistrosV2` salva checklist e dossie no dispositivo e gera um resumo copiavel. Esses dados ainda nao sao enviados ao Supabase.

## Orcamento Comparativo (2026-08-24, design do workspace entregue)

- O nucleo vive em `src/lib/orcamentoComparativo.js` (dominio puro) e
  `src/lib/orcamentoComparativoHtml.js` (template do PDF). A tela e
  `AutoQuoteComparison`: dois slots de upload, revisao lado a lado e estados
  criticos. **Desde 26/08 os layouts Porto/Azul/Itau/Mitsui, Bradesco, HDI,
  Allianz, Darwin, Pier, Suhai, Yelum e Tokio sao identificados e lidos por
  parser fixo.** Nada persiste e o PDF final ainda nao e gerado.
  Spec em `documentos_automacao/specorcamentocomparativoseguros.md`.
- `src/lib/orcamentoLeitura.js` e a ponte arquivo -> parser: e o unico modulo do
  comparativo que encosta em `pdfjs` e no `File` do navegador (import dinamico,
  para o pdfjs nao entrar no bundle de quem nao envia PDF). Os parsers seguem
  puros e testados em `node --test`. `camposDaCotacao` traduz a cotacao extraida
  para as chaves de `REVIEW_FIELDS` — ha teste travando esse espelhamento.
- **Cotacao com mais de uma oferta/produto: a tela PERGUNTA, nunca escolhe.**
  Allianz oferece seis pacotes, HDI duas modalidades, Pier dois produtos e
  Suhai quatro produtos. O parser so le preco e coberturas depois da escolha.
  O parser devolve `cotacao.escolha_pendente` e `AutoOrcamentoOfertas` mostra as
  opcoes com o preco de cada uma. Enquanto ninguem escolhe, os campos que
  dependem da oferta ficam VAZIOS na revisao: preencher com "A cotação não
  informa." seria mentira (ela informa, uma vez por oferta) e chegaria ao cliente
  como se a seguradora nao cobrisse. Trocar a oferta depois reprocessa a cotacao
  sem reabrir o arquivo.
- **Nao confundir com `autoPdfParser.js`.** O parser existente extrai campos
  ESCALARES de uma cotacao para preencher o formulario de emissao. O comparativo
  precisa de estrutura COMPARAVEL entre duas seguradoras — coberturas
  classificadas em 7 categorias fixas, com incluido x nao incluido. Sao dois
  problemas diferentes sobre o mesmo PDF; misturar os dois transformaria
  `CAMPOS_COTACAO` numa lista impossivel de manter.
- As 7 categorias (`CATEGORIAS_COBERTURA`) tem ordem, rotulo e icone FIXOS e
  iguais nos dois cards — e o que permite ler lado a lado sem comparar textos de
  marketing escritos de formas diferentes por cada cia. Seguradora nova deve
  SO acrescentar sinonimos em `DICIONARIO_COBERTURAS`, nunca criar categoria.
- A logo do card vem de `seguradoras.logo_url` (cadastro em Configuracoes),
  nunca recortada do PDF da cotacao. Sem logo, cai para o nome em serifada.
- A cor da faixa e identidade da SEGURADORA, nao do papel ("atual" x "outra"):
  inverter a ordem nao troca as cores. Enquanto `seguradoras.cor_destaque`
  (migration 67) nao existir, `CORES_SEGURADORA_PADRAO` responde por nome.
- **Indenizacao integral e o campo critico de exatidao.** Tokio trata como
  adicional separado; Porto embute 100% da FIPE na compreensiva. `textoColisao`
  sempre nomeia a cobertura literalmente, com a mesma frase nos dois lados, e
  `incluida: null` BLOQUEIA a geracao em `validarCotacao`. Nao deduzir cobertura
  a favor da seguradora — a spec marca isso como o erro mais grave possivel.
- A pagina do PDF usa `min-height`, nunca `height` + `overflow:hidden`: cotacao
  com muitas coberturas transborda para a pagina 2, jamais e cortada em silencio.
- Migration `supabase/67_auto_orcamento_comparativo.sql` (pendente) adiciona
  `seguradoras.cor_destaque`, cria `seguradora_condicoes_gerais` e
  `auto_orcamentos` e a RPC `proximo_numero_orcamento_auto` — o sequencial
  CV-AAAA-NNNN e alocado no banco, nao no front, senao dois corretores gerando
  ao mesmo tempo produzem o mesmo numero.
- `AutoQuoteSnapshot` e a leitura visual comum usada no resumo da cotacao e no
  primeiro clique da Pipeline; nenhuma query ou regra de dados foi alterada.

## Acompanhamento operacional AUTO (2026-08-26)

- `AutoWorkflowPanel` fica na aba Operacao da cotacao e concentra confirmacao
  de andamento, proximo passo/data, observacoes, etiquetas, registro de contato
  ou follow-up, historico e lembretes.
- Cotacao pendente sem atualizacao volta para a Central com a pergunta "foi
  feita?". A etapa `cotacao_feita` pergunta se houve continuidade ou se segue
  em andamento; responder atualiza o card e reinicia o prazo de acompanhamento.
- `autoPending.js` inclui proximos passos vencidos e `auto_lembretes`: com aviso
  de 1 dia, o item aparece na vespera, no dia e permanece se atrasar.
- Migration obrigatoria: `supabase/68_auto_acompanhamento_operacional.sql` cria
  `auto_interacoes`, `auto_lembretes` e os campos operacionais nas cotacoes,
  emissoes e clientes. Sem ela, o painel mostra a orientacao de instalacao.
- A Central e a lista de cotacoes consultam tambem `clientes_auto`: se um
  registro legado tem `cliente_id` e nome no cadastro, mas `nome_cliente` vazio
  na cotacao, a interface exibe o nome vinculado em vez de "sem nome".

## Handoff Checklist

- Read `docs/IA_ORCHESTRATOR.md`
- Read `docs/PROJECT_CONTEXT.md`
- Read `ROADMAP.md`
- Read `docs/CURRENT_TASK.md`
- Read this page's `CONTEXT.md`
- Update `docs/CURRENT_TASK.md` before and after the task
