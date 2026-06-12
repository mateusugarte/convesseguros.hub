# Configuracoes

## Propósito
Configurações de perfil do usuário logado: nome de exibição, cor do avatar e troca de senha.

## Componentes usados
Sem componentes customizados — apenas campos de formulário inline.

## Queries Supabase
- `lib/supabase.js` — atualização da tabela `profiles` (nome, avatar_color)
- Contexto: `useAuth` para dados do usuário atual

## Status
pronto

## Usuários que utilizam
Todos os usuários do sistema
