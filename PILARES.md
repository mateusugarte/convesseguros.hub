# PILARES DO SISTEMA — Responsividade, Velocidade e Segurança
# Conves Corretora de Seguros

> Documento vivo. Cada nível é implementado conforme o sistema cresce.
> Nível 1 = base obrigatória | Nível 2 = recomendado | Nível 3 = avançado

---

## PILAR 1 — RESPONSIVIDADE

### Nível 1 — Base (implementar agora)

**Breakpoints definidos:**
```css
/* Mobile first */
sm:  640px   /* tablet pequeno */
md:  768px   /* tablet */
lg:  1024px  /* laptop */
xl:  1280px  /* desktop */
2xl: 1440px  /* desktop grande */
```

**Sidebar adaptável:**
```
Desktop (lg+):  sidebar fixa expandida (240px)
Laptop (md-lg): sidebar fixa colapsada (64px — só ícones)
Tablet/Mobile:  sidebar vira drawer — hamburguer no header
```

**Kanban em telas menores:**
```
Desktop xl+:    7 colunas visíveis
Laptop lg:      5-6 colunas + scroll horizontal suave com indicadores
Tablet md:      3 colunas + scroll com snap
Mobile:         1 coluna por vez + navegação por swipe
```

**Tabelas responsivas:**
```
Desktop:  todas as colunas visíveis
Tablet:   esconder colunas menos importantes (IPTU, CEP, observações)
Mobile:   card por linha ao invés de tabela horizontal
```

**Modais e drawers:**
```
Desktop:  drawer lateral 480px
Tablet:   drawer lateral 100% width
Mobile:   bottom sheet (sobe de baixo)
```

**Touch targets:**
- Botões e links: mínimo 44x44px em mobile
- Cards do Kanban: área de toque generosa
- Inputs: font-size mínimo 16px (evita zoom no iOS)

---

### Nível 2 — Refinamento (próxima sprint)

- Testar em dispositivos reais: iPhone, Android, iPad
- Orientação landscape em tablet funcionando bem
- Scrollbar customizada em webkit (Kanban)
- Gestos de swipe no Kanban mobile

---

### Nível 3 — Avançado (futuro)

- PWA (Progressive Web App) — instalar como app no celular
- Notificações push nativas
- Modo offline para visualização de fichas recentes

---

## PILAR 2 — VELOCIDADE

### Nível 1 — Base (implementar agora)

**Paginação correta no Supabase:**
```javascript
// NUNCA buscar tudo de uma vez
const ITEMS_PER_PAGE = 50

const { data, count } = await supabase
  .from('fichas')
  .select('*', { count: 'exact' })
  .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1)
  .order('created_at', { ascending: false })
```

**Queries de contagem separadas dos dados:**
```javascript
// KPIs — só count, sem dados
const { count } = await supabase
  .from('fichas')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'pendente')

// Dados — só campos necessários, não SELECT *
const { data } = await supabase
  .from('fichas')
  .select('id, nome_interessado, imobiliaria, status, created_at, produto')
```

**Índices no Supabase (já criados — verificar se estão ativos):**
```sql
CREATE INDEX IF NOT EXISTS idx_fichas_produto     ON fichas(produto);
CREATE INDEX IF NOT EXISTS idx_fichas_status      ON fichas(status);
CREATE INDEX IF NOT EXISTS idx_fichas_created_at  ON fichas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fichas_imobiliaria ON fichas(imobiliaria);

-- Índice composto para filtros combinados (mais comum)
CREATE INDEX IF NOT EXISTS idx_fichas_produto_status
ON fichas(produto, status, created_at DESC);
```

**Lazy loading de componentes React:**
```javascript
// Carregar páginas só quando necessário
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Fichas    = lazy(() => import('./pages/Fichas'))

// Envolver com Suspense
<Suspense fallback={<PageSkeleton />}>
  <Routes>...</Routes>
</Suspense>
```

**Skeleton screens (não spinners):**
- Kanban: skeleton de colunas e cards ao carregar
- Dashboard: skeleton dos KPIs e gráficos
- Tabelas: skeleton de linhas

---

### Nível 2 — Refinamento (próxima sprint)

**Cache de dados no frontend:**
```javascript
// React Query ou SWR para cache inteligente
import { useQuery } from '@tanstack/react-query'

const { data } = useQuery({
  queryKey: ['fichas', produto, mes, status],
  queryFn: () => buscarFichas(produto, mes, status),
  staleTime: 30 * 1000,    // dados frescos por 30s
  cacheTime: 5 * 60 * 1000 // manter em cache por 5min
})
```

**Virtualização de listas longas:**
```javascript
// Para tabelas com 100+ itens visíveis
import { useVirtualizer } from '@tanstack/react-virtual'
// Renderiza só os itens visíveis na tela
```

**Otimização de imagens:**
- Logo Conves: usar WebP + srcset
- Avatares: gerar iniciais em CSS (sem imagem)

---

### Nível 3 — Avançado (futuro)

- Service Worker para cache offline
- Prefetch de rotas ao hover nos links da sidebar
- Bundle splitting por rota
- CDN para assets estáticos
- Análise de bundle: `npm run build -- --stats`

---

## PILAR 3 — SEGURANÇA

### Nível 1 — Base (implementar agora)

**RLS — verificar todas as policies:**
```sql
-- Confirmar que estão ativas
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Listar todas as policies ativas
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';
```

**Policies obrigatórias — confirmar existência:**
```sql
-- fichas: leitura apenas autenticados
-- fichas: insert apenas service_role (n8n) + autenticados (CRUD manual)
-- fichas: update apenas autenticados
-- fichas: delete apenas autenticados
-- profiles: leitura apenas autenticados
```

**Variáveis de ambiente — nunca no código:**
```
✅ .env.local (nunca commitar)
✅ Vercel Environment Variables
❌ Nunca hardcodar no JSX/JS
❌ service_role key nunca no frontend
```

**Verificar .gitignore:**
```
.env
.env.local
.env.production
*.env
```

**Sanitização de inputs:**
```javascript
// Inputs do usuário nunca vão direto para query
// Supabase já usa prepared statements — proteção contra SQL injection
// Validar tipos antes de enviar:

function validarFicha(dados) {
  if (!dados.nome_interessado?.trim()) throw new Error('Nome obrigatório')
  if (!dados.cpf?.match(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)) throw new Error('CPF inválido')
  if (!dados.produto) throw new Error('Produto obrigatório')
  return true
}
```

**Timeout de sessão:**
```javascript
// Supabase Auth — configurar no dashboard
// Authentication → Settings:
// JWT expiry: 3600 (1 hora)
// Refresh token rotation: ON
// Refresh token reuse interval: 10s
```

---

### Nível 2 — Refinamento (próxima sprint)

**Log de auditoria — registrar ações críticas:**
```sql
CREATE TABLE public.audit_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  TIMESTAMP DEFAULT NOW(),
  user_id     UUID REFERENCES profiles(id),
  action      TEXT, -- 'assumir_ficha' | 'finalizar_ficha' | 'excluir_ficha' | 'editar_ficha'
  ficha_id    UUID REFERENCES fichas(id),
  dados_antes JSONB,
  dados_depois JSONB
);
```

**Rate limiting no n8n:**
- Limitar inserções do webhook a X requisições por minuto
- Bloquear IPs suspeitos

**Headers de segurança (vercel.json):**
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" }
      ]
    }
  ],
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

### Nível 3 — Avançado (futuro)

- 2FA (autenticação em dois fatores) via Supabase Auth
- LGPD: política de retenção de dados, exportação e exclusão por solicitação
- Backup automático do banco (Supabase já faz diário — verificar plano)
- Monitoramento de acessos suspeitos (tentativas de login, IPs)
- Penetration testing antes de expandir o sistema para todos os setores

---

## CHECKLIST IMEDIATO — O que fazer agora

### Responsividade
- [ ] Sidebar vira drawer em tablet/mobile
- [ ] Kanban com scroll + snap em telas menores
- [ ] Tabelas viram cards em mobile
- [ ] Touch targets mínimo 44px

### Velocidade
- [ ] Paginação em todas as queries (50 itens/página)
- [ ] SELECT só nos campos necessários (não SELECT *)
- [ ] Índices compostos criados no Supabase
- [ ] Lazy loading nas rotas
- [ ] Skeleton screens em todas as cargas

### Segurança
- [ ] .gitignore com todos os .env
- [ ] RLS verificada em todas as tabelas
- [ ] service_role key fora do frontend
- [ ] Validação de inputs no formulário de criação manual
- [ ] Headers de segurança no vercel.json
- [ ] JWT expiry configurado no Supabase Auth

---

## PROMPT PARA O CLAUDE CODE

```
Implemente os 3 pilares do sistema Conves conforme o documento PILARES.md.
token-efficiency ativo. ralph-main ativo.

Executar apenas o Nível 1 de cada pilar nesta sessão.
Começar pela Segurança (mais crítico), depois Velocidade, depois Responsividade.
Ao final de cada pilar, mostrar o que foi feito em bullet points e avançar.
```
