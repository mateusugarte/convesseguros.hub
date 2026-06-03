-- ============================================================
-- 10_documentos.sql
-- Executar no Supabase SQL Editor
-- PRÉ-REQUISITO: criar bucket "documentos" no Supabase Storage Dashboard
--   Settings → Storage → New bucket → nome: "documentos" → private: SIM
-- ============================================================

CREATE TABLE IF NOT EXISTS public.documentos (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  nome_arquivo   TEXT NOT NULL,
  url            TEXT NOT NULL,
  tamanho_bytes  INTEGER,
  tipo_mime      TEXT,
  -- Vínculo flexível (ao menos um deve ser preenchido)
  ficha_id       UUID REFERENCES public.fichas(id)   ON DELETE CASCADE,
  apolice_id     UUID REFERENCES public.apolices(id) ON DELETE CASCADE,
  -- CPF/CNPJ do cliente para agrupar docs por pessoa
  cpf_cnpj       TEXT,
  enviado_por    UUID REFERENCES public.profiles(id),
  CONSTRAINT documentos_vinculo_check CHECK (ficha_id IS NOT NULL OR apolice_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_documentos_ficha   ON public.documentos(ficha_id);
CREATE INDEX IF NOT EXISTS idx_documentos_apolice ON public.documentos(apolice_id);
CREATE INDEX IF NOT EXISTS idx_documentos_cpfcnpj ON public.documentos(cpf_cnpj);

ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documentos_all_authenticated"
  ON public.documentos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
