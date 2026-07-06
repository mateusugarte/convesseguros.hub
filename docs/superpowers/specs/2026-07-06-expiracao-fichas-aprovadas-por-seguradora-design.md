# Expiração de fichas aprovadas por seguradora — Design

Data: 2026-07-06

## Objetivo

Hoje toda ficha não finalizada (`pendente`, `em_cotacao`, `em_analise`, `aprovado`, `emitido`) expira em 45
dias corridos desde a criação (`created_at`), calculado ao vivo em `src/lib/fichaOperational.js`. Essa regra
é genérica demais para fichas **aprovadas**: o prazo real de validade da aprovação varia por seguradora.

Este design troca a regra de expiração **apenas para fichas com `status = 'aprovado'`**: o prazo passa a
contar a partir da data de aprovação, com 30 dias corridos para Pottencial, Too e Tokio, e 45 dias corridos
para Porto. Fichas em outros status continuam com a regra antiga (45 dias desde a criação), sem mudança.

## 1. Regra de negócio

- **Escopo:** somente `status = 'aprovado'` e sem apólice emitida (`numero_apolice IS NULL`). Demais status
  (`pendente`, `em_cotacao`, `em_analise`, `emitido`) mantêm a regra atual (45 dias desde `created_at`).
- **Âncora (data de aprovação):** `finalizada_em` — já gravado no momento em que a ficha é movida para
  `aprovado` via `ModalFinalizar`/`finalizarFichaComRawData`, e não é sobrescrito depois (emissão de apólice
  grava `numero_apolice`/`data_emissao` sem tocar `finalizada_em`). Se `finalizada_em` for nulo (ficha aprovada
  fora do fluxo do modal, ex. import histórico), cai no fallback `created_at`.
- **Prazo por seguradora**, usando o mesmo agrupamento (bucket) já existente para o relatório de aprovação
  por seguradora (`Porto`, `Tokio`, `Too`, `Pottencial`, `Junto`, `Não informado`):

  | Bucket | Prazo |
  |---|---|
  | Porto | 45 dias |
  | Tokio, Too, Pottencial, Junto, Não informado | 30 dias |

  Se `dias corridos desde a âncora >= prazo` e não há apólice emitida → ficha é tratada como `Expirada`.

## 2. Cálculo ao vivo (frontend)

Fonte única continua sendo `src/lib/fichaOperational.js` (consumida por `Fichas.jsx`, `Relatorio.jsx` e
`FichaStatusBadge.jsx` via `getFichaOperationalState`/`getFichaDisplayStatus`):

- O normalizador de seguradora hoje duplicado como `normalizeSeguradoraAprovacao` (privado em `src/lib/fichas.js`,
  usado só por `fetchAprovacoesPorSeguradora`) é movido para `fichaOperational.js` como função exportada
  `normalizeSeguradoraBucket`. `fichas.js` passa a importar dali em vez de manter a cópia local — elimina a
  duplicação existente.
- Novo mapa `FICHA_EXPIRATION_DAYS_BY_SEGURADORA = { Porto: 45 }` com fallback `30` para os demais buckets.
- `isFichaExpiredOperational` passa a ramificar por status:
  - `status === 'aprovado'`: usa `finalizada_em` (fallback `created_at`) + prazo por seguradora (via
    `normalizeSeguradoraBucket` + `FICHA_EXPIRATION_DAYS_BY_SEGURADORA`).
  - qualquer outro status expirável (`pendente`, `em_cotacao`, `em_analise`, `emitido`, `expirada`): mantém a
    regra atual — `FICHA_EXPIRATION_DAYS = 45` desde `created_at`.
- Nenhuma outra tela precisa de mudança direta — todas consomem via `getFichaOperationalState`.

## 3. Persistência (SQL + pg_cron)

Nova migração `supabase/49_fichas_expiracao_por_seguradora.sql` — **criada mas não executada**, seguindo o
mesmo padrão já usado para a migração 48 (pendente de aprovação do usuário antes de rodar no Supabase SQL
Editor):

```sql
-- 1. Extensão (algumas contas Supabase exigem habilitar pg_cron pelo Dashboard
--    Database > Extensions antes deste CREATE funcionar via SQL Editor)
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
    AND COALESCE(f.finalizada_em, f.created_at) <= NOW() - (
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
```

**Trava de segurança (CLAUDE.md):** isso mexe em banco (nova extensão, função `SECURITY DEFINER`, job
agendado que grava dado). O arquivo fica pronto para revisão; a execução no Supabase SQL Editor fica
condicionada à aprovação explícita do usuário — mesmo tratamento dado à migração 48.

## 4. Riscos e casos de borda

- **`finalizada_em` nulo** (ficha aprovada por import histórico, fora do fluxo do modal): cai no fallback
  `created_at`, podendo expirar mais cedo do que o esperado para dados antigos. Aceito como comportamento
  conhecido, sem tratamento especial.
- **Rebaixamento manual**: ao arrastar uma ficha `Expirada` de volta para `Aprovada` no Kanban do Relatório
  (`buildAprovadaPatch`), `finalizada_em` não é tocado — se o prazo já tiver passado, ela pode voltar a ficar
  `Expirada` no próximo cálculo/job. Esse já é o comportamento atual do sistema (não é regressão nova).
- **Job diário vs. cálculo ao vivo**: pode haver uma janela de até 24h em que a UI já mostra `Expirada` mas o
  banco ainda tem `aprovado` — esperado, e é por isso que os dois mecanismos coexistem.

## 5. Testes

- Novo arquivo `src/lib/fichaOperational.test.mjs` cobrindo: Porto com 44/45/46 dias, Pottencial/Too/Tokio/
  Junto/Não informado com 29/30/31 dias, fallback para `created_at` quando `finalizada_em` é nulo, e
  não-regressão da regra antiga (45 dias desde `created_at`) para `pendente`/`em_cotacao`/`em_analise`/`emitido`.
- `npm test` e `npm run build` verdes antes de considerar concluído.

## Fora de escopo

- Não altera a estrutura de RLS existente em `fichas` além do necessário para a função `SECURITY DEFINER`.
- Não cria nova coluna de "data de aprovação" — reaproveita `finalizada_em`.
- Não altera o comportamento de expiração para status diferentes de `aprovado`.
