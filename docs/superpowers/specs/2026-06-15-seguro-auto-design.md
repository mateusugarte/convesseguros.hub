# Seguro Auto — MVP Spec
> Status: aprovado para planejamento de implementação
> Data: 2026-06-15

---

## Objetivo

Módulo completo de gestão de seguros automotivos, separado do módulo de Fichas. Foco principal em renovações e emissões. Escopo técnico: Supabase (tabelas, triggers, RLS) + React frontend.

---

## Entrada de Dados

- Google Forms → n8n → Supabase *(n8n já configurado — fora do escopo deste MVP)*
- Frontend lê em tempo real via TanStack Query (padrão do sistema)

---

## Estrutura de Menus

1. Dashboard
2. Renovações
3. Gestão de Emissões
4. Cotações
5. Sinistros *(placeholder — Em Breve)*

---

## Modelo de Dados

### `clientes_auto`
Dados do segurado. Reutilizado entre cotações e apólices.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | |
| nome_completo | text | Segurado |
| cpf | text | Segurado |
| telefone | text | |
| celular | text | Celular principal |
| email | text | Email principal |
| estado_civil | text | |
| profissao | text | |
| created_at | timestamptz | |

---

### `cotacoes_auto`
Criada automaticamente quando o Forms é preenchido. Representa uma solicitação de cotação (novo ou renovação).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | |
| cliente_id | uuid FK → clientes_auto | Segurado |
| tipo | text | `novo` / `renovacao` |
| origem_lead | text | `indicacao` / `prospeccao` / `carteira` — somente tipo `novo` |
| condutor_nome | text | Nome do condutor principal |
| condutor_cpf | text | CPF do condutor principal |
| estado_civil_condutor | text | Estado civil do condutor principal |
| cep_pernoite | text | |
| uso_veiculo | text | ex: lazer, trabalho |
| garagem_residencia | text | Resposta completa do Forms — ex: "Sim, portão automático" |
| garagem_trabalho | text | Resposta completa do Forms — ex: "Não utilizo para ir ao trabalho" |
| garagem_estudo | text | Resposta completa do Forms |
| jovens_18_26 | text | Resposta completa do Forms |
| modelo_veiculo | text | marca/modelo/ano |
| placa | text | nullable — não obrigatório para 0km |
| veiculo_financiado | text | Resposta completa do Forms |
| possui_kit_gas | text | Resposta completa do Forms |
| possui_blindagem | text | Resposta completa do Forms |
| isento_imposto | text | Resposta completa do Forms |
| seguradora_preferencial | jsonb | { nome, premio_total, premio_liquido, pct_comissao, valor_comissao } |
| seguradora_mais_barata | jsonb | { nome, premio_total, premio_liquido, pct_comissao, valor_comissao } |
| status | text | `aberta` / `convertida` / `perdida` |
| created_at | timestamptz | |

---

### `emissoes_auto`
Card do Kanban de Gestão de Emissões. Criado automaticamente junto com a cotação.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | |
| cotacao_id | uuid FK → cotacoes_auto | |
| cliente_id | uuid FK → clientes_auto | |
| tipo | text | `novo` / `renovacao` |
| coluna | text | `null` / `cotacao_feita` / `negociando` / `aguardando_vistoria` / `emitida` |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `apolices_auto`
Criada ao mover card para "Emitida" no kanban.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | |
| emissao_id | uuid FK → emissoes_auto | |
| cliente_id | uuid FK → clientes_auto | |
| seguradora | text | |
| numero_apolice | text | |
| vigencia_inicio | date | |
| vigencia_fim | date | Dispara criação da renovação |
| premio_liquido | numeric | |
| pct_comissao | numeric | |
| valor_comissao | numeric | Calculado: premio_liquido × pct_comissao |
| forma_pagamento | text | |
| parcelamento | text | |
| tipo_producao | text | `equipe` / `individual` |
| responsavel | text | Preenchido se tipo_producao = individual |
| eh_renovacao | boolean | |
| tem_repasse | boolean | |
| pct_repasse | numeric | |
| nome_repasse | text | |
| valor_repasse | numeric | Calculado: valor_comissao × pct_repasse |
| created_at | timestamptz | |

---

### `renovacoes_auto`
Criada automaticamente via Supabase trigger quando uma apólice é inserida.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | |
| apolice_id | uuid FK → apolices_auto | |
| cliente_id | uuid FK → clientes_auto | |
| seguradora | text | |
| vigencia_fim | date | Data de vencimento da apólice atual |
| status_cotacao | text | `nao_cotada` / `cotada_nao_enviada` / `cotada_enviada` |
| status_renovacao | text | `pendente` / `renovada` / `nao_renovada` |
| created_at | timestamptz | |

---

## Triggers Supabase

### Trigger 1 — `cotacoes_auto` → `emissoes_auto`
Ao inserir em `cotacoes_auto`:
```sql
INSERT INTO emissoes_auto (cotacao_id, cliente_id, tipo)
VALUES (NEW.id, NEW.cliente_id, NEW.tipo);
```

### Trigger 2 — `apolices_auto` → `renovacoes_auto`
Ao inserir em `apolices_auto`:
```sql
INSERT INTO renovacoes_auto (apolice_id, cliente_id, seguradora, vigencia_fim, status_cotacao, status_renovacao)
VALUES (NEW.id, NEW.cliente_id, NEW.seguradora, NEW.vigencia_fim, 'nao_cotada', 'pendente');
```

---

## Fluxo por Módulo

### Dashboard
- Lê de `apolices_auto`, `cotacoes_auto`, `renovacoes_auto`
- KPIs: emissões do mês (novos + renovações), cotações, renovações concluídas
- Gráficos via Recharts (já no projeto)
- Filtro por período de datas

### Renovações
- Lista: `SELECT * FROM renovacoes_auto WHERE vigencia_fim BETWEEN ... `
- Filtro: período / mês atual / próximo mês / passadas
- Destaque visual por `status_cotacao`:
  - `nao_cotada` → prioridade alta
  - `cotada_nao_enviada` → atenção
  - `cotada_enviada` → ok

### Gestão de Emissões (Kanban)
- Lê `emissoes_auto` agrupado por `coluna`
- Cards com cor diferente: `novo` vs `renovacao`
- Drag manual → `UPDATE emissoes_auto SET coluna = ?`
- Ao mover para `emitida`: modal coleta dados → `INSERT INTO apolices_auto` → trigger cria `renovacao_auto`
- Auto-preenchimento: se `cliente_id` já existe, campos preenchidos automaticamente

### Cotações
**Seguro Novo:**
- Formulário com todos os campos do Forms (nome, CPF, condutor, veículo, risco)
- Origem do lead obrigatória
- Salvar → `INSERT INTO cotacoes_auto` → trigger cria card em `emissoes_auto`

**Renovação:**
- Formulário: seguradora preferencial + mais barata
- Cálculo automático de `valor_comissao` no frontend
- Salvar → `INSERT INTO cotacoes_auto` → atualiza `renovacoes_auto.status_cotacao` → trigger cria card em `emissoes_auto`

### Sinistros
Tela estática: "Em Breve".

---

## RLS

- Todas as tabelas com RLS ativa
- Acesso por `auth.uid()` via `profiles` (padrão do sistema)
- Todos os perfis têm acesso ao módulo Auto

---

## Mapeamento Google Forms → Supabase

Campos recebidos via n8n exatamente como abaixo (sem vírgulas ou dois-pontos):

| Forms | Campo na tabela `cotacoes_auto` |
|-------|----------------------------------|
| Nome completo (segurado) | `nome_completo` → `clientes_auto` |
| CPF (segurado) | `cpf` → `clientes_auto` |
| Celular (segurado) | `celular` → `clientes_auto` |
| Email (segurado) | `email` → `clientes_auto` |
| Nome completo (condutor principal) | `condutor_nome` |
| CPF (condutor principal) | `condutor_cpf` |
| Estado civil do condutor | `estado_civil_condutor` |
| Estado civil | `estado_civil` → `clientes_auto` |
| Cep de pernoite | `cep_pernoite` |
| Profissão | `profissao` → `clientes_auto` |
| Uso do veículo | `uso_veiculo` |
| Garagem na residência | `garagem_residencia` |
| Garagem no trabalho | `garagem_trabalho` |
| Garagem no estudo | `garagem_estudo` |
| Existe jovens de 18 a 26 anos que more e use o veículo | `jovens_18_26` |
| Modelo do veículo (marca/ano) | `modelo_veiculo` |
| Placa | `placa` (nullable) |
| Veiculo financiado | `veiculo_financiado` |
| Possui kit gás | `possui_kit_gas` |
| Possui blindagem | `possui_blindagem` |
| É isento de imposto | `isento_imposto` |

> `origem_lead` é texto livre (não vinculado a outras tabelas do sistema).

---

## Ordem de Implementação

1. Criar tabelas no Supabase (ordem: `clientes_auto` → `cotacoes_auto` → `emissoes_auto` → `apolices_auto` → `renovacoes_auto`)
2. Criar triggers Supabase (cotação → emissão, apólice → renovação)
3. Configurar RLS (todos os perfis com acesso)
4. Criar lib de queries React (`src/lib/auto.js`)
5. Criar páginas React:
   - `src/pages/auto/AutoDashboard.jsx`
   - `src/pages/auto/AutoRenovacoes.jsx`
   - `src/pages/auto/AutoEmissoes.jsx`
   - `src/pages/auto/AutoCotacoes.jsx`
   - `src/pages/auto/AutoSinistros.jsx`
6. Registrar rotas em `App.jsx`
7. Adicionar item na Sidebar
