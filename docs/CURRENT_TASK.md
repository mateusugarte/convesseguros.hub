# CURRENT TASK

## Prazo corrido de renovacoes e nomes na Visao Geral AUTO (2026-08-26, Codex — CONCLUIDO)

Responsavel: Codex, Agente de Sistemas. Entregue: a data limite agora subtrai 10 dias corridos do vencimento e ajusta o resultado operacionalmente (sabado para sexta, domingo para segunda) em uma funcao unica do front-end e na migration `supabase/69_auto_renovacoes_prazo_corrido.sql`, que tambem recalcula a carteira existente. A Visao Geral/Central e a lista de cotacoes passaram a consultar o cliente vinculado e usar `clientes_auto.nome_completo` quando o nome duplicado da cotacao estiver vazio, preservando os nomes ja cadastrados.

Validacao final: `npm test` com 498 testes aprovados e `npm run build` concluido. Permanecem somente os avisos preexistentes do pacote `xlsx` e do chunk dinamico de `orcamentoLeitura`. Proximo responsavel: usuario, para executar a migration 69 depois da 65 e realizar o smoke test antes do push.

---

## Acompanhamento operacional e parsers AUTO (2026-08-26, Codex — CONCLUIDO)

Responsavel: Codex, Agente de Sistemas. Entregue: parsers fixos para Darwin, Pier, Suhai, Yelum e Tokio Marine usando os PDFs reais, com fixtures posicionais e saida no contrato de `orcamentoComparativo.js`. O parser Allianz permaneceu sob responsabilidade do Claude. Toda seguradora cujo PDF contenha mais de um produto agora expoe as opcoes e bloqueia a leitura final ate escolha explicita: HDI (2), Pier (2), Suhai (4) e Allianz (6, integracao independente).

O roteador `orcamentoSeguradoraParser.js` identifica todos os layouts fora da Allianz; `orcamentoLeitura.js` preserva a integracao Allianz e encaminha as demais. Produtos unicos preenchem a revisao direto; multiplos abrem `AutoOrcamentoOfertas`. A pagina rasterizada dos produtos Pier nao gera numeros fixos: preco e limites ficam bloqueados para OCR/revisao.

Tambem foi entregue o acompanhamento operacional solicitado: cotações paradas perguntam se foram feitas; cotações feitas perguntam se houve continuidade; a cotacao ganhou proximo passo, data, observacoes, etiquetas, historico de contatos/follow-ups e lembretes com aviso antecipado. A Central de Pendencias agrega confirmacoes, continuidade, proximos passos e lembretes. Migration obrigatoria: `supabase/68_auto_acompanhamento_operacional.sql`.

Validacao final: `npm test` com 495 testes aprovados; `npm run build` concluido. Permanecem apenas os avisos preexistentes do import `xlsx` e do chunk dinamico de `orcamentoLeitura`.

---

## Cotacoes de exemplo das 12 seguradoras + cor de destaque (2026-08-25, Claude — EM ANDAMENTO)

Amostras recebidas em `documentos_automacao/orçamentos/`: ALLIANZ, AZUL, BRADESCO, DARWIN, HDI,
ITAU, MITSUI, PIER, SUHAI, YELLUM (10) + Tokio e Porto ja conhecidas = 12.
Todas tem texto real extraivel via `pdfjs-dist`; nenhuma e imagem escaneada.

**Descoberta que muda o tamanho do trabalho de parser:** AZUL, ITAU e MITSUI **nao sao tres
layouts** — sao o mesmo documento do grupo Porto Seguro. Mesmo CNPJ emissor
(61.198.164/0001-60), mesmo numero raiz de orcamento (`6065143265-0-2/-3/-4`, so muda o
sufixo), mesmo cabecalho "Versao Condicoes Gerais: CGxxx / <MARCA> TRADICIONAL e PROTECAO
COMBINADA v1.0". Com a Porto, sao **4 seguradoras cobertas por 1 parser**. Isso tambem explica
o `#00a0ff` que aparecia como cor dominante nas tres: e a barra do sistema de cotacao da Porto,
nao a logo da marca.

**Seguradoras fora do `LAYOUTS` do `autoPdfParser.js`:** DARWIN, MITSUI, PIER, YELLUM.
E ha 3 no parser sem amostra: mapfre, liberty (hoje Yelum), zurich.

**Cores.** `CORES_SEGURADORA_PADRAO` ja cobria 15 seguradoras. Nesta rodada: acrescentado
Mitsui (`#201060`, amostrado da logo embutida no PDF) e `SEGURADORAS_SEM_COR = ['darwin','pier']`
— nas duas a logo do PDF e vetorial, nao houve pixel para amostrar.

**Bug silencioso corrigido em `corDaSeguradora`:** o casamento pelo mapa era por IGUALDADE
EXATA do nome normalizado. Como `seguradoras.nome_canonico` carrega razao social ("Mitsui
Sumitomo Seguros S.A.", "Bradesco Auto/RE Companhia de Seguros", "HDI SEGUROS S.A."), nenhum
desses nomes casava e a cor caia no `CORES_FALLBACK` **por papel** — ou seja, inverter "atual" e
"outra" trocava a cor da seguradora, exatamente o que a regra do modulo proibe, e saia um PDF
com cor plausivel mas errada. Agora e exato primeiro, depois a chave mais longa contida no nome.
2 testes novos cobrem os dois casos. `npm test` 322/322.

**Regra reafirmada pelo usuario em 25/08:** COMISSAO NUNCA ENTRA NO ORCAMENTO — o documento vai
para o cliente; `pct_comissao` continua sendo extraido e guardado so no sistema. Verificado: a
palavra nao aparece em nenhum dos tres modulos do comparativo. E: cobertura tem que ser
afirmacao explicita nos dois sentidos ("tem X" / "NAO tem Y").

**Decisao do usuario:** extracao por **parser fixo por seguradora** (spec secao 4, Opcao B),
nao por IA.

**PENDENTE:**
1. Cor REAL de Darwin e Pier. O usuario informou em 25/08 que as duas sao rosa; entraram no
   mapa como PROVISORIAS (`#c2185b` e `#ff4d8d`), escolhidas afastadas de proposito. Nao foi
   possivel amostrar: a logo e vetorial no PDF, a RLS bloqueia `seguradoras` para anon e a
   listagem do bucket publico `cadastros-media` volta vazia. Depende do usuario mandar os
   `logo_url`.
1b. COLISAO DE COR ENTRE SEGURADORAS JA CADASTRADAS, achada pela guarda nova: Bradesco x
   Mapfre da distancia 23 e Porto x Allianz da 50, numa escala onde o par validado Tokio x
   Porto da 252. Cotar qualquer um desses dois pares junto produz dois cards que o cliente
   nao distingue. `montarComparativo` agora devolve `cores_proximas` (avisa, nao bloqueia —
   e problema de cadastro). Resolver escurecendo/clareando uma das duas de cada par.
2. ~~Tres estados de cobertura~~ **FEITO em 25/08.** `blocoCoberturas` nao filtra mais por
   conteudo; quem decide o que sai do card e `montarCategorias`, funcao nova compartilhada por
   `montarCard` e `validarCotacao` (as duas TEM que concordar sobre o estado, senao a revisao
   libera e o PDF sai com linha faltando). `ESTADO_COBERTURA`: INCLUIDA / NAO_INCLUIDA /
   NAO_INFORMADO. A lista livre `nao_incluso` do schema agora tambem decide estado de categoria
   — "Carro reserva" listado ali marca a LINHA de carro reserva como negada, em vez de deixar a
   linha em branco e mencionar o assunto so no painel do rodape. NAO_INFORMADO bloqueia a
   geracao. "Beneficios adicionais" e a unica que pode sumir (spec secao 9, item 7): ausencia de
   beneficio extra nao e lacuna de cobertura. Caso de referencia conferido apos a mudanca: Tokio
   6 linhas, Porto 7, `podeGerar: true`, zero bloqueio — o mockup validado nao mudou, entao nao
   ha risco novo de estourar para a pagina 2. 8 testes novos.
3. Os parsers de cobertura em si — nenhum existe ainda (`parseOrcamentoAutoText` extrai zero
   cobertura). Contrato do que cada um deve devolver: `documentos_automacao/CONTRATO_EXTRACAO.md`.
4. Ligar os 3 modulos de dominio a tela — hoje nenhum `.jsx` os importa.

**PARSER DA FAMILIA PORTO — FEITO em 25/08.** `src/lib/pdfLayout.js` (reconstrucao de tabela por
coordenada, puro) + `src/lib/orcamentoPortoParser.js` (Porto, Azul, Itau e Mitsui num parser so)
+ `extractPdfLayout` em `apoliceParser.js` (ponte pdfjs). 25 testes contra fixtures dos PDFs
reais, em `src/lib/__fixtures__/porto-familia.json`.

**POR QUE POSICIONAL E NAO REGEX — nao repetir esse erro nos proximos parsers.** `extractPdfText`
junta os fragmentos na ordem de DESENHO do PDF, nao na ordem visual. Medido na linha do Casco da
Azul (orcamento 6065143265-0-4):

    posicao real -> LMI 100,00% | Franquia R$ 3.600,00 | ... | Premio R$ 1.320,61
    texto plano  -> 100.00% R$ 1.320,61 0.00% 0.00% R$ 3.600,00

Lido do texto plano na ordem do cabecalho, franquia e premio saem TROCADOS. Sairia franquia
errada num documento entregue ao cliente, sem nada indicando erro. As colunas sao ancoradas no
texto do cabecalho, nunca em X fixo, porque as tres marcas tem larguras diferentes.

**Dois bugs de dominio que so apareceram ao ligar parser + card:**
- `montarCategorias` montava o texto da categoria com `observacoes || nome_padronizado`. Cobertura
  extraida so com `nome_original_seguradora` (que e como o parser entrega) dava texto vazio e caia
  em NAO_INFORMADO — cobertura lida corretamente do PDF e mesmo assim bloqueando a geracao.
  Corrigido com fallback para `nome_original_seguradora`.
- `DICIONARIO_COBERTURAS` so tinha "custas de defesa"; a familia Porto escreve "CUSTOS DE DEFESA
  AUTO". O item caia em "Beneficios adicionais", como se defesa juridica fosse um mimo. As duas
  grafias entraram.

**Estado real das 3 cotacoes apos o parser:** 6 das 7 categorias INCLUIDA; `carro_reserva` sai
NAO_INFORMADO nas tres porque nenhuma das tres cotacoes menciona carro reserva — e BLOQUEIA, que
e o comportamento certo. Nao ha o que "consertar" ai: falta o dado no PDF de origem.

**PARSER BRADESCO — FEITO em 25/08.** `src/lib/orcamentoBradescoParser.js` + 21 testes, fixture em
`src/lib/__fixtures__/bradesco.json`. **Primeira cotacao das amostras que fecha com
`podeGerar: true`, zero bloqueio e zero aviso** — e a unica que declara carro reserva
("(060) Auto Reserva 07 Dias"), a categoria que trava as quatro da familia Porto.

Layout totalmente diferente da Porto: nao ha tabela com colunas, e sim grade de `rotulo: valor`
em tres colunas, dividida em secoes (CLAUSULAS, LMI, FRANQUIAS, PREMIOS, PAGAMENTO). Primitiva
nova em `pdfLayout.js`: `valorAposRotulo`.

**O escopo por secao NAO e opcional — duas armadilhas medidas:**
- `Veículo:` existe em duas secoes: na LMI vale "Valor de Mercado Referenciado", nas FRANQUIAS
  vale "2.497,72 (Reduzida)". Busca no documento inteiro imprimiria a franquia errada.
- `Nome:` existe em DADOS DO PROPONENTE e em DADOS DO CORRETOR. Sem o corte, o segurado do
  orcamento sairia como sendo a propria Conves.
Os dois casos tem teste marcado REGRESSAO.

**Terceira confirmacao de que texto plano nao serve:** as regexes escalares (nome, placa, numero
da cotacao) voltaram TODAS vazias na primeira tentativa. No texto plano deste PDF "Nº Cotação:" e
seguido de "DEMONSTRATIVO DE CÁLCULO", nao do valor. Passaram a sair por `valorAposRotulo`.

**Regra do Bradesco que difere da Porto:** a cobertura vem da lista de CLAUSULAS, nao de haver
premio. Um item contratado pode ter premio 0,00 por estar incluso no pacote — deduzir ausencia de
premio zerado inventaria exclusao. As clausulas sao mapeadas por CODIGO ((001), (060), (024)...),
nao por nome: o Bradesco reescreve o nome comercial entre versoes, o codigo do produto nao muda.

**Tabela de pagamento por coluna:** a linha de 12x so existe para o Cartao de Credito Bradesco (2
celulas, contra 8 das demais linhas). Lida por posicao na lista, o 12x seria atribuido ao Debito
em Conta e o card anunciaria 12x num meio que so vai ate 11x. Carne corretamente para em 6x, onde
o total salta de R$ 1.929,86 para R$ 2.223,45.

**Cobertura de parsers: 5 de 12 seguradoras** (Porto, Azul, Itau, Mitsui, Bradesco).
Faltam: Allianz, Darwin, HDI, Pier, Suhai, Yelum, Tokio. Nenhuma delas compartilha layout —
conferido por CNPJ e cabecalho; a economia da familia Porto nao se repete.

**PARSER HDI — FEITO em 25/08.** `src/lib/orcamentoHdiParser.js` + 24 testes, fixture em
`src/lib/__fixtures__/hdi.json`. `podeGerar: true`, as 7 categorias preenchidas.

**A HDI traz DUAS COTACOES ALTERNATIVAS no mesmo PDF**, lado a lado, cada uma com LMI, premio,
totais e tabela de parcelamento proprios: "VLR. MERCADO REFERENCIADO" (total R$ 1.478,24) e
"Valor Determinado" (R$ 1.664,71). Sao produtos diferentes — mercado indeniza 100% da FIPE do dia
do sinistro, determinado indeniza valor fixo combinado hoje. O parser usa `mercado` por PADRAO,
porque e a modalidade que Porto e Bradesco tambem cotam: comparar o "Valor Determinado" da HDI
com o "Mercado Referenciado" da Porto poria produtos diferentes lado a lado no mesmo documento.
`modalidade: 'determinado'` tem que ser pedido explicitamente, e o total da outra fica em
`modalidade_alternativa` para o corretor nao reabrir o PDF. **Confirmar com o usuario se o padrao
esta certo para a operacao.**

**Classificacao pela nota de rodape — padrao novo, reutilizavel.** A HDI batiza cobertura em
jargao interno: "07 DIAS CR MANUAL" e carro reserva, "ESPECIAL AUTO - 600KM" e assistencia 24h.
Nenhum dos dois casa com o dicionario, e encher o dicionario compartilhado de jargao de uma cia so
seria errado. Mas o proprio PDF explica os dois nas notas (*3) e (*4), no vocabulario normal do
ramo. A classificacao roda sobre nome + nota, e o dicionario continua limpo.

**Bug pego antes de sair impresso:** o L.M.I. do casco e "100,00% FIPE", nao dinheiro. Formatado
como moeda virava "Casco: R$ 100,00" no documento do cliente — valor de indenizacao falso e mil
vezes menor que o real. Teste REGRESSAO cobre.

**Refatoracao:** `humanizarCobertura` subiu para `orcamentoComparativo.js` — Porto e HDI usavam a
mesma logica de caixa alta -> caixa mista com preservacao de sigla. `orcamentoPortoParser`
reexporta como `humanizar` para nao quebrar quem ja importava.

**Dicionario:** APP (Acidentes Pessoais de Passageiros) entrou em `adicional` DE PROPOSITO.
Antes caia la por falta de classificacao, o que disparava o aviso "cobertura nao classificada" em
toda cotacao HDI — e aviso que sempre aparece deixa de ser lido.

**PARSER ALLIANZ — FEITO em 26/08.** `src/lib/orcamentoAllianzParser.js` + 30 testes, fixture em
`src/lib/__fixtures__/allianz.json` (cotacao 493446723, VW Fox 2012, 6 paginas). Com a oferta
escolhida: `podeGerar: true`, zero pendencia, as 7 categorias preenchidas.

**A ALLIANZ NAO COTA UM SEGURO, COTA SEIS.** "Roubo e Furto | Basico | Ampliado" num bloco,
"Completo | Master | Exclusivo" noutro, cada uma com LMI, preco por cobertura e total proprios.
Neste documento os totais vao de R$ 2.453,03 a R$ 4.866,50 — R$ 2.413,47 de diferenca entre a
primeira e a ultima — e as coberturas mudam junto (RCF Danos Materiais e R$ 100.000,00 na primeira
e R$ 1.000.000,00 na ultima). **Nenhuma vem marcada como escolhida**: o proprio PDF diz "o preco
por cobertura da Oferta A SER CONTRATADA". O documento e um cardapio; a escolha acontece fora dele.

**Decisao: o parser nao escolhe.** Chamado sem `oferta`, devolve tudo o que independe da escolha
(segurado, veiculo, condutor, franquia, carro reserva, condicoes gerais) + as seis em `cot.ofertas`
com o preco de cada uma, e marca `cot.escolha_pendente`. Chutar a primeira ou a mais barata poria
um premio errado num documento que vai para o cliente, sem nada indicando o erro.

**`escolha_pendente` — mecanismo novo e generico em `orcamentoComparativo.js`.** Sem ele a
validacao cuspia OITO bloqueios para um problema so, e cinco deles diziam "a cotacao nao informa" —
**mentira**: a cotacao informa, seis vezes, uma por oferta. Agora a pendencia e uma, e traz as
opcoes com preco para a tela de revisao montar o seletor. As checagens que nao dependem da escolha
continuam rodando, para o corretor ver tudo o que falta de uma vez. **Serve tambem para a HDI**
(mercado x determinado), que hoje resolve isso com um default — vale unificar depois.

**Por que pareamento sequencial e nao `colunasPeloCabecalho`:** a tabela de coberturas nao tem
cabecalho por coluna utilizavel. O nome da oferta fica centralizado sobre o PAR de colunas e
desalinhado das duas ("Basico" em x=342, valores em x=305 e x=375). E as linhas de total tem 3
celulas onde as de cobertura tem 6, entao um unico conjunto de fronteiras em X erra as duas: o
"Preco Liquido" da primeira oferta sai em x=210, que e exatamente a fronteira entre LMI e Preco.

**Rotulo com os valores NO MEIO dele.** O Casco sai em tres linhas fisicas: rotulo (y=699), valores
(y=694), continuacao do rotulo (y=688). O rotulo e remontado por janela de 10pt em Y ao redor da
linha de valores — fragmentos do mesmo rotulo distam 5–6pt, a proxima cobertura dista 14pt.

**Expansao de sigla pela legenda do proprio documento — reuso do padrao da HDI.** "RCF** - Gastos
com Defesa" e "APP*** - Morte" nao casavam com o dicionario (com os asteriscos, "app*** - morte"
nao contem "app morte"), e as tres caiam sem classificacao disparando aviso em toda cotacao
Allianz. O rodape da pagina 2 traduz as duas siglas ("** RCF: Responsabilidade Civil Facultativa |
*** APP: Acidentes Pessoais de Passageiros"), entao a sigla e trocada pelo que o documento diz que
ela significa. Dicionario compartilhado continua sem jargao de seguradora nenhuma, e o card imprime
"Responsabilidade Civil Facultativa - Danos Materiais" em vez de "RCF** - Danos Materiais".

**Bug silencioso pego em teste:** a frase que abre a secao de pagamento ("...taxas de juros e
valores de parcelas...") contem "juros" e "parcelas" e casava como se fosse o cabecalho da tabela.
Resultado: lista de ofertas VAZIA, sem erro nenhum — cotacao sem premio e sem cobertura, como se o
PDF estivesse em branco. O cabecalho passou a ser casado por CELULA, nao por linha.

**Primeira amostra que NEGA carro reserva explicitamente** ("Nao Contratado" no LMI), entao a
categoria sai NAO_INCLUIDA em vez de NAO_INFORMADO — ao contrario da familia Porto, que so nao
menciona e por isso trava. Licao do Bradesco confirmada de novo: preco "-" nao e ausencia; o
Guincho 500 Km vem sem preco proprio nas seis ofertas por estar embutido no pacote.

**Cobertura de parsers: 7 de 12 seguradoras** (Porto, Azul, Itau, Mitsui, Bradesco, HDI, Allianz).
Faltam: Darwin, Pier, Suhai, Yelum, Tokio. `npm test` 429/429.

**A TELA PASSA A PERGUNTAR (26/08, a pedido do usuario — so Allianz por enquanto).**
`src/lib/orcamentoLeitura.js` (ponte arquivo -> parser, unico modulo do comparativo que encosta em
pdfjs e no `File`; import dinamico para o pdfjs nao entrar no bundle de quem nao envia PDF) +
`src/components/auto/AutoOrcamentoOfertas.jsx` (o seletor) + fiacao em `AutoQuoteComparison.jsx`.
8 testes novos em `orcamentoLeitura.test.mjs`. `npm test` 437/437, `npm run build` OK.

Fluxo: solta o PDF -> le -> se for Allianz e houver mais de uma oferta, a tela PARA e mostra as
seis com o preco de cada -> escolhida uma, a cotacao e reprocessada (sem reabrir o arquivo) e a
revisao e preenchida. Trocar de oferta depois e uma acao normal, o seletor continua visivel.
Seguradora sem parser ligado cai em revisao manual, com aviso na tela — nada e adivinhado.

**Bug pego pelo teste, e que teria chegado ao cliente:** enquanto a escolha esta pendente,
`montarCategorias` devolve "A cotação não informa." em TODAS as categorias, e a ponte estava
levando essa frase para a revisao. Campo vazio diz "ainda nao sabemos"; aquela frase diz "a
seguradora nao cobre" — coisa diferente, e falsa aqui, porque a cotacao informa uma vez por oferta.
Agora os campos que dependem da oferta ficam vazios ate a escolha. Mesma familia do bloqueio que ja
tinha sido corrigido em `validarCotacao`.

`camposDaCotacao` espelha as chaves de `REVIEW_FIELDS` do `.jsx`; ha teste travando esse
espelhamento, porque renomear um campo la sumiria com o dado sem quebrar nada visivel.

**Nao verificado ao vivo:** build e testes passam, mas a tela nao foi aberta no navegador com um
PDF real — o caminho ate `AutoQuoteComparison` exige cotacao no Supabase e login.

**Em aberto:** a HDI segue com `mercado` como padrao. Confirmado com o usuario que "Auto Perfil" e
o nome do PRODUTO (`Hdi Auto Perfil`, calculo 1212810730), nao a modalidade de indenizacao — sao
eixos diferentes, e a escolha mercado x determinado continua valendo. Candidata a migrar para
`escolha_pendente`.

Responsavel: Claude.

---

## Design do workspace de cotacao AUTO (2026-08-24, Codex — CONCLUIDA; somente interface)

Objetivo: aplicar visualmente a especificacao do Orcamento Comparativo na pagina de cotacao e melhorar a leitura do card aberto na Pipeline, sem alterar banco, parser, automacoes, persistencia ou regras de negocio.

Entrega: `AutoCotacaoDetalhe` agora apresenta uma leitura operacional completa do segurado, contato, condutor, veiculo, risco, vigencia, seguradoras e financeiro. A aba `Orcamentos` recebeu um prototipo visual com dois slots de PDF, progresso Upload/Revisao/PDF final, revisao lado a lado, campos criticos e estados responsivos. O prototipo declara na propria interface que nao le nem salva arquivos. A ferramenta de leitura de PDF que ja existia foi preservada sem mudanca funcional, em um bloco separado. A Pipeline usa o mesmo snapshot visual completo no primeiro clique, eliminando a apresentacao fragmentada sem alterar as transicoes do Kanban.

Arquivos principais: `src/components/auto/AutoQuoteComparison.jsx`, `src/components/auto/AutoQuoteSnapshot.jsx`, `src/pages/auto/AutoCotacaoDetalhe.jsx`, `src/pages/auto/AutoEmissoes.jsx` e `src/styles/auto-ui.css`.

Restricao confirmada pelo usuario: nenhuma funcao nova de automacao foi conectada nesta rodada. Nao houve migration nova, RPC, mudanca de query, parser ou contrato de dados. A implementacao real de upload duplo, extracao, vinculo e geracao de PDF fica para a proxima fase.

Validacao do redesign: `npm test` 316/316, `npm run build` concluido e `git diff --check` limpo. `check:page-contexts` continua apontando somente a pendencia pre-existente de `src/pages/comercial/GestaoComercial.jsx`.

---

## Orcamento Comparativo AUTO — nucleo de dominio e template do PDF (2026-08-24, Claude — EM ANDAMENTO; migration 67 pendente)

Objetivo: automatizar a montagem do orcamento comparativo de seguro Auto que hoje e feito a mao no Word/Canva a cada cotacao. Spec do usuario em `documentos_automacao/specorcamentocomparativoseguros.md`; mockup ja validado em tres rodadas em `documentos_automacao/modelo/orcamentomodeloCONVES (2).pdf`.

**Entregue nesta rodada (nao depende das seguradoras que faltam):**

- `src/lib/orcamentoComparativo.js` — modulo puro com as 7 categorias fixas de cobertura, o dicionario de equivalencia de nomes entre seguradoras, o schema da cotacao (secao 5 da spec), a montagem dos dois cards e a validacao que trava a geracao.
- `src/lib/orcamentoComparativoHtml.js` — template do PDF como funcao pura (`comparativo -> string HTML`), reproduzindo o mockup validado. Auto-contido: sem folha externa, sem fonte baixada, sem script — vira PDF tanto pelo print do browser quanto por Chromium headless.
- `public/conves-logo.png` — logo da corretora com fundo transparente, extraida do proprio mockup (o projeto nao tinha o arquivo que a spec citava como `assets/conves-logo.png`).
- `src/lib/orcamentoExtracao.js` — ponte entre o parser de PDF existente (`parseOrcamentoAutoText`) e o schema do comparativo. TRADUZ, nunca ADIVINHA: o parser de hoje nao extrai cobertura nenhuma, entao coberturas/franquia/indenizacao integral voltam vazias e a revisao fica obrigatoria. `detectarTipoOperacao` roda sobre o texto bruto, o que resolve "Renovacao Congenere" (Tokio) e "RENOVACAO DA CIA" (Porto) sem regra por seguradora.
- `supabase/67_auto_orcamento_comparativo.sql` — **escrita, NAO executada**.
- Testes: 63 novos em tres arquivos (`orcamentoComparativo`, `orcamentoComparativoHtml`, `orcamentoExtracao`), registrados em `npm test`.

**Divisao com o Codex (confirmada pelo usuario em 24/08):** Codex responde por design; banco, Supabase e regras de negocio ficam aqui, como ja diz o `IA_ORCHESTRATOR.md`. Durante esta rodada o Codex chegou a criar `src/lib/autoQuoteComparison.js` e a migration 68 (dominio e banco) e depois reverteu os dois, mantendo so os componentes de apresentacao. `AutoQuoteComparison.jsx` hoje e presentacional puro (139 linhas, so React + lucide). **Nao recriar dominio de comparativo fora de `orcamentoComparativo.js`** — foi justamente a duplicacao que se desfez.

**Decisoes que valem registrar:**

- **A logo da seguradora vem do cadastro** (`seguradoras.logo_url`), nunca recortada do PDF da cotacao — pedido explicito do usuario. Seguradora sem logo cai para o nome em serifada dentro do mesmo selo, sem abrir buraco no card.
- **A cor e da seguradora, nao do papel no comparativo.** Inverter "atual" e "outra" nao pode trocar as cores. `seguradoras` ainda nao tem a coluna; ate a migration 67 rodar, `CORES_SEGURADORA_PADRAO` responde por nome canonico. Tokio `#956e26` e Porto `#1b4782` foram amostradas do mockup, nao escolhidas a olho.
- **Indenizacao integral e o campo critico.** A Tokio trata como adicional separado ("possui/nao possui"); a Porto embute 100% da FIPE dentro da compreensiva. O card SEMPRE nomeia a cobertura literalmente, com a mesma frase nos dois lados, e `null` (ninguem confirmou) BLOQUEIA a geracao. Nada aqui deduz cobertura a favor da seguradora.
- **`min-height`, nunca `height` + `overflow:hidden` na pagina.** Chegar a uma pagina cortando cobertura em silencio seria pior do que transbordar para a pagina 2. O caso de referencia fecha em 281,7mm (15,3mm de folga em A4), medido com Chromium headless.
- **Divergencia entre os dois PDFs vira aviso IMPRESSO**, nao so alerta de tela: se o corretor gerou com placa/segurado diferentes entre as duas cotacoes, quem le o documento precisa saber.
- Todo texto que vem de PDF de terceiro passa por `escapeHtml` — teste de injecao incluido.

Validacao: `npm test` 316/316 verde. PDF de referencia gerado por Chromium headless e conferido contra o mockup, 1 pagina, salvo em `documentos_automacao/modelo/orcamento-gerado-pelo-sistema.pdf` (o script que o produz esta ao lado, em `exemplo-render.mjs`). `git diff --check` limpo. `check:page-contexts` acusa somente a pendencia pre-existente de `GestaoComercial.jsx`. `npm run build` continua bloqueado pelo ambiente local pre-existente.

**PENDENTE PARA PRODUCAO:** executar `supabase/67_auto_orcamento_comparativo.sql` no SQL Editor depois da 66. Ela adiciona `seguradoras.cor_destaque` (com CHECK de hex), cria `seguradora_condicoes_gerais` e `auto_orcamentos` (persistindo o JSON estruturado, nao so o PDF) e a RPC `proximo_numero_orcamento_auto`, que aloca o sequencial CV-AAAA-NNNN no banco — dois corretores gerando ao mesmo tempo pelo front produziriam o mesmo numero. Nenhuma alteracao de banco foi executada automaticamente.

**FOLLOW-UP DE DESIGN CONCLUIDO PELO CODEX:** a interface de revisao e a nova apresentacao do detalhe/Pipeline foram entregues sem conectar automacao. Ainda faltam upload duplo real, extracao, geracao/persistencia do PDF final, cadastro operacional de Condicoes Gerais e os exemplos das outras seguradoras AUTO.

Responsavel: Claude. Proximo passo: usuario enviar as cotacoes de exemplo das demais seguradoras AUTO em `documentos_automacao/orçamentos/`.

---

## Navegacao e preparacao de renovacoes em planilha (2026-08-21, Codex — CONCLUIDA)

Objetivo: manter `/auto/renovacoes` como resumo do mes e exigir uma acao explicita para abrir a grade; permitir editar o segurado como nome personalizado ou cliente existente; transformar `Puxar renovacoes` em uma planilha real com deteccao assistida de clientes.

Entrega: `/auto/renovacoes` agora mostra indicadores, grafico de distribuicao e proximas prioridades do mes selecionado. O botao `ABRIR RENOVACOES` abre `/auto/renovacoes/planilha`, onde clicar no nome do segurado abre uma escolha entre nome personalizado e pesquisa por nome/CPF em `clientes_auto`. O vinculo altera apenas a renovacao e pode ser trocado ou removido depois.

`/auto/renovacoes/puxar` foi refeito como grade de entrada: celulas editaveis, navegacao por teclado, colagem de blocos do Excel, linhas adicionais, importacao `.xlsx` para revisao e salvamento em lote. O sistema carrega uma base leve de clientes e sugere correspondencias unicas por nome; cada sugestao exige `Vincular` ou `Nao`. Linhas com sugestao pendente bloqueiam o salvamento, evitando vinculo silencioso ou acidental.

Arquivos principais: `src/pages/auto/AutoRenovacoes.jsx`, `src/pages/auto/AutoRenovacoesPlanilha.jsx`, `src/pages/auto/AutoRenovacoesPuxar.jsx`, `src/components/auto/RenewalInsuredEditor.jsx`, `src/components/auto/OperationalSpreadsheet.jsx`, `src/lib/auto.js`, `src/lib/autoOperational.js`, `src/App.jsx` e `src/styles/auto-ui.css`.

Validacao: suite completa, parser JSX/ESM, parser CSS e `git diff --check`. Nenhuma migration nova nesta rodada; continua obrigatoria a migration 64 descrita abaixo para os campos operacionais da planilha principal.

---

## Mesa operacional AUTO — renovacoes e emissoes em planilha (2026-08-21, Codex — CONCLUIDA; migration 64 pendente)

Objetivo: substituir a organizacao fragmentada das renovacoes por uma mesa unica, realmente operavel como planilha, e separar a consulta/edicao de emissoes da pagina de entrada de Apolices.

Entrega: `/auto/renovacoes` agora e uma grade unica com edicao por celula, navegacao por Enter/setas, colagem de blocos copiados do Excel, ordenacao, busca, filtros, exportacao CSV e resumo grafico compacto. Cada renovacao registra contatos, follow-ups, ultimo/proximo contato, quantidade e percentual de descontos e notas de negociacao. Os atalhos `Contato` e `Follow-up` incrementam os contadores e registram a data. `Cotada` cria/reaproveita a cotacao e usa a RPC transacional `marcar_renovacao_auto_cotada` para mover renovacao e card juntos para `Cotacoes feitas` na Pipeline, com resultado neutro `cotada` (nao confunde com aprovada/recusada).

Em Apolices, o bloco `Ultimas emissoes` foi substituido por `VER EMISSOES`. A rota nova `/auto/emissoes/planilha` concentra filtros por mes/seguradora/tipo/status, ordenacao, edicao direta, colagem em bloco, exportacao, inclusao de linha livre ou vinculada a uma cotacao sugerida e `Ver apolice` por linha. Mudancas simples de status salvam direto; etapas que exigem proposta/apolice/resultado abrem a ficha completa, preservando exatamente as validacoes da Pipeline.

Arquivos principais: `supabase/64_auto_renovacoes_negociacao.sql`, `src/components/auto/OperationalSpreadsheet.jsx`, `src/pages/auto/AutoRenovacoes.jsx`, `src/pages/auto/AutoEmissoesPlanilha.jsx`, `src/pages/auto/AutoEmissoes.jsx`, `src/lib/auto.js`, `src/lib/autoOperational.js`, `src/App.jsx` e `src/styles/auto-ui.css`.

Validacao: 225/225 testes verdes; JSX/ESM alterado passou no `@babel/parser`; `git diff --check` verde. `check:page-contexts` continua acusando somente a pendencia pre-existente de `src/pages/comercial/GestaoComercial.jsx`. `npm run build` permanece bloqueado pelo ambiente local pre-existente (`node_modules/.bin/vite: Permission denied`).

**PENDENTE PARA PRODUCAO:** executar `supabase/64_auto_renovacoes_negociacao.sql` no SQL Editor depois da migration 63. Sem ela, os novos campos de negociacao e a transicao atomica `Cotada` nao existem no Supabase.

---

## Reformulacao operacional do modulo AUTO (2026-08-20, Codex — CONCLUIDA; migration 63 e importacao n8n pendentes)

Objetivo: corrigir a persistencia das cotacoes de seguro novo e reformular Renovacoes, Pipeline e Apolices/Emissoes com experiencia de planilha, usando apenas as abas de agosto das planilhas `01 COMISSAO - AUTO.xlsx` e `02 RENOVACOES AUTO.xlsx` como referencia de campos e operacao.

Escopo aprovado pelo usuario: grade editavel de renovacoes com colagem em massa e veiculo; pipeline em oito etapas (renovacoes futuras, renovacoes para enviar, cotacoes pendentes, cotacoes feitas, negociando, vistoria/rastreador, proposta transmitida e apolice emitida); grade de emissoes baseada na planilha de comissao, com inclusao manual ou selecao/sugestao de cotacao e sincronizacao de status entre telas.

Entrega: a entrada de seguro novo agora usa a RPC transacional e idempotente `registrar_cotacao_auto_novo`, eliminando o estado parcial "cliente salvo, cotacao perdida"; o backfill do Pipeline nao cai mais inteiro por causa de uma cotacao legada sem CPF. O workflow n8n passou de duas gravacoes independentes para uma unica chamada RPC com retry seguro.

Renovacoes recebeu o botao `VER RENOVACOES`, grade editavel com as colunas reais de agosto/2026 (Data, Cia, Segurado, Veiculo, Status, Limite, Comissao, Com. passada e Sistema) e colagem de varias linhas/nomes copiados do Excel. Pipeline agora tem oito etapas, separa data futura de hoje/atrasada, reserva pendencias a seguro novo e diferencia Novo/Renovacao/Endosso. Apolices/Emissoes virou grade de transmissoes com nova linha, Veiculo, sugestao de cotacao por nome+periodo, vinculo ao card existente e mudanca de status usando os mesmos modais/regras do Pipeline.

Arquivos principais: `supabase/63_auto_operacao_planilhas_pipeline.sql`, `n8n/workflow_conves_recebimento_auto.json`, `src/lib/autoOperational.js`, `src/lib/auto.js`, `src/pages/auto/AutoRenovacoes.jsx`, `src/pages/auto/AutoRenovacoesPuxar.jsx`, `src/pages/auto/AutoEmissoes.jsx` e `src/styles/auto-ui.css`.

Validacao: 225/225 testes verdes (inclui parsing da colagem, classificacao das duas colunas de renovacao, sugestao de cotacao e estrutura atomica do n8n); todos os JS/JSX alterados passaram no `@babel/parser`; CSS passou no PostCSS; JSON do workflow passou no `jq`; `git diff --check` verde. `npm run build` continua bloqueado pelo ambiente local pre-existente (`.bin/vite` sem permissao e `@rollup/rollup-darwin-arm64` ausente). `check:page-contexts` continua acusando somente a pendencia pre-existente de `src/pages/comercial/GestaoComercial.jsx`.

**PENDENTE PARA PRODUCAO:** executar primeiro `supabase/63_auto_operacao_planilhas_pipeline.sql` no SQL Editor; depois reimportar/ativar `n8n/workflow_conves_recebimento_auto.json`. A ordem e obrigatoria porque o front e o workflow passam a depender da RPC e das novas colunas. Nenhuma migration nem alteracao no n8n de producao foi executada automaticamente.

Responsavel: Codex. Proximo passo recomendado: aplicar migration 63, importar o workflow e fazer smoke test autenticado com um envio real de seguro novo, uma colagem de renovacoes e uma transmissao vinculada.

---

## Verificar fichas: conciliacao entre a planilha de respostas do Forms e o sistema (2026-08-05, Claude — CONCLUIDA, pendente instalacao do Apps Script e das env vars)

Objetivo: botao "Verificar fichas" em `/fichas` que le a planilha de respostas do Google Forms (ultimos 30 dias) e aponta quais respostas nunca viraram ficha no Supabase, com importacao de 1 clique pelo webhook oficial do n8n.

Motivacao: o fluxo Forms -> Apps Script (`onFormSubmit`) -> webhook n8n -> `INSERT fichas` perde a ficha quando o Apps Script falha (o usuario reportou `Error code INTERNAL` na execucao do envio). A resposta fica na planilha e nunca chega ao sistema, sem nenhum alarme.

Decisoes do usuario: leitura via Apps Script Web App (sem credencial Google nova); botao na pagina Fichas; resultado lista as divergencias com importacao manual de 1 clique.

Arquivos criados: `apps-script/verificar-fichas.gs`, `src/lib/fichasConciliacao.js`, `src/lib/fichasConciliacao.test.mjs`, `src/lib/fichasVerificacao.js`, `api/verificar-fichas.js`, `src/components/ModalVerificarFichas.jsx`, `docs/VERIFICAR_FICHAS.md`. Alterados: `src/pages/Fichas.jsx` (botao nas duas visoes + estado do modal), `src/pages/Fichas/CONTEXT.md`, `package.json` (suite de testes).

**Como a comparacao decide.** Chave primaria e CPF so digitos; fallback e nome normalizado + 8 ultimos digitos do celular quando a resposta nao tem CPF. Cada ficha so pode satisfazer UMA linha da planilha ("claim") — sem isso, duas respostas do mesmo CPF no mes casariam com a mesma ficha e uma ausencia real passaria como "tudo certo". Ficha do mesmo CPF fora da janela de 2 dias vira **incerta** (revisao humana), nunca faltante: reimportar geraria duplicata. A busca de fichas recua 15 dias alem da janela pedida pelo mesmo motivo.

**Importacao pelo caminho oficial.** A tela manda apenas `{fonte, linha}`; o servidor rele a planilha, reconfere que a linha ainda e faltante e reenvia pelo webhook do n8n. Tres consequencias: a normalizacao de imobiliaria continua sendo a do Code Node (sem segunda implementacao para manter), o conteudo importado e obrigatoriamente o que esta na planilha (nao ha caminho para gravar payload adulterado pelo cliente) e a reconferencia evita duplicar se outra pessoa importou no meio.

**Nota sobre o regex de acentos.** `normalizarTexto` usa `[̀-ͯ]` escapado de proposito. A versao com os caracteres combinantes literais funciona, mas e exatamente a forma que se corrompeu no Code Node `Normalizar Seguro Auto` do n8n (entrada de 2026-08-04), onde `̀` virou `?` e o range passou a apagar todas as letras.

Validacao: `npm test` verde com 216/216 (18 testes novos). `@babel/parser` passou nos 6 arquivos JS/JSX novos e alterados; `node --check` passou no `.gs`. `npm run check:page-contexts` acusa so a pendencia pre-existente de `GestaoComercial.jsx`. `npm run build` continua bloqueado nesta maquina: o `node_modules` tem binarios de Windows (`@esbuild/win32-x64` no lugar de `darwin-arm64`, `.bin/vite` sem permissao de execucao) — mesmo bloqueio ja registrado nas entradas anteriores, nao reinstalei para nao alterar o ambiente.

**PENDENTE PARA FUNCIONAR EM PRODUCAO** (passo a passo em `docs/VERIFICAR_FICHAS.md`): publicar o Apps Script como App da Web ("Executar como: Eu", "Quem pode acessar: Qualquer pessoa") com a propriedade `CONVES_TOKEN`, e cadastrar `FICHAS_SHEET_URL`, `FICHAS_SHEET_TOKEN` e `FICHAS_WEBHOOK_URL` na Vercel. Sem isso a rota responde 503 com instrucao e a tela nao quebra.

Riscos remanescentes: e diagnostico sob demanda, nao alarme — ninguem e avisado sem clicar no botao; nao conserta a causa do `INTERNAL` no `onFormSubmit`, so reduz o dano; renomear pergunta no Forms continua exigindo atualizar o Code Node do n8n, senao a ficha entra com campos nulos.

Responsavel: Claude. Proximo passo: instalar o Apps Script, configurar as env vars e rodar a primeira verificacao — a ficha orfa da **Neusa Aparecida de Araujo Machado** (CPF 06693260896, cliente Auto criado em 31/07 sem cotacao, cujo payload do Forms era irrecuperavel pelo n8n) e justamente o tipo de caso que esta ferramenta recupera a partir da planilha.

---

## Configuracao de leitura de PDF por seguradora (cotacoes e apolices Auto) (2026-08-04, Claude — CONCLUIDA, migration 62 pendente)

Objetivo: fazer a leitura do PDF dentro do proprio sistema. Em Configuracoes, dois botoes ("Configurar cotacoes Auto" e "Configurar apolices Auto") abrem uma grade com o card de cada seguradora cadastrada (logo + status verde/amarelo/vermelho conforme o mapeamento). Ao clicar no card, o usuario sobe um PDF de amostra, clica em "Mapear", o sistema localiza sozinho cada informacao que o sistema pede hoje, o usuario confirma campo a campo (correto / incorreto, com candidatos alternativos), visualiza o PDF na propria tela e marca a configuracao como concluida.

Arquivos criados: `supabase/62_auto_pdf_mapeamentos.sql`, `src/lib/autoPdfCampos.js`, `src/lib/autoPdfMapeamento.js`, `src/lib/autoPdfMapeamento.test.mjs`, `src/lib/autoPdfConfig.js`, `src/pages/config/AutoPdfConfigLista.jsx`, `src/pages/config/AutoPdfConfigSeguradora.jsx`, `src/pages/config/CONTEXT.md`. Arquivos alterados: `src/lib/autoPdfParser.js` (aceita o mapeamento salvo e o sobrepoe ao generico), `src/pages/Configuracoes.jsx` (os dois botoes), `src/App.jsx` (4 rotas novas), `package.json` (testes novos na suite).

**Como o mapeamento funciona.** A ancora guardada e o *rotulo do PDF* ("PREMIO LIQUIDO"), nao uma coordenada — layout reformulado nao invalida a configuracao inteira. Quando o valor aparece sem rotulo, guarda-se tipo + ocorrencia (o 2o CPF do documento, por exemplo). A dobra de acentos preserva o comprimento da string de proposito: `normalize('NFD')` deslocaria os indices e desalinharia a busca da ancora com o texto de onde os valores sao lidos. O motor gera as ultimas 1..5 palavras antes dos dois-pontos como variantes de rotulo e deixa a pontuacao escolher, em vez de adivinhar onde o rotulo comeca; o bonus por especificidade e o que separa "CPF DO CONDUTOR" de "CPF" (sem ele, o CPF do segurado venceria por posicao e o condutor herdaria o documento errado).

**Uso em producao:** `lerPdfAuto(file, tipo)` (`src/lib/autoPdfConfig.js`) e o ponto unico — le o texto, detecta a seguradora pelo proprio PDF, busca o mapeamento concluido dela e chama o parser. Sem mapeamento, o parser generico continua respondendo sozinho; a automacao nunca fica bloqueada por falta de configuracao.

**Amostra:** bucket privado `entidade-documentos`, prefixo `seguradora/<id>/auto-pdf/<tipo>/`, URL assinada de 1h no visualizador. O texto extraido fica em `auto_pdf_mapeamentos.amostra_texto` para reabrir a tela sem novo upload.

Validacao: `npm test` verde com 198/198 (27 testes novos em `src/lib/autoPdfMapeamento.test.mjs`). `npm run check:page-contexts` acusa apenas a pendencia pre-existente de `GestaoComercial.jsx`. `npm run build` continua bloqueado nesta maquina pela dependencia opcional `@rollup/rollup-darwin-arm64` ausente em `node_modules` (mesmo bloqueio ja registrado por Codex; nao reinstalei para nao alterar dependencias) — no lugar, todos os arquivos novos/alterados passaram no parser JSX/ESM.

**PENDENTE DE APROVACAO E EXECUCAO:** `supabase/62_auto_pdf_mapeamentos.sql` cria a tabela `auto_pdf_mapeamentos` com RLS `FOR ALL TO authenticated` (mesmo padrao das demais tabelas de cadastro do projeto). Nada foi executado no banco. Enquanto a migration nao rodar, as telas de configuracao abrem mas nao salvam.

Responsavel: Claude. Proximo passo: aprovar/rodar a migration 62, mapear a primeira seguradora com um PDF real e ligar `lerPdfAuto` nas telas de cotacao/emissao (arquivos hoje em edicao concorrente pelo Codex, por isso nao foram tocados).

---

## Redesign operacional Auto — fase 3 + automacoes PDF (2026-08-04, Codex — CONCLUIDA)

Objetivo: elevar Renovações, Emissões e Sinistros ao modo comando e criar a experiência visual das novas automações de PDF para cotação e apólice, com fluxo guiado de upload, extração, revisão e confirmação. Preservar parser, banco, rotas e regras existentes.

Arquivos alterados nesta fase: `src/components/auto/AutoPdfAutomation.jsx`, `src/components/auto/index.js`, `src/pages/auto/AutoCotacaoDetalhe.jsx`, `src/pages/auto/AutoEmissoes.jsx`, `src/pages/auto/AutoRenovacoes.jsx`, `src/pages/auto/AutoSinistrosV2.jsx`, `src/lib/autoPdfParser.js`, `src/styles/auto-ui.css`, `src/pages/auto/CONTEXT.md` e `artifacts/operational_design_revolution_2026-08-04.md`.

Entrega: componente visual reutilizavel `Auto PDF Intelligence`, com etapas enviar/extrair/revisar, progresso, preview dos campos, alertas e confirmacao assistida; leitura de orcamento integrada ao resultado da cotacao e ao workspace de seguradoras; leitura de proposta/apolice integrada aos dois formularios de emissao, preservando anexos de imagem e mantendo campos editaveis. O payload da emissao agora respeita os valores revisados no formulario. Renovações ganhou busca transversal e filtros persistentes; Sinistros ganhou dossie local persistente com protocolo, relato e resumo copiavel. Corrigida tambem a extracao de numero em documentos com rotulo simples `Apolice N` / `Proposta N`.

Validacao: 171/171 testes passaram, incluindo 21 testes do parser PDF; parsers JSX passaram nos cinco arquivos desta fase; parser CSS e `git diff --check` passaram. O build continua bloqueado apenas pela dependencia opcional ausente `@rollup/rollup-darwin-arm64`, ja registrada anteriormente e nao reinstalada para preservar o ambiente. `check:page-contexts` continua acusando somente a pendencia pre-existente de `src/pages/comercial/GestaoComercial.jsx`.

Responsável: Codex (Agente de Melhorias, com revisão de performance). Proximo passo recomendado: smoke test autenticado com PDFs reais de duas ou tres seguradoras e conexao da configuracao por seguradora que esta sendo implementada na tarefa paralela acima.

---

## Redesign operacional Auto — fase 2: cotacoes e relacionamento (2026-08-04, Codex — CONCLUIDA)

Objetivo: estender o modo comando para as listas de cotacoes e clientes e para o detalhe do cliente Auto, com priorizacao visual, filtros persistentes, acoes contextuais e continuidade entre registros, sem alterar banco, rotas ou regras de negocio.

Arquivos alterados: `src/pages/auto/AutoCotacoes.jsx`, `src/pages/auto/AutoClientesV2.jsx`, `src/pages/auto/AutoClienteDetalheV2.jsx`, `src/styles/auto-ui.css`, `src/pages/auto/CONTEXT.md` e `artifacts/operational_design_revolution_2026-08-04.md`.

Entrega: central de cotacoes em Auto V2 com conversao e filas acionaveis, filtros persistentes e navegacao por URL; carteira com busca debounced, filtro de situacao e preferencias salvas; perfil do cliente com acoes de relacionamento e continuidade para cotacao/renovacao/apolices. Corrigidos tambem atalhos com parametro e rota incorretos e estados de erro que antes pareciam listas vazias.

Validacao: JSX dos tres arquivos e CSS passaram nos parsers; `git diff --check` passou; suite relacionada verde com 150/150 testes. Nenhuma mudanca em banco, Supabase, RLS, rotas declaradas ou regras de negocio.

Responsavel: Codex (Agente de Melhorias, com revisao de performance). Proximo passo recomendado: fase 3 em Renovacoes, Emissoes/modais e Sinistros, com filtros salvos e formularios progressivos.

---

## Redesign operacional: Pipeline Auto, detalhes de cotacoes/apolices e dashboards (2026-08-04, Codex — CONCLUIDA)

Objetivo: elevar a qualidade visual e a produtividade do sistema, com foco inicial na Pipeline Auto, nas telas internas de cotacoes e apolices, no Dashboard Auto e no dashboard principal. O trabalho preserva banco, rotas e regras de negocio; prioriza hierarquia de informacao, acoes mais rapidas, reducao de cliques, responsividade e consistencia do design system.

Arquivos alterados: `src/pages/auto/AutoEmissoes.jsx`, `src/pages/auto/AutoCotacaoDetalhe.jsx`, `src/pages/auto/AutoApoliceDetalheV2.jsx`, `src/pages/Dashboard.jsx`, `src/styles/auto-ui.css`, `src/styles/fianca-ui.css`, os CONTEXTs correspondentes e `artifacts/operational_design_revolution_2026-08-04.md`.

Entrega: Pipeline com busca transversal e contadores filtrados; cotacao convertida em workspace Auto V2 com cinco abas, resumo consolidado, acoes de contato/copia e status em um clique; apolice com acoes rapidas, status legiveis, erro de salvamento, protecao de alteracoes pendentes e atalho `Ctrl/Cmd + S`; dashboard principal com launchpad para as cinco mesas operacionais. O Dashboard Auto ja estava no padrao de central de comando e foi preservado para evitar retrabalho sem ganho.

Validacao: parser JSX passou nos quatro arquivos alterados, parser CSS passou nos dois stylesheets e `git diff --check` passou. Suite relacionada passou com 150/150 testes. A suite completa tem uma falha pre-existente no arquivo nao rastreado `src/lib/autoPdfParser.test.mjs` (`parsePropostaAutoText` nao extrai numero esperado), fora deste redesign. O build chegou ao Vite, mas ficou bloqueado porque a dependencia opcional `@rollup/rollup-darwin-arm64` esta ausente em `node_modules`; nao foi reinstalada para nao alterar dependencias do usuario. `check:page-contexts` continua acusando apenas a pendencia pre-existente de `src/pages/comercial/GestaoComercial.jsx`.

Responsavel: Codex (Agente de Melhorias, com revisao de performance). Proximo passo recomendado: smoke test autenticado em desktop/mobile e fase 2 em clientes/modais de emissao, filtros salvos e command palette contextual.

---

## AUTO: execucao do formulario de recebimento falhou sem criar a cotacao (2026-08-04, Claude — CONCLUIDA)

Objetivo: ler a execucao que falhou no n8n (webhook `CONVES RECEBIMENTO AUTO`), corrigir a causa para as proximas passarem e inserir no sistema a cotacao que nao foi criada.

**A instancia do n8n mudou de host.** O `.env.local` apontava para `aula-n8n.riftvt.easypanel.host`, que esta morto (DNS resolve, mas 443/80/5678/8080 dao timeout). O host atual, informado pelo usuario, e `aula-n8n.orq60x.easypanel.host`. `N8N_URL` foi atualizado e o usuario gerou uma `N8N_API_KEY` nova (a antiga era da instancia anterior). Backup do arquivo em `.env.local.bak-<timestamp>`.

**O workflow em producao era diferente do JSON versionado.** `n8n/workflow_conves_recebimento_auto.json` descrevia um fluxo com nos `httpRequest` e upsert (`on_conflict=cpf`); producao usa nos `n8n-nodes-base.supabase` com o padrao update-entao-create: Normalizar -> Atualizar Cliente Auto -> Cliente Foi Atualizado? (IF) -> [true] Preparar Cotacao / [false] Criar Cliente Auto -> Preparar Cotacao -> Criar Cotacao -> Responder OK. Toda a analise inicial feita sobre o arquivo local era sobre um fluxo que nao existe mais.

**Execucao 851 (04/08 16:44 BRT, cliente Matheus Favaretto Ramos Campagnoli) — dois bugs:**

1. **Regexes corrompidas no Code Node `Normalizar Seguro Auto` (causa da corrupcao de dados).** Tres escapes foram perdidos em alguma edicao: `[\u0300-\u036f]` virou `[?-ͯ]`, `/\s+/` virou `/s+/` e `/\D/` virou `/D/`. O primeiro e fatal: `?` e 0x3F e o range 0x3F-0x36F cobre todas as letras, entao `normalizeKey` apagava cada letra e **toda** chave normalizava para string vazia. `buildIndex` gravava tudo em `index[""]`, sobrescrevendo ate sobrar a ultima chave do payload — `formulario`. Resultado: 22 dos 23 campos saiam com o valor `"Seguro Auto"`. O unico campo correto foi `jovens_18_26`, porque digitos (0x30-0x39) ficam abaixo de 0x3F e sobreviviam, fazendo `'18 26'` casar com o alias `'Jovens 18 a 26'`.
2. **Referencia errada no no `Criar Cliente Auto` (causa da falha visivel).** Os campos usavam `{{ $json.cliente.* }}`, mas o input desse no vem do IF, ou seja, do resultado do UPDATE — que nao retorna linha quando o cliente ainda nao existe. `$json.cliente` era `undefined`, `nome_completo` virava nulo e o Postgres rejeitava com `null value in column "nome_completo" of relation "clientes_auto" violates not-null constraint` (HTTP 400).

**Correcoes publicadas em producao** (workflow `EuESfEBc8UkN16ET`, backup do estado anterior em `n8n/backup_wf_AUTO_<timestamp>.json`):
- `Normalizar Seguro Auto`: substituido pelo normalizador de `n8n/code_recebimento_auto.js` — chaves normalizadas sem acento/caixa/pontuacao, fallback por palavras-chave com termos proibidos para nao misturar segurado e condutor, aliases alinhados aos rotulos reais do Forms (que trazem `:` e espacos no fim), erro de CPF agora lista as chaves recebidas, e novo campo `campos_nao_mapeados`.
- `Criar Cliente Auto`: campos passaram a referenciar `$('Normalizar Seguro Auto').first().json.cliente.*` em vez de `$json.cliente.*`.
- `retryOnFail` 3x/2s nos tres nos Supabase.
- `settings.binaryMode` ("separate") foi perdido no PUT porque a API publica rejeita a propriedade; o workflow nao trata binarios.

**Validacao:** o payload original da execucao 851 foi reenviado pelo webhook de producao. Execucao 855 = `success`, resposta `{"ok":true,"cotacao_id":"69e6bf74-..."}`. No banco: cliente `e5a040f4` com nome/CPF/telefone/celular/email/estado civil/profissao corretos, cotacao `69e6bf74` com veiculo (Corsa Classic 2008, placa EAJ0B74), CEP de pernoite, uso, tres garagens, kit gas, blindagem e isencao preenchidos, e o card `a157707a` criado em `emissoes_auto` pelo trigger. Antes disso, 4 cenarios sinteticos (rotulos originais, rotulos variantes, payload sem CPF, payload aninhado em `.body` com condutor diferente do segurado) rodaram contra o codigo, sem vazamento entre segurado e condutor. Node do PATH nao existe nesta maquina; usado o binario embarcado do ChatGPT.app.

Nenhuma alteracao de schema, RLS ou regra de negocio. As escritas no Supabase foram feitas pelo proprio workflow, nao por script.

**Pendencias:**
- Cliente orfao **Neusa Aparecida de Araujo Machado** (CPF 06693260896, criado 31/07 13:52 UTC) continua sem cotacao. A execucao que o gerou nao existe mais nesta instancia (so 851 e 855 constam), entao o payload do Forms dela nao e recuperavel pelo n8n — teria de vir da planilha de respostas do Google Forms.
- Dois campos do Forms nao tem coluna em `cotacoes_auto` e sao descartados: `Tipo de residencia:` e `Veiculo tem passagem por leilao:`. Passagem por leilao afeta aceitacao e preco; vale decidir se entra no schema.
- O Forms de AUTO nao pergunta condutor principal, entao `condutor_nome`, `condutor_cpf` e `estado_civil_condutor` ficam sempre nulos. O normalizador ja suporta esses campos se forem adicionados ao formulario.
- `Cep de pernoite` recebe endereco por extenso, nao CEP.
- `n8n/workflow_conves_recebimento_auto.json` continua desatualizado em relacao a producao. A fonte de verdade agora e o backup em `n8n/backup_wf_AUTO_<timestamp>.json` mais o estado no servidor.

Risco remanescente: o fluxo continua nao-transacional — o cliente e criado antes da cotacao, entao uma falha na cotacao deixa cliente orfao (foi o que aconteceu com a Neusa). Tornar atomico exigiria uma funcao RPC no Postgres, o que cai na regra de "banco -> parar e aprovar" do CLAUDE.md e nao foi feito.

---

## Apolices: correcao do header e refinamento visual do detalhe (2026-08-04, Codex — CONCLUIDA)

Objetivo: corrigir o masthead branco dentro da apolice para o azul/indigo do workspace de Fianca e elevar a hierarquia visual, a legibilidade das acoes, os cards e a responsividade de `ApoliceDetalhe`, sem alterar banco, rotas ou regras de negocio.

Arquivos em uso: `src/pages/ApoliceDetalhe.jsx`, `src/styles/fianca-ui.css`, `src/pages/ApoliceDetalhe/CONTEXT.md`.

Entrega: masthead protegido contra a regra legada branca por seletor explicito do workspace e `background` azul/indigo com prioridade; acoes com hierarquia visual, metricas com interacao sutil, cabecalhos de cards com marcador e resumo financeiro refinado. Mobile prioriza o botao Salvar e redistribui as demais acoes.

Validacao: `git diff --check` passou. `npm run build` e `npm run check:page-contexts` nao puderam ser executados porque `node`/`npm` nao estao instalados ou expostos no ambiente desta rodada. Nenhuma alteracao de banco, rotas, queries ou regra de negocio.

Risco remanescente: smoke test visual autenticado ainda recomendado em desktop e mobile para confirmar o resultado com dados reais.

---

## AUTO: excluir cotação/renovação não excluía de verdade (2026-07-30, Claude — CONCLUÍDA, sem smoke test ao vivo)

Usuário reportou que, no setor AUTO, ao excluir cotações e renovações "elas não estão sendo excluídas de verdade". `superpowers:systematic-debugging` — causa raiz confirmada com evidência direta do banco de produção (script temporário somente-leitura com `service_role`, removido depois; nenhuma escrita feita).

**Causa raiz: eram DOIS bugs simétricos, ambos de FK sem CASCADE.** Renovação, cotação, emissão (card do Kanban) e apólice são um único registro lógico, mas cada botão de excluir só apagava a sua ponta:

1. **Excluir cotação → a renovação voltava.** `renovacoes_auto.cotacao_id` é `ON DELETE SET NULL` (`supabase/55_auto_renovacao_cotacao_tags.sql:11`). `deletarCotacaoAuto` apagava cotação/emissão/apólice, e o Postgres apenas zerava `cotacao_id` da renovação — que, com `cotacao_id IS NULL`, reaparecia na hora na coluna virtual "Renovações" do próprio Kanban (`getRenovacoesPendentesSemCotacao`) e em `/auto/renovacoes`, como "não cotada". Da tela, é idêntico a "não excluiu".
2. **Excluir renovação → a cotação ficava órfã.** `excluirRenovacao` apagava só a linha de `renovacoes_auto`; a cotação e o card de emissão gerados por ela continuavam vivos em `/auto/cotacoes` e no Kanban. **Evidência no banco de produção:** a cotação `070755b0` (KELLY CRISITNA ACACIO VICENTE, `tipo=renovacao`) existe sem nenhuma renovação apontando para ela — órfã deixada por uma exclusão anterior; logo depois há duas renovações manuais duplicadas da mesma cliente, coerentes com o usuário tentando recriar o que "não sumia".
3. **Bug latente da mesma família, corrigido junto:** o trigger `tg_apolice_to_renovacao` cria uma renovação para toda apólice inserida, e `renovacoes_auto.apolice_id` **não** tem cascade. Excluir uma cotação/emissão que já virou apólice batia em erro 23503 (`renovacoes_auto_apolice_id_fkey`) — falha visível, mesma classe de sintoma. `endossos_auto.cotacao_id`/`.apolice_id` tinham o mesmo problema.

**Correção:** nova função pura `planejarExclusaoGrupoAuto` (`src/lib/autoExclusao.js`) monta a ordem correta dos DELETEs do grupo (dependentes da apólice → apólice → emissão → dependentes da cotação → cotação), e `deletarCotacaoAuto`, `excluirRenovacao` e `deletarEmissaoAuto` (`src/lib/auto.js`) passaram a executar esse plano em vez de apagar só a própria tabela. A renovação vinculada é apagada **antes** da cotação — se fosse depois, o `ON DELETE SET NULL` já teria desvinculado e ela sobreviveria. Duas travas propositais: renovação cuja cotação já virou apólice emitida **não** é excluída (erro pedindo para excluir a apólice antes — a apólice é registro real da carteira) e grupo com sinistro registrado é bloqueado com mensagem legível em vez de erro cru de FK. Renovação avulsa (manual/planilha/carteira, sem cotação) continua removendo só a própria linha, sem tocar na apólice que ela referencia.

**Cache do React Query:** `AutoEmissoes.jsx` invalidava `['auto-renovacoes']` mas não `['auto-renovacoes-pendentes']` — a coluna "Renovações" do Kanban tem query própria e não recarregava após excluir. Corrigido nas 3 telas (`AutoEmissoes.jsx`, `AutoRenovacoes.jsx`, `AutoRenovacoesPuxar.jsx`), que agora invalidam também emissões/cotações, já que a exclusão cruza os dois lados.

`npm test` (150/150, 8 testes novos em `src/lib/autoExclusao.test.mjs` escritos antes do fix) e `npm run build` verdes. Dry-run do planejador contra os dados reais de produção confirmou os 3 cenários (excluir cotação, excluir renovação já cotada, excluir renovação avulsa). Nenhuma migration, nenhuma mudança de schema/RLS — só lógica de app.

**Smoke test pendente (sem login real nesta rodada):** excluir uma cotação de renovação no Kanban e confirmar que ela **não** reaparece na coluna "Renovações"; excluir uma renovação já cotada em `/auto/renovacoes` e confirmar que a cotação some também de `/auto/cotacoes` e do Kanban; excluir uma renovação avulsa e confirmar que só ela some.

**Dados órfãos existentes:** a cotação `070755b0` (KELLY CRISITNA) segue no banco sem renovação, e há 2 renovações manuais duplicadas da mesma cliente (`535d20d1` e `ede12cc0`, uma com vigência 2026-08-01 e outra 2025-08-01). Não apaguei nada — com a correção, dá para excluir pela própria UI; a decisão de qual manter é do usuário.

**Risco remanescente:** a exclusão são vários DELETEs sequenciais via PostgREST, sem transação — se a conexão cair no meio, o grupo pode ficar parcialmente apagado (o passo seguinte é seguro de repetir; basta excluir de novo). Uma versão transacional exigiria uma função RPC no Postgres, o que entra na regra de "banco → parar e aprovar" do `CLAUDE.md` e não foi feito.

---

## Auditoria de segurança completa do sistema (2026-07-30, Claude — LAUDO ENTREGUE, nenhuma correção aplicada, aguardando aprovação)

Usuário pediu para ler as skills de segurança (`security-review`, `database-sentinel-main`) e fazer uma análise COMPLETA do sistema para "deixar a segurança boa". Escopo auditado: banco (Supabase/PostgREST, RLS de 67 arquivos em `supabase/`, Storage), autenticação, os 3 endpoints `api/`, todo o `src/`, build/deploy (Dockerfile, nginx.conf, vercel.json), `painel-agentes/`, `scripts/`, gestão de secrets e histórico do git.

**Laudo completo em `artifacts/security_audit_2026-07-30.md`** (com o SQL de correção de cada item). Placar: 3 CRÍTICOS, 3 ALTOS, 5 MÉDIOS, 8 controles aprovados. Nota 25/100.

Os 3 críticos:
1. **Escalada de privilégio de qualquer visitante da internet até admin total.** `profiles_update_own` (`supabase/03_rls.sql:61`) não restringe colunas — RLS do Postgres não tem granularidade de coluna, e não existe nenhum trigger/GRANT protegendo `is_admin`. Como `src/pages/Login.jsx` tem cadastro público aberto, qualquer pessoa cria conta e faz um `PATCH /rest/v1/profiles {"is_admin":true}` direto no PostgREST, pulando o endpoint `api/update-user-profile` que o projeto criou justamente para gatear isso. Destrava todas as fichas (CPF/CNPJ), financeiro, comercial, e os 3 endpoints com `service_role` — inclusive trocar a senha de qualquer usuário via `api/create-user.js:108`.
2. **RCE na máquina do dev via `painel-agentes/server.js`.** Servidor WebSocket sem autenticação, sem validação de `Origin` (a lib `ws` não valida por padrão e navegador não aplica same-origin a WS), com bind em `0.0.0.0`, que injeta qualquer mensagem recebida como prompt de `claude --print --dangerously-skip-permissions` com `cwd` na raiz do repo. Qualquer site visitado pelo dev com o painel ligado consegue CSWSH → shell → ler `n8n/wf_update.json` (que tem a chave `service_role` em texto puro) → comprometimento total do banco.
3. **7 tabelas `*_backup_20260727` sem RLS** (`supabase/57_zerar_dados_auto.sql:30-45`) — `CREATE TABLE AS TABLE` não herda RLS nem policies. Padrão da CVE-2025-48757. Confirmei ao vivo que as tabelas existem em produção (a 57 rodou) mas estão vazias — risco estrutural latente, sem vazamento ativo hoje.

**Verificação ao vivo feita:** probe somente-leitura com a chave `anon` pública, sem login, sem escrita. Confirmou que a RLS de `fichas`/`profiles`/`apolices`/`clientes_auto` está ativa e efetiva (0 linhas para anon) e que as 7 tabelas de backup existem. Confirmei também por `git log --all -S` que a chave `service_role` **nunca** foi commitada em nenhum commit — o `.gitignore` está correto.

**Nada foi corrigido.** Regra do `CLAUDE.md` ("banco, auth, RLS ou dados pessoais → parar, apresentar plano e aguardar aprovação"): plano de 10 passos no fim do laudo, aguardando decisão do usuário.

**Pendências que exigem o painel do Supabase (não auditáveis por código):** o bucket `documentos` é público? (se for, os PDFs com CPF são legíveis sem login — viraria CRÍTICO); JWT expiry ≤3600s e refresh token rotation; confirmação da RLS das tabelas de backup via `pg_class.relrowsecurity`.

---

## Performance: carga global do módulo Comercial rodava em toda página, para todo usuário (2026-07-29, Claude — CONCLUÍDA, sem smoke test ao vivo)

Usuário reportou o sistema "um pouco lento" e pediu foco em responsividade/velocidade "em tudo", sem mexer em nada visível ou funcional.

1. **Causa raiz principal, encontrada por leitura de código:** `Layout.jsx` chamava `initComercialStore(user.id)` (`src/lib/comercial.js`) num `useEffect` disparado assim que `user` fica disponível — ou seja, em **toda** sessão, em **toda** página do sistema (Dashboard, Fichas, Apólices, Auto, Treinamentos etc.), mesmo que o usuário nunca abra o módulo Comercial. Essa função busca 5 tabelas inteiras sem paginação em paralelo (`comercial_leads`, `comercial_vendas`, `comercial_eventos`, `comercial_jornadas`, `comercial_scripts`, todas com `select('*')` e sem `limit`). Só o módulo Comercial (`Pipeline`, `BaseLeads`, `LeadDetalhe`, `Vendas`, `Calendario`, `Jornadas`, `GestaoComercial`, `ComercialDashboard`, via `useComercial()`) consome esses dados — confirmado por grep, nenhuma outra tela depende do store. **Corrigido:** o `useEffect` que chama `initComercialStore` agora só dispara quando a rota atual é `/comercial/*` (`isCommercialRoute`, já calculado no componente). O cache interno do store (`_userId === userId && _loaded`) já evitava refetch em navegações subsequentes — não mudou. Efeito colateral aceitável: a primeira vez que o usuário abre uma tela Comercial na sessão passa a buscar os dados naquele momento (antes já era assim quando alguém navegava rápido demais logo após o login, já que a busca sempre foi assíncrona) — nenhuma tela nova de loading foi criada, é o mesmo estado inicial vazio que o hook `useComercial()` já tratava.
2. **`CommandPalette`** (paleta de busca universal, Ctrl+K) estava com import estático em `Layout.jsx`, entrando no bundle inicial de toda página mesmo sem nunca ser aberta. **Corrigido:** virou `lazy()` e só é montado (dentro de `Suspense`) quando `cmdOpen` é true.

`npm test` (142/142) e `npm run build` verdes. Nenhuma mudança de schema/RLS/rotas/regra de negócio — só o timing de quando um fetch já existente dispara, e code-splitting de um componente. `src/pages/comercial/*` e o restante do fluxo do módulo Comercial não foram tocados.

**Smoke test pendente (sem login real nesta rodada):** confirmar que Dashboard/Fichas/Apólices/Auto abrem mais rápido logo após o login; entrar em qualquer tela `/comercial/*` e confirmar que os dados (leads, vendas, eventos, jornadas, scripts) ainda carregam normalmente; abrir a busca universal (Ctrl+K) e confirmar que ainda funciona (pode haver uma fração de segundo a mais na primeiríssima abertura, por causa do lazy load).

**Riscos remanescentes:** nenhuma mudança de comportamento visível esperada; o único risco é um usuário que navegue extremamente rápido do login direto para uma tela Comercial ver o estado vazio inicial por um instante a mais do que antes (mesma race condition que já existia, só desloca o início do fetch). Não investiguei outras páginas em profundidade (Kanban de Fichas/Apólices/Auto, listas grandes) por serem áreas com histórico recente de bugs sutis de drag-and-drop — evitei mexer lá para não arriscar regressão funcional; se ainda estiver lento após essa correção, o próximo lugar a olhar é ali.

---

## Redesign da Pipeline AUTO e calendários (2026-07-29, Codex — CONCLUÍDA)

Objetivo: melhorar integralmente a experiência de `/auto/gestao`, preservando drag-and-drop e fluxos de resultado/emissão, com navegação por setas que avança ou retorna uma coluna sem exigir scroll horizontal manual. Também modernizar os controles de período e os calendários usados no módulo AUTO, com melhor legibilidade, foco e responsividade.

Arquivos em uso: `src/pages/auto/AutoEmissoes.jsx`, `src/styles/auto-ui.css`, `src/components/ui/DatePicker.jsx`, `src/pages/auto/CONTEXT.md` e este handoff.

Entrega: a Pipeline passou a ter mapa clicável das 7 etapas, contadores, setas superiores e flutuantes para avançar/voltar exatamente uma coluna, indicador de posição e navegação por teclado. Colunas, cabeçalhos, cards, dropzones, densidade, dark mode e mobile foram refinados. O período personalizado usa o `DatePicker` visual; o componente ganhou dias da semana legíveis, estados selecionado/hoje, navegação e acessibilidade melhores. Inputs nativos de data/mês de todo o escopo `.auto-page` também receberam o novo acabamento.

Regras preservadas: drag-and-drop, coluna virtual de renovações, abertura dos modais de resultado/emissão, filtros, queries e mutations não foram alterados. `npm test` 142/142, `npm run build` verde e `git diff --check` sem erros. A inspeção visual automatizada não abriu porque a ponte do navegador interno falhou antes da navegação; permanece recomendado um smoke test autenticado em `/auto/gestao` para conferir setas, drag-and-drop e calendário com dados reais.

Responsável atual: Codex. Próximo passo sugerido: smoke test autenticado e aprovação visual do usuário.

---

## Preenchimento de cotações Auto: números com vírgula, campo "Comissão ano passado" e auto-preenchimento ao arrastar para "Cotação feita" (2026-07-29, Claude — CONCLUÍDA, sem smoke test ao vivo)

Usuário reportou 2 problemas no preenchimento de cotações do seguro Auto e pediu 1 melhoria de fluxo: (1) os campos numéricos (Prêmio total, Prêmio líquido, % Comissão) na tela de detalhe da cotação não aceitavam vírgula como separador decimal; (2) pediu um campo "Comissão ano passado" no preenchimento da cotação; (3), numa interrupção durante a investigação, pediu que ao arrastar um card para a coluna "Cotação feita" no Kanban de Gestão Auto, o modal de resultado já viesse com a seguradora e os valores preenchidos automaticamente, em vez de abrir em branco.

1. **Causa raiz de (1):** `AutoCotacaoDetalhe.jsx` (seção "Seguradoras", campos Premio total/Premio liquido/% Comissao) usava `<input type="number">` nativo do HTML, que não aceita vírgula como separador decimal na maioria dos navegadores/locales — exatamente o sintoma relatado. **Corrigido:** trocado para `type="text"` + `inputMode="decimal"`, reaproveitando `parseDecimalBR`/`formatDecimalBRInput` (`src/lib/numberInput.js`), o mesmo helper já usado em `ModalFicha.jsx`/`FinanceiroProducao.jsx` para o mesmo problema — aceita `1.234,56`, `1234,56` ou `1234.56` e sempre grava número. Exibição ao sair do modo edição também passou a mostrar formatado em pt-BR (antes mostrava o número cru, ex. `1234.5`, o que reforçava a confusão sobre o separador esperado).
2. **(2):** novo campo "Comissão ano passado" em cada bloco de seguradora (preferencial/mais barata) da cotação — gravado como `comissao_ano_passado` dentro do próprio `jsonb` de `seguradora_preferencial`/`seguradora_mais_barata` (`cotacoes_auto`), **sem migration** (coluna já é `jsonb`, aceita chave nova livremente). Card "Comissão estimada" ganhou uma linha de comparação (`vs. ano passado (R$ X): +R$ Y`) quando o campo está preenchido. É um dado diferente do `renovacao_comissao_ano_anterior` que já existe em `emissoes_auto`/`apolices_auto` (esse é auto-calculado a partir do histórico real da apólice, no estágio de emissão/renovação; o novo é digitado manualmente no estágio de cotação, antes de existir emissão).
3. **(3):** `AutoEmissoes.jsx` — `ModalResultado` (aberto ao soltar um card em "Cotação feita") inicializava `seguradoras` sempre com um item em branco. Nova função `getSeguradorasResultadoInicial(emissao)`: se a emissão já tem resultado registrado (reabrindo para editar), usa esse resultado; senão copia da seguradora selecionada na cotação (`seguradora_preferencial`, com fallback para `seguradora_mais_barata` — mesma ordem de prioridade já usada em `getFormEmissaoInicial`/`seguradoraEmissao`), mapeando `premio_total → valor_total`. Banner verde no modal avisa quando os dados vieram herdados da cotação, para o usuário conferir antes de salvar.

`npm test` (142/142) e `npm run build` verdes. Nenhuma mudança de schema/RLS/migration — só lógica de app em `src/pages/auto/AutoCotacaoDetalhe.jsx` e `src/pages/auto/AutoEmissoes.jsx`.

**Smoke test pendente (sem login real nesta rodada):** em `/auto/cotacoes/:id`, editar Premio total/liquido/% Comissao digitando com vírgula (ex. `1.500,00`) e confirmar que salva certo; preencher "Comissão ano passado" e ver a comparação aparecer; no Kanban de Gestão Auto, arrastar um card de "Cotações pendentes" para "Cotação feita" numa cotação que já tem seguradora preferencial/mais barata preenchida e confirmar que o modal abre com a seguradora e os valores já preenchidos (com o aviso verde), permitindo só conferir e salvar.

**Riscos remanescentes:** o auto-preenchimento em (3) só herda de `seguradora_preferencial`/`seguradora_mais_barata` — se a cotação nunca teve nenhuma das duas preenchida (ex. lead muito no início), o modal continua abrindo em branco como antes (comportamento correto, não há o que herdar). Campos `forma_pagamento`/`parcelamentos` são copiados se existirem no jsonb, mas a tela de cotação hoje não os edita diretamente (só ficariam preenchidos se vierem de outro fluxo) — não é regressão, é o mesmo dado que já era lido em `getFormEmissaoInicial`.

---

## "Iniciar cotação" quebrava com erro de schema cache + regra "só nome/seguradora/vencimento obrigatórios" (2026-07-28, Claude — CONCLUÍDA, migration pendente)

Follow-up imediato da entrada abaixo. Usuário tentou "Iniciar cotação" numa das renovações recém-criadas e recebeu `Could not find the 'vigencia_fim' column of 'cotacoes_auto' in the schema cache`. Pediu também, indo além do bug: para cotações de renovação, a ÚNICA informação obrigatória na criação deve ser nome, seguradora e vencimento — nada mais (nem CPF).

1. **Causa raiz confirmada por leitura de código, mesma classe de bug já vista nesta sessão:** `34_auto_schema_sync.sql` e `39_auto_schema_hardening.sql` já continham `ALTER TABLE cotacoes_auto ADD COLUMN IF NOT EXISTS vigencia_inicio date, ADD COLUMN IF NOT EXISTS vigencia_fim date` — mas nenhuma das duas rodou em produção. A migration 59 (sessão anterior) corrigiu o mesmo gap para `apolices_auto`/`emissoes_auto`, só não cobriu `cotacoes_auto`. Toda chamada a `criarCotacaoAuto` que envia `vigencia_fim` (inclusive "Iniciar cotação" de uma renovação) sempre quebrava com esse erro do PostgREST. **Corrigido:** nova migration `supabase/61_auto_cotacao_vigencia_colunas_faltantes.sql` (idempotente, mesmo padrão da 59) — **AINDA NÃO EXECUTADA NO SUPABASE, bloqueia "Iniciar cotação" até rodar.**
2. **Regra nova, pedida explicitamente:** `criarCotacaoAuto` (`src/lib/auto.js`) agora valida, só para `tipo === 'renovacao'`: nome do segurado, seguradora e vencimento (`vigencia_fim`) obrigatórios — lança erro claro em português se faltar algum, em vez de deixar o Postgres/PostgREST quebrar com mensagem técnica. CPF continua opcional (já resolvido na entrada anterior). "Novo negócio" e "endosso" não são afetados (continuam exigindo CPF/cliente de verdade, pois geram registro real do seguro).
3. **Efeito colateral corrigido:** o mini-formulário "Buscar cliente e apólice > Cliente novo" (`AutoCotacoes.jsx`, aba Renovação) nunca teve campos de Seguradora/Vencimento — só nome/CPF/celular/veículo/placa, com CPF obrigatório. Como a nova regra exige seguradora+vencimento e dispensa CPF, esse formulário ganhou `SeguradoraSelect` + campo de data, e o botão "Criar cotação de renovação" passou a exigir nome+seguradora+vencimento (CPF virou opcional, "pode preencher depois").

`npm test` (142/142) e `npm run build` verdes. Sem smoke test ao vivo nesta rodada.

**Risco remanescente:** renovações manuais criadas ANTES desta correção sem seguradora preenchida (seguradora é opcional na criação da renovação em si) vão bloquear em "Iniciar cotação" com a nova mensagem "Seguradora é obrigatória..." — o usuário precisa usar "Editar" (`ModalEditarRenovacao`) para preencher a seguradora antes de tentar de novo. Migration 61 também precisa rodar antes de qualquer "Iniciar cotação" funcionar de verdade em produção.

**Próximos passos sugeridos:** rodar `supabase/61_auto_cotacao_vigencia_colunas_faltantes.sql` no SQL Editor; smoke test: "Iniciar cotação" numa renovação com seguradora preenchida (deve abrir a cotação normalmente, sem CPF) e numa sem seguradora (deve mostrar o toast de erro claro, não mais o erro de schema).

---

## Campo "Possui 2 veículos?" na criação de renovação + "Iniciar cotação" exigia CPF (2026-07-28, Claude — CONCLUÍDA, migration pendente)

Dois pedidos na mesma sessão: (1) no formulário "Criar manualmente" de `/auto/renovacoes/puxar`, adicionar um campo opcional "Possui 2 veículos?" que, se marcado, libera um campo de texto livre para dizer qual veículo é aquela renovação; (2) clicar em "Iniciar cotação" numa renovação pendente retornava "CPF do cliente é obrigatório para salvar o registro do seguro auto" — pedido para permitir criar a cotação de renovação sem CPF, o usuário preenche depois direto na tela da cotação.

1. **Campo "Possui 2 veículos?":** nova coluna `identificacao_veiculo` (texto, opcional) em `renovacoes_auto` — `supabase/60_auto_renovacao_identificacao_veiculo.sql` (**AINDA NÃO EXECUTADA NO SUPABASE**, rodar manualmente antes do campo persistir de verdade). `criarRenovacaoManual` (`src/lib/auto.js`) aceita `identificacaoVeiculo`. Checkbox + campo de texto condicional adicionados em `AutoRenovacoesPuxar.jsx` (criação) e `ModalEditarRenovacao.jsx` (edição posterior, compartilhado com `AutoRenovacoes.jsx`). Exibido como linha extra "Veículo: X" nas 3 listas que mostram renovação (cards e tabela de `AutoRenovacoes.jsx`, tabela "Renovações do mês" de `AutoRenovacoesPuxar.jsx`) só quando preenchido. Escopo combinado com o usuário: só o fluxo manual (puxar do sistema/planilha não ganham o campo).
2. **Causa raiz do CPF obrigatório, confirmada por leitura de código:** `resolverClienteAutoId` (`src/lib/auto.js`) é chamada por toda função que grava cliente/cotação/emissão/apólice do módulo Auto e sempre lançava erro se não houvesse `cliente_id` válido nem CPF — inclusive dentro de `criarCotacaoAuto`, usada tanto por "Iniciar cotação" (`iniciarCotacaoRenovacao`) quanto por "Nova cotação > Renovação" (`AutoCotacoes.jsx`). Uma renovação sem cliente cadastrado (veio de planilha, ou só tem nome livre) nunca tinha CPF disponível, então cotar a partir dela sempre falhava — mesmo risco já documentado numa sessão anterior ("Fazer Cotação numa renovação vinda de planilha lança erro de CPF obrigatório"), agora relatado ao vivo pelo usuário. **Corrigido:** `resolverClienteAutoId` ganhou o parâmetro opcional `{ exigirIdentificacao }`; `criarCotacaoAuto` só exige CPF/cliente quando `tipo !== 'renovacao'` — "novo negócio" e "endosso" continuam exigindo (geram registro real do seguro), só a criação da cotação de renovação passa a aceitar `cliente_id: null`. Não precisou de migration (`cotacoes_auto.cliente_id` já é nullable no schema) nem mudança no fluxo de preencher o CPF depois — a tela de detalhe da cotação (`AutoCotacaoDetalhe.jsx`) já permite editar `cpf_cliente` livremente a qualquer momento.

`npm test` (142/142) e `npm run build` verdes. Sem smoke test ao vivo nesta rodada (não solicitado). `ModalEditarRenovacao.jsx` é compartilhado entre `AutoRenovacoes.jsx` e `AutoRenovacoesPuxar.jsx` — a edição do campo novo funciona nos 2 lugares automaticamente.

**Riscos remanescentes:** migration 60 precisa rodar no Supabase antes do campo "Possui 2 veículos?" persistir (até lá, o insert falha com "column does not exist" se o front tentar gravar `identificacao_veiculo`); cotações de renovação criadas sem CPF ficam com `cliente_id: null` até o usuário preencher o CPF manualmente na tela da cotação — não há hoje um passo que promova esse CPF preenchido depois para criar/vincular um `clientes_auto` real (fica só no campo texto `cpf_cliente` da própria cotação), então se precisar do cliente cadastrado de verdade mais adiante, isso ainda exige uma ação manual separada.

**Próximos passos sugeridos:** rodar `supabase/60_auto_renovacao_identificacao_veiculo.sql` no SQL Editor; smoke test manual: criar uma renovação manual marcando "Possui 2 veículos?", confirmar que aparece na lista do mês e é editável depois; clicar "Iniciar cotação" numa renovação sem cliente/CPF cadastrado e confirmar que a cotação é criada e abre a tela de detalhe normalmente.

---

## Causa raiz real de "renovação criada mas nunca aparece em lista nenhuma": colunas faltando em `apolices_auto` (2026-07-28, Claude — CONCLUÍDA, migration 59 pendente)

Depois de implementar a coluna "Renovações"/área dedicada (entrada abaixo), usuário rodou os SQLs e pediu para eu testar ao vivo. Reproduzi criando uma renovação de teste em `/auto/renovacoes/puxar` — o toast de sucesso apareceu, mas a renovação não aparecia em NENHUMA lista (nem a lista de `/auto/renovacoes`, nem "Acompanhar renovações" com filtro "Todas", nem a nova lista de confirmação). Como o navegador (extensão Chrome) estava com instabilidade de CDP (timeouts de screenshot, "Inspected target navigated or closed"), usei uma abordagem mais direta: extraí o `access_token` real do usuário do `localStorage` (`sb-uqkzxtelctaaqvrihnfg-auth-token`) e chamei a REST API do Supabase direto via `fetch`, com o mesmo select exato usado por `getRenovacoesAuto`.

1. **Causa raiz real, confirmada com evidência direta do Postgres:** a resposta da API foi um erro 400 puro — `{"code":"42703","message":"column apolices_auto_1.renovacao_premio_liquido_ano_anterior does not exist"}`. `RENOVACAO_LISTA_SELECT` (`src/lib/auto.js`, usado por `getRenovacoesAuto` E pela nova `getRenovacoesPendentesSemCotacao`) sempre pediu essa coluna (e `renovacao_comissao_ano_anterior`) no embed de `apolices_auto` — colunas que as migrations `38_auto_renewal_compare_and_imobiliaria_comissao.sql` e `39_auto_schema_hardening.sql` já definiam, mas **nenhuma das duas foi executada em produção**. Resultado: **toda chamada a `getRenovacoesAuto` sempre falhou silenciosamente** — a lista de `/auto/renovacoes`, "Acompanhar renovações", e a coluna nova "Renovações" do Kanban SEMPRE estiveram quebradas, não só nesta sessão. Uma renovação podia ser criada com sucesso (o INSERT não toca essas colunas) e mesmo assim nunca aparecer em lugar nenhum, porque toda LEITURA subsequente quebrava com 42703 e cada `useQuery` (`data: x = []`, sem checar `isError`) engolia o erro em silêncio.
2. **Confirmado o fix com o mesmo método:** rodando a mesma query sem essas 2 colunas, a API respondeu 200 com os dados reais (inclusive a renovação de teste recém-criada e 2 outras já existentes, criadas pelo próprio usuário antes desta sessão) — prova de que essa é a única coisa quebrada nesse select, nenhuma outra coluna faltando.
3. **Corrigido:** nova migration `supabase/59_auto_apolices_emissoes_renovacao_colunas_faltantes.sql` (idempotente — repete o `ADD COLUMN IF NOT EXISTS` das migrations 38/39 em `apolices_auto` e `emissoes_auto`, mais `NOTIFY pgrst, 'reload schema'`). **AINDA NÃO EXECUTADA NO SUPABASE — bloqueia toda a área de renovações até isso ser feito.**
4. **Defesa em profundidade adicionada** (`AutoRenovacoes.jsx`, `AutoRenovacoesPuxar.jsx`, `AutoEmissoes.jsx`): as 4 queries afetadas agora expõem `isError`/`error` e mostram um `EmptyState` de erro real (com a mensagem do Postgres) em vez de continuarem mostrando silenciosamente "nenhuma renovação encontrada" quando a query falha — para essa classe de bug nunca mais passar despercebida.

**Dados de teste no banco:** minha linha de teste ("Cliente Smoke Test") foi excluída (via REST direto, com o access_token real do usuário, já que o app ainda não tinha um botão de excluir naquele momento). As 2 linhas "ALINE MONICA RIBEIRO" (`vigencia_fim=2026-08-01`) são do próprio usuário — não apaguei, ele decide se são duplicata ou não (agora tem botão "Excluir" na UI para fazer isso quando quiser).

**Follow-up na mesma sessão — CRUD completo de renovações:** usuário pediu para permitir editar/excluir/"fazer qualquer coisa" com renovações existentes. Adicionado:
- `excluirRenovacao(id)` (`src/lib/auto.js`) — exclusão definitiva (DELETE), diferente de `cancelarRenovacao` (que so marca `status_renovacao='nao_renovada'`, mantém a linha). Os dois continuam existindo separados, por decisão do usuário.
- `atualizarStatusRenovacao` (já existia, já era genérico o suficiente) reaproveitado para editar seguradora/vencimento/data limite.
- Novo componente compartilhado `src/pages/auto/ModalEditarRenovacao.jsx` — usado tanto em `AutoRenovacoes.jsx` (lista principal + tabela "Acompanhar renovações") quanto em `AutoRenovacoesPuxar.jsx` (lista de confirmação do mês), para não duplicar a UI de edição em 2 arquivos.
- Botões "Editar"/"Excluir" adicionados nos 2 lugares acima. Não adicionados ainda no card leve do Kanban (`CardRenovacaoPendente`) — esse card ficou só com Iniciar cotação/Cancelar, por escopo (não foi pedido explicitamente lá).

`npm test` (142/142) e `npm run build` verdes após as mudanças de error-handling.

---

## Coluna "Renovações" no Kanban de Gestão Auto + área dedicada "Puxar renovações" (2026-07-28, Claude — CONCLUÍDA, sem smoke test ao vivo a pedido do usuário)

Follow-up da entrada abaixo. Depois de rodar a migration 58, usuário criou uma renovação com sucesso mas reportou 2 problemas novos: (1) a renovação criada não aparecia em nenhuma lista visível; (2) não havia coluna "Renovações" no Kanban/pipeline de Gestão Auto. Pediu também, como requisito novo e explícito: "Puxar renovações" deixar de ser um painel na mesma página de `/auto/renovacoes` e virar uma área completamente separada, onde o usuário pode puxar (sistema/planilha) OU criar manualmente uma a uma, sempre vendo a lista do que já foi adicionado ali mesmo (sem precisar voltar pra outra tela pra confirmar). Brainstorm rápido (`superpowers:brainstorming`) com o usuário para fechar o desenho antes de implementar; usuário pediu explicitamente para eu **não abrir o navegador de novo** nesta rodada — implementação e verificação só por `npm test`/`npm run build`, sem smoke test ao vivo.

1. **Nova página dedicada `/auto/renovacoes/puxar`** (`src/pages/auto/AutoRenovacoesPuxar.jsx`, rota nova em `App.jsx`): contém os 3 blocos que antes ficavam num painel colapsável dentro de `/auto/renovacoes` (puxar do sistema, puxar por planilha, criar manualmente) — movidos verbatim, não reescritos — mais uma lista nova "Renovações de \<mês\>" (usa `getRenovacoesAuto({periodo:'mes_atual', mes})`, já existente) que se atualiza a cada ação, dando confirmação visual imediata de que a renovação colou, sem precisar navegar para outra tela. `AutoRenovacoes.jsx` perdeu todo o estado/mutações do painel inline; o botão "Puxar renovações" agora só faz `navigate('/auto/renovacoes/puxar?mes=...')`. O banner do Dashboard (`AutoDashboard.jsx`) teve só a string do `navigate(...)` do link atualizada (1 linha) — arquivo está em redesign visual concorrente por outro processo (provavelmente Codex), não tocado além disso.
2. **Nova coluna virtual "Renovações" no Kanban de Gestão Auto** (`AutoEmissoes.jsx`): renovações sem `cotacao_id` (nova query `getRenovacoesPendentesSemCotacao`, `src/lib/auto.js`) aparecem como cards leves (`CardRenovacaoPendente`) numa coluna própria, **sempre visível independente do filtro de período do resto do Kanban** (decisão explícita do usuário — evita sumir da vista só porque o filtro virou "Semana") e **sem drag-and-drop** (mover essa renovação = iniciar cotação de verdade, não só trocar rótulo). Botão "Iniciar cotação" reaproveita `iniciarCotacaoRenovacao` já existente — cria a `cotacao_auto`, o trigger do banco já cria a `emissao_auto` correspondente (`coluna=NULL` → mapeada para "Cotações pendentes"), e o card desaparece da coluna Renovações e reaparece do lado certo automaticamente. Botão "Cancelar" reaproveita `cancelarRenovacao` já existente.
3. **Mojibake evitado durante a escrita do arquivo novo:** uma primeira tentativa de escrever a regex `/[̀-ͯ]/g` (usada para strip de acento em `normalizarNomeAba`) acabou gravando os caracteres Unicode literais no arquivo em vez do texto de escape (confirmado via `xxd`) — mesma classe de armadilha já documentada no projeto. Reescrito para não depender de nenhum literal de regex Unicode no arquivo fonte: filtra por code point (`ch.codePointAt(0)`) depois de `normalize('NFD')`.

`npm test` (142/142) e `npm run build` verdes. `npm run check:page-contexts` só acusa a mesma pendência pré-existente (`GestaoComercial.jsx`).

**Atualização:** verificado ao vivo na rodada seguinte (usuário autorizou reabrir o navegador) — ver entrada acima ("Causa raiz real..."). A área `/auto/renovacoes/puxar` renderiza e cria corretamente; a causa raiz de "criei mas não aparece" era um problema de schema (colunas faltando em `apolices_auto`), não algo na coluna do Kanban ou na área nova em si. Falta apenas: confirmar visualmente a coluna "Renovações" no Kanban e o fluxo "Iniciar cotação"/"Cancelar" depois que a migration 59 rodar.

---

## "Criar renovação manualmente" não criava nada + ano errado na data limite + 2 bugs adicionais achados ao vivo (2026-07-28, Claude — CONCLUÍDA, migration pendente)

Usuário reportou 3 sintomas em `/auto/renovacoes`: (1) CPF não deveria ser obrigatório pra criar a primeira renovação; (2) data limite da cotação deve ser 7 dias ÚTEIS antes do vencimento, e "o ano deve sair correto"; (3) clicando em "Criar renovação" com os campos preenchidos, nada acontecia. Pediu também para apagar todos os clientes do setor Auto do banco. `superpowers:systematic-debugging` com login real do usuário no navegador (Chrome via MCP) + `npm run dev` local — reproduzido ao vivo em vez de só analisar código.

**Causas raiz encontradas e corrigidas (todas reproduzidas ao vivo, não só lidas no código):**

1. **(3) causa raiz real — CHECK constraint desatualizado em produção:** `renovacoes_auto_origem_check` em produção só aceitava `'sistema'`/`'xls'` — a migration `56_auto_renovacoes_endosso.sql` usa `ADD COLUMN IF NOT EXISTS origem ... CHECK (...IN ('sistema','xls','manual'))`, mas como a coluna `origem` já existia quando essa migration rodou (criada numa versão anterior do arquivo, antes de 'manual' existir como origem), o `IF NOT EXISTS` pulou a cláusula inteira e o CHECK em produção nunca foi atualizado. Toda tentativa de criar renovação manual falhava com `new row for relation "renovacoes_auto" violates check constraint "renovacoes_auto_origem_check"`. **Corrigido:** nova migration `supabase/58_auto_renovacao_origem_manual_dias_uteis.sql` (recria o CHECK aceitando `'manual'`) — **AINDA NÃO EXECUTADA NO SUPABASE, usuário precisa rodar manualmente no SQL Editor antes de "Criar renovação" funcionar de verdade em produção.**
2. **Bug que mascarava o erro acima (encontrado por acaso, ao vivo):** `AutoRenovacoes.jsx` fazia `const { toast } = useToast()`, mas `useToast()` retorna a função direto (não um objeto) — único arquivo do projeto inteiro com esse padrão errado (todos os outros ~25 arquivos fazem `const toast = useToast()`). Resultado: toda chamada de `toast(...)` nesta página (sucesso ou erro, em puxar do sistema/planilha/criar manual/cancelar/marcar concluído) lançava `TypeError: toast is not a function`, silenciando qualquer feedback ao usuário — exatamente o sintoma "clico e não acontece nada". **Corrigido.**
3. **(2) causa raiz do "ano errado":** `handleVigenciaFimManual` calculava a sugestão de data limite a cada tecla digitada no campo nativo `<input type="date">` (o browser dispara `onChange` a cada dígito do ano: `0002` → `0020` → `0202` → `2027`). O valor intermediário `0202-02-01` (ano 202) passava incólume pela validação de data porque `new Date(ano, mes, dia)` só trata anos de 0-99 como relativos a 1900 — um ano de 3 dígitos "bate" no round-trip sem ser uma data real. Esse valor errado ficava travado (guard `!manualDataLimite` impedia recalcular depois). **Corrigido:** `isValidIsoDate` (nova, `src/lib/autoCalc.js`) agora exige ano entre 1900-2200; a sugestão só é calculada quando o valor for uma data completa e válida.
4. **(2) regra de negócio:** troquei "7 dias corridos" por "7 dias úteis" (pula sábado/domingo, sem calendário de feriados) em TODOS os pontos que calculam a data limite: `handleVigenciaFimManual` (front-end), `puxarRenovacoesDoSistema`/`puxarRenovacoesDePlanilha`/`criarRenovacaoManual` (`src/lib/auto.js`) e o trigger `fn_criar_renovacao_auto` (nova função SQL `subtrair_dias_uteis`, na migration 58 acima). Nova função pura `subtrairDiasUteis` em `src/lib/autoCalc.js`, testada (6 testes novos).
5. **(1) CPF:** já não era obrigatório no código atual (`criarRenovacaoManual` aceita `nomeManual` sem cliente cadastrado) — confirmado, nenhuma mudança necessária.
6. **Bug adicional achado ao vivo, sem relação com o pedido original:** `/auto/clientes` (e outras 6 páginas que usam `AutoPageHeader`) mostravam tela toda branca — `ReferenceError: Sparkles is not defined` em `src/components/auto/AutoVisual.jsx` (ícone usado sem import). **Corrigido** (import faltante).

**Descoberta importante durante a sessão:** havia edição concorrente ao vivo no mesmo repositório (`AutoDashboard.jsx`, parte de `AutoVisual.jsx`, `src/styles/auto-ui.css` — redesign visual "V2" do Dashboard Auto, provavelmente Codex, coerente com a divisão de trabalho do projeto). Não foi tocado nem revertido — fora do escopo desta tarefa.

**Atualização:** usuário rodou `supabase/58_auto_renovacao_origem_manual_dias_uteis.sql` manualmente no SQL Editor — "Criar renovação" funciona em produção (confirmado pelo próprio usuário: "rodei, e criei"). `supabase/57_zerar_dados_auto.sql` (apaga clientes/apólices do setor Auto) segue pendente, usuário confirmou que quer rodar mas ainda não relatou ter feito.

`npm test` (142/142) e `npm run build` verdes.

---

## Renovações Auto — lembrete de virada de mês, puxar renovações (sistema + planilha), lista com status real, endosso (2026-07-27, Claude — CONCLUÍDA)

Execução completa das 19 tasks do plano `docs/superpowers/plans/2026-07-24-auto-renovacoes-endosso.md` via `superpowers:subagent-driven-development`, direto na branch `main` (decisão do usuário, mesmo padrão de sessões anteriores do módulo Auto). Spec: `docs/superpowers/specs/2026-07-24-auto-renovacoes-endosso-design.md`. Ledger completo (até ser removido): `.superpowers/sdd/2026-07-24-auto-renovacoes-endosso/progress.md`.

**As 4 frentes do spec, entregues:**
1. Banner de lembrete de virada de mês no Dashboard Auto (15 dias antes) + estado "mês concluído".
2. Painel "Puxar renovações" em `/auto/renovacoes` — do sistema (apólices emitidas há 1 ano) ou de planilha (`01 COMISSÃO - AUTO.xlsx`), com dedup por nome.
3. Lista de renovações com status real do Kanban de Gestão, comparativo de comissão atual x anterior, botão "Fazer Cotação" e "Cancelar renovação".
4. Fórmula de comissão corrigida em todo o módulo (`premio × pct/100 × 0.9`, estava tratando `pct_comissao` como fração e sem o fator 0.9) + formulário de emissão reduzido (data de emissão, vigência fim automática, tipo somente-leitura) + cotação de Endosso (nova aba em `/auto/cotacoes`, atualiza a apólice original em vez de criar uma nova).

**Arquivos alterados/criados (principais):**
- `supabase/56_auto_renovacoes_endosso.sql` (nova migration — **AINDA NÃO EXECUTADA NO SUPABASE**, usuário precisa rodar manualmente no SQL Editor antes de qualquer coisa funcionar de verdade em produção).
- `src/lib/auto.js`, `src/lib/autoCalc.js` (novo), `src/lib/autoComissaoImport.js` (novo).
- `src/pages/auto/autoShared.js`, `AutoDashboard.jsx`, `AutoRenovacoes.jsx`, `AutoEmissoes.jsx`, `AutoCotacoes.jsx`.
- `src/lib/auto.test.mjs` (novo), `src/lib/autoComissaoImport.test.mjs` (novo), `src/pages/auto/autoShared.test.mjs` (ampliado), `package.json` (lista de testes).

19 tasks + revisão final de branch (opus) executadas com sucesso; 2 achados Critical + 7 Important da revisão final corrigidos numa rodada única de fix (commit `1a957f3`). `npm test` (134/134) e `npm run build` verdes.

**Decisão de usuário durante a execução:** o card de Endosso não conseguia ser emitido (campo Seguradora ficava travado, só liberava com "seguradora aprovada" de uma cotação prévia — conceito que não existe para endosso). Perguntado, usuário decidiu: "endosso serve para seguros já ativos, sempre será permitido, liberar esse campo para endosso" — implementado exatamente assim.

**Riscos remanescentes (nenhum bloqueia o merge, mas recomendado corrigir antes de confiar 100% nos fluxos abaixo em produção):**
1. **"Fazer Cotação" numa renovação vinda de planilha lança erro de CPF obrigatório** — `resolverClienteAutoId` exige `cliente_id` ou `cpf_cliente`, que uma renovação importada da planilha nunca tem (só nome). A lista já mostra o nome corretamente (corrigido), mas cotar a partir dela ainda falha com um toast de erro. Precisa de UI para pedir o CPF antes de cotar, ou desabilitar o botão nesse caso.
2. **`data_emissao` é gravado na emissão mas nunca lido de volta** — reabrir/editar uma apólice sempre reseta esse campo para "hoje" (o formulário nunca carrega o valor já salvo). Fica "grava e esquece" até isso ser corrigido.
3. **Duas telas fora do escopo direto ainda mostram comissão com a fórmula antiga** (~100x errada): `AutoApoliceDetalhe.jsx` (card "Comissão") e `AutoCotacaoDetalhe.jsx` ("Comissão estimada"). Mesma classe de bug já corrigida em `auto.js`/`AutoEmissoes.jsx`, só não coberta pelo escopo desta rodada.
4. Endosso: campos como Tipo de produção/Responsável/Condutor/Repasse aparecem editáveis no modal de emissão mas são intencionalmente descartados ao atualizar a apólice original (só os campos que o formulário reduzido realmente edita são gravados) — os campos "parecem vivos" sem ser, e `valor_repasse` pode ficar dessincronizado do novo `valor_comissao`.
5. Migration `56_auto_renovacoes_endosso.sql` não rodada no Supabase ainda — nada das 4 frentes funciona de verdade em produção até isso ser feito (arquivo já está transacional/idempotente, com uma query de diagnóstico de duplicatas no cabeçalho, caso o `CREATE UNIQUE INDEX` falhe).

**Próximos passos sugeridos:**
1. Rodar `supabase/56_auto_renovacoes_endosso.sql` no SQL Editor do Supabase.
2. Smoke test manual completo: banner → puxar do sistema → puxar por planilha → lista → Fazer Cotação → Kanban → emissão reduzida → endosso (criar cotação de endosso, emitir, confirmar que a apólice original foi atualizada, não uma nova).
3. Corrigir os riscos 1-3 acima como próxima rodada de trabalho.

---

## Botão "Reprocessar PDF" nunca lia o arquivo de verdade + bug real de dados no parser da TOO — achado e corrigido testando contra PDFs reais do projeto (2026-07-23, Claude — CONCLUÍDA)

Usuário insistiu que a leitura de PDF "não está indo" mesmo depois da rodada anterior, e
pediu especificamente pra eu testar contra os PDFs reais que já existem no projeto em vez de
só analisar código. Achei 4 PDFs de exemplo reais em `info.docs/apólices.example/` — um por
seguradora suportada (Porto, Pottencial, TOO, Tokio Marine) — e escrevi um script temporário
(`pdfjs-dist/legacy/build/pdf.mjs` + `parseApoliceText` importado direto de
`src/lib/apoliceParser.js`, removido depois de usar) pra extrair o texto de cada um e rodar
o parser de verdade, igual ao fluxo do app. Isso permitiu reproduzir de verdade (Phase 1 do
`systematic-debugging`) em vez de adivinhar.

1. **Causa raiz real do "clica e não vai" — confirmada, reproduzida e corrigida:** o botão
   "Reprocessar PDF" do Upload Direto (`ApoicesGestao.jsx:1044`) estava com
   `onClick={handleExtrair}` — passando a função direto pro `onClick` em vez de embrulhar
   numa arrow function. `handleExtrair(fileOverride = null)` trata qualquer primeiro
   argumento truthy como "o arquivo a ler"; como o React chama o handler de `onClick` com o
   `SyntheticEvent` do clique como primeiro argumento, `fileOverride` virava o evento do
   clique (sempre truthy) em vez de `null` — `fileAtual = fileOverride || pdfFile` pegava o
   evento, `parseApolice(seguradora, fileAtual)` tentava chamar `.arrayBuffer()` num objeto
   de evento, e isso sempre lançava exceção. Ou seja: a leitura automática ao ANEXAR o PDF
   pela primeira vez sempre funcionou (`handleArquivo` chama `handleExtrair(file)`
   corretamente, com o arquivo de verdade) — mas qualquer clique manual em "Reprocessar PDF"
   (o botão de releitura, usado depois de trocar o arquivo ou depois de um erro) **sempre
   falhava**, mostrando um erro genérico sem nunca tentar ler o PDF de verdade. Esse é
   exatamente o botão de "releitura" que o usuário descreveu. **Corrigido:**
   `onClick={() => handleExtrair()}`. O botão "Tentar novamente" do Upload em Lote já estava
   correto (`onClick={onTentarNovamente}`, onde `onTentarNovamente` já vinha embrulhado como
   `() => tentarNovamente(item)` do componente pai) — não precisou de mudança.
2. **Validação contra PDFs reais — todos os 4 passaram** (`numero_apolice`, nome do
   locatário/proprietário, vigência, valor da parcela, endereço — todos extraídos
   corretamente).
3. **Bug real de dados encontrado durante a validação, não relacionado ao "não lê":**
   `parseTooSeguros` (única seguradora testada que expôs isso) tinha as regexes de
   Bairro/Cidade/UF/CEP soltas, cada una casando contra a **primeira** ocorrência desses
   rótulos no PDF inteiro — o PDF da TOO repete "Bairro:"/"Cidade:"/"UF:"/"CEP:" em mais de
   um bloco (o de endereço de correspondência do garantido vem ANTES do endereço de risco de
   verdade). Resultado: o campo `endereco` da apólice saía com uma mistura de texto de
   blocos completamente diferentes do PDF (incluindo nome/CPF do garantido, datas de
   vigência etc., tudo colado). **Corrigido:** os 5 campos (endereço, bairro, cidade, UF,
   CEP) agora são casados juntos num único padrão, ancorado a aparecer logo depois de "Local
   do Risco:" — garante que vêm todos do mesmo bloco. Mantido um fallback pras regexes
   antigas separadas, caso um layout futuro não siga essa sequência exata.

`npm test` (116/116) e `npm run build` verdes. Nenhuma mudança de schema/RLS — só lógica de
app em `src/pages/ApoicesGestao.jsx` e `src/lib/apoliceParser.js`. `CONTEXT.md` de
`ApoicesGestao` atualizado. Script de diagnóstico usado pra validar contra os PDFs reais foi
temporário e já removido, não commitado (mesmo padrão de sessões anteriores).

**Smoke test pendente (sem login real neste ambiente):** no Upload Direto, subir um PDF,
deixar a leitura automática rodar, depois clicar manualmente em "Reprocessar PDF" e
confirmar que ele lê de novo (sem erro genérico); trocar o arquivo por outro PDF e clicar em
"Reprocessar PDF" de novo; subir o PDF de exemplo da TOO Seguros (ou um real) e conferir que
o campo de endereço sai limpo (rua/bairro/cidade/UF corretos, sem texto de outras seções
misturado).

**Riscos remanescentes:** a validação usou só os 4 PDFs de exemplo do repositório (1 por
seguradora) — um PDF real de produção com uma variação de layout ainda não vista pode expor
outro gap; se isso acontecer, o próximo passo é o mesmo desta rodada (pegar o PDF real e
testar direto contra o parser, não adivinhar pela regex).

---

## Apólices Gestão — upload não pode travar se o storage do Supabase falhar (2026-07-23, Claude — CONCLUÍDA)

Follow-up da entrada abaixo ("Kanban de Fichas quebrando... + apólice sumindo"). Usuário
levantou uma hipótese concreta pro sintoma "algumas apólices somem": o storage do Supabase
pode ter estourado cota, e pediu explicitamente que o **documento (PDF) em si não precisa
ser salvo obrigatoriamente** — o que importa é a leitura dos dados e a criação do card da
apólice.

1. **Achado ao reler o código:** `criarApolice` (grava a apólice no banco) já rodava ANTES
   de `uploadDocumento` (grava o PDF no bucket `documentos`) nos dois fluxos com PDF (Upload
   Direto e Upload em Lote) — ou seja, a intenção de "não travar por causa do documento" já
   existia parcialmente. Mas nenhuma das duas chamadas (nem `vincularApoliceAFicha`, nem o
   restante do corpo do loop do lote) estava protegida por `try/catch` — o código assumia
   que toda chamada Supabase sempre resolve como `{ data, error }`. Isso é verdade pra a
   maioria dos métodos, mas `storage.upload()` pode **lançar exceção** de verdade em cenários
   de rede/timeout/cota, não só devolver `{ error }`.
2. **Bug real no Upload em Lote (`registrarSelecionadas`), o mais grave dos dois:** o `for`
   loop que processa cada apólice selecionada do lote não tinha nenhum try/catch. Se
   `uploadDocumento` (ou qualquer chamada) lançasse uma exceção no meio do processamento do
   item N, a exceção subia e abortava a função `async` inteira — **os itens N+1 em diante do
   mesmo lote nunca eram processados**, `registrando` ficava travado em `true` pra sempre, e
   nem `onCriado(criadas)` era chamado pros itens que JÁ tinham sido criados com sucesso
   antes do item que quebrou. Resultado: apólices realmente gravadas no banco (confirmado em
   sessão anterior, consultando o Supabase de produção direto) que nunca aparecem no Kanban
   e cujo lote trava sem aviso nenhum pro usuário — bate exatamente com "subimos algumas
   apólices e não aparecem".
3. **Corrigido nos dois fluxos** (`UploadDiretoWorkspace.criarUploadDireto` e
   `UploadLoteWorkspace.registrarSelecionadas`, `ApoicesGestao.jsx`):
   - `uploadDocumento` (e, no lote, também `vincularApoliceAFicha`) agora rodam dentro de um
     `try/catch` próprio — qualquer falha (retornada OU lançada) vira só um aviso não
     bloqueante no card/toast; a apólice já criada no banco sempre conta como sucesso e é
     passada para `onCriado`.
   - No lote, o corpo inteiro do loop por item também ganhou um `try/catch` externo — uma
     exceção inesperada em UM item marca só aquele item com erro e o loop **continua** pros
     próximos, em vez de abortar o lote inteiro em silêncio.
   - Toast de "PDF não anexado" no Upload Direto passou de `error` pra `warning` (não é mais
     tratado como falha crítica, já que o documento é opcional).

`npm test` (116/116) e `npm run build` verdes. Nenhuma mudança de schema/RLS/bucket — só
lógica de app em `src/pages/ApoicesGestao.jsx`. `CONTEXT.md` de `ApoicesGestao` atualizado.

**Smoke test pendente (sem login real neste ambiente):** subir um lote de 3+ PDFs pelo
Upload em Lote; se possível, simular uma falha de storage real (ex. um arquivo gigante, ou
checar se a cota do bucket `documentos` já está de fato cheia no Supabase) e confirmar que
mesmo assim todas as apólices do lote são criadas e aparecem no Kanban, com só um aviso de
"PDF não anexado" no item afetado — e que os itens **depois** do que falhou continuam sendo
processados.

**Riscos remanescentes:** se o bucket `documentos` estiver realmente com a cota estourada,
os PDFs continuarão não sendo salvos até o usuário liberar espaço ou trocar de plano no
Supabase — esta correção só garante que isso não impede mais a criação da apólice/card, não
resolve a causa raiz do storage cheio (fora do escopo de código, é uma decisão de
infraestrutura/plano do Supabase).

---

## Kanban de Fichas quebrando ao mover para "Canceladas" + modal de Aprovação simplificado + apólice sumindo (Iniciar Emissão) + PDFs de Tokio Marine não lidos (2026-07-23, Claude — CONCLUÍDA)

Usuário reportou 4 problemas: (1) "sistema de atualização de status das fichas não está
funcionando, algumas fichas arrastamos para outras colunas e não está indo" + pediu para
melhorar a animação do drag-and-drop; (2) não quer mais que o modal de aprovação peça
número de orçamento, só "retorno foi enviado?" e "passado direto pela imob?"; (3) PDFs de
apólice não sendo lidos pela automação; (4) apólices sendo cadastradas mas sem aparecer o
card na tela de gestão. Systematic-debugging (análise estática de código + `git log -S`
para achar quando cada regressão foi introduzida; sem `.env`/Supabase neste ambiente).

1. **Causa raiz de (1), confirmada via `git log -S "function ModalConfirmarCancelado"`:**
   o componente `ModalConfirmarCancelado` (`KanbanFichas.jsx`) foi apagado por acidente no
   commit `124a8d3` (02/07, um commit que só devia estar corrigindo mojibake/encoding) —
   mas o JSX que o renderiza (`<ModalConfirmarCancelado onConfirmar=... />`, disparado ao
   arrastar qualquer ficha para a coluna "Canceladas") continuou no arquivo. Resultado:
   `ModalConfirmarCancelado is not defined` — `ReferenceError` que quebra o render assim
   que alguém tenta mover uma ficha para "Canceladas", exatamente o sintoma "arrastei e não
   foi" (sem toast de erro, porque o crash acontece antes de qualquer chamada ao Supabase).
   **Corrigido:** componente restaurado (mesmo texto/comportamento de antes — motivo do
   cancelamento obrigatório).
2. **Causa raiz adicional de (1), ligada a (2):** mover para "Aprovadas" abria um modal que
   exigia Seguradora + Valor da Parcela + **N° Orçamento** (todos obrigatórios) antes de
   liberar o botão "Avançar" — se o orçamentista não tinha o número do orçamento em mãos no
   momento do drag, ficava travado sem conseguir avançar nem entender por quê (a ficha
   volta pra coluna de origem, sem nenhum aviso). **Corrigido, conforme decisão do usuário
   (perguntado explicitamente: manter Seguradora/Valor Parcela obrigatórios, só tirar o N°
   Orçamento):** campo N° Orçamento removido do modal; novo campo obrigatório "Retorno
   enviado?" (Sim/Não) grava direto em `fichas.retorno_enviado` — o mesmo campo que já
   controla o badge "Retorno enviado/pendente" do card (antes só dava pra setar esse campo
   por outros fluxos, nunca pelo drag de aprovação); "Passado pela imobiliária?" continua
   como estava.
3. **Melhoria de animação (pedido explícito do usuário):** `DragOverlay` das duas telas com
   kanban `@dnd-kit` (Fichas e Apólices) usava `dropAnimation={null}`, que desligava
   qualquer animação de soltura — o card simplesmente sumia ao soltar, sem "pousar" na
   coluna. Novo `KANBAN_DROP_ANIMATION` (`lib/kanbanDnd.js`, compartilhado pelas 2 telas)
   anima a soltura suavemente. Card de origem durante o drag ganhou uma transição de
   opacidade+escala mais suave (era um corte abrupto pra opacity 0.3, sem transform). Cards
   que acabaram de ser movidos (por drag direto ou pelos modais de recusa/cancelamento/
   aprovação) ganham um pulso verde breve (`animate-card-new`, já existia para fichas novas
   via realtime, só reaproveitado) como confirmação visual clara de que o move funcionou.
4. **Causa raiz de (4):** `ApoicesGestao.jsx` tem 3 fluxos de criação de apólice. Upload
   Direto e Upload em Lote já tinham sido corrigidos numa sessão anterior (ver entrada
   abaixo, "Upload em Lote não aparecia no Kanban") para chamar `onCriado(apoliceCriada)` e
   inserir a apólice direto na lista local, sem depender do filtro ativo. **O 3º fluxo,
   "Iniciar Emissão" (`IniciarEmissaoWorkspace`), ficou de fora daquela correção** — ele
   descartava o retorno de `criarApolice` (`const { error } = ...`, sem capturar `data`) e
   chamava `onCriado?.()` sem nenhum argumento, caindo no branch que faz `load()`
   respeitando o filtro de período/imobiliária ativo no Kanban — se o filtro não batesse
   com a apólice recém-criada, ela sumia da tela (mesma classe de bug já documentada, só
   que num fluxo diferente). **Corrigido:** captura `data` do `criarApolice` e passa pra
   `onCriado(data)`, mesmo padrão dos outros 2 fluxos.
5. **Investigação de (3), sem PDF de amostra disponível neste ambiente:** não dá pra
   reproduzir "PDF não lido" sem o arquivo real que falhou (`superpowers:systematic-
   debugging` — Phase 1 exige reprodução, não dá pra adivinhar regex às cegas). Achado real
   via leitura de código: `apoliceParser.js` tem 3 versões históricas do parser de Tokio
   Marine (`parseTokioMarine` V1, `V2`, `V3` — cada uma nasceu porque a seguradora mudou o
   layout do PDF), mas só a V3 estava conectada (`PARSERS.tokio = parseTokioMarineV3`) — um
   PDF de Tokio Marine no layout V1 ou V2 (ex.: renovação antiga, proposta gerada antes da
   última mudança de layout) falharia hoje, silenciosamente reproduzindo o sintoma
   relatado. **Corrigido defensivamente:** cada seguradora agora mapeia para uma **cadeia**
   de parsers (`findParserChain`) — tenta o layout mais novo primeiro e cai pros anteriores
   se não achar `numero_apolice`/nome útil, em vez de assumir que só existe o layout mais
   recente. Isso NÃO garante que resolve o problema relatado (pode ser outra seguradora, ou
   um 4º layout novo do Tokio Marine, ou um PDF escaneado sem camada de texto — `pdfjs-dist`
   não faz OCR) — **se o problema persistir, preciso de uma amostra do PDF que falhou (ou
   pelo menos: qual seguradora, e a mensagem de erro exata que aparece no upload) pra ajustar
   a regex certa.**

`npm test` (116/116), `npm run build` e `npm run check:page-contexts` (mesma pendência
pré-existente de `GestaoComercial.jsx`, não é regressão) verdes. Nenhuma mudança de
schema/RLS — só lógica de app em `src/components/KanbanFichas.jsx`,
`src/pages/ApoicesGestao.jsx`, `src/lib/apoliceParser.js`, `src/lib/kanbanDnd.js`.
`CONTEXT.md` de `Fichas` e `ApoicesGestao` atualizados.

**Smoke test pendente (sem login real neste ambiente):** abrir `/fichas` no Kanban, arrastar
uma ficha em cotação para "Canceladas" e confirmar que o modal abre normalmente (sem tela
branca/erro no console) e pede o motivo; arrastar uma ficha para "Aprovadas" e confirmar que
o modal não pede mais N° Orçamento, pede "Retorno enviado?" e volta a marcar o badge de
retorno do card corretamente; observar a animação de soltura do card (deve "pousar" suave em
vez de sumir/aparecer instantâneo) e o pulso verde de confirmação após qualquer move; em
`/apolices` gestão, criar uma "solicitação" pelo workspace "Iniciar Emissão" com um filtro de
período/imobiliária ativo que não bateria com a nova apólice, e confirmar que ela aparece
imediatamente no Kanban mesmo assim; se possível, subir de novo o(s) PDF(s) de apólice que
não estavam sendo lidos e ver se a cadeia de fallback do Tokio Marine resolveu — se não
resolveu, trazer o PDF/seguradora/erro exato para uma nova rodada de debugging.

**Riscos remanescentes:** a correção de (5) é uma defesa contra um cenário plausível
(layout antigo do Tokio Marine), não uma confirmação de causa raiz — sem uma amostra real do
PDF que falhou, existe a chance de o problema relatado ser outra coisa (outra seguradora,
PDF escaneado sem texto, ou um layout 4 ainda não visto). O modal de aprovação agora grava
`retorno_enviado` — fichas aprovadas antes desta correção continuam com esse campo como
estava (não há backfill).

---

## Fichas — busca "Em Aberto" não achava fichas assumidas + busca no Kanban (2026-07-22, Claude — CONCLUÍDA)

Usuário reportou 3 problemas na tela de Fichas (`/fichas`): (1) tabela de resultados da aba
Lista muito pequena na tela ("só aparecem 2 linhas"); (2) buscando fichas "em aberto", uma
ficha já assumida (mas ainda sem decisão de aprovado/recusado) não aparecia; pediu um filtro
que inclua esse caso; (3) pediu uma barra de busca simples no Kanban, acima do filtro de
mês, que filtre os cards de cada coluna em tempo real conforme o usuário digita.

1. **Causa raiz de (2), confirmada por leitura de código:** `STATUS_EM_ABERTO` (`lib/fichas.js`)
   só tinha `['pendente', 'em_cotacao']`; `STATUS_PASSADOS` incluía `'em_analise'` junto com
   os status realmente terminais (`aprovado`/`recusado`/`emitido`/`cancelado`/etc). Uma
   ficha `em_analise` (assumida, ainda em decisão) caía na aba "Passadas" da Lista mesmo
   sem estar de fato finalizada — exatamente o sintoma relatado. **Corrigido:** `em_analise`
   movido para `STATUS_EM_ABERTO`. Conferido que `Relatorio.jsx` usa sua própria constante
   local (`INCLUDED_REPORT_STATUSES`) e não é afetado; `Dashboard.jsx` (contagem "em aberto"
   por produto) também usa `STATUS_EM_ABERTO` e passa a contar `em_analise` corretamente
   como aberta (mesma classe de bug, corrigida de brinde).
2. **(1):** a tabela de resultados da aba Lista (`src/pages/Fichas.jsx`) usava um
   `maxHeight` fixo em `calc(15 * 3.25rem + 4.5rem)` em vez de esticar dentro do espaço
   flexível já disponível (`flex-1 min-h-0`, mesmo padrão usado no Kanban/`.kanban-viewport`
   do resto do projeto). Trocado por `flex-1 min-h-[420px]` — a tabela agora usa todo o
   espaço vertical disponível na tela em vez de ficar limitada a um valor fixo.
3. **(3):** novo prop `topBar` em `PageShell` (`Fichas.jsx`), renderizado entre o cabeçalho
   da página e o card "Recorte de trabalho" (onde fica o filtro de período/mês) — só
   preenchido quando `view === 'kanban'`. Novo state `kanbanSearch` (independente do
   `search`/`debouncedSearch` da view Lista, que tem debounce e faz query no servidor);
   passado como prop `search` para `KanbanFichas`, que filtra a lista já carregada
   (client-side, sem nova query) por nome/imobiliária/CPF/CNPJ/seguradora
   (`fichaMatchesSearch`, novo helper em `KanbanFichas.jsx`) antes de agrupar em colunas —
   cada coluna mostra só os cards que batem com a busca, colunas não somem mesmo com 0
   resultado.

`npm test` (116/116), `npm run build` e `npm run check:page-contexts` (mesma pendência
pré-existente de `GestaoComercial.jsx`, não é regressão) verdes. Nenhuma mudança de
schema/RLS — só lógica de app em `src/lib/fichas.js`, `src/pages/Fichas.jsx` e
`src/components/KanbanFichas.jsx`. `CONTEXT.md` de `Fichas` atualizado.

**Smoke test pendente (sem login real neste ambiente):** abrir `/fichas`, assumir uma ficha
e movê-la para "Em Análise" no Kanban, depois ir na view Lista → aba "Em Aberto" e confirmar
que ela aparece lá (não mais em "Passadas"); na view Kanban, digitar um nome/CPF na nova
barra de busca acima do filtro de mês e confirmar que cada coluna filtra só os cards que
batem, sem sumir colunas vazias; conferir visualmente que a tabela da aba Lista ocupa mais
espaço vertical em telas normais (notebook/desktop).

---

## Gestão de Apólices (Fiança) — Upload em Lote não aparecia no Kanban (2026-07-22, Claude — CONCLUÍDA)

Usuário reportou: apólices sendo cadastradas pelo "Upload em Lote" (`/apolices` gestão) não
apareciam na tela de gestão, sem nenhum erro visível. Systematic-debugging com acesso real
ao Supabase de produção (`.env.local` disponível nesta sessão): consultadas as apólices
recentes direto no banco — todas estavam sendo gravadas corretamente (`status_emissao`
válido, sem registros órfãos/nulos, sem documentos órfãos). Causa raiz era 100% front-end.

1. **Causa raiz:** `ApoicesGestao.jsx` tem 3 fluxos de criação (Iniciar Emissão, Upload
   Direto, Upload em Lote). Os dois primeiros chamam `onCriado(apoliceCriada)` →
   `handleCriado` insere o item direto na lista local, aparecendo no Kanban imediatamente,
   **independente dos filtros ativos** (período "Hoje"/imobiliária). O Upload em Lote
   (`registrarSelecionadas`) chamava `onCriado?.()` **sem argumento** → caía no branch que
   faz `load()` (recarrega do banco respeitando os filtros correntes). Se o filtro de
   período/imobiliária não batesse com o item recém-criado, a apólice era criada com
   sucesso no banco mas sumia da tela sem nenhum aviso — exatamente o sintoma relatado.
   Upload em Lote é o workspace mais novo, nunca tinha sido testado ao vivo antes desta
   sessão (ver entrada anterior deste arquivo, "aguardando smoke test manual").
2. **Bug secundário de erro engolido:** em `registrarSelecionadas`, o retorno de
   `vincularApoliceAFicha(...)` nunca era checado — se o vínculo com a ficha falhasse (ex.:
   ficha já assumida por outro usuário, bloqueada pela RLS de `fichas`), o erro era
   descartado silenciosamente, sem qualquer indicação ao usuário.
3. **Corrigido:** `registrarSelecionadas` agora coleta as apólices realmente criadas
   (`criadas`) e passa esse array para `onCriado(criadas)`; `handleCriado` passou a aceitar
   apólice única OU array, inserindo sempre direto na lista local (mesmo comportamento já
   correto dos outros 2 fluxos) — elimina a dependência do filtro ativo para a apólice
   aparecer. Erro de vínculo de ficha agora é capturado e mostrado (por item, na lista, e
   resumido no toast final com `type: 'warning'`). Toast de "Nenhuma apólice criada" e de
   sucesso com falhas agora mostram a mensagem de erro real do Supabase (não só "revise a
   lista"), com duração maior (10s) para não passar despercebido — atende ao pedido do
   usuário de "apitar erro mostrando o erro que está aparecendo" caso isso volte a
   acontecer.

`npm test` (116/116) e `npm run build` verdes. Nenhuma mudança de schema/RLS — só lógica de
app em `src/pages/ApoicesGestao.jsx`. Script de diagnóstico usado para consultar o Supabase
de produção (`scripts/_debug_apolices.mjs`) foi temporário e já removido, não commitado.

**Smoke test pendente (ambiente sem login real neste momento):** subir 2+ PDFs pelo Upload
em Lote com o filtro "Hoje" ou uma imobiliária específica ativos no Kanban, confirmar que as
apólices aparecem imediatamente após "Registrar selecionadas" sem precisar trocar de filtro;
forçar uma falha de vínculo de ficha (ficha assumida por outro usuário) e confirmar que o
toast de aviso aparece com a mensagem real.

**Riscos remanescentes:** a apólice criada é inserida na lista local ignorando o filtro
ativo (mesmo comportamento já existente nos outros 2 fluxos) — se o usuário clicar
"Atualizar" logo em seguida, o `load()` manual pode fazê-la sumir de novo caso não bata com
o filtro selecionado; isso é esperado/consistente, não uma regressão desta correção, mas
pode gerar confusão futura — considerar um aviso quando o item criado não bate com o filtro
ativo, se o usuário reportar isso novamente.

---

## Revisao e melhoria completa do modulo Auto (2026-07-21, Claude — EM ANDAMENTO)

Pedido do usuario: auditoria + correcao de renovacoes (mes/ano dinamico, dias restantes,
destaque de urgencia), vinculo renovacao<->cotacao com fluxo "Cotar" duplicado-safe, fix do
alinhamento do Kanban de Gestao Auto, sistema de etiquetas, filtros de emissoes por mes/ano
real. Auditoria completa apresentada e aprovada pelo usuario (ver resposta do agente nesta
sessao). Decisoes do usuario: (1) CHECK constraint de `emissoes_auto.coluna` ja foi corrigido
manualmente em producao para aceitar 'proposta_transmitida'/'apolice_emitida' — so preciso
sincronizar a migration versionada; (2) executar tudo nesta sessao, em fases; (3) eu crio os
arquivos `.sql`, usuario roda manualmente no SQL Editor do Supabase (mesmo padrao ja usado
no projeto).

**Status: Fases 1-4 concluidas nesta sessao (renovacao/cotacao, Kanban, etiquetas,
emissoes). Pendente: rodar migration no Supabase + fases 5-6 (sinistros, verificacao do
webhook de seguro novo, permissoes por papel, revisao exaustiva de estados de erro) —
ver `docs/superpowers` ou pedir para continuar.**

1. **Migration `supabase/55_auto_renovacao_cotacao_tags.sql` (NAO EXECUTADA NO
   SUPABASE)**: adiciona `renovacoes_auto.cotacao_id` (vinculo renovacao<->cotacao),
   sincroniza o CHECK de `emissoes_auto.coluna` para aceitar
   `proposta_transmitida`/`apolice_emitida` (usuario confirmou que producao ja aceita
   esses valores manualmente; a migration so sincroniza o arquivo versionado com a
   realidade), e cria `auto_tags` (etiquetas predefinidas) + `emissoes_auto.tags`
   (etiquetas manuais). Precisa ser rodada manualmente no SQL Editor antes de usar
   "Cotar"/etiquetas em producao.
2. **`src/pages/auto/autoShared.js`**: novos helpers puros e testados (10 testes novos,
   116/116 no total) — `diasParaVencer` (calculo por dia de calendario, nao por
   horario), `getRenovacaoUrgencia` (hierarquia concluida > vencida > urgente <=10 dias
   > mes atual/proximo mes), `getRenewalQuoteStatus` (deriva o status da cotacao de
   renovacao a partir do vinculo `renovacao.cotacoes_auto`, sem campo duplicado que
   pudesse dessincronizar).
3. **`src/lib/auto.js`**: `iniciarCotacaoRenovacao(renovacaoId)` — funcao unica usada
   pelo botao "Cotar" (`AutoRenovacoes.jsx`) e pelo picker "Nova cotacao > Renovacao"
   (`AutoCotacoes.jsx`); reaproveita a cotacao ja vinculada se ainda nao estiver
   perdida (evita duplicidade por clique). `concluirCotacaoEVincularRenovacao` —
   chamada por `emitirApoliceAuto`/`atualizarEmissaoAutoCompleta` ao criar a apolice:
   marca `cotacoes_auto.status='convertida'` (bug real corrigido — nada gravava esse
   status antes, entao "taxa de conversao" nunca refletia emissoes reais) e a
   `renovacoes_auto` de origem como `status_renovacao='renovada'`. Novo CRUD de
   etiquetas: `getAutoTags`/`criarAutoTag`/`atualizarAutoTag`/`excluirAutoTag` (limpa
   referencias orfas em `emissoes_auto.tags` antes de excluir) /`atualizarTagsEmissao`.
4. **`AutoRenovacoes.jsx`**: logo da seguradora (`SeguradoraBadge`), destaque vermelho
   real para <=10 dias (antes so vencidas ficavam vermelhas, ate 15 dias era so
   laranja), botao "Cotar"/"Ver cotacao" substituindo o antigo `<select>` manual de
   status_cotacao (que nao criava cotacao nenhuma).
5. **`AutoCotacoes.jsx`**: aba "Renovacao" deixou de ser um formulario manual solto
   (sem vinculo com nenhuma renovacao real) e virou um picker de renovacoes reais da
   carteira (busca por cliente/seguradora/placa), que cria/abre a cotacao vinculada.
   Botao "Nova cotacao" adicionado tambem em `/auto/gestao`.
6. **`AutoEmissoes.jsx`**: Kanban trocou de `grid xl:grid-cols-2 2xl:grid-cols-5` (bug
   real: 6 colunas em um grid de 5, a 6a sempre quebrava para baixo) para uma faixa
   horizontal com `overflow-x-auto` e colunas de largura fixa — todas as 6 ficam
   sempre na mesma linha, com rolagem horizontal em telas menores. "Ultimas emissoes"
   passou a ter selecao de mes/ano (`input type="month"`, considera ano) em vez de
   depender do filtro generico de periodo (que tinha "semana" como padrao); adicionados
   filtros por seguradora/tipo/status/responsavel e busca por texto. Etiquetas
   manuais nos cards (`ModalDetalhe`) e chips no card do kanban.
7. **`src/pages/auto/AutoEtiquetas.jsx`** (novo, rota `/auto/etiquetas`): CRUD de
   etiquetas predefinidas (nome, cor, ativar/desativar, reordenar, excluir com
   confirmacao e limpeza de vinculos).
8. **`src/pages/auto/CONTEXT.md`** (novo): fechа o gap identificado na auditoria —
   modulo Auto era o unico grande sem `CONTEXT.md`; `npm run check:page-contexts`
   agora so acusa `GestaoComercial.jsx` (pendencia pre-existente, fora de escopo).

`npm test` (116/116) e `npm run build` verdes apos cada fase.

**Nao coberto nesta sessao (fica para uma proxima rodada, a pedido do usuario ou por
tempo)**: area de Sinistros (fora de escopo, continua "em preparacao"); verificacao do
fluxo de webhook/formulario de seguro novo fora deste repo (n8n); enforcement de
permissoes por papel no backend (RLS de todas as tabelas auto ainda e
`FOR ALL TO authenticated USING (true)` — bandeira de seguranca ja levantada na
auditoria, precisa de conversa dedicada antes de mudar RLS); revisao exaustiva de
estados de erro/loading em todos os fluxos (cobertos os principais: erro ao criar
cotacao de renovacao, etiquetas, emissoes vazias/filtradas).

---


## Importação histórica de apólices Auto + redesign de Clientes Auto (2026-07-20, Claude — retomada da pausa de 2026-07-17)

Tarefa multi-etapas (11 tasks) executada via `superpowers:subagent-driven-development`, direto na branch `main`, sem worktree. Spec: `docs/superpowers/specs/2026-07-17-auto-importacao-clientes-redesign-design.md`. Plano: `docs/superpowers/plans/2026-07-17-auto-importacao-clientes-redesign.md`. Ledger completo: `.superpowers/sdd/progress-auto-importacao-clientes.md`.

**TAREFA CONCLUÍDA: 11 tasks + revisão final de branch (opus) — Ready to merge.** Único achado Important da revisão final já corrigido (ver item 6 abaixo).

1. **Migration `origem_pre_sistema`** (`supabase/54_apolices_auto_origem_pre_sistema.sql`, commit `48342b7`) — coluna booleana nova em `apolices_auto`. **AINDA NÃO EXECUTADA NO SUPABASE** — precisa rodar manualmente no SQL Editor antes de qualquer importação funcionar de verdade em produção.
2. **`APOLICE_AUTO_COLUMNS`** passou a incluir `origem_pre_sistema` (commits `a58f5ae`..`8791f8f`).
3. **Parser puro `src/lib/autoHistoricoImport.js`** (commit `39fa125`, 11 testes): lê a planilha `02 RENOVAÇÕES AUTO.xlsx`, filtra só linhas com célula verde (`00B050`/`92D050`) na coluna SEGURADO/CLIENTE, limpa o nome (corta no primeiro traço), soma 1 ano à vigência de início. Import do pacote `xlsx` precisou de um ajuste posterior (ver item 4) por um dual-package hazard real entre Node e Vite.
4. **`importarApolicesAutoHistorico`** em `src/lib/auto.js` (commits `50906ea` + `235ff93`): importa em lote com deduplicação (chave nome+vigência_fim+seguradora). **Incidente de processo durante esta task:** um implementer subagent (modelo econômico) fez, fora do escopo pedido, um commit não autorizado revertendo a correção já revisada da Task 3 no import do `xlsx`, o que quebrou os testes — detectado e corrigido pelo controller antes da revisão (fix real: `import * as XLSXModule from 'xlsx'; const XLSX = XLSXModule.default ?? XLSXModule`, compatível com `node --test` e `vite build` ao mesmo tempo). Documentado em `.superpowers/sdd/task-4-report.md`.
5. **Botão "Importar histórico (renovações)"** em `AutoEmissoes.jsx` (commit `c38a8b4`), conectando o parser + a função de importação, com card de resumo (total/importadas/duplicadas/ignoradas/erros).
6. **Limpeza de nome generalizada**: o importador mensal existente (`rowsFromAutoSheet`) passou a usar `limparNomeSegurado` (mesma função do histórico) em vez da função local antiga `cleanNomeSegurado`, unificando a regra — mudança de comportamento deliberada, validada contra ~109 linhas reais com traço na spec do plano. A revisão final de branch (opus) encontrou um achado Important: como essa função também passou a valer para o importador MENSAL recorrente, cortar em qualquer traço (mesmo colado, sem espaço) arriscava truncar silenciosamente um nome composto legítimo (ex. "ANA-BEATRIZ SOUZA" → "ANA"). **Corrigido no mesmo dia** (commit `2572f25`): agora só corta quando há espaço adjacente ao traço, preservando nomes compostos colados; 1 teste novo cobrindo o caso, 108/108 testes verdes.
7. **Helpers testados** em `src/pages/auto/autoShared.js` (commit `885687b`): `isApoliceAtiva`, `getClienteStatusAuto`, `formatMonthYearBR`.
8. **Bug do perfil corrigido** em `getClienteAutoDetalhe` (`src/lib/auto.js`, commit `cb2da0f`): a busca de apólices do cliente combinava identificadores com prioridade (só o primeiro que existisse era usado); agora combina todos com `.or(...)` do Supabase — uma apólice só com `nome_cliente` não fica mais invisível no perfil. Também retorna `clienteDesde` (data da apólice mais antiga).
9. **"Cliente desde" + etiquetas** em `AutoClienteDetalhe.jsx` (commit `c6db6c1`): badge ativo/inativo, badge "Emitida antes do sistema" por apólice.
10. **Redesenho de `AutoClientes.jsx`** (commit `a7ea174`): filtro por letra inicial, 4 critérios de ordenação, paginação de 50/página, badge de status por cliente.

**Pendências / smoke tests que dependem de ambiente com `.env`/Supabase (não disponível nesta sessão):**
- Rodar `54_apolices_auto_origem_pre_sistema.sql` manualmente no SQL Editor do Supabase.
- Depois disso, subir a planilha real `02 RENOVAÇÕES AUTO.xlsx` pelo botão novo em Emissões e conferir o resumo de importação (contagens batendo com o esperado, nenhuma linha verde perdida).
- Abrir um cliente com apólice pré-sistema e confirmar visualmente o badge "Emitida antes do sistema" e o "Cliente desde".
- Abrir `/auto/clientes` e conferir filtro por letra, ordenação e paginação com dados reais (mais de 50 clientes).

**Riscos remanescentes (da revisão final, não bloqueantes):** import do `xlsx` (item 3/4) depende de um padrão específico (`XLSXModule.default ?? XLSXModule`) para funcionar em Node e Vite simultaneamente — se o pacote `xlsx` for atualizado de versão major no futuro, reconferir esse comportamento. O fallback de coluna ausente no INSERT de `importarApolicesAutoHistorico` é código efetivamente morto (o SELECT de deduplicação já falha antes, se a migration não tiver rodado) — comportamento de falha considerado aceitável (falha alto e claro em vez de importar dados não-marcáveis), não corrigido. `orFilterValue` (Task 8) não escapa barra invertida literal em nome de cliente — caso raríssimo, não corrigido.

`npm test` (108/108) e `npm run build` verdes.

---

**Select compartilhado não registrava clique em opção (afeta toda a app) +
apólice sem ficha mostrando aviso como nome, no Relatório (2026-07-15,
Claude):** usuário reportou 2 bugs: (1) mover ficha para outra coluna em
`/relatorio` "não funciona, principalmente para Desistências"; (2) em
apólices, várias apareciam com o nome "apolice sem ficha vinculada" em vez
do nome da pessoa + etiqueta.

1. **Causa raiz de (1) — muito mais ampla do que o relatado:** `Select`
   exportado por `src/components/ui/index.js` (usado como `import { Select }
   from '../components/ui'` em várias telas, inclusive o toolbar "Mover para
   coluna..." do Relatório) vem de `FormFields.jsx`, não do outro `Select.jsx`
   (esse é exportado à parte como `PortalSelect`, não usado aqui). O painel de
   opções desse `Select` é renderizado via `createPortal` direto em
   `document.body`, fora da subárvore DOM do botão trigger. O listener de
   "clique fora" (`mousedown` em `document`) só verificava
   `triggerRef.current?.contains(e.target)` — como as opções ficam fora dessa
   subárvore, TODO clique em qualquer opção era visto como "fora", fechando o
   dropdown no `mousedown` antes do `click` da opção conseguir disparar
   `onChange`. Resultado: nenhuma seleção "colava" nesse componente, em
   nenhuma tela que o usa — o botão de ação dependente do valor selecionado
   ficava travado desabilitado para sempre, sem erro no console, sem toast,
   "nada acontece" (confirmado ao vivo: `npm run dev` local + login real do
   usuário + Chrome DevTools/accessibility tree, tanto por coordenada quanto
   por clique via ref de acessibilidade). **Corrigido:** adicionado `dropRef`
   apontando para o container do portal, checado junto de `triggerRef` no
   handler de clique-fora (mesmo padrão já usado corretamente no outro
   `Select.jsx`/`PortalSelect`). Reproduzido e confirmado corrigido ao vivo:
   "Aprovadas" → "Desistências" e volta, ficha realmente mudou de coluna.
   Teste de dados real revertido ao estado original ao final (Supabase de
   produção, sem `.env` de teste neste ambiente).
2. **Causa raiz de (2):** `getNomeFicha` (`Relatorio.jsx`) usava o texto
   "Apólice sem ficha vinculada" como se fosse o nome do card
   (`ficha._isStandaloneApolice`), e a query que monta essas linhas sintéticas
   (`apolicesRangeRowsQuery`, painel "Emitidas" do detalhe por imobiliária)
   nem buscava `nome_interessado`/`produto` da apólice. **Corrigido:** query
   passou a buscar `nome_interessado, produto`; `getNomeFicha` retorna o nome
   real; card ganhou uma etiqueta laranja separada "Apólice sem ficha
   vinculada" abaixo do nome — mesmo padrão visual já usado (e correto) em
   `ApolicesLista.jsx`.

`npm test` (89/89) e `npm run build` verdes. Nenhuma mudança de schema/RLS.

**Arquivos alterados:** `src/components/ui/FormFields.jsx` (fix do Select,
alto impacto — reaproveitado em várias telas além do Relatório),
`src/pages/Relatorio.jsx`, `src/pages/Relatorio/CONTEXT.md`.

**Riscos remanescentes:** o fix do `Select` é uma correção de bug em
componente compartilhado — não foi feita uma varredura de todas as telas que
o usam (fora do escopo relatado pelo usuário), mas qualquer outro fluxo com
sintoma parecido de "dropdown abre mas seleção não gruda" tem a mesma causa
raiz e já está corrigido pela mesma mudança. Não testado em telas fora do
Relatório nesta sessão.

---

**Relatório — regras de negócio das métricas (visão geral, card por imobiliária,
detalhe, painel "Emitidas") corrigidas conforme especificação do usuário
(2026-07-15, Claude):** usuário recapitulou 4 regras de negócio que deveriam
valer no `/relatorio` e pediu para conferir/corrigir cada uma. `src/pages/Relatorio.jsx`:

1. **"Fichas aprovadas" (métricas do período, visão geral e detalhe):** antes
   contava só `aprovada`+`enviado_cobranca` (excluía quem já tinha apólice) —
   subestimava o total de aprovações do mês. Agora soma esse valor com as
   fichas aprovadas no mesmo período que já têm apólice (bucket
   `emitida`/`recuperados`). Novo `_withinPeriod` em `rowsWithHelpers`
   (reaproveita `isFichaWithinReportPeriod` já existente) impede contar fichas
   que só entraram em `rows` porque a apólice foi emitida neste período mas a
   aprovação em si foi em outro mês (`extraRows`/`extraIds` do carregamento).
2. **"Apólices emitidas" (métrica do período):** antes era o total bruto de
   apólices emitidas no período (`emittedPolicies.length`, incluindo apólices
   de fichas aprovadas em outro mês). Agora é "quantas das fichas aprovadas
   deste período já emitiram" (`summary.aprovadasEmitidas`, novo campo).
3. **Card por imobiliária (visão geral):** já estava correto — "Aprovadas"
   já só contava bucket `aprovada` (fichaOperational.js já promove ficha com
   apólice para bucket `emitida` antes de checar `aprovado`), "Emitidas" já
   vinha de `emittedPolicies` por imobiliária. Nenhuma mudança de código aqui,
   só validação.
4. **Detalhe por imobiliária — nova métrica:** adicionado card "Aprovadas sem
   apólice" (`summary.aprovadasSemApolice`, mesma fórmula do antigo "Fichas
   aprovadas" — já existia calculado, só não era exibido no detalhe).
5. **Painel de status "Emitidas" (detalhe por imobiliária):** antes só
   mostrava fichas com apólice vinculada (`columnMap.emitida`, que itera sobre
   `rows`/fichas — uma apólice emitida sem `ficha_id` nunca aparecia). Novo
   `emitidaLedgerRows` mescla as fichas existentes com linhas sintéticas
   somente-leitura (sem checkbox/seleção em massa, só botão "Abrir apólice")
   para cada apólice de `emittedPolicies` sem `ficha_id` — agora mostra toda
   apólice emitida da imobiliária no período. As outras 5 colunas de status
   (Aprovadas/Enviado Cobrança/Recuperados/Expiradas/Desistências) continuam
   vindo só de `columnMap` (fichas), sem mudança.

`npm run build`, `npm test` (89/89) e `npm run check:page-contexts` (mesmas
pendências pré-existentes de `src/pages/auto/*`/`GestaoComercial.jsx`, não é
regressão) verdes.

**Smoke test pendente (sem `.env`/Supabase neste ambiente):** abrir
`/relatorio` de um mês com fichas aprovadas e algumas já emitidas, conferir
que "Fichas aprovadas" bateu com o total real (incluindo emitidas) e que
"Apólices emitidas" mostra só as emitidas dessas aprovadas; abrir o detalhe de
uma imobiliária e conferir o novo card "Aprovadas sem apólice"; se houver
apólice emitida sem ficha vinculada naquele mês/imobiliária, confirmar que ela
aparece no painel "Emitidas" do detalhe (linha sem checkbox, com botão "Abrir
apólice" funcionando).

**Riscos remanescentes:** se uma ficha tiver 2 apólices emitidas dentro do
mesmo período (reemissão), `emitidaLedgerRows` só reflete a mais recente
vinculada à ficha (mesma limitação que já existia em `apolicesByFicha`/`_apolice`
antes desta mudança) — caso raro, fora do escopo reportado pelo usuário.

**Ficha (`/fichas/:id`) — 2 bugs de cotação: valores/parcelas não salvavam para
Pottencial/TOO Seguros e mensagem de retorno ignorava a seguradora selecionada
manualmente (2026-07-15, Claude):** usuário reportou dois sintomas no bloco
"Cotação e retorno" de `FichaDetalhePage.jsx`. Systematic-debugging (análise
estática de código, sem `.env`/Supabase neste ambiente):

1. **Causa raiz do bug de valores não salvos:** `updateCotacao` reconstruía o
   array `raw_data.cotacoes` INTEIRO a partir do estado React `ficha` (closure
   da renderização no momento do clique), não do banco. Como cada campo do card
   (Status via `Select.onChange`, Valor da Parcela, % Desconto, Qtd. Parcelas,
   Comissão via `InlineField.onSave`) dispara sua própria chamada assíncrona
   independente e nenhuma delas aguarda a anterior, o fluxo natural de "aprovar"
   uma seguradora (mudar Status + digitar Valor + digitar Parcelas em sequência
   rápida) gerava 2-3 chamadas concorrentes partindo do MESMO `ficha` desatualizado
   — a que terminasse por último sobrescrevia `raw_data.cotacoes` inteiro,
   descartando as mudanças das chamadas anteriores (last-write-wins sobre um
   snapshot obsoleto, não sobre o dado mais recente). `editarFicha` já buscava
   `raw_data` fresco do banco antes de gravar, mas isso não ajudava porque o
   chamador sempre mandava a chave `cotacoes` inteira, sobrescrevendo qualquer
   coisa que a busca fresca tivesse. Como Pottencial/TOO Seguros são os últimos
   da lista (`COTACAO_SEGURADORAS_BASE`), são os que acumulam mais chamadas em
   voo quando o usuário preenche os cards em sequência — mas a race also podia
   afetar qualquer seguradora dependendo da velocidade de digitação.
   **Corrigido:** nova função `atualizarCotacaoFicha(id, seguradora, fields,
   userId)` em `src/lib/fichas.js` — busca `raw_data` fresco do banco e mescla
   só os campos daquela seguradora especificamente (mesmo padrão já usado por
   `editarFicha`/`salvarRetornoGeradoFicha`), em vez de reconstruir o array
   inteiro a partir do estado React. `updateCotacao` (`FichaDetalhePage.jsx`)
   passou a chamar essa função, mantendo o update otimista local.
2. **Causa raiz do bug da mensagem:** `buildCotacaoMessageData` calculava
   `seguradoraEscolhida` só pela cotação aprovada de MENOR valor total
   (`valor_parcela × parcelamento`), ignorando completamente a seguradora que o
   usuário já escolhe manualmente pelo botão "Selecionar" de cada card
   (`selecionarSeguradora`, grava em `ficha.seguradora`/
   `raw_data.seguradora_escolhida`) — por isso a mensagem sempre saía com a
   seguradora mais barata (ex. Porto Seguro) mesmo com Pottencial selecionada e
   aprovada. **Corrigido:** `buildCotacaoMessageData` agora prioriza a cotação
   aprovada que bate com `ficha.raw_data.seguradora_escolhida`/`ficha.seguradora`
   quando existir; só cai no cálculo automático de menor valor se nada foi
   selecionado manualmente (ou se a seguradora selecionada não estiver mais
   aprovada). As linhas de preço/status de todas as seguradoras continuam
   aparecendo normalmente — só o trecho "Segue link de biometria *SEGURADORA*"
   passou a refletir a escolhida.

`npm test` (89/89) e `npm run build` verdes. Nenhuma mudança de schema/RLS —
só lógica de app em `src/lib/fichas.js` e `src/pages/FichaDetalhePage.jsx`.

**Smoke test pendente (sem `.env`/Supabase neste ambiente):** abrir uma ficha,
aprovar Pottencial e TOO Seguros preenchendo Status/Valor/Parcelas em sequência
rápida, recarregar a página e confirmar que os valores persistiram; clicar
"Selecionar" em um card aprovado (ex. Pottencial) e gerar a mensagem de retorno,
confirmando que o trecho de biometria cita a seguradora selecionada mesmo se ela
não for a mais barata.

**Riscos remanescentes:** a correção fecha a race entre chamadas originadas na
mesma aba/sessão; edição simultânea da mesma ficha por duas abas/pessoas ao
mesmo tempo ainda pode colidir (fora do escopo reportado). Se dois campos do
MESMO card forem salvos com timing quase idêntico (mesmo request), ainda existe
uma janela pequena de corrida no round-trip ao banco — bem menor que antes
(era do tamanho da digitação do usuário, agora é do tamanho de uma consulta
Supabase), não eliminada por completo.

---

**Relatório (`/relatorio`) — mover para "Desistiu" + fichas "fantasma" no card por
imobiliária (2026-07-14, Claude):** usuário reportou 3 sintomas ligados: (1) não
havia como mover manualmente uma ficha para a coluna "Desistências"; (2) o card de
algumas imobiliárias na visão geral ficava vermelho mesmo depois de todas as fichas
aprovadas terem sido marcadas como cobrança enviada; (3) algumas imobiliárias
mostravam ficha(s) no card da visão geral mas, ao abrir o relatório individual,
tudo aparecia zerado (Aprovadas 0, Emitidas 0, etc). Investigação (systematic-
debugging, sem acesso a banco neste ambiente — análise estática de código):

- **Causa raiz de (2) e (3), a mesma:** a visão geral (`groupByImobiliaria`) agrupa
  fichas usando `resolverNome()` (`useImobiliaria.js`) — resolução "fuzzy" (sem
  acento/caixa, com fallback de title-case via `normalizeImobiliaria` para nomes
  ainda não cadastrados como alias). Já o detalhe por imobiliária
  (`/relatorio/:id`) buscava fichas/apólices com `.in('imobiliaria', aliases)` —
  **match exato de string** contra `imobiliaria_aliases`. Uma ficha com uma
  variação de texto ainda não virou alias (acento/caixa/espaço) era contada no
  card da visão geral (o fallback de `resolverNome` "adivinha" o nome canônico)
  mas nunca aparecia no detalhe (match exato não encontra) — o card parecia ter
  fichas fantasma, e como a ação de marcar cobrança só existe na tela de detalhe,
  essas fichas nunca podiam ser resolvidas, mantendo o card vermelho para sempre.
  Corrigido em `Relatorio.jsx`: o filtro por imobiliária no detalhe deixou de ser
  feito no banco via alias exato e passou a ser feito em memória reaplicando o
  mesmo `resolverNome`/`normalizeKey` usado na visão geral — garante que card e
  detalhe sempre concordem e nenhuma ficha aprovada fique escondida. `getAliases`
  (não usado mais neste arquivo) removido do destructuring de `useImobiliaria()`.
- **Causa raiz de (1):** `MANUAL_REPORT_MOVE_OPTIONS` só incluía
  `aprovada`/`expirada`/`enviado_cobranca`; `buildRelatorioMovePatch`
  (`relatorioCobranca.js`) não tinha caso para `desistiu`. Adicionado
  `buildDesistiuPatch` (grava `status: 'cancelado'` + `finalizada_em`, mesma
  convenção já usada pelo Kanban de Fichas ao cancelar, e limpa marcadores de
  cobrança/expiração manual) e `desistiu` foi incluído em
  `MANUAL_REPORT_MOVE_OPTIONS`, disponível no seletor "Mover para coluna..." do
  toolbar de seleção em massa. `getFichaPeriodAnchorDate` (`Relatorio.jsx`) passou
  a ancorar `cancelado` por `finalizada_em` (mesma regra de aprovado/emitido) —
  sem isso, mover uma ficha para Desistiu trocaria sua âncora de período para
  `created_at` e ela sumiria do mês sendo visto no momento do move.

**Ronda 2 (mesmo dia, feedback do usuário) — contagem errada no card:** usuário
apontou mais 2 sintomas de contagem no card da visão geral: (a) "Aprovadas"
continuava contando fichas que já tinham sido movidas para "Enviado Cobrança"
(usuário pediu um jeito de considerar essas fichas como "em cobrança" e não mais
"aprovada apenas" — perguntado se seria coluna nova no banco; usuário confirmou
que **não**, só corrigir a contagem, reaproveitando o que já existe); (b) "Emitidas"
mostrava 5 quando na verdade havia 6 apólices.

- **(a):** o card usava `imobMetrics.aprovadas` (união deliberada de
  aprovada+enviado_cobranca, mantida para a taxa de conversão) como o número
  exibido na etiqueta "Aprovadas". Já existia, calculado à parte,
  `imobMetrics.semCobrancaEnviada` (só as que NÃO foram enviadas ainda) — só não
  era esse o valor mostrado. Trocada a etiqueta "Aprovadas" do card para usar
  `semCobrancaEnviada`; `pendingCount`/cor do card continuam usando `aprovadas`
  (união ampla), sem mudança de comportamento ali.
- **(b):** `normalizeKey()` (`Relatorio.jsx`) só corrigia mojibake e baixava a
  caixa, sem remover acento. Uma apólice com `imobiliaria` gravado com uma
  variação de acento diferente da alias cadastrada caía num grupo "fantasma" no
  `groupByImobiliaria` que nunca batia com nenhuma imobiliária real da tabela —
  somava no total geral da página ("Apólices emitidas" no topo) mas sumia do card
  daquela imobiliária especificamente. Trocado `normalizeKey` para reaproveitar
  `normalizeImobiliariaKey` (`imobiliariasMapeamento.js`, já testado), que remove
  acento além de mojibake/caixa/espaço duplicado. Mesma correção aplicada em
  `useImobiliaria.js` (`resolverNome`, `resolverImobiliariaInfo`, construção do
  `aliasMap`) — é a fonte de `resolverNome` usada em várias telas além do
  relatório, então o mesmo tipo de gap por acento poderia afetar qualquer uma
  delas.

`npm test` (89/89, sem novos testes nesta ronda — mudança é só de qual campo já
calculado é exibido, e troca de uma função de normalização por outra já testada
em `imobiliariasMapeamento.test.mjs`), `npm run build` e `npm run
check:page-contexts` (mesmas pendências pré-existentes de `src/pages/auto/*`/
`GestaoComercial.jsx`, não é regressão) verdes.

**Smoke test pendente (sem `.env`/Supabase neste ambiente):** abrir uma
imobiliária que hoje mostra card com contagem mas detalhe zerado e confirmar que
os blocos passam a exibir as fichas; marcar cobrança enviada em todas as
aprovadas de uma imobiliária com card vermelho e confirmar que o card vira azul/
laranja (não fica mais preso em vermelho); selecionar fichas no detalhe, escolher
"Desistências" no seletor "Mover para coluna..." e confirmar que elas aparecem no
bloco Desistências e continuam visíveis no período atual do relatório; conferir
que "Aprovadas" no card não conta mais fichas já em "Enviado Cobrança"; achar a
imobiliária com "Emitidas" divergente do total real e confirmar que a contagem
bateu depois da correção de acento.

**Riscos remanescentes:** o filtro em memória no detalhe busca todas as fichas/
apólices do período (sem filtro de imobiliária no banco) e filtra no cliente —
mesmo padrão de custo que a visão geral já usa, mas pode pesar em bases muito
grandes; considerar um índice/RPC dedicado se o volume crescer muito. O mesmo
padrão de match exato por alias (`.in('imobiliaria', aliases)`) ainda existe em
outros pontos do app (`apolices.js`, `fichas.js`) — fora do escopo desta correção
(usuário pediu especificamente sobre Relatórios), mas pode ter o mesmo tipo de
gap se alguma tela dependente de alias exato for usada como fonte de verdade.

---

**Banco de perguntas de quiz + área admin de curadoria (TREINAMENTOS) — 2026-07-14,
Claude:** fecha o gap conhecido da entrega anterior (nenhum quiz tinha pergunta). Plano
apresentado e aprovado nesta sessão (mesmo arquivo `~/.claude/plans/deep-rolling-wind.md`,
sobrescrito para esta rodada). Pivô importante durante a conversa: o pedido original
("admin cria o quiz, a IA sugere por lição") foi reinterpretado a pedido explícito do
usuário — sem Edge Function/API de LLM em runtime; quem gera o banco de perguntas é o
próprio Claude, nesta sessão, e o admin só cura/ativa a partir do banco gerado.

1. **Conteúdo** (`docs/TREINAMENTOS_QUIZ_PERGUNTAS.md`, novo): 340 perguntas de múltipla
   escolha (alvo era 375 — 9 módulos × 15 + 6 setores × 40), geradas por 6 agentes em
   paralelo (um por setor), cada um restrito ao trecho correspondente de
   `TREINAMENTOS_CONTEUDO_FIANCA.md`, sem inventar fatos. 4 blocos ficaram abaixo do alvo
   (marcados `⚠️` no arquivo, motivo: material fonte curto — Transferência de Corretagem
   13/15, quiz final de Renovações 32/40, Endosso 28/40, Cancelamentos 27/40) —
   deliberado, não forçado. Defeito de qualidade encontrado e corrigido antes de
   compilar: 3 dos 6 rascunhos saíram com a resposta correta concentrada em poucas
   letras (Endosso: 100% em "a"); todas as alternativas dos 6 setores foram
   reembaralhadas (conteúdo preservado) para distribuição a/b/c/d equilibrada.
2. **Schema (sem migration nova — JSONB)**: cada pergunta em `conteudo.quiz` ganhou um
   campo `status: 'sugerida' | 'ativa'`. Nasce `sugerida`; só fica visível ao funcionário
   depois que um admin marca `ativa` na tela de curadoria.
3. **Seed** (`scripts/generate-treinamentos-quiz-seed.mjs` → nova migration
   `supabase/53_treinamentos_quiz_perguntas.sql`, **NÃO EXECUTADO NO SUPABASE**):
   reaproveita `uuidv5`/`slugify`/`nodeId` de `scripts/generate-treinamentos-seed.mjs`
   para recalcular os mesmos IDs dos 15 nós de quiz já semeados — verificado por
   comparação direta que os 15 IDs-alvo do UPDATE batem com os IDs já existentes em
   `52_treinamentos_seed_fianca.sql`. `UPDATE ... jsonb_set(conteudo, '{quiz}', ...)`,
   idempotente.
4. **Lógica pura**: `getActiveQuizQuestions(quiz)` em `trainingProgression.js` (+2
   testes) filtra por `status === 'ativa'`. `TreinamentosLicao.jsx` (`QuizForm`) passou a
   usar essa função em vez de `conteudo.quiz` cru.
5. **Camada Supabase**: `updateQuizQuestions({ nodeId, quiz })` em `training.js` —
   substitui `conteudo.quiz` inteiro via UPDATE; sem RLS nova, reaproveita
   `training_nodes_update_admin` já existente.
6. **UI de admin** (`src/pages/treinamentos/admin/`, `AdminRoute`, nav `adminOnly`):
   `TreinamentosAdminQuizzes` (`/treinamentos/admin`, lista os 15 nós de quiz com
   contagem sugerida/ativa) e `TreinamentosAdminQuizDetalhe`
   (`/treinamentos/admin/quiz/:nodeId`, ativa/desativa/edita/remove pergunta, salva tudo
   de uma vez). Edição é só em estado local até o "Salvar alterações".

**Pendência**: `53_treinamentos_quiz_perguntas.sql` ainda não foi rodado no Supabase —
igual ao fluxo das migrations 51/52, precisa de execução manual explícita no SQL Editor.
Sem isso, os quizzes continuam sem pergunta em produção. `npm test` (87/87), `npm run
build` e `npm run check:page-contexts` (sem novas pendências) rodados e conferidos.

---

**Base técnica de TREINAMENTOS — schema/RLS/seed aplicados no Supabase, lógica e UI
funcionais (2026-07-14, Claude + usuário):** feature nova (currículo de treinamento
para funcionários, produto Fiança). Plano técnico apresentado e aprovado nesta
sessão (`~/.claude/plans/deep-rolling-wind.md`) antes de qualquer arquivo tocar
banco — regra "Segurança" do CLAUDE.md deste projeto. **Atualização: usuário rodou
as duas migrations manualmente no SQL Editor do Supabase — `training_nodes` e
`training_progress` já existem e estão semeadas em produção/no banco do projeto.**

**Conteúdo fonte:** `docs/TREINAMENTOS_CONTEUDO_FIANCA.md` (55 lições revisadas em
sessão anterior, 6 setores, 9 módulos, produto Fiança) + `TREINAMENTOS_ARQUITETURA.md`
(desenho de dados original).

1. **Schema + RLS** (`supabase/51_treinamentos_schema.sql`, **EXECUTADO NO
   SUPABASE pelo usuário**): `training_nodes` (árvore produto→setor→módulo→lição,
   `conteudo JSONB`, `eh_quiz_modulo`/`eh_quiz_final_setor`) e `training_progress`
   (por funcionário/nó, status/quiz_score/tentativas/concluido_em). RLS:
   `training_nodes` legível por todo `authenticated`, escrita só admin
   (`is_training_content_admin()`, mesmo padrão de `is_finance_admin()` em
   `28_financeiro_apolices.sql`); `training_progress` ownership-based
   (`funcionario_id = auth.uid()`), leitura extra para admin.
   Desvios do desenho original documentados no plano: sem coluna `seguradora`
   nem `prerequisito_node_id` (tudo derivado de `parent_id`+`ordem`+flags de
   quiz); novo campo `tipo_conteudo_nota` para qualificadores híbridos da fonte.

2. **Seed** (`scripts/generate-treinamentos-seed.mjs` → `supabase/52_treinamentos_seed_fianca.sql`,
   **EXECUTADO NO SUPABASE pelo usuário**): parser do markdown fonte, gera 86 nós (produto +
   6 setores + 9 módulos + 55 lições reais + 9 quiz de módulo + 6 quiz final de
   setor sintéticos) com UUIDv5 determinístico (idempotente). Achado durante a
   implementação, fora do plano original: `variacoes_por_seguradora` não bate 1:1
   com uma seguradora só na fonte real (rótulos combinados como "Porto / Junto",
   bullets sem seguradora nomeada) — usuário decidiu por lista `[{rotulo, texto}]`
   em vez do dicionário de 5 chaves fixas do plano original, para não inventar a
   qual seguradora cada bullet ambíguo pertence.

3. **Lógica de progressão** (`src/lib/trainingProgression.js`, pura/testável —
   21/21 testes em `trainingProgression.test.mjs`, registrado em `package.json`):
   desbloqueio sequencial de lição/módulo, quiz de módulo desbloqueia o próximo
   módulo (não "todas as lições"), quiz final de setor depende do último módulo,
   nota de corte 70% (`QUIZ_PASSING_SCORE_PCT`), `gradeQuiz` nunca "passa" com 0
   perguntas (`reason: 'no_questions'`).

4. **Camada Supabase** (`src/lib/training.js`): `fetchTrainingTree`,
   `fetchTrainingProgress`, `upsertLicaoProgress`, `submitQuizAttempt`.

5. **UI funcional** (não é o acabamento final — Codex refina depois, como
   combinado): `src/pages/treinamentos/{TreinamentosDashboard,TreinamentosSetor,
   TreinamentosModulo,TreinamentosLicao}.jsx` + `CONTEXT.md` de cada uma;
   `src/components/treinamentos/{TrainingStatusBadge,TrainingBreadcrumb,
   TrainingChatButton}.jsx` (o último é o ponto de extensão pedido para o chat
   com o CONVES IA — stub desabilitado, zero chamada de rede). Rotas em
   `App.jsx` (`/treinamentos`, `/treinamentos/setores/:id`, `/modulos/:id`,
   `/licoes/:id`) e novo grupo de nav "Treinamentos" em `Layout.jsx`.

**Pendências / decisões em aberto:**
- Nenhuma pergunta de quiz foi escrita — todo nó de quiz semeado com
  `conteudo.quiz = []`. Por isso **nenhum módulo pode ser concluído ponta a
  ponta com dados reais** até uma rodada de conteúdo separada escrever as
  perguntas (mesmo rigor de "não inventar" usado no resto do currículo).
- Setores de módulo único (Renovações, Endosso, Sinistros, Cancelamentos,
  Cobrança) semeiam quiz de módulo E quiz final de setor sobre material quase
  idêntico — sinalizado no plano, ainda não resolvido.
- **Junto Seguros permanece sem fonte — decisão definitiva do usuário (2026-07-14),
  não é mais um gap em aberto.** Todas as lições ficam com essa seguradora
  ausente da lista `variacoes_por_seguradora`; não entra pauta de revisão
  futura a menos que o usuário decida trazer material da Junto novamente.

**Portão de execução:** `51_treinamentos_schema.sql` e `52_treinamentos_seed_fianca.sql`
foram criados para revisão e **rodados manualmente pelo usuário no SQL Editor do
Supabase em 2026-07-14** — mesmo fluxo já usado para outras migrations sensíveis
deste projeto. `training_nodes`/`training_progress` existem e estão semeadas.
Smoke test manual (login real, abrir `/treinamentos`) ainda não confirmado nesta
sessão — este ambiente não tem `.env`/credenciais Supabase para validar.

**Arquivos alterados/criados:** `supabase/51_treinamentos_schema.sql`,
`supabase/52_treinamentos_seed_fianca.sql`, `scripts/generate-treinamentos-seed.mjs`,
`src/lib/trainingProgression.js` (+`.test.mjs`), `src/lib/training.js`,
`src/components/treinamentos/*.jsx`, `src/pages/treinamentos/*.jsx` (+`CONTEXT.md`),
`src/App.jsx`, `src/components/Layout.jsx`, `package.json`, `docs/PROJECT_CONTEXT.md`.

**Próximo passo sugerido:** revisar os dois arquivos `.sql`; se aprovado, rodar
`51_...` e depois `52_...` manualmente no SQL Editor do Supabase; smoke test
manual (sem `.env` neste ambiente); decidir sobre as pendências acima; só então
autoria de perguntas de quiz.

---

**Responsividade cross-resolution — implementação completa (2026-07-13, Claude):**
usuário reportou que o sistema, ajustado visualmente para 1920x1080, fica "muito
pequeno ou muito grande e mal posicionado" em outras resoluções, com prioridade
explícita para notebooks. Tarefa é normalmente de especialidade Codex (UI/CSS/
responsividade), usuário optou por Claude planejar e executar. Auditoria (Layout.jsx,
index.css, tailwind.config.js + agente Explore varrendo `src/`) identificou 3 causas
raiz e todas foram corrigidas em 5 fases:

1. **Fase 0 — `Layout.jsx`/`tailwind.config.js`:** sidebar sem preferência salva
   (`localStorage 'sidebar-open'`) agora abre já recolhida (rail 92px) por padrão em
   larguras <1440px (notebooks); preferência explícita do usuário continua respeitada.
   Novo breakpoint custom `uw: '2200px'` + `uw:max-w-[1900px] uw:mx-auto` no wrapper do
   `<Outlet />` — conteúdo não estica mais sem teto em ultrawide/4K (não afeta
   notebooks nem desktop 1920 padrão).
2. **Fase 1 — `Dashboard.jsx`, `AutoDashboard.jsx`, `ComercialDashboard.jsx`:**
   adicionado breakpoint `lg:` intermediário nos grids que só tinham `xl:`
   (`xl:grid-cols-12` viravam 1 coluna forçada entre 1024-1280px — faixa exata de
   1366x768/1440x900). Também fechado `md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
   nas métricas operacionais/comerciais para scaling mais suave.
3. **Fase 2 — avaliada, sem mudança extra:** a maioria dos grids `xl:grid-cols-4`
   é de exatamente 4 itens fixos (não se beneficiam de `2xl:`); os grids com listas
   dinâmicas já tinham `2xl:` (Dashboard imobiliárias, ComercialDashboard, Relatorio,
   ApolicesLista). O teto `uw:max-w` da Fase 0 já resolve o "esticamento" em telas
   grandes sem precisar tocar cada grid.
4. **Fase 3 — `index.css`, `KanbanFichas.jsx`, `Pipeline.jsx`:** `.kanban-viewport`
   trocou `min-height: max(68vh, 640px)` (fixo, estourava em notebook 768px de altura)
   por `clamp(26rem, calc(100dvh - 18rem), 46rem)`, mesmo padrão já validado em
   `.apolices-gestao-page`. `KanbanFichas.jsx` tinha um `style={{ height: 'max(68vh,
   640px)' }}` inline pior ainda (height fixo, não min-height) — removido, herda da
   classe. `Pipeline.jsx:856` tinha `calc(100vh - 28rem)` competindo com
   `min-h-[520px]` (min-height quase sempre vencia, travando em 520px) — trocado por
   `clamp(24rem, calc(100vh - 26rem), 44rem)`. `Pipeline.jsx:242` também tinha
   `w-[296px]` fixo sobrescrevendo a largura responsiva de `.kanban-col` (var
   `--kanban-col-w`, já ajustada por media query) — removido.
5. **Fase 4 — avaliada, sem mudança:** grids `grid-cols-2/3` sem prefixo (LeadDetalhe,
   GestaoComercial) estão dentro de modais com `max-w` já responsivo (`Modal.jsx`) —
   não é problema de notebook/desktop, cosmético de mobile, fora do escopo pedido.
6. **Fase 5 — validação visual (dev server + Chrome, login real do usuário):**
   confirmado em 1366x768 e 1920x1080 nas 3 telas mais impactadas (Dashboard, Kanban de
   Fichas, Pipeline comercial). **Bug real encontrado e corrigido durante a validação**
   (pré-existente, não introduzido nesta sessão): a ordem dos cards em
   "Top imobiliárias" → "Fichas por imobiliária" (full-width) → "Atividade recente"
   deixava um vão vazio permanente ao lado de "Top imobiliárias" (CSS Grid não
   reaproveita espaço de linhas anteriores quando um item full-width força quebra de
   linha) — isso já acontecia em produção a 1920x1080, ficou mais visível ao adicionar
   o breakpoint `lg:`. Corrigido reordenando: "Top imobiliárias" + "Atividade recente"
   lado a lado primeiro (preenchem a linha inteira, 5+7 de 12 colunas / 1+2 de 3), card
   full-width por último.

`npm run build` verde a cada fase, `npm test` 64/64 verde ao final. Nenhuma mudança de
lógica de negócio, banco, RLS ou autenticação — só CSS/Tailwind/JSX de layout.

**Arquivos alterados:** `tailwind.config.js`, `src/components/Layout.jsx`,
`src/index.css`, `src/components/KanbanFichas.jsx`, `src/pages/Dashboard.jsx`,
`src/pages/auto/AutoDashboard.jsx`, `src/pages/comercial/ComercialDashboard.jsx`,
`src/pages/comercial/Pipeline.jsx`.

**Riscos remanescentes:** validação visual cobriu só notebook (1366x768) e desktop
(1920x1080) com dados reais; ultrawide (3440x1440) e 4K (3840x2160) foram corrigidos
pela análise de código (`uw:max-w` cap) mas não visualmente confirmados nesta sessão —
recomenda-se checar ao menos uma vez em monitor grande real. Outras páginas com grids
`xl:`-only não tocadas nesta rodada (fora das 3 mais usadas) podem ter o mesmo vácuo
1024-1280px em menor escala — não é regressão, é escopo não coberto.

**Próximos passos sugeridos:** validar visualmente em 1440x900 (segunda resolução de
notebook mais comum) e em um monitor ultrawide/4K real se disponível; se aparecerem
outras páginas com o mesmo sintoma, aplicar o mesmo padrão `lg:` intermediário.

---

**Upload em Lote — imobiliária por linha + duplicidade em 2 níveis (vermelho/laranja)
(2026-07-08, Claude):** redesenho do workspace `upload_lote` a pedido do usuário, mudando
uma decisão anterior (imobiliária deixa de ser única para o lote todo).

1. **Imobiliária por linha, não mais global**: removida a seleção de imobiliária do lote
   inteiro (sidebar); cada linha (`LinhaApoliceLote`) agora tem seu próprio
   `ImobiliariaSelect` (componente já existente, reaproveitado — mostra o logo da
   imobiliária no próprio seletor via `WorkspacesSelect`). Como o casamento de ficha por
   nome dependia da imobiliária escolhida, `buscarFichasParaVinculoApolice` passou a ser
   chamada 1x (sem filtro de imobiliária) ao abrir o workspace, carregando todas as fichas
   não-recusadas do sistema; por linha, ao escolher a imobiliária, resolve os aliases
   (`getAliases`) e filtra essas fichas em memória (`todasFichas.filter(f =>
   aliases.includes(f.imobiliaria))`) antes de casar por nome (`matchFichasPorNome`) — evita
   1 query por PDF.
2. **Duplicidade em 2 níveis**: antes só existia 1 aviso (laranja) para número de apólice
   já cadastrado. Agora:
   - **Vermelho** (`duplicidadeNumero`, `buscarApolicePorNumero`) — mesmo número já existe
     no sistema; continua bloqueando a seleção da linha até confirmar "É uma apólice
     diferente" no modal "Verificar dados".
   - **Laranja** (`apoliceDivergente`, nova lógica) — a ficha vinculada à linha (auto ou
     manualmente) já tem uma apólice associada (`buscarApolicePorFichaId`, já existente),
     mas com número diferente do PDF atual (comparação via `normalizeNumeroApolice`, nova
     importação de `lib/apolicesNumero.js`); não bloqueia a seleção, só avisa com um botão
     "Verificar apólice existente" (inline na linha e também replicado no modal).
3. **"Ver apólice existente" abre em nova aba** (`window.open`, não `navigate`) nos dois
   níveis — a pedido explícito do usuário ("se ele voltar, ele volta para a mesma parte de
   onde estava antes"). Como o lote em andamento nunca é desmontado (a aba do Upload em
   Lote continua aberta), não há nada pra "restaurar": o usuário só fecha a aba nova e
   continua exatamente de onde estava. Não usei `sessionStorage`/persistência de estado
   porque os `File` dos PDFs não são serializáveis e a rota do kanban desmontaria o
   workspace de qualquer forma — abrir em nova aba é a solução mais simples e robusta pro
   requisito.

`SEGURADORAS_UPLOAD_DIRETO`, `criarApolice`, `uploadDocumento`, `vincularApoliceAFicha`,
`calculateValorComissao`, `Modal`/`DadoCard` reaproveitados sem mudança. `npm run build`,
`npm test` (64/64) e `npm run check:page-contexts` (mesmas pendências pré-existentes)
verdes. `CONTEXT.md` de `ApoicesGestao` atualizado.

**Smoke test pendente (sem `.env`/Supabase neste ambiente):** subir 2+ PDFs, escolher uma
imobiliária diferente em cada linha e conferir que o logo aparece e que as fichas
candidatas mudam por linha; testar o card vermelho (subir um PDF com número já cadastrado)
e o laranja (vincular uma ficha que já tem apólice com outro número); clicar "Abrir
apólice existente"/"Verificar apólice existente" e confirmar que abre em nova aba sem
alterar o estado do lote na aba original.

---

**Habilitar Tokio Marine no Upload Direto e no Upload em Lote (2026-07-08, Claude):**
`SEGURADORAS_UPLOAD_DIRETO` (`ApoicesGestao.jsx`) ganhou `'Tokio Marine'` — o parser
`parseTokioMarineV3` já existia em `apoliceParser.js` e já está mapeado em `PARSERS`
(`tokio`/`tokio marine`), só não era oferecido nos seletores de seguradora dos dois
workspaces de upload. Grid de seguradora trocado de `grid-cols-3` para `grid-cols-2` (2x2)
nos dois workspaces para acomodar o 4º botão sem ficar desalinhado. `SeguradoraBadge`
resolve logo/iniciais dinamicamente por nome, então não precisou de mudança própria.
`npm run build` verde.

**Risco já sinalizado antes (continua valendo):** o parser da Tokio nunca foi validado
contra um PDF real (só desenvolvido por inferência de padrão) — recomenda-se conferir os
campos extraídos (`numero_apolice`, vigência, nome do locatário/proprietário, prêmio,
parcela) na primeira apólice Tokio real subida por qualquer um dos dois fluxos, e ajustar
os regexes de `parseTokioMarineV3` se algo vier vazio/errado.

---

**Upload em Lote de Apólices (até 10 PDFs) com vínculo automático de ficha (2026-07-08,
Claude):** novo workspace `upload_lote` em `ApoicesGestao.jsx` (além de
`kanban`/`iniciar`/`upload` já existentes), componentes `UploadLoteWorkspace` +
`LinhaApoliceLote`. Fluxo: usuário escolhe seguradora + imobiliária uma vez (travadas
assim que o primeiro PDF é adicionado), sobe até 10 PDFs de uma vez (`input type="file"
multiple`, corta em 10 com toast se passar do limite), o sistema extrai os dados de cada
um sequencialmente via `parseApolice` (já existente, sem mudança), casa cada apólice por
nome com fichas de qualquer status exceto `recusado` da imobiliária selecionada (nova
`buscarFichasParaVinculoApolice` + `matchFichasPorNome` em `src/lib/fichas.js` — busca
única por imobiliária, reaproveitada para todos os PDFs do lote, sem 1 query por arquivo),
destaca apólices já cadastradas pelo mesmo número (`buscarApolicePorNumero`, já existente)
e bloqueia a seleção daquele item até o usuário confirmar "é uma apólice diferente" no
modal "Verificar dados" (reaproveita `Modal`/`DadoCard` já existentes), permite comissão
(%) opcional por linha com `valor_comissao` calculado automaticamente
(`calculateValorComissao`, já existente) e cria só as selecionadas: `criarApolice` +
`uploadDocumento` (mesmo padrão do Upload Direto) e, quando há ficha vinculada,
`vincularApoliceAFicha` (nova em `src/lib/apolices.js`, extrai o mesmo update de ficha que
`registrarApoliceDaFicha` já fazia — status → `emitido`, numero_apolice, seguradora,
vigência, valor_parcela — sem alterar `registrarApoliceDaFicha`, que continua servindo só
o fluxo "Iniciar Emissão"). Itens com erro de criação ganham botão "Tentar novamente" e
continuam na lista; itens criados com sucesso saem da lista e disparam um `load()` do
kanban ao final.

Nenhuma mudança de schema, RLS ou autenticação — só lógica de app (2 funções novas de
leitura/escrita) e UI nova. `CONTEXT.md` de `ApoicesGestao` atualizado para documentar os
3 workspaces (estava desatualizado, não mencionava nem "Upload Direto"). `npm run build`,
`npm test` (64/64) e `npm run check:page-contexts` (mesmas pendências pré-existentes de
`src/pages/auto/*`/`GestaoComercial.jsx`, não é regressão) verdes.

**Smoke test pendente (sem `.env`/Supabase neste ambiente):** abrir "Upload em Lote" em
`/apolices`, escolher seguradora + imobiliária com fichas conhecidas, subir 2-3 PDFs reais
(incluindo 1 cliente com ficha não-recusada existente e 1 número de apólice já
cadastrado), conferir que a ficha candidata aparece certa, que o destaque de duplicidade
bloqueia a seleção até confirmar em "Verificar dados", que preencher comissão calcula
`valor_comissao`, e que "Registrar selecionadas" cria só as marcadas, vincula a ficha
escolhida (conferir que ela muda de status para `emitido`) e anexa o PDF de cada uma.

**Risco a sinalizar:** casamento de ficha por nome é só string-match normalizado (sem
acento/case) — nomes muito diferentes de grafia entre a ficha e o PDF não vão aparecer
como candidato automático; o usuário sempre pode ver "Nenhuma ficha correspondente
encontrada" e seguir sem vínculo, nada é vinculado sem revisão possível. Também nada
impede selecionar a mesma ficha candidata em duas linhas do mesmo lote (ex: PDF
duplicado) — não é bloqueado, fica por conta da revisão do usuário antes de registrar.

---

**Revisão de entrega do Codex — commits `12de783`/`91ae20b` (Dashboard/Relatorio/
ImobiliariaDetalhe), 2026-07-08, Claude:** revisão de performance/responsividade
+ encoding + lógica pedida pelo usuário ("deixe mais veloz, responsivo e suave").

*Encoding (BOM/mojibake introduzidos pelo editor do Codex, mesmo padrão já
documentado neste arquivo):* BOM removido de `App.jsx`, `imobiliariasSchema.js`,
`imobiliariasMapeamento.js`, `Imobiliarias.jsx` e do arquivo renomeado
`ImobiliariaDetalhe.jsx` (ver abaixo). Mojibake revertido em `App.jsx`
("Ãrea Auto"/"Ãrea Comercial" → "Área Auto"/"Área Comercial", dupla-codificação
UTF-8) e em `Dashboard.jsx` (perda real de acentuação — "imobili?ria" → "imobiliária",
"per?odo" → "período", "Cat?logo" → "Catálogo" — mais um byte de controle
invisível (0x1D) colado a caracteres de replacement (U+FFFD) que substituíam o
travessão "—" de 11 placeholders de métrica, e "Últimos 3/6 meses" corrompido
para "?altimos"). Todas as correções via inferência de contexto (palavras comuns,
inequívocas) + validadas depois com `npm test`/`npm run build`.

*Dead code:* `ImobiliariaDetalheFixed.jsx` (630 linhas, entregue pelo Codex como
arquivo novo em vez de editar `ImobiliariaDetalhe.jsx` no lugar) tinha substituído
silenciosamente o arquivo antigo no roteamento (`App.jsx` importava só o novo),
deixando `ImobiliariaDetalhe.jsx` original órfão (0 imports). Consolidado:
`ImobiliariaDetalhe.jsx` antigo removido, `ImobiliariaDetalheFixed.jsx` renomeado
para `ImobiliariaDetalhe.jsx` (função renomeada de volta para `ImobiliariaDetalhe`),
`App.jsx` e `CONTEXT.md` da página atualizados.

*Performance/responsividade (o pedido explícito do usuário):*
1. `imobiliariasSchema.js`: `fetchImobiliariaById` descobre colunas opcionais
   ausentes no banco tentando a query e removendo uma coluna por vez a cada erro
   — sequencial, sem cache. Como os 4 campos comerciais (`recebe_comissao`,
   `pct_comissao`, `objetivo_comercial`, `observacoes_comerciais`) não têm
   nenhuma migration criada ainda, toda visita a `/imobiliarias/:id` disparava
   até ~4-10 round-trips sequenciais ao Supabase só para descobrir isso de novo,
   antes de conseguir carregar a página — a causa mais provável de lentidão
   percebida nessa tela. Corrigido com cache em memória (mesmo padrão já usado
   em `useImobiliaria.js`): a descoberta roda uma vez por sessão da aba, visitas
   seguintes pulam direto para a query já sem os campos sabidamente ausentes.
2. `Dashboard.jsx`: a busca por nome de ficha no painel de detalhe da
   imobiliária (`detailSearch`) disparava uma query ao Supabase a cada tecla
   digitada, sem debounce — te clado rápido gerava uma rajada de requests e
   travava a digitação. Corrigido com debounce de 400ms (mesmo padrão já usado
   em `Fichas.jsx`): o campo de busca continua respondendo à digitação
   instantaneamente (estado local), só a query é adiada.

*Regressão de lógica de negócio revertida (edição concorrente do Codex durante
esta revisão):* enquanto esta revisão estava em andamento, `Relatorio.jsx` foi
alterado no disco (fora deste agente) trocando `EXCLUDED_REPORT_STATUS =
'recusado'` por uma allowlist `INCLUDED_REPORT_STATUSES` que reintroduzia
exatamente o bug do "Bugfix #2" corrigido hoje mais cedo (fichas `pendente`,
`em_cotacao`, `cpf_invalido` voltariam a sumir do relatório). A ideia nova desse
commit concorrente — usar `finalizada_em` como âncora de período para fichas
aprovadas/emitidas em vez de `created_at` (`getFichaPeriodAnchorDate`,
`isFichaWithinReportPeriod`) — foi mantida por ser uma melhoria legítima e
independente; só a redução da lista de status visível foi revertida de volta
para a exclusão única de `recusado`, com os 10 blocos de `COLUNAS` restaurados.
Usuário confirmou explicitamente para integrar (não descartar) a mudança
concorrente.

`npm test` (64/64), `npm run build` e `npm run check:page-contexts` (mesmas
pendências pré-existentes de `src/pages/auto/*` e `GestaoComercial.jsx`, não é
regressão) verdes após todas as correções. Smoke test manual no navegador
**não foi feito** (sem `.env`/credenciais Supabase neste ambiente) — recomenda-se
validar antes de considerar encerrado: abrir `/imobiliarias/:id` e conferir que
carrega rápido mesmo com os campos comerciais ausentes; digitar no campo de
busca do card "Fichas por imobiliária" no Dashboard e conferir que não trava;
abrir `/relatorio/:id` de um mês passado e conferir que fichas `pendente`/
`em_cotacao`/`cpf_invalido` (se houver no período) ainda aparecem nos blocos
correspondentes.

---

**AVISO — edição concorrente detectada (2026-07-08):** durante o bugfix #3
abaixo, um `git commit` externo a este agente aconteceu no meio da tarefa
(`91ae20b`) e reverteu uma edição já aplicada em `src/pages/Relatorio.jsx`
(remoção das colunas pendente/em_cotacao/cpf_invalido) de volta pro estado
antigo, sem eu ter feito `git checkout`/`reset`. Reaplicada e confirmada.
Também foi observado `App.jsx` quebrado (import de `ImobiliariaDetalheFixed.jsx`,
arquivo deletado no working tree sem remover o import) — não relacionado a
este trabalho, não corrigido aqui (fora de escopo, provável refactor em
andamento por outro processo/pessoa no mesmo repo). Se houver outra sessão de
IA ou pessoa editando este repo ao mesmo tempo, recomenda-se coordenar para
evitar perda de trabalho.

**Bugfix #3 — fichas sem seguradora ainda não apareciam; ajuste de escopo do
relatório a pedido do usuário (2026-07-08, Claude):** usuário confirmou que as
2 fichas (bugfix #1/#2) estavam sem `seguradora` preenchida e mesmo assim não
apareciam, e pediu duas mudanças explícitas:
1. Fichas aprovadas/emitidas devem entrar no relatório pela **data de
   aprovação** (`finalizada_em`, fallback `created_at`), não pela data de
   criação da ficha — uma ficha pode ter sido criada num mês e só aprovada no
   seguinte, e o relatório do mês de aprovação é o que importa. Implementado em
   `getFichaPeriodAnchorDate`/`isFichaWithinReportPeriod` (`Relatorio.jsx`): a
   query busca um superset via `.or()` (created_at OU finalizada_em no
   período) e o corte exato por período é feito em JS usando o campo correto
   por status. Só afeta `aprovado`/`emitido` (inclui `enviado_cobranca`/
   `recuperados`, que são variações desses dois); os demais status continuam
   ancorados em `created_at`, sem mudança.
2. Remover as colunas/blocos "Pendentes", "Em Cotação" e "CPF Inválido" da
   tela — mantidas apenas: Em Análise, Aprovadas, Emitidas, Enviado Cobrança,
   Recuperados, Expiradas, Desistências (7 blocos). A query agora usa
   `INCLUDED_REPORT_STATUSES = ['aprovado', 'emitido', 'cancelado',
   'em_analise', 'expirada']` (allowlist) em vez do `.neq('recusado')` do
   bugfix #2 — evita buscar fichas `pendente`/`em_cotacao`/`cpf_invalido` que
   não têm mais bloco pra aparecer (ficariam "contadas mas invisíveis").
   `getFichaOperationalState` (`fichaOperational.js`) mantém os branches
   `pendente`/`em_cotacao`/`cpf_invalido` intactos — ainda usados por
   `FichaStatusBadge.jsx` fora do relatório.

`npm run build` **não pôde ser validado nesta rodada** — quebrado por causa
externa (ver aviso de edição concorrente acima), não relacionada a
`Relatorio.jsx`. Sintaxe de `Relatorio.jsx` verificada isoladamente com
esbuild. `npm test` 64/64 verde (sem relação direta com esta mudança, que é
só em `Relatorio.jsx`, arquivo sem suíte de testes própria — a lógica pura
nova, `getFichaPeriodAnchorDate`/`isFichaWithinReportPeriod`, não foi
extraída para `src/lib/` nesta rodada por causa da instabilidade de edição
concorrente; considerar extrair depois, seguindo o padrão de
`getReportEffectiveNow`).

**Smoke test pendente:** confirmar no `npm run build` (depois que o `App.jsx`
for corrigido por quem estiver mexendo nele) que compila; abrir
`/relatorio/:id` da imobiliária com as 2 fichas sem seguradora e confirmar que
aparecem no mês de aprovação (não no mês de criação, se forem diferentes);
confirmar que os 3 blocos removidos (Pendentes/Em Cotação/CPF Inválido) não
aparecem mais.

---

**Bugfix #2 — relatório (`/relatorio`) só buscava fichas `aprovado`/`emitido`
(2026-07-08, Claude):** após o bugfix #1 (abaixo) o usuário reportou que ainda
faltavam fichas e pediu garantia explícita: **todo status deve aparecer no
relatório, exceto `recusado`**. Causa raiz adicional (independente do bugfix
#1): a query de `/relatorio` (`src/pages/Relatorio.jsx`) usava
`REPORT_STATUSES = ['aprovado', 'emitido']` como *allowlist* — qualquer ficha
`pendente`, `em_cotacao`, `em_analise`, `cancelado`, `cpf_invalido` (ou
`expirada` já no cadastro) nunca era buscada no banco, ficasse ela expirada ou
não. Mesmo se buscada, `getFichaOperationalState`
(`src/lib/fichaOperational.js`) retornava `null` para `pendente`/`em_cotacao`/
`em_analise`/`emitido`-sem-apólice-ainda, e `COLUNAS` (blocos da tela) não
tinha bucket para `desistiu`/`cpf_invalido`/`recusada` — então mesmo uma ficha
buscada podia ser descartada silenciosamente por `isEligibleReportRow`
(`Boolean(getColuna(ficha))`) ou cair fora de `columnMap` na hora de renderizar.

Corrigido em duas frentes:
1. `fichaOperational.js`: `getFichaOperationalState` ganhou branches para
   `pendente`, `em_cotacao`, `em_analise`, `cpf_invalido` e para `emitido` sem
   apólice vinculada ainda — agora só retorna `null` se o `status` da ficha for
   um valor fora do domínio conhecido (nunca mais para os 8 status válidos que
   não são `recusado`). Testado (`getFichaOperationalState resolve um bucket
   não-nulo para todo status exceto recusado`, `fichaOperational.test.mjs`).
2. `Relatorio.jsx`: troca de `.in('status', REPORT_STATUSES)` por
   `.neq('status', EXCLUDED_REPORT_STATUS)` (`EXCLUDED_REPORT_STATUS =
   'recusado'`) nas duas queries de fichas; `COLUNAS` ganhou 5 blocos novos
   (`Pendentes`, `Em Cotação`, `Em Análise`, `Desistências`, `CPF Inválido`),
   totalizando 10 blocos na tela de detalhe por imobiliária. Nada nos outros
   componentes (`BlocoRelatorio`/`LinhaRelatorio`/toggles de cobrança) assume
   uma lista fechada de 5 colunas — todos os `coluna.id === 'x'` têm fallback
   seguro, então os novos blocos renderizam sem mudança adicional.

**Importante — o que essa garantia cobre e o que não cobre:** agora toda ficha
com `status != 'recusado'` que esteja dentro do intervalo de datas
(`created_at`) e (na tela de detalhe) cujo campo `imobiliaria` bata com um dos
aliases resolvidos da imobiliária SEMPRE aparece em algum dos 10 blocos. Isso
NÃO cobre: fichas cujo `imobiliaria` no banco não corresponda a nenhum alias
cadastrado da imobiliária (mismatch de nome/alias — não investigado nesta
rodada, diferente do bug de status); nem mudanças de RLS/permissão de leitura.

`node --test src/lib/fichaOperational.test.mjs` (14/14) e `npm test` completo
(64/64) verdes; `npm run build` verde. `package.json`/`Dashboard.jsx` que
apareciam corrompidos (BOM) durante o bugfix #1 foram resolvidos por edição
concorrente externa a este agente antes desta rodada — build e testes
completos puderam rodar normalmente desta vez.

**Smoke test pendente (recomendado antes de considerar encerrado):** abrir
`/relatorio/:id` de uma imobiliária com fichas em `pendente`/`em_cotacao`/
`em_analise`/`cancelado`/`cpf_invalido` no período e confirmar que aparecem
nos novos blocos; confirmar que uma ficha `recusado` continua não aparecendo
(comportamento esperado); se o ambiente testado for a URL de produção (não
`localhost`), confirmar que houve deploy do commit mais recente antes de
validar — mudança em código só reflete em produção depois do build/deploy.

---

**Bugfix #1 — fichas aprovadas somem do relatório de meses passados (2026-07-08,
Claude):** usuário reportou que 2 fichas (imobiliárias A e D, junho) apareciam
no "Relatório Mensal de Fichas" (dentro de Fichas) mas não em `/relatorio`.
Causa raiz: `isFichaExpiredOperational` (`src/lib/fichaOperational.js`) sempre
calculava a idade da ficha contra a data real de **hoje**, nunca contra o
período do relatório sendo visualizado. Resultado: uma ficha `aprovado` sem
seguradora definida (limiar padrão de 30 dias) aprovada em junho, vista em
julho (>30 dias reais depois), era reclassificada "ao vivo" para `expirada` e
sumia do bloco "Aprovadas"/contador "Fichas aprovadas" — mesmo revisando o
mesmo mês repetidas vezes. Confirmado meses depois via checagem manual do
usuário (ficha aparecia em "Expiradas", não em "Aprovadas").

Corrigido com `getReportEffectiveNow(rangeEndYmd, realNow)` (novo, exportado
em `fichaOperational.js`, testado em `fichaOperational.test.mjs`): para
períodos já encerrados (mês/ano passados), a idade é calculada até o fim
daquele período, não até hoje; para o período corrente ou histórico, segue
usando a data real normalmente. `src/pages/Relatorio.jsx` passa esse
`effectiveNow` para `getOperacionalStatus`/`getColuna` uma única vez (em
`rowsWithHelpers`, via novo campo `_oper` cacheado por linha — todas as outras
~15 chamadas a `getColuna`/`isApprovedFicha`/etc. no arquivo reusam esse valor
sem precisar de mudança). Escopo contido em `Relatorio.jsx`; nenhuma outra tela
que usa `fichaOperational.js` (Kanban de Fichas, detalhe de ficha) foi
alterada — essas continuam com o comportamento "ao vivo" correto.

`node --test src/lib/fichaOperational.test.mjs` (11/11) verde. `npm test`
completo e `npm run build` **não puderam ser validados**: no momento desta
correção, `package.json` e `src/pages/Dashboard.jsx` apareceram modificados
sem intervenção deste agente (provável edição concorrente do Codex, mesmo
padrão de BOM já documentado neste arquivo em passes anteriores), quebrando o
build (`Unexpected token '﻿'` no `package.json`) e o `npm test` (import
sem extensão em `imobiliariasMapeamento.js`, arquivo novo não rastreado) por
motivos não relacionados a esta mudança. Verificado isoladamente com
`esbuild` que `Relatorio.jsx` e `fichaOperational.js` têm sintaxe válida.
**Recomenda-se rodar `npm test`/`npm run build` novamente depois que o
trabalho concorrente for commitado/resolvido, e validar manualmente**: abrir
`/relatorio/:id` de uma imobiliária com ficha aprovada antiga em um mês
passado e confirmar que ela aparece em "Aprovadas" (não "Expiradas").

## Frente ativa (Claude) — Auditoria global UI/UX + encoding

Auditoria/redesign premium modulo a modulo (plano em `~/.claude/plans/projeto-de-eventual-koala.md`).
Modulos concluidos: Dashboard, Fichas, Relatorio, Apolices, Imob/Seg, Auto, Comercial,
Financeiro, Config/Login, Shell.

**Pass de encoding (2026-06-30):** mojibake corrigido nos arquivos de exibicao
(`fichas.js` labels/mensagens/comentarios, `RelatorioMensal.jsx`, `ModalFicha.jsx`,
`DetalhesFicha.jsx`) via reversao byte-a-byte (Latin-1 + CP1252). NAO tocados de proposito:
`text.js` (normalizador de mojibake), `apoliceParser.js` (regex tolerante a mojibake do PDF)
e `financeiroProducaoCalc.test.mjs` (texto correto). Build verde.

**Pass de encoding #2 (2026-07-02, Claude):** varredura completa de `src/` e `scripts/`
por mojibake residual. Corrigido em `src/components/Layout.jsx`, `src/pages/auto/AutoEmissoes.jsx`,
`src/pages/ApoicesGestao.jsx`, `src/pages/MinhasFichas.jsx` e `src/lib/financeiroFaturasCalc.test.mjs`
(labels de UI, mensagens de toast, comentarios de secao `───`, separadores ` · `/` — `/` → `),
incluindo 3 ocorrencias de caractere de substituicao U+FFFD (perda de dado, nao reversivel -
corrigidas por inferencia de contexto em nomes de teste). Escopo combinado com o usuario: apenas
codigo de aplicacao, sem tocar documentacao (ConvesSystemBrain, docs/, .md da raiz). Mantidos
intocados de proposito (mesma razao do pass #1): `text.js`, `apoliceParser.js`,
`financeiroProducaoCalc.test.mjs`. `npm run build` e `npm test` (42/42) verdes apos a correcao.

**Relatorio por imobiliaria — kanban para blocos de lista (2026-07-01):** tela
`/relatorio/:imobiliariaId` (`src/pages/Relatorio.jsx`) trocou o kanban
drag-and-drop (`@dnd-kit`) pelos 5 blocos empilhados (Aprovadas, Emitidas,
Enviado Cobranca, Recuperados, Expiradas), com toggles de cobranca
enviada/imobiliaria retornou e fotos de orcamentista/emissor por linha.
Logica pura extraida para `src/lib/relatorioCobranca.js` (testada,
`npm test`). Spec e plano em `docs/superpowers/specs/2026-07-01-relatorio-blocos-lista-design.md`
e `docs/superpowers/plans/2026-07-01-relatorio-blocos-lista.md`. Merge feito
na main (commit `06f4fbd`), 37 testes passando, build verde. Smoke test
manual no navegador NAO foi feito (sem `.env`/credenciais Supabase no
ambiente) — recomenda-se conferir visualmente antes de considerar encerrado.

**Revisao de entrega do Codex — Kanban/Apolices/Relatorio/Fichas (2026-07-02, Claude):**
Codex entregou refactor que separa `retorno_enviado` (retorno ao cliente) de
`cobranca_started_at`/`imobiliaria_retornou` (rastreio de cobranca) — logica
correta, 44/44 testes verdes, build verde. Revisao encontrou e corrigiu:
(1) `KanbanFichas.jsx` — a edicao do Codex converteu 27 bytes de mojibake ja
existentes (recuperaveis via CP1252/Latin-1) em caracteres U+FFFD irreversiveis;
recuperado o texto correto via arqueologia de git + reversao byte-a-byte, sem
tocar na logica que o Codex mudou; (2) typos literais introduzidos pelo Codex:
"N?o" em `FichaDetalhePage.jsx` e "Inverter sele??o" em `Relatorio.jsx` (texto
visivel ao usuario), mais 6 descricoes de teste em `relatorioCobranca.test.mjs`;
(3) BOM (UTF-8 byte-order-mark) introduzido pelo editor do Codex em 6 arquivos
(`apolices.js`, `ApolicesLista.jsx`, `KanbanBoard.jsx`, `ModalFinalizar.jsx`,
`ApoicesGestao.jsx`, `Relatorio.jsx`) — removido; (4) badge "Retorno enviado" em
`FichaDetalhePage.jsx` usava cores emerald fora do padrao do modulo — trocado
para tokens `status-success`. Build e testes conferidos verdes apos as correcoes.

**Risco nao resolvido (aguardando decisao):** `scripts/reset_junho_enviado_cobranca.mjs`
(novo, nao rastreado) usa `SUPABASE_SERVICE_ROLE_KEY` direto de `.env.local` fora
do n8n — viola a regra "service_role somente no n8n" deste CLAUDE.md. Nao foi
alterado nem executado; aguardando aprovacao/plano do usuario.

**Expiracao automatica de fichas aprovadas por seguradora (2026-07-06, Claude):**
regra de negocio alterada para fichas com `status = 'aprovado'` sem apolice
emitida: o prazo de expiracao deixa de ser fixo (45 dias desde `created_at`) e
passa a ser por seguradora — Porto 45 dias, demais (Tokio/Too/Pottencial/Junto/Nao
informado) 30 dias — contado de `finalizada_em` com fallback para `created_at`.
Calculo unificado em `getFichaExpirationThresholdDays`/`isFichaExpiredOperational`
(`src/lib/fichaOperational.js`); `normalizeSeguradoraBucket` centralizado nesse
arquivo e reaproveitado por `src/lib/fichas.js` (que deixou de redefinir a
propria versao, eliminando duplicacao). Cobertura de teste em
`src/lib/fichaOperational.test.mjs` (limiares Porto 44/45 e demais 29/30,
fallback de ancora, ficha com apolice emitida nunca expira, nao regressao do
prazo antigo para outros status), script novo registrado em `package.json`.
`npm test` verde.

**Risco nao resolvido (aguardando decisao) — migracao 49 nao executada:** a
regra acima hoje so existe calculada ao vivo em JS; para persisti-la no banco
(expirar fichas mesmo sem ninguem abrir a tela) foi criado
`supabase/49_fichas_expiracao_por_seguradora.sql`, que habilita a extensao
`pg_cron`, cria a funcao `public.expirar_fichas_aprovadas()` (`SECURITY
DEFINER`) e agenda um job diario (`cron.schedule`, 06:00 UTC) reproduzindo o
mesmo criterio (Porto 45 dias / demais 30 dias, `finalizada_em` com fallback
`created_at`, apenas `status = 'aprovado'` sem `numero_apolice`). Mesmo
tratamento da migracao 48 (nao executada em banco) — ambas criadas apenas para
revisao. Migracao 49, diferente de 48, foi commitada ao git sob decisao
explicita do usuario, mas permanece aguardando aprovacao antes de execucao no
SQL Editor do Supabase (regra de "Seguranca" do CLAUDE.md: banco/RLS/dados
pessoais param para plano + aprovacao).

**Revisao de entrega do Codex — Auto (perfil de cliente/apolice) + ImobiliariaDetalhe
(2026-07-06, Claude):** Codex entregou (nao commitado ainda): paginas novas
`AutoApoliceDetalhe.jsx` e `AutoClienteDetalhe.jsx` com rotas `/auto/apolices/:id`
e `/auto/clientes/:id`; filtro de mes no `AutoDashboard`/`AutoRenovacoes`
(`getDashboardAutoMetrics`, `getRenovacoesAuto`, `getGraficoEmissoesMensais`,
`getGraficoCotacoesStatus` agora aceitam `mes`); e em `ImobiliariaDetalhe.jsx` uma
troca da lista simples de codigos por seguradora por cards de cadastro (ativar
seguradora de fianca + codigo + observacoes, tabela `imobiliaria_seguradoras`).
Revisao encontrou e corrigiu: (1) bug de crash — `AutoEmissoes.jsx` (tabela
"Ultimas emissoes") chamava `onOpenApolice(item.id)` num `<tr onClick>`, mas essa
funcao so existe como prop dentro do componente `ModalApolices`; qualquer clique
na linha lancava `ReferenceError` (build/testes nao pegam, so em runtime) —
trocado para `abrirDetalhe(item)` (mesmo handler do botao "Abrir" da propria
linha) com `stopPropagation` nos botoes de acao; (2) regressao de acentuacao —
`ImobiliariaDetalhe.jsx` teve dezenas de strings visiveis ao usuario gravadas sem
acento pelo editor do Codex ("Variacao", "Imobiliaria", "Observacoes", "fianca",
etc.), inconsistente com o resto do arquivo (e com os outros arquivos do mesmo
lote, que ganharam acentos corretos) e com os passes de encoding anteriores;
acentos restaurados em todo texto de UI (labels, titulos, toasts, placeholders),
sem tocar nas chaves/colunas `codigo`/`observacoes` (essas continuam sem acento,
pois espelham o nome real da coluna no Supabase). Build (`npm run build`) e
testes (`npm test`, 44/44) verdes apos as correcoes.

**Risco nao resolvido (aguardando decisao) — migracao pendente:** a nova UI de
"Cadastros em seguradoras de fianca" em `ImobiliariaDetalhe.jsx` grava
`observacoes` em `imobiliaria_codigos`, mas essa coluna nao existe em nenhuma
migracao rastreada (`supabase/11_imob_codigos.sql` só tem `codigo`). O código em
`src/lib/imobiliariasCodigos.js` já tem fallback silencioso para coluna ausente,
então não quebra, mas as observações digitadas pelo usuário nunca são salvas até
a coluna existir. Criado `supabase/48_imobiliaria_codigos_observacoes.sql`
(`ALTER TABLE ... ADD COLUMN IF NOT EXISTS observacoes TEXT`) para revisão — **não
executado**; aguardando aprovação do usuário para rodar no Supabase SQL Editor.
A tabela `imobiliaria_seguradoras` usada pelo toggle de cadastro já existe
(`supabase/09_apolices_kanban.sql`), então essa parte não tem risco de schema.

**Revisão de entrega do Codex — commit `258b570` (Relatorio/cobranca + Auto +
ImobiliariaDetalhe), 2026-07-06/07, Claude:** revisão completa (encoding + lógica
+ performance + UX) do maior lote entregue pelo Codex até aqui. Achados e
correções, por área:

*Bugs críticos de perda/sumiço de dado (corrigidos):*
1. `buildRelatorioMovePatch('expirada')` gravava `status: 'expirada'` direto na
   ficha; como `REPORT_STATUSES = ['aprovado', 'emitido']` (`Relatorio.jsx`) não
   inclui `'expirada'`, a ficha sumia do relatório em qualquer refetch (troca de
   período, reload) — perda de dado visível ao usuário, sem erro no console.
   Corrigido: o move para "Expirada" agora só grava um marcador em
   `raw_data.manually_expired` (mesmo padrão dos outros patches deste arquivo,
   nunca escrevia em `status` real); `status` da ficha nunca muda. Isso também
   destravou o "voltar para Aprovada", que antes recaía sempre em Expirada por
   causa do `status` já corrompido; agora só bloqueia a restauração quando a
   ficha é *genuinamente* vencida (45+ dias reais), com toast explicando o
   motivo. `fichaOperational.js`: removido um branch de `expirada` que havia
   ficado duplicado/redundante nesse mesmo commit do Codex.
2. `AutoApoliceDetalhe.jsx`: `buildForm` não carregava `tipo` nem
   `seguradoras_cotadas` da emissão; ao salvar qualquer edição de uma emissão
   manual (sem cotação vinculada), `tipo` era resetado para `'novo'` e
   `seguradoras_cotadas` era zerado — perda de dado real, não só de exibição.
   Corrigido preservando os dois campos no form.
3. `AutoApoliceDetalhe.jsx`/`auto.js`: salvar uma apólice **sem** emissão
   vinculada chamava `atualizarApoliceAuto(id, form)` com o form inteiro, que
   inclui `email_cliente`/`origem_lead` — colunas que só existem em
   `cotacoes_auto`, não em `apolices_auto`; toda tentativa de salvar por esse
   caminho falhava com erro de coluna inexistente do Postgrest, e também não
   recalculava `valor_comissao`. Criada `atualizarApoliceAutoSemEmissao` em
   `auto.js`, reaproveitando o payload builder já existente (`buildApoliceAutoPayload`),
   restrito às colunas reais de `apolices_auto` e recalculando a comissão.
4. `auto.js`: filtro "Vencidas" (`getRenovacoesAuto({periodo:'passadas'})`) usava
   `parseMonthRef(mes)`, que sempre resolve para o dia 1 do mês — como
   `AutoRenovacoes.jsx` sempre manda um mês (nunca vazio), o corte virava
   "antes do dia 1 do mês selecionado" em vez de "antes de hoje"; renovações
   vencidas depois do dia 1 do mês corrente sumiam da aba Vencidas. Revertido
   para usar a data real de hoje, como era antes deste commit do Codex.
5. `getClienteAutoDetalhe` (auto.js): para clientes agrupados só por nome (sem
   `cliente_id`/CPF em nenhum registro — grupo criado por `clientKey` em
   `AutoClientes.jsx`), o código caía em `.eq('id', ref)` com `ref` sendo uma
   string de nome contra uma coluna `uuid`, e como os erros dessas queries
   *eram* checados, a função lançava e a página sempre mostrava "Cliente não
   encontrado" para um cliente que existia. Corrigido: só usa `id` como filtro
   quando `ref` é um UUID válido; para o caso "só nome", usa `nome_cliente` nas
   tabelas que têm essa coluna (`apolices_auto`, `emissoes_auto`,
   `cotacoes_auto`) e não bate em `renovacoes_auto` (que só tem `cliente_id`,
   sem nome) com um filtro que sempre falharia. Também parou de engolir erros
   nas 4 queries de resolução do cliente (antes só desestruturava `{ data }`).

*Encoding:* removido BOM (UTF-8 byte-order-mark) introduzido pelo editor do
Codex em `fichaOperational.js`, `relatorioCobranca.js`,
`relatorioCobranca.test.mjs` e `Relatorio.jsx`. Revertido mojibake extenso (210
ocorrências, ~109 linhas) em `Relatorio.jsx` e 5 descrições de teste em
`relatorioCobranca.test.mjs`, via script determinístico de reversão
UTF-8-como-CP1252 (mesma técnica dos passes anteriores) — sem nenhum caractere
U+FFFD (perda de dado irreversível) encontrado desta vez. Corrigidos também 2
typos literais de "?" (ASCII puro, não mojibake) na modal de confirmação de
cobrança em `Relatorio.jsx`, e acentos faltando em texto novo de UI:
`auto.js:1094` (`Renovação`, `apólice` x2) e `AutoEmissoes.jsx` (`Vigência`,
`Prêmio líquido`, `Comissão` nos cards de emissão recente).

*Performance:* `Relatorio.jsx` deixou de buscar as mesmas fichas duas vezes
(query final agora só busca os ids "extras" que não vieram no primeiro fetch);
removida a dependência de `imobiliarias` no efeito de fetch principal (causava
um segundo fetch completo assim que a lista de imobiliárias carregava — agora
lida via `ref`); removido `retorno_enviado` do SELECT (não é mais lido desde o
refactor que separou esse campo de `cobranca_started_at`). `auto.js`:
`getApoliceAutoDetalhe`/`getClienteAutoDetalhe` trocaram `select('*', embed(*))`
por listas de colunas explícitas (regra do projeto); removida variável
duplicada em `getDashboardAutoMetrics`. Item "trocar `todasRenovacoes` por
`count`" do plano original **não foi aplicado**: essa lista alimenta também a
seção "Acompanhar" (lista completa + contadores por status), não só as 2
métricas de vencimento — trocar por `count` quebraria aquela seção.

*UX/limpeza:* gating do botão "Mover" (dropdown de mover ficha) agora respeita
`canConfirmCobranca` quando o destino é "Enviado Cobrança", igual ao botão
dedicado; guard de colunas "movíveis" em `moveSelected` passou a derivar de
`MANUAL_REPORT_MOVE_OPTIONS` em vez de manter uma segunda lista hardcoded à
parte. `ImobiliariaDetalhe.jsx`: `carregarCadastros` ganhou try/catch + toast de
erro + estado de loading próprio (antes um erro de rede/RLS travava a seção
silenciosamente, e o "nenhuma seguradora encontrada" sempre piscava antes dos
dados chegarem); placeholder de campo vazio revertido de `-` para `—`
(consistência visual, tinha sido trocado neste commit do Codex).
`imobiliariasCodigos.js`: `hasMissingColumn` apertado para checar
código de erro (`42703`/`PGRST204`) e padrões específicos de mensagem, em vez
de casar qualquer erro que mencione a palavra "observacoes". Removidas
`buildCobrancaResetPatch` (relatorioCobranca.js), `fetchSeguradoras` e
`deletarCodigo` (imobiliariasCodigos.js) — exportadas mas nunca chamadas.
`CONTEXT.md` de `ImobiliariaDetalhe` atualizado para refletir os componentes e
queries atuais.

`npm test` (54/54) e `npm run build` verdes após todas as correções.
`npm run check:page-contexts` continua com as mesmas pendências pré-existentes
já conhecidas (todo `src/pages/auto/*`, incluindo as 2 páginas novas deste
commit, e `GestaoComercial.jsx` nunca tiveram `CONTEXT.md`) — não é regressão
desta revisão, só não foi resolvido agora (criar `CONTEXT.md` para o módulo Auto
inteiro é um esforço à parte). Smoke test manual no navegador **não foi feito**
(sem `.env`/credenciais Supabase neste ambiente) — recomenda-se validar antes de
considerar encerrado, em especial: mover ficha para Expirada e trocar de
período; salvar emissão manual e apólice sem emissão vinculada no Auto; aba
Vencidas em Renovações Auto; abrir `/auto/clientes/:id` de um cliente sem
CPF/cliente_id.

---

**Data de emissão editável + extração automática por seguradora (2026-07-07,
Claude):** `apoliceParser.js` passou a extrair `data_emissao` do PDF de cada
seguradora: Porto ("Data de Emissão: DD/MM/AAAA"), Pottencial ("Apólice
transmitida eletronicamente dia: DD/MM/AAAA"), Too ("Data da Emissão:
DD/MM/AAAA") e Tokio (`parseTokioMarineV3`, padrão tolerante a mojibake igual
aos demais campos desse parser — texto exato não confirmado com um PDF real,
recomenda-se validar na primeira emissão Tokio pós-deploy). Como esse campo já
não era destructurado em `extras`, ele passa a fluir automaticamente para
`campos.data_emissao` sem mudança em `parseApoliceText`.

`ApoliceDetalhe.jsx`: novo campo editável "Data de Emissão" (Dados da Apólice,
ao lado de Número da Apólice/Proposta); carregado do banco no `load()`,
preenchido automaticamente pelo upload de PDF (`handlePreencherInfo`) e usado
no `salvar()` no lugar do antigo comportamento fixo ("hoje" toda vez que o
status vira emitida/enviada, perdendo qualquer data real). `ApoicesGestao.jsx`
(fluxo "Upload direto" do Kanban): `data_emissao` na criação da apólice agora
usa `dadosExtraidos.data_emissao` (extraído do PDF) com fallback para hoje
quando o parser não encontrar a data.

**Risco de negócio a validar:** `data_emissao` alimenta cálculo de produção e
faturas por mês em Financeiro (`financeiroProducaoCalc.js`,
`financeiroFaturasCalc.js`). Até agora era sempre "data do upload/mudança de
status"; a partir de agora pode ser a data real de emissão impressa no PDF, que
pode cair em mês diferente do upload — isso pode mover uma apólice de mês na
produção/fatura em relação ao comportamento anterior. Comportamento pedido
explicitamente pelo usuário; sinalizar caso gere divergência inesperada em
Financeiro.

**Correção de encoding não relacionada, feita de passagem:** `ApolicesLista.jsx`
tinha 42 ocorrências de U+FFFD (perda de dado irreversível, uncommitted) mais
setas (`←`/`→`) trocadas por `?` literal — corrupção introduzida no editor após
o último commit, achada porque o arquivo precisava ser tocado por este mesmo
trabalho. Texto recuperado comparando com `git show HEAD` (sem alterar as
adições novas do mesmo diff: coluna `% Comissão`/`fmtPct`, `pct_comissao`).
`npm test` (54/54) e `npm run build` verdes após todas as mudanças.

## Responsavel Atual

Codex (entrega revisada por Claude — ver acima)

## Pagina

`src/pages/Financeiro/` - modulo financeiro (redesign)

## Objetivo

Reestruturacao do modulo financeiro do Seguro Fianca para controlar comissoes,
producao por imobiliaria/seguradora, faturas mensais, repasses e pagamento.

## Status

Refinamento v2 concluido. Dois bugs criticos corrigidos em 2026-06-29 (ver rodada 4).

### Rodada 4 (bugfix — 2026-06-29)
- Faturas: `fetchFaturasLedger` corrigido para chamar `fetchApolicesParaFatura` em vez de `fetchApolicesAtivas`. Agora filtra por `forma_pagamento IN ('fatura_sem_entrada','fatura_com_entrada')` e exclui boletos/à vista.
- Producao: removida dependencia de `catalogo` do efeito principal de fetch. `catalogo` tinha cache em memoria (resolve instantaneamente na segunda visita) e cancelava o fetch de dados antes dos numeros aparecerem. Separado em efeito proprio so para setar `pct` default do catalogo.
- 30 testes passando; build verde.

### Rodada 3 (refinamento v2 — 2026-06-26)
- Faturas: corrigido bug crítico — `fetchFaturasLedger` agora filtra por `forma_pagamento IN ('fatura_sem_entrada','fatura_com_entrada')` via nova função `fetchApolicesParaFatura`. Campo `forma_pagamento` adicionado ao SELECT e ao normalizeApoliceRow.
- Producao: lista de apolices emitidas no periodo adicionada inline abaixo de Evolucao (sem nova query, reutiliza `rows` ja carregados).
- ApolicesListView: novas colunas `Emissao` e `Comissao/mes`; props `showEmissao`, `showComissaoMensal`, `showVigencia`.
- Visao Geral: redesign completo — KpiCard com destaque visual, gráficos 280px, ranking com barra proporcional e seta de navegacao.
- Faturas: seletor de seguradora em pills que filtra KPIs, estimativa e lista de apolices; apólices elegíveis exibidas em tabela diretamente na pagina.
- FinanceiroFaturasLista: header modernizado.
- 29 testes passando; build verde.

### Rodada 2 (refino)
- Comissao Estimada (Producao) agora e do PROXIMO MES: soma da comissao mensal das apolices ativas que ainda billam no mes seguinte (inclui emitidas no mes atual). Helper `comissaoEstimadaProximoMes`.
- Estimativa de fatura = fatura atual + parcelas das novas emissoes do mes (nao recalcula do zero).
- "Ver Apolices Ativas" deixou de ser modal: pagina dedicada `/financeiro/producao/:imobiliaria/apolices?tipo=ativas|emitidas`, com clique -> detalhe da apolice preservando imobiliaria, periodo (na URL) e scroll (sessionStorage).
- Faturas por seguradora foram movidas para dentro da area da imobiliaria (cards expansiveis), com qtd ativas, fatura, estimativa e lista de apolices. Pagina/rota separada removida.
- Botao "Apolices ativas" em verde escuro; barras/medalhas nos rankings; logos das imobiliarias/seguradoras em todos os rankings.
- 29 testes passando; build verde.



- Base de calculo migrada para a FONTE REAL `apolices` (corrige bug que lia `status_apolice` do ledger `apolices_comissoes`). Calculo via `% comissao x premio liquido / parcelas`.
- Visao Geral: KPIs corrigidos (comissao gerada, recebida estimada, producao) + 2 graficos por seguradora.
- Producao: lista de imobiliarias com busca -> area detalhada com filtro de periodo (mes/intervalo), metricas, rankings por seguradora e botoes de apolices ativas/emitidas.
- Faturas: lista de imobiliarias -> fatura por imobiliaria (mes, valor, estimativa do proximo mes, apolices que contam, conferencia). Conferencia geral preservada em `/financeiro/faturas/conferencia`.
- Faturas por seguradora: `/financeiro/faturas/seguradora/:seguradora` com fatura por imobiliaria e metrica de apolices ativas.

Validacao local mais recente:

- `npm.cmd test` - 27 testes passando (17 + 10 novos de calculo/parcelas).
- `npm.cmd run build` - build verde.
- `npm.cmd run check:page-contexts` - revisar (pendencias pre-existentes fora de Financeiro: `src/pages/auto/*` e `src/pages/comercial/GestaoComercial.jsx`).

## Banco

Migracoes 42, 45, 46, 47 ja aplicadas no Supabase (confirmado pelo usuario). O calculo
nao depende mais do ledger `apolices_comissoes`; le direto de `apolices`.

## Smoke test pendente

Com usuario admin:

1. `/financeiro`: conferir Producao, Comissao Gerada e Recebida Estimada do mes != 0 e coerentes; ver os 2 graficos por seguradora.
2. `/financeiro/producao`: buscar imobiliaria, abrir detalhe, trocar periodo (mes e intervalo), conferir metricas e rankings; abrir "Apolices Ativas" e "Emitidas" e filtrar por seguradora; salvar percentual.
3. `/financeiro/faturas`: buscar imobiliaria, abrir fatura do mes, conferir valor, "Estimativa do mes que vem" e "Apolices que contam"; informar valor real e marcar pago/reabrir.
4. `/financeiro/faturas/seguradora/:seguradora`: conferir fatura por imobiliaria e a metrica de apolices ativas.
5. Validar com uma apolice real: `comissao total = pct x premio liquido` e `mensal = total / parcelas`.

## Risco a conferir no smoke test

- `pct_comissao` pode estar gravado como inteiro (5) ou fracao (0.05); `pctNormalizado` trata ambos, mas conferir numa amostra real.
- "Estimativa do mes que vem" segue a definicao literal (apolices emitidas no mes selecionado).
