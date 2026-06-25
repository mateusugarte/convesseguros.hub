-- ============================================================
-- CONVES SYSTEM - 47_faturas_imobiliaria_conferencia.sql
-- Complemento da Fase 3 do financeiro: campos de conferencia
-- da fatura mensal informada pela imobiliaria.
-- Rodar no Supabase SQL Editor apos a migracao 46.
-- ============================================================

ALTER TABLE public.faturas_imobiliaria
  ADD COLUMN IF NOT EXISTS valor_real_fatura NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS valor_fatura_calculado NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS pct_comissao NUMERIC(7,4),
  ADD COLUMN IF NOT EXISTS valor_a_pagar NUMERIC(14,2);

COMMENT ON COLUMN public.faturas_imobiliaria.valor_real_fatura IS
  'Valor real informado pela imobiliaria para conferencia, incluindo Seguro Fianca e outros componentes informados.';

COMMENT ON COLUMN public.faturas_imobiliaria.valor_fatura_calculado IS
  'Snapshot da fatura calculada pelo sistema no momento da conferencia/pagamento.';

COMMENT ON COLUMN public.faturas_imobiliaria.pct_comissao IS
  'Snapshot do percentual de repasse usado no momento da conferencia/pagamento.';

COMMENT ON COLUMN public.faturas_imobiliaria.valor_a_pagar IS
  'Snapshot do valor a pagar calculado no momento da conferencia/pagamento.';

NOTIFY pgrst, 'reload schema';
