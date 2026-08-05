# PAGE CONTEXT — Modulo Auto

## Page

- Name: Auto (Dashboard, Cotacoes, Gestao AUTO/Emissoes, Renovacoes, Clientes, Sinistros, Etiquetas)
- Route: `/auto`, `/auto/cotacoes(/:id)(/consulta)`, `/auto/gestao`, `/auto/emissoes(/:id)`, `/auto/renovacoes`, `/auto/renovacoes/puxar`, `/auto/clientes(/:id)`, `/auto/apolices/:id`, `/auto/sinistros`, `/auto/etiquetas`
- Domain: Seguro Auto (cotacao -> emissao -> apolice -> renovacao)

## Purpose

Um CONTEXT.md por diretorio cobre todos os arquivos `.jsx` de `src/pages/auto/`
(ver `scripts/validate-page-contexts.mjs` — a checagem e por pasta, nao por
arquivo). O modulo cobre todo o funil do seguro Auto: cotacao (seguro novo ou
renovacao), acompanhamento no kanban de Gestao AUTO, emissao de apolice,
carteira de renovacoes por vigencia final e etiquetas predefinidas para
classificar cards.

## Components Used

- `PageHeader`, `MetricCard`, `DataCard`, `FilterBar`, `EmptyState` (`src/components/ui`).
- `SeguradoraBadge` / `SeguradoraSelect` — logo e selecao de seguradora.
- `autoShared.js` — helpers puros e testados (`diasParaVencer`, `getRenovacaoUrgencia`,
  `getRenewalQuoteStatus`, formatadores de data/mes, mapas de status/tom).

## Queries / Data Access

- `src/lib/auto.js` concentra todo o acesso a `clientes_auto`, `cotacoes_auto`,
  `emissoes_auto`, `apolices_auto`, `renovacoes_auto`, `auto_tags`.
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
- Data limite da cotacao de renovacao = 7 dias UTEIS antes do vencimento
  (pula sabado/domingo, sem calendario de feriados) — regra unica em
  `isValidIsoDate`/`subtrairDiasUteis` (`src/lib/autoCalc.js`), usada tanto no
  front-end (`AutoRenovacoes.jsx`) quanto no backend (`src/lib/auto.js` e o
  trigger SQL acima). Nao usar dias corridos nem duplicar essa logica.
- O Kanban de `/auto/gestao` usa uma faixa horizontal com rolagem
  (`overflow-x-auto` + colunas de largura fixa) em vez de um grid fixo — as 6
  colunas de `COLUNAS` (`AutoEmissoes.jsx`) sempre ficam na mesma linha, sem
  nenhuma "cair" para baixo isolada.
- O Kanban tem uma coluna virtual extra "Renovações" (renderizada antes de
  `COLUNAS.map`, não faz parte do array `COLUNAS`) — mostra renovações de
  `renovacoes_auto` ainda sem `cotacao_id`, via `getRenovacoesPendentesSemCotacao`
  (`src/lib/auto.js`). Sempre visível, ignora o filtro de período do resto do
  Kanban (decisão deliberada — renovações têm horizonte próprio, não devem
  sumir só porque o filtro virou "Semana"). Sem drag-and-drop: "mover" um card
  dessa coluna significa clicar "Iniciar cotação" (chama `iniciarCotacaoRenovacao`
  já existente; o card desaparece daqui e a emissão real aparece em "Cotações
  pendentes" via o trigger de banco que já existia). "Cancelar" reaproveita
  `cancelarRenovacao`.
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
  organizar as renovações de um mês: puxar do sistema, puxar por planilha e
  criar manualmente — os 3 blocos que antes ficavam num painel inline em
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

## Experiência da Pipeline e calendários (2026-07-29)

- `/auto/gestao` mantém as 7 colunas na mesma faixa horizontal, mas não depende mais de scroll manual: `KANBAN_STAGES` alimenta um mapa clicável, contadores e setas que avançam/retornam uma coluna por vez.
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
- `AutoSinistrosV2` salva checklist e dossie no dispositivo e gera um resumo copiavel. Esses dados ainda nao sao enviados ao Supabase.

## Handoff Checklist

- Read `docs/IA_ORCHESTRATOR.md`
- Read `docs/PROJECT_CONTEXT.md`
- Read `ROADMAP.md`
- Read `docs/CURRENT_TASK.md`
- Read this page's `CONTEXT.md`
- Update `docs/CURRENT_TASK.md` before and after the task
