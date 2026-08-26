-- 69_auto_renovacoes_prazo_corrido.sql
-- Nova regra operacional da data limite das renovacoes AUTO:
--   * subtrai 10 dias corridos do vencimento;
--   * se cair no sabado, antecipa para sexta;
--   * se cair no domingo, posterga para segunda;
--   * nao considera feriados.
-- Idempotente e nao destrutiva.

begin;

create or replace function public.calcular_limite_renovacao_auto(data_vencimento date)
returns date
language sql
immutable
set search_path = public
as $$
  select case extract(dow from data_vencimento - 10)
    when 6 then data_vencimento - 11
    when 0 then data_vencimento - 9
    else data_vencimento - 10
  end;
$$;

create or replace function public.fn_definir_limite_renovacao_auto()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.data_limite_envio := public.calcular_limite_renovacao_auto(new.vigencia_fim);
  return new;
end;
$$;

drop trigger if exists trg_definir_limite_renovacao_auto on public.renovacoes_auto;
create trigger trg_definir_limite_renovacao_auto
before insert or update of vigencia_fim on public.renovacoes_auto
for each row execute function public.fn_definir_limite_renovacao_auto();

update public.renovacoes_auto
set data_limite_envio = public.calcular_limite_renovacao_auto(vigencia_fim)
where vigencia_fim is not null
  and data_limite_envio is distinct from public.calcular_limite_renovacao_auto(vigencia_fim);

create or replace function public.fn_criar_renovacao_auto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.renovacoes_auto (
    apolice_id, cliente_id, seguradora, vigencia_fim, status_cotacao,
    status_renovacao, status_operacional, origem, data_limite_envio,
    nome_segurado_anterior, numero_apolice_anterior, premio_liquido_anterior,
    pct_comissao_anterior, identificacao_veiculo
  ) values (
    new.id, new.cliente_id, new.seguradora, new.vigencia_fim, 'nao_cotada',
    'pendente', 'pendente', 'sistema', public.calcular_limite_renovacao_auto(new.vigencia_fim),
    new.nome_cliente, new.numero_apolice, new.premio_liquido,
    new.pct_comissao, concat_ws(' · ', nullif(new.modelo_veiculo, ''), nullif(new.placa, ''))
  )
  on conflict (apolice_id) where apolice_id is not null do nothing;
  return new;
end;
$$;

commit;
