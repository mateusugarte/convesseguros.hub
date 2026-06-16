# CURRENT TASK

## Responsavel Atual

Usuario

## Pagina

Modulo Auto - Cotações / Emissões / Apolices

## Objetivo

Migrar cliente_id de UUID FK para TEXT composto (cpf + data), armazenando dados do cliente diretamente nas tabelas de cotação.

## Status

Aguardando execucao SQL pelo usuario

## Proxima Acao OBRIGATORIA

Executar `supabase/16_cotacoes_cliente_direto.sql` no Supabase SQL Editor.

## Alteracoes Realizadas

### supabase/16_cotacoes_cliente_direto.sql (NOVO — executar no Supabase)
- Adiciona `nome_cliente`, `cpf_cliente`, `celular_cliente`, `email_cliente`, `estado_civil_cliente`, `profissao_cliente` a `cotacoes_auto`
- Remove FK `cotacoes_auto_cliente_id_fkey`, muda `cliente_id` para TEXT
- Remove FK `emissoes_auto_cliente_id_fkey`, muda `cliente_id` para TEXT
- Remove FK `apolices_auto_cliente_id_fkey`, muda `cliente_id` para TEXT
- Adiciona `nome_cliente`, `cpf_cliente` a `apolices_auto`

### src/lib/auto.js
- `getCotacoesAuto`: remove join `clientes_auto`, usa `select('*')` (dados do cliente agora estão na própria linha)
- `getEmissoesAuto`: remove join `clientes_auto`, agora usa `cotacoes_auto(tipo, modelo_veiculo, placa, nome_cliente, cpf_cliente, celular_cliente)`
- `getApolicesAuto`: remove join `clientes_auto`, usa `select('*')`, busca usa `item.nome_cliente`

### src/pages/auto/AutoCotacoes.jsx
- Remove imports `buscarClientePorCpf`, `criarClienteAuto`
- Adiciona `gerarClienteId(cpf)` → `{cpf_sem_mascara}_{YYYY-MM-DD}`
- `salvarNovo`: gera cliente_id composto, salva dados do cliente diretamente na cotação
- `salvarRenovacao`: gera cliente_id composto
- Todas as referências `clientes_auto?.X` substituídas por `X_cliente`

### src/pages/auto/AutoEmissoes.jsx
- `CardEmissao`: usa `cotacoes_auto?.nome_cliente` ou `cpf_cliente`
- `ModalApolices`: usa `item.nome_cliente`
- `handleEmitir`: passa `nome_cliente` e `cpf_cliente` na apolice

## Observacoes

- `renovacoes_auto.cliente_id` (UUID FK para clientes_auto) NÃO foi alterado — renovações têm fluxo próprio
- `clientes_auto` continua existindo no banco (outras partes podem usar)
- Cotações existentes com UUID como cliente_id ficam com valor convertido para texto — não afeta funcionalidade
