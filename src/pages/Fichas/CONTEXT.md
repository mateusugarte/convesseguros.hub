# Fichas

## Propósito
Hub central de fichas: visão lista/kanban com filtros por produto, status, imobiliária e mês. Ponto de entrada para assumir, finalizar e editar fichas.

## Componentes usados
- `KanbanFichas` — board kanban com drag-and-drop (@dnd-kit)
- `RelatorioMensal` — aba de relatório mensal
- `ModalAssumir` — assumir ficha pendente
- `ModalFinalizar` — finalizar ficha em cotação
- `ModalFicha` — criar/editar ficha
- `DetalhesFicha` — drawer lateral de detalhes
- `Select` (ui/) — filtros de produto/status
- Recharts: AreaChart, PieChart — mini-gráficos de tendência

## Queries Supabase
- `lib/fichas.js` — fetchFichas, fetchAnosDisponiveis, fetchMesesDisponiveis
- `lib/fichas.js` — fetchContagemProdutos, fetchContagemAbertaOrcamentista, deletarFicha
- `lib/fichas.js` — fetchKPIsVisaoGeral, fetchDistribuicaoStatus, fetchFichasPorDia
- `lib/supabase.js` — realtime subscription para atualizações ao vivo
- Hook: `useImobiliaria` para filtro de imobiliária

## Status de ficha — "Em Aberto" vs "Passadas"
- `STATUS_EM_ABERTO` (`lib/fichas.js`) = `['pendente', 'em_cotacao', 'em_analise']`. Inclui
  `em_analise` deliberadamente: é uma ficha já assumida por um orçamentista mas ainda sem
  decisão de aprovado/recusado — precisa continuar aparecendo como "em aberto" (aba Lista e
  contagens), não como "passada"/finalizada. `STATUS_PASSADOS` só tem status realmente
  terminais (`aprovado`, `recusado`, `emitido`, `cancelado`, `cpf_invalido`, `expirada`).
- `Relatorio.jsx` usa sua própria constante local (`INCLUDED_REPORT_STATUSES`), não estas —
  mudar `STATUS_EM_ABERTO`/`STATUS_PASSADOS` aqui não afeta o Relatório.

## Drag-and-drop no Kanban (mover ficha entre colunas)
- Arrastar para **Recusadas**/**Canceladas**/**Aprovadas** abre um modal de confirmação
  (`ModalConfirmarRecusado`/`ModalConfirmarCancelado`/`ModalConfirmarAprovado`) antes de
  gravar — as outras colunas movem direto (`moverFichaStatus`).
- **Aprovadas**: pede Seguradora e Valor da Parcela (obrigatórios, usados no badge da
  seguradora e no Relatório), "Retorno enviado?" (Sim/Não, grava `retorno_enviado` — o
  mesmo campo que já controla o badge "Retorno enviado/pendente" do card) e "Passado pela
  imobiliária?" (checkbox, grava em `raw_data.passado_pela_imobiliaria`). **Não pede mais
  número de orçamento** (removido a pedido do usuário — quem precisar registrar o número
  do orçamento ainda pode editar `numero_orcamento` direto na ficha).
- Cards que acabaram de ser movidos (por drag ou pelos modais acima) ganham um pulso verde
  breve (`animate-card-new`, reaproveitado do mesmo destaque usado em fichas novas via
  realtime) como confirmação visual de que o move funcionou.
- O overlay de drag usa `KANBAN_DROP_ANIMATION` (`lib/kanbanDnd.js`) para "pousar" suavemente
  na coluna de destino em vez de sumir instantaneamente.
- Arrastar para **Aprovadas** abre o mesmo `ModalFinalizar` usado pela ação **Concluir** do
  card. Não existe mais um segundo formulário de aprovação com regras diferentes.

## Fluxo de conclusão
- `ModalFinalizar` é um fluxo guiado em 2 etapas: primeiro o resultado, depois somente os
  campos necessários para aquele resultado. O rodapé é fixo, portanto a ação final não some
  quando "Aprovado" revela Seguradora, Valor da parcela e os controles de retorno.
- Aprovação exige Seguradora e Valor da parcela. O botão final é explicitamente
  **Concluir aprovação** e grava `valor_parcela` junto com o restante da finalização.
- Ao concluir como Aprovado, Seguradora e Valor da parcela são puxados primeiro da cotação
  aprovada em `raw_data.cotacoes` (respeitando `seguradora_escolhida`), depois do snapshot
  do retorno e, por último, dos campos gerais da ficha. Quando ambos já existem, o modal
  mostra um resumo confirmado e não solicita o preenchimento novamente.
- Fichas do próprio usuário em `em_cotacao` ou `em_analise` podem ser concluídas pelo card,
  pela lista e pela tela de detalhe.
- A camada visual compartilhada dos boards fica em `styles/kanban-ui.css`.

## Verificar fichas (conciliação com a planilha do Forms)
- Botão **Verificar fichas** no header, tanto na visão geral (`/fichas`) quanto na visão de
  produto. Abre `components/ModalVerificarFichas.jsx`.
- **Por que existe:** a entrada é Forms → Apps Script (`onFormSubmit`) → webhook n8n →
  `INSERT fichas`. Quando o Apps Script falha (o caso relatado foi `Error code INTERNAL`),
  a resposta fica só na planilha e nada avisa. O botão compara os dois lados.
- Caminho: `lib/fichasVerificacao.js` → `POST /api/verificar-fichas` → Apps Script Web App
  (`apps-script/verificar-fichas.gs`) + `SELECT` em `fichas`. A comparação em si é pura e
  fica em `lib/fichasConciliacao.js` (testada em `lib/fichasConciliacao.test.mjs`).
- **Regra de matching:** CPF só dígitos; fallback nome normalizado + 8 últimos dígitos do
  celular quando a resposta não tem CPF. Cada ficha só pode satisfazer UMA linha da planilha
  ("claim") — sem isso, duas respostas do mesmo CPF no mês casariam com a mesma ficha e uma
  ausência passaria batida. Ficha do mesmo CPF fora da janela de 2 dias vira **incerta**
  (revisão humana), nunca faltante — evita reimportar e duplicar.
- A importação manda só `{fonte, linha}`; o servidor relê a planilha e reenvia pelo webhook
  oficial do n8n. Assim a normalização de imobiliária continua sendo a do n8n, sem segunda
  implementação, e não existe caminho para gravar ficha com payload adulterado pelo cliente.
- Configuração fica em variáveis de ambiente na Vercel (`FICHAS_SHEET_URL`,
  `FICHAS_SHEET_TOKEN`, `FICHAS_WEBHOOK_URL`, ou `FICHAS_SHEETS` para vários formulários).
  Sem elas, a rota responde 503 com instrução — a tela não quebra.

## Busca no Kanban
- Barra de busca simples acima do card "Recorte de trabalho" (filtro de período/mês),
  visível só na view Kanban (`PageShell` prop `topBar`). Filtra client-side (sem nova query)
  por nome/imobiliária/CPF/CNPJ/seguradora — passada como prop `search` para `KanbanFichas`,
  que filtra a lista já carregada antes de agrupar em colunas (`fichaMatchesSearch`), então
  cada coluna mostra só os cards que batem, sem esconder colunas com 0 resultado.
- Independente do campo de busca da view Lista (`search`/`debouncedSearch`, com debounce de
  400ms e query no servidor) — são dois estados separados por design.

## Status
pronto

## Usuários que utilizam
Todos os orçamentistas (Davi, Dayana, Eduardo, Mateus, Laís, Marcos, Luciano)
