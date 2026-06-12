# Vendas (Comercial)

## Propósito
Registro e listagem de vendas fechadas: vincula lead, produto, valor, comissão e data de emissão. Exibe KPIs de receita e comissão no período.

## Componentes usados
- `DatePicker` (ui/) — data de emissão
- `Select` (ui/) — produto
- `ModalVenda` (componente local inline) — formulário de nova venda

## Queries Supabase
- `lib/comercial.js` — useComercial, saleAdd
- Constantes: PRODUTOS

## Status
pronto

## Usuários que utilizam
Equipe comercial e gestores (Patricia Dantas, Patricia Barbara, Luciano)
