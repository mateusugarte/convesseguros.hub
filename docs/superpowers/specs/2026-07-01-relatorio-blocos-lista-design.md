# Design — Relatório por Imobiliária: Kanban → Blocos de Lista

> Data: 2026-07-01
> Responsável: Claude
> Status: aprovado para implementação

## 1. Objetivo

Na tela de relatório por imobiliária (`/relatorio/:imobiliariaId`, componente
`src/pages/Relatorio.jsx`, branch `isDetail`), substituir o kanban com
drag-and-drop (`@dnd-kit`) por 5 blocos de lista empilhados verticalmente,
mantendo a lógica operacional já existente (estado da ficha, seleção em massa,
cópia, emissão, cobrança). A visão geral (lista de imobiliárias) **não muda**.

## 2. Escopo

- Arquivo principal: `src/pages/Relatorio.jsx` (só a branch `isDetail`).
- Sem mudança de rotas, sem mudança na visão geral (`isDetail === false`).
- Remove o uso de `DndContext`, `useDroppable`, `useDraggable`, `DragOverlay`,
  `kanbanPointerCollision`, `KANBAN_DRAG_OVERLAY_MODIFIERS` **neste arquivo**.
  `src/lib/kanbanDnd.js` continua existindo — é usado por `KanbanFichas.jsx`,
  `KanbanBoard.jsx`, `ApoicesGestao.jsx` e `comercial/Pipeline.jsx`.

## 3. Decisões de produto (confirmadas com o usuário)

- Os 5 blocos continuam sendo exatamente os 5 estados atuais de
  `getFichaOperationalState` (`src/lib/fichaOperational.js`): **Aprovadas**,
  **Emitidas**, **Enviado Cobrança**, **Recuperados**, **Expiradas** — mesma
  regra de pertencimento a bloco de hoje, só muda a apresentação (lista em vez
  de coluna kanban).
- **Aprovadas**: todas as linhas ficam com destaque vermelho (fundo/borda),
  pois por definição desse bloco a cobrança ainda não foi enviada — é um aviso
  visual de ação pendente, não uma condição por linha. Sem toggle aqui; envio
  em massa continua via seleção + botão "Marcar envio" (mesmo modal
  `ModalConfirmarCobranca` de hoje).
- **Enviado Cobrança**: cada linha ganha 2 toggles:
  - **Cobrança enviada** — biná ligado ao campo `ficha.retorno_enviado`.
    Começa ligado (é por isso que a ficha está nesse bloco). Desligar aplica
    o mesmo patch de `buildAprovadaPatch` usado hoje pelo "mover para
    aprovadas" em massa, mas por linha — a ficha volta para o bloco Aprovadas.
  - **Imobiliária retornou** — novo campo, só informativo, não move a ficha
    de bloco (ver seção 4).
- **Recuperados**: mantém só o toggle **Cobrança enviada** (sem "retornou").
  Este bloco só recebe fichas cuja apólice foi emitida depois de terem sido
  marcadas como cobrança enviada (`raw_data.recovered_after_cobranca`). O
  toggle aparece ligado por padrão ali (deriva de `raw_data.cobranca_started_at`
  já gravado, já que `retorno_enviado` é resetado para `false` no momento da
  emissão) e pode ser reaberto/religado para ajuste manual do histórico — isso
  **não** tira a ficha do bloco, pois o pertencimento a Recuperados depende só
  de `hasFichaEmittedPolicy() && raw_data.recovered_after_cobranca`.
- **Emitidas**: mantém os botões "Abrir ficha" / "Abrir apólice" que já
  existem no card de hoje, agora como linha de lista.
- **Expiradas**: lista somente leitura (sem toggles).
- Seleção múltipla e ações em massa continuam como hoje: checkbox por linha,
  "Todos" (seleciona tudo do bloco), "Copiar" (copia selecionados do bloco),
  `SelectedToolbar` (selecionar todos/inverter/copiar selecionados/mover para
  Aprovadas).

## 4. Novo campo: "Imobiliária retornou"

- Novo dado em `fichas.raw_data`: `imobiliaria_retornou` (boolean) e
  `imobiliaria_retornou_em` (timestamp ISO).
- Editável apenas nas linhas do bloco **Enviado Cobrança**. Ligar grava
  `true` + timestamp atual; desligar limpa os dois campos.
- Puramente informativo: não altera o estado operacional da ficha, não move
  a ficha de bloco, não interfere em `getFichaOperationalState`.
- Persistido via `editarFicha(id, { raw_data: { ...ficha.raw_data,
  imobiliaria_retornou, imobiliaria_retornou_em } }, user?.id)`, mesmo padrão
  usado pelos outros patches do arquivo (atualização otimista + rollback em
  erro, igual ao `handleConfirmarCobranca` atual).

## 5. Novo conteúdo de linha: fotos de orçamentista e emissor

- **Orçamentista**: `fichas.orcamentista_id` → já teria que vir no select como
  `profiles!orcamentista_id(nome, avatar_url)` (padrão já usado em
  `lib/fichas.js` e nos kanbans `KanbanFichas.jsx`/`KanbanBoard.jsx`). Hoje o
  select de `Relatorio.jsx` não traz esse campo — precisa ser adicionado nas
  3 queries de fichas (`createdRowsQuery`, e o `select` de `finalRows`).
- **Emissor**: `apolices.emitido_por` → `profiles!emitido_por(nome, avatar_url)`,
  adicionado ao select de `apolicesRangeRowsQuery` e à query de apólices por
  `ficha_id` (linhas ~1046-1060 e ~1096-1103 do arquivo atual). Só aparece se a
  ficha tiver apólice vinculada (`_apolice` não nulo).
- Renderização com o componente `Avatar` já existente em `src/components/ui`
  (`<Avatar name={...} src={...avatar_url} size="sm" />`), do mesmo jeito que
  `KanbanFichas.jsx` e `DetalhesFicha.jsx` já fazem.
- Na linha da lista: avatar do orçamentista sempre (quando houver
  `orcamentista_id`); avatar do emissor ao lado, só quando `_apolice` existir
  (ou `hasFichaEmittedPolicy`), com tooltip/label do nome em ambos.

## 6. Componentes

- `KanbanColuna` (grid de cards) e `RelatorioCard`/`DraggableRelatorioCard`
  (cards arrastáveis) são substituídos, dentro deste arquivo, por:
  - `BlocoRelatorio` — seção de lista (header com cor/label/contador/"Todos"/
    "Copiar" [+ botão "Marcar envio" só no bloco Enviado Cobrança] e corpo com
    as linhas).
  - `LinhaRelatorio` — linha da lista: checkbox, avatar orçamentista, nome do
    lead, nome da imobiliária, badge de situação, doc, nº apólice, avatar do
    emissor (se houver apólice), toggles conforme o bloco, botões de ação
    (Emitidas).
- `DragOverlay`, `useDraggable`, `useDroppable` são removidos. `DndContext` sai
  do JSX da branch `isDetail`.
- `ModalEmitirApolice` e `ModalConfirmarCobranca` continuam sem alteração de
  comportamento (só o gatilho de abertura muda de "solto no card" para
  "clique no botão da linha").

## 7. Erros e estados

- Mesmo padrão de hoje: atualização otimista da lista local (`setRows`),
  chamada a `editarFicha`, rollback (`setRows(previousRows)`) + toast de erro
  em caso de falha — reaproveitado para o toggle de "cobrança enviada" por
  linha e para o novo toggle "imobiliária retornou".
- Loading e empty state (bloco vazio) seguem os mesmos textos/estilo atuais
  (`kanban-empty` vira o "vazio" da lista).

## 8. Testes

- Não há testes automatizados hoje para `Relatorio.jsx` (`No files found` na
  busca por `*.test.*`). Validação será manual: build (`npm run build`) e
  smoke test visual dos 5 blocos, toggles e seleção múltipla numa imobiliária
  com dados reais.

## 9. Fora de escopo

- Visão geral (`/relatorio`, lista de imobiliárias) e o toggle "Cobrado
  todos" existente lá — não mexem.
- `KanbanFichas.jsx` (página `Fichas.jsx`) e demais kanbans do sistema — não
  mexem, `kanbanDnd.js` continua em uso por eles.
