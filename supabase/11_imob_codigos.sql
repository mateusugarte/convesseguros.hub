-- ============================================================
-- 11_imob_codigos.sql
-- Executar no Supabase SQL Editor
-- ============================================================

-- Códigos da imobiliária por seguradora (ex: código de corretora usado em cada seguradora)
CREATE TABLE IF NOT EXISTS public.imobiliaria_codigos (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL REFERENCES public.imobiliarias(id) ON DELETE CASCADE,
  seguradora_id  UUID NOT NULL REFERENCES public.seguradoras(id)  ON DELETE CASCADE,
  codigo         TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (imobiliaria_id, seguradora_id)
);

CREATE INDEX IF NOT EXISTS idx_imobcod_imob ON public.imobiliaria_codigos(imobiliaria_id);
CREATE INDEX IF NOT EXISTS idx_imobcod_seg  ON public.imobiliaria_codigos(seguradora_id);

ALTER TABLE public.imobiliaria_codigos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "imobiliaria_codigos_all_authenticated"
  ON public.imobiliaria_codigos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
