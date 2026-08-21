-- 63_auto_operacao_planilhas_pipeline.sql
-- Reforma operacional do AUTO baseada nas planilhas de agosto/2026.
-- Idempotente e nao destrutiva. Executar manualmente no SQL Editor.

begin;

alter table if exists public.cotacoes_auto
  add column if not exists referencia_origem text,
  add column if not exists payload_origem jsonb not null default '{}'::jsonb,
  add column if not exists recebido_em timestamptz;

create unique index if not exists cotacoes_auto_referencia_origem_uidx
  on public.cotacoes_auto (referencia_origem)
  where referencia_origem is not null;

alter table if exists public.renovacoes_auto
  add column if not exists status_operacional text not null default 'pendente',
  add column if not exists pct_comissao_atual numeric(6,2);

alter table if exists public.renovacoes_auto
  drop constraint if exists renovacoes_auto_status_operacional_check;

alter table if exists public.renovacoes_auto
  add constraint renovacoes_auto_status_operacional_check
  check (status_operacional in (
    'pendente', 'cotando', 'enviado', 'negociando',
    'outra_corretora', 'renovado', 'cancelado'
  ));

update public.renovacoes_auto
set status_operacional = case
  when status_renovacao = 'renovada' then 'renovado'
  when status_renovacao = 'nao_renovada' then 'cancelado'
  when status_cotacao = 'cotada_enviada' then 'enviado'
  when status_cotacao = 'cotada_nao_enviada' then 'cotando'
  else 'pendente'
end
where status_operacional = 'pendente';

alter table if exists public.emissoes_auto
  add column if not exists data_transmissao date,
  add column if not exists tipo_producao text,
  add column if not exists responsavel text,
  add column if not exists emissor text;

alter table if exists public.emissoes_auto
  drop constraint if exists emissoes_auto_tipo_producao_check;

alter table if exists public.emissoes_auto
  add constraint emissoes_auto_tipo_producao_check
  check (tipo_producao is null or tipo_producao in ('equipe', 'individual'));

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
  while restantes > 0 loop
    resultado := resultado - 1;
    if extract(dow from resultado) not in (0, 6) then restantes := restantes - 1; end if;
  end loop;
  return resultado;
end;
$$;

-- O trigger passa a criar um card completo. Como ele roda na mesma transacao
-- do INSERT da cotacao, qualquer falha tambem desfaz a cotacao.
create or replace function public.fn_criar_emissao_auto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.emissoes_auto (
    cotacao_id, cliente_id, tipo, nome_cliente, cpf_cliente, celular_cliente,
    condutor_nome, condutor_cpf, modelo_veiculo, placa, vigencia_inicio,
    vigencia_fim, created_at, updated_at
  ) values (
    new.id, new.cliente_id, new.tipo, new.nome_cliente, new.cpf_cliente,
    new.celular_cliente, new.condutor_nome, new.condutor_cpf,
    new.modelo_veiculo, new.placa, new.vigencia_inicio, new.vigencia_fim,
    coalesce(new.created_at, now()), coalesce(new.updated_at, now())
  );
  return new;
end;
$$;

-- A renovacao gerada por uma nova apolice ja leva o veiculo e a comissao do
-- ciclo encerrado para a coluna "Com. passada".
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
    'pendente', 'pendente', 'sistema', public.subtrair_dias_uteis(new.vigencia_fim, 7),
    new.nome_cliente, new.numero_apolice, new.premio_liquido,
    new.pct_comissao, concat_ws(' · ', nullif(new.modelo_veiculo, ''), nullif(new.placa, ''))
  )
  on conflict (apolice_id) where apolice_id is not null do nothing;
  return new;
end;
$$;

-- Entrada atomica dos formularios de seguro novo. A referencia de origem
-- torna os retries seguros: o mesmo envio nunca cria duas cotacoes.
create or replace function public.registrar_cotacao_auto_novo(
  p_cliente jsonb,
  p_cotacao jsonb,
  p_referencia text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.cotacoes_auto
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
  v_cpf text;
  v_nome text;
  v_referencia text := nullif(btrim(p_referencia), '');
  v_cotacao public.cotacoes_auto;
begin
  if v_referencia is not null then
    select * into v_cotacao
      from public.cotacoes_auto
     where referencia_origem = v_referencia;
    if found then
      return v_cotacao;
    end if;
  end if;

  v_cpf := regexp_replace(
    coalesce(p_cliente->>'cpf', p_cotacao->>'cpf_cliente', ''),
    '[^0-9]', '', 'g'
  );
  v_nome := nullif(btrim(coalesce(
    p_cliente->>'nome_completo', p_cotacao->>'nome_cliente', ''
  )), '');

  if v_nome is null and v_cpf = '' then
    raise exception 'Informe ao menos o nome ou CPF do segurado.';
  end if;

  if v_cpf <> '' then
    insert into public.clientes_auto (
      nome_completo, cpf, telefone, celular, email, estado_civil, profissao
    ) values (
      coalesce(v_nome, v_cpf), v_cpf,
      nullif(p_cliente->>'telefone', ''),
      nullif(p_cliente->>'celular', ''),
      nullif(p_cliente->>'email', ''),
      nullif(p_cliente->>'estado_civil', ''),
      nullif(p_cliente->>'profissao', '')
    )
    on conflict (cpf) do update set
      nome_completo = coalesce(v_nome, public.clientes_auto.nome_completo),
      telefone = coalesce(nullif(p_cliente->>'telefone', ''), public.clientes_auto.telefone),
      celular = coalesce(nullif(p_cliente->>'celular', ''), public.clientes_auto.celular),
      email = coalesce(nullif(p_cliente->>'email', ''), public.clientes_auto.email),
      estado_civil = coalesce(nullif(p_cliente->>'estado_civil', ''), public.clientes_auto.estado_civil),
      profissao = coalesce(nullif(p_cliente->>'profissao', ''), public.clientes_auto.profissao)
    returning id into v_cliente_id;
  end if;

  insert into public.cotacoes_auto (
    cliente_id, tipo, origem_lead, nome_cliente, cpf_cliente,
    celular_cliente, email_cliente, estado_civil_cliente, profissao_cliente,
    condutor_nome, condutor_cpf, estado_civil_condutor, cep_pernoite,
    uso_veiculo, garagem_residencia, garagem_trabalho, garagem_estudo,
    jovens_18_26, modelo_veiculo, placa, veiculo_financiado, possui_kit_gas,
    possui_blindagem, isento_imposto, seguradora_preferencial,
    seguradora_mais_barata, vigencia_inicio, vigencia_fim, status,
    referencia_origem, payload_origem, recebido_em
  ) values (
    v_cliente_id, 'novo', nullif(p_cotacao->>'origem_lead', ''),
    coalesce(nullif(p_cotacao->>'nome_cliente', ''), v_nome),
    nullif(coalesce(p_cotacao->>'cpf_cliente', v_cpf), ''),
    nullif(p_cotacao->>'celular_cliente', ''),
    nullif(p_cotacao->>'email_cliente', ''),
    nullif(p_cotacao->>'estado_civil_cliente', ''),
    nullif(p_cotacao->>'profissao_cliente', ''),
    nullif(p_cotacao->>'condutor_nome', ''),
    nullif(p_cotacao->>'condutor_cpf', ''),
    nullif(p_cotacao->>'estado_civil_condutor', ''),
    nullif(p_cotacao->>'cep_pernoite', ''),
    nullif(p_cotacao->>'uso_veiculo', ''),
    nullif(p_cotacao->>'garagem_residencia', ''),
    nullif(p_cotacao->>'garagem_trabalho', ''),
    nullif(p_cotacao->>'garagem_estudo', ''),
    nullif(p_cotacao->>'jovens_18_26', ''),
    nullif(p_cotacao->>'modelo_veiculo', ''),
    nullif(p_cotacao->>'placa', ''),
    nullif(p_cotacao->>'veiculo_financiado', ''),
    nullif(p_cotacao->>'possui_kit_gas', ''),
    nullif(p_cotacao->>'possui_blindagem', ''),
    nullif(p_cotacao->>'isento_imposto', ''),
    coalesce(p_cotacao->'seguradora_preferencial', 'null'::jsonb),
    coalesce(p_cotacao->'seguradora_mais_barata', 'null'::jsonb),
    nullif(p_cotacao->>'vigencia_inicio', '')::date,
    nullif(p_cotacao->>'vigencia_fim', '')::date,
    'pendente', v_referencia, coalesce(p_payload, '{}'::jsonb),
    coalesce(nullif(p_cotacao->>'recebido_em', '')::timestamptz, now())
  )
  on conflict (referencia_origem) where referencia_origem is not null
  do update set payload_origem = excluded.payload_origem
  returning * into v_cotacao;

  return v_cotacao;
end;
$$;

revoke all on function public.registrar_cotacao_auto_novo(jsonb, jsonb, text, jsonb) from public;
grant execute on function public.registrar_cotacao_auto_novo(jsonb, jsonb, text, jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
