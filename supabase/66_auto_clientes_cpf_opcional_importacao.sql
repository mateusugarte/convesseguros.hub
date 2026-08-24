-- 66_auto_clientes_cpf_opcional_importacao.sql
-- A subida de apolices AUTO nao exige CPF. O schema original de clientes_auto
-- ainda mantinha `cpf NOT NULL`, fazendo toda linha de cliente novo sem CPF ser
-- classificada como ignorada durante a importacao.
-- Idempotente e nao destrutiva: a restricao UNIQUE continua valendo para CPFs
-- efetivamente informados, enquanto o PostgreSQL permite varios valores NULL.

begin;

alter table if exists public.clientes_auto
  alter column cpf drop not null;

notify pgrst, 'reload schema';

commit;
