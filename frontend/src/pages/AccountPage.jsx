import { useState } from 'react'
import { NavLink, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, Users, Trash2, PenLine, Check, X } from 'lucide-react'
import api from '../services/api'
import clsx from 'clsx'

// ── Security (change password) ────────────────────────────────────────────────
function SecuritySection() {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const mutation = useMutation({
    mutationFn: (data) => api.post('/auth/change-password', data),
    onSuccess: () => {
      setSuccess(true)
      setError('')
      setForm({ current_password: '', new_password: '', confirm: '' })
    },
    onError: (err) => {
      setError(err.response?.data?.detail || 'Failed to update password')
      setSuccess(false)
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    if (form.new_password !== form.confirm) {
      setError('New passwords do not match')
      return
    }
    if (form.new_password.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }
    mutation.mutate({ current_password: form.current_password, new_password: form.new_password })
  }

  return (
    <div className="max-w-md">
      <h2 className="font-display text-xl text-chrome tracking-wide mb-1">CHANGE PASSWORD</h2>
      <p className="text-chrome-dim text-sm font-mono mb-6">Update your account password.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Current Password</label>
          <input
            type="password"
            className="input"
            value={form.current_password}
            onChange={set('current_password')}
            required
            autoComplete="current-password"
          />
        </div>
        <div>
          <label className="label">New Password</label>
          <input
            type="password"
            className="input"
            value={form.new_password}
            onChange={set('new_password')}
            required
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="label">Confirm New Password</label>
          <input
            type="password"
            className="input"
            value={form.confirm}
            onChange={set('confirm')}
            required
            autoComplete="new-password"
          />
        </div>

        {error && <p className="text-red-400 text-sm font-mono">{error}</p>}
        {success && <p className="text-green-400 text-sm font-mono">Password updated successfully.</p>}

        <button
          type="submit"
          className="btn-primary"
          disabled={mutation.isPending || !form.current_password || !form.new_password || !form.confirm}
        >
          {mutation.isPending ? 'Updating…' : 'Update Password'}
        </button>
      </form>
    </div>
  )
}

// ── Permissions ───────────────────────────────────────────────────────────────
function PermissionsSection() {
  const queryClient = useQueryClient()
  const [newUsername, setNewUsername] = useState('')
  const [newLevel, setNewLevel] = useState('read')
  const [grantError, setGrantError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editLevel, setEditLevel] = useState('')

  const { data: granted = [] } = useQuery({
    queryKey: ['permissions', 'granted'],
    queryFn: () => api.get('/permissions/granted').then((r) => r.data),
  })

  const { data: received = [] } = useQuery({
    queryKey: ['permissions', 'received'],
    queryFn: () => api.get('/permissions/received').then((r) => r.data),
  })

  const grantMutation = useMutation({
    mutationFn: (data) => api.post('/permissions', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['permissions', 'granted'])
      setNewUsername('')
      setNewLevel('read')
      setGrantError('')
    },
    onError: (err) => setGrantError(err.response?.data?.detail || 'Failed to grant access'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, permission }) => api.patch(`/permissions/${id}`, { permission }),
    onSuccess: () => {
      queryClient.invalidateQueries(['permissions', 'granted'])
      setEditingId(null)
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (id) => api.delete(`/permissions/${id}`),
    onSuccess: () => queryClient.invalidateQueries(['permissions', 'granted']),
  })

  const handleGrant = (e) => {
    e.preventDefault()
    setGrantError('')
    grantMutation.mutate({ username: newUsername.trim(), permission: newLevel })
  }

  const startEdit = (perm) => {
    setEditingId(perm.id)
    setEditLevel(perm.permission)
  }

  const LEVEL_LABEL = { read: 'Read only', read_write: 'Read & Write' }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Grant access */}
      <div>
        <h2 className="font-display text-xl text-chrome tracking-wide mb-1">INVENTORY PERMISSIONS</h2>
        <p className="text-chrome-dim text-sm font-mono mb-6">
          Share your inventory with other users. Read-only lets them browse your collection.
          Read &amp; Write lets them add and edit items too.
        </p>

        <form onSubmit={handleGrant} className="flex gap-2 flex-wrap items-end">
          <div className="flex-1 min-w-40">
            <label className="label">Username</label>
            <input
              className="input font-mono"
              placeholder="their_username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              required
            />
          </div>
          <div className="w-40">
            <label className="label">Access Level</label>
            <select className="input" value={newLevel} onChange={(e) => setNewLevel(e.target.value)}>
              <option value="read">Read only</option>
              <option value="read_write">Read &amp; Write</option>
            </select>
          </div>
          <button
            type="submit"
            className="btn-primary shrink-0"
            disabled={grantMutation.isPending || !newUsername.trim()}
          >
            {grantMutation.isPending ? '…' : 'Grant Access'}
          </button>
        </form>
        {grantError && <p className="text-red-400 text-sm font-mono mt-2">{grantError}</p>}
      </div>

      {/* Granted by me */}
      <div>
        <h3 className="text-xs font-mono text-chrome-dim uppercase tracking-wider mb-3">
          Access you've granted
        </h3>
        {granted.length === 0 ? (
          <p className="text-chrome-dim text-sm font-mono">No one has access to your inventory yet.</p>
        ) : (
          <div className="space-y-2">
            {granted.map((perm) => (
              <div key={perm.id} className="card p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-chrome font-mono text-sm">{perm.grantee_username}</p>
                  {editingId === perm.id ? (
                    <div className="flex items-center gap-2 mt-1">
                      <select
                        className="input text-xs py-1 w-36"
                        value={editLevel}
                        onChange={(e) => setEditLevel(e.target.value)}
                      >
                        <option value="read">Read only</option>
                        <option value="read_write">Read &amp; Write</option>
                      </select>
                      <button
                        onClick={() => updateMutation.mutate({ id: perm.id, permission: editLevel })}
                        className="text-green-400 hover:text-green-300"
                      >
                        <Check size={14} />
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-chrome-dim hover:text-chrome">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <p className="text-chrome-dim text-xs font-mono mt-0.5">
                      {LEVEL_LABEL[perm.permission]}
                    </p>
                  )}
                </div>
                {editingId !== perm.id && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => startEdit(perm)}
                      className="text-chrome-dim hover:text-chrome transition-colors"
                      title="Change access level"
                    >
                      <PenLine size={14} />
                    </button>
                    <button
                      onClick={() => window.confirm(`Revoke access for ${perm.grantee_username}?`) && revokeMutation.mutate(perm.id)}
                      className="text-red-500 hover:text-red-400 transition-colors"
                      title="Revoke access"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shared with me */}
      {received.length > 0 && (
        <div>
          <h3 className="text-xs font-mono text-chrome-dim uppercase tracking-wider mb-3">
            Inventories shared with you
          </h3>
          <div className="space-y-2">
            {received.map((perm) => (
              <div key={perm.id} className="card p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-chrome font-mono text-sm">{perm.owner_username}</p>
                  <p className="text-chrome-dim text-xs font-mono mt-0.5">
                    {LEVEL_LABEL[perm.permission]}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Account page shell ────────────────────────────────────────────────────────
export default function AccountPage() {
  const navItem = (to, icon, label) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-2 px-3 py-2 rounded-sm text-sm font-body transition-colors w-full text-left',
          isActive ? 'bg-ink-800 text-chrome' : 'text-chrome-dim hover:text-chrome'
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  )

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-display text-2xl text-chrome tracking-wide mb-6">ACCOUNT</h1>
      <div className="flex gap-6 flex-col sm:flex-row">
        {/* Left nav */}
        <nav className="sm:w-44 shrink-0 space-y-1">
          {navItem('/account/security', <Shield size={14} />, 'Security')}
          {navItem('/account/permissions', <Users size={14} />, 'Permissions')}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Routes>
            <Route index element={<Navigate to="security" replace />} />
            <Route path="security" element={<SecuritySection />} />
            <Route path="permissions" element={<PermissionsSection />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}
