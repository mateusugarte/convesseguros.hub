# Design — Importação histórica de apólices Auto + redesign de Clientes Auto

> Data: 2026-07-17
> Responsável: Claude
> Status: aprovado para implementação

## 1. Objetivo

Duas frentes independentes no módulo Auto:

- **(A) Importação histórica**: trazer para `apolices_auto` as renovações
  confirmadas do arquivo `02 RENOVAÇÕES AUTO.xlsx` (2020–2026), com nomes
  limpos e sem inventar dados que a planilha não tem (veículo, CPF).
- **(B) Página de Clientes Auto**: corrigir o perfil do cliente (não mostra
  todas as apólices), adicionar "cliente desde", etiquetas de status
  (ativo/inativo/pré-sistema) e redesenhar a listagem para aguentar o volume
  que a importação vai trazer (~2.400+ clientes distintos).

Este documento cobre as duas. A ordem de implementação recomendada é A antes
de B (a etiqueta "pré-sistema" de B depende da coluna nova criada em A), mas
o bug do perfil (parte de B) não depende de A e pode ser feito em paralelo.

## 2. Escopo

- Banco: 1 coluna nova em `apolices_auto` (ver seção 3).
- `src/lib/auto.js`: nova função de importação em lote (server-side, script
  ou tela — ver seção 3.5) + correção de `getClienteAutoDetalhe`.
- `src/pages/auto/AutoClientes.jsx`: redesenho completo da listagem.
- `src/pages/auto/AutoClienteDetalhe.jsx`: "cliente desde" + etiquetas.
- Sem mudança em `cotacoes_auto`, `emissoes_auto`, `renovacoes_auto`,
  `clientes_auto` (schema).
- Sem mudança de RLS (a nova coluna é `boolean DEFAULT false`, coberta pelas
  policies já existentes de `apolices_auto`).

## 3. Parte A — Importação histórica

### 3.1. Fonte

Arquivo `02 RENOVAÇÕES AUTO.xlsx` (fornecido pelo usuário, fora do repo),
único arquivo usado — não `01 COMISSÃO - AUTO.xlsx` (decisão explícita do
usuário, mesmo este último tendo mais colunas). 70 abas, uma por mês,
OUTUBRO/2020 a JULHO/2026, em dois layouts ao longo do tempo:

- **2020–2021 e parte de 2022–2023**: dois blocos lado a lado por aba
  (quinzena 1 / quinzena 2), cabeçalhos `QTD/ITEM, DATA, CIA, SEGURADO,
  COTADO/COTAÇÃO, PRAZO`.
- **2022 em diante (predominante)**: um bloco único, cabeçalhos `DATA, CIA,
  SEGURADO, STATUS, LIMITE, COMISSÃO, COM PASSADA`.

O parser já existente (`rowsFromAutoSheet`/`parseAutoPlanilhaFile` em
`src/pages/auto/AutoEmissoes.jsx`) já lida com ambos os layouts multi-bloco
via detecção dinâmica de colunas "DATA" — é reaproveitado, não recriado.

### 3.2. Filtro de linhas (o que vira apólice)

Confirmado com o usuário: **só linhas com preenchimento de cor verde**
(`fgColor.rgb` igual a `00B050` ou `92D050`) na célula da coluna SEGURADO.
É o sinal mais confiável — mais confiável que o texto da coluna STATUS, que é
nota livre e inconsistente (nomes de atendente, "morreu", "sem retorno" etc.
misturados com status reais). Vermelho, amarelo e sem-cor ficam de fora desta
importação. Volume esperado: ~2.449 linhas de ~2.926 candidatas.

A leitura de cor exige `XLSX.readFile(..., { cellStyles: true })` — o parser
atual não lê estilo, só valor. Precisa de um novo utilitário de importação
(não dá para rodar via `<input type="file">` do navegador com o parser atual
sem estender `parseAutoPlanilhaFile` para também extrair a cor da célula).

### 3.3. Limpeza de nome (generalizada)

Regra nova, substitui `cleanNomeSegurado` atual:

```
nome = texto bruto, colapsar espaços, trim
cortar tudo a partir do primeiro "-" (com ou sem espaço ao redor)
trim de novo
```

Cobre 100% dos ~109 casos com traço encontrados na planilha real: anotações
de atendente ("- FABI", "- PATY", "- CAP"), modelo/veículo ("- COROLLA",
"- POLO"), placas/frota ("- 24.250", "- 975 - 143021"), tipo de produto
("- RESIDENCIAL", "- EMPRESA"). Não há nenhum caso na planilha de nome com
hífen legítimo (sobrenome composto) — a regra pode ser tão simples quanto
"cortar no primeiro traço" sem lista de exceções.

### 3.4. Novo campo: `apolices_auto.origem_pre_sistema`

```sql
ALTER TABLE apolices_auto
  ADD COLUMN IF NOT EXISTS origem_pre_sistema boolean NOT NULL DEFAULT false;
```

- `true` **somente** nas apólices criadas por esta importação.
- Não é um atributo de cliente, é por apólice — um mesmo cliente pode ter
  apólices `true` (histórico importado) e `false` (feitas pelo fluxo normal
  do sistema) ao mesmo tempo, e ambas continuam aparecendo no perfil dele.
- Não há lógica de "desaparecer depois" — é permanente, conforme decisão do
  usuário ("a etiqueta aparece em toda apólice que for subida agora").
- Reflete na UI como badge laranja (`bg-status-warning/10 text-status-warning
  border-status-warning/15`, mesmo tom já usado em `Relatorio.jsx` para
  "Apólice sem ficha vinculada") em qualquer card/linha de apólice que tenha
  essa flag, tanto na listagem de clientes quanto no perfil do cliente.
- RLS: nenhuma policy nova necessária — políticas de `apolices_auto` já
  cobrem `SELECT`/`INSERT`/`UPDATE` por coluna, não por valor de coluna.

### 3.5. Mapeamento de campos por linha importada

| Campo planilha | Campo `apolices_auto` | Observação |
|---|---|---|
| SEGURADO (limpo) | `nome_cliente` | regra da seção 3.3 |
| CIA | `seguradora` | texto limpo, sem normalização de nome de seguradora (mesmo comportamento do importador atual) |
| DATA (serial Excel) | `vigencia_inicio` | ver nota abaixo |
| DATA + 1 ano | `vigencia_fim` | `vigencia_fim` é `NOT NULL` no schema e a planilha não tem uma data de fim real; assume-se termo anual (padrão do produto Auto) só para satisfazer a coluna, não é uma vigência real conhecida |
| COMISSÃO | `pct_comissao` | percentual (`20%` → `0.2`) |
| COM PASSADA | `renovacao_comissao_ano_anterior` | quando presente |
| — | `eh_renovacao` | sempre `true` (planilha é 100% renovações, sem coluna de tipo novo/renovação) |
| — | `cliente_id`, `emissao_id` | sempre `null` (sem vínculo com fluxo normal) |
| — | `origem_pre_sistema` | sempre `true` |
| — | `tipo_producao` | `'individual'` (mesmo default do importador atual) |
| — | CPF, celular, placa, modelo de veículo | não preenchidos — a planilha não tem essas colunas na maioria das linhas, e mesmo quando tem (raro, layout antigo) o usuário pediu para não usar veículo por enquanto |

Nota sobre a semântica de "DATA": na planilha essa coluna é quando a
renovação foi processada/registrada, não uma vigência de apólice no sentido
estrito. É a única data disponível por linha, então é usada tanto para
`vigencia_inicio` (com `+1 ano` sintético em `vigencia_fim`) quanto como
âncora de "cliente desde" na parte B.

### 3.6. Deduplicação

Reaproveita a lógica já existente em `importarApolicesAutoPlanilha`
(`nome_cliente` + `vigencia_fim` [+ `seguradora` quando presente]), com um
ajuste: a comparação passa a normalizar (minúsculo, sem acento, espaços
colapsados) antes de comparar, para não duplicar quando o nome já existir no
banco com capitalização/espaçamento levemente diferente. Se rodar a
importação duas vezes, a segunda vira update, não duplicata.

### 3.7. Onde roda

Novo botão "Importar histórico (planilha renovações)" na mesma área de
Emissões (`AutoEmissoes.jsx`) que já tem "Importar planilha" — reaproveita a
UI de upload e o card de resumo (`importResumo`) já existentes, mas aponta
para a nova função de importação (que lê cor de célula e aplica a limpeza de
nome nova) em vez da atual. O botão atual de "Importar planilha" **não muda**
— continua servindo o fluxo mensal normal (planilha de um mês, sem filtro de
cor). O botão novo é para esta migração pontual do histórico.

## 4. Parte B — Página de Clientes Auto

### 4.1. Bug: perfil não mostra todas as apólices

**Causa raiz**: `getClienteAutoDetalhe` (`src/lib/auto.js`) escolhe **um único**
identificador de escopo — `cliente_id` OU `cpf_cliente` OU `id` (quando a URL
já é um UUID) OU `nome_cliente`, nessa ordem de prioridade, o primeiro que
existir — e filtra as 4 tabelas relacionadas só por ele
(`scopeByRef`/`scoped*Query`, linhas ~1248–1261). Um cliente cujas apólices
têm identificadores inconsistentes entre si (ex.: uma apólice tem
`cliente_id` preenchido porque veio do fluxo cotação→emissão, outra só tem
`nome_cliente` porque veio de upload direto de PDF ou desta importação) tem
suas apólices "órfãs" da busca — só aparecem as que batem com o identificador
que a página escolheu para aquele clique específico.

**Correção**: `scopeByRef` passa a combinar todos os identificadores
conhecidos com OR, em vez de escolher um só:

```js
function scopeByRef(query, { allowNome = false } = {}) {
  const filters = []
  if (clientId) filters.push(`cliente_id.eq.${clientId}`)
  if (cpf) filters.push(`cpf_cliente.eq.${cpf}`)
  if (refIsUuid) filters.push(`id.eq.${ref}`)
  if (allowNome && nomeRef) filters.push(`nome_cliente.eq.${nomeRef}`)
  if (filters.length === 0) return null
  return query.or(filters.join(','))
}
```

`renovacoes_auto` continua sem suporte a nome (não tem essa coluna) — usa só
`cliente_id`/`id`, como hoje.

### 4.2. "Cliente desde"

No perfil (`AutoClienteDetalhe.jsx`), novo campo calculado a partir de
`Math.min(...apolices.map(a => a.vigencia_inicio))` (já ordenado
por vigência decrescente na query existente — pega o último item da lista em
vez do primeiro). Exibido como "Cliente desde MM/AAAA". Se não houver
`vigencia_inicio` em nenhuma apólice, cai para `created_at` da mais antiga.

### 4.3. Etiquetas

Calculadas em memória a partir dos dados já carregados, sem coluna nova:

- **Ativo** (verde, `status-success`): alguma apólice do cliente tem
  `vigencia_fim >= hoje`.
- **Inativo** (cinza/neutro, `dark-muted`): nenhuma apólice ativa (todas
  vencidas). Só se aplica quando o cliente tem pelo menos 1 apólice — sem
  apólice nenhuma não é "inativo", é o `EmptyState` já existente.
- **Emitida antes do sistema** (laranja, `status-warning`): por apólice
  (não por cliente), em qualquer apólice com `origem_pre_sistema = true` —
  aparece junto de cada linha de apólice no card do cliente e no perfil, não
  como badge única do cliente.

Um cliente pode ter Ativo/Inativo **e** apólices com a etiqueta laranja ao
mesmo tempo — são independentes (seção 3.4).

### 4.4. Redesenho de `/auto/clientes`

Layout em cards por cliente (nome + CPF quando houver + contagem de apólices
+ etiquetas), inspirado no padrão de card usado para imobiliárias, com:

- **Busca** em destaque no topo (nome, CPF, seguradora) — já existe, mantém.
- **Filtro de letra inicial** (A–Z) — novo, filtra clientes cujo nome começa
  com a letra selecionada.
- **Ordenação**: alfabética (padrão), mês/período de entrada, quantidade de
  apólices, cliente mais antigo — seletor novo na barra de filtros.
- **Paginação de 50 clientes por página** — novo. Necessário porque volume
  passa de ~2.400 clientes distintos após a importação.
- Como o volume não cabe mais em uma única query client-side (o padrão atual
  de `getAutoCarteiraClientes` busca todas as apólices e agrupa em memória),
  a busca por nome/CPF/seguradora, a letra inicial e a ordenação passam a ser
  aplicadas com paginação real: a agregação por cliente continua sendo feita
  no cliente (Supabase não tem `GROUP BY` fácil via client SDK para esse
  formato), mas a paginação é sobre a lista de clientes já agrupada e
  ordenada, carregada uma vez por sessão de filtro (não por página — evita
  1 query por página, mas evita carregar/re-renderizar 2.400 cards de uma vez
  na árvore React). Se a performance não for suficiente após medir, uma RPC
  dedicada de agregação fica como próximo passo (fora deste escopo).

## 5. Fora de escopo

- Vínculo de veículo às apólices importadas (usuário confirmou: sem veículo
  por enquanto).
- Endosso: não há dado de endosso na planilha `02 RENOVAÇÕES AUTO.xlsx`
  (confirmado por busca no arquivo inteiro) — nada a importar aqui. O
  sistema já aceita apólice normalmente por outros fluxos; nenhuma mudança
  de schema/UI para endosso está incluída neste trabalho.
- Importação de `01 COMISSÃO - AUTO.xlsx` (decisão explícita do usuário de
  não usar esse arquivo agora).
- RPC de agregação dedicada para a listagem de clientes (só entra se a
  paginação em memória descrita em 4.4 não for suficiente na prática).

## 6. Riscos conhecidos

- `vigencia_fim` sintético (`vigencia_inicio + 1 ano`) não é uma vigência
  real — qualquer relatório/métrica que dependa de vigência real de apólices
  importadas (ex.: "vencendo este mês") vai ler esse valor como se fosse
  real. Aceito pelo usuário como necessário dado que a planilha não tem a
  informação real.
- Nomes duplicados legítimos (duas pessoas reais com o mesmo nome, sem CPF
  para diferenciar) vão agrupar como um cliente só, tanto na importação
  quanto no agrupamento por nome já existente em `AutoClientes.jsx` — mesma
  limitação que já existe hoje no sistema para clientes sem CPF.
- ~2.449 inserções em lote é uma operação de escrita grande — a função de
  importação deve rodar em lotes (chunks) para não estourar timeout/payload
  do Supabase, com relatório de progresso e capacidade de retomar/pular
  erros por linha sem abortar o lote inteiro.
