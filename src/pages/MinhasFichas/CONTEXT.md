# MinhasFichas

## Propósito
Lista filtrada das fichas assumidas pelo usuário logado (status em_cotacao, orcamentista_id = auth.uid()). Visão pessoal do orçamentista.

## Componentes usados
- `ModalFinalizar` — finalizar ficha
- `ModalFicha` — editar ficha
- `DetalhesFicha` — drawer de detalhes
- `TableSkeleton` — loading state
- `Select` (ui/) — filtro de período (hoje/semana/mês/todos)

## Queries Supabase
- `lib/fichas.js` — fetchFichasDoOrcamentista (filtra por orcamentista_id = uid)
- `lib/fichas.js` — fetchFichas, fetchFichaDetalhe, deletarFicha
- Contexto: `useAuth` para obter uid do usuário logado

## Status
pronto

## Usuários que utilizam
Todos os orçamentistas (cada um vê apenas suas próprias fichas)
