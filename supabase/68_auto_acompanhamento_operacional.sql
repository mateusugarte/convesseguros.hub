-- 68_auto_acompanhamento_operacional.sql
-- Acompanhamento ativo do setor AUTO: próximo passo, notas, follow-ups,
-- etiquetas e lembretes. Idempotente e não destrutivo.

begin;

alter table if exists public.cotacoes_auto
  add column if not exists observacoes_operacionais text,
  add column if not exists proximo_passo text,
  add column if not exists proximo_passo_em date,
  add column if not exists ultimo_followup_em timestamptz,
  add column if not exists followups_realizados integer not null default 0,
  add column if not exists tags text[] not null default '{}';

alter table if exists public.emissoes_auto
  add column if not exists observacoes_operacionais text,
  add column if not exists proximo_passo text,
  add column if not exists proximo_passo_em date,
  add column if not exists ultimo_followup_em timestamptz,
  add column if not exists followups_realizados integer not null default 0;

alter table if exists public.clientes_auto
  add column if not exists observacoes_operacionais text;

create table if not exists public.auto_interacoes (
  id uuid primary key default gen_random_uuid(),
  cotacao_id uuid references public.cotacoes_auto(id) on delete cascade,
  emissao_id uuid references public.emissoes_auto(id) on delete cascade,
  cliente_id uuid references public.clientes_auto(id) on delete set null,
  tipo text not null,
  observacao text,
  proximo_passo text,
  proximo_passo_em date,
  status_anterior text,
  status_novo text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint auto_interacoes_alvo_check check (cotacao_id is not null or emissao_id is not null or cliente_id is not null),
  constraint auto_interacoes_tipo_check check (tipo in ('contato', 'followup', 'nota', 'confirmacao', 'mudanca_status'))
);

create index if not exists idx_auto_interacoes_cotacao on public.auto_interacoes(cotacao_id, created_at desc);
create index if not exists idx_auto_interacoes_emissao on public.auto_interacoes(emissao_id, created_at desc);
create index if not exists idx_auto_interacoes_cliente on public.auto_interacoes(cliente_id, created_at desc);

create table if not exists public.auto_lembretes (
  id uuid primary key default gen_random_uuid(),
  cotacao_id uuid references public.cotacoes_auto(id) on delete cascade,
  emissao_id uuid references public.emissoes_auto(id) on delete cascade,
  renovacao_id uuid references public.renovacoes_auto(id) on delete cascade,
  cliente_id uuid references public.clientes_auto(id) on delete set null,
  titulo text not null,
  observacao text,
  data_lembrete date not null,
  avisar_antes_dias integer not null default 1,
  concluido_em timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auto_lembretes_alvo_check check (cotacao_id is not null or emissao_id is not null or renovacao_id is not null or cliente_id is not null),
  constraint auto_lembretes_aviso_check check (avisar_antes_dias between 0 and 30)
);

create index if not exists idx_auto_lembretes_pendentes
  on public.auto_lembretes(data_lembrete)
  where concluido_em is null;
create index if not exists idx_auto_lembretes_cotacao on public.auto_lembretes(cotacao_id, data_lembrete);

alter table public.auto_interacoes enable row level security;
alter table public.auto_lembretes enable row level security;

drop policy if exists auto_interacoes_all on public.auto_interacoes;
create policy auto_interacoes_all on public.auto_interacoes
  for all to authenticated using (true) with check (true);

drop policy if exists auto_lembretes_all on public.auto_lembretes;
create policy auto_lembretes_all on public.auto_lembretes
  for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
commit;
