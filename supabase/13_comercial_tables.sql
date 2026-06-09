-- ── Tabelas da Área Comercial ─────────────────────────────────────────────────
-- Migração: localStorage → Supabase para sincronização multi-dispositivo

-- Leads do pipeline comercial
CREATE TABLE IF NOT EXISTS comercial_leads (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome              TEXT        NOT NULL,
  telefone          TEXT,
  tipo              TEXT        DEFAULT 'PF',
  origem            TEXT,
  imobiliaria       TEXT,
  nome_apolice      TEXT,
  tipo_locatario    TEXT,
  coluna            TEXT        NOT NULL DEFAULT 'contato',
  tags              TEXT[]      DEFAULT '{}',
  score             INTEGER     DEFAULT 0,
  proxima_acao      TEXT,
  resumo            TEXT,
  observacoes       TEXT,
  ultima_atividade  TIMESTAMPTZ DEFAULT NOW(),
  apolice_ativa     BOOLEAN     DEFAULT FALSE,
  ja_recusou        BOOLEAN     DEFAULT FALSE,
  motivo_recusa     TEXT,
  proposta_enviada  TIMESTAMPTZ,
  venda_realizada   BOOLEAN     DEFAULT FALSE,
  historico         JSONB       DEFAULT '[]',
  criado_em         TIMESTAMPTZ DEFAULT NOW()
);

-- Vendas fechadas
CREATE TABLE IF NOT EXISTS comercial_vendas (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id          UUID        REFERENCES comercial_leads(id) ON DELETE SET NULL,
  lead_nome        TEXT,
  produto          TEXT,
  valor            NUMERIC     DEFAULT 0,
  comissao         NUMERIC     DEFAULT 0,
  data_emissao     TIMESTAMPTZ DEFAULT NOW(),
  proximo_produto  TEXT,
  observacoes      TEXT,
  criado_em        TIMESTAMPTZ DEFAULT NOW()
);

-- Eventos do calendário
CREATE TABLE IF NOT EXISTS comercial_eventos (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id    UUID        REFERENCES comercial_leads(id) ON DELETE SET NULL,
  nome       TEXT        NOT NULL,
  data       TIMESTAMPTZ NOT NULL,
  tipo       TEXT,
  descricao  TEXT,
  auto       BOOLEAN     DEFAULT FALSE,
  criado_em  TIMESTAMPTZ DEFAULT NOW()
);

-- Jornadas de venda
CREATE TABLE IF NOT EXISTS comercial_jornadas (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome          TEXT        NOT NULL,
  tipo_cliente  TEXT,
  descricao     TEXT,
  etapas        TEXT[]      DEFAULT '{}',
  criado_em     TIMESTAMPTZ DEFAULT NOW()
);

-- Scripts e materiais de apoio
CREATE TABLE IF NOT EXISTS comercial_scripts (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo    TEXT        NOT NULL,
  tipo      TEXT,
  conteudo  TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ── Índices ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_comercial_leads_user_id  ON comercial_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_comercial_leads_coluna   ON comercial_leads(coluna);
CREATE INDEX IF NOT EXISTS idx_comercial_vendas_user_id ON comercial_vendas(user_id);
CREATE INDEX IF NOT EXISTS idx_comercial_eventos_user_id ON comercial_eventos(user_id);
CREATE INDEX IF NOT EXISTS idx_comercial_eventos_data   ON comercial_eventos(data);
CREATE INDEX IF NOT EXISTS idx_comercial_jornadas_user_id ON comercial_jornadas(user_id);
CREATE INDEX IF NOT EXISTS idx_comercial_scripts_user_id ON comercial_scripts(user_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE comercial_leads    ENABLE ROW LEVEL SECURITY;
ALTER TABLE comercial_vendas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE comercial_eventos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE comercial_jornadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE comercial_scripts  ENABLE ROW LEVEL SECURITY;

-- Políticas: usuário vê e manipula apenas seus próprios dados
CREATE POLICY leads_owner    ON comercial_leads    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY vendas_owner   ON comercial_vendas   FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY eventos_owner  ON comercial_eventos  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY jornadas_owner ON comercial_jornadas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY scripts_owner  ON comercial_scripts  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
