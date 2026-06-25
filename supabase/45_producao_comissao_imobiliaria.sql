-- ============================================================
-- CONVES SYSTEM — 43_producao_comissao_imobiliaria.sql
-- Fase 2 do redesign financeiro: % de repasse por imobiliária/mês.
-- Definido manualmente pelo usuário, aplicado sobre a comissão
-- gerada da própria imobiliária no mês. Mesmo % usado na Fatura (Fase 3).
-- Rodar no Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.producao_comissao_imobiliaria (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria     TEXT NOT NULL,
  mes_referencia  DATE NOT NULL,            -- 1º dia do mês
  pct_comissao    NUMERIC,
  atualizado_por  UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (imobiliaria, mes_referencia)
);

CREATE INDEX IF NOT EXISTS idx_prod_com_imob_mes
  ON public.producao_comissao_imobiliaria(mes_referencia);

ALTER TABLE public.producao_comissao_imobiliaria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prod_com_imob_select_admin" ON public.producao_comissao_imobiliaria;
CREATE POLICY "prod_com_imob_select_admin"
ON public.producao_comissao_imobiliaria FOR SELECT
TO authenticated
USING (public.is_finance_admin());

DROP POLICY IF EXISTS "prod_com_imob_write_admin" ON public.producao_comissao_imobiliaria;
CREATE POLICY "prod_com_imob_write_admin"
ON public.producao_comissao_imobiliaria FOR ALL
TO authenticated
USING (public.is_finance_admin())
WITH CHECK (public.is_finance_admin());

NOTIFY pgrst, 'reload schema';
