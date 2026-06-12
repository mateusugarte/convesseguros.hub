# Backups de Componentes

Pasta para preservar o estado de componentes antes de edições complexas.

## Convenção de nomes

```
YYYY-MM-DD_[NomeComponente]_[descricao-curta].md
```

**Exemplos:**
- `2026-06-12_KanbanFichas_antes-fix-drag.md`
- `2026-06-12_ApoicesGestao_antes-refactor-colunas.md`
- `2026-06-15_Layout_antes-adicionar-nav-comercial.md`

## Como usar

1. Antes de editar um componente grande ou arriscado, copie o conteúdo atual do arquivo `.jsx` para um `.md` aqui.
2. Nomeie com a data de hoje + nome do componente + o que vai mudar.
3. Se a edição der errado, o backup está aqui para referência.

## O que guardar

Guarde quando a edição envolver:
- Componentes acima de 400 linhas
- Mudanças em lógica de drag-and-drop (KanbanFichas, Relatorio, ApoicesGestao, Pipeline)
- Alterações em queries Supabase existentes
- Refatorações de estado (useState, useEffect complexos)

## O que NÃO guardar

- Arquivos pequenos (< 100 linhas)
- Mudanças apenas visuais/CSS
- Adições simples de campo ou ícone
