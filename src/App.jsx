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
const Financeiro         = lazy(() => import('./pages/Financeiro'))

// Área Auto
const AutoDashboard  = lazy(() => import('./pages/auto/AutoDashboard'))
const AutoRenovacoes = lazy(() => import('./pages/auto/AutoRenovacoes'))
const AutoEmissoes   = lazy(() => import('./pages/auto/AutoEmissoes'))
const AutoClientes   = lazy(() => import('./pages/auto/AutoClientes'))
const AutoCotacoes   = lazy(() => import('./pages/auto/AutoCotacoes'))
const AutoCotacoesConsulta = lazy(() => import('./pages/auto/AutoCotacoesConsulta'))
const AutoCotacaoDetalhe = lazy(() => import('./pages/auto/AutoCotacaoDetalhe'))
const AutoSinistros  = lazy(() => import('./pages/auto/AutoSinistros'))

// Área Comercial
const ComercialDashboard = lazy(() => import('./pages/comercial/ComercialDashboard'))
const Pipeline           = lazy(() => import('./pages/comercial/Pipeline'))
const BaseLeads          = lazy(() => import('./pages/comercial/BaseLeads'))
const LeadDetalhe        = lazy(() => import('./pages/comercial/LeadDetalhe'))
const Vendas             = lazy(() => import('./pages/comercial/Vendas'))
const Calendario         = lazy(() => import('./pages/comercial/Calendario'))
const Jornadas           = lazy(() => import('./pages/comercial/Jornadas'))
const Configuracoes      = lazy(() => import('./pages/Configuracoes'))

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  return user ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { profile, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!profile.is_admin) return <Navigate to="/" replace />
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
          <Route path="imobiliarias" element={<Imobiliarias />} />
          <Route path="imobiliarias/:id" element={<ImobiliariaDetalhe />} />
          <Route path="seguradoras" element={<Seguradoras />} />
          <Route path="financeiro" element={<AdminRoute><Financeiro /></AdminRoute>} />
          <Route path="apolices" element={<ApolicesDashboard />} />
          <Route path="apolices/gestao" element={<ApoicesGestao />} />
          <Route path="apolices/lista" element={<ApolicesLista />} />
          <Route path="apolices/:id" element={<ApoliceDetalhe />} />
          {/* Área Auto */}
          <Route path="auto"                element={<AutoDashboard />} />
          <Route path="auto/renovacoes"     element={<AutoRenovacoes />} />
          <Route path="auto/emissoes"       element={<AutoEmissoes />} />
          <Route path="auto/clientes"       element={<AutoClientes />} />
          <Route path="auto/cotacoes"       element={<AutoCotacoes />} />
          <Route path="auto/cotacoes/consulta" element={<AutoCotacoesConsulta />} />
          <Route path="auto/cotacoes/:id" element={<AutoCotacaoDetalhe />} />
          <Route path="auto/sinistros"      element={<AutoSinistros />} />
          {/* Área Comercial */}
          <Route path="comercial"            element={<ComercialDashboard />} />
          <Route path="comercial/pipeline"   element={<Pipeline />} />
          <Route path="comercial/leads"      element={<BaseLeads />} />
          <Route path="comercial/leads/:id"  element={<LeadDetalhe />} />
          <Route path="comercial/vendas"     element={<Vendas />} />
          <Route path="comercial/calendario" element={<Calendario />} />
          <Route path="comercial/jornadas"   element={<Jornadas />} />
          <Route path="configuracoes"        element={<Configuracoes />} />
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
