# Renovações Auto — lembrete de virada de mês, puxar renovações, arrastar para gestão, upload XLS e cotação de endosso

**Data:** 2026-07-24
**Módulo:** Auto (`src/pages/auto/*`, `src/lib/auto.js`)
**Status:** aguardando aprovação do usuário

## Contexto

O módulo Auto já tem um funil funcionando: cotação → Kanban de Gestão (`emissoes_auto`) → emissão de apólice (`apolices_auto`) → renovação (`renovacoes_auto`, criada automaticamente por trigger quando uma apólice é inserida, agendada para a data de `vigencia_fim`). O pedido desta rodada adiciona 4 frentes em cima dessa base:

1. Lembrete de virada de mês + ação explícita "puxar renovações" (banco + planilha).
2. Área "Renovações do mês" com lista detalhada e o botão "Fazer Cotação", que leva o card para o Kanban de Gestão; ao arrastar esse card para "Proposta Transmitida", um formulário reduzido pede só o que ainda não se sabe e calcula o resto.
3. Upload da planilha "01 COMISSÃO - AUTO.xlsx" (aba do mês) como fonte alternativa para puxar renovações.
4. Cotação de Endosso — novo tipo de cotação, reaproveitando o mesmo Kanban.

Todas as migrations ficam num arquivo novo (`supabase/56_auto_renovacoes_endosso.sql`), a ser rodado manualmente no SQL Editor do Supabase pelo usuário — mesmo padrão já usado no projeto. Nenhuma RLS nova é criada (as tabelas de Auto hoje usam `FOR ALL TO authenticated USING (true)`, igual às demais); isso é mantido, não é escopo desta tarefa mexer em RLS.

## Achado importante: fórmula de comissão está incorreta hoje

Conferindo a planilha real (`01 COMISSÃO - AUTO.xlsx`, aba `JULHO 2026`), a fórmula real usada pela corretora é:

```
valor_comissao = premio_liquido × (%comissao / 100) × 0.9
```

(ex.: prêmio 917,74 × 20% = 183,548 → menos 10% = **165,19**, que é exatamente o valor gravado na planilha). Isso vale igual para linhas `RENOVAÇÃO`, `NOVO` e `ENDOSSO` — não é regra específica de renovação.

Hoje o código tem **dois pontos calculando de formas diferentes e ambas erradas**:
- `AutoEmissoes.jsx` (`handleEmitir`, o formulário que abre ao arrastar um card): `valorComissao = premioLiquido * pctComissao` — trata `pct_comissao` como fração (0,2), sem o fator 0,9.
- `FormSeguradora`/`ModalResultado` (registrar resultado da cotação): `valorComissao = premio * pct / 100` — trata `pct_comissao` como percentual inteiro (20), também sem o fator 0,9.

Ou seja, hoje o mesmo campo `pct_comissao` é interpretado de duas formas diferentes dependendo da tela, e nenhuma aplica os 10%. Conforme confirmado, a correção é **global para o módulo Auto** (não mexe em Fiança/outros produtos): padronizar `pct_comissao` como percentual inteiro (usuário digita "20" para 20%) em todo o módulo Auto, e a fórmula acima em todo lugar que calcula `valor_comissao`.

## Modelo de dados — novidades

Tudo em `supabase/56_auto_renovacoes_endosso.sql`:

```sql
-- 1. Estado do lembrete de virada de mês (um registro por mês-alvo)
CREATE TABLE IF NOT EXISTS auto_renovacao_mes_status (
  mes_ref        text PRIMARY KEY, -- 'YYYY-MM', mês que está sendo organizado
  concluido_em   timestamptz,
  concluido_por  uuid REFERENCES profiles(id),
  created_at     timestamptz DEFAULT now()
);

-- 2. renovacoes_auto: novos campos
ALTER TABLE renovacoes_auto
  ADD COLUMN IF NOT EXISTS origem text DEFAULT 'sistema' CHECK (origem IN ('sistema','xls')),
  ADD COLUMN IF NOT EXISTS data_limite_envio date,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text,
  ADD COLUMN IF NOT EXISTS nome_segurado_anterior text,
  ADD COLUMN IF NOT EXISTS numero_apolice_anterior text,
  ADD COLUMN IF NOT EXISTS premio_liquido_anterior numeric(14,2),
  ADD COLUMN IF NOT EXISTS pct_comissao_anterior numeric(6,4);
-- unicidade por apolice (evita duplicar puxando 2x); nulls (linhas de XLS sem apolice) não colidem
CREATE UNIQUE INDEX IF NOT EXISTS renovacoes_auto_apolice_id_uidx
  ON renovacoes_auto(apolice_id) WHERE apolice_id IS NOT NULL;

-- 3. cotacoes_auto / emissoes_auto: novo tipo "endosso"
ALTER TABLE cotacoes_auto DROP CONSTRAINT IF EXISTS cotacoes_auto_tipo_check;
ALTER TABLE cotacoes_auto ADD CONSTRAINT cotacoes_auto_tipo_check
  CHECK (tipo IN ('novo','renovacao','endosso'));
ALTER TABLE emissoes_auto DROP CONSTRAINT IF EXISTS emissoes_auto_tipo_check;
ALTER TABLE emissoes_auto ADD CONSTRAINT emissoes_auto_tipo_check
  CHECK (tipo IN ('novo','renovacao','endosso'));

-- 4. apolices_auto: data de emissão (novo campo do formulário reduzido)
ALTER TABLE apolices_auto ADD COLUMN IF NOT EXISTS data_emissao date;

-- 5. Endosso — tabela nova
CREATE TABLE IF NOT EXISTS endossos_auto (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  apolice_id      uuid REFERENCES apolices_auto(id) NOT NULL,
  cotacao_id      uuid REFERENCES cotacoes_auto(id),
  motivo          text NOT NULL,
  campo_alterado  text,
  valor_anterior  text,
  valor_atual     text,
  valor_endosso   numeric(14,2),
  created_at      timestamptz DEFAULT now()
);
```

Nenhuma mudança de RLS (mantém `FOR ALL TO authenticated USING (true)`, igual ao resto do módulo Auto).

## Frente 1 — Lembrete de virada de mês + Puxar renovações

### Banner no Dashboard Auto (`/auto`)

Regra de exibição: seja `M` o mês/ano atual. O "mês-alvo" candidato é `M+1`. O banner aparece quando `hoje >= (dia 1 de M+1) - 7 dias` **e** `auto_renovacao_mes_status` não tem `concluido_em` para `M+1`.

> Nota: o usuário pediu a janela de 15 dias para o banner aparecer e 7 dias para o "prazo limite de envio do orçamento" de cada renovação individual — são duas janelas diferentes, mantidas separadas no código (`AVISO_VIRADA_DIAS = 15`, `PRAZO_ENVIO_ORCAMENTO_DIAS = 7`).

Se `M+1` já está concluído mas existe um mês **anterior** ainda pendente (usuário não marcou como concluído a tempo), o banner mostra o mês pendente mais antigo em vez de `M+1` — evita "perder" um mês esquecido. Função nova em `autoShared.js`: `getMesRenovacaoPendente(statusPorMes, hoje)`.

Banner (`DataCard` de destaque, mesmo padrão visual dos cards de aviso já usados no dashboard):
- Texto: "Organizar e puxar renovações do mês de **{mês}**".
- Botão primário: **"Organizar e puxar renovações"** → navega para `/auto/renovacoes?mes={mes_ref}` e abre direto o painel de puxar (ver abaixo).
- Sem botão de "marcar concluído" no banner em si — a confirmação fica na página de Renovações (ver abaixo), para evitar marcar como concluído sem ter aberto a tela.

### Ação "Puxar renovações" (`/auto/renovacoes`)

Painel novo na página, com o mês-alvo (`month input`, pré-selecionado a partir do banner) e duas fontes:

**A) Puxar do sistema** — botão único. Busca em `apolices_auto` todas as linhas cujo mês/ano de `vigencia_inicio` seja igual ao mês-alvo **menos 1 ano** (ex.: alvo agosto/2027 → busca `vigencia_inicio` em agosto/2026). Para cada apólice encontrada:
- Se já existe uma linha em `renovacoes_auto` com esse `apolice_id` (o trigger normal já deve ter criado, já que toda apólice gera uma renovação automaticamente na hora da emissão) → não faz nada, só garante que aparece na lista do mês.
- Se não existe (gap de dados antigos, importação histórica anterior a este recurso, etc.) → cria a linha (`origem='sistema'`), preenchendo `pct_comissao_anterior`/`premio_liquido_anterior`/`nome_segurado_anterior` a partir da própria apólice (safety-net, mesmo padrão já usado em `sincronizarEmissoesPendentes`).

Isso só **lista** — não cria cotação/card no Kanban ainda (confirmado com o usuário).

**B) Puxar por planilha** — upload da aba do mês-alvo **um ano antes**, no formato de `01 COMISSÃO - AUTO.xlsx` (ex.: para alvo agosto/2027, sobe a aba "AGOSTO 2026"). Parser novo (`parseAutoComissaoPlanilha`, `src/lib/autoComissaoImport.js`), lê as colunas `TRANSMISSÃO, VIGÊNCIA, SEGURADO, QNT. DE PARCELAS, SEGURADORA, PREMIO LIQUIDO, % COMISSAO, VALOR DA COMISSÃO, REPASSE COMISSÃO, CORRETOR, O QUE É`. Cada linha vira uma renovação **pendente** (`status_renovacao='pendente'`, `status_cotacao='nao_cotada'`) com:
- `nome_segurado_anterior` = SEGURADO (limpo com `limparNomeSegurado`, já existente)
- `pct_comissao_anterior` = % COMISSAO da linha
- `premio_liquido_anterior` = PREMIO LIQUIDO da linha
- `vigencia_fim` = coluna VIGÊNCIA da linha (é a data de vencimento da apólice que resultou daquela transmissão — vira exatamente a data que vamos usar para colocar esta renovação no mês-alvo)
- `seguradora` = SEGURADORA (seguradora que está com a apólice hoje, ponto de partida da nova cotação)
- `apolice_id` = null, `origem='xls'`
- `cliente_id` = tentativa de match em `clientes_auto` pelo nome limpo (se achar exatamente 1, vincula; senão fica null e a cotação pede o cliente na hora de "Fazer Cotação")

**Deduplicação (vale para as duas fontes, e entre planilha × sistema):** antes de inserir, compara o nome do segurado (via `limparNomeSegurado`, que já remove hífen e sufixos, reaproveitada de `autoHistoricoImport.js`) contra os nomes já presentes na lista de renovações do mês-alvo (tanto os vindos do sistema quanto os já vindos de upload anterior). Se já existir, a linha da planilha é ignorada (contada como "duplicada" no resumo de importação, mesmo padrão visual já usado no card de resumo de "Importar histórico").

### Marcar mês concluído

Botão "Marcar mês concluído" no painel de puxar renovações (não no banner). Grava `auto_renovacao_mes_status` (upsert por `mes_ref`) com `concluido_em=now()`, `concluido_por=user.id`. O banner do dashboard some para aquele mês a partir daí — reaparece só na próxima virada, para o próximo mês.

## Frente 2 — Área "Renovações do mês" + Fazer Cotação + Arrastar para Gestão

### Lista de renovações do mês (`/auto/renovacoes`)

Reaproveita a página existente, mas a lista principal passa a mostrar, por linha:

| Campo | Origem |
|---|---|
| Segurado | `clientes_auto.nome_completo` / `nome_segurado_anterior` |
| Seguradora (com logo) | `SeguradoraBadge` (já existe), a seguradora **atual** (antes de cotar) |
| Vigência fim (apólice anterior) | `renovacoes_auto.vigencia_fim` |
| Data limite para envio do orçamento | `renovacoes_auto.data_limite_envio` = `vigencia_fim - 7 dias` (calculado ao puxar/importar) |
| Status da renovação | ver mapeamento abaixo |
| Comissão atual (%) | `apolices_auto.pct_comissao` da apólice vinculada, ou `renovacoes_auto.pct_comissao_anterior` quando vier de XLS/sem apólice |
| Comissão anterior (%) | `apolices_auto.renovacao_comissao_ano_anterior / renovacao_premio_liquido_ano_anterior × 100` da apólice vinculada (comissão do ciclo anterior a este, já guardada quando essa apólice foi emitida); vazio quando não houver histórico de 2 ciclos |

**Status da renovação** — reaproveita as colunas reais do Kanban de Gestão Auto, sem inventar um estado paralelo:

| Label na área de Renovações | Condição |
|---|---|
| Puxado | ainda sem `cotacao_id` (não existe cotação/card ainda) |
| *(nome da coluna atual)* | tem `cotacao_id`, card existe em `emissoes_auto`, mostra a coluna real (`Cotação feita`, `Negociando`, `Aguardando vistoria`, `Proposta Transmitida`) |
| Renovado | `status_renovacao = 'renovada'` (apólice nova já emitida) |
| Cancelado | `status_renovacao = 'nao_renovada'` (setado manualmente, botão "Cancelar" na linha, ou automaticamente quando o resultado da cotação vinculada for "recusada") |
| Vencido | `vigencia_fim` no passado e nenhum dos estados acima se aplica |

Isso é só uma função de leitura (`getRenovacaoAreaStatus`, `autoShared.js`) — nenhum campo novo de status é necessário além do que já existe.

### Botão "Fazer Cotação"

Substitui a chamada direta ao botão "Cotar" para linhas com `status = Puxado`: chama a função já existente `iniciarCotacaoRenovacao(renovacaoId)` (cria `cotacoes_auto` tipo `renovacao` + card em `emissoes_auto`/Pendentes via trigger, vincula `cotacao_id`). Nenhuma mudança de lógica aqui — é reaproveitar o que já existe, só movendo o gatilho para a área de Renovações do mês (hoje já existe um botão "Cotar" ali, o comportamento já é esse; muda o rótulo para "Fazer Cotação" e garante que ele também funciona para linhas de origem `xls` sem `cliente_id` — nesse caso abre um passo extra pedindo para escolher/criar o cliente antes de criar a cotação).

Uma vez criado o card, ele aparece no Kanban de Gestão Auto (`/auto/gestao`) na coluna Pendentes, com a etiqueta "Renovação" que já existe hoje.

### Arrastar para "Proposta Transmitida" — formulário reduzido

Hoje, ao arrastar qualquer card para "Proposta Transmitida" já abre um modal (`ModalEmissao`/`handleEmitir`) com muitos campos. Ele é mantido, mas passa a ter uma seção **obrigatória mínima** no topo (o resto — condutor, tipo de produção/responsável, repasse — continua disponível, só deixa de ser obrigatório e vai para uma seção "mais detalhes" recolhida, sem perder nada que já existe):

Campos que o usuário preenche:
- **Data de emissão** — novo campo (`apolices_auto.data_emissao`), default hoje, editável.
- **Início da vigência** — já existe (`vigencia_inicio`).
- **Quantidade de parcelas** — input numérico (reaproveita o campo `parcelamento`, salvo como `"{n}x"` — sem mudança de schema, só muda o input de texto livre para `type="number"` com sufixo "x" fixo).
- **Seguradora escolhida** — já existe (`SeguradoraSelect`).
- **Prêmio líquido da proposta** — já existe (`premio_liquido`).
- **Comissão da proposta (%)** — já existe (`pct_comissao`), agora sempre como percentual inteiro (20 = 20%) em todo o módulo Auto.

Automático (calculado/herdado, exibido como leitura, não pedido de novo):
- **Fim da vigência** — passa a ser calculado (`início + 1 ano`) em vez de digitado; o campo continua editável para os casos raros de vigência não-anual, mas não é mais obrigatório.
- **Valor da comissão** — `premio_liquido × (pct_comissao/100) × 0.9`.
- **Tipo (Renovação / Seguro novo / Endosso)** — deixa de ser um checkbox manual (`eh_renovacao`) e passa a ser herdado direto de `cotacoes_auto.tipo`/`emissoes_auto.tipo` (que já existe e já é populado corretamente na criação da cotação); exibido como badge somente-leitura no modal.
- **Comparação com o ciclo anterior** (`renovacao_premio_liquido_ano_anterior`, `renovacao_comissao_ano_anterior`) — quando o card vier de uma renovação, preenchido automaticamente a partir de `renovacoes_auto.premio_liquido_anterior`/`pct_comissao_anterior` (ou da apólice vinculada), sem pedir ao usuário. Continua editável dentro de "mais detalhes" para correção manual se necessário.
- Nome, CPF, celular, condutor, modelo do veículo, placa — como já é hoje, herdados da cotação/cliente.

Ao salvar, além de gravar a apólice, o sistema chama `concluirCotacaoEVincularRenovacao` (já existe) — sem mudança nessa parte.

### Cotação de "Seguro novo" — mesmo padrão

Confirmando o pedido: cotações novas que chegam pelo formulário público (Google Forms → n8n → Supabase → `cotacoes_auto` tipo `novo` → trigger cria card em Pendentes) já caem direto na área de Gestão, e ao arrastar para Proposta Transmitida usam o **mesmo modal reduzido** acima (o tipo mostrado é "Seguro novo", herdado de `cotacoes_auto.tipo='novo'`, sem comparação de ciclo anterior). Não há mudança de pipeline aqui além da correção do formulário/fórmula já descrita — o "mesma forma" do pedido já é atendido por reaproveitar o mesmo modal.

## Frente 3 — Upload de planilha (detalhado na Frente 1)

Já coberto acima ("Puxar por planilha"). Resumo do parser novo `src/lib/autoComissaoImport.js`:
- Lê a aba escolhida (usuário indica o mês/ano da aba, ou o sistema sugere com base no mês-alvo menos 1 ano).
- Ignora linhas totalmente vazias (mesmo critério do parser de histórico existente).
- Não filtra por cor de célula (diferente do importador de `02 RENOVAÇÕES AUTO.xlsx`) — este arquivo não usa destaque de cor, todas as linhas com SEGURADO preenchido contam.
- Dedup por nome (com `limparNomeSegurado`) contra a lista atual do mês-alvo, igual descrito acima.
- Card de resumo pós-upload: total lido / novas / duplicadas ignoradas / erros — mesmo padrão visual já usado em "Importar histórico".

## Frente 4 — Cotação de Endosso

### Fluxo

1. "Nova cotação" → tipo **Endosso** (novo terceiro botão ao lado de Novo/Renovação, tanto em `/auto/cotacoes` quanto em `/auto/gestao`).
2. Busca cliente (reaproveita a busca já existente de clientes Auto).
3. Ao selecionar o cliente, lista as apólices dele ordenadas por vigência (mais recente primeiro), usando `apolices_auto` do cliente — reaproveita a mesma query já usada em `getClienteAutoDetalhe`.
4. Usuário seleciona a apólice → tela pede:
   - **Motivo do endosso** (texto livre).
   - **Campo alterado** (texto livre curto, ex.: "Placa", "Condutor principal", "Uso do veículo") — não é uma lista fechada, para não travar o operador em casos não previstos.
   - **Informação anterior** × **Informação atualizada** (dois campos de texto livre, lado a lado).
   - **Valor do endosso** (numérico, pode ser positivo ou negativo).
5. Ao salvar, cria: `cotacoes_auto` (`tipo='endosso'`, vinculada ao `cliente_id` e com `apolice_id` de referência guardado em `endossos_auto.apolice_id`) → trigger já existente cria o card em `emissoes_auto`/Pendentes automaticamente, com a etiqueta "Endosso" (mesmo padrão visual de "Renovação"/"Novo", cor própria). Cria também a linha em `endossos_auto` com motivo/campo/valores/valor do endosso.
6. O card de endosso percorre o mesmo Kanban de Gestão Auto. Ao chegar em "Proposta Transmitida", usa o mesmo formulário reduzido da Frente 2 (tipo já vem herdado como "Endosso"); "Apólice Emitida" nesse caso não cria uma apólice nova do zero — atualiza a apólice existente (`apolice_id` referenciado em `endossos_auto`) com os novos dados informados (mesma apólice, dados atualizados), em vez de inserir uma linha nova em `apolices_auto`. Isso evita duplicar apólice por conta de um endosso.

## Fora de escopo desta rodada

- RLS por papel nas tabelas de Auto (continua `USING (true)`, já sinalizado como pendência em rodadas anteriores).
- Notificação por WhatsApp/e-mail do prazo de envio do orçamento (fica só como badge visual na lista, por enquanto).
- Edição do `data_limite_envio` por linha individual (é sempre `vigencia_fim - 7 dias`, sem exceção manual nesta rodada).

## Migrations necessárias (resumo)

Um único arquivo novo: `supabase/56_auto_renovacoes_endosso.sql` (bloco SQL completo na seção "Modelo de dados" acima). Precisa ser rodado manualmente no SQL Editor do Supabase antes de qualquer uma das 4 frentes funcionar em produção — mesmo padrão de todas as migrations anteriores do projeto.

## Riscos

- A correção da fórmula de comissão muda valores para emissões **futuras** (não faz backfill de comissões já gravadas) — apólices já emitidas antes da correção mantêm o valor antigo salvo.
- Padronizar `pct_comissao` como percentual inteiro em todo o módulo Auto pode exigir ajuste em qualquer tela que hoje espera fração (0,2) — checar todos os pontos de leitura de `pct_comissao`/`valor_comissao` no módulo Auto durante a implementação, não só os dois já identificados.
- O match de cliente por nome (planilha e endosso) é best-effort — nomes muito divergentes da grafia cadastrada não casam automaticamente; usuário resolve manualmente nesses casos.
