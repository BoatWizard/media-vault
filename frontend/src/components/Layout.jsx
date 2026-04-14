import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../services/authStore'
import { useQueryClient } from '@tanstack/react-query'
import { Package, PlusCircle, LogOut, UserCircle, Heart } from 'lucide-react'

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const handleLogout = () => {
    logout()
    queryClient.clear()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="bg-ink-900 border-b border-ink-700 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <span className="font-display text-2xl text-acid tracking-wider">VAULT</span>
          <nav className="flex items-center gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-body transition-colors ${
                  isActive ? 'text-acid' : 'text-chrome-dim hover:text-chrome'
                }`
              }
            >
              <Package size={15} />
              Inventory
            </NavLink>
            <NavLink
              to="/add"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-body transition-colors ${
                  isActive ? 'text-acid' : 'text-chrome-dim hover:text-chrome'
                }`
              }
            >
              <PlusCircle size={15} />
              Add Item
            </NavLink>
            <NavLink
              to="/wishlist"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-body transition-colors ${
                  isActive ? 'text-acid' : 'text-chrome-dim hover:text-chrome'
                }`
              }
            >
              <Heart size={15} />
              Wishlist
            </NavLink>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <Link
              to="/account"
              className="flex items-center gap-1.5 text-xs font-mono text-chrome-dim hover:text-chrome transition-colors hidden sm:flex"
            >
              <UserCircle size={14} />
              {user.username}
            </Link>
          )}
          <button onClick={handleLogout} className="text-chrome-dim hover:text-acid transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 container mx-auto px-4 py-6 max-w-6xl">
        <Outlet />
      </main>
    </div>
  )
}
