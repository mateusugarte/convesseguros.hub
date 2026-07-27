-- 57_zerar_dados_auto.sql
-- APAGA TODO o historico transacional do setor Auto (clientes, cotacoes,
-- emissoes, apolices, renovacoes e endossos), para a equipe recomecar
-- alimentando o sistema manualmente, um cliente/apolice por vez.
--
-- ATENCAO: isso e uma acao destrutiva e IRREVERSIVEL sobre dados reais,
-- incluindo dados pessoais de clientes (nome, CPF, telefone, etc). Antes de
-- rodar, confirme que e exatamente isso que quer.
--
-- Rodar manualmente no SQL Editor do Supabase (mesmo padrao de todas as
-- migrations anteriores). Nao ha nada para o app assumir depois de rodar:
-- as telas do modulo Auto ja lidam normalmente com listas vazias.
--
-- O script primeiro faz uma copia de seguranca de cada tabela (sufixo
-- _backup_20260727) antes de qualquer DELETE. Se precisar recuperar algo,
-- os dados originais continuam ali, ex.:
--   SELECT * FROM clientes_auto_backup_20260727;
-- As tabelas de backup NAO sao apagadas por este script -- remova-as
-- manualmente mais tarde, quando tiver certeza que nao precisa mais delas:
--   DROP TABLE clientes_auto_backup_20260727, cotacoes_auto_backup_20260727,
--     emissoes_auto_backup_20260727, apolices_auto_backup_20260727,
--     renovacoes_auto_backup_20260727; -- + endossos_auto_backup_20260727 se existir

BEGIN;

-- 1. Backup (copia completa de cada tabela, antes de qualquer DELETE)
CREATE TABLE IF NOT EXISTS clientes_auto_backup_20260727 AS TABLE clientes_auto;
CREATE TABLE IF NOT EXISTS cotacoes_auto_backup_20260727 AS TABLE cotacoes_auto;
CREATE TABLE IF NOT EXISTS emissoes_auto_backup_20260727 AS TABLE emissoes_auto;
CREATE TABLE IF NOT EXISTS apolices_auto_backup_20260727 AS TABLE apolices_auto;
CREATE TABLE IF NOT EXISTS renovacoes_auto_backup_20260727 AS TABLE renovacoes_auto;

-- endossos_auto e auto_renovacao_mes_status so existem se a migration 56 ja
-- rodou -- backup condicional para o script funcionar nos dois cenarios.
DO $$
BEGIN
  IF to_regclass('public.endossos_auto') IS NOT NULL THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS endossos_auto_backup_20260727 AS TABLE endossos_auto';
  END IF;
  IF to_regclass('public.auto_renovacao_mes_status') IS NOT NULL THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS auto_renovacao_mes_status_backup_20260727 AS TABLE auto_renovacao_mes_status';
  END IF;
END
$$;

-- 2. Apagar em ordem (tabelas-filhas antes das tabelas-pai, respeitando as
-- foreign keys: endossos_auto -> apolices_auto/cotacoes_auto;
-- renovacoes_auto -> apolices_auto/clientes_auto; apolices_auto ->
-- emissoes_auto/clientes_auto; emissoes_auto -> cotacoes_auto/clientes_auto;
-- cotacoes_auto -> clientes_auto).
DO $$
BEGIN
  IF to_regclass('public.endossos_auto') IS NOT NULL THEN
    EXECUTE 'DELETE FROM endossos_auto';
  END IF;
  IF to_regclass('public.auto_renovacao_mes_status') IS NOT NULL THEN
    EXECUTE 'DELETE FROM auto_renovacao_mes_status';
  END IF;
END
$$;

DELETE FROM renovacoes_auto;
DELETE FROM apolices_auto;
DELETE FROM emissoes_auto;
DELETE FROM cotacoes_auto;
DELETE FROM clientes_auto;

COMMIT;
