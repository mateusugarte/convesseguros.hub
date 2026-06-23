# CURRENT TASK

## Responsavel Atual

Claude

## Pagina

`src/pages/ApoicesGestao.jsx` — ModalFinalizar

## Objetivo

Automacao de preenchimento de campos via upload de PDF de apolice, com parser especifico por seguradora.

## Status

Concluido — aguardando teste com PDFs reais.

## Arquivos alterados

- `src/lib/apoliceParser.js` — criado (parsers Porto, Pottencial, Tokio Marine, Too Seguros)
- `src/pages/ApoicesGestao.jsx` — ModalFinalizar: secao de upload + botao "Preencher informacoes"
- `package.json` — dependencia pdfjs-dist adicionada

## Proximo Passo

Testar com PDFs reais de cada seguradora e ajustar regex se necessario.
