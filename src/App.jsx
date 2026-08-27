import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Layout from './components/Layout'
import { PageLoader } from './components/ui/PageLoader'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,       // data considered fresh for 30s
      gcTime:    5 * 60 * 1000,   // cache retained for 5min
      retry: 1,
    },
  },
})

// Pages loaded only when first visited
const Dashboard        = lazy(() => import('./pages/Dashboard'))
const Fichas           = lazy(() => import('./pages/Fichas'))
const FichaDetalhePage = lazy(() => import('./pages/FichaDetalhePage'))
const GestaoEmissoes   = lazy(() => import('./pages/GestaoEmissoes'))
const MinhasFichas     = lazy(() => import('./pages/MinhasFichas'))
const Relatorio        = lazy(() => import('./pages/Relatorio'))
const Imobiliarias       = lazy(() => import('./pages/Imobiliarias'))
const ImobiliariaDetalhe = lazy(() => import('./pages/ImobiliariaDetalhe'))
const ApolicesDashboard  = lazy(() => import('./pages/ApolicesDashboard'))
const ApoicesGestao      = lazy(() => import('./pages/ApoicesGestao'))
const ApolicesLista      = lazy(() => import('./pages/ApolicesLista'))
const ApoliceDetalhe     = lazy(() => import('./pages/ApoliceDetalhe'))
const Seguradoras        = lazy(() => import('./pages/Seguradoras'))
const Financeiro          = lazy(() => import('./pages/Financeiro/Financeiro'))
const FinanceiroVisaoGeral = lazy(() => import('./pages/Financeiro/FinanceiroVisaoGeral'))
const FinanceiroProducaoLista = lazy(() => import('./pages/Financeiro/FinanceiroProducaoLista'))
const FinanceiroProducao  = lazy(() => import('./pages/Financeiro/FinanceiroProducao'))
const FinanceiroProducaoApolices = lazy(() => import('./pages/Financeiro/FinanceiroProducaoApolices'))
const FinanceiroFaturasLista  = lazy(() => import('./pages/Financeiro/FinanceiroFaturasLista'))
const FinanceiroFaturas       = lazy(() => import('./pages/Financeiro/FinanceiroFaturas'))
const FinanceiroFaturaImobiliaria = lazy(() => import('./pages/Financeiro/FinanceiroFaturaImobiliaria'))
const FinanceiroFaturaDetalhe = lazy(() => import('./pages/Financeiro/FinanceiroFaturaDetalhe'))

// Área Auto
const AutoDashboard  = lazy(() => import('./pages/auto/AutoDashboard'))
const AutoRenovacoes = lazy(() => import('./pages/auto/AutoRenovacoes'))
const AutoRenovacoesPlanilha = lazy(() => import('./pages/auto/AutoRenovacoesPlanilha'))
const AutoRenovacoesPuxar = lazy(() => import('./pages/auto/AutoRenovacoesPuxar'))
const AutoEmissoes   = lazy(() => import('./pages/auto/AutoEmissoes'))
const AutoEmissoesPlanilha = lazy(() => import('./pages/auto/AutoEmissoesPlanilha'))
const AutoClientes   = lazy(() => import('./pages/auto/AutoClientesV2'))
const AutoClientesVerificacao = lazy(() => import('./pages/auto/AutoClientesVerificacao'))
const AutoClienteDetalhe = lazy(() => import('./pages/auto/AutoClienteDetalheV2'))
const AutoApoliceDetalhe = lazy(() => import('./pages/auto/AutoApoliceDetalheV2'))
const AutoCotacoes   = lazy(() => import('./pages/auto/AutoCotacoes'))
const AutoCotacoesConsulta = lazy(() => import('./pages/auto/AutoCotacoesConsulta'))
const AutoCotacaoDetalhe = lazy(() => import('./pages/auto/AutoCotacaoDetalhe'))
const AutoSinistros  = lazy(() => import('./pages/auto/AutoSinistrosV2'))
const AutoEtiquetas  = lazy(() => import('./pages/auto/AutoEtiquetasV2'))

// Área Comercial
const ComercialDashboard = lazy(() => import('./pages/comercial/ComercialDashboard'))
const GestaoComercial    = lazy(() => import('./pages/comercial/GestaoComercial'))
const Pipeline           = lazy(() => import('./pages/comercial/Pipeline'))
const BaseLeads          = lazy(() => import('./pages/comercial/BaseLeads'))
const LeadDetalhe        = lazy(() => import('./pages/comercial/LeadDetalhe'))
const Vendas             = lazy(() => import('./pages/comercial/Vendas'))
const Calendario         = lazy(() => import('./pages/comercial/Calendario'))
const Jornadas           = lazy(() => import('./pages/comercial/Jornadas'))
const Configuracoes      = lazy(() => import('./pages/Configuracoes'))
const AutoPdfConfigLista       = lazy(() => import('./pages/config/AutoPdfConfigLista'))
const AutoPdfConfigSeguradora  = lazy(() => import('./pages/config/AutoPdfConfigSeguradora'))

// Treinamentos
const TreinamentosDashboard = lazy(() => import('./pages/treinamentos/TreinamentosDashboard'))
const TreinamentosSetor     = lazy(() => import('./pages/treinamentos/TreinamentosSetor'))
const TreinamentosModulo    = lazy(() => import('./pages/treinamentos/TreinamentosModulo'))
const TreinamentosLicao     = lazy(() => import('./pages/treinamentos/TreinamentosLicao'))
const TreinamentosAdminQuizzes     = lazy(() => import('./pages/treinamentos/admin/TreinamentosAdminQuizzes'))
const TreinamentosAdminQuizDetalhe = lazy(() => import('./pages/treinamentos/admin/TreinamentosAdminQuizDetalhe'))

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  return user ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { profile, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!profile?.is_admin) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LazyLogin />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index         element={<Dashboard />} />
          <Route path="fichas" element={<Fichas />} />
          <Route path="fichas/residencial" element={<Fichas />} />
          <Route path="fichas/comercial-pf" element={<Fichas />} />
          <Route path="fichas/pessoa-juridica" element={<Fichas />} />
          <Route path="fichas/todos" element={<Fichas />} />
          <Route path="fichas/:id" element={<FichaDetalhePage />} />
          <Route path="emissoes" element={<GestaoEmissoes />} />
          <Route path="minhas-fichas" element={<MinhasFichas />} />
          <Route path="relatorio" element={<Relatorio />} />
          <Route path="relatorio/:imobiliariaId" element={<Relatorio />} />
          <Route path="imobiliarias" element={<Imobiliarias />} />
          <Route path="imobiliarias/:id" element={<ImobiliariaDetalhe />} />
          <Route path="seguradoras" element={<Seguradoras />} />
          <Route path="financeiro" element={<AdminRoute><Financeiro /></AdminRoute>}>
            <Route index element={<FinanceiroVisaoGeral />} />
            <Route path="producao" element={<FinanceiroProducaoLista />} />
            <Route path="producao/:imobiliaria" element={<FinanceiroProducao />} />
            <Route path="producao/:imobiliaria/apolices" element={<FinanceiroProducaoApolices />} />
            <Route path="faturas" element={<FinanceiroFaturasLista />} />
            <Route path="faturas/conferencia" element={<FinanceiroFaturas />} />
            <Route path="faturas/:imobiliaria" element={<FinanceiroFaturaImobiliaria />} />
            <Route path="faturas/:imobiliaria/:mes" element={<FinanceiroFaturaDetalhe />} />
          </Route>
          <Route path="apolices" element={<ApolicesDashboard />} />
          <Route path="apolices/gestao" element={<ApoicesGestao />} />
          <Route path="apolices/lista" element={<ApolicesLista />} />
          <Route path="apolices/:id" element={<ApoliceDetalhe />} />
          {/* Área Auto */}
          <Route path="auto"                element={<AutoDashboard />} />
          <Route path="auto/gestao"         element={<AutoEmissoes />} />
          <Route path="auto/renovacoes"     element={<AutoRenovacoes />} />
          <Route path="auto/renovacoes/planilha" element={<AutoRenovacoesPlanilha />} />
          <Route path="auto/renovacoes/puxar" element={<AutoRenovacoesPuxar />} />
          <Route path="auto/emissoes"       element={<AutoEmissoes />} />
          <Route path="auto/emissoes/planilha" element={<AutoEmissoesPlanilha />} />
          <Route path="auto/emissoes/:id"   element={<AutoEmissoes />} />
          <Route path="auto/clientes"       element={<AutoClientes />} />
          <Route path="auto/clientes/verificacao" element={<AutoClientesVerificacao />} />
          <Route path="auto/clientes/:id"   element={<AutoClienteDetalhe />} />
          <Route path="auto/apolices/:id"   element={<AutoApoliceDetalhe />} />
          <Route path="auto/cotacoes"       element={<AutoCotacoes />} />
          <Route path="auto/cotacoes/consulta" element={<AutoCotacoesConsulta />} />
          <Route path="auto/cotacoes/:id" element={<AutoCotacaoDetalhe />} />
          <Route path="auto/sinistros"      element={<AutoSinistros />} />
          <Route path="auto/etiquetas"      element={<AutoEtiquetas />} />
          {/* Área Comercial */}
          <Route path="comercial"            element={<ComercialDashboard />} />
          <Route path="comercial/gestao"     element={<GestaoComercial />} />
          <Route path="comercial/pipeline"   element={<Pipeline />} />
          <Route path="comercial/leads"      element={<BaseLeads />} />
          <Route path="comercial/leads/:id"  element={<LeadDetalhe />} />
          <Route path="comercial/vendas"     element={<Vendas />} />
          <Route path="comercial/calendario" element={<Calendario />} />
          <Route path="comercial/jornadas"   element={<Jornadas />} />
          <Route path="configuracoes"        element={<Configuracoes />} />
          {/* Configuracao da leitura de PDF por seguradora (setor Auto) */}
          <Route path="configuracoes/auto/cotacoes"                element={<AutoPdfConfigLista tipo="cotacao" />} />
          <Route path="configuracoes/auto/cotacoes/:seguradoraId"  element={<AutoPdfConfigSeguradora tipo="cotacao" />} />
          <Route path="configuracoes/auto/apolices"                element={<AutoPdfConfigLista tipo="apolice" />} />
          <Route path="configuracoes/auto/apolices/:seguradoraId"  element={<AutoPdfConfigSeguradora tipo="apolice" />} />
          {/* Treinamentos */}
          <Route path="treinamentos"                    element={<TreinamentosDashboard />} />
          <Route path="treinamentos/setores/:setorId"   element={<TreinamentosSetor />} />
          <Route path="treinamentos/modulos/:moduloId"  element={<TreinamentosModulo />} />
          <Route path="treinamentos/licoes/:licaoId"    element={<TreinamentosLicao />} />
          <Route path="treinamentos/admin" element={<AdminRoute><TreinamentosAdminQuizzes /></AdminRoute>} />
          <Route path="treinamentos/admin/quiz/:nodeId" element={<AdminRoute><TreinamentosAdminQuizDetalhe /></AdminRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

const LazyLogin = lazy(() => import('./pages/Login'))

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <AppRoutes />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}


