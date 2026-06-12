# Jornadas (Comercial)

## Propósito
Criação e gestão de jornadas de automação: fluxos de contato com leads definidos como grafos (nós de ação: email, ligação, whatsapp, espera). Permite ativar/pausar jornadas e editar scripts de contato.

## Componentes usados
- ReactFlow — editor visual de fluxo (nós e arestas)
- `Select` (ui/) — tipo de nó/ação

## Queries Supabase
- `lib/comercial.js` — useComercial, journeyAdd, journeyUpdate, journeyDelete, scriptAdd
- Constantes: PIPELINE_COLS
- Jornadas armazenadas em JSON na coluna `etapas` da tabela `jornadas`

## Status
pronto

## Usuários que utilizam
Gestores comerciais (Luciano, Mateus, Patricia Dantas)
