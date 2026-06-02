-- ============================================================
-- 09_apolices_kanban.sql
-- Executar no Supabase SQL Editor
-- ============================================================

-- 1. Relaxar NOT NULL em apolices para suportar criação via kanban
--    (numero_apolice, seguradora, data_emissao preenchidos depois)
ALTER TABLE public.apolices
  ALTER COLUMN numero_apolice DROP NOT NULL,
  ALTER COLUMN seguradora     DROP NOT NULL,
  ALTER COLUMN data_emissao   DROP NOT NULL;

-- 2. Remover CHECK constraint antiga de seguradora (inclui todos os nomes usados)
ALTER TABLE public.apolices DROP CONSTRAINT IF EXISTS apolices_seguradora_check;

-- 3. Adicionar colunas de kanban (se não existirem)
ALTER TABLE public.apolices
  ADD COLUMN IF NOT EXISTS status_emissao      TEXT DEFAULT 'recebida'
    CHECK (status_emissao IN ('recebida','proposta_transmitida','emitida','enviada')),
  ADD COLUMN IF NOT EXISTS data_transmissao    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proprietario_nome   TEXT,
  ADD COLUMN IF NOT EXISTS proprietario_cel    TEXT,
  ADD COLUMN IF NOT EXISTS numero_proposta     TEXT,
  ADD COLUMN IF NOT EXISTS endereco            TEXT,
  ADD COLUMN IF NOT EXISTS inicio_vigencia     DATE,
  ADD COLUMN IF NOT EXISTS fim_vigencia        DATE,
  ADD COLUMN IF NOT EXISTS tempo_vigencia_meses INTEGER,
  ADD COLUMN IF NOT EXISTS forma_pagamento     TEXT,
  ADD COLUMN IF NOT EXISTS produto             TEXT;

-- 4. Campos nas fichas: numero_orcamento e valor_parcela
ALTER TABLE public.fichas
  ADD COLUMN IF NOT EXISTS numero_orcamento TEXT,
  ADD COLUMN IF NOT EXISTS valor_parcela    NUMERIC;

-- 5. Tabela de seguradoras (mesmo padrão que imobiliarias)
CREATE TABLE IF NOT EXISTS public.seguradoras (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_canonico TEXT NOT NULL UNIQUE,
  ativa         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.seguradora_aliases (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seguradora_id  UUID NOT NULL REFERENCES public.seguradoras(id) ON DELETE CASCADE,
  alias          TEXT NOT NULL UNIQUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seguradora_aliases_seg ON public.seguradora_aliases(seguradora_id);

-- 6. Seguradoras por imobiliária
CREATE TABLE IF NOT EXISTS public.imobiliaria_seguradoras (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL REFERENCES public.imobiliarias(id) ON DELETE CASCADE,
  seguradora_id  UUID NOT NULL REFERENCES public.seguradoras(id) ON DELETE CASCADE,
  UNIQUE (imobiliaria_id, seguradora_id)
);

-- 7. RLS — tabelas de seguradoras (permissive para autenticados)
ALTER TABLE public.seguradoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seguradora_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imobiliaria_seguradoras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seguradoras_all_authenticated"
  ON public.seguradoras FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "seguradora_aliases_all_authenticated"
  ON public.seguradora_aliases FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "imobiliaria_seguradoras_all_authenticated"
  ON public.imobiliaria_seguradoras FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. Seed das seguradoras iniciais
INSERT INTO public.seguradoras (nome_canonico) VALUES
  ('Porto Seguro'),
  ('Pottencial Seguros'),
  ('TOO Seguros'),
  ('Junto Seguros'),
  ('Tokio Marine')
ON CONFLICT (nome_canonico) DO NOTHING;

-- Aliases para cada seguradora
INSERT INTO public.seguradora_aliases (seguradora_id, alias)
SELECT id, alias FROM (VALUES
  ('Porto Seguro',      'PORTO'),
  ('Porto Seguro',      'Porto Seguros'),
  ('Porto Seguro',      'PORTO SEGURO'),
  ('Pottencial Seguros','Pottencial'),
  ('Pottencial Seguros','POTTENCIAL'),
  ('Pottencial Seguros','Potencial'),
  ('TOO Seguros',       'TOO'),
  ('Junto Seguros',     'JUNTO'),
  ('Junto Seguros',     'Junto'),
  ('Tokio Marine',      'TOKIO'),
  ('Tokio Marine',      'TOKIO MARINE')
) AS t(nome, alias)
JOIN public.seguradoras s ON s.nome_canonico = t.nome
ON CONFLICT (alias) DO NOTHING;
