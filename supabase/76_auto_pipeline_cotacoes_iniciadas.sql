-- 76_auto_pipeline_cotacoes_iniciadas.sql
-- Mantem visivel a etapa entre uma cotacao pendente e uma cotacao concluida.
-- Idempotente e nao destrutiva. Executar manualmente no SQL Editor.

begin;

alter table if exists public.emissoes_auto
  drop constraint if exists emissoes_auto_coluna_check;

alter table if exists public.emissoes_auto
  add constraint emissoes_auto_coluna_check
  check (coluna is null or coluna in (
    'cotacao_iniciada', 'cotacao_feita', 'negociando',
    'aguardando_vistoria', 'proposta_transmitida', 'apolice_emitida',
    'nao_renovou', 'emitida'
  ));

-- Cotações que já tinham sido abertas antes desta migration passam a ocupar a
-- coluna nova sem alterar propostas, emissões ou apólices já avançadas.
update public.emissoes_auto e
   set coluna = 'cotacao_iniciada', updated_at = now()
  from public.cotacoes_auto c
 where e.cotacao_id = c.id
   and e.coluna is null
   and c.status = 'aberta';

notify pgrst, 'reload schema';

commit;
