-- ============================================================
-- 72_auto_orcamento_rascunho.sql
-- Executar no Supabase SQL Editor DEPOIS da migration 71.
--
-- Motivo: o workspace do orcamento comparativo (AutoQuoteComparison) vivia
-- inteiro em memoria do navegador. Sair da rota da cotacao destruia o
-- componente e com ele o upload, a leitura do PDF e toda a revisao ja
-- conferida pelo corretor — foi a queixa "o sistema de salvar cotacoes nao
-- esta funcionando".
--
-- O front ja grava esse rascunho no localStorage e funciona sem esta
-- migration; o que ela acrescenta e a copia DURAVEL e entre dispositivos:
-- comecar a cotacao no notebook e terminar em outra maquina.
--
-- Idempotente e nao destrutiva: so acrescenta uma coluna anulavel.
--
-- Conteudo de `orcamento_rascunho` (jsonb):
--   {
--     "versao": 1,
--     "salvo_em": "2026-08-31T13:40:00.000Z",
--     "step": "review",
--     "lados": {
--       "atual":       { "seguradora", "arquivo_nome", "parser_id", "campos", "leitura" },
--       "concorrente": { ... }
--     }
--   }
-- O PDF em si NAO e gravado aqui — so o nome do arquivo e a cotacao ja
-- extraida dele. Formato definido e testado em src/lib/autoQuoteDraft.js.
--
-- Privacidade: o JSON carrega dado pessoal do segurado e do condutor (nome,
-- CPF) — os mesmos que a propria linha de `cotacoes_auto` ja guarda em colunas
-- proprias. Nenhuma categoria nova de dado e introduzida e a RLS da tabela
-- continua sendo a unica porta de acesso; nada aqui afrouxa politica alguma.
-- ============================================================

begin;

alter table if exists public.cotacoes_auto
  add column if not exists orcamento_rascunho jsonb;

comment on column public.cotacoes_auto.orcamento_rascunho is
  'Rascunho do orcamento comparativo (upload, leitura e revisao ainda nao finalizados). Formato em src/lib/autoQuoteDraft.js.';

commit;

-- Sem esta linha o PostgREST continua respondendo "Could not find the
-- 'orcamento_rascunho' column of 'cotacoes_auto' in the schema cache" mesmo
-- depois do ALTER TABLE — mesma pegadinha ja documentada na migration 61.
notify pgrst, 'reload schema';
