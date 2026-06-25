-- ============================================================
-- CONVES SYSTEM — 46_faturas_imobiliaria.sql
-- Fase 3 do redesign financeiro: controle de pagamento das faturas
-- das imobiliárias. Os valores da fatura são calculados ao vivo;
-- esta tabela persiste apenas o status de pagamento (conferência).
-- Rodar no Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.faturas_imobiliaria (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria     TEXT NOT NULL,
  mes_referencia  DATE NOT NULL,            -- 1º dia do mês
  status          TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago')),
  data_pagamento  DATE,
  pago_por        UUID REFERENCES public.profiles(id),
  observacao      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (imobiliaria, mes_referencia)
);

CREATE INDEX IF NOT EXISTS idx_faturas_imob_mes
  ON public.faturas_imobiliaria(mes_referencia);

ALTER TABLE public.faturas_imobiliaria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "faturas_imob_select_admin" ON public.faturas_imobiliaria;
CREATE POLICY "faturas_imob_select_admin"
ON public.faturas_imobiliaria FOR SELECT
TO authenticated
USING (public.is_finance_admin());

DROP POLICY IF EXISTS "faturas_imob_write_admin" ON public.faturas_imobiliaria;
CREATE POLICY "faturas_imob_write_admin"
ON public.faturas_imobiliaria FOR ALL
TO authenticated
USING (public.is_finance_admin())
WITH CHECK (public.is_finance_admin());

NOTIFY pgrst, 'reload schema';
