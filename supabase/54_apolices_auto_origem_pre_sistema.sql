-- 54_apolices_auto_origem_pre_sistema.sql
-- Marca apólices criadas pela importação histórica da planilha de renovações
-- (antes de existir o sistema), para exibir a etiqueta "Emitida antes do
-- sistema" na UI. Executar manualmente no SQL Editor do Supabase.

ALTER TABLE apolices_auto
  ADD COLUMN IF NOT EXISTS origem_pre_sistema boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
