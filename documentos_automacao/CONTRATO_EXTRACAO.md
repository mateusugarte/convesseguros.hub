# Contrato de extracao — Orcamento Comparativo AUTO

Levantado a partir do modelo validado (`modelo/orcamentomodeloCONVES (2).pdf`, reproduzido
em codigo por `src/lib/orcamentoComparativoHtml.js`) e das decisoes do usuario em 25/08/2026.

Este documento define **exatamente o que cada parser de seguradora precisa devolver**.
Um parser novo esta pronto quando preenche as colunas "PDF da cotacao" abaixo.

---

## 1. Decisoes que valem para todas as seguradoras

1. **Abordagem: parser fixo por seguradora** (spec secao 4, Opcao B). Sem IA na extracao.
   A infra ja existe e ja rodou no banco: `auto_pdf_mapeamentos` (migration 62) e o
   `autoPdfParser.js`, que ja reconhece 11 seguradoras pelo nome e ja aceita mapeamento
   por seguradora vencendo o generico.

2. **COMISSAO NUNCA ENTRA NO ORCAMENTO.** O documento vai para o cliente. `pct_comissao` e
   `valor_comissao` continuam sendo extraidos pelo `autoPdfParser` e gravados no sistema
   (uso interno), mas sao proibidos no schema do comparativo e no template do PDF.
   Fronteira ja respeitada hoje: a palavra "comissao" nao aparece em nenhum dos tres
   modulos do comparativo. **Qualquer PR que introduza comissao no comparativo esta errado.**

3. **Cobertura e afirmacao explicita, dos dois lados.** Se a cotacao cobre X, o card diz que
   cobre X. Se nao cobre, o card diz que NAO cobre. Silencio nao e resposta — ver secao 3.

---

## 2. Inventario do modelo — de onde vem cada campo

Legenda da origem:
`[PDF]` extraido da cotacao · `[CAD]` cadastro do sistema · `[SIS]` gerado pelo sistema · `[REV]` confirmado pelo corretor na revisao

### Cabecalho (uma vez por documento)
| Campo | Origem |
|---|---|
| Logo Convés | `[CAD]` `public/conves-logo.png` |
| Referencia `CV-AAAA-NNNN` | `[SIS]` RPC `proximo_numero_orcamento_auto` (migration 67, aplicada) |
| Data de emissao | `[SIS]` |
| Validade (padrao 5 dias) | `[SIS]` `VALIDADE_PADRAO_DIAS` |

### Faixa do cliente (uma vez, comum as duas cotacoes)
| Campo | Origem |
|---|---|
| Nome do segurado | `[PDF]` |
| Veiculo: marca/modelo, ano | `[PDF]` |
| Placa | `[PDF]` |
| Tipo de operacao (novo / renovacao / endosso) | `[PDF]` via `detectarTipoOperacao` sobre o texto bruto |

Divergencia de segurado/placa entre os dois PDFs vira **aviso impresso**, nao so alerta de tela.

### Por card (x2 — "seguro atual" e "nova proposta")
| Campo | Origem |
|---|---|
| Nome da seguradora | `[PDF]` (identificacao) + `[CAD]` (nome canonico) |
| Logo da seguradora | `[CAD]` `seguradoras.logo_url` — **nunca recortada do PDF** |
| Cor de destaque | `[CAD]` `seguradoras.cor_destaque` (migration 67, aplicada); fallback por nome canonico |
| Condutor principal | `[PDF]` |
| CEP de pernoite | `[PDF]` |
| Uso do veiculo | `[PDF]` |
| Jovem 18–25 anos | `[PDF]` |
| **As 7 categorias de cobertura** | `[PDF]` + `[REV]` — ver secao 3 |
| Nao incluso | `[PDF]` + `[REV]` |
| Premio total | `[PDF]` |
| Parcelamento | `[PDF]` — muda a cada cotacao, nunca texto fixo (spec secao 7) |
| Descontos aplicados | `[PDF]` |
| Condicoes Gerais (referencia + data) | `[CAD]` `seguradora_condicoes_gerais` (migration 67, aplicada; sem tela ainda) |
| Numero da cotacao | `[PDF]` |

### Rodape
Contato Convés `[CAD]` · aviso de divergencia `[SIS]`.

---

## 3. As 7 categorias — regra dos tres estados

As categorias sao fixas e sempre as mesmas, na mesma ordem, **nos dois cards**:

| # | key | Rotulo no PDF |
|---|---|---|
| 1 | `colisao` | Colisão, incêndio, roubo e furto |
| 2 | `terceiros` | Danos a terceiros (RCF-V) |
| 3 | `assistencia` | Assistência 24 horas |
| 4 | `carro_reserva` | Carro reserva |
| 5 | `franquia` | Franquia |
| 6 | `vidros` | Vidros |
| 7 | `adicional` | Benefícios adicionais (unica que pode sumir quando vazia) |

Cada categoria, em cada card, tem **tres** estados possiveis — nao dois:

- **INCLUIDA** → o card mostra o que cobre (LMI, limite, detalhe).
- **NAO INCLUIDA** → o card afirma que **nao** cobre. Texto explicito, nao ausencia.
- **NAO INFORMADO** → a cotacao nao disse. **BLOQUEIA a geracao** ate o corretor confirmar
  na revisao. Nunca vira "nao tem" automaticamente: afirmar ausencia sem base e tao errado
  quanto afirmar presenca sem base.

> **Mudanca necessaria no codigo (ainda nao feita).** Hoje `blocoCoberturas`
> (`orcamentoComparativoHtml.js:209`) faz `.filter(cat => !cat.vazia)`: categoria sem dado
> **desaparece do PDF**. Isso viola a regra acima de duas formas — o cliente le silencio no
> lugar de "nao tem", e as linhas dos dois cards deixam de alinhar lado a lado, que e a
> funcao do comparativo. As 7 linhas passam a ser sempre renderizadas nos dois cards, e
> `validarCotacao` ganha um bloqueio por categoria em estado NAO INFORMADO — mesma
> mecanica que ja existe hoje para `indenizacao_integral: null`.

**Indenizacao integral** continua sendo o campo mais sensivel: a Tokio trata como adicional
separado ("possui / nao possui"); a Porto embute 100% da FIPE dentro da compreensiva. O card
sempre nomeia a cobertura literalmente, com a mesma frase nos dois lados.

---

## 4. Checklist por seguradora (o que cada parser deve devolver)

Para cada cotacao de exemplo recebida em `documentos_automacao/orçamentos/`:

- [ ] Numero da cotacao / orcamento
- [ ] Tipo de operacao (texto bruto — "Renovação Congênere", "RENOVAÇÃO DA CIA", etc.)
- [ ] Validade da cotacao
- [ ] Vigencia (inicio e fim)
- [ ] Segurado: nome, CPF/CNPJ
- [ ] Condutor principal: nome, CPF
- [ ] Veiculo: marca/modelo, ano, placa, uso, CEP de pernoite, condutor 18–25
- [ ] Premio liquido, IOF, **premio total**
- [ ] Tabela de parcelamento (formas e numero de parcelas)
- [ ] Descontos aplicados
- [ ] Franquia: valor e tipo (parcial / integral / reduzida)
- [ ] **Indenizacao integral: incluida sim/nao + % da FIPE**
- [ ] **Lista de coberturas com nome ORIGINAL da seguradora + LMI** (o nome original importa:
      e ele que alimenta `DICIONARIO_COBERTURAS`)
- [ ] **Coberturas explicitamente NAO contratadas** (a maioria dos PDFs lista isso)
- [ ] Assistencia 24h: incluida + detalhes (km de reboque, nº de acionamentos)
- [ ] Carro reserva: incluido + diarias
- [ ] Vidros: incluido + franquia por peca
- [ ] Servicos/beneficios adicionais
- [ ] Referencia das Condicoes Gerais quando o PDF citar (ex. Porto "CG144")

**NAO extrair para o comparativo:** percentual de comissao, valor de comissao, dados de
repasse. Uso interno do sistema apenas.

---

## 5. Status das amostras

| Seguradora | Cotacao de exemplo | Coberturas no dicionario |
|---|---|---|
| Tokio Marine | recebida (mockup) | validada |
| Porto Seguro | recebida (mockup) | validada |
| Demais 12 | **aguardando** | pendente |

Condicoes Gerais: basta **um** documento de exemplo, de qualquer seguradora, para validar a
extracao da secao 8 da spec. Nao e necessario um por seguradora, e nao bloqueia os passos 2 a 5.
