# CURRENT TASK

## Responsavel Atual

Claude

## Pagina

Modulo Auto - Cotações

## Objetivo

Corrigir bug de salvamento das cotações e adicionar área de listagem completa com todos os dados.

## Status

Concluido

## Alteracoes Realizadas

### Bug corrigido: cotações não eram salvas
- `salvarNovo` enviava campos inexistentes em `cotacoes_auto` (`celular`, `email`, `estado_civil`, `profissao`)
  — esses campos pertencem a `clientes_auto` e são salvos corretamente na criação do cliente.
  O insert falhava silenciosamente porque não havia `onError` na mutation.
- Removidos os 4 campos inválidos do payload de `criarCotacaoAuto`.
- Adicionado `onError` em ambas as mutations (`salvarNovo` e `salvarRenovacao`) com banner de erro visível.

### Bug corrigido: filtro do histórico recente
- `item.cotacoes_auto?.modelo_veiculo` → corrigido para `item.modelo_veiculo`
  (o item já é a cotação; não há relação cotacoes_auto dentro de si mesmo).

### Nova funcionalidade: listagem completa de cotações
- Nova query `['auto-cotacoes-todas']` sem filtro de tipo.
- Nova seção "Todas as cotações" ao final da página com:
  - Busca por nome, CPF, modelo de veículo, placa, seguradora, origem
  - Filtros de status (Todas / Pendentes / Convertidas / Perdidas)
  - Filtros de tipo (Todos / Seguro novo / Renovação)
  - Linhas expansíveis mostrando todos os dados da cotação:
    - Tipo 'novo': segurado, condutor, veículo/risco, proteções/lead
    - Tipo 'renovacao': cliente, seguradora preferencial, seguradora mais barata
  - Ações rápidas de status direto na listagem (Converter / Marcar perdida / Reabrir)

## Arquivos Alterados

- `src/pages/auto/AutoCotacoes.jsx`

## Proximo Responsavel

Usuario

## Proxima Tarefa

Verificar se o SQL `supabase/15_auto_dates_migration.sql` já foi executado no Supabase
(necessário para cotações antigas sem `created_at` aparecerem corretamente).

## Observacoes

- RLS, auth e regras de negocio não foram alterados.
- A mutation `mudarStatus` usa `atualizarStatusCotacao` já existente em `src/lib/auto.js`.
