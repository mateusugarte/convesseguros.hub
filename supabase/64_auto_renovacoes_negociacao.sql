-- 64_auto_renovacoes_negociacao.sql
-- Mesa operacional de renovacoes: contatos, follow-ups, descontos e notas.
-- Idempotente e nao destrutiva. Executar manualmente no SQL Editor.

begin;

alter table if exists public.renovacoes_auto
  add column if not exists contatos_realizados integer not null default 0,
  add column if not exists followups_realizados integer not null default 0,
  add column if not exists descontos_realizados integer not null default 0,
  add column if not exists desconto_percentual numeric(6,2),
  add column if not exists ultimo_contato_em date,
  add column if not exists proximo_followup_em date,
  add column if not exists notas_negociacao text,
  add column if not exists cotada_em timestamptz;

alter table if exists public.renovacoes_auto
  drop constraint if exists renovacoes_auto_contatos_realizados_check,
  drop constraint if exists renovacoes_auto_followups_realizados_check,
  drop constraint if exists renovacoes_auto_descontos_realizados_check,
  drop constraint if exists renovacoes_auto_desconto_percentual_check,
  drop constraint if exists renovacoes_auto_status_operacional_check;

alter table if exists public.renovacoes_auto
  add constraint renovacoes_auto_contatos_realizados_check check (contatos_realizados >= 0),
  add constraint renovacoes_auto_followups_realizados_check check (followups_realizados >= 0),
  add constraint renovacoes_auto_descontos_realizados_check check (descontos_realizados >= 0),
  add constraint renovacoes_auto_desconto_percentual_check check (desconto_percentual is null or desconto_percentual between 0 and 100),
  add constraint renovacoes_auto_status_operacional_check check (status_operacional in (
    'pendente', 'cotando', 'cotado', 'enviado', 'negociando',
    'outra_corretora', 'renovado', 'cancelado'
  ));

alter table if exists public.emissoes_auto
  drop constraint if exists emissoes_auto_resultado_check;

alter table if exists public.emissoes_auto
  add constraint emissoes_auto_resultado_check
  check (resultado is null or resultado in ('cotada', 'aprovada', 'recusada'));

create index if not exists idx_renovacoes_auto_proximo_followup
  on public.renovacoes_auto (proximo_followup_em)
  where proximo_followup_em is not null;

create index if not exists idx_renovacoes_auto_status_operacional
  on public.renovacoes_auto (status_operacional);

-- A cotacao ja existe quando esta funcao e chamada. O RPC faz a passagem
-- renovacao + card para "Cotacoes feitas" na mesma transacao, impedindo que
-- apenas um dos dois lados avance em caso de erro.
create or replace function public.marcar_renovacao_auto_cotada(
  p_renovacao_id uuid,
  p_cotacao_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emissao_id uuid;
begin
  update public.emissoes_auto
     set coluna = 'cotacao_feita',
         resultado = 'cotada',
         updated_at = now()
   where cotacao_id = p_cotacao_id
   returning id into v_emissao_id;

  if v_emissao_id is null then
    raise exception 'Card da Pipeline nao encontrado para a cotacao %.', p_cotacao_id;
  end if;

  update public.renovacoes_auto
     set cotacao_id = p_cotacao_id,
         status_cotacao = 'cotada_nao_enviada',
         status_operacional = 'cotado',
         cotada_em = now(),
         updated_at = now()
   where id = p_renovacao_id;

  if not found then
    raise exception 'Renovacao % nao encontrada.', p_renovacao_id;
  end if;

  return jsonb_build_object('cotacao_id', p_cotacao_id, 'emissao_id', v_emissao_id);
end;
$$;

revoke all on function public.marcar_renovacao_auto_cotada(uuid, uuid) from public;
grant execute on function public.marcar_renovacao_auto_cotada(uuid, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
