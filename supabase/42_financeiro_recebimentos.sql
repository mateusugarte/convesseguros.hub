-- ============================================================
-- CONVES SYSTEM — 42_financeiro_recebimentos.sql
-- Fase 1 do redesign financeiro: agenda mês a mês da comissão
-- recebida estimada + status_apolice no ledger.
-- Rodar no Supabase SQL Editor.
-- ============================================================

-- 1. status_apolice no ledger (permite excluir canceladas/expiradas)
ALTER TABLE public.apolices_comissoes
  ADD COLUMN IF NOT EXISTS status_apolice TEXT;

UPDATE public.apolices_comissoes ac
SET status_apolice = COALESCE(a.status_apolice, 'ativa')
FROM public.apolices a
WHERE a.id = ac.apolice_id;

-- 2. Tabela da agenda de recebimentos (1 linha por parcela)
CREATE TABLE IF NOT EXISTS public.comissoes_recebimentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apolice_id      UUID NOT NULL REFERENCES public.apolices(id) ON DELETE CASCADE,
  numero_parcela  INTEGER NOT NULL,
  total_parcelas  INTEGER NOT NULL,
  mes_referencia  DATE NOT NULL,
  valor_previsto  NUMERIC NOT NULL,
  seguradora      TEXT,
  imobiliaria     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (apolice_id, numero_parcela)
);

CREATE INDEX IF NOT EXISTS idx_com_receb_mes     ON public.comissoes_recebimentos(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_com_receb_apolice ON public.comissoes_recebimentos(apolice_id);
CREATE INDEX IF NOT EXISTS idx_com_receb_imob    ON public.comissoes_recebimentos(imobiliaria);
CREATE INDEX IF NOT EXISTS idx_com_receb_seg     ON public.comissoes_recebimentos(seguradora);

ALTER TABLE public.comissoes_recebimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "com_receb_select_admin" ON public.comissoes_recebimentos;
CREATE POLICY "com_receb_select_admin"
ON public.comissoes_recebimentos FOR SELECT
TO authenticated
USING (public.is_finance_admin());

DROP POLICY IF EXISTS "com_receb_write_admin" ON public.comissoes_recebimentos;
CREATE POLICY "com_receb_write_admin"
ON public.comissoes_recebimentos FOR ALL
TO authenticated
USING (public.is_finance_admin())
WITH CHECK (public.is_finance_admin());

-- 3. Função que (re)gera as parcelas de uma apólice e sincroniza status_apolice no ledger
CREATE OR REPLACE FUNCTION public.fn_sync_apolice_recebimentos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parcelas integer;
  v_comissao numeric;
  v_base date;
BEGIN
  -- Mantém status_apolice atualizado no ledger (linha criada pelo trigger tg_sync_apolice_comissao).
  -- DEPENDÊNCIA DE ORDEM: triggers FOR EACH ROW do mesmo tipo disparam em ordem
  -- alfabética de nome. tg_sync_apolice_comissao ('c') roda ANTES de
  -- tg_sync_apolice_recebimentos ('r'), garantindo que a linha do ledger já exista
  -- aqui. Se algum desses triggers for renomeado, este UPDATE vira no-op silencioso.
  UPDATE public.apolices_comissoes
     SET status_apolice = COALESCE(NEW.status_apolice, 'ativa'),
         updated_at = NOW()
   WHERE apolice_id = NEW.id;

  -- Sempre limpa as parcelas existentes da apólice antes de regenerar
  DELETE FROM public.comissoes_recebimentos WHERE apolice_id = NEW.id;

  v_parcelas := GREATEST(COALESCE(NULLIF(NEW.parcelamento::text, '')::integer, 1), 1);
  v_comissao := public.to_numeric_safe(NEW.valor_comissao::text);
  v_base := date_trunc('month', NEW.data_emissao)::date;

  IF NEW.status_emissao IN ('emitida', 'enviada')
     AND COALESCE(NEW.status_apolice, 'ativa') IN ('ativa', 'renovada')
     AND NEW.data_emissao IS NOT NULL
     AND v_comissao IS NOT NULL
     AND v_comissao > 0 THEN

    INSERT INTO public.comissoes_recebimentos (
      apolice_id, numero_parcela, total_parcelas, mes_referencia,
      valor_previsto, seguradora, imobiliaria
    )
    SELECT
      NEW.id,
      n,
      v_parcelas,
      (v_base + make_interval(months => n::int))::date,   -- 1ª parcela no mês seguinte
      CASE
        WHEN n < v_parcelas THEN round(v_comissao / v_parcelas, 2)
        ELSE v_comissao - round(v_comissao / v_parcelas, 2) * (v_parcelas - 1)
      END,
      NEW.seguradora,
      NEW.imobiliaria
    FROM generate_series(1, v_parcelas) AS n;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_sync_apolice_recebimentos ON public.apolices;
CREATE TRIGGER tg_sync_apolice_recebimentos
AFTER INSERT OR UPDATE ON public.apolices
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_apolice_recebimentos();

-- 4. Backfill das parcelas para apólices já existentes
INSERT INTO public.comissoes_recebimentos (
  apolice_id, numero_parcela, total_parcelas, mes_referencia,
  valor_previsto, seguradora, imobiliaria
)
SELECT
  a.id,
  n,
  GREATEST(COALESCE(NULLIF(a.parcelamento::text,'')::integer, 1), 1),
  (date_trunc('month', a.data_emissao)::date + make_interval(months => n::int))::date,
  CASE
    WHEN n < GREATEST(COALESCE(NULLIF(a.parcelamento::text,'')::integer, 1), 1)
      THEN round(public.to_numeric_safe(a.valor_comissao::text)
                 / GREATEST(COALESCE(NULLIF(a.parcelamento::text,'')::integer, 1), 1), 2)
    ELSE public.to_numeric_safe(a.valor_comissao::text)
       - round(public.to_numeric_safe(a.valor_comissao::text)
               / GREATEST(COALESCE(NULLIF(a.parcelamento::text,'')::integer, 1), 1), 2)
         * (GREATEST(COALESCE(NULLIF(a.parcelamento::text,'')::integer, 1), 1) - 1)
  END,
  a.seguradora,
  a.imobiliaria
FROM public.apolices a
CROSS JOIN LATERAL generate_series(
  1, GREATEST(COALESCE(NULLIF(a.parcelamento::text,'')::integer, 1), 1)
) AS n
WHERE a.status_emissao IN ('emitida','enviada')
  AND COALESCE(a.status_apolice, 'ativa') IN ('ativa','renovada')
  AND a.data_emissao IS NOT NULL
  AND public.to_numeric_safe(a.valor_comissao::text) IS NOT NULL
  AND public.to_numeric_safe(a.valor_comissao::text) > 0
ON CONFLICT (apolice_id, numero_parcela) DO NOTHING;

NOTIFY pgrst, 'reload schema';
