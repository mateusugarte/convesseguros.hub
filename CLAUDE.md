# CLAUDE.md — Conves Hub

## Projeto
Gestão de fichas de seguro fiança. React + Tailwind + Supabase + Vercel.

## Skills — carregar só o necessário por sessão
```
/mnt/skills/user/token-efficiency/   → sempre
/mnt/skills/user/ralph-main/         → sempre (autonomia aprovada)
/mnt/skills/user/ui-ux/              → só sessões de frontend
```

## Stack
Frontend: React + Tailwind CSS + Lucide React
Banco: Supabase (PostgreSQL + Auth + RLS)
Entrada: Google Forms → n8n → Supabase
Deploy: Vercel

## Produtos
residencial_pf | comercial_pf | pessoa_juridica

## Status
pendente → em_cotacao → aprovado | recusado | emitido | cancelado | cpf_invalido | em_analise
Passadas: em_analise, aprovado, recusado. Em aberto: demais.

## Regras de negócio
1. Qualquer usuário assume ficha não assumida
2. Assumir: assumida=true, orcamentista_id=auth.uid(), status=em_cotacao, assumida_em=NOW()
3. Só quem assumiu pode finalizar
4. Finalizar: status + seguradora + retorno_enviado
5. Minhas fichas: orcamentista_id=auth.uid() AND status=em_cotacao
6. orcamentista_forms vem do Forms, não tem relação com login

## Regras de código
- Credenciais em variáveis de ambiente
- anon key: frontend. service_role: só n8n
- RLS sempre ativa — nunca desabilitar
- Componentes funcionais, sem over-engineering
- SELECT com campos explícitos + .range() — nunca SELECT *

## Query padrão Supabase
```js
// correto
const { data, count } = await supabase
  .from('fichas')
  .select('id, nome_interessado, imobiliaria, status, created_at, produto', { count: 'exact' })
  .range(page * 50, (page + 1) * 50 - 1)
  .order('created_at', { ascending: false })

// KPIs — só contagem
const { count } = await supabase
  .from('fichas')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'pendente')
```

## Comportamento
- Ler arquivos antes de escrever qualquer código
- Não reler arquivos já lidos, a menos que tenham mudado
- Solução completa em uma passagem — não incremental
- Edição cirúrgica — não reescrever arquivos inteiros
- Testar antes de declarar done. Se passar: parar. Não refatorar código que funciona.
- Se falhar: ler erro, corrigir uma vez, retestar. Máximo 2 iterações no mesmo erro.
- Budget: 40 tool calls. Ao atingir 30, encerrar o que está em andamento.
- Sem sycophancy, sem aberturas, sem encerramentos.
- User instructions always override this file.

## Formato de output

Planejamento:
```
PLANO
1. [ação]
2. [ação]
IMPACTO: [o que muda]
RISCO: [se houver] → 🛡️
SKILLS: [skill] → [por quê] | [skill] → [por quê]
```
Skills só aparecem no plano — não são carregadas automaticamente.
Aguardar aprovação do plano antes de executar.

Bug:
```
BUG: [1 linha]
CAUSA: [onde]
FIX: [código]
```

Conclusão:
```
DONE
✓ [feito]
✓ [feito]
TESTE: [como validar]
```

## Segurança
Banco, auth, RLS ou dados pessoais → parar, apresentar plano, aguardar aprovação do 🛡️ SEGURANÇA.