begin;

create table if not exists public.auto_clientes_verificacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_a_id uuid not null references public.clientes_auto(id) on delete cascade,
  cliente_b_id uuid not null references public.clientes_auto(id) on delete cascade,
  decisao text not null,
  decidido_por uuid default auth.uid(),
  decidido_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auto_clientes_verificacoes_clientes_distintos_check
    check (cliente_a_id <> cliente_b_id),
  constraint auto_clientes_verificacoes_ordem_check
    check (cliente_a_id::text < cliente_b_id::text),
  constraint auto_clientes_verificacoes_decisao_check
    check (decisao in ('mesmo_cliente', 'clientes_diferentes')),
  constraint auto_clientes_verificacoes_par_unique
    unique (cliente_a_id, cliente_b_id)
);

create index if not exists idx_auto_clientes_verificacoes_decisao
  on public.auto_clientes_verificacoes(decisao, updated_at desc);

alter table public.auto_clientes_verificacoes enable row level security;

create or replace function public.touch_auto_clientes_verificacao()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.decidido_por := auth.uid();
  new.decidido_em := now();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_auto_clientes_verificacao on public.auto_clientes_verificacoes;
create trigger trg_touch_auto_clientes_verificacao
  before insert or update on public.auto_clientes_verificacoes
  for each row execute function public.touch_auto_clientes_verificacao();

drop policy if exists auto_clientes_verificacoes_all on public.auto_clientes_verificacoes;
create policy auto_clientes_verificacoes_all on public.auto_clientes_verificacoes
  for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
commit;
