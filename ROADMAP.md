# ROADMAP.md — Sistema de Gestão de Fichas — Conves

> Projeto real e evolutivo. Cada fase entrega valor imediato e serve de base para a próxima.

---

## FASE 1 — Supabase: Banco e Autenticação
> Base de tudo. Nenhuma linha de frontend antes dessa fase estar completa e testada.

### 1.1 Criar projeto Supabase
- [ ] Novo projeto → salvar `Project URL`, `anon key`, `service_role key`
- [ ] `service_role` → apenas no n8n. Nunca no frontend.

### 1.2 Tabela `profiles`
```sql
CREATE TABLE public.profiles (
  id                 UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nome               TEXT NOT NULL,
  orcamentista_label TEXT NOT NULL, -- ex: "DAVI", "EDU" — mesmo valor do Google Forms
  created_at         TIMESTAMP DEFAULT NOW()
);
```

### 1.3 Tabela `fichas`
```sql
CREATE TABLE public.fichas (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at         TIMESTAMP DEFAULT NOW(),
  produto            TEXT NOT NULL CHECK (produto IN ('residencial_pf','comercial_pf','pessoa_juridica')),

  -- Dados do formulário
  imobiliaria        TEXT,
  nome_interessado   TEXT,
  cpf                TEXT,
  celular            TEXT,
  email              TEXT,
  cep                TEXT,
  valor_aluguel      NUMERIC,
  valor_iptu         NUMERIC,
  valor_condominio   NUMERIC,
  tipo_imovel        TEXT,
  observacoes        TEXT,
  orcamentista_forms TEXT,

  -- Controle de status
  status             TEXT NOT NULL DEFAULT 'pendente'
                     CHECK (status IN (
                       'pendente','em_cotacao','em_analise',
                       'aprovado','recusado','emitido','cancelado','cpf_invalido'
                     )),

  -- Assumir ficha
  assumida           BOOLEAN DEFAULT FALSE,
  orcamentista_id    UUID REFERENCES public.profiles(id),
  assumida_em        TIMESTAMP,

  -- Finalizar ficha
  seguradora         TEXT,
  retorno_enviado    BOOLEAN DEFAULT FALSE,
  finalizada_em      TIMESTAMP,

  -- Backup completo do webhook
  raw_data           JSONB
);
```

### 1.4 Índices
```sql
CREATE INDEX idx_fichas_produto      ON public.fichas(produto);
CREATE INDEX idx_fichas_status       ON public.fichas(status);
CREATE INDEX idx_fichas_imobiliaria  ON public.fichas(imobiliaria);
CREATE INDEX idx_fichas_created_at   ON public.fichas(created_at);
CREATE INDEX idx_fichas_orcamentista ON public.fichas(orcamentista_id);
```

### 1.5 RLS
```sql
-- Ativar
ALTER TABLE public.fichas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles  ENABLE ROW LEVEL SECURITY;

-- fichas: leitura para autenticados
CREATE POLICY "auth_select_fichas"
ON public.fichas FOR SELECT TO authenticated USING (true);

-- fichas: insert apenas service_role (n8n)
CREATE POLICY "service_insert_fichas"
ON public.fichas FOR INSERT TO service_role WITH CHECK (true);

-- fichas: update para autenticados (assumir e finalizar)
CREATE POLICY "auth_update_fichas"
ON public.fichas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- profiles: leitura de todos (exibir nome do orçamentista)
CREATE POLICY "auth_select_profiles"
ON public.profiles FOR SELECT TO authenticated USING (true);
```

### 1.6 Criar os 4 usuários
```
Supabase → Authentication → Users → Add user
Após criar cada um, inserir em profiles:

INSERT INTO public.profiles (id, nome, orcamentista_label) VALUES
  ('[uuid-1]', 'Davi',   'DAVI'),
  ('[uuid-2]', 'Edu',    'EDU'),
  ('[uuid-3]', 'Laís',   'LAIS'),
  ('[uuid-4]', 'Dayana', 'DAYANA');
```

### 1.7 Configurar n8n (1 fluxo por produto)
```
Webhook → HTTP Request POST Supabase
URL: https://[projeto].supabase.co/rest/v1/fichas
Headers:
  apikey: [service_role key]
  Authorization: Bearer [service_role key]
  Content-Type: application/json
Body: {
  "produto": "residencial_pf",
  "imobiliaria": "{{$json['IMOBILIÁRIA']}}",
  "nome_interessado": "{{$json['Nome completo do interessado no imóvel']}}",
  "cpf": "{{$json['CPF']}}",
  "celular": "{{$json['Celular']}}",
  "email": "{{$json['E-mail']}}",
  "cep": "{{$json['CEP']}}",
  "valor_aluguel": "{{$json['ALUGUEL']}}",
  "orcamentista_forms": "{{$json['Orçamentista']}}",
  "status": "pendente",
  "raw_data": {{$json}}
}
```
- [ ] Fluxo `residencial_pf` ✅ (já conectado)
- [ ] Fluxo `comercial_pf`
- [ ] Fluxo `pessoa_juridica`

---

## FASE 2 — Estrutura Base React

### 2.1 Setup
```bash
npx create-react-app conves-fichas
cd conves-fichas
npm install @supabase/supabase-js recharts
npx tailwindcss init
```

### 2.2 Variáveis de ambiente
```
REACT_APP_SUPABASE_URL=https://[projeto].supabase.co
REACT_APP_SUPABASE_ANON_KEY=[anon_key]
```

### 2.3 Estrutura de arquivos
```
src/
├── lib/
│   └── supabase.js
├── contexts/
│   └── AuthContext.jsx
├── pages/
│   ├── Login.jsx
│   ├── Dashboard.jsx
│   └── Fichas.jsx
├── components/
│   ├── Layout.jsx
│   ├── CardProduto.jsx
│   ├── CardAno.jsx
│   ├── CardMes.jsx
│   ├── ListaFichas.jsx
│   ├── DetalhesFicha.jsx
│   ├── ModalAssumir.jsx
│   └── ModalFinalizar.jsx
└── App.jsx
```

---

## FASE 3 — Dashboard

### KPIs (linha superior)
```
[Fichas Hoje] [Fichas Semana] [Fichas Mês] [Em Aberto]
```

### Gráfico — fichas por dia (últimos 30 dias)
Recharts LineChart | Eixo X: dias | Eixo Y: quantidade

### Top 5 imobiliárias com mais aprovações
Recharts BarChart horizontal
`SELECT imobiliaria, COUNT(*) WHERE status='aprovado' GROUP BY imobiliaria LIMIT 5`

### Cards de status
```
[Aprovadas] [Recusadas] [Em Análise]
```

### Minhas fichas em aberto
Tabela: fichas onde `orcamentista_id = auth.uid()` AND `status = em_cotacao`
Colunas: Imobiliária | Nome | Produto | Assumida em | [Finalizar]

---

## FASE 4 — Página de Fichas

### Navegação em cards
```
NÍVEL 1 → produtos: Residencial PF | Comercial PF | PJ | Todos
NÍVEL 2 → anos: 2025 | 2026 | ...
NÍVEL 3 → meses: Janeiro | Fevereiro | ...
NÍVEL 4 → dentro do mês:
  [Fichas Passadas] [Fichas em Aberto]
  Filtro: [Imobiliária ▼]
  → tabela de fichas
```

### Fichas Passadas
Status: `em_analise`, `aprovado`, `recusado`
Colunas: Data | Imobiliária | Nome | CPF | Status | Orçamentista | [Ver]

### Fichas em Aberto
Status: todos os demais
Colunas: Data | Imobiliária | Nome | Status | Assumida | Orçamentista | [Assumir/Ver]

**Botão ASSUMIR** — visível em fichas com `assumida = false`
```sql
UPDATE fichas SET
  assumida = true,
  orcamentista_id = auth.uid(),
  status = 'em_cotacao',
  assumida_em = NOW()
WHERE id = [id]
```

### Modal Detalhes — todos os campos da ficha

### Modal Finalizar — apenas para o orçamentista que assumiu
```
Status final: [dropdown]
Seguradora: [texto]
Retorno ao cliente: [Sim/Não]
```
```sql
UPDATE fichas SET
  status = [status],
  seguradora = [texto],
  retorno_enviado = [bool],
  finalizada_em = NOW()
WHERE id = [id]
```

---

## FASE 5 — Testes

- [ ] Forms → n8n → Supabase (3 produtos)
- [ ] Login dos 4 usuários
- [ ] Assumir ficha (2 usuários diferentes)
- [ ] Finalizar ficha
- [ ] Filtros de imobiliária e mês
- [ ] RLS bloqueando insert direto pelo frontend
- [ ] Responsividade básica

---

## ORDEM DE EXECUÇÃO

```
FASE 1 — Supabase        ← COMEÇAR AQUI
    ↓
FASE 2 — Estrutura React
    ↓
FASE 3 — Dashboard
    ↓
FASE 4 — Fichas
    ↓
FASE 5 — Testes
```

---

## Próximas evoluções (pós-fase 5)

- Notificações WhatsApp ao chegar nova ficha
- Relatórios exportáveis PDF/Excel
- Histórico de alterações por ficha
- Métricas de performance por orçamentista
- Integração com sistema de emissão de apólices
- App mobile
