-- ============================================================
-- 62_auto_pdf_mapeamentos.sql
-- Executar no Supabase SQL Editor
--
-- Configuracao da leitura de PDF por seguradora (setor AUTO).
-- Uma linha por (seguradora, tipo), onde tipo = 'cotacao' | 'apolice'.
--
-- `campos` guarda o mapeamento confirmado pelo usuario, no formato:
--   {
--     "premio_liquido": {
--       "rotulo": "PREMIO LIQUIDO",   -- ancora encontrada no PDF (pode ser null)
--       "tipo": "moeda",              -- tipo do valor esperado
--       "ocorrencia": 0,              -- qual ocorrencia da ancora/tipo usar
--       "confirmado": true,           -- usuario marcou como correto
--       "ausente": false,             -- usuario marcou que o campo nao existe neste PDF
--       "valor_exemplo": "3.450,00"
--     }
--   }
--
-- PRE-REQUISITO DE STORAGE: bucket privado "entidade-documentos" (ja criado em 14_entity_media.sql).
-- O PDF de amostra fica em entidade-documentos/seguradora/<id>/auto-pdf/<tipo>/<arquivo>.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.auto_pdf_mapeamentos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seguradora_id  UUID NOT NULL REFERENCES public.seguradoras(id) ON DELETE CASCADE,
  tipo           TEXT NOT NULL CHECK (tipo IN ('cotacao', 'apolice')),
  status         TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'concluido')),
  campos         JSONB NOT NULL DEFAULT '{}'::jsonb,
  amostra_path   TEXT,
  amostra_nome   TEXT,
  amostra_texto  TEXT,
  atualizado_por UUID REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (seguradora_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_auto_pdf_mapeamentos_tipo ON public.auto_pdf_mapeamentos(tipo);
CREATE INDEX IF NOT EXISTS idx_auto_pdf_mapeamentos_status ON public.auto_pdf_mapeamentos(status);

-- updated_at automatico
CREATE OR REPLACE FUNCTION public.fn_auto_pdf_mapeamentos_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_auto_pdf_mapeamentos_touch ON public.auto_pdf_mapeamentos;
CREATE TRIGGER tg_auto_pdf_mapeamentos_touch
  BEFORE UPDATE ON public.auto_pdf_mapeamentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_auto_pdf_mapeamentos_touch();

-- RLS: mesma politica das demais tabelas de cadastro/configuracao do projeto.
ALTER TABLE public.auto_pdf_mapeamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auto_pdf_mapeamentos_all_authenticated" ON public.auto_pdf_mapeamentos;
CREATE POLICY "auto_pdf_mapeamentos_all_authenticated"
  ON public.auto_pdf_mapeamentos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
