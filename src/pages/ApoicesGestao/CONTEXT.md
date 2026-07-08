# ApoicesGestao

## Propósito
Kanban de gestão de apólices em emissão: colunas (recebida, proposta_transmitida, emitida,
enviada). Além do kanban (drag-and-drop entre colunas), a página tem 3 workspaces
alternativos, alternados pelo state `workspace`:

- **`iniciar`** (`IniciarEmissaoWorkspace`) — busca uma ficha aprovada/emitida e cria uma
  "solicitação" de apólice vinculada a ela (`ficha_id` preenchido, `status_emissao:
  'recebida'`), sem ler PDF.
- **`upload`** (`UploadDiretoWorkspace`) — sobe 1 PDF por vez, seguradora escolhida
  manualmente (parser não detecta sozinho), extrai dados via `parseApolice` e cria a
  apólice já como `status_emissao: 'emitida'`, sem ficha vinculada.
- **`upload_lote`** (`UploadLoteWorkspace`) — seguradora é única para o lote inteiro
  (travada assim que o 1º PDF é adicionado), mas a **imobiliária é selecionada por linha**
  (cada apólice do lote pode ser de uma imobiliária diferente). Sobe até 10 PDFs de uma
  vez; ao selecionar a imobiliária de uma linha (`ImobiliariaSelect`, mostra o logo da
  imobiliária), o sistema busca fichas dessa imobiliária (qualquer status exceto
  `recusado`) que batam pelo nome do locatário extraído
  (`matchFichasPorNome`/`buscarFichasParaVinculoApolice` em `lib/fichas.js` — todas as
  fichas do sistema são carregadas 1x ao abrir o workspace, sem filtro de imobiliária, e
  filtradas em memória por linha); se houver 2+ fichas candidatas, aparecem como opções
  para o usuário escolher qual é. Cards de duplicidade têm 2 níveis, cada um com botão para
  abrir a apólice existente **em nova aba** (preserva o lote em andamento — nada é perdido
  ao voltar):
  - **Vermelho** — mesmo número de apólice já existe no sistema
    (`buscarApolicePorNumero`); bloqueia a seleção da linha até o usuário confirmar "É uma
    apólice diferente" no modal "Verificar dados".
  - **Laranja** — a ficha vinculada à linha já tem uma apólice registrada, mas com número
    diferente do PDF atual (`buscarApolicePorFichaId` + comparação via
    `normalizeNumeroApolice`); não bloqueia a seleção, só avisa.
  Permite preencher comissão (%) opcional por linha (`pct_comissao`/`valor_comissao` via
  `calculateValorComissao`). Ao registrar as selecionadas: cria a apólice (`criarApolice` +
  `uploadDocumento`, mesmo padrão do Upload Direto, usando a imobiliária daquela linha) e,
  se houver ficha vinculada, atualiza essa ficha (`vincularApoliceAFicha`: status →
  `emitido`, numero_apolice, seguradora, vigência, valor_parcela).

## Componentes usados
- `SeguradoraBadge` — badge de seguradora no card e nos seletores de seguradora
- `ImobiliariaSelect` — seletor de imobiliária com logo: filtro do kanban, workspace
  "Iniciar Emissão" e cada linha do "Upload em Lote"
- `Avatar`, `Modal` (`components/ui`) — seletor de imobiliária do Upload Direto e modal
  "Verificar dados" do Upload em Lote
- `KanbanSkeleton` — loading state
- @dnd-kit: DndContext, DragOverlay — drag entre colunas do kanban

## Queries Supabase
- `lib/apolices.js` — `fetchApolicesKanban`, `criarApolice`, `moverStatusApolice`,
  `buscarApolicePorNumero`, `buscarApolicePorFichaId`, `vincularApoliceAFicha`,
  `calculateValorComissao`
- `lib/apolicesNumero.js` — `normalizeNumeroApolice` (compara números de apólice
  ignorando formatação, usado no card laranja do Upload em Lote)
- `lib/fichas.js` — `fetchFichasAprovadasEmissao` (Iniciar Emissão, só `aprovado`/`emitido`),
  `buscarFichasParaVinculoApolice` (sem filtro de imobiliária no Upload em Lote — busca
  tudo 1x, qualquer status exceto `recusado`) + `matchFichasPorNome`
- `lib/apoliceParser.js` — `parseApolice(seguradora, file)`, usado no Upload Direto e no
  Upload em Lote
- `lib/documentos.js` — `uploadDocumento`
- Hook: `useImobiliaria` (grupos + `getAliases`)
- Colunas do kanban: recebida → proposta_transmitida → emitida → enviada

## Status
pronto (kanban, Iniciar Emissão, Upload Direto); Upload em Lote novo, aguardando smoke
test manual (sem `.env`/Supabase no ambiente de desenvolvimento)

## Usuários que utilizam
Gestores e responsáveis por emissão (Luciano, Mateus, Patricia Dantas)
