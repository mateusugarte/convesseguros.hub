# Especificação — Módulo de Orçamento Comparativo (Seguro Auto)

## 1. Objetivo

Adicionar ao sistema já existente um módulo que permite ao usuário (corretor) selecionar duas seguradoras, subir a cotação em PDF de cada uma, e gerar automaticamente um **orçamento comparativo em PDF** — com a marca da corretora, as logos das seguradoras, e o detalhamento lado a lado das coberturas, eventualidades e valores de cada proposta.

O objetivo final é eliminar o trabalho manual de montar esse comparativo no Word/Canva a cada cotação nova.

## 2. Fluxo do usuário

1. Usuário acessa o módulo "Novo orçamento comparativo".
2. Seleciona, em uma lista, as duas seguradoras que está comparando: **Seguradora Atual** e **Seguradora Concorrente** (ambas vêm do mesmo cadastro de seguradoras suportadas).
3. Faz upload do PDF de cotação de cada uma (2 arquivos).
4. Sistema extrai automaticamente os dados de cada PDF (ver seção 4).
5. Sistema exibe uma **tela de revisão**, com os dados extraídos organizados em formulário, para o usuário conferir e corrigir manualmente qualquer valor antes de prosseguir (extração de PDF nunca é 100% confiável — essa etapa é obrigatória, não opcional).
6. Usuário confirma → sistema gera o PDF final do orçamento comparativo.
7. Usuário baixa/envia o PDF.

## 3. Seguradoras suportadas

- Hoje: ~11 a 12 seguradoras, cada uma com um layout de cotação próprio.
- Cadastro deve ser **extensível**: adicionar uma seguradora nova não deve exigir reescrever o sistema, apenas cadastrar a seguradora (nome, logo, e — se o extrator for baseado em perfis fixos — o mapeamento de campos daquele layout).
- Cada seguradora tem: nome, logo (arquivo de imagem), **cor de destaque própria** (usada na faixa do card no PDF final — ver seção 9), e possivelmente um "perfil de extração" próprio.

**Recebido:** cotações de exemplo da Tokio Marine e da Porto Seguro (mesma cliente, mesmo veículo), usadas para validar o modelo de dados da seção 5 e o mockup da seção 7. Os campos abaixo já foram confirmados como presentes em cotações reais:

- Tokio Marine: nº da cotação, validade, vigência, prêmio (à vista/parcelado), franquia (parcial/integral), coberturas com LMI e prêmio líquido por item, assistência 24h com km de reboque, carro reserva, franquias de vidros por peça, tipo de oficina/peça, tabela de parcelamento (débito, ficha, cartão), tipo de operação (ex: "Renovação Congênere"), dados do condutor principal, CEP de pernoite, link para Condições Gerais e Guia de Serviços.
- Porto Seguro: nº do orçamento, versão das Condições Gerais (ex: "CG144"), tipo de operação (ex: "RENOVAÇÃO DA CIA"), coberturas de casco/RCF/danos morais com LMI e prêmio, lista de benefícios/serviços gratuitos, descontos aplicados, franquia, prêmio líquido + IOF + total, tabela de parcelamento, dados do condutor principal, CEP de pernoite.

**Pendente:** cotações de exemplo das demais ~9-10 seguradoras, para completar o mapeamento de campos e nomes de cobertura de cada layout.

## 4. Extração de dados dos PDFs

Como são muitos layouts diferentes (um por seguradora), duas abordagens possíveis:

**Opção A — Extração via IA (recomendada):** um modelo de linguagem lê o PDF (texto ou OCR, se for imagem) e retorna os dados já estruturados no schema padronizado da seção 5. Vantagem: não precisa manter um parser separado por seguradora; lida melhor com pequenas variações de layout dentro da mesma seguradora (ex: PDF muda de versão). Desvantagem: precisa de validação humana (por isso a tela de revisão do passo 5 é obrigatória) e tem custo de API por extração.

**Opção B — Parser fixo por seguradora:** um extrator dedicado (regex / posição no PDF) para cada uma das 11-12 seguradoras. Vantagem: previsível, sem custo de API. Desvantagem: quebra fácil quando a seguradora muda o layout do PDF, e dá mais trabalho de manutenção com 11-12 parsers.

**Recomendação:** Opção A (extração via IA) com a tela de revisão como rede de segurança, dado o número de seguradoras e a variação de layout.

Independente da abordagem, é necessário um **dicionário de equivalência de nomes de cobertura**, já que seguradoras diferentes nomeiam a mesma cobertura de formas diferentes (ex: "Assistência 24h" vs "SOS Automóvel" vs "Guincho"). Sem isso, a comparação por cobertura fica inconsistente entre seguradoras.

## 5. Modelo de dados (schema por cotação)

Cada PDF extraído deve virar um objeto no formato abaixo, já ajustado com base nas cotações reais da Tokio Marine e da Porto Seguro:

```json
{
  "seguradora": {
    "nome": "string",
    "logo_url": "string"
  },
  "cotacao": {
    "numero": "string",
    "tipo_operacao": "string (seguro novo | renovação | endosso)",
    "validade": "date",
    "data_emissao": "date"
  },
  "segurado": {
    "nome": "string",
    "cpf_cnpj": "string",
    "data_nascimento": "date | null"
  },
  "condutor_principal": {
    "nome": "string",
    "cpf": "string",
    "estado_civil": "string | null"
  },
  "veiculo": {
    "marca_modelo": "string",
    "ano_modelo": "string",
    "placa": "string",
    "uso": "string",
    "cep_pernoite": "string",
    "condutor_18_25": "string | null (ex: 'sem cobertura')"
  },
  "vigencia": {
    "inicio": "date",
    "fim": "date"
  },
  "valores": {
    "premio_liquido": "number | null",
    "iof": "number | null",
    "premio_total": "number",
    "premio_parcelado": "string",
    "descontos_aplicados": ["string"],
    "franquia": "number",
    "franquia_tipo": "string (reduzida/normal/obrigatória/etc)"
  },
  "coberturas": [
    {
      "nome_padronizado": "string",
      "nome_original_seguradora": "string",
      "incluida": "boolean",
      "valor_lmi": "number | null",
      "observacoes": "string"
    }
  ],
  "assistencias": [
    {
      "tipo": "string",
      "incluida": "boolean",
      "detalhes": "string"
    }
  ],
  "servicos_adicionais": ["string"]
}
```

Importante: **"tipo_operacao"** (seguro novo, renovação ou endosso) é um dado que o corretor deve confirmar sempre na tela de revisão — é ele que determina, entre outras coisas, textos e alertas específicos que devem aparecer no orçamento final (ex: um endosso costuma exigir uma nota diferente de uma renovação).

## 6. Tela de revisão

- Formulário pré-preenchido com os dados extraídos de cada seguradora, lado a lado ou em abas.
- Todo campo deve ser editável.
- Deve sinalizar visualmente campos que a extração não conseguiu preencher (ex: em vermelho/amarelo), para o usuário saber onde prestar mais atenção.
- Botão "Gerar orçamento" só habilita depois que o usuário passar por essa tela.

## 7. Conteúdo fixo por seguradora x conteúdo personalizado por cotação

Nem tudo no orçamento vem do PDF que o corretor sobe. Uma parte do texto é **sempre igual para aquela seguradora** e só muda quando a seguradora muda as próprias regras — não a cada cotação. Isso precisa ficar separado em dois níveis de cadastro:

**Fixo por seguradora** (cadastrado uma vez, reaproveitado em todo orçamento daquela seguradora):
- Textos de regras operacionais que vêm das Condições Gerais, não da cotação (ex: "acionamento de guincho limitado a 5x por ano na Porto").
- Logo, cor de identidade e dados de contato/SAC da seguradora.

**Personalizado por cotação** (extraído do PDF a cada upload, conforme schema da seção 5):
- Coberturas contratadas e não contratadas, valores de LMI, prêmio, franquia daquele veículo/cliente específico.
- **Condições de pagamento e parcelamento** — correção importante: isso deve ser **extraído de cada orçamento**, não tratado como texto fixo por seguradora. O parcelamento muda de cotação para cotação (depende do prêmio calculado, de descontos aplicados, da forma de pagamento escolhida), então precisa vir do PDF igual às coberturas.
- Dados do segurado, condutor e veículo.
- Tipo de operação (novo/renovação/endosso).

Isso evita ficar reextraindo do zero informação que realmente não muda de cotação para cotação (como regras operacionais das Condições Gerais), sem correr o risco de exibir um parcelamento desatualizado — que sempre precisa refletir o orçamento real.

## 8. Cadastro de Condições Gerais por seguradora

Cada seguradora, no cadastro do sistema (seção 3), deve ter um repositório de **Condições Gerais** anexadas diretamente ali:

- Upload do PDF/documento das Condições Gerais vigentes daquela seguradora.
- Sistema guarda e exibe: nome do arquivo e data do anexo (ex: "Porto Seguro Auto — CG144, anexada em 17/08/2026").
- O documento fica associado permanentemente à seguradora até ser substituído por uma versão mais nova (nesse caso, manter histórico de versões é recomendado, não obrigatório no MVP).
- **Sempre que um orçamento é gerado**, o sistema deve consultar as Condições Gerais da seguradora correspondente e trazer para o PDF final as informações pertinentes àquela cobertura — por exemplo, o limite de acionamentos da assistência 24h, ou regras de franquia — complementando o que já veio da cotação, sem que o corretor precise copiar isso manualmente toda vez.
- Essa leitura pode ser feita via IA (o mesmo mecanismo de extração da seção 4, mas aplicado ao documento de Condições Gerais em vez da cotação), buscando por padrões relevantes por cobertura.

## 9. PDF final — layout e sistema visual

O layout já passou por três rodadas de validação com o usuário e reflete o mockup atual (ver arquivo `orcamento-modelo-CONVES.pdf`), com cards lado a lado, identidade visual própria e categorias de cobertura padronizadas:

- **Cabeçalho:** logo da corretora (Convés) + título + nº de referência interna, data de emissão e validade da proposta.
- **Barra do cliente:** nome do segurado, veículo (com placa), e um selo com o **tipo de operação** (Seguro Novo / Renovação / Endosso). A vigência da proposta **não entra** nessa barra — removida a pedido do usuário.
- **Corpo:** dois **cards lado a lado** — Seguradora Atual à esquerda, Outra Seguradora à direita, separados por uma linha fina com um pequeno losango central (elemento de assinatura visual, discreto). Cada card é um painel com borda e sombra sutil, com uma **faixa colorida no topo** contendo a logo da seguradora em destaque, dentro de um "selo" branco — a logo ficou propositalmente maior nessa versão, a pedido do usuário, para dar mais peso visual à identidade de cada seguradora.
  - **Cor da faixa:** identidade visual de cada seguradora, não uma cor fixa por papel ("atual" x "outra"). No mockup, Tokio Marine é dourado e Porto Seguro é azul, porque essas são as cores associadas a cada uma delas — cada seguradora cadastrada no sistema (seção 3) deve ter uma cor de destaque própria, salva junto com o logo.
  - **"Não incluso nesta cotação":** vive num painel visualmente destacado dentro do card — fundo levemente tingido, borda de acento à esquerda e um ícone de alerta ao lado do título — para que essa informação não se perca no meio das coberturas incluídas. É proposital que essa seção "pese" mais visualmente: o cliente precisa notar rápido o que não está coberto.

### Categorias de cobertura padronizadas

Em vez de listar cada cobertura como o texto da cotação chamá-la, o PDF final organiza as coberturas de cada seguradora em **categorias fixas, sempre na mesma ordem**, com o mesmo rótulo e o mesmo ícone — o que muda é só o conteúdo (extraído da cotação daquela seguradora específica):

1. **Colisão, incêndio, roubo e furto** — inclui, dentro do texto, se a indenização é integral (e a que % da FIPE) ou apenas parcial via franquia.
2. **Danos a terceiros (RCF-V)** — valores de LMI para danos materiais, corporais, morais e custas de defesa, quando existirem.
3. **Assistência 24 horas** — km de reboque, e qualquer limite de acionamento vindo das Condições Gerais (ex: "guincho limitado a 5x/ano").
4. **Carro reserva** — quantidade de diárias e categoria.
5. **Franquia** — percentual/tipo e valor.
6. **Vidros** — o que cobre e franquias por peça, quando informadas.
7. **Categoria livre "adicional"** (opcional, só aparece quando a seguradora tiver algo relevante fora das 6 categorias acima — ex: benefícios extras da Porto Seguro).

Isso resolve o pedido do usuário de "padronizar o texto das coberturas básicas e só adicionar o que for diferente em cada cotação": o corretor (ou o extrator via IA) preenche essas categorias fixas a partir da cotação, e qualquer item que não se encaixe em nenhuma delas some para a lista de "Não incluso" ou para a categoria adicional — nunca é inventado ou aproximado.

- **Indenização integral x parcial — ponto crítico de exatidão:** cada seguradora estrutura essa informação de um jeito diferente (a Tokio trata como um adicional separado da franquia, "possui/não possui"; a Porto já embute a indenização integral a 100% da FIPE dentro da própria cobertura de colisão/incêndio/roubo/furto). O card deixa explícito, para cada seguradora, se a indenização integral **está incluída** (e a que percentual da FIPE) ou **não está incluída** (só cobertura parcial via franquia) — nunca deduzir isso implicitamente, sempre nomear a cobertura "indenização integral" de forma literal no orçamento. Esse é o tipo de erro que o usuário sinalizou como crítico: **a exatidão do que é repassado no PDF é mais importante do que a estética** — nenhuma automação de extração deve ir para produção sem validação humana desse tipo de campo (reforça a obrigatoriedade da tela de revisão da seção 6).
- Lista do que **não está incluído** nessa cotação, com o mínimo de detalhe necessário; caixa de valor total + parcelamento (extraído da própria cotação — ver seção 7); nota de rodapé do card citando a versão das Condições Gerais consultada e a data em que foi anexada.

### Sistema visual (aplicado com a skill de design front-end anexada pelo usuário)

- **Ícones:** substituídos os emojis por um conjunto de ícones de linha, monocromáticos (uma cor só, herdando a cor de destaque da seguradora), consistentes em espessura de traço — um ícone fixo por categoria (ex: escudo para colisão/incêndio/roubo/furto, pessoas para danos a terceiros, relógio para assistência 24h, carro para carro reserva, percentual para franquia, grade para vidros). Ícones de "incluso" (check) e "não incluso" (x) seguem o mesmo padrão visual.
- **Tipografia:** um par deliberado em vez da fonte padrão do sistema — uma serifada (para título, valores em destaque e números grandes) combinada com uma sans-serif (para o corpo do texto) e uma monoespaçada (para rótulos em caixa alta, números de referência e datas), reforçando a leitura de "documento financeiro/apólice" em vez de um layout genérico.
- **Paleta:** tons de tinta (azul-marinho escuro) sobre papel branco, com o dourado e o azul das seguradoras como únicos acentos coloridos — evita o visual "modelo padrão de IA" (fundo creme + serifada + terracota) e mantém o documento sóbrio, como convém a um material financeiro.
- **Tamanho da informação:** aumentado em relação à primeira versão — títulos de cobertura e valores totais maiores, para leitura mais confortável.
- **Tratamento de divergência de coberturas:** o orçamento não lista "todas as coberturas possíveis" cobertura a cobertura; ele resume o que cada seguradora **inclui** e, à parte, o que **não inclui nessa cotação especificamente** (itens que a seguradora oferece mas o cliente não contratou, ou que a seguradora simplesmente não oferece). Isso mantém o documento simples — o objetivo é o cliente bater o olho e entender rapidamente, não uma ficha técnica exaustiva.
- **Rodapé geral:** disclaimer de que é um orçamento simplificado sujeito à análise de risco, e dados de contato da Convés.

## 10. Identidade visual

- Logo da corretora (Convés): **recebida** — arquivo tratado (fundo transparente, upscale e nitidez) disponível em `assets/conves-logo.png`, já aplicado no mockup do cabeçalho.
- Cores/fonte da marca: ainda não veio um guia de marca formal — o mockup usa azul-marinho (`#0b3d66`) como cor principal (tom presente na própria logo) e dourado (`#7a5c00`) para diferenciar o bloco da "outra seguradora"; fácil de trocar depois se a Convés tiver uma paleta oficial.
- Logos das seguradoras: um arquivo por seguradora, associado ao cadastro da seguradora (seção 3). Para o mockup, as logos da Tokio Marine e da Porto Seguro foram recortadas diretamente das cotações de exemplo — no sistema real, cada seguradora deve ter um arquivo de logo em boa resolução cadastrado uma única vez.

## 11. Requisitos técnicos sugeridos

- Geração de PDF: lib server-side (ex: WeasyPrint, Puppeteer/HTML-to-PDF, ReportLab, ou equivalente na stack já usada pelo sistema existente) — permite montar o layout em HTML/CSS e exportar, o que facilita manter consistência visual. O mockup anexo foi gerado assim (HTML/CSS → PDF via Chromium headless).
- Extração: se for via IA, definir prompt/schema fixo (o da seção 5) para forçar saída estruturada e validável — tanto para a cotação quanto para a leitura das Condições Gerais (seção 8).
- Persistir o JSON estruturado de cada cotação (não só o PDF final), para permitir reabrir/editar orçamentos gerados e para auditoria.
- Persistir os arquivos de Condições Gerais com metadado de data de upload, vinculados à seguradora.

## 12. Casos de borda a tratar

- PDF de cotação é imagem escaneada (sem texto selecionável) → precisa de OCR antes da extração.
- PDF com mais de uma opção de cobertura/pacote dentro do mesmo arquivo (ex: 3 opções de franquia) → definir qual usar, ou permitir escolha na tela de revisão.
- Seguradora nova, ainda não cadastrada → fluxo de cadastro rápido antes de gerar o orçamento.
- Falha total na extração (PDF corrompido, ilegível) → tela de revisão deve permitir preenchimento 100% manual como fallback.
- Seguradora ainda sem Condições Gerais cadastradas → orçamento deve poder ser gerado mesmo assim, só sem o complemento de regras da seção 8 (não travar o fluxo por isso).

## 13. Pendências antes de começar a implementação

- [x] Logo da corretora (Convés) — recebida e já tratada no mockup.
- [x] Cotação de exemplo — Tokio Marine e Porto Seguro (usadas no mockup).
- [ ] Cotação de exemplo das ~9-10 seguradoras restantes (para completar o mapeamento de campos e nomes de cobertura).
- [ ] Um exemplo de documento de Condições Gerais de pelo menos uma seguradora, para validar a extração da seção 8.
- [ ] Confirmar qual sistema já existe (stack/tecnologia) para o Claude Code integrar o módulo corretamente.
- [ ] Validar com o usuário o mockup visual (`orcamento-modelo-CONVES.pdf`) antes de seguir para implementação.

## 14. Critérios de aceite

- Usuário consegue selecionar 2 seguradoras cadastradas e subir os 2 PDFs.
- Sistema extrai os dados (incluindo tipo de operação) e apresenta tela de revisão editável antes de gerar o PDF.
- PDF final mostra as logos das duas seguradoras, os blocos completos de cada uma, e lista claramente o que não está incluído em cada cotação.
- PDF final traz a marca da corretora no cabeçalho e o tipo de operação (novo/renovação/endosso) em destaque.
- PDF final incorpora, nas coberturas relevantes, informações vindas das Condições Gerais cadastradas da seguradora (não só da cotação).
- Textos fixos por seguradora (parcelamento, regras operacionais) são consistentes entre orçamentos diferentes da mesma seguradora, sem precisar redigitar.
- Processo funciona para pelo menos 3 seguradoras diferentes cadastradas, comprovando que o modelo de extração/comparação não é hardcoded para um único layout.
