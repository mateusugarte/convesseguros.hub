-- 75_auto_pipeline_nao_renovou.sql
-- Mantem o desfecho "Nao renovou" visivel na Pipeline de renovacoes.
-- Idempotente e nao destrutiva. Executar manualmente no SQL Editor.

begin;

alter table if exists public.emissoes_auto
  drop constraint if exists emissoes_auto_coluna_check;

alter table if exists public.emissoes_auto
  add constraint emissoes_auto_coluna_check
  check (coluna is null or coluna in (
    'cotacao_feita', 'negociando', 'aguardando_vistoria',
    'proposta_transmitida', 'apolice_emitida', 'nao_renovou', 'emitida'
  ));

notify pgrst, 'reload schema';

commit;
