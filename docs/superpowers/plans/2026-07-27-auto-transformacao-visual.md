# Setor AUTO - plano mestre de transformação visual

**Data:** 2026-07-27  
**Status:** planejamento aprovado para execução visual  
**Escopo:** toda a experiência do setor AUTO  
**Regra principal:** preservar contratos de dados e regras de negócio; transformar hierarquia, navegação, densidade, componentes, responsividade e feedback visual.

## 1. Objetivo

Transformar o setor AUTO em um cockpit operacional claro, rápido e consistente para quem precisa:

- identificar o que exige ação agora;
- puxar, cotar, negociar, emitir e renovar sem perder contexto;
- comparar valores e comissão sem fazer conta mental;
- reconhecer Novo, Renovação e Endosso imediatamente;
- encontrar cliente, apólice, cotação e histórico com poucos cliques;
- trabalhar em desktop com alta densidade e em celular sem perder ações essenciais.

O resultado não deve parecer uma landing page nem uma coleção de cards decorativos. Deve parecer uma ferramenta diária de operação, com informação priorizada, comandos previsíveis e estados inequívocos.

## 2. Estado real em 27/07/2026

### Plano funcional do Claude

A fonte de verdade é o histórico Git:

- Task 1 concluída no commit `1613a65`: migração de Renovações/Endosso.
- Correção de RLS concluída no commit `c5fd5c0`.
- Tasks 2 a 19 ainda devem ser integradas ao código de aplicação.
- `docs/CURRENT_TASK.md` ainda informa que a execução não começou; esse registro está desatualizado.

### Interface atual

O setor possui 11 telas JSX e aproximadamente 5.600 linhas. O principal ponto de risco é `AutoEmissoes.jsx`, com cerca de 2.800 linhas e múltiplas experiências dentro do mesmo arquivo.

Já existe uma camada `.auto-page` criada em 17/07 que:

- reduz os cantos para 8px;
- esconde elementos `blur-3xl`;
- usa azul, teal, coral, verde e dourado;
- reduz parte do visual glassmorphism;
- padroniza inputs, botões, tabelas e dark mode.

Essa camada é uma boa fundação, mas atua principalmente por sobrescrita de CSS. A composição das páginas ainda mantém:

- cabeçalhos grandes demais para uma ferramenta operacional;
- heróis com gradientes que ocupam a primeira dobra;
- muitas caixas dentro de caixas;
- repetição da mesma informação em cards, resumos e tabelas;
- ações importantes espalhadas;
- excesso de `rounded-2xl`, `rounded-3xl` e sombras;
- pouca distinção estrutural entre Novo, Renovação e Endosso;
- páginas de detalhe longas, sem navegação interna;
- nomenclatura confusa entre "Emissões" e "Gestão AUTO".

## 3. Princípios obrigatórios

1. **Ação antes de decoração.** A primeira dobra deve mostrar pendências, prazo, estado e ação principal.
2. **Uma informação, um lugar.** Não repetir a mesma contagem em hero, KPI, resumo e tabela.
3. **Tabela para comparação; card para entidade.** Listas operacionais densas usam tabela no desktop e linhas compactas no mobile.
4. **Tipo não é status.** Novo, Renovação e Endosso têm identidade própria; urgência e andamento usam outro eixo visual.
5. **Cor com significado.** Azul para ação/novo, teal para renovação, coral para endosso ou atenção contextual, verde para sucesso, âmbar para prazo e vermelho apenas para risco/erro.
6. **Sem status apenas por cor.** Todo status combina texto, ícone ou padrão visual.
7. **Cantos de 6 a 8px.** Pílulas ficam restritas a tags, status e filtros curtos.
8. **Sombras discretas.** Hierarquia vem de espaçamento, borda, tipografia e contraste.
9. **Sem heróis operacionais.** Dashboard e páginas de trabalho não usam bloco promocional.
10. **Ações persistentes.** Salvar, emitir, cancelar e avançar permanecem visíveis em fluxos longos.
11. **Movimento funcional.** Animação confirma drag, mudança de estado, abertura de painel e salvamento.
12. **Mesmo vocabulário em todas as telas.** Tipo, coluna, urgência, comissão e seguradora não mudam de aparência entre módulos.

## 4. Nova arquitetura de navegação

As rotas existentes devem ser preservadas na primeira etapa. A mudança inicial é de rótulo, agrupamento e prioridade:

```text
AUTO
├── Visão geral            /auto
├── Renovações             /auto/renovacoes
├── Pipeline               /auto/gestao
├── Cotações               /auto/cotacoes
├── Clientes               /auto/clientes
├── Apólices e emissões    /auto/emissoes
├── Sinistros              /auto/sinistros
└── Configurações
    └── Etiquetas          /auto/etiquetas
```

Decisões:

- "Gestão AUTO" passa a ser "Pipeline".
- "Emissões" passa a ser "Apólices e emissões" para representar a lista/histórico.
- Etiquetas sai da sequência operacional e fica como configuração.
- A ordem acompanha o fluxo de trabalho, não a ordem em que as telas foram criadas.

## 5. Estrutura visual comum

### 5.1 Cabeçalho operacional

Substituir o `PageHeader` grande por uma variante compacta de AUTO:

- breadcrumb ou contexto curto;
- título entre 24px e 30px;
- descrição de uma linha apenas quando necessária;
- seletor de período junto ao título quando ele controla toda a página;
- uma ação primária e até duas ações secundárias;
- sem kicker em formato de pílula repetindo "Módulo auto".

### 5.2 Faixa de indicadores

Trocar quatro cards altos por uma faixa compacta:

- altura aproximada de 72 a 88px no desktop;
- números tabulares;
- divisores verticais;
- delta e contexto próximos ao valor;
- rolagem horizontal controlada no mobile;
- clique opcional para aplicar filtro correspondente.

### 5.3 Barra de trabalho

Padrão único para busca, filtros, período e alternância de visão:

- busca à esquerda;
- filtros relevantes no centro;
- contador de resultados e ações à direita;
- filtros ativos visíveis e removíveis;
- ação "Limpar" apenas quando houver filtro;
- modo tabela/cards em controle segmentado, não em botões soltos.

### 5.4 Painel lateral de contexto

Usar drawer/inspector para consulta rápida sem abandonar listas e Kanban:

- resumo da entidade;
- linha do tempo;
- dados financeiros;
- ações secundárias;
- link para abrir a página completa.

### 5.5 Formulários

Organizar por etapas e assunto, sem card dentro de card:

- títulos de seção simples;
- grid de campos previsível;
- campos derivados em modo somente leitura;
- validação ao lado do campo;
- resumo financeiro persistente;
- barra de ações fixa no rodapé.

## 6. Componentes visuais propostos

Criar componentes AUTO em `src/components/auto/`, sem alterar a API dos componentes globais:

- `AutoPageHeader`
- `AutoStatStrip`
- `AutoToolbar`
- `AutoViewToggle`
- `AutoStatusBadge`
- `AutoTypeBadge`
- `AutoUrgencyRail`
- `AutoDeadline`
- `AutoMoneyDelta`
- `AutoSeguradoraIdentity`
- `AutoDataTable`
- `AutoMobileRow`
- `AutoInspectorDrawer`
- `AutoTimeline`
- `AutoFormSection`
- `AutoStickyActions`
- `AutoSkeleton`
- `AutoInlineAlert`

Regras:

- componentes recebem dados prontos; não consultam Supabase;
- nenhuma regra financeira é duplicada em JSX;
- fórmulas usam o helper único definido pelo plano funcional;
- ícones devem vir de Lucide;
- logos de seguradora sempre têm fallback textual;
- componentes de status expõem `aria-label` e não dependem apenas da cor.

## 7. Identidade visual

### Paleta funcional

- **Azul:** ação primária, Novo e navegação selecionada.
- **Teal:** Renovação, carteira protegida e continuidade.
- **Coral:** Endosso e alteração contratual; não usar como erro genérico.
- **Verde:** emitido, concluído e ganho.
- **Âmbar:** prazo próximo, atenção e aguardando.
- **Vermelho:** vencido, cancelado, falha e ação destrutiva.
- **Neutros claros:** superfícies e separadores; evitar uma tela inteira azul ou slate.

### Tipografia

- títulos de página: 24-30px;
- títulos de seção: 16-18px;
- corpo: 14px;
- metadados: 12-13px;
- valores financeiros e datas: números tabulares;
- sem escala de fonte baseada em largura da viewport;
- `letter-spacing: 0`, exceto labels curtos em caixa alta quando indispensável.

### Superfícies

- radius padrão: 8px;
- radius de controles compactos: 6px;
- radius de modal/drawer: 8px;
- pílulas apenas para badges;
- uma sombra de elevação para drawer/modal;
- painéis da página usam borda e fundo, sem sombra flutuante forte;
- retirar gradientes decorativos, orbs e brilho radial das telas AUTO.

### Movimento

- hover/focus: 120-160ms;
- abertura de drawer/modal: 180-220ms;
- confirmação de mudança de coluna: pulso sutil de 500-700ms;
- drag overlay com escala máxima de 1.02;
- respeitar `prefers-reduced-motion`;
- nenhuma animação pode alterar dimensões da interface.

## 8. Redesenho por tela

### 8.1 Visão geral

Objetivo: mostrar o que precisa de decisão hoje.

Nova primeira dobra:

```text
[Visão geral] [Jul/2026]                 [Nova cotação]
[Alerta de virada de mês + Puxar renovações, quando aplicável]
[Pendentes] [Vencem em 15d] [Em negociação] [Comissão do mês]
[Fila de ação hoje..........................................]
```

Mudanças:

- remover o bloco "Uma mesa única para cotar, renovar e emitir";
- banner de virada do mês ocupa uma faixa de alerta, não um hero;
- criar "Fila de ação hoje" com no máximo 8 itens priorizados;
- mostrar vencimentos, cotações sem retorno e propostas aguardando vistoria;
- manter gráficos abaixo da área operacional;
- gráficos usam uma legenda e uma escala consistentes;
- quick actions: Nova cotação, Puxar renovações, Abrir pipeline;
- comissão do mês mostra valor e variação, sem repetir o mesmo número em vários cards.

### 8.2 Renovações

Objetivo: transformar a página em uma fila de produção mensal.

Estrutura:

- cabeçalho com mês, estado do mês e ação "Puxar renovações";
- faixa compacta: total, não cotadas, enviadas, concluídas, vencidas;
- toolbar: busca, urgência, status, seguradora, responsável;
- tabela principal no desktop;
- linhas compactas no mobile;
- inspector lateral ao clicar na renovação;
- painel "Puxar renovações" como drawer com duas fontes: Sistema e Planilha;
- confirmação do mês somente nessa página.

Colunas principais:

- segurado;
- veículo/placa quando disponível;
- seguradora;
- fim da vigência;
- data limite de envio;
- andamento real do Pipeline;
- comissão anterior;
- comissão atual;
- variação;
- ação.

Hierarquia de urgência:

- trilho lateral fixo na linha;
- contador textual: "vence em 8 dias", "vence hoje", "vencida há 2 dias";
- data limite mais importante que a data de vigência para a ação diária;
- vermelho reservado a vencida/estourada;
- âmbar para janela de atenção;
- cinza para prazo confortável.

Eliminar:

- lista grande de cards seguida por quatro cards-resumo e outra tabela;
- quatro caixas internas por renovação;
- CTA genérico "Cotar"; usar "Fazer cotação";
- repetição de status de cotação e status de renovação sem contexto.

### 8.3 Pipeline

Objetivo: ser a mesa de trabalho visual de Novo, Renovação e Endosso.

Estrutura:

- ocupa a maior altura útil da viewport;
- cabeçalho e métricas compactos;
- toolbar fixa acima das colunas;
- Kanban horizontal com colunas de largura estável;
- cada coluna mostra quantidade e valor potencial;
- filtros por tipo, responsável, seguradora, urgência e etiqueta;
- busca local em tempo real.

Card do Kanban:

1. tipo: Novo, Renovação ou Endosso;
2. segurado;
3. veículo e placa;
4. seguradora;
5. prazo ou idade do card;
6. prêmio/comissão quando relevante;
7. até duas etiquetas manuais;
8. indicador de próxima ação.

Regras:

- tipo aparece no topo e nunca é inferido apenas por cor;
- urgência usa trilho lateral, separado da cor do tipo;
- conteúdo secundário vai para o inspector;
- altura do card deve ser previsível;
- drag não pode mudar a largura das colunas;
- coluna de destino recebe destaque claro;
- ao soltar, o card confirma a nova posição e mantém contexto;
- no mobile, usar navegação por colunas e lista da coluna ativa.

### 8.4 Modal reduzido de emissão

Objetivo: concluir a emissão sem abrir um formulário excessivo.

Layout:

- resumo fixo à esquerda no desktop e topo no mobile;
- formulário principal à direita;
- tipo somente leitura;
- checklist de campos obrigatórios;
- vigência final calculada e visível;
- comissão calculada em tempo real;
- comparação anterior/atual apenas em Renovação;
- resumo da alteração apenas em Endosso;
- CTA final sempre visível.

Não usar:

- coluna lateral decorativa em gradiente;
- três cards encaixados dentro do modal;
- checkbox manual para definir Renovação;
- fórmula de comissão local no JSX.

### 8.5 Apólices e emissões

Objetivo: separar histórico e pesquisa do Pipeline.

Mudanças:

- página orientada a tabela;
- busca por segurado, CPF, placa e número da apólice;
- filtros por período, seguradora, tipo e status;
- colunas configuradas para comparação rápida;
- inspector com emissão, apólice, documento e eventos;
- ações "Abrir apólice", "Abrir cotação" e "Editar";
- importação histórica fica em menu de ação secundária;
- remover hero e resumos duplicados.

### 8.6 Cotações

Objetivo: concentrar lista, criação e comparação sem misturar tudo na primeira dobra.

Estrutura:

- lista como visão padrão;
- ação primária "Nova cotação";
- menu ou modal inicial escolhe Novo, Renovação ou Endosso;
- cada fluxo de criação abre workspace guiado;
- gráficos e tendência ficam em uma aba "Análise", não ao lado do formulário;
- filtros por tipo, status, seguradora, período e responsável.

Fluxo Novo:

- identificação;
- condutor;
- veículo e risco;
- revisão.

Fluxo Renovação:

- localizar apólice;
- mostrar apólice anterior;
- confirmar dados reaproveitados;
- criar cotação.

Fluxo Endosso:

- localizar cliente;
- selecionar apólice em cards/linhas comparáveis;
- informar motivo e campo alterado;
- mostrar "antes" e "depois";
- informar valor do endosso quando aplicável;
- revisar e criar.

### 8.7 Detalhe da cotação

Objetivo: comparar opções e avançar o negócio.

Mudanças:

- cabeçalho com segurado, veículo, tipo, status e ação principal;
- resumo do risco em faixa compacta;
- tabela de propostas por seguradora como foco central;
- colunas: seguradora, prêmio, franquia, coberturas-chave, comissão, situação;
- opção escolhida claramente destacada;
- ações de salvar/enviar/avançar em barra fixa;
- timeline e metadados no inspector;
- edição por seção, sem oito cards empilhados;
- histórico de alterações visível sem dominar a tela.

### 8.8 Clientes

Objetivo: encontrar rapidamente a carteira e o próximo evento do cliente.

Mudanças:

- lista/tabela por cliente, não por bloco expansivo de cards;
- busca principal por nome, CPF, celular, placa e apólice;
- filtro alfabético compacto;
- colunas: cliente, apólices ativas, próxima renovação, seguradora principal, comissão acumulada, status;
- linha expansível ou inspector para apólices;
- paginação e contagem permanecem próximas da tabela;
- status "pré-sistema" e recorrência ganham labels consistentes.

### 8.9 Perfil do cliente

Objetivo: reunir relacionamento sem uma página infinita.

Abas:

- Visão geral;
- Apólices;
- Renovações;
- Cotações;
- Financeiro;
- Atividade.

Cabeçalho:

- nome e CPF;
- cliente desde;
- status atual;
- telefone/email com ações por ícone;
- próxima renovação;
- ação "Nova cotação".

### 8.10 Detalhe da apólice

Objetivo: consultar e editar a apólice com segurança.

Estrutura:

- cabeçalho com número, seguradora, vigência, tipo e status;
- aviso de renovação quando entrar na janela;
- abas: Resumo, Segurado e veículo, Financeiro, Renovação, Histórico;
- modo leitura por padrão;
- botão explícito "Editar";
- alterações ficam em barra fixa com Salvar/Descartar;
- comparação anual usa `AutoMoneyDelta`;
- histórico em timeline;
- Endosso aparece como evento vinculado, não como nova apólice.

### 8.11 Etiquetas

Objetivo: tratar etiquetas como configuração, não como módulo operacional.

Mudanças:

- tabela simples com swatch, nome, uso, status e ordem;
- criação/edição em drawer;
- seletor de cor com swatches;
- preview real de uma etiqueta em um card compacto;
- reordenação por handle;
- confirmação clara antes de excluir;
- manter etiquetas estruturais separadas das etiquetas manuais.

### 8.12 Sinistros

Objetivo imediato: não fingir uma operação que ainda não existe.

Enquanto não houver backend:

- página simples com estado de disponibilidade;
- descrição curta do escopo;
- sem hero, métricas falsas ou três cards decorativos;
- CTA futuro somente quando existir ação funcional.

Quando o fluxo for implementado:

- lista de casos;
- severidade;
- seguradora;
- documentos;
- responsável;
- próxima ação;
- prazo;
- timeline do sinistro.

## 9. Estados obrigatórios

Cada tela deve prever:

- carregando com skeleton que preserve o layout;
- vazio inicial com ação útil;
- vazio por filtro com "Limpar filtros";
- erro com mensagem específica e "Tentar novamente";
- dados parciais sem quebrar a linha;
- seguradora sem logo;
- texto longo;
- valores ausentes;
- lista com alto volume;
- modo claro e escuro;
- permissão insuficiente;
- salvamento em andamento;
- salvamento concluído;
- conflito ou falha de atualização.

## 10. Responsividade

### Desktop amplo - 1440px ou mais

- aproveitar largura para tabelas e inspector;
- Pipeline ocupa a altura útil;
- modal pode usar duas colunas;
- evitar conteúdo central estreito em telas grandes.

### Notebook - 1280px a 1439px

- preservar tabela;
- reduzir colunas secundárias;
- inspector sobreposto;
- ações não podem quebrar em três linhas.

### Tablet - 768px a 1279px

- toolbar em duas linhas;
- detalhes em drawer;
- cards/linhas substituem tabelas muito largas;
- modal em uma coluna.

### Mobile - 360px a 767px

- cabeçalho curto;
- ação primária em largura útil;
- KPIs em rolagem horizontal estável;
- filtros em drawer;
- listas em linhas compactas;
- Kanban mostra uma coluna por vez;
- barra de ações fixa respeita safe area;
- nenhuma ação depende de hover.

## 11. Acessibilidade

- contraste mínimo AA;
- foco visível em todos os controles;
- ordem de tabulação acompanha a leitura;
- ícones desconhecidos têm tooltip;
- botões de ícone têm nome acessível;
- status não depende apenas da cor;
- drawers e modais controlam foco e fecham com Escape;
- tabelas mantêm cabeçalhos semânticos;
- áreas arrastáveis têm alternativa por menu para mudar status;
- zoom a 200% sem sobreposição;
- `prefers-reduced-motion` respeitado.

## 12. Coordenação com o Claude

### Propriedade temporária de arquivos

Enquanto as Tasks 2-19 estiverem em execução, o Claude mantém prioridade sobre:

- `supabase/56_auto_renovacoes_endosso.sql`
- `src/lib/auto.js`
- `src/lib/auto.test.mjs`
- `src/lib/autoComissaoImport.js`
- `src/pages/auto/autoShared.js`
- `src/pages/auto/autoShared.test.mjs`
- `src/pages/auto/AutoDashboard.jsx`
- `src/pages/auto/AutoRenovacoes.jsx`
- `src/pages/auto/AutoEmissoes.jsx`
- `src/pages/auto/AutoCotacoes.jsx`

A frente visual pode trabalhar em paralelo inicialmente apenas em:

- novos componentes em `src/components/auto/`;
- novo arquivo de estilo isolado para AUTO;
- documentação e inventário;
- testes de componentes puros;
- telas não tocadas pelo plano funcional, desde que não alterem contratos compartilhados.

### Gates de integração

1. **Após Tasks 2-9:** consolidar tokens, componentes-base e helpers visuais.
2. **Após Tasks 10-14:** redesenhar Dashboard e Renovações.
3. **Após Tasks 15-16:** redesenhar modal de emissão e estrutura de Apólices/Emissões.
4. **Após Tasks 17-19:** integrar Endosso em Cotações, Pipeline e detalhe da apólice.
5. **Após estabilização funcional:** transformar Clientes, detalhes, Etiquetas e Sinistros.

Antes de alterar um arquivo compartilhado:

- confirmar `git status`;
- confirmar o último commit AUTO;
- reler o diff do Claude;
- preservar nomes, payloads, queries e mutations;
- fazer a mudança visual em commit separado.

## 13. Roadmap de execução

### Fase 0 - baseline e contratos

- capturar screenshots atuais em desktop, notebook, tablet e mobile;
- registrar fluxos principais;
- mapear estados reais com dados;
- definir tokens e inventário de componentes;
- criar checklist de regressão por rota;
- não alterar regra de negócio.

**Saída:** baseline visual e mapa de contratos.

### Fase 1 - fundação visual AUTO

- criar componentes compartilhados;
- mover estilos AUTO do bloco monolítico de `index.css` para arquivo isolado;
- manter `.auto-page` compatível durante a migração;
- padronizar tipo, status, urgência, prazo, seguradora e delta financeiro;
- adicionar skeletons, alertas e barras de ação;
- validar dark mode e foco.

**Saída:** kit visual reutilizável sem redesenho integral das páginas.

### Fase 2 - núcleo de renovação

- Dashboard operacional;
- banner de virada de mês;
- painel Puxar renovações;
- tabela de Renovações;
- inspector da renovação;
- comissão anterior/atual;
- deadline e urgência;
- estados de mês concluído/cancelado.

**Dependência:** Tasks funcionais 10-14 concluídas.

### Fase 3 - Pipeline e emissão

- novo Kanban;
- cards por tipo;
- toolbar e filtros;
- drawer de contexto;
- modal reduzido;
- feedback de drag;
- lista de Apólices/Emissões.

**Dependência:** Tasks funcionais 15-16 concluídas.

### Fase 4 - Cotações e Endosso

- lista de cotações;
- seletor Novo/Renovação/Endosso;
- fluxos guiados;
- comparação por seguradora;
- detalhe da cotação;
- integração visual do Endosso.

**Dependência:** Tasks funcionais 17-19 concluídas.

### Fase 5 - carteira

- Clientes;
- Perfil do cliente;
- Detalhe da apólice;
- timeline integrada;
- navegação entre cliente, apólice, cotação e emissão;
- edição segura.

### Fase 6 - configuração e acabamento

- Etiquetas;
- Sinistros em estado honesto;
- navegação lateral;
- responsividade final;
- acessibilidade;
- consistência de textos;
- remoção dos estilos legados sem uso.

### Fase 7 - validação e rollout

- screenshots comparativas;
- smoke test dos fluxos;
- teste de alto volume;
- teste mobile;
- build e testes;
- revisão de contraste;
- liberação por rota, não em uma troca única;
- monitorar regressões e feedback da operação.

## 14. Ordem sugerida de commits

1. `docs(auto): plano mestre da transformação visual`
2. `feat(auto-ui): tokens e componentes operacionais compartilhados`
3. `refactor(auto-ui): dashboard e alerta de renovações`
4. `refactor(auto-ui): fila mensal de renovações`
5. `refactor(auto-ui): pipeline e cards por tipo`
6. `refactor(auto-ui): modal reduzido de emissão`
7. `refactor(auto-ui): lista de apólices e emissões`
8. `refactor(auto-ui): cotações e fluxo de endosso`
9. `refactor(auto-ui): detalhe da cotação`
10. `refactor(auto-ui): clientes e perfil`
11. `refactor(auto-ui): detalhe da apólice`
12. `refactor(auto-ui): etiquetas, sinistros e navegação`
13. `test(auto-ui): responsividade, acessibilidade e regressão visual`

## 15. Critérios de aceite por página

Uma página só está concluída quando:

- a ação principal aparece na primeira dobra;
- não existe hero promocional;
- não existem cards aninhados;
- não há repetição desnecessária de métricas;
- tipo, status, urgência e prazo são distinguíveis;
- textos longos não quebram o layout;
- funciona em 1440x900, 1366x768, 768x1024, 390x844 e 360x800;
- não existe scroll horizontal acidental;
- scroll horizontal intencional tem indicação e controle;
- foco, teclado e contraste foram verificados;
- loading, vazio, erro e dados parciais foram conferidos;
- dark mode não perde contraste;
- `npm test`, `npm run build` e checks de contexto passam;
- screenshots antes/depois foram revisadas.

## 16. Métricas de sucesso

### Eficiência operacional

- abrir o painel de puxar renovações em um clique a partir do alerta;
- iniciar uma cotação de renovação em um clique na linha;
- reconhecer a próxima ação de um card sem abrir o detalhe;
- emitir com apenas os campos necessários;
- localizar cliente/apólice por qualquer identificador principal;
- voltar ao contexto anterior sem perder filtros ou posição.

### Qualidade visual

- pelo menos 6 a 10 linhas úteis visíveis em listas desktop comuns;
- no máximo uma ação primária por região;
- nenhum raio decorativo acima de 8px fora de badges;
- nenhum orb ou blur decorativo;
- nenhum texto operacional em tamanho de hero;
- nenhuma informação crítica apenas por cor;
- nenhuma sobreposição nos viewports de aceite.

### Consistência

- um componente por conceito compartilhado;
- uma fórmula central de comissão;
- um mapa de tipo;
- um mapa de status;
- um mapa de urgência;
- um padrão de seguradora;
- um padrão de drawer/modal.

## 17. Riscos e mitigação

### Conflito com as Tasks do Claude

**Risco:** Dashboard, Renovações, Emissões e Cotações serão alterados pelo plano funcional.  
**Mitigação:** construir a fundação em arquivos novos e integrar por gates após os commits funcionais.

### `AutoEmissoes.jsx` muito grande

**Risco:** regressão ao alterar Kanban, listas e modais no mesmo arquivo.  
**Mitigação:** extrair componentes visuais gradualmente, sem mover mutations ou regras de negócio na mesma mudança.

### CSS global por sobrescrita

**Risco:** seletores como `.auto-page .rounded-3xl` mascaram inconsistências e afetam componentes novos.  
**Mitigação:** migrar para classes/componentes explícitos e remover overrides apenas quando todas as telas tiverem sido convertidas.

### Redesenho grande demais de uma vez

**Risco:** dificuldade de revisar e localizar regressão.  
**Mitigação:** rollout por rota, commits pequenos e screenshots por fase.

### Dados reais incompletos

**Risco:** layout funciona em mock, mas quebra com nomes, logos e campos ausentes.  
**Mitigação:** validar com estados reais e casos extremos antes de fechar cada página.

## 18. Decisões já tomadas

- preservar rotas na primeira fase;
- não alterar schema pelo redesenho;
- não duplicar trabalho funcional do Claude;
- não redesenhar componentes globais para resolver apenas AUTO;
- não manter hero decorativo nas telas operacionais;
- usar 8px como raio dominante;
- usar tabela como padrão para Renovações, Cotações, Clientes e Emissões;
- usar drawer para contexto rápido;
- usar abas em perfis e detalhes longos;
- manter Kanban como experiência principal do Pipeline;
- tratar Sinistros como indisponível até existir fluxo real;
- mover Etiquetas para configuração;
- validar visualmente em desktop e mobile antes de concluir cada fase.

## 19. Próximo passo executável

Quando a frente funcional estiver trabalhando nas Tasks 2-9, a frente visual deve iniciar a **Fase 0** e a parte não conflitante da **Fase 1**:

1. capturar baseline das rotas AUTO;
2. criar `src/components/auto/`;
3. definir tokens e componentes puros;
4. preparar o estilo isolado;
5. adicionar testes dos mapeamentos visuais;
6. esperar o gate da Task 14 para integrar Dashboard/Renovações;
7. seguir os demais gates do item 12.

Esse encadeamento permite evolução paralela sem retrabalho e mantém a regra de negócio do plano de Renovações/Endosso como contrato central.
