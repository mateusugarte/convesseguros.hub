# PAGE CONTEXT — Configuracao de leitura de PDF (setor Auto)

## Page

- Name: Configurar cotacoes Auto / Configurar apolices Auto
- Route:
  - `/configuracoes/auto/cotacoes` e `/configuracoes/auto/cotacoes/:seguradoraId`
  - `/configuracoes/auto/apolices` e `/configuracoes/auto/apolices/:seguradoraId`
- Domain: Configuracoes · Seguro Auto

## Purpose

Configurar, seguradora por seguradora, de onde o sistema le cada informacao dentro do PDF de
cotacao (orcamento) e de apolice (proposta/apolice emitida). O mapeamento confirmado aqui passa
a ser usado na extracao automatica das telas de Auto.

## Components Used

- `AutoPdfConfigLista.jsx` — grade de cards de seguradora (verde = configurada, amarelo = em
  configuracao, vermelho = nao configurada), com barra de progresso por seguradora.
- `AutoPdfConfigSeguradora.jsx` — workspace de mapeamento: upload da amostra, visualizador do PDF
  na propria tela, revisao campo a campo e conclusao.
- `SeguradoraBadge` (logo da seguradora), `PageHeader`, `EmptyState`, `useToast`, `useAuth`.
- `src/lib/autoPdfCampos.js` — catalogo dos campos que o sistema pede (fonte de verdade da tela).
- `src/lib/autoPdfMapeamento.js` — motor puro de sugestao/aplicacao do mapeamento (testado em
  `src/lib/autoPdfMapeamento.test.mjs`).
- `src/lib/autoPdfConfig.js` — Supabase, storage da amostra e leitura do texto do PDF.

## Queries / Data Access

- `listarSeguradorasAuto()` — catalogo de seguradoras com produto `auto` (fallback: todas ativas).
- `fetchMapeamentos(tipo)` / `fetchMapeamento(seguradoraId, tipo)` — tabela `auto_pdf_mapeamentos`.
- `salvarMapeamento(...)` — upsert por `(seguradora_id, tipo)`.
- `limparMapeamento(...)` — apaga a linha e o PDF de amostra.
- Storage: bucket privado `entidade-documentos`, prefixo
  `seguradora/<id>/auto-pdf/<tipo>/`. A URL do visualizador e assinada (1h).
- Sem realtime, sem paginacao (o volume e o numero de seguradoras cadastradas).

## Status

- ready (depende da migration `supabase/62_auto_pdf_mapeamentos.sql` estar aplicada)

## Users

- Administrativo e Seguro Auto — quem opera cotacao e emissao e conhece os PDFs de cada portal.

## Notes

- O mapeamento guarda a **ancora** (o rotulo como aparece no PDF) e nao coordenadas: layout
  reformulado nao invalida a configuracao inteira.
- Campo sem rotulo no PDF e resolvido por tipo + ocorrencia (ex.: o 2o CPF do documento).
- Campo pode ser marcado como inexistente naquela seguradora; ele deixa de ser cobrado.
- Concluir exige todos os campos obrigatorios confirmados; os opcionais podem ficar pendentes.
- O PDF de amostra carrega dados reais de cliente — por isso vai para bucket privado e o texto
  extraido fica na coluna `amostra_texto` da propria linha, protegida pela RLS da tabela.
- PDF digitalizado (imagem) nao tem texto: a tela avisa e o mapeamento nao e possivel.
- Em producao a leitura entra por `lerPdfAuto(file, tipo)`; sem mapeamento concluido o parser
  generico (`autoPdfParser.js`) continua respondendo sozinho.

## Handoff Checklist

- Read `docs/IA_ORCHESTRATOR.md`
- Read `docs/PROJECT_CONTEXT.md`
- Read `ROADMAP.md`
- Read `docs/CURRENT_TASK.md`
- Read this page's `CONTEXT.md`
- Update `docs/CURRENT_TASK.md` before and after the task
