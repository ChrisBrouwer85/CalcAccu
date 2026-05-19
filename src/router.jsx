import { createHashRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import AppShell from './AppShell.jsx'
import AuthPage from './components/AuthPage.jsx'
import DataPage from './pages/DataPage.jsx'
import PricesPage from './pages/PricesPage.jsx'
import SimulationPage from './pages/SimulationPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import { PriceProvider } from './context/PriceContext.jsx'

// eslint-disable-next-line react-refresh/only-export-components
function RequireAuth() {
  const { user } = useAuth()
  if (user === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    )
  }
  if (user === null) return <Navigate to="/auth" replace />
  return <Outlet />
}

// eslint-disable-next-line react-refresh/only-export-components
function PublicOnly() {
  const { user } = useAuth()
  if (user === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    )
  }
  if (user) return <Navigate to="/data" replace />
  return <Outlet />
}

// HashRouter so deep links survive page refresh under GitHub Pages'
// static hosting without needing a 404.html SPA shim. URLs look like
// /CalcAccu/#/data — the path before the # is the deployed base, the
// part after is the in-app route.
export const router = createHashRouter([
  {
    element: <PublicOnly />,
    children: [
      { path: '/auth', element: <AuthPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <PriceProvider><AppShell /></PriceProvider>,
        children: [
          { index: true, element: <Navigate to="/data" replace /> },
          { path: '/data', element: <DataPage /> },
          { path: '/prices', element: <PricesPage /> },
          { path: '/simulation', element: <SimulationPage /> },
          { path: '/settings', element: <SettingsPage /> },
          { path: '*', element: <Navigate to="/data" replace /> },
        ],
      },
    ],
  },
])
