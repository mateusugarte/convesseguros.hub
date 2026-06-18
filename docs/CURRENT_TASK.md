# CURRENT TASK

## Responsavel Atual

Claude

## Pagina

Multiplas paginas — correcao de encoding e pesquisa de fichas

## Objetivo

1. Corrigir textos com encoding errado (Pessoa JurÃ­dica, Em AnÃ¡lise, etc.) em todo o sistema.
2. Corrigir card de fichas Pessoa Juridica que nao mostrava o nome.
3. Corrigir pesquisa de fichas na area de emissao (modal Iniciar Emissao).

## Status

Concluido.

## Alteracoes Realizadas

- `src/components/KanbanFichas.jsx` — encoding corrigido (Em Analise, Mes, Nao, Confirmar Aprovacao, etc.)
- `src/components/KanbanBoard.jsx` — encoding corrigido (Em Cotacao, Em Analise, em-dash)
- `src/pages/Relatorio.jsx` — encoding corrigido (Marco, Enviado Cobranca, Desistiu da Locacao, labels de modal)
- `src/pages/Fichas.jsx` — encoding corrigido (Pessoa Juridica, Marco, Voce, Imobiliaria, em-dash)
- `src/components/RelatorioMensal.jsx` — encoding corrigido (Nao, Marco, Desistencias, Total do Mes)
- `src/lib/fichas.js` — `fetchFichasKanban` agora inclui campo `nome_empresa` (corrige nomes de PJ mostrando -)
- `src/lib/apolices.js` — `buscarFichasParaEmissao` removidos filtros de status e apolices existentes; busca agora cobre todas as fichas; pesquisa ampliada para CPF/CNPJ alem do nome

## Proximos Passos

- Verificar se dados de nome_empresa ja estao preenchidos no banco para fichas PJ existentes
- Monitorar se pesquisa de emissao esta retornando resultados como esperado

## Observacoes

- Encoding era mojibake: UTF-8 bytes interpretados como Latin-1/CP1252 e re-salvos
- A funcao normalizeDisplayText em src/lib/text.js ja tratava o encoding dos dados do banco — o problema era nos textos hardcoded no codigo-fonte
- fichas.js fetchFichasKanban nao buscava nome_empresa, causando nome vazio em cards PJ
