# FichaDetalhePage

## Propósito
Página de detalhe completo de uma ficha individual. Permite visualizar, editar campos inline, assumir, finalizar e gerenciar documentos.

## Componentes usados
- `SeguradoraBadge` — exibe logo/nome da seguradora
- `SeguradoraSelect` — troca de seguradora inline
- `ModalFicha` — edição completa da ficha
- `ModalAssumir` — assumir ficha
- `ModalFinalizar` — finalizar ficha
- `SecaoDocumentos` — upload e listagem de documentos anexados

## Queries Supabase
- `lib/fichas.js` — fetchFichaDetalhe (por id), editarFicha, atualizarCotacaoFicha
  (salva campos de UMA seguradora em `raw_data.cotacoes` sempre a partir do
  `raw_data` mais recente do banco, evitando race entre saves concorrentes de
  cards diferentes), deletarFicha, salvarRetornoGeradoFicha,
  limparRetornoGeradoFicha
- Contexto: `useAuth` para verificar se usuário pode finalizar (só quem assumiu)
- Rota: `/fichas/:id`

## Status
pronto

## Usuários que utilizam
Todos os orçamentistas; acesso via link direto ou drill-down do kanban
