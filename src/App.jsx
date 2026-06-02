import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Layout from './components/Layout'
import { PageSkeleton } from './components/Skeleton'

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

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-dark-bg">
      <svg className="w-6 h-6 animate-spin text-brand-accent" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LazyLogin />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index         element={<Dashboard />} />
          <Route path="fichas" element={<Fichas />} />
          <Route path="fichas/:id" element={<FichaDetalhePage />} />
          <Route path="emissoes" element={<GestaoEmissoes />} />
          <Route path="minhas-fichas" element={<MinhasFichas />} />
          <Route path="relatorio" element={<Relatorio />} />
          <Route path="imobiliarias" element={<Imobiliarias />} />
          <Route path="imobiliarias/:id" element={<ImobiliariaDetalhe />} />
          <Route path="seguradoras" element={<Seguradoras />} />
          <Route path="apolices" element={<ApolicesDashboard />} />
          <Route path="apolices/gestao" element={<ApoicesGestao />} />
          <Route path="apolices/lista" element={<ApolicesLista />} />
          <Route path="apolices/:id" element={<ApoliceDetalhe />} />
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
