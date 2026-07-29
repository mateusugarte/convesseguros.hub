# ApoicesGestao

## Propósito
Kanban de gestão de apólices em emissão: colunas (recebida, proposta_transmitida, emitida,
enviada). Além do kanban (drag-and-drop entre colunas), a página tem 3 workspaces
alternativos, alternados pelo state `workspace`:

- **`iniciar`** (`IniciarEmissaoWorkspace`) — busca uma ficha aprovada/emitida e cria uma
  "solicitação" de apólice vinculada a ela (`ficha_id` preenchido, `status_emissao:
  'recebida'`), sem ler PDF. `onCriado(data)` passa a apólice recém-criada (retorno de
  `criarApolice`) para o pai, que a insere direto na lista local — mesmo padrão dos outros
  2 fluxos (corrigido: antes chamava `onCriado()` sem argumento, o que caía no branch de
  `load()` respeitando os filtros ativos, podendo fazer a apólice "sumir" se o filtro de
  período/imobiliária não batesse; era o mesmo bug já corrigido no Upload em Lote, só que
  faltando corrigir aqui também).
- **`upload`** (`UploadDiretoWorkspace`) — sobe 1 PDF por vez, seguradora escolhida
  manualmente (parser não detecta sozinho), extrai dados via `parseApolice` e cria a
  apólice já como `status_emissao: 'emitida'`, sem ficha vinculada. O anexo do PDF
  (`uploadDocumento`, bucket `documentos`) é best-effort: a apólice já foi criada no banco
  antes desse passo, e qualquer falha ao anexar (erro retornado OU exceção — ex. cota de
  storage do Supabase estourada) só gera um toast de aviso, nunca impede o card de aparecer.
  Botão "Reprocessar PDF" (visível sempre que há um PDF selecionado, inclusive depois de um
  erro de leitura) chama `handleExtrair()` — **precisa ser chamado via `() =>
  handleExtrair()`, nunca `onClick={handleExtrair}` direto**: `handleExtrair(fileOverride =
  null)` trata qualquer primeiro argumento truthy como o arquivo a ler, e o React passa o
  `SyntheticEvent` do clique como primeiro argumento quando a função vai direto no `onClick`
  — isso já foi um bug real (o evento do clique virava "arquivo", `file.arrayBuffer()`
  lançava exceção, e a releitura nunca funcionava).
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
  se houver ficha vinculada, atualiza essa ficha (`vincularApoliceAFicha`: status —
  `emitido`, numero_apolice, seguradora, vigência, valor_parcela). Cada item do lote roda
  dentro do seu próprio try/catch: se `uploadDocumento` ou `vincularApoliceAFicha` falharem
  (erro retornado OU exceção — ex. cota de storage do Supabase estourada), a apólice daquele
  item já foi criada no banco e continua contando como sucesso, só com um aviso no card do
  item; se algo lançar uma exceção inesperada em qualquer ponto do item, ele é marcado com
  erro e o lote **continua** para os próximos itens, em vez de abortar o resto do lote
  silenciosamente.

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
  Upload em Lote. Cada seguradora mapeia para uma **cadeia** de parsers (não mais 1 só);
  "Tokio Marine" tenta o layout mais recente (V3) e cai para os layouts anteriores (V2, V1)
  se não achar `numero_apolice`/nome — a seguradora já mudou o layout do PDF 3 vezes e
  documentos mais antigos (renovações, propostas antigas) ainda podem chegar no formato
  velho. Se um PDF de uma seguradora suportada continuar "não lido", o próximo passo é
  conferir se o layout mudou de novo (comparar contra as regexes de `parseTokioMarineV3`
  etc.) — precisa de uma amostra real do PDF que falhou para ajustar a regex. Validado
  (2026-07-23) contra os 4 PDFs de exemplo reais em `info.docs/apólices.example/` (1 por
  seguradora suportada) — todos extraem `numero_apolice`/nome/vigência/valor corretamente.
  `parseTooSeguros` tinha um bug real de dados encontrado nessa validação: o endereço saía
  contaminado com texto de seções bem distantes no PDF porque as regexes de
  Bairro/Cidade/UF/CEP casavam contra a **primeira** ocorrência de cada rótulo no documento
  inteiro (o PDF da TOO repete "Bairro:"/"Cidade:"/"UF:"/"CEP:" em mais de um bloco — ex.:
  endereço de correspondência do garantido, antes do endereço de risco de verdade) — em vez
  de casar com a ocorrência que vem logo depois de "Local do Risco:". Corrigido com um
  padrão único que casa os 5 campos (endereço, bairro, cidade, UF, CEP) juntos, na sequência
  em que aparecem logo após "Local do Risco:", com fallback para as regexes antigas
  separadas se essa sequência não bater num layout futuro.
- `lib/documentos.js` — `uploadDocumento`
- Hook: `useImobiliaria` (grupos + `getAliases`)
- Colunas do kanban: recebida → proposta_transmitida → emitida → enviada
- Os títulos visuais são "Recebidas", "Transmitidas", "Emitidas" e "Enviadas"; a coluna
  `emitida` não deve ser rotulada como "Proposta Transmitida".
- O visual compartilhado de colunas, cards, estados de drop e responsividade fica em
  `styles/kanban-ui.css`, sem alterar os ids de status nem a persistência do drag-and-drop.

## Status
pronto (kanban, Iniciar Emissão, Upload Direto); Upload em Lote novo, aguardando smoke
test manual (sem `.env`/Supabase no ambiente de desenvolvimento)

## Usuários que utilizam
Gestores e responsáveis por emissão (Luciano, Mateus, Patricia Dantas)
