# CLAUDE.md — Sistema de Gestão de Fichas — Conves Corretora

## Sobre o Projeto

Sistema interno de gestão de fichas de seguro fiança da Conves Corretora de Seguros.
Projeto real, evolutivo — cresce e se aperfeiçoa com o uso.
Substitui planilhas por um sistema web estruturado com banco de dados robusto.

## Skills Ativas — Ler antes de qualquer execução

```
/mnt/skills/user/token-efficiency/     → SEMPRE ativo. Respostas enxutas sem perder qualidade.
/mnt/skills/user/claude-mem-main/      → Planejar toda execução antes de iniciar qualquer código.
/mnt/skills/user/everything/           → Pensar profundamente em planejamentos e decisões.
/mnt/skills/user/get-shit-done-main/   → Planejar detalhado, depois executar com foco.
/mnt/skills/user/ralph-main/           → Autonomia aprovada. Prosseguir sem pedir confirmação a cada passo.
/mnt/skills/user/ui-ux/               → Aplicar em todo trabalho de frontend.
/mnt/skills/user/awesome-claude-code/  → Explorar e aplicar skills relevantes do ecossistema.
```

**Skills externas recomendadas do awesome-agent-skills:**
- `supabase/postgres-best-practices` → aplicar em todo SQL e RLS
- `anthropics/frontend-design` → padrões de UI/UX para React
- `vercel` → deploy e configuração

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React + Tailwind CSS |
| Banco | Supabase (PostgreSQL + Auth + RLS) |
| Entrada | Google Forms → Apps Script → n8n → Supabase |
| Deploy | Vercel |

## Produtos

| Produto | `produto` no banco |
|---------|-------------------|
| Residencial Pessoa Física | `residencial_pf` |
| Comercial Pessoa Física | `comercial_pf` |
| Pessoa Jurídica | `pessoa_juridica` |

## Fluxo de Status

```
[webhook] → pendente
[assumir] → em_cotacao
[finalizar] → aprovado | recusado | emitido | cancelado | cpf_invalido | em_analise
```

**Fichas Passadas:** `em_analise`, `aprovado`, `recusado`
**Fichas em Aberto:** todos os outros status

## Regras de Negócio

1. Qualquer usuário pode assumir ficha em aberto não assumida
2. Ao assumir: `assumida=true`, `orcamentista_id=auth.uid()`, `status=em_cotacao`, `assumida_em=NOW()`
3. Só o orçamentista que assumiu pode finalizar
4. Ao finalizar: preencher status final + seguradora + retorno_enviado
5. "Minhas fichas em aberto": `orcamentista_id = auth.uid()` AND `status = em_cotacao`
6. `orcamentista_forms`: selecionado no Google Forms, não relacionado ao login

## Regras de Código

- Variáveis de ambiente para todas as credenciais
- `anon key` apenas no frontend — `service_role` apenas no n8n
- RLS ativa em todas as tabelas — nunca desabilitar
- Comentar toda lógica de negócio
- Componentes funcionais React, sem over-engineering
- Seguir `supabase/postgres-best-practices` em todo SQL
