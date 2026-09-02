-- 73_auto_clientes_unificacao_risco.sql
-- Completa o risco lido dos PDFs, permite unificar clientes sem perder
-- vinculos e impede a criacao silenciosa de um segundo cadastro com o mesmo
-- nome normalizado.

begin;

alter table if exists public.cotacoes_auto
  add column if not exists tipo_residencia text,
  add column if not exists passagem_leilao text;

create or replace function public.normalizar_nome_cliente_auto(valor text)
returns text
language sql
immutable
parallel safe
as $$
  select btrim(regexp_replace(
    lower(translate(coalesce(valor, ''),
      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')),
    '[^a-z0-9]+', ' ', 'g'));
$$;

create or replace function public.bloquear_cliente_auto_nome_duplicado()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  existente uuid;
begin
  select id into existente
    from public.clientes_auto
   where id <> coalesce(new.id, gen_random_uuid())
     and public.normalizar_nome_cliente_auto(nome_completo) = public.normalizar_nome_cliente_auto(new.nome_completo)
   order by created_at asc nulls last, id
   limit 1;

  if existente is not null then
    raise exception using
      errcode = 'P0001',
      message = 'AUTO_CLIENTE_NOME_DUPLICADO',
      detail = existente::text,
      hint = 'Selecione o cliente existente e informe o veículo antes de continuar.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bloquear_cliente_auto_nome_duplicado on public.clientes_auto;
create trigger trg_bloquear_cliente_auto_nome_duplicado
  before insert or update of nome_completo on public.clientes_auto
  for each row execute function public.bloquear_cliente_auto_nome_duplicado();

create or replace function public.mesclar_clientes_auto(p_principal uuid, p_duplicado uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  principal public.clientes_auto;
  duplicado public.clientes_auto;
  total_apolices integer := 0;
begin
  if p_principal is null or p_duplicado is null or p_principal = p_duplicado then
    raise exception 'Selecione dois clientes diferentes.';
  end if;

  select * into principal from public.clientes_auto where id = p_principal for update;
  select * into duplicado from public.clientes_auto where id = p_duplicado for update;
  if principal.id is null or duplicado.id is null then
    raise exception 'Um dos clientes não foi encontrado.';
  end if;

  update public.cotacoes_auto set cliente_id = p_principal where cliente_id = p_duplicado;
  update public.emissoes_auto set cliente_id = p_principal where cliente_id = p_duplicado;
  update public.apolices_auto set cliente_id = p_principal where cliente_id = p_duplicado;
  get diagnostics total_apolices = row_count;
  update public.renovacoes_auto set cliente_id = p_principal where cliente_id = p_duplicado;
  update public.sinistros_auto set cliente_id = p_principal where cliente_id = p_duplicado;

  if to_regclass('public.auto_orcamentos') is not null then
    execute 'update public.auto_orcamentos set cliente_id = $1 where cliente_id = $2' using p_principal, p_duplicado;
  end if;
  if to_regclass('public.auto_interacoes') is not null then
    execute 'update public.auto_interacoes set cliente_id = $1 where cliente_id = $2' using p_principal, p_duplicado;
  end if;
  if to_regclass('public.auto_lembretes') is not null then
    execute 'update public.auto_lembretes set cliente_id = $1 where cliente_id = $2' using p_principal, p_duplicado;
  end if;

  -- A tabela de verificacao usa ON DELETE CASCADE; remover o duplicado limpa
  -- os pares antigos antes de consolidar os dados cadastrais no principal.
  delete from public.clientes_auto where id = p_duplicado;

  update public.clientes_auto set
    cpf = coalesce(nullif(principal.cpf, ''), nullif(duplicado.cpf, '')),
    telefone = coalesce(nullif(principal.telefone, ''), nullif(duplicado.telefone, '')),
    celular = coalesce(nullif(principal.celular, ''), nullif(duplicado.celular, '')),
    email = coalesce(nullif(principal.email, ''), nullif(duplicado.email, '')),
    estado_civil = coalesce(nullif(principal.estado_civil, ''), nullif(duplicado.estado_civil, '')),
    profissao = coalesce(nullif(principal.profissao, ''), nullif(duplicado.profissao, '')),
    observacoes_operacionais = coalesce(nullif(principal.observacoes_operacionais, ''), nullif(duplicado.observacoes_operacionais, ''))
  where id = p_principal;

  return jsonb_build_object(
    'cliente_id', p_principal,
    'cliente_removido_id', p_duplicado,
    'apolices_movidas', total_apolices
  );
end;
$$;

revoke all on function public.mesclar_clientes_auto(uuid, uuid) from public;
grant execute on function public.mesclar_clientes_auto(uuid, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
