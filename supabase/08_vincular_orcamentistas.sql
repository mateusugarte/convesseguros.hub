-- ============================================================
-- CONVES SYSTEM — 08_vincular_orcamentistas.sql
-- 1. Adiciona coluna finalizado_por
-- 2. Vincula orcamentista_id para fichas históricas
-- 3. Popula finalizado_por para fichas já finalizadas
-- ============================================================
-- ORDEM: rodar APÓS 07_status_expirada.sql e APÓS ter profiles criados
-- ============================================================

-- ------------------------------------------------------------
-- 1. Adicionar coluna finalizado_por
--    Registra QUEM finalizou a ficha (pode ser diferente de quem assumiu)
-- ------------------------------------------------------------
ALTER TABLE public.fichas
  ADD COLUMN IF NOT EXISTS finalizado_por UUID REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_fichas_finalizado_por ON public.fichas(finalizado_por);

-- ------------------------------------------------------------
-- 2. Vincular orcamentista_id para fichas onde orcamentista_forms
--    bate com orcamentista_label do profile (direto ou por alias)
-- ------------------------------------------------------------
UPDATE public.fichas f
SET
  orcamentista_id = p.id,
  assumida        = TRUE,
  assumida_em     = COALESCE(f.assumida_em, f.created_at)
FROM public.profiles p
WHERE p.orcamentista_label = CASE UPPER(TRIM(f.orcamentista_forms))
    -- Aliases conhecidos
    WHEN 'DAY'    THEN 'DAYANA'
    WHEN 'LAS'    THEN 'LAIS'
    -- Qualquer outro valor: usar direto (TRIM remove espaços extras)
    ELSE UPPER(TRIM(f.orcamentista_forms))
  END
  AND f.orcamentista_id IS NULL
  AND f.orcamentista_forms IS NOT NULL;

-- Verificar quantas fichas foram vinculadas:
-- SELECT COUNT(*) FROM public.fichas WHERE orcamentista_id IS NOT NULL AND assumida = TRUE;

-- ------------------------------------------------------------
-- 3. Popular finalizado_por para fichas já finalizadas
--    (retroativo: usar orcamentista_id como finalizado_por)
-- ------------------------------------------------------------
UPDATE public.fichas
SET finalizado_por = orcamentista_id
WHERE status IN ('aprovado','recusado','emitido','cancelado','cpf_invalido','em_analise','expirada')
  AND orcamentista_id IS NOT NULL
  AND finalizado_por IS NULL;

-- Verificar distribuição após migração:
SELECT
  p.nome,
  COUNT(*) FILTER (WHERE f.status = 'em_cotacao')                                       AS em_cotacao,
  COUNT(*) FILTER (WHERE f.status IN ('aprovado','recusado','emitido','cancelado','cpf_invalido','em_analise','expirada')) AS finalizadas,
  COUNT(*) AS total
FROM public.fichas f
JOIN public.profiles p ON p.id = f.orcamentista_id
GROUP BY p.nome
ORDER BY total DESC;
