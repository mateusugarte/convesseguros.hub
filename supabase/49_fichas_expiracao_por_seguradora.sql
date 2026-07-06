-- Expira automaticamente fichas aprovadas sem apólice emitida, com prazo por
-- seguradora: Porto 45 dias, demais (Tokio/Too/Pottencial/Junto/Não informado)
-- 30 dias, contados de finalizada_em (fallback created_at).
--
-- ATENÇÃO: este arquivo cria uma extensão (pg_cron), uma função
-- SECURITY DEFINER e um job agendado. NÃO deve ser executado sem revisão e
-- aprovação explícita do usuário (ver docs/CURRENT_TASK.md e CLAUDE.md,
-- seção "Seguranca"). Rodar manualmente no SQL Editor do Supabase quando
-- aprovado.

-- 1. Extensão (algumas contas Supabase exigem habilitar pg_cron pelo
--    Dashboard > Database > Extensions antes deste CREATE funcionar)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- 2. Função SECURITY DEFINER — roda com privilégios do dono, contorna RLS
--    sem expor service_role em lugar nenhum (nenhuma chave client-side envolvida)
CREATE OR REPLACE FUNCTION public.expirar_fichas_aprovadas()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.fichas f
  SET status = 'expirada'
  WHERE f.status = 'aprovado'
    AND f.numero_apolice IS NULL
    AND f.data_emissao IS NULL
    AND COALESCE(f.finalizada_em, f.created_at) <= NOW() - (
      -- <= (nao <): no dia exato do prazo a ficha ja conta como expirada,
      -- espelhando o floor(dias) >= limite do calculo em fichaOperational.js
      CASE
        WHEN f.seguradora ILIKE '%porto%' THEN 45
        ELSE 30
      END || ' days'
    )::interval;
$$;

-- 3. Agendamento diário (06:00 UTC ~ 03:00 BRT — ajustável)
SELECT cron.schedule(
  'expirar-fichas-aprovadas-diario',
  '0 6 * * *',
  $$SELECT public.expirar_fichas_aprovadas();$$
);
