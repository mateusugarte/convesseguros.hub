# Renovações — Design Draft
> Status: rascunho (aguardando detalhamento final antes de implementar)
> Produto inicial: Fiança

---

## Objetivo

Área dedicada ao acompanhamento e gestão do ciclo de renovação de apólices. A geração é automática; o acompanhamento é manual via kanban.

---

## Fluxo Principal

1. Usuário cria apólice informando `data_vigencia_fim`.
2. Sistema cria automaticamente uma entrada em `renovacoes` vinculada à apólice.
3. No mês anterior ao `data_vigencia_fim`, a renovação aparece no kanban como ativa.
4. O operador acompanha manualmente pelas colunas do kanban.
5. Ao mover para "Emitida", o sistema solicita novos dados (nova vigência, novo número, valor da parcela, endosso, observações).
6. Com os novos dados, o ciclo se reinicia: nova entrada em `renovacoes` com a nova `data_vigencia_fim`.

---

## Dashboard de Renovações

### KPIs
- Apólices vencendo no próximo mês
- Vencidas / não renovadas no mês atual
- Renovadas no mês atual

### Gráficos
- Comparativo entre meses anteriores (volume renovado vs. não renovado)

### Filtros
- Período de datas (extenso ou específico)

---

## Área 1 — Lista de Vencimentos

- Todas as apólices que vencem no período selecionado
- Filtro: todas ou por imobiliária
- Exibe detalhes de cada apólice

---

## Área 2 — Kanban de Acompanhamento

### Colunas (em ordem)
1. Em cotação
2. Enviada cobrança
3. Tratativa / endosso
4. Não deu andamento
5. Emitida

### Ao mover para "Emitida"
- Pergunta: houve endosso? (sim / não)
- Campos obrigatórios:
  - Data início da nova vigência
  - Data fim da nova vigência
  - Número da nova apólice
  - Valor da parcela
  - Observações (opcional)
- Ao confirmar: sistema cria nova entrada de renovação com base na nova `data_vigencia_fim`

### Filtros
- Todos ou por imobiliária

---

## Modelo de Dados (esboço)

### Tabela `renovacoes`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| apolice_id | uuid | FK → apólices |
| produto | text | ex: "fianca" |
| imobiliaria_id | uuid | FK → imobiliarias |
| data_vigencia_fim | date | Data de vencimento da apólice atual |
| status | text | em_cotacao / enviada_cobranca / tratativa_endosso / nao_deu_andamento / emitida |
| houve_endosso | boolean | Preenchido ao emitir |
| nova_vigencia_inicio | date | Preenchido ao emitir |
| nova_vigencia_fim | date | Preenchido ao emitir — inicia novo ciclo |
| novo_numero_apolice | text | Preenchido ao emitir |
| novo_valor_parcela | numeric | Preenchido ao emitir |
| observacoes | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### Trigger automático
- Ao criar/atualizar apólice com `data_vigencia_fim` → insere em `renovacoes` com status `em_cotacao`
- Implementação: Supabase Database Function + Trigger (ou n8n webhook)

### Lógica de exibição no kanban
- Aparece quando `data_vigencia_fim` está no mês seguinte ao mês atual
- Implementado como view filtrada ou query no front

---

## Pendências para detalhamento
- Definir onde o trigger roda (Supabase ou n8n)
- Confirmar se `renovacoes` é tabela própria ou extensão de `apolices`
- Definir permissões RLS por perfil de usuário
