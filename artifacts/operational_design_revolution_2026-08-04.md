# Revolucao de design operacional — Conves Hub

Data: 2026-08-04
Responsavel: Codex — Agente de Melhorias, com revisao de performance

## Direcao

O redesign passa a tratar o sistema como uma central de comando, e nao como uma colecao de paginas. A metrica principal e tempo ate a proxima decisao: encontrar um registro, entender seu contexto e executar a acao seguinte com o menor numero de cliques.

## Principios

1. Contexto antes de detalhe: status, cliente, objeto segurado, prazo e melhor opcao aparecem antes dos formularios.
2. Acoes no ponto de decisao: ligar, enviar e-mail, copiar dados e atualizar status ficam no proprio workspace.
3. Continuidade visual: Pipeline, cotacao e apolice compartilham cabecalho, metricas, abas, badges e feedback.
4. Busca transversal: a Pipeline pesquisa simultaneamente todas as etapas e atualiza seus contadores.
5. Navegacao entre workspaces: o dashboard principal funciona como launchpad para Fichas, Apolices, Auto e CRM.
6. Seguranca operacional: alteracoes nao salvas na apolice sao protegidas e o atalho `Ctrl/Cmd + S` reduz atrito.
7. Automacao explicavel: dados extraidos de PDF aparecem para revisao antes de preencher e permanecem editaveis.

## Fase 1 — executada

- Pipeline Auto: busca global por cliente, CPF, telefone, placa, veiculo, apolice, responsavel e seguradora; contadores e vazios passam a refletir a pesquisa.
- Cotacao Auto: migrada para o design Auto V2, com cinco areas em abas, resumo consolidado, comparacao de seguradoras, acoes rapidas e mudanca de status em um clique.
- Apolice Auto: acoes de contato/copia, erro de salvamento visivel, protecao contra fechamento com alteracoes pendentes, atalho de salvamento e status legiveis.
- Dashboard principal: launchpad transversal com acesso direto as cinco mesas operacionais prioritarias.

## Fase 2 — executada

- Central de cotacoes: header e indicadores migrados para Auto V2; antiga introducao extensa substituida por uma camada compacta de decisao com conversao e filas Pendentes, Convertidas e Perdidas acionaveis.
- Caixa de trabalho: busca, periodo, status e tipo ficam salvos no dispositivo; filtros podem ser zerados em um clique e o tipo Endosso passou a ser identificado corretamente.
- Navegacao de cotacoes: abas sincronizadas com `?modo=`, atalhos antigos com `?tab=` continuam aceitos e as rotas incorretas para dashboard/nova cotacao foram corrigidas.
- Carteira de clientes: busca com debounce de 280 ms para reduzir consultas, filtros persistentes, filtro Ativo/Inativo e reset completo.
- Perfil do cliente: contato por telefone/e-mail, copia de CPF, acesso direto a apolices e atalhos separados para nova cotacao e renovacao.
- Falhas de carregamento: cotacoes, carteira e perfil agora distinguem erro real de resultado vazio.

## Fase 3 — executada

- Auto PDF Intelligence: componente compartilhado com upload, leitura, progresso, campos reconhecidos, avisos e confirmacao assistida.
- Cotacoes: o PDF de orcamento preenche cliente, risco e seguradora preferencial no workspace; no fechamento da Pipeline, monta ou atualiza a linha correspondente no comparativo.
- Emissoes e apolices: proposta/apolice em PDF preenche segurado, condutor, veiculo, seguradora, numero, vigencia, premio, comissao e pagamento; PNG/JPG continuam aceitos como anexos sem leitura automatica.
- Confiabilidade: os campos importados continuam editaveis, so sao aplicados por acao explicita e o payload final usa o formulario revisado.
- Renovações: busca unica por cliente, contato, apolice, placa, veiculo ou seguradora; periodo e status ficam salvos no dispositivo.
- Sinistros: dossie rapido persistente com dados da ocorrencia, protocolo, relato, checklist e resumo copiavel para contato com a seguradora.
- Parser: suporte aos rotulos comuns `Apolice N` e `Proposta N`, com a suite completa em 171/171 testes.

## Proximas fases recomendadas

1. Validar a leitura com PDFs reais de cada seguradora e salvar refinamentos de layout por companhia.
2. Criar visoes pessoais salvas na Pipeline Auto.
3. Adicionar command palette contextual para acoes do registro atual.
4. Medir tempo medio por fluxo e quantidade de cliques antes/depois para quantificar o ganho.
5. Evoluir Sinistros do dossie local para registros persistidos quando o backend do dominio entrar no escopo.

## Limites desta fase

Nenhuma mudanca em banco, Supabase, RLS, rotas ou regras de negocio. O escopo e interface, navegacao e produtividade operacional.
