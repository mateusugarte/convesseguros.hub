# BaseLeads (Comercial)

## Propósito
Listagem tabular de todos os leads com filtros avançados (busca, origem, score, período, status). Permite exportar e navegar para detalhe do lead.

## Componentes usados
- `DatePicker` (ui/) — filtro por data
- `ScoreBadge` e `AvatarColor` (componentes locais inline) — indicadores visuais

## Queries Supabase
- `lib/comercial.js` — useComercial (hook com cache), leadMover, calcScore, scoreFaixa
- Constantes: PIPELINE_COLS, ORIGENS
- Suporte a URL params (`useSearchParams`) para filtros por link

## Status
pronto

## Usuários que utilizam
Equipe comercial e gestores (Patricia Dantas, Patricia Barbara, Luciano)
