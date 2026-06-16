# ADR - Cadastro de Mídia e Produtos para Seguradoras e Imobiliarias

## Contexto

O cadastro atual de seguradoras e imobiliarias cobre nome canonico, status e aliases, mas ainda nao cobre:

- logos e imagens gerenciadas pelo usuario
- documentos anexados por entidade
- vinculacao de seguradoras por produto
- propagacao automatica dessas seguradoras nos fluxos por produto

Hoje os logos de seguradora estao hardcoded em `src/components/SeguradoraBadge.jsx`, e a associacao entre imobiliaria e seguradora existe apenas em `imobiliaria_seguradoras`, sem considerar produto.

## Decisao proposta

1. Persistir imagem principal diretamente nas tabelas de `seguradoras` e `imobiliarias`.
2. Criar uma tabela de relacao `seguradora_produtos` para declarar em quais produtos cada seguradora opera.
3. Evoluir `imobiliaria_seguradoras` para suportar filtro opcional por produto, evitando regras espalhadas no front.
4. Criar uma tabela dedicada para documentos de seguradoras e imobiliarias, em vez de sobrecarregar `documentos`, que hoje exige `ficha_id` ou `apolice_id`.
5. Substituir logos hardcoded por leitura de `logo_url`, mantendo fallback visual por iniciais.

## Consequencias

### Beneficios

- cadastro auto-gerenciavel pelo usuario
- menos regra fixa no frontend
- exibicao consistente de seguradoras por produto
- suporte a anexos operacionais por entidade

### Custos

- migracoes SQL
- bucket(s) de storage
- ajuste em selects, badges e telas de cadastro
- revisao de consultas que hoje leem apenas `nome_canonico`

## Observacoes de implementacao

- documentos devem ficar em bucket privado
- logos e imagens podem usar bucket publico ou private + signed URL; a escolha depende da politica de cache desejada
- o front deve consumir um shape unico de seguradora contendo `id`, `nome_canonico`, `logo_url`, `produtos`
