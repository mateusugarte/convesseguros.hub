-- Adiciona o status 'expirada' ao CHECK constraint da coluna status
-- Rodar no SQL Editor do Supabase

ALTER TABLE public.fichas
  DROP CONSTRAINT IF EXISTS fichas_status_check;

ALTER TABLE public.fichas
  ADD CONSTRAINT fichas_status_check
  CHECK (status IN (
    'pendente',
    'em_cotacao',
    'em_analise',
    'aprovado',
    'recusado',
    'emitido',
    'cancelado',
    'cpf_invalido',
    'expirada'
  ));
