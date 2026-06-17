# CURRENT TASK

## Responsavel Atual

Claude

## Pagina

`src/pages/comercial/Jornadas.jsx`

## Objetivo

Redesign completo da area de Jornadas — novos nos, configuracoes por tipo, constantes compartilhadas, PainelConfig completo.

## Status

Concluido (Fase 2 — editor visual).

## Alteracoes Realizadas

- Imports: Target, AlertCircle, TrendingUp, AlignLeft, StopCircle, BookOpen adicionados
- Constantes: TEAM_MEMBERS, PRODUCTS, SEGMENTOS_IMOB, CAMPOS_CONDICAO, OPERADORES_CONDICAO
- NODE_GROUPS: 4 grupos — Gatilhos (7), Acoes (10), Etapas (1), Controle (4)
- WorkflowNode: isEtapa, isPararSe, configSummary por tipo, subtitle, source handle condicional
- PainelConfig: fields completos para todos os 22 tipos de no, usando as constantes acima

## Proximos Passos

- Aba "Jornada do Cliente" no detalhe do lead (LeadDetalhe.jsx) — Fase 2 pendente
- Campanhas (Fase 3)
- Templates de jornada pre-construidos (playbooks prontos)

## Observacoes

- Jornadas sao 100% visuais — sem automacao. Os nos sao playbook para o vendedor.
- Cada no tem instrucoes, responsavel, produto e contexto adequados ao processo comercial da Conves.
