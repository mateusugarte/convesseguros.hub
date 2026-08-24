-- 65_auto_renovacoes_prazo_seguradoras.sql
-- Ajusta a entrada operacional de renovacoes AUTO:
--   * seguradora atual continua em `seguradora`;
--   * `outra_seguradora` e opcional;
--   * data limite e sempre 10 dias uteis antes do vencimento;
--   * comissao atual nao participa da criacao (somente comissao passada).
-- Idempotente e nao destrutiva.

begin;

alter table if exists public.renovacoes_auto
  add column if not exists outra_seguradora text;

create or replace function public.subtrair_dias_uteis(data_base date, dias_uteis int)
returns date
language plpgsql
immutable
set search_path = public
as $$
declare
  resultado date := data_base;
  restantes int := dias_uteis;
begin
  if data_base is null then return null; end if;
  while restantes > 0 loop
    resultado := resultado - 1;
    if extract(dow from resultado) not in (0, 6) then
      restantes := restantes - 1;
    end if;
  end loop;
  return resultado;
end;
$$;

-- A regra fica protegida tambem no banco: inserts, importacoes e alteracoes do
-- vencimento recebem o mesmo limite, independentemente da tela de origem.
create or replace function public.fn_definir_limite_renovacao_auto()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.data_limite_envio := public.subtrair_dias_uteis(new.vigencia_fim, 10);
  return new;
end;
$$;

drop trigger if exists trg_definir_limite_renovacao_auto on public.renovacoes_auto;
create trigger trg_definir_limite_renovacao_auto
before insert or update of vigencia_fim on public.renovacoes_auto
for each row execute function public.fn_definir_limite_renovacao_auto();

-- Corrige a carteira que ja estiver gravada com o prazo antigo de 7 dias.
update public.renovacoes_auto
set data_limite_envio = public.subtrair_dias_uteis(vigencia_fim, 10)
where vigencia_fim is not null
  and data_limite_envio is distinct from public.subtrair_dias_uteis(vigencia_fim, 10);

-- Mantem o trigger de criacao automatica alinhado com a nova regra.
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
    'pendente', 'pendente', 'sistema', public.subtrair_dias_uteis(new.vigencia_fim, 10),
    new.nome_cliente, new.numero_apolice, new.premio_liquido,
    new.pct_comissao, concat_ws(' · ', nullif(new.modelo_veiculo, ''), nullif(new.placa, ''))
  )
  on conflict (apolice_id) where apolice_id is not null do nothing;
  return new;
end;
$$;

commit;
