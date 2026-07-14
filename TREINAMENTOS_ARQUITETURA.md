# TREINAMENTOS — Arquitetura da Feature
# Conves Hub

> Documento vivo. Fonte de verdade para a nova aba TREINAMENTOS.
> Gerado a partir de sessão de planejamento — antes de qualquer código ou SQL.

---

## CONTEXTO

Nova aba dentro do Conves Hub, chamada **TREINAMENTOS**. Objetivo: acelerar o
aprendizado de novos funcionários (e reciclagem dos atuais) sobre regras de
produto, condições gerais por seguradora, e operação prática do sistema —
sem depender de explicação verbal repetida entre a equipe.

Reaproveita a base de conhecimento já ingerida no **CONVES IA** (RAG com
filtro por metadata produto/seguradora, banco Postgres dedicado), mas com uma
camada de currículo estruturado que hoje não existe no schema do CONVES IA.

---

## PÁGINAS DA FEATURE

```
TREINAMENTOS
├── Página principal
│   → progresso geral do funcionário
│   → próximo módulo recomendado
│   → dicas / informações rápidas
└── Módulos de treinamento
    → navegação por produto → setor → módulo → lição
    → botão flutuante de chat (contextual à lição atual)
```

---

## MODELO DE DADOS — árvore de conteúdo

```
Produto   (Fiança, Auto, Saúde, Consórcio, Incêndio...)
 └── Setor    (Seguros Novos, Sinistros, Cobrança, Cancelamentos, Endosso, Renovações...)
      └── Módulo   (agrupamento lógico dentro do setor — sequencial)
           └── Lição   (unidade de conteúdo + quiz)
```

### Regras de progressão

- **Setor**: sem trava entre setores. Funcionário escolhe livremente o que estudar,
  pode estar em mais de um setor ao mesmo tempo.
- **Módulo**: sequencial DENTRO do setor. Só libera o próximo módulo ao concluir o atual.
- **Lição**: sequencial dentro do módulo.
- **Quiz em duas camadas:**
  - Quiz de **módulo** → testa as lições daquele módulo especificamente
  - Quiz **final de setor** → mais abrangente, cobre o acumulado de todos os módulos do setor

### Esboço de tabelas (Supabase — Conves Hub)

```sql
training_nodes (
  id,
  parent_id REFERENCES training_nodes(id),  -- NULL = raiz (produto)
  tipo TEXT CHECK (tipo IN ('produto','setor','modulo','licao')),
  titulo, ordem,
  produto, seguradora,                -- preenchido quando aplicável
  tipo_conteudo TEXT CHECK (tipo_conteudo IN ('conceitual','operacional')), -- só em 'licao'
  conteudo JSONB,                     -- ver estrutura abaixo
  knowledge_document_ids,             -- refs aos PDFs no banco do CONVES IA
  prerequisito_node_id,               -- encadeamento sequencial
  eh_quiz_final_setor BOOLEAN DEFAULT FALSE
)

training_progress (
  id, funcionario_id REFERENCES profiles(id),
  node_id REFERENCES training_nodes(id),   -- licao ou quiz de módulo/setor
  status, quiz_score, tentativas, concluido_em
)
```

### Estrutura de conteúdo por lição

```json
{
  "conteudo_geral": "regra que vale para todas as seguradoras",
  "variacoes_por_seguradora": {
    "porto": "...",
    "pottencial": "...",
    "too": "...",
    "tokio_marine": "...",
    "junto": "..."
  }
}
```
`variacoes_por_seguradora` só é preenchido quando existe divergência real entre
seguradoras. Se a regra for igual para todas, fica só em `conteudo_geral`.

---

## TIPO DE CONTEÚDO — conceitual vs operacional

Distinção crítica levantada na sessão de planejamento:

| Tipo | O que é | Entra no quiz? | Fonte |
|------|---------|----------------|-------|
| **Conceitual** | Regras, critérios, condições gerais, cláusulas | Sim | Extraído das condições gerais (PDF) |
| **Operacional** | Telas, caminhos, "como fazer X no sistema Y", uso do Hub | Não | Preenchido manualmente pela equipe (ou pelo Claude Code, se encontrado explicitamente no PDF) |

O quiz avalia conhecimento de regra, não navegação de tela.

---

## PRODUTO: FIANÇA — estrutura definida até agora

**Seguradoras:** Porto Seguros, Pottencial Seguros, Too Seguros, Tokio Marine, Junto Seguros

**Ordem de prioridade padrão** (ensinada como conteúdo, não altera navegação do
treinamento): Porto → Pottencial → Too → Tokio Marine → Junto Seguros.
Pode mudar temporariamente por campanha ativa — isso também vira conteúdo
a ensinar (como checar se há campanha vigente).

### Setor: Seguros Novos

**Módulo: Fichas Cadastrais**
- Regras do produto
- Critérios de análise
- Coleta de informações (residencial, comercial, PJ)
- Como efetuar uma análise (telas e caminhos) — *operacional*
- Solicitação e regras de biometria facial
- Eventualidades (ficha em nome de 2 pessoas etc)
- Como enviar documentos em caso de análise
- Técnicas de negociação
- Critérios de escolha de produto
- Como retornar para quem solicitou a ficha
- Como utilizar o Conves Hub a favor da organização — *operacional*

**Módulo: Emissão de Apólices**
- Regras de emissão de apólices
- Cláusulas das seguradoras + palavras-chave para leitura rápida
- O que NÃO pode ter no contrato
- O que DEVE ter no contrato de locação e como localizar
- Regras eventuais (mais de um locatário)
- Como emitir uma apólice (por seguradora, telas e caminhos) — *operacional*
- Como saber se a apólice emitiu de verdade
- Como retornar a apólice para a imobiliária via email
- Como utilizar o Conves Hub para gestão de apólices — *operacional*

→ Quiz final do setor Seguros Novos (cobre os 2 módulos acima)

### Setores pendentes de agrupamento em módulos

Conteúdo já mapeado, mas ainda sem divisão em módulos lógicos — será proposta
ao processar as condições gerais correspondentes:

- **Sinistros**: condições gerais, documentos obrigatórios, abertura por
  seguradora, acompanhamento até encerramento, cancelamento por falta de
  pagamento, como lidar com proprietários/imobiliárias
- **Cobrança**: condições sobre faturas/pagamentos, regras de cancelamento,
  acompanhamento, intervalos de cobrança, reversão de não-pagamento, coleta
  de fatura das imobiliárias
- **Cancelamentos**: condições gerais, como efetuar, como acompanhar, como
  registrar no Hub, como retornar, o que fazer depois
- **Endosso**: condições gerais, como fazer, como acompanhar, como retornar
- **Renovações**: condições gerais, prazos, como puxar por seguradora, como
  calcular, como retornar às imobiliárias, como emitir, acompanhamentos

---

## COMPONENTES DE UI (referência do mockup validado)

- Página principal: cards por setor com barra de progresso (% de módulos concluídos)
- Dentro do setor: lista de módulos com estado visual — concluído (check),
  em andamento (destacado), bloqueado (cadeado, opacidade reduzida)
- Botão flutuante de chat: fixo no canto da tela, contextual à lição atual,
  usa o RAG do CONVES IA com citação de fonte/seguradora
- Quiz: obrigatório ao final de cada módulo + quiz final ao final do setor

---

## INTEGRAÇÃO TÉCNICA

```
Conves Hub (Supabase)                     CONVES IA (Postgres dedicado)
├── profiles (já existe)                  ├── knowledge_documents (PDFs)
├── training_nodes    ← novo              ├── knowledge_chunks (embeddings)
└── training_progress ← novo              └── agent_memory

Hub → chama API do backend Node.js do CONVES IA → resposta do chat / conteúdo do RAG
```

`training_progress` referencia `profiles.id` (só existe no Supabase do Hub).
Conteúdo e embeddings ficam no banco do CONVES IA, onde o filtro por
seguradora antes da busca semântica já está desenhado — sem duplicar
pipeline de RAG.

---

## STATUS ATUAL

- ✅ Modelo de dados definido (árvore + progresso)
- ✅ Regras de progressão e camadas de quiz definidas
- ✅ Distinção conceitual/operacional definida
- ✅ Estrutura completa do setor Seguros Novos (Fiança)
- ⏳ Agrupamento em módulos dos demais setores de Fiança (Sinistros, Cobrança,
  Cancelamentos, Endosso, Renovações) — depende da leitura das condições gerais
- ⏳ Conteúdo operacional (telas/caminhos) — a ser preenchido pela equipe
- ⏳ SQL/migrations — não iniciado, aguardando conteúdo organizado
- ⏳ Outros produtos (Auto, Saúde, Consórcio, Incêndio) — não iniciado

---

## PRÓXIMOS PASSOS

1. Processar condições gerais do setor Seguros Novos (módulos Fichas
   Cadastrais e Emissão de Apólices) — primeira leva
2. Propor agrupamento em módulos para os demais setores de Fiança
3. Validar tudo com Mateus antes de gerar SQL ou popular banco
4. Repetir o processo para os demais produtos
