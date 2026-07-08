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
- **`upload_lote`** (`UploadLoteWorkspace`) — sobe até 10 PDFs de uma vez (mesma
  seguradora + imobiliária para o lote inteiro). Extrai os dados de cada PDF, casa cada
  apólice com fichas da imobiliária por nome (qualquer status exceto `recusado`,
  `matchFichasPorNome`/`buscarFichasParaVinculoApolice` em `lib/fichas.js`), destaca
  apólices já cadastradas pelo mesmo número (`buscarApolicePorNumero`, exige confirmação
  explícita do usuário — "Verificar dados" — antes de liberar a seleção daquele item),
  permite escolher a ficha correta por linha e preencher comissão (%) opcional por linha
  (`pct_comissao`/`valor_comissao` via `calculateValorComissao`). Ao registrar as
  selecionadas: cria a apólice (`criarApolice` + `uploadDocumento`, mesmo padrão do Upload
  Direto) e, se houver ficha vinculada, atualiza essa ficha (`vincularApoliceAFicha`:
  status → `emitido`, numero_apolice, seguradora, vigência, valor_parcela).

## Componentes usados
- `SeguradoraBadge` — badge de seguradora no card e nos seletores de seguradora
- `ImobiliariaSelect` — filtro por imobiliária no kanban e no workspace "Iniciar Emissão"
- `Avatar`, `Modal` (`components/ui`) — seletor de imobiliária e modal "Verificar dados"
  do Upload em Lote
- `KanbanSkeleton` — loading state
- @dnd-kit: DndContext, DragOverlay — drag entre colunas do kanban

## Queries Supabase
- `lib/apolices.js` — `fetchApolicesKanban`, `criarApolice`, `moverStatusApolice`,
  `buscarApolicePorNumero`, `buscarApolicePorFichaId`, `vincularApoliceAFicha`,
  `calculateValorComissao`
- `lib/fichas.js` — `fetchFichasAprovadasEmissao` (Iniciar Emissão, só `aprovado`/`emitido`),
  `buscarFichasParaVinculoApolice` + `matchFichasPorNome` (Upload em Lote, qualquer status
  exceto `recusado`)
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
