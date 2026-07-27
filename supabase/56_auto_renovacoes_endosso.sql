-- 56_auto_renovacoes_endosso.sql
-- Lembrete de virada de mes, puxar renovacoes (banco + planilha), arrastar
-- para gestao com formulario reduzido, e cotacao de endosso.
-- Rodar manualmente no SQL Editor do Supabase (mesmo padrao das migrations anteriores).
--
-- A migration inteira roda dentro de uma transacao (BEGIN/COMMIT): ou tudo e
-- aplicado, ou nada e aplicado. Nao existe estado "meio migrado".
--
-- Antes de rodar, se falhar no CREATE UNIQUE INDEX, rode este diagnostico:
-- SELECT apolice_id, count(*) FROM renovacoes_auto WHERE apolice_id IS NOT NULL GROUP BY apolice_id HAVING count(*) > 1;
-- (as linhas retornadas sao apolices com renovacao duplicada; mantenha apenas
-- uma renovacao por apolice antes de rodar a migration de novo)

BEGIN;

-- 1. Estado do lembrete de virada de mes (um registro por mes-alvo, ex: '2026-08')
CREATE TABLE IF NOT EXISTS auto_renovacao_mes_status (
  mes_ref        text PRIMARY KEY,
  concluido_em   timestamptz,
  concluido_por  uuid REFERENCES public.profiles(id),
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE auto_renovacao_mes_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auto_renovacao_mes_status_all ON auto_renovacao_mes_status;
CREATE POLICY auto_renovacao_mes_status_all ON auto_renovacao_mes_status FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. renovacoes_auto: novos campos usados pela area "Renovacoes do mes"
ALTER TABLE renovacoes_auto
  ADD COLUMN IF NOT EXISTS origem text DEFAULT 'sistema' CHECK (origem IN ('sistema','xls','manual')),
  ADD COLUMN IF NOT EXISTS data_limite_envio date,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text,
  ADD COLUMN IF NOT EXISTS nome_segurado_anterior text,
  ADD COLUMN IF NOT EXISTS numero_apolice_anterior text,
  ADD COLUMN IF NOT EXISTS premio_liquido_anterior numeric(14,2),
  ADD COLUMN IF NOT EXISTS pct_comissao_anterior numeric(6,2);

-- Evita duplicar renovacao para a mesma apolice (linhas de XLS sem apolice_id
-- ficam com NULL, que nao colide em indice unico parcial).
CREATE UNIQUE INDEX IF NOT EXISTS renovacoes_auto_apolice_id_uidx
  ON renovacoes_auto(apolice_id) WHERE apolice_id IS NOT NULL;

-- 3. Trigger existente (fn_criar_renovacao_auto) passa a preencher os campos
-- novos automaticamente, para toda apolice inserida (nao so as puxadas
-- manualmente) ja nascer com data limite e dados do ciclo atual.
CREATE OR REPLACE FUNCTION fn_criar_renovacao_auto()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO renovacoes_auto (
    apolice_id, cliente_id, seguradora, vigencia_fim, status_cotacao, status_renovacao,
    origem, data_limite_envio, nome_segurado_anterior, numero_apolice_anterior,
    premio_liquido_anterior, pct_comissao_anterior
  )
  VALUES (
    NEW.id, NEW.cliente_id, NEW.seguradora, NEW.vigencia_fim, 'nao_cotada', 'pendente',
    'sistema', NEW.vigencia_fim - 7, NEW.nome_cliente, NEW.numero_apolice,
    NEW.premio_liquido, NEW.pct_comissao
  )
  ON CONFLICT (apolice_id) WHERE apolice_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. cotacoes_auto / emissoes_auto: novo tipo 'endosso'
ALTER TABLE cotacoes_auto DROP CONSTRAINT IF EXISTS cotacoes_auto_tipo_check;
ALTER TABLE cotacoes_auto ADD CONSTRAINT cotacoes_auto_tipo_check
  CHECK (tipo IN ('novo','renovacao','endosso'));

ALTER TABLE emissoes_auto DROP CONSTRAINT IF EXISTS emissoes_auto_tipo_check;
ALTER TABLE emissoes_auto ADD CONSTRAINT emissoes_auto_tipo_check
  CHECK (tipo IN ('novo','renovacao','endosso'));

-- 5. apolices_auto: data de emissao (novo campo do formulario reduzido)
ALTER TABLE apolices_auto ADD COLUMN IF NOT EXISTS data_emissao date;

-- 6. Endosso
CREATE TABLE IF NOT EXISTS endossos_auto (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  apolice_id      uuid REFERENCES apolices_auto(id) NOT NULL,
  cotacao_id      uuid REFERENCES cotacoes_auto(id),
  motivo          text NOT NULL,
  campo_alterado  text,
  valor_anterior  text,
  valor_atual     text,
  valor_endosso   numeric(14,2),
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE endossos_auto ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS endossos_auto_all ON endossos_auto;
CREATE POLICY endossos_auto_all ON endossos_auto FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMIT;
