import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './services/authStore'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import InventoryPage from './pages/InventoryPage'
import AddItemPage from './pages/AddItemPage'
import ItemDetailPage from './pages/ItemDetailPage'
import Layout from './components/Layout'

function RequireAuth({ children }) {
  const token = useAuthStore((s) => s.token)
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { token, fetchMe } = useAuthStore()

  useEffect(() => {
    if (token) fetchMe()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<InventoryPage />} />
          <Route path="add" element={<AddItemPage />} />
          <Route path="item/:id" element={<ItemDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
