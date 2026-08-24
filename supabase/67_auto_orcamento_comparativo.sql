-- ============================================================
-- 67_auto_orcamento_comparativo.sql
-- Executar no Supabase SQL Editor DEPOIS da migration 66.
--
-- Modulo de Orcamento Comparativo (setor AUTO):
--   1. cor de destaque por seguradora        (spec secao 3 e 9)
--   2. repositorio de Condicoes Gerais       (spec secao 8)
--   3. persistencia do orcamento em JSON     (spec secao 11)
--
-- Decisao de modelagem: o orcamento guarda o JSON ESTRUTURADO de cada cotacao
-- (schema da secao 5), nao so o PDF final. Motivo — sem o JSON nao da para
-- reabrir/editar um orcamento gerado nem auditar o que foi prometido ao cliente;
-- com ele, o PDF vira uma projecao descartavel que pode ser regerada quando o
-- layout mudar. E o mesmo principio ja usado em `auto_pdf_mapeamentos.campos`.
--
-- PRE-REQUISITO DE STORAGE: bucket privado "entidade-documentos" (14_entity_media.sql).
-- Condicoes Gerais ficam em entidade-documentos/seguradora/<id>/condicoes-gerais/<arquivo>.
-- ============================================================

-- ─── 1. Cor de destaque da seguradora ───────────────────────────────────
-- Usada na faixa do topo do card no PDF. A cor pertence a IDENTIDADE da
-- seguradora, nao ao papel ("atual" x "outra") — trocar a ordem das duas no
-- comparativo nao pode trocar as cores. Ver `corDaSeguradora` em
-- src/lib/orcamentoComparativo.js, que ja funciona sem esta coluna (mapa de
-- fallback por nome canonico) e passa a preferi-la assim que ela existir.

ALTER TABLE public.seguradoras
  ADD COLUMN IF NOT EXISTS cor_destaque TEXT;

-- Aceita apenas hex de 6 digitos (ou nulo). Sem isso, um valor invalido so
-- apareceria como faixa transparente no PDF ja entregue ao cliente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'seguradoras_cor_destaque_check'
  ) THEN
    ALTER TABLE public.seguradoras
      ADD CONSTRAINT seguradoras_cor_destaque_check
      CHECK (cor_destaque IS NULL OR cor_destaque ~* '^#[0-9a-f]{6}$');
  END IF;
END $$;

-- Semente das duas seguradoras ja validadas no mockup. Idempotente e nao
-- sobrescreve cor que alguem ja tenha ajustado a mao.
UPDATE public.seguradoras SET cor_destaque = '#956e26'
  WHERE cor_destaque IS NULL AND lower(nome_canonico) LIKE '%tokio%';
UPDATE public.seguradoras SET cor_destaque = '#1b4782'
  WHERE cor_destaque IS NULL AND lower(nome_canonico) LIKE '%porto%';

-- ─── 2. Condicoes Gerais por seguradora ─────────────────────────────────
-- Uma linha por versao. `vigente` marca a que o orcamento deve consultar.
-- Historico de versoes e "recomendado, nao obrigatorio no MVP" (spec secao 8) —
-- manter linhas antigas com vigente=false custa nada e evita perder a referencia
-- de um orcamento gerado no passado.

CREATE TABLE IF NOT EXISTS public.seguradora_condicoes_gerais (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seguradora_id  UUID NOT NULL REFERENCES public.seguradoras(id) ON DELETE CASCADE,
  referencia     TEXT NOT NULL,            -- ex.: 'Porto Seguro Auto Senior CG144'
  arquivo_path   TEXT,                     -- caminho no bucket entidade-documentos
  arquivo_nome   TEXT,
  texto_extraido TEXT,                     -- cache do texto, para a leitura da secao 8
  regras         JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- `regras` guarda o que foi extraido por categoria de cobertura, no formato:
  --   { "assistencia": "guincho limitado a 5x no intervalo de 1 ano", ... }
  -- As chaves sao as mesmas de CATEGORIAS_COBERTURA no modulo JS.
  vigente        BOOLEAN NOT NULL DEFAULT TRUE,
  anexada_em     DATE NOT NULL DEFAULT CURRENT_DATE,
  atualizado_por UUID REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cond_gerais_seguradora ON public.seguradora_condicoes_gerais(seguradora_id);

-- No maximo uma versao vigente por seguradora.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cond_gerais_vigente
  ON public.seguradora_condicoes_gerais(seguradora_id) WHERE vigente;

-- ─── 3. Orcamentos comparativos ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.auto_orcamentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referencia      TEXT NOT NULL UNIQUE,     -- CV-AAAA-NNNN
  ano             INTEGER NOT NULL,
  sequencial      INTEGER NOT NULL,

  -- Vinculo opcional: o orcamento pode nascer de uma cotacao ja existente no
  -- funil ou ser avulso (cliente novo que ainda nao virou cotacao no sistema).
  cotacao_id      UUID REFERENCES public.cotacoes_auto(id) ON DELETE SET NULL,
  cliente_id      UUID REFERENCES public.clientes_auto(id) ON DELETE SET NULL,

  seguradora_atual_id  UUID REFERENCES public.seguradoras(id) ON DELETE SET NULL,
  seguradora_outra_id  UUID REFERENCES public.seguradoras(id) ON DELETE SET NULL,

  -- Denormalizado de proposito: o orcamento e um documento entregue ao cliente e
  -- precisa continuar legivel mesmo que o cadastro do cliente mude depois.
  segurado_nome   TEXT,
  veiculo         TEXT,
  placa           TEXT,
  tipo_operacao   TEXT CHECK (tipo_operacao IN ('novo', 'renovacao', 'endosso')),

  -- Os dois JSON no schema da secao 5, ja revisados pelo corretor.
  dados_atual     JSONB NOT NULL DEFAULT '{}'::jsonb,
  dados_outra     JSONB NOT NULL DEFAULT '{}'::jsonb,

  premio_total_atual  NUMERIC(14,2),
  premio_total_outra  NUMERIC(14,2),

  pdf_path        TEXT,
  pdf_nome        TEXT,
  emitido_em      DATE NOT NULL DEFAULT CURRENT_DATE,
  validade_dias   INTEGER NOT NULL DEFAULT 5,

  status          TEXT NOT NULL DEFAULT 'rascunho'
                  CHECK (status IN ('rascunho', 'gerado', 'enviado', 'cancelado')),
  criado_por      UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ano, sequencial)
);

CREATE INDEX IF NOT EXISTS idx_auto_orcamentos_cotacao ON public.auto_orcamentos(cotacao_id);
CREATE INDEX IF NOT EXISTS idx_auto_orcamentos_cliente ON public.auto_orcamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_auto_orcamentos_status  ON public.auto_orcamentos(status);
CREATE INDEX IF NOT EXISTS idx_auto_orcamentos_emitido ON public.auto_orcamentos(emitido_em DESC);

-- ─── Numero de referencia sequencial por ano ────────────────────────────
-- Alocado no banco, dentro de uma transacao, e nao no front. Dois corretores
-- gerando orcamento ao mesmo tempo pelo front produziriam o mesmo CV-2026-0817;
-- o UNIQUE(ano, sequencial) rejeitaria o segundo com erro cru. Aqui o segundo
-- so pega o proximo numero.

CREATE OR REPLACE FUNCTION public.proximo_numero_orcamento_auto(p_ano INTEGER DEFAULT NULL)
RETURNS TABLE (ano INTEGER, sequencial INTEGER, referencia TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano INTEGER := COALESCE(p_ano, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);
  v_seq INTEGER;
BEGIN
  -- Lock por ano: serializa apenas quem esta gerando orcamento no mesmo ano.
  PERFORM pg_advisory_xact_lock(hashtext('auto_orcamentos'), v_ano);

  SELECT COALESCE(MAX(o.sequencial), 0) + 1 INTO v_seq
  FROM public.auto_orcamentos o WHERE o.ano = v_ano;

  RETURN QUERY SELECT v_ano, v_seq, 'CV-' || v_ano || '-' || lpad(v_seq::TEXT, 4, '0');
END $$;

-- ─── updated_at automatico ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_auto_orcamentos_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_auto_orcamentos_touch ON public.auto_orcamentos;
CREATE TRIGGER tg_auto_orcamentos_touch
  BEFORE UPDATE ON public.auto_orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_auto_orcamentos_touch();

DROP TRIGGER IF EXISTS tg_cond_gerais_touch ON public.seguradora_condicoes_gerais;
CREATE TRIGGER tg_cond_gerais_touch
  BEFORE UPDATE ON public.seguradora_condicoes_gerais
  FOR EACH ROW EXECUTE FUNCTION public.fn_auto_orcamentos_touch();

-- ─── RLS ────────────────────────────────────────────────────────────────
-- Mesma politica das demais tabelas de cadastro/operacao do projeto:
-- permissiva para autenticados, fechada para anon. As duas tabelas carregam
-- dado pessoal de cliente (nome, CPF dentro do JSONB), entao RLS ligada nao e
-- opcional — sem ela o anon key le a base inteira.

ALTER TABLE public.seguradora_condicoes_gerais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cond_gerais_all_authenticated" ON public.seguradora_condicoes_gerais;
CREATE POLICY "cond_gerais_all_authenticated"
  ON public.seguradora_condicoes_gerais FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

ALTER TABLE public.auto_orcamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auto_orcamentos_all_authenticated" ON public.auto_orcamentos;
CREATE POLICY "auto_orcamentos_all_authenticated"
  ON public.auto_orcamentos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

REVOKE ALL ON FUNCTION public.proximo_numero_orcamento_auto(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proximo_numero_orcamento_auto(INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';
