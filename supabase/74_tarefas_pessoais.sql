-- ============================================================
-- CONVES SYSTEM — Agenda pessoal de tarefas
-- Tarefas privadas, atribuição por administradores e histórico
-- ============================================================

create table if not exists public.task_holidays (
  holiday_date date primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 180),
  description text,
  notes text,
  task_date date not null default current_date,
  due_at timestamptz,
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'cancelled')),
  completed_at timestamptz,
  postponed_count integer not null default 0 check (postponed_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_due_matches_date check (
    due_at is null or (due_at at time zone 'America/Sao_Paulo')::date = task_date
  )
);

create table if not exists public.task_entity_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  entity_type text not null check (entity_type in ('client', 'policy')),
  entity_source text not null,
  entity_id text not null,
  entity_label text not null,
  entity_detail text,
  created_at timestamptz not null default now(),
  unique (task_id, entity_type, entity_source, entity_id)
);

create table if not exists public.task_movements (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  moved_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  from_date date not null,
  to_date date not null,
  reason text not null default 'next_business_day',
  created_at timestamptz not null default now()
);

create index if not exists idx_tasks_owner_date on public.tasks(owner_id, task_date, status);
create index if not exists idx_tasks_owner_due on public.tasks(owner_id, due_at)
  where status = 'pending' and due_at is not null;
create index if not exists idx_tasks_created_by on public.tasks(created_by, created_at desc);
create index if not exists idx_task_entity_links_task on public.task_entity_links(task_id);
create index if not exists idx_task_movements_task on public.task_movements(task_id, created_at desc);

create or replace function public.is_tasks_admin(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = user_id), false)
$$;

create or replace function public.conves_next_business_day(base_date date)
returns date
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  candidate date := base_date + 1;
begin
  while extract(isodow from candidate) in (6, 7)
     or exists (select 1 from public.task_holidays h where h.holiday_date = candidate)
  loop
    candidate := candidate + 1;
  end loop;
  return candidate;
end;
$$;

create or replace function public.touch_task_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status is distinct from 'completed' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_touch_tasks on public.tasks;
create trigger trg_touch_tasks
before update on public.tasks
for each row execute function public.touch_task_updated_at();

create or replace function public.rollover_task_to_next_business_day(target_task_id uuid)
returns public.tasks
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_task public.tasks;
  next_date date;
  due_time time;
begin
  select * into current_task
  from public.tasks
  where id = target_task_id and owner_id = auth.uid()
  for update;

  if current_task.id is null then
    raise exception 'Tarefa não encontrada ou sem permissão';
  end if;
  if current_task.status <> 'pending' then
    raise exception 'Somente tarefas pendentes podem ser repassadas';
  end if;

  next_date := public.conves_next_business_day(current_task.task_date);
  if current_task.due_at is not null then
    due_time := (current_task.due_at at time zone 'America/Sao_Paulo')::time;
  end if;

  insert into public.task_movements(task_id, moved_by, from_date, to_date)
  values (current_task.id, auth.uid(), current_task.task_date, next_date);

  update public.tasks
  set task_date = next_date,
      due_at = case
        when due_time is null then null
        else (next_date + due_time) at time zone 'America/Sao_Paulo'
      end,
      postponed_count = postponed_count + 1
  where id = current_task.id
  returning * into current_task;

  return current_task;
end;
$$;

alter table public.tasks enable row level security;
alter table public.task_entity_links enable row level security;
alter table public.task_movements enable row level security;
alter table public.task_holidays enable row level security;

drop policy if exists tasks_select_private on public.tasks;
create policy tasks_select_private on public.tasks for select to authenticated
using (owner_id = auth.uid() or created_by = auth.uid());

drop policy if exists tasks_insert_owner_or_admin on public.tasks;
create policy tasks_insert_owner_or_admin on public.tasks for insert to authenticated
with check (
  created_by = auth.uid()
  and (owner_id = auth.uid() or public.is_tasks_admin(auth.uid()))
);

drop policy if exists tasks_update_owner_or_assigner on public.tasks;
create policy tasks_update_owner_or_assigner on public.tasks for update to authenticated
using (owner_id = auth.uid() or (created_by = auth.uid() and public.is_tasks_admin(auth.uid())))
with check (owner_id = auth.uid() or (created_by = auth.uid() and public.is_tasks_admin(auth.uid())));

drop policy if exists tasks_delete_owner_or_assigner on public.tasks;
create policy tasks_delete_owner_or_assigner on public.tasks for delete to authenticated
using (owner_id = auth.uid() or (created_by = auth.uid() and public.is_tasks_admin(auth.uid())));

drop policy if exists task_links_private_all on public.task_entity_links;
create policy task_links_private_all on public.task_entity_links for all to authenticated
using (exists (
  select 1 from public.tasks t where t.id = task_id
  and (t.owner_id = auth.uid() or t.created_by = auth.uid())
))
with check (exists (
  select 1 from public.tasks t where t.id = task_id
  and (t.owner_id = auth.uid() or t.created_by = auth.uid())
));

drop policy if exists task_movements_private_select on public.task_movements;
create policy task_movements_private_select on public.task_movements for select to authenticated
using (exists (
  select 1 from public.tasks t where t.id = task_id
  and (t.owner_id = auth.uid() or t.created_by = auth.uid())
));

drop policy if exists task_movements_owner_insert on public.task_movements;
create policy task_movements_owner_insert on public.task_movements for insert to authenticated
with check (moved_by = auth.uid() and exists (
  select 1 from public.tasks t where t.id = task_id and t.owner_id = auth.uid()
));

drop policy if exists task_holidays_authenticated_select on public.task_holidays;
create policy task_holidays_authenticated_select on public.task_holidays for select to authenticated using (true);

drop policy if exists task_holidays_admin_manage on public.task_holidays;
create policy task_holidays_admin_manage on public.task_holidays for all to authenticated
using (public.is_tasks_admin(auth.uid()))
with check (public.is_tasks_admin(auth.uid()));

grant execute on function public.rollover_task_to_next_business_day(uuid) to authenticated;
grant execute on function public.conves_next_business_day(date) to authenticated;

notify pgrst, 'reload schema';
