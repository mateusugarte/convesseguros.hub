# TREINAMENTOS — Conteúdo do Produto Fiança

> Rascunho de conteúdo para popular `training_nodes` (ver `TREINAMENTOS_ARQUITETURA.md`).
> **Nenhum código, SQL ou migration foi criado.** Este arquivo é só o conteúdo organizado,
> aguardando aprovação antes de qualquer implementação.

## Fontes lidas

| Seguradora | Documentos |
|---|---|
| **Porto Seguros** | `PORTO SEGUROS.pdf` — Manual do Corretor (Fiança Locatícia + Fiança Locatícia Essencial), operacional + condições gerais |
| **Pottencial** | `POTTENCIAL.pdf` — Condições Gerais; `GUIA POTTENCIAL.pdf` — guia comercial/operacional do Portal do Parceiro |
| **Too Seguros** | `TOO SEGUROS.pdf` — Condições Gerais; `manual de produtos-too.pdf` — Manual do Corretor (cadastro, coberturas, contratação, endosso, sinistro, anexos) |
| **Tokio Marine** | `TOKIO MARINE.pdf` — Condições Gerais; `analise cadastral tokio.pdf` — FAQ do Corretor (produto, análise cadastral, cadastro, processo, renovação, cancelamento, pagamento, sinistro, indenização, comissão) |
| **Conves (interno)** | `GUIAS CONVES/` — Checklist de abertura de sinistro, passo a passo de abertura de sinistro por seguradora (Porto/Pottencial/Too), prioridades no acompanhamento de sinistro |
| **Junto Seguros** | ⚠️ **Nenhum arquivo encontrado na pasta.** Todas as lições abaixo estão marcadas `[Junto: sem fonte]` até o PDF ser disponibilizado. |

Tipo de documento por seguradora (relevante para entender assimetria de conteúdo operacional):
- **Porto**: Manual do Corretor — mistura regras + telas/caminhos do sistema (COL).
- **Too**: Manual de Produtos — mistura regras + processos do Portal do Parceiro (mais operacional que a CG pura).
- **Tokio Marine**: FAQ do Corretor — perguntas e respostas práticas, cobre bastante operacional do Portal Imobiliário/Nosso Corretor.
- **Pottencial**: Guia Prático — focado no Portal do Parceiro, com telas passo a passo.
- Todas as 4 têm também a Condição Geral pura (documento regulatório SUSEP).

---

## SETOR: SEGUROS NOVOS

### MÓDULO 1 — Fichas Cadastrais

#### Lição: O que é o Seguro Fiança
**tipo_conteudo:** conceitual

**conteudo_geral:**
O Seguro Fiança Locatícia é uma das garantias locatícias previstas na Lei do Inquilinato (Lei 8.245/91, art. 37) que o locador pode exigir do locatário para assinar um contrato de aluguel. Ele **substitui o fiador tradicional**: em vez de uma pessoa física assumir a dívida em caso de inadimplência, uma seguradora assume essa responsabilidade, mediante o pagamento de um prêmio (valor do seguro) pago pelo locatário.

Na prática: se o inquilino não paga o aluguel (e os encargos que tiverem sido contratados), a seguradora indeniza o proprietário dentro dos limites contratados na apólice — e depois cobra essa dívida do inquilino inadimplente, através do que se chama **direito de regresso / sub-rogação**.

**Quem é quem:**
- **Segurado = Locador** (proprietário do imóvel) — é quem recebe a indenização em caso de sinistro.
- **Garantido = Locatário** (inquilino) — é quem paga o prêmio do seguro e é o responsável pelo pagamento do aluguel; pode ser Pessoa Física ou Jurídica.
- **Estipulante** — normalmente a imobiliária/administradora, que intermedia a contratação, pode concentrar cobrança e repasse de valores, e em alguns casos recebe diretamente a indenização/restituição.
- **Corretor de Seguros** — intermediário que comercializa o produto e presta atendimento a todas as partes.

**Outras garantias locatícias previstas na mesma lei (o que o Fiança substitui/concorre):**
- **Fiador**: pessoa física/jurídica que assume a dívida — processo mais lento (exige análise do fiador, geralmente imóvel próprio quitado) e constrangedor para o inquilino conseguir.
- **Caução**: depósito em conta poupança, equivalente a até 3 meses de aluguel — imobiliza recursos do próprio inquilino.
- **Título de Capitalização**: valor retido, normalmente equivalente a 12 meses de aluguel.
- **Carta Fiança Bancária**: um banco assume a responsabilidade; cobertura geralmente de até 12x o aluguel+encargos.

**Por que o Fiança costuma ser vantajoso frente às demais opções:** agilidade na contratação, não exige imobilização de recursos do inquilino, não compromete o crédito bancário dele, e a cobertura pode ser bem mais ampla (18x a 30x o aluguel, dependendo da seguradora/plano) — em várias seguradoras inclui ainda assistência jurídica gratuita ao proprietário.

⚠️ **Atenção — Seguradora vs. Garantidora:** existem no mercado produtos parecidos oferecidos por **Garantidoras**, que não são seguradoras e **não são reguladas pela SUSEP**. Uma garantidora oferece cobertura mais limitada (só o valor previamente garantido) e, em caso de sinistro, costuma se retirar do risco assim que a ação de despejo é ajuizada — diferente de uma seguradora, que continua indenizando mensalmente até a desocupação do imóvel ou o esgotamento da verba contratada na apólice. É importante deixar claro ao cliente que o Fiança Locatícia trabalhado pela Conves é sempre com **seguradoras reguladas pela SUSEP** (Porto, Pottencial, Too, Tokio Marine, Junto), não garantidoras.
*Fonte: Lei 8.245/91; Porto Seguros (Manual do Corretor, Cap.1); Pottencial (Guia Prático — "O que é Garantia Locatícia" e "Diferença entre Seguradora e Garantidora"); Too Seguros (Manual de Produtos, intro); Tokio Marine (FAQ 1.1–1.3).*

#### Lição: Como apresentar o produto (argumentos de venda)
**tipo_conteudo:** conceitual

**conteudo_geral:**
Ao apresentar o Fiança Locatícia, adapte o discurso conforme quem está do outro lado:

**Para o Locador (proprietário):**
- Garantia de recebimento do aluguel em dia, mesmo com inadimplência do inquilino.
- Suporte/assessoria jurídica gratuita até a retomada do imóvel (cobranças extrajudiciais, ação de despejo).
- Cobertura pode ir além do aluguel: encargos legais (água, luz, gás, condomínio, IPTU), danos ao imóvel, multa rescisória, pintura.
- Contratação com biometria facial reduz o risco de fraude no processo.

**Para o Locatário (inquilino):**
- Elimina o constrangimento de precisar conseguir um fiador.
- Contratação ágil e simples, sem depender da análise de terceiros (fiador).
- O valor do seguro pode ser parcelado, muitas vezes dentro do próprio boleto do aluguel.
- Não exige imobilização de capital do próprio bolso (diferente da caução, que trava um valor alto do inquilino).

**Para a Imobiliária:**
- Processo de contratação simplificado e mais rápido que as alternativas (fiador, caução).
- Pode atuar como Estipulante, concentrando a cobrança de vários contratos em uma única fatura.
- Recebe a indenização/restituição diretamente quando é a Estipulante vinculada à apólice.
- Uma cobertura mais ampla reforça a credibilidade da imobiliária perante o proprietário.

*Fonte: Pottencial, Guia Prático — "Personas Envolvidas" (4.1) e "Argumentos de Vendas" (4.2). Conteúdo de caráter comercial/genérico, aplicável independentemente da seguradora escolhida.*

#### Lição: Critérios de análise / comprometimento de renda
**tipo_conteudo:** conceitual

**conteudo_geral:** A análise cadastral avalia a capacidade financeira do pretendente a locatário através do comprometimento de renda (% do aluguel+encargos sobre a renda comprovada).

**variacoes_por_seguradora:**
- **Tokio Marine**: PF residencial até 35% da renda; PF não residencial até 20%; PJ — Serviços 15%, Comércio 7%, Indústria 5% (faturamento médio mensal).
- **Too Seguros**: PF residencial até 35% (Locação de Terceiros/Familiares limitada a 15%); PF não residencial até 20%; PJ — Indústria 5%, Comércio 7%, Serviços 10%.
- **Porto / Pottencial**: percentuais de comprometimento de renda não constam explicitamente nas Condições Gerais lidas — critério tratado como política comercial interna, não regulatória.
- **[Junto: sem fonte]**

⚠️ Variação relevante: Tokio permite até 15% de comprometimento para PJ prestadora de serviços; a Too permite só até 10% no mesmo segmento — a Tokio é mais permissiva nesse ponto.

#### Lição: Como preencher a ficha cadastral no Conves Hub
**tipo_conteudo:** operacional

**conteudo_geral:**
No Conves Hub, abrir uma ficha cadastral é **só preencher um formulário — nenhum documento é anexado nesta etapa**. Os campos a preencher dependem do produto selecionado:

**Campos comuns a todos os produtos:**
- *Identificação*: Produto (Residencial PF / Comercial PF / Pessoa Jurídica), Imobiliária vinculada, Nome do Interessado (PF) ou Nome da Empresa (PJ), CPF (PF) ou CNPJ + CPF dos sócios (PJ).
- *Contato*: Celular, E-mail.
- *Dados do Imóvel*: Tipo do imóvel, CEP, valores de Aluguel/IPTU/Condomínio, Orçamentista responsável, Observações.

**Campos adicionais — apenas para Comercial PF e Pessoa Jurídica** (Dados Complementares / Dados da Empresa):
- Atividade, Total de Rendimentos, Capital Social, Motivo da Locação, Vigência.
- **Opção Tributária** (Simples / Presumido / Real / MEI) — exclusivo de Pessoa Jurídica.

**Campos preenchidos ao longo do processo (não na abertura da ficha):**
- *Financeiro da Ficha*: % de comissão padrão, % de desconto, parcelamento.
- *Cotação por seguradora*: status, valor da parcela, % de desconto, quantidade de parcelas, % de comissão.
- *Controle Interno*: status da ficha (pendente, em cotação, em análise, aprovado, recusado, emitido, cancelado, CPF inválido, expirada), seguradora escolhida, se o retorno já foi enviado.

*Fonte: código-fonte do Conves Hub — `ModalFicha.jsx` e schema `fichas` no Supabase.*

#### Lição: Quando documentos são solicitados
**tipo_conteudo:** conceitual

**conteudo_geral:**
Preencher e enviar a ficha cadastral **não exige nenhum documento**. Documento só entra em cena depois, em duas situações:

1. **A seguradora sinaliza análise manual/interna** — quando o parecer automático não é suficiente (ficha fica "em análise", "pendência" ou equivalente), a seguradora pode pedir comprovantes específicos, que variam por vínculo do pretendente (CLT, autônomo, aposentado, funcionário público, PJ) e por seguradora — ver quadro abaixo.
2. **A seguradora aprova mas exige documentação para emissão** (ex.: contrato de locação assinado, no caso da Too) — nesse momento o documento é anexado num módulo próprio do Hub, vinculado à ficha, e não dentro do formulário de cadastro.

**Quais documentos cada seguradora costuma pedir quando entra em análise manual** *(referência — só usar quando a seguradora explicitamente solicitar; não anexar nada por padrão):*
- **Tokio Marine**: CLT/autônomo/empresário/estudante/liberal — RG + extratos bancários 3 meses ou holerites 3 meses; aposentado — RG + extrato INSS; funcionário público — RG + último holerite; expatriado — RG + declaração do RH. PJ (CNPJ com +2 anos): documentação por regime tributário (Lucro Real: balanços 3 exercícios + balancete; Presumido: EFD Contribuições 3 meses; Simples: PGDAS-D). CNPJ com menos de 2 anos deve ser tratado como PF não residencial via CPF dos sócios.
- **Too Seguros**: CLT/servidor — 3 últimos holerites + carteira profissional; funcionário público estatutário — 3 holerites; autônomo/liberal/empresário/microempresário — extratos bancários 3 meses; aposentado — extrato INSS + extratos bancários. PJ (+2 anos): CPF/RG de sócios + IR + documentação por regime (Lucro Real: balanços 2 exercícios extraídos da ECD + balancete; Presumido: ECF 2 exercícios + DARFs Cofins 6 meses + EFD Contribuições; Simples: PGDAS-D 6 meses; empresas sem fins lucrativos: estatuto social + balanços). PF não residencial (empresa há menos de 2 anos): documentos pessoais dos sócios + comprovação de capital (extrato de investimento/aplicação — bens móveis/imóveis não decorrentes da atividade NÃO são aceitos).
- **Porto**: coleta residencial/comercial/PJ conforme fluxo do PAC (Processo de Análise Cadastral), com documentos equivalentes (identificação + renda); detalhamento fino de tipo de vínculo não constava no Manual do Corretor lido no mesmo nível de granularidade da Too/Tokio.
- **Pottencial**: CG não detalha lista de documentos por vínculo empregatício (mais genérico).
- **[Junto: sem fonte]**

#### Lição: Como efetuar uma análise residencial PF (sistema SEGIMOB)
**tipo_conteudo:** operacional

**conteudo_geral:**
Para as análises **residenciais PF**, a Conves não entra diretamente no portal de cada seguradora — utiliza o **SEGIMOB**, um sistema que concentra a solicitação de fiança locatícia de várias seguradoras em um único fluxo.

**Caminho no sistema:**
1. Abrir a SEGIMOB.
2. **Seguros Imobiliários → Fiança Locatícia → Solicitar Seguro.**
3. Em Estipulante, selecionar **Estipulante = Imobiliária**.
4. Preencher as demais informações — usando exatamente os dados já coletados na ficha do Conves Hub (não é necessário levantar nada além do que já está na ficha; não anexar documento nesta etapa, salvo se o próprio SEGIMOB/seguradora sinalizar a necessidade).

*Fonte: processo interno Conves.*

⚠️ Este fluxo (SEGIMOB) vale para **análises residenciais PF**. Para casos fora desse escopo (Pessoa Jurídica, comercial), ou para entender o que acontece "por trás" em cada seguradora, veja a lição seguinte.

#### Lição: Como cada seguradora processa a análise por trás (referência / casos fora do fluxo padrão)
**tipo_conteudo:** operacional

**variacoes_por_seguradora:**
- **Tokio Marine**: Portal (Nosso Corretor / Imobiliário) → Fiança Locatícia → Cadastro Pretendente → escolher PF/PJ Residencial/Não Residencial → preencher Dados Básicos → aceitar "Li e Concordo" → preencher ficha simples de cada pretendente → Avançar → sistema indica se precisa de ficha completa + documentos → upload → Avançar (envio automático para Análise Cadastral). Extensões aceitas: PDF, JPG, JPEG, PNG, BMP, MSG — até 10MB por arquivo. Análise automática: tempo real; manual PF: 3h úteis; reanálise PF: 24h úteis; manual/reanálise PJ: 24h úteis. Documentos só valem se enviados pelo fluxo do Cotador — **e-mail e Jira não são considerados**.
- **Too Seguros**: envio de documentos via Portal do Parceiro, no fluxo do cotador. Validade do cadastro aprovado: 30 dias corridos. Prazo de análise/reanálise conta a partir do recebimento em horário comercial (9h-18h; após 18h conta no próximo dia útil). Substituição/inclusão/exclusão de locatário em apólice vigente exige nova análise cadastral completa + nova apólice.
- **Pottencial**: cotação via Portal do Parceiro (Home → Produtos → Aluguel → Nova Cotação); opção de incluir ou não Estipulante logo no início; sistema retorna em segundos "pré-aprovado" (com limite), "em análise" ou "recusado" (com carta de recusa + opção de reanálise); é possível incluir locatário(s) solidário(s) para aumentar o limite pré-aprovado.
- **Porto**: fluxo próprio do COL (Esteira Digital / PAC) — Processo de Análise Cadastral, com pareceres automáticos e possibilidade de reanálise.
- **[Junto: sem fonte]**

#### Lição: Solicitação e regras de biometria facial
**tipo_conteudo:** conceitual (com trecho operacional)

**conteudo_geral:** Biometria facial é etapa de segurança pós pré-aprovação de crédito, exigida apenas do locatário/pretendente principal antes da emissão.

**variacoes_por_seguradora:**
- **Too Seguros**: biometria inicia após a pré-aprovação de crédito. Link disponibilizado no PDF da cotação, com validade de 30 dias a contar da pré-aprovação. Pareceres possíveis: Aprovado, Recusado, Expirado por ausência de biometria (exige nova ficha). Passo a passo do titular: acessar "Para Você → Biometria Facial" no site, digitar CPF, aceitar termos, escolher imobiliária/cotação, permitir câmera/GPS, remover óculos/bonés, enquadrar rosto — até 3 tentativas.
- **Pottencial**: dois formatos de link — Link Dedicado (copiado da tela "Minhas Solicitações" no Portal do Parceiro, atrelado à cotação) ou Link Genérico (site institucional, inserindo o CPF). Deve ser feita apenas pelo locatário principal.
- **Porto**: regras de biometria facial próprias do processo PAC/Essencial, já detalhadas no relatório inicial.
- **Tokio Marine**: não há menção a exigência de biometria facial na documentação lida (FAQ e CG) — possivelmente o produto não usa essa etapa, ou não estava documentado no material disponível.
- **[Junto: sem fonte]**

#### Lição: Eventualidades (ficha em nome de 2 pessoas etc.)
**tipo_conteudo:** conceitual

**conteudo_geral:** Composição de renda: mais de uma pessoa pode compor renda para aumentar o limite de aprovação; todos os participantes devem constar no contrato de locação como locatários solidários.

**variacoes_por_seguradora:**
- **Tokio Marine**: composição permitida para PF residencial e não residencial (todos assinam como locatários solidários); **não permitida** para locações em nome de PJ.
- **Too Seguros**: composição permitida para PF residencial e não residencial (todos os sócios/futuros sócios); **não é válida para análise de PJ**.
- **Pottencial**: locatário(s) solidário(s) podem ser adicionados diretamente na tela de cotação para aumentar o limite pré-aprovado — se um solidário for recusado, isso **não** penaliza a aprovação do locatário principal (só gera carta de recusa do solidário).
- **Porto / Junto**: [conteúdo já coberto / sem fonte, ver relatório inicial para Porto].

#### Lição: Como enviar documentos (quando solicitados pela seguradora)
**tipo_conteudo:** operacional

**conteudo_geral:** Quando a seguradora pede documentos, o envio deve ocorrer exclusivamente pelos canais oficiais dela (Portal do Parceiro / Cotador) — anexos por e-mail, WhatsApp ou outros canais não são considerados válidos para análise cadastral.
*Fonte: Tokio Marine (explícito: "nenhum documento enviado por e-mail ou Jira será considerado"); Too Seguros (fluxo via Portal do Parceiro).*

#### Lição: Como retornar para quem solicitou a ficha
**tipo_conteudo:** operacional

**variacoes_por_seguradora:**
- **Porto**: carta de parecer (aprovação/recusa) é gerada no sistema e pode ser baixada e enviada à imobiliária.
- **Tokio Marine / Too**: pareceres (pré-aprovado, recusado, em análise, expirado) ficam disponíveis no Portal, com carta de recusa/parecer para download.
- **Pottencial**: carta de recusa disponível para download diretamente na tela de resultado da análise.

---

### MÓDULO 2 — Emissão de Apólices

#### Lição: O que é a Emissão de Apólice
**tipo_conteudo:** conceitual

**conteudo_geral:**
A emissão de apólice é o momento em que o seguro **passa a existir de fato**. Até aqui, o que existia era só uma ficha cadastral aprovada — ainda não há um seguro válido, é apenas uma análise de crédito favorável ao pretendente. A emissão é a etapa em que:

1. Confirmamos as coberturas que serão contratadas (aluguel + quais encargos/adicionais).
2. Confirmamos a forma de pagamento e o parcelamento.
3. Conferimos se o contrato de locação está com as cláusulas obrigatórias da seguradora escolhida (ou se um aditivo será usado).
4. Transmitimos a proposta para a seguradora.

A seguradora responde com um **parecer de emissão** (aprovado / pendência / expirado); se aprovado, ela gera a **apólice** — o documento oficial que prova a existência e as condições do seguro contratado (coberturas, limites, vigência, seguradora, segurado, garantido).

A apólice é o documento central que a imobiliária e o proprietário devem guardar, e é **exigida em qualquer sinistro** posterior — por isso é fundamental garantir, nesta etapa, que os dados da apólice batem exatamente com os do contrato de locação (nomes, valores, datas, endereço). Divergência entre o contrato e a apólice pode gerar **perda de cobertura** no futuro.

⚠️ **Por enquanto, a SEGIMOB não cobre a emissão** — mesmo para as análises residenciais PF feitas por lá, a emissão da apólice continua sendo feita diretamente no sistema nativo de cada seguradora (ver lição "Como emitir uma apólice (por seguradora, telas e caminhos)", logo abaixo). A Conves já sabe que a SEGIMOB vai passar a cobrir a emissão também em uma fase futura — mas isso ainda não está em uso, então não deve ser ensinado como fluxo atual.

*Fonte: síntese das seções "Contratação do Seguro" (Porto, Too, Tokio Marine, Pottencial) + regra de perda de cobertura por divergência (Tokio Marine).*

#### Lição: Regras de emissão de apólices
**tipo_conteudo:** conceitual

**conteudo_geral:** Emissão só ocorre após aprovação cadastral (e biometria, quando exigida) e transmissão da proposta pelo corretor/imobiliária.

**variacoes_por_seguradora:**
- **Tokio Marine**: contratação via Cotador (3 passos: Dados da locação → tipo de assistência/forma de pagamento → Complemento com dados do segurado/garantidos → transmissão). Duas formas de venda: **faturada** (via imobiliária parceira cadastrada) ou **individual** (direto com proprietário ou imobiliária não cadastrada).
- **Too Seguros**: proposta só deve ser transmitida com o Contrato de Locação já elaborado com as cláusulas específicas Too, assinado (firma reconhecida ou certificação digital). Contrato pode ser exigido a qualquer momento e obrigatoriamente no sinistro.
- **Porto / Pottencial**: fluxos próprios já descritos.

#### Lição: Cláusulas das seguradoras + palavras-chave para leitura rápida
**tipo_conteudo:** conceitual

**conteudo_geral:** Contratos de locação precisam conter as cláusulas obrigatórias específicas da seguradora contratada (referentes a cada cobertura ativada).

**variacoes_por_seguradora:**
- **Too Seguros**: Anexo III do Manual traz o texto pronto das cláusulas — obrigatória sempre a cláusula-base do seguro (item 1) e, condicionalmente: Danos ao Imóvel (item 2), Pintura Interna (item 3), Pintura Externa (item 4), Danos aos Móveis (item 5) — cada uma exige que o LOCATÁRIO declare recebimento do imóvel/pintura/móveis em determinado estado (vistoria) e se comprometa a devolver da mesma forma.
- **Tokio Marine**: cláusulas obrigatórias descritas no "Anexo I do Manual do Corretor"; pode-se optar por "contrato padrão" (envelope eletrônico assinado por todas as partes em até 10 dias) ou usar contrato próprio + aditivo com as cláusulas Tokio.
- **Porto**: Anexo I do Manual traz as Cláusulas 1-4, já detalhadas no relatório inicial.
- **[Junto: sem fonte]**

**Palavra-chave por seguradora (para leitura rápida do contrato):** verificar sempre presença de cláusula de "pintura NOVA" (se contratada Pintura), "estado de conservação identificado em vistoria" (se Danos ao Imóvel/Móveis), e nome da seguradora vinculada explicitamente ao seguro fiança contratado.

#### Lição: O que NÃO pode ter no contrato
**tipo_conteudo:** conceitual

**variacoes_por_seguradora:**
- **Tokio Marine**: não têm aceitação no Fiança — locação **BTS/Built to Suit** (garantia mista obra+locação) e **Cessão de Direitos** (não amparada pela Lei do Inquilinato); locações com prazo inferior a 6 meses, imóvel de veraneio/temporada.
- Contrato de locação divergente do contrato de seguro (nomes, valores, datas) pode gerar **perda de cobertura** — regra citada pela Tokio Marine, mas princípio válido para todas.

#### Lição: O que DEVE ter no contrato de locação e como localizar
**tipo_conteudo:** conceitual

**conteudo_geral:** Cláusulas obrigatórias da seguradora (ver lição acima); identificação completa de locador(es), locatário(s), testemunhas e, se PJ, representante legal — todos precisam também constar no contrato de seguro. Se optar por adendo/aditivo em vez de reescrever o contrato, o aditivo deve conter dados do locador/locatário, endereço do risco e cláusulas conforme coberturas contratadas.
*Fonte: Tokio Marine item 4.4; Too Seguros item 5.2/Anexo III.*

#### Lição: Regras eventuais (mais de um locatário)
**tipo_conteudo:** conceitual

**conteudo_geral:** Locatários múltiplos (solidários) devem todos assinar o contrato de locação; a apólice mantém, em regra, um único "locador/segurado" principal — quando há mais de um locador, é possível dividir o pagamento da indenização **apenas em débitos finais** (imóvel já desocupado), desde que todos os locadores constem corretamente no contrato com firma reconhecida.
*Fonte: Tokio Marine item 11.8 (indenização c/ múltiplos locadores).*

#### Lição: Como emitir uma apólice (por seguradora, telas e caminhos)
**tipo_conteudo:** operacional

**variacoes_por_seguradora:**
- **Tokio Marine**: com contrato padrão — partes recebem envelope eletrônico por e-mail, assinam em até 10 dias corridos (senão a proposta expira e precisa reiniciar o processo); erro na entrega do envelope gera notificação ao corretor, com 3 dias úteis para corrigir dados e novo prazo de 10 dias para reenvio, ou o envelope é cancelado. Sem contrato padrão — proposta é transmitida e o contrato assinado (com as cláusulas obrigatórias) só é exigido no sinistro.
- **Too Seguros**: emissão condicionada ao envio prévio do contrato já assinado com as cláusulas Too (ou aditivo).
- **Pottencial**: emissão via Portal do Parceiro — preencher vigência do contrato/seguro, selecionar coberturas e múltiplos (Plano Tradicional) ou múltiplo único (Taxa Fixa), revisar comissão, escolher forma de pagamento (boleto ou fatura, se houver estipulante), aceitar termos e transmitir — **biometria aprovada é pré-requisito para o botão "Transmitir Proposta" ficar habilitado**.
- **Porto**: fluxo já descrito no relatório inicial (Cotador + pareceres de emissão).

#### Lição: Como saber se a apólice emitiu de verdade
**tipo_conteudo:** operacional

**variacoes_por_seguradora:**
- **Tokio Marine**: parecer "Documento emitido" = risco aceito, apólice emitida; parecer "Pendência" exige regularização; "Expirado" exige nova aprovação de crédito e nova proposta.
- **Pottencial**: após transmissão, sistema retorna número da proposta + PDF para download; apólice e boletos passam a constar no menu "Apólices" do Portal.
- **Too Seguros**: consulta pelo caminho Home Logada → Apólices/Endossos no Portal do Parceiro.

#### Lição: Como retornar a apólice para a imobiliária via email
**tipo_conteudo:** operacional
*(sem detalhamento adicional além do já levantado no relatório inicial — Porto é a fonte mais explícita sobre esse fluxo).*

---

### MÓDULO 3 — Coberturas e Garantias

#### Lição: O que são as Coberturas do Fiança
**tipo_conteudo:** conceitual

**conteudo_geral:**
"Cobertura" é cada tipo de prejuízo que a seguradora se compromete a pagar caso o inquilino fique inadimplente. Toda apólice de Fiança tem uma **cobertura básica obrigatória** (o aluguel em si) e pode ter **coberturas adicionais**, contratadas mediante prêmio extra, conforme o que o proprietário/imobiliária quiser proteger no contrato de locação. Quanto mais coberturas contratadas, maior o prêmio mensal — mas também maior a segurança do proprietário (é um ponto forte na hora de vender o produto: "o Fiança protege bem mais que só o aluguel").

Toda cobertura tem um **limite máximo de indenização** (quanto a seguradora paga, no máximo, naquela cobertura) — ver lição "Limites máximos" abaixo.

#### Lição: Coberturas básicas do seguro
**tipo_conteudo:** conceitual

**conteudo_geral:** A cobertura básica obrigatória é o **Não Pagamento de Aluguéis** — garante ao locador o pagamento dos aluguéis conforme contrato, incluindo multa por atraso limitada a 10% do valor do aluguel, além de custos judiciais e honorários advocatícios da ação de despejo.
*Fonte: Porto p.26 (5.1); Pottencial Cláusula 4.1.1; Too item 5.1.1; Tokio Marine item 5.1 — convergente nas 4.*

#### Lição: Coberturas adicionais
**tipo_conteudo:** conceitual

**conteudo_geral:** Todas as seguradoras oferecem, mediante prêmio adicional: Encargos Legais (IPTU, condomínio, água, luz, gás canalizado), Danos ao Imóvel, Multa por Rescisão Contratual, Pintura Interna e Pintura Externa.

**variacoes_por_seguradora:**
- **Porto**: agrupa Encargos Legais em um único item (não vende IPTU separado de condomínio); não tem "Danos a Móveis" nem "13º aluguel"/"Fundo Promocional"/"Ar Condicionado".
- **Pottencial**: única a cobrir também o **prêmio do seguro incêndio** quando embutido no boleto do aluguel, dentro de Encargos Legais; tem coberturas exclusivas para shopping center: **Ar Condicionado** e **Fundo de Promoção**. Não tem "Danos a Móveis" nem "13º aluguel".
- **Too**: tem **Danos a Móveis** e **Fundo Promocional** (shopping center); não tem "13º aluguel" nem "Ar Condicionado".
- **Tokio Marine**: mais granular — separa **IPTU** de **Condomínio**; junta Água+Luz+Gás numa única cobertura; tem **Danos a Móveis**, **13º Aluguel** (cobertura adicional paga, exclusiva shopping center) e **Fundo de Promoção**.
- **[Junto: sem fonte]**

⚠️ Variação relevante: Pottencial trata o 13º aluguel como **incluído automaticamente na cobertura básica** para shopping centers (sem custo extra); a Tokio Marine trata como **cobertura adicional paga**. Porto e Too não mencionam 13º aluguel.

#### Lição: Limites máximos (LMG e LMI)
**tipo_conteudo:** conceitual

**conteudo_geral:** Toda apólice tem um **Limite Máximo de Garantia (LMG)** — teto global da apólice — e **Limites Máximos de Indenização (LMI)** por cobertura individual. O valor pago em sinistro é sempre deduzido do limite da cobertura afetada; ao esgotar o limite, a cobertura cessa automaticamente.
*Fonte: Porto Cap.6/7; Pottencial 1.3; Too itens 7-8.*

**variacoes_por_seguradora:**
- **Porto** (única com tabelas numéricas fixas): faixas por soma de aluguel+IPTU+condomínio — até R$25k → até 30x a verba; R$25-30k → 20x; R$30-40k → 15x; R$40-50k → 12x; acima de R$50k → análise da Cia. Demais coberturas: água/luz/gás até 6x; danos ao imóvel até 6 aluguéis; multa rescisória até 3 aluguéis; pintura até 3 aluguéis. Fiança Locatícia Essencial: planos 12/20/30 com taxas 10%/12%/14% a.m.
- **Pottencial / Too / Tokio Marine**: não trazem tabelas numéricas fixas de limite por faixa nas condições gerais — o limite é definido caso a caso na proposta/apólice.
- **Tokio Marine** (limites padrão, produto tradicional, locações residenciais até R$20 mil/mês): Aluguel/IPTU/Condomínio até 30x; Contas de consumo/Danos ao imóvel até 6x; Pintura interna/externa/Multa rescisória até 3x. Também oferece o **LMI Flex**, que permite personalizar o limite de Aluguel/Condomínio/IPTU em troca de ajuste no custo do prêmio (2 a 4 opções por perfil).

#### Lição: Assistência 24 horas
**tipo_conteudo:** conceitual (com trecho operacional — acionamento)

**conteudo_geral:** Assistência 24h é um benefício de conveniência (não indenizatório) que dá acesso a prestadores de serviço para pequenos imprevistos no imóvel (chaveiro, eletricista, encanador etc.), sem custo adicional para quem aciona, respeitando limites de valor e de quantidade de utilizações por ano.

**variacoes_por_seguradora:**
- **Tokio Marine**: 3 planos — Básico, Intermediário, Completo. Serviços: chaveiro, mão de obra hidráulica, desentupimento de esgoto/caixa de gordura, mão de obra elétrica, vidraceiro, inspeção domiciliar (Intermediário/Completo), conserto de eletrodomésticos/eletroeletrônicos (Completo), sustentabilidade (consultoria + descarte). Carência de 30 dias após contratação; garantia de mão de obra de 90 dias. Apólices PF residencial podem contratar qualquer pacote; PF não residencial e PJ só Sem Assistência ou Básica.
- **Too Seguros**: dois planos — **Básica** (4 serviços: Chaveiro, Eletricista, Encanador, Vidraceiro) e **Completa** (25 serviços, incluindo os da básica + Desentupimento de esgoto/caixa de gordura, Limpeza da residência, Vigia, Mudança/Guarda de móveis, Cobertura provisória de telhados, Fixação de antenas, Baby-sitter, Serviço doméstico provisório, Hospedagem, Restaurante/Lavanderia, Guarda de animais, Retorno antecipado, Recuperação de veículo, Remoção inter-hospitalar, Dedetização, Substituição de telhas, Inspeção domiciliar/Serviço de instalação, e Help Desk para computador/smartphone/periféricos). Vinculada ao sub-produto contratado — **Fiança 10** tem Assistência Jurídica como benefício automático; **Aluguel Garantido** oferece "serviços residencial completo tanto para o Inquilino quanto para o Proprietário". Acionamento via 0800 775 9191 ou WhatsApp (11) 99400-3326; emergenciais 24h (prestador em até 90 min), não emergenciais em horário comercial agendado; primeiro acionamento exige aguardar 48h da contratação.
- **Porto**: tem um capítulo "Guia de serviços de assistência ao imóvel" mas remete a link externo, sem detalhar os serviços no próprio manual.
- **Pottencial**: não menciona assistência 24h nas Condições Gerais lidas.
- **[Junto: sem fonte]**

#### Lição: Sorteio (benefício exclusivo)
**tipo_conteudo:** conceitual

**variacoes_por_seguradora:**
- **Porto** (exclusivo Fiança Locatícia Essencial): inquilino principal recebe número da sorte para concorrer a sorteio anual da Porto Seguro Capitalização, premiação bruta de R$ 200 mil (dedução de 25% de IR).
- **Pottencial / Too / Tokio Marine**: não têm benefício equivalente descrito.

#### Lição: Limites de contratação e comissão — Too Seguros (complemento)
**tipo_conteudo:** conceitual

**conteudo_geral:** A Too tem dois sub-produtos de Fiança com limites e comissões distintos:
- **Fiança 10** (PF, locação residencial, aluguel+encargos até R$20 mil): taxa fixa mensal de 10%; aluguel obrigatório até 18x limitado ao LMG; encargos opcionais até 2x; danos/pintura/multa até 3x; comissão fixa **15%**; assistência jurídica automática.
- **Aluguel Garantido** (PF ou PJ, residencial e comercial, aluguel+encargos até R$25 mil): aluguel obrigatório até 30x; encargos/danos até 6x; multa/pintura até 3x; danos a móveis até 1x (limitado a R$5 mil); comissão **10% a 40%**; precificação variável por perfil.

Isso é uma variação relevante frente à Porto (10-35% dependendo do plano/UF) e à Tokio Marine (até 35% máximo, sem produto de taxa fixa equivalente ao Fiança 10).

---

### MÓDULO NOVO — Transferência de Corretagem

#### Lição: O que é Transferência de Corretagem
**tipo_conteudo:** conceitual

**conteudo_geral:**
Transferência de corretagem é a troca do corretor (ou da corretora/imobiliária) vinculado a uma apólice já existente, sem mexer nas condições do seguro em si (coberturas, limites, vigência continuam os mesmos) — só muda quem intermedia/recebe a comissão daquele contrato. É comum acontecer quando um cliente muda de corretor de confiança, ou quando a imobiliária centraliza a carteira de contratos em uma nova corretora.

#### Lição: Tipos de transferência e como solicitar
**tipo_conteudo:** conceitual (com trechos operacionais)

**variacoes_por_seguradora:**
- **Porto** (única fonte com detalhamento completo):
  - **Transferência de apólice individual**: locador e locatário assinam (procuração se houver representante legal).
  - **Transferência de carteira do corretor**: todos os sócios da corretora cedente e da nova corretora assinam.
  - **Transferência de carteira da imobiliária**: assina o representante legal da imobiliária.
  - Solicitação via Esteira Digital no COL; documento enviado por Clicksign; 5 dias para assinatura; conclusão em até 24h após assinatura. A troca de corretor só é efetivada no momento da renovação.
  - **Transferência de corretagem de PAC** (antes da emissão, fora da Nova Jornada): formulário assinado pelo pretendente + reanálise do PAC com carta de transferência anexada.
  - **Transferência de corretagem de orçamento** (Nova Jornada): busca por número do orçamento ou CPF do locatário → clique em "Transferir orçamento" → corretor detentor é notificado por e-mail.
- **Too Seguros**: transferência de corretagem só pode ser feita **no momento da renovação da apólice** (não durante a vigência). Para acionar, corretor precisa contatar o suporte via chat/WhatsApp — a proposta de renovação é então carregada no Portal Parceiro para o novo corretor.
- **Tokio Marine**: mesma regra — "É possível realizar transferência do corretagem no meio da vigência? **Não**." Só no momento da renovação; corretor deve acionar o suporte para transferência manual/renovação manual.
- **Pottencial**: não descreve processo de transferência de corretagem nas Condições Gerais (fora do escopo regulatório desse documento).
- **[Junto: sem fonte]**

---

## SETOR: RENOVAÇÕES → MÓDULO: Vigência e Renovação do Seguro

#### Lição: O que é a Vigência e por que a Renovação existe
**tipo_conteudo:** conceitual

**conteudo_geral:**
A vigência é o período em que o seguro está ativo — em geral, ela acompanha a vigência do próprio contrato de locação (o seguro "nasce e morre" junto com o aluguel que ele garante). Quando o contrato de locação chega perto do fim (e o inquilino continua no imóvel), é preciso **renovar** o seguro para que a cobertura não seja interrompida. A renovação é, na prática, uma pequena reanálise: a seguradora confirma se o risco continua aceitável (às vezes reavaliando o cadastro) e gera uma nova vigência, geralmente com os valores de aluguel/encargos atualizados.

Renovar em dia é importante porque, se o prazo passar do limite tolerado por cada seguradora, o processo deixa de ser "renovação" e vira **contratação de um seguro novo** — com nova análise cadastral completa, o que atrasa a proteção do proprietário.

#### Lição: Vigência do seguro
**tipo_conteudo:** conceitual

**conteudo_geral:** A vigência do seguro geralmente coincide com a vigência do contrato de locação. Início: data do protocolo da proposta ou data de início do contrato de locação (se posterior). Fim: data de término do contrato de locação. Limite legal: **5 anos** (Circular 671 SUSEP).
*Fonte: Pottencial 6.1; Too item 11; Tokio Marine item 11; Porto 8.2/9.2.*

**variacoes_por_seguradora:**
- **Porto** (Fiança Locatícia tradicional): vigência final = mesma data final do contrato de locação, respeitando prazo máximo de 5 anos.
- **Porto** (Fiança Locatícia Essencial): início = data de emissão da apólice; fim = data de reajuste do contrato ou data final (mín. 6 meses, máx. 5 anos).
- **Tokio Marine**: renovação automática do contrato de locação por prazo indeterminado → apólice renovada por prazo entre locador/locatário, limitado a 5 anos, com possibilidade de renovações posteriores. Contrato novo → início/fim = início/fim do contrato de locação; contrato em vigor → início = data da transmissão da proposta, fim = fim do contrato. Locação com prazo <30 meses vira **indeterminada** automaticamente ao fim do prazo (retomada só via Denúncia Cheia/Motivada); locação ≥30 meses termina automaticamente ao fim do prazo, sem necessidade de aviso.
- **Too Seguros**: vigência = data de transmissão da proposta OU data de início do contrato de locação (o que for mais tardio), respeitando o máximo de 5 anos.
- **Pottencial**: se contrato de locação passa a vigorar por prazo indeterminado, fica a critério da seguradora aceitar a renovação (vigências passam a ser anuais).
- **[Junto: sem fonte]**

#### Lição: Renovação do seguro
**tipo_conteudo:** conceitual

**conteudo_geral:** Renovação tem caráter obrigatório para o locatário conforme Lei do Inquilinato (salvo anuência do locador em não renovar). Em geral, não é automática — requer análise de risco e nova proposta, com solicitação feita com antecedência mínima antes do fim de vigência.
*Fonte: Porto Cap.10; Pottencial 6.2; Too item 12; Tokio Marine item 12.*

**variacoes_por_seguradora (prazo mínimo de solicitação):**
- **Porto**: renovação transmitida até 5 dias úteis após o fim da vigência → não precisa novo cadastro, início = data do fim da apólice anterior; entre 6-30 dias corridos → não precisa novo cadastro, início = data da transmissão; após 30 dias corridos → precisa novo cadastro, tratado como novo seguro. RS (Renovação Simplificada) disponível 60 dias antes do fim da vigência.
- **Pottencial**: solicitar até o 30º dia corrido a contar do fim da vigência; após esse prazo, seguradora pode exigir novos documentos.
- **Too Seguros**: solicitar com no mínimo 30 dias de antecedência ao término da vigência; renovação **nunca é automática**, sempre depende de análise de risco e aceitação de nova proposta; lote de renovação fica disponível no Portal por 30 dias antes do vencimento; se houver sinistro ativo no momento da renovação, ela se torna **facultativa** e deve ser feita em até 15 dias após o encerramento do sinistro; após o fim da vigência, a Too concede 30 dias corridos para transmitir a proposta de renovação — não há alerta automático, o corretor precisa checar a aba "Renovação" no Portal.
- **Tokio Marine**: mesma regra de 30 dias mínimos de antecedência; renovação também depende sempre de análise de risco e aceitação de nova proposta; permitida em até 30 dias após o vencimento (fora isso, tratar como Seguro Novo para Locações em Vigor); lote de renovação processado com 30 dias de antecedência; é possível transferir o lote de renovação até o 1º dia útil do mês anterior; se contrato padrão foi usado na contratação original, **não é necessária nova assinatura eletrônica na renovação**; é possível renovar trazendo apólice de outra seguradora, desde que o contrato seja aditado com as cláusulas obrigatórias Tokio.
- **[Junto: sem fonte]**

⚠️ Porto tem regra própria de "liberalidade" — variação de até 10% no valor de aluguel/encargos sem necessidade de revisão cadastral. Porto e Pottencial também detalham regras específicas de renovação **com expectativa de sinistro** (aluguel até certo valor + LMI mínimo → renovação sem nova análise se houver acordo formalizado); Too e Tokio Marine não trazem esse nível de detalhe nas condições gerais lidas — a Tokio remete a uma regra específica no seu próprio Manual do Corretor (não disponível nas fontes lidas).

---

## SETOR: ENDOSSO → MÓDULO: Endosso da Apólice

#### Lição: O que é um Endosso
**tipo_conteudo:** conceitual

**conteudo_geral:**
Endosso é o documento que a seguradora emite **durante a vigência** de uma apólice já ativa para formalizar qualquer alteração nela — sem precisar cancelar e emitir um seguro novo do zero. Serve para corrigir dados (endereço, cadastro), ajustar coberturas, ou registrar mudanças acordadas entre as partes. Alguns tipos de endosso são simples (só atualização de dados, sem análise) e outros exigem nova análise de crédito (quando a alteração aumenta o risco da seguradora, como aumento de valor de aluguel ou troca de inquilino).
*Fonte: Porto Cap.11; Pottencial Cláusula 7 ("Endosso") — conceito convergente entre as seguradoras.*

#### Lição: Tipos de endosso permitidos e não permitidos
**tipo_conteudo:** conceitual (com trecho operacional)

**variacoes_por_seguradora:**
- **Porto** (mais detalhada): tipos de endosso — com condição obrigatória de aprovação cadastral (aumento de valores, troca de inquilino PF, alteração de razão social PJ, exige novo PAC); cancelamento; alteração de proprietário (só se parcelas quitadas); inclusão de cobertura de danos ao imóvel (exige laudo de vistoria atual); inclusão/exclusão de coberturas; prorrogação de vigência; alterações genéricas. Prazo de análise: até 15 dias corridos.
- **Pottencial**: toda alteração previamente estabelecida no contrato de locação deve ser acompanhada por endosso; alterações que aumentem o risco podem exigir novos documentos e prêmio adicional.
- **Too Seguros**: endosso é documento formal de alteração durante a vigência. Exigem **nova análise de crédito**: aumento de valores, alteração de garantidos PF, alteração de CEP, alteração de razão social PJ. Endosso de correção de endereço (sem mudar CEP)/dados cadastrais/índice de reajuste: só exige e-mail com proposta de endosso preenchida e assinada (`suporte.fianca@tooseguros.com.br`). Inclusão de cobertura de Danos ao Imóvel em locação em vigor: exige nova análise de crédito + laudo de vistoria atual. Endosso para alteração do segurado (locador): exige nova análise + orçamento novo no Portal + nova proposta.
- **Tokio Marine**: hoje disponibiliza apenas 3 tipos de endosso — **correção de endereço**, **correção de dados cadastrais** e **alteração de coberturas**. **Não existe** endosso para trocar o locador (orientação: ajustar o contrato de locação e alterar na renovação) nem para trocar/incluir/excluir locatário (exige nova contratação completa).
- **[Junto: sem fonte]**

---

## SETOR: SINISTROS → MÓDULO: Sinistro

#### Lição: O que é um Sinistro no Fiança
**tipo_conteudo:** conceitual

**conteudo_geral:**
No seguro Fiança, "sinistro" é o nome técnico para a situação em que o inquilino não paga o aluguel (ou os encargos contratados) e essa inadimplência se confirma. Diferente de outros seguros (onde sinistro é um evento pontual, como um acidente), no Fiança o sinistro é um **processo que se desenrola ao longo do tempo**: começa com a primeira inadimplência, passa por uma fase de acompanhamento (chamada "expectativa de sinistro"), e só é formalmente "caracterizado" quando ocorre a decretação de despejo, o abandono do imóvel, ou a entrega amigável das chaves. A partir daí, a seguradora começa a indenizar o proprietário mensalmente (adiantamentos), respeitando os limites contratados na apólice, até a desocupação do imóvel ou o esgotamento da verba.

#### Lição: Expectativa de sinistro
**tipo_conteudo:** conceitual

**conteudo_geral:** Período entre o 1º aluguel/encargo não pago e a caracterização do sinistro. Segurado deve comunicar a inadimplência à seguradora, em geral após o vencimento do 2º aluguel não pago, sob pena de perda de direito à indenização por omissão.
*Fonte: Porto item 12.4 (comunicação após 2º aluguel vencido); Pottencial Cláusula 10; Too item 15.1; Tokio Marine itens 15/16/18.*

⚠️ **Tokio Marine** tem regra própria: se o aviso/documentação do sinistro só chegar após o vencimento do **3º aluguel**, o período indenizável começa a contar da data do aviso, e os prejuízos anteriores ficam por conta do segurado como "participação obrigatória". Essa regra de "3º aluguel" não aparece nas outras 3 seguradoras.

#### Lição: Caracterização do sinistro
**tipo_conteudo:** conceitual

**conteudo_geral:** Sinistro se caracteriza por: (a) decretação de despejo, (b) abandono do imóvel, ou (c) entrega amigável das chaves. A data do sinistro retroage à data do início da expectativa de sinistro (1ª inadimplência). **Conteúdo idêntico nas 4 seguradoras.**

#### Lição: Adiantamentos
**tipo_conteudo:** conceitual

**conteudo_geral:** A seguradora se obriga a adiantar valores de aluguel/encargos vencidos e não pagos antes mesmo da desocupação, respeitando o limite máximo de responsabilidade. Primeiro adiantamento em até 30 dias após comprovação de ajuizamento da ação/imissão na posse/entrega de chaves; demais adiantamentos sucessivos.
*Fonte: Porto Cláusula 13; Pottencial Cláusula 13; Too item 16; Tokio Marine item 18. Convergente nas 4.*

#### Lição: Reintegração do limite (LMG)
**tipo_conteudo:** conceitual

**variacoes_por_seguradora:**
- **Porto**: permite reintegração do LMG quando o cliente formaliza acordo e quita integralmente os débitos (reintegração automática só na quitação total do acordo, não parcela a parcela). Se o LMG se esgota completamente, a apólice é cancelada e não há reintegração — exige nova análise cadastral e nova apólice.
- **Pottencial / Too / Tokio Marine**: declaram explicitamente que **não há reintegração de limites máximos de indenização** quando da ocorrência de sinistro — sem a exceção de acordo quitado que a Porto prevê.

#### Lição: Cancelamento da apólice por sinistro
**tipo_conteudo:** conceitual

**variacoes_por_seguradora:**
- **Porto** (única detalhada): após indenização, a apólice é cancelada e há devolução proporcional do prêmio (quando aplicável); se a restituição for maior que os débitos do inquilino, o excedente é devolvido a ele.
- Demais seguradoras não trazem esse detalhamento de compensação entre restituição e débito do sinistro nas fontes lidas.

#### Lição: Como abrir sinistro — passo a passo por seguradora (operacional)
**tipo_conteudo:** operacional
**Fonte: GUIAS CONVES (passo a passo interno Conves) + Manual de Produtos Too.**

- **Porto**: Menu → Sinistro → Aviso de sinistro → Abrir → informar nº da apólice → selecionar tipo do produto (746/004 Essencial ou 746/000 Tradicional) → Pesquisar → conferir dados com o contrato de locação → clicar na setinha "comunicar sinistro" → preencher dados do solicitante (usar e-mail fictício no campo "timeline" para evitar duplicidade de e-mails) → preencher dados do locatário (usar dados da declaração de débitos da imobiliária) → informar se o imóvel está ocupado/desocupado (se desocupado, sempre marcar "entrega amigável" + data de entrega das chaves) → Avançar → Aceitar e continuar → relacionar os débitos copiando da declaração de débitos enviada pela imobiliária → Avançar → incluir novo favorecido (dados bancários da imobiliária, conforme declaração de débitos) → Avançar → anexar documentos obrigatórios já salvos na pasta do inquilino → qualificar documentos → Avançar → conferir tudo e **Comunicar Sinistro** → Confirmar → baixar o "espelho" e salvar na pasta do inquilino → responder ao e-mail da imobiliária: "Sinistro aberto hoje, prazo de análise 30 dias" → atualizar planilha de controle de sinistro.
  - ⚠️ Observações internas: sempre usar o **maior índice de reajuste** disponível para o débito de aluguel; relacionar débito por débito exatamente como consta na declaração de débitos — se o total calculado pelo sistema não bater com a declaração, não é problema, desde que os lançamentos estejam corretos.
- **Pottencial**: site da Pottencial → Página inicial → Mais → Sinistro → Registrar comunicado de sinistro → informar nº da apólice → conferir dados e avançar → em "Detalhes do ocorrido" assinalar sim/não conforme o caso → inserir observações relevantes (ex.: débitos de aluguel e encargos) → informar a primeira data de inadimplência (calendário) → preencher a Declaração de Débitos linha a linha (usar "adicionar item" para mais linhas) → inserir dados bancários do favorecido (conforme declaração de débitos) → Avançar → preencher dados de contato do locatário/locador/imobiliária → Avançar → anexar documentos obrigatórios → Avançar.
- **Too Seguros**: Fiança → Sinistro → Avisar Sinistro → digitar nº da apólice → conferir dados com o contrato de locação → OK → preencher dados de contato → continuar → informar data da ocorrência do sinistro (primeiro mês de atraso, conforme declaração de débitos) → informar ocupado/desocupado (se desocupado, incluir data de entrega das chaves) → selecionar as coberturas solicitadas na declaração de débitos → se for fatura imobiliária, marcar "incluir seguro fiança" e informar o valor total das parcelas inadimplentes → informar quantidade de aluguéis em atraso, conferindo com o valor puxado automaticamente pelo sistema (corrigir se divergir da declaração de débitos) → marcar "Deseja aplicar multa" (sim) e somar o valor total das multas → Continuar → anexar todos os documentos obrigatórios (se faltar algum, marcar o campo em vermelho e continuar mesmo assim — anexar depois quando a imobiliária enviar) → preencher dados bancários → Continuar → conferir tudo e **Abrir aviso de sinistro** → anotar o nº do protocolo na planilha → voltar para Sinistros e conferir na primeira linha se é o processo correto → baixar o resumo de sinistro e enviar para a imobiliária, em resposta ao e-mail de solicitação.
- **Tokio Marine**: aviso pelo Portal do Corretor ou Contact Center — imediatamente após desocupação (imóvel desocupado) ou imediatamente após o 2º mês de inadimplência (imóvel ocupado); após a comunicação, enviar documentos pelo Portal; primeiro adiantamento/liquidação em até 30 dias após o recebimento de toda a documentação.
- **[Junto: sem fonte]**

#### Lição: Boas práticas de acompanhamento de sinistro (operacional, interno Conves)
**tipo_conteudo:** operacional
**Fonte: GUIAS CONVES — "Prioridades sinistro fiança".**

- Tentar abrir o sinistro no mesmo dia da solicitação, ou no máximo no dia seguinte, salvando todos os documentos na pasta do sinistro na rede.
- Antes de abrir sinistro, checar na planilha se já não existe sinistro aberto **em acordo** para aquele inquilino; se houver, localizar o e-mail do acordo (pasta do inquilino ou "itens enviados" do Outlook) e responder ao jurídico informando quebra de acordo, anexando o boleto no e-mail e no sistema.
- Manter a planilha de controle de sinistro atualizada a cada movimentação (abertura, pagamento, quitação, acordo, observações relevantes); pintar de vermelho os casos de quebra de acordo.
- Enviar as planilhas de programação de pagamento às imobiliárias assim que recebidas; se a imobiliária questionar uma indenização, encaminhar a dúvida ao analista responsável e aguardar retorno antes de responder.
- Canal de acompanhamento por seguradora: **Porto** — pelo próprio sistema; **Tokio** — pelo próprio sistema; **Too** — WhatsApp (chat) + e-mail ao analista responsável; **Pottencial** — responder ao e-mail do analista que enviou a planilha e registrar mensagem também no sistema.
- Todo e-mail vindo do jurídico (confirmação de valores, procuração, formalização de acordo, andamento da ação de despejo) deve ser encaminhado à imobiliária; e-mails de formalização de acordo devem ser salvos na pasta do inquilino na rede.
- A maioria das ligações das seguradoras é para cobrança de documentos pendentes — o prazo de 30 dias de análise só começa a contar a partir do envio dos documentos que estavam pendentes.

#### Lição: Documentos necessários — resumo consolidado (Conves)
**tipo_conteudo:** conceitual
**Fonte: GUIAS CONVES — "Checklist Sinistro" (aplicável a todas as seguradoras).**

- **Imóvel ocupado**: Contrato de Locação; Contrato de Administração; Declaração de Débitos; recibos em aberto (água, luz, gás, condomínio, aluguel); carnê/espelho do IPTU do ano vigente (quantidade de parcelas e cota do mês). Abertura obrigatória imediatamente após o 2º mês de inadimplência do aluguel.
- **Imóvel desocupado**: Contrato de Locação + Administração; Declaração de Débitos Finais; recibos em aberto (água, luz, gás, condomínio, aluguel); carnê/espelho do IPTU do ano vigente; Vistoria Inicial e Final assinadas por ambas as partes (na ausência da assinatura do locatário, aceita-se a assinatura de 2 testemunhas); se houver reclamação de Danos/Pintura — 2 orçamentos detalhando material e mão de obra. Abertura obrigatória imediatamente após a saída do locatário do imóvel.
- **Prazos gerais**: após abertura + envio de todos os documentos, a seguradora tem até **30 dias corridos** para analisar e indenizar. Em caso de pendência documental, a seguradora reabre um novo prazo de 30 dias a contar do envio da documentação pendente. Contas de consumo (água/luz/gás) só são indenizadas ao final da locação, junto aos débitos finais.

#### Lição: Documentos necessários — detalhamento por seguradora (complemento)
**variacoes_por_seguradora:**
- **Tokio Marine**: imóvel ocupado exige adicionalmente cópia de RG/CPF/CNPJ do segurado **e** comprovante de endereço, além de RG/CPF/CNPJ do(s) inquilino(s); imóvel desocupado exige recibo de entrega de chaves + laudos de vistoria + pelo menos 2 orçamentos detalhados dos prejuízos.
- **Too Seguros**: imóvel ocupado exige Procuração AD JUDICIA (para constituir advogados que ingressarão com ação de despejo); imóvel desocupado exige termo de entrega de chaves com testemunhas qualificadas (nome, CPF, RG, endereço) na ausência do garantido; se houver reclamação de pintura, também exige a **metragem do imóvel**.
- **Pottencial**: fluxo de preenchimento da Declaração de Débitos dentro do próprio sistema de sinistro (não como anexo separado).

#### Lição: Análise, prazo e reembolso de prêmio (complemento)
**variacoes_por_seguradora:**
- **Too Seguros**: prazo de conclusão da análise em até 30 dias corridos a contar da apresentação do último documento obrigatório; análise complementar (reanálise/contestação/boleto com variação mensal) em até 15 dias corridos; juros de mora de 12% ao ano a partir do 31º dia sem indenização. **Reembolso de prêmio mensal na indenização**: só ocorre se o prêmio for da própria apólice sinistrada, pago na fatura em 10x ou mais (ou parcelamento máximo permitido), cobrado no mesmo boleto do aluguel, acompanhando a cobertura de aluguel — não há reembolso em pagamento por boleto avulso, e só é pago à imobiliária vinculada à fatura (não ao segurado). **P.O.S. (Participação Obrigatória do Segurado)**: 20% da indenização em Danos aos Móveis (mínimo R$300) e em Danos ao Imóvel (mínimo R$200) — reclamações abaixo desses mínimos não geram indenização.
- **Tokio Marine**: reembolso de prêmio análogo — só para apólices faturadas com sinistro, deduzido do limite máximo de responsabilidade da cobertura de aluguel; **não se aplica** se a renovação da apólice sinistrada ocorrer sem seguir as regras específicas de renovação com expectativa de sinistro.

#### Lição: Descumprimento de acordo (Too Seguros)
**tipo_conteudo:** conceitual

**conteudo_geral:** Quando o garantido formaliza acordo com a assessoria jurídica, o aluguel volta a ser recebido pela imobiliária e o sinistro fica suspenso — o acordo tem duas obrigações paralelas: pagar as parcelas do prêmio na assessoria E pagar o aluguel/encargos na administradora. Se o garantido descumprir qualquer uma das duas, é caracterizado descumprimento de acordo, peticionado na ação de despejo. Se o descumprimento for na administradora (aluguel/encargos), o corretor deve comunicar em até **15 dias do vencimento do débito** — sob pena de perder a indenização das multas subsequentes ao atraso na comunicação. Comunicação exclusivamente via Portal Parceiro, com envio obrigatório do boleto pendente.
*Fonte: Too Seguros, Manual de Produtos item 9.3 — regra específica da Too, não encontrada nas demais.*

---

## SETOR: CANCELAMENTOS → MÓDULO: Cancelamento e Rescisão por Falta de Pagamento

#### Lição: O que é Cancelamento e Rescisão por Falta de Pagamento
**tipo_conteudo:** conceitual

**conteudo_geral:**
Cancelamento é o encerramento da apólice antes do fim natural da vigência. Existem, basicamente, dois grandes motivos:
1. **A pedido** — o contrato de locação terminou (entrega das chaves, distrato) ou houve troca de garantia; nesse caso, se houver prêmio pago a mais, ele é devolvido de forma proporcional ao tempo que faltava (usando a **Tabela de Prazo Curto** de cada seguradora).
2. **Por falta de pagamento** — o locatário não paga o prêmio do seguro; a seguradora reduz a vigência da apólice proporcionalmente ao que foi pago (também pela Tabela de Prazo Curto) e, se não regularizado, cancela definitivamente.

Entender essa distinção é importante porque muda o documento a apresentar e o cálculo de eventual restituição.

#### Lição: Cancelamento a pedido (Segurado/Locador)
**tipo_conteudo:** conceitual

**conteudo_geral:** Cancelamento por iniciativa do segurado em caso de rescisão do contrato de locação (com termo de entrega de chaves + declaração de inexistência de débitos/danos) → devolução do prêmio proporcional ao tempo decorrido, excluído o IOF. Cancelamento por outros motivos → segue a **Tabela de Prazo Curto** da respectiva seguradora.
*Fonte: Porto Cap.11.2/15; Pottencial Cláusula 15; Too item 19; Tokio Marine item 21.*

Todas as 4 seguradoras têm sua própria Tabela de Prazo Curto (relação % do prêmio pago × dias de vigência mantida) — os percentuais são aproximadamente equivalentes entre elas, mas cada uma publica sua própria tabela oficial (a **Tokio Marine e a Too** têm tabelas mais granulares, com % por cada dia individual de 0 a 365; **Porto e Pottencial** usam degraus a cada 15 dias).

#### Lição: Cancelamento por iniciativa da seguradora / rescisão por falta de pagamento
**tipo_conteudo:** conceitual

**conteudo_geral:** Falta de pagamento da 1ª parcela ou prêmio à vista → cancelamento desde o início da vigência. Falta de parcela subsequente → ajuste do prazo de vigência conforme a Tabela de Prazo Curto (vigência reduzida proporcionalmente ao valor pago), com possibilidade de restabelecimento se o pagamento for regularizado dentro do novo prazo ajustado.
*Fonte: Porto Cap.9 (item 8.5, obrigações de pagamento); Pottencial Cláusula 9 e 16; Too item 12 (Pagamento de Prêmios) e item 20; Tokio Marine item 14 e 22.*

⚠️ Variação: o prazo de comunicação/tolerância antes do cancelamento por inadimplência é de **10 dias corridos** na Porto e na Too (aviso de inadimplência + prazo de regularização); Pottencial e Tokio Marine não estipulam esse prazo fixo de aviso prévio nas condições gerais (o cancelamento ocorre ao fim do prazo de vigência ajustado pela Tabela de Prazo Curto, embora exijam "comunicação prévia" ao segurado, sem prazo específico).

#### Lição: Documentos necessários por motivo de cancelamento (complemento)
**variacoes_por_seguradora:**
- **Too Seguros**: solicitação até 60 dias após entrega das chaves é aceita sem documentos (mas devem ser guardados por até 5 anos, podendo ser exigidos a qualquer momento pela seguradora ou órgão regulador); após 60 dias, exige documentos formais conforme o motivo: **Entrega de chaves/Rescisão** → termo de entrega/rescisão com firma reconhecida ou assinatura digital certificada + declaração de inexistência de débitos; **Desistência da locação** → termo de desistência (locatário não ocupou o imóvel) + declaração de inexistência de débitos; **Troca de garantia** → aditivo ao contrato informando a nova garantia + declaração de inexistência de débitos. Assinaturas digitais só são aceitas com certificação digital válida (ID com nome, e-mail, empresa emissora, número serial e validade) — **não são aceitos documentos sem certificação digital**. Restituição (boleto): creditada na conta bancária do locatário (ou do pagador, se diferente, mediante análise) em até 10 dias após a emissão do endosso de cancelamento; cancelamentos até o 5º dia útil do mês podem gerar reemissão de fatura.
- **Tokio Marine**: 3 tipos de cancelamento — **Extinção do risco/troca de garantia** (documento comprobatório + devolução conforme Tabela de Prazo Curto), **Arrependimento** (até 7 dias da contratação, devolução integral com IOF), **Erros cadastrais na proposta** (acionar a Sucursal; valores retidos aproveitados na nova emissão). Restituição: se pagamento faturado, crédito na próxima fatura da imobiliária; demais formas, restituição ao inquilino — exceto se o prêmio foi pago pelo segurado (deve avisar a seguradora antes do cancelamento).

#### Lição: Cancelamento por confissão de dívidas / sinistro (Too Seguros)
**tipo_conteudo:** operacional

**conteudo_geral:** Em caso de cancelamento por confissão de dívidas, o corretor deve primeiro avisar o sinistro no Portal Parceiro para acompanhamento — a solicitação de cancelamento nesses casos é feita pelo próprio time de sinistro, não diretamente pelo corretor.
*Fonte: Too Seguros, Manual de Produtos item 8.5/9.5.*

---

## SETOR: COBRANÇA → MÓDULO: Pagamento de Prêmio

#### Lição: O que é o Prêmio e a Cobrança
**tipo_conteudo:** conceitual

**conteudo_geral:**
"Prêmio" é o nome técnico do valor pago pelo seguro (não confundir com "prêmio" de sorteio) — é o que o locatário (ou, em alguns casos, o proprietário) paga mensalmente à seguradora para manter a apólice ativa. Diferente do aluguel, o prêmio **não é devolvido** ao final do contrato — é o custo de ter a proteção durante a vigência.

A cobrança pode ser feita de formas diferentes conforme a seguradora e o arranjo comercial: cobrança individual (boleto, cartão, débito no nome do locatário) ou cobrança faturada (a imobiliária concentra vários seguros em uma única fatura mensal, repassando depois cada valor à seguradora). Entender qual modelo está em uso importa porque muda quem recebe a restituição em caso de cancelamento e como funciona o reembolso de prêmio em caso de sinistro (ver módulo Sinistro).

#### Lição: Formas de pagamento
**tipo_conteudo:** conceitual (com forte componente operacional/comercial)

**conteudo_geral:** Prêmio é pago pelo garantido (locatário) à seguradora e não é devolvido ao final da vigência. Data limite de pagamento não pode ultrapassar 30 dias da emissão da apólice/fatura/aditivo/endosso.
*Fonte: Porto item 8.5; Pottencial Cláusula 9; Too item 12; Tokio Marine item 14.*

**variacoes_por_seguradora:**
- **Porto** (única com tabela comercial completa): ADC (até 12x), Boleto (à vista, desconto 10%), Carnê (até 12x, desconto 10% até 4x), Cartão de Crédito (até 10x com desconto, 11-60x sem desconto), Fatura Mensal com/sem entrada (exclusiva p/ imobiliárias cadastradas como estipulantes).
- **Too Seguros**: **Fiança 10** — à vista ou mensal (até 30x); **Aluguel Garantido** — 20% desconto à vista, 10% desconto parcelado em 4x, ou mensal (até 60x). Só é permitido pagamento pelo cartão/débito do próprio locatário/pretendente principal — não de terceiros.
- **Tokio Marine**: **Venda faturada** — ficha faturada até 60x sem juros (dentro da vigência, até 60 meses); **Venda individual** — cartão até 60x sem juros, débito até 12x sem juros (até R$10 mil, acima disso conforme vigência), boleto 4x sem juros ou até 12x com juros. Limite de cobrança em cartão: R$50.000. Fluxo de faturamento: corte 18 dias antes do vencimento → geração do lote 8 dias antes (corretor tem 3 dias para criticar/ajustar) → fechamento do lote 5 dias antes, boleto disponibilizado à imobiliária → pagamento → remuneração da imobiliária em 2 dias úteis após confirmação. Se inadimplência no cartão: 1º um boleto é enviado por e-mail; se não pago, apólice entra em proporcionalidade e depois é cancelada.
- **Pottencial**: não detalha modalidades comerciais de pagamento (parcelamento, descontos, cartão recorrente) nas fontes lidas — trata apenas de obrigações genéricas (quem paga, prazo, consequência da falta de pagamento).

#### Lição: Comissionamento
**tipo_conteudo:** conceitual

**variacoes_por_seguradora:**
- **Porto**: comissão de 10% a 35% (produto tradicional), com tabela de código de operação por faixa e por estado (RJ e RS têm códigos próprios); comissão do Plano Básico: 10% a 20%; comissão do Fiança Locatícia Essencial: fixa em 10%.
- **Too Seguros**: comissão paga mediante quitação da(s) parcela(s) do prêmio; demonstrativo enviado toda segunda-feira, desde que acumulado mínimo de R$100. Fiança 10: comissão fixa de 15%. Aluguel Garantido: 10% a 40% (variável).
- **Tokio Marine**: antecipação de comissão disponível para vendas individuais parceladas (até 4x boleto, 6x débito, 12x cartão); pagamento por esgotamento (valor antecipado limitado ao prêmio líquido da 1ª parcela; diferença é creditada da 2ª parcela em diante); **não se aplica** a vendas faturadas; comissão máxima do produto: **35%**; **sem co-corretagem**.
- **Pottencial / [Junto: sem fonte]**: Pottencial permite que segurado/garantido solicitem a qualquer momento o percentual de comissão aplicado, mas não publica faixas de comissão nas Condições Gerais (informação comercial, não fica em CG regulatória).

#### Lição: Inadimplência e proporcionalidade (complemento)
**variacoes_por_seguradora:**
- **Too Seguros**: corretor recebe notificação por e-mail (`cobranca@tooseguros.com.br`) e deve avisar imediatamente o locador; se não regularizado, a Too envia aviso formal de inadimplência (10 dias corridos para regularização) ao segurado e ao inquilino — se faturado, também à imobiliária; se regularizado (com juros), o prazo original é restabelecido; se não regularizado, a apólice é cancelada ou tem a vigência reduzida conforme a Tabela de Prazo Curto (Anexo I do Manual — tabela dia a dia de 1 a 365 dias, com % de prêmio retido crescente).
- **Tokio Marine**: apólice entra em "proporcionalidade" e depois é cancelada por falta de pagamento, independente da forma de pagamento.

---

## GLOSSÁRIO TÉCNICO — resumo transversal (complementado)

- **Segurado (Locador)** / **Garantido (Locatário)**: partes cobertas pelo contrato de locação.
- **Estipulante**: normalmente a imobiliária, que contrata/administra o seguro em nome de terceiros; pode receber a indenização/restituição diretamente quando vinculada à fatura.
- **Parecer de crédito**: resultado da análise cadastral — Pré-Aprovado, Recusado (com/sem possibilidade de reanálise), Em Análise/Pendência, Expirado.
- **P.O.S. (Participação Obrigatória do Segurado)**: percentual/valor mínimo descontado da indenização em certas coberturas (ex.: Danos aos Móveis e Danos ao Imóvel na Too — 20%, com mínimo de R$300 e R$200 respectivamente).
- **LMG (Limite Máximo de Garantia)**: teto de indenização da apólice como um todo.
- **LMI (Limite Máximo de Indenização)**: teto de indenização por cobertura individual; a Tokio Marine também oferece o **LMI Flex**, que permite personalizar o limite de Aluguel/Condomínio/IPTU trocando cobertura por custo do prêmio.
- **Tabela de Prazo Curto**: tabela usada para calcular devolução de prêmio proporcional em cancelamento ou ajuste de vigência por falta de pagamento — cada seguradora publica a sua (a Tokio Marine e a Too têm tabelas dia a dia, de 1 a 365 dias).
- **Endosso/Aditivo**: documento que formaliza qualquer alteração na apólice durante a vigência; tipos permitidos variam por seguradora (ver módulo Endosso).
- **Sub-rogação / Direito de Regresso**: direito da seguradora de cobrar do locatário inadimplente após indenizar o locador — a Tokio Marine detalha esse processo como "direito de regresso", incluindo a possibilidade histórica (até maio/2025) de cobrança direto no cartão de crédito do garantido.
- **Análise Automática vs. Manual** (Tokio Marine): automática = resposta em tempo real via bureaus de crédito (Serasa, Receita Federal, Portais de Transparência); manual = mix de verificação documental + entrevista telefônica quando necessário.
- **PGDAS-D, ECD, ECF, EFD Contribuições**: documentos fiscais usados na análise cadastral de Pessoa Jurídica, variando conforme o regime tributário (Simples, Lucro Presumido, Lucro Real).

---

## O que ainda falta / gaps conhecidos

1. **Junto Seguros**: nenhum documento foi encontrado na pasta `info.docs/condicoes-gerais/seguro-fianca`. Todas as lições deste arquivo estão com `[Junto: sem fonte]` — pendente de material antes de qualquer preenchimento.
2. **Pottencial**: Condições Gerais + Guia Prático cobrem bem processo comercial/Portal, mas não têm o nível de detalhe de comissionamento (%) ou tabela de limites numéricos que Porto/Too/Tokio têm.
3. Conteúdo de **imagens** (`COMERCIAL - POTTENCIAL.png`, `POTTENCIAL CARD.png`) e da planilha `GUIAS CONVES/SINISTROS.xlsx` não foram processados neste arquivo — são materiais de apoio comercial/controle interno, não regras de produto, e não pareceram relevantes para o currículo de treinamento a esta altura.
4. **SEGIMOB — escopo confirmado parcialmente**: a análise residencial PF passa pelo SEGIMOB (Seguros Imobiliários → Fiança Locatícia → Solicitar Seguro → Estipulante = Imobiliária). **Confirmado que a emissão AINDA NÃO passa pela SEGIMOB** — por enquanto continua no sistema nativo de cada seguradora; está nos planos da Conves a SEGIMOB passar a cobrir emissão também, mas isso é futuro, não deve ser ensinado como processo atual. **Ainda não confirmado**: se endosso, cancelamento, renovação e cobrança dos casos residenciais PF passam pela SEGIMOB ou seguem no portal nativo de cada seguradora (os guias internos de sinistro sugerem que sinistro é feito direto no sistema de cada seguradora — Porto, Pottencial e Too —, não na SEGIMOB, o que é uma pista de que o padrão "SEGIMOB só para novos negócios residenciais PF" deve se repetir, mas vale confirmar antes de fechar o SQL).
5. **Análises PJ / comercial**: não ficou confirmado se também passam pelo SEGIMOB ou se seguem direto no portal nativo de cada seguradora (a lição "Como cada seguradora processa a análise por trás" foi mantida como referência para esse cenário, mas precisa de confirmação).

---

## Próximos passos sugeridos

1. Revisar este arquivo e confirmar/ajustar nomes de setores, módulos e lições.
2. Confirmar o escopo real do SEGIMOB (ver gap 4 e 5 acima) — decide o quanto do módulo "Emissão de Apólices" e dos setores Endosso/Cancelamento/Renovação/Cobrança precisa ser reescrito com o mesmo padrão de detalhamento operacional usado em Fichas Cadastrais.
3. Aguardar material da Junto Seguros (ou decidir seguir sem ela por ora, com placeholder).
4. Só então: gerar o SQL/migration de `training_nodes` populando `conteudo_geral` / `variacoes_por_seguradora` a partir deste arquivo.
