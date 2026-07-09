import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout.jsx'
import LoginPage from './pages/LoginPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import MapPage from './pages/MapPage.jsx'
import DevicesPage from './pages/DevicesPage.jsx'
import AlertsPage from './pages/AlertsPage.jsx'
import InventoryPage from './pages/InventoryPage.jsx'
import AgentsPage from './pages/AgentsPage.jsx'
import RecoveryRoomsPage from './pages/RecoveryRoomsPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard',        element: <DashboardPage /> },
      { path: 'map',              element: <MapPage /> },
      { path: 'devices',          element: <DevicesPage /> },
      { path: 'alerts',           element: <AlertsPage /> },
      { path: 'inventory',        element: <InventoryPage /> },
      { path: 'agents',           element: <AgentsPage /> },
      { path: 'recovery-rooms',   element: <RecoveryRoomsPage /> },
      { path: 'settings',         element: <SettingsPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

export default function App() {
  return <RouterProvider router={router} />
}
