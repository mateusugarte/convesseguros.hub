# COMERCIAL — Contexto e Reestruturação
# Conves Corretora de Seguros

> Documento de contexto para o Claude Code. Sintetiza o que foi discutido, decidido e planejado para a área comercial da Conves — tanto no sistema quanto na estratégia de negócio.

---

## 1. O QUE QUEREMOS

A Conves tem hoje um problema claro: **receita represada numa base de 3000 clientes que nunca foi explorada ativamente**. O diagnóstico levantado apontou:

- Venda 100% por indicação, sem prospecção estruturada
- Gestão inteiramente em planilhas, sem CRM, sem métricas
- ~500 fichas/mês chegando, mas o locatário nunca é abordado para outros produtos
- ~100 imobiliárias parceiras (50 ativas, 30 esporádicas) sem gestão de relacionamento
- Proprietários das apólices nunca contactados diretamente pela Conves
- Comercial com 4 pessoas (Eduardo, Mateus, Marcos, Luciano) sem pipeline, sem cadência, sem visibilidade

**O que almejamos:**

1. **Pipeline visual e funcional** para cada vendedor gerenciar seus leads com isolamento de dados
2. **Cadência estruturada** de contatos por perfil de cliente (locatário PF, PJ, proprietário)
3. **Reativação do Segmento B** (imobiliárias dormentes já habilitadas nas seguradoras) como ação de maior ROI imediato
4. **Jornadas automatizadas** que guiam o lead pelo funil sem depender de memória humana
5. **Campanhas** vinculadas a produtos específicos, com metas e premiações, visíveis no dashboard e no pipeline
6. **Visibilidade de métricas** reais — conversão ficha→apólice por imobiliária, leads por estágio, performance por vendedor

---

## 2. MODELO DE DADOS — CONCEITOS CRÍTICOS

> Esta distinção é fundamental. Não confundir nunca.

| Objeto | O que é | Exemplo |
|--------|---------|---------|
| **Parceiro (imobiliária)** | Canal de entrada. Não é cliente. | Imobiliária Alfa envia fichas |
| **Lead / Cliente** | O locatário que chega via ficha | João Silva, CPF 000.000.000-00 |
| **Ficha** | O lead em si — registro de interesse | Ficha do João para o imóvel X |
| **Apólice** | O lead convertido | Apólice 2025/001 emitida para João |

**Regra:** uma imobiliária pode, no futuro, também se tornar cliente (ex: contratar saúde coletiva para seus funcionários). O modelo de dados deve suportar essa transição sem quebrar.

---

## 3. O QUE ESTAMOS FAZENDO — SISTEMA

### Estado atual do módulo Comercial

O módulo existe e funciona. As seguintes áreas já foram construídas:

| Área | Status |
|------|--------|
| Pipeline Comercial (Kanban de leads) | ✅ funcional |
| Base de Leads | ✅ funcional |
| Dashboard Comercial | ✅ funcional |
| Calendário | ✅ funcional |
| Jornadas (visual node-based, estilo n8n) | ✅ funcional — em melhoria |
| Materiais | ✅ funcional |
| Campanhas | 🔄 em construção |

### Banco de dados — tabelas comerciais

```
comercial_leads         → leads com owner por usuário
comercial_campanhas     → campanhas com produto, seguradora, premiações, datas, metas
comercial_leads.campanha_id → FK para comercial_campanhas (migration pendente de confirmar)
comercial_leads.jornada_id  → FK para jornadas
comercial_leads.jornada_etapa_atual → etapa atual do lead na jornada
```

Jornadas: coluna `etapas` migrada de `text[]` para `jsonb`.

### Regras de negócio confirmadas

- **Isolamento de dados por usuário:** cada vendedor vê apenas seus próprios leads
- **Um pipeline por lead** — com possibilidade de transferência entre usuários
- **Jornadas são templates globais** — acessíveis por todos os usuários
- **WhatsApp:** planejado para fase futura, não é prioridade do MVP

---

## 4. O QUE ESTAMOS FAZENDO — ESTRATÉGIA

### Segmentação da base de leads (imobiliárias)

| Segmento | Descrição | Prioridade |
|----------|-----------|-----------|
| **A — Ativas** | 50 imobiliárias que já mandam fichas regularmente | Manter e expandir volume |
| **B — Dormentes** | ~30 esporádicas, já habilitadas nas seguradoras | **Atacar primeiro — maior ROI** |
| **C — Em qualificação** | Contato iniciado, ainda não enviaram ficha | Acompanhar semanalmente |
| **D — Prospects frios** | Novas imobiliárias nunca contatadas | Atacar após B e C em rotina |

**Por que B primeiro:** imobiliárias dormentes já estão habilitadas nas seguradoras. Podem mandar uma ficha amanhã, sem onboarding. É receita com fricção quase zero.

### Cadência por segmento

| Segmento | Frequência | Dono |
|----------|-----------|------|
| A | Quinzenal | Farmer (gestor de carteira) |
| B | Sprint inicial, depois mensal | Farmer |
| C | Semanal | Hunter |
| D | Sequência de outreach estruturado | Hunter |

### Funil de cross-sell por perfil

```
Locatário PF:  Fiança → Auto → Saúde PF → Consórcio → Vida
Locatário PJ:  Fiança → Saúde Coletiva → Consórcio PJ
Proprietário PF: Apresentação → Consórcio ou Vida* → Saúde PF
Proprietário PJ: Saúde Coletiva → Consórcio PJ
```
*Proprietário PF: perfil investidor → consórcio. Perfil proteção → vida.

### Fontes de lead ativas

1. **Carteira ativa** — 800-1000 clientes Tier 1, resultado imediato
2. **Imobiliárias** — 30 esporádicas para reativar + novas via indicação
3. **Outbound** — PJ para saúde coletiva, locatários para auto

---

## 5. O QUE VAMOS FAZER — ROADMAP

### Sistema (desenvolvimento)

| Fase | Entrega | Status |
|------|---------|--------|
| **Fase 0** | CRM: status owner e contatos nas imobiliárias, código imob por seguradora | ✅ concluído |
| **Fase 1** | Dashboard comercial com métricas reais (conversão ficha→apólice, ranking imobiliárias) | ✅ concluído |
| **Fase 2** | Jornadas: redesign visual (estilo n8n), node tipo Etapa, aba "Jornada do Cliente" no lead | 🔄 em execução |
| **Fase 3** | Campanhas: área completa + banner no dashboard + strip no pipeline + aba no lead | 🔄 em execução |
| **Fase 4** | Redesign visual completo do sistema (toda a UI) | 🔄 em execução |
| **Fase 5** | Forecasting: projeção de apólices/comissão a partir do pipeline | ⏳ próxima |
| **Fase 6** | Aquisição estruturada: outreach automatizado + materiais comerciais | ⏳ futuro |
| **Fase 7** | WhatsApp Business integration | ⏳ futuro |

### Estratégia comercial (execução)

| Semana | Ação |
|--------|------|
| **1–2** | Classificar base inteira nos 4 segmentos (A/B/C/D) — feito manualmente |
| **1–2** | Iniciar sprint de reativação do Segmento B manualmente, sem esperar o CRM |
| **3–4** | CRM pronto → migrar gestão do Segmento B para o sistema |
| **5–6** | Segmento A em cadência quinzenal + Segmento C em acompanhamento semanal |
| **7+** | Com visibilidade de dados, priorizar por conversão real + iniciar Segmento D |

---

## 6. CAMPANHAS — ESPECIFICAÇÃO

### Tabela `comercial_campanhas`
```
id, nome, produto, seguradora, premiações (jsonb),
regras, data_inicio, data_fim, meta_geral, status
```

**Status possíveis:** `rascunho | ativa | encerrada`

**Produtos suportados:**
```
Saúde PF | Saúde PJ | Auto Individual | Auto Frota |
Seguro de Vida | Seguro Celular | Consórcio Auto |
Consórcio Residência | Consórcio Campanha |
Seguro Transporte | Seguro Incêndio
```

### Comportamento visual
- **Dashboard:** banner grande e visível para campanha ativa (data_fim >= hoje)
- **Pipeline:** strip de notificação acima do Kanban com campanha ativa
- **Lead:** aba "Campanha" dentro do detalhe do lead — vincular/desvincular

---

## 7. JORNADAS — ESPECIFICAÇÃO

### Database
- `etapas`: tipo `jsonb` (migrado de `text[]`)
- `comercial_leads.jornada_id`: FK para jornadas
- `comercial_leads.jornada_etapa_atual`: etapa atual

### Funcionalidades planejadas
- Save e Delete funcionais
- Redesign visual inspirado no n8n (nodes limpos, conexões visuais)
- Novo tipo de node: **Etapa** — para progressão manual do lead
- Aba **"Jornada do Cliente"** no detalhe do lead: mostra em qual etapa o lead está, com botão de avançar manualmente

---

## 8. PRINCÍPIOS DE DESENVOLVIMENTO

Extraídos das sessões de trabalho — nunca violar:

1. **Ler antes de modificar** — auditar todo o código existente antes de qualquer alteração
2. **Nunca tocar lógica de negócio** — só visual/estrutural, a menos que explicitamente instruído
3. **Mudanças cirúrgicas** — escopo mínimo, sem efeitos colaterais
4. **token-efficiency sempre ativo** — primeiro passo de toda sessão Claude Code
5. **Plano antes de execução** — apresentar PLANO com campo `SKILLS: [skill] → [razão]` e aguardar aprovação
6. **40 tool-calls de budget** — checkpoint obrigatório aos 30
7. **RLS nunca desabilitar** — segurança não negocia
8. **service_role key** — apenas no n8n, nunca no frontend

---

*Documento gerado a partir das conversas de planejamento. Atualizar conforme novas decisões forem tomadas.*
