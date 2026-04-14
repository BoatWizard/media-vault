import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertCircle, ChevronDown } from 'lucide-react'
import api from '../services/api'
import clsx from 'clsx'
import InventoryFilters, { DEFAULT_FILTERS, DECADES } from '../components/InventoryFilters'

function ItemCard({ item }) {
  return (
    <Link to={`/item/${item.id}`} className="card group hover:border-ink-600 transition-colors block">
      <div className="aspect-[3/4] bg-ink-800 overflow-hidden">
        {item.cover_image_url ? (
          <img src={item.cover_image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="font-display text-4xl text-ink-600">{item.title.charAt(0).toUpperCase()}</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-chrome text-sm font-body font-medium leading-tight truncate">{item.title}</p>
        <div className="flex items-center justify-between mt-1.5 gap-2">
          <span className={clsx('badge', `badge-${item.media_type}`)}>{item.media_type}</span>
          {!item.user_confirmed && <AlertCircle size={12} className="text-yellow-500 shrink-0" title="Unconfirmed" />}
        </div>
        {item.release_date && (
          <p className="text-chrome-dim text-xs font-mono mt-1">{item.release_date.slice(0, 4)}</p>
        )}
      </div>
    </Link>
  )
}

export default function InventoryPage() {
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [viewingOwnerId, setViewingOwnerId] = useState(null)

  const updateFilters = (patch) => { setFilters((f) => ({ ...f, ...patch })); setPage(1) }
  const updateQ = (val) => { setQ(val); setPage(1) }

  const { data: sharedInventories = [] } = useQuery({
    queryKey: ['permissions', 'received'],
    queryFn: () => api.get('/permissions/received').then((r) => r.data),
  })

  const { data: platforms = [] } = useQuery({
    queryKey: ['platforms'],
    queryFn: () => api.get('/platforms').then((r) => r.data),
  })

  const { data: availableGenres = [] } = useQuery({
    queryKey: ['items-genres', viewingOwnerId, false],
    queryFn: () => api.get('/items/genres', {
      params: { owner_id: viewingOwnerId || undefined, is_wishlist: false },
    }).then((r) => r.data),
  })

  const [sortBy, sortDir] = filters.sort.split(':')
  const releaseDecades = filters.selectedDecades.map((idx) => DECADES[idx].min ?? 0)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['items', q, filters, page, viewingOwnerId],
    queryFn: () =>
      api.get('/items', {
        params: {
          q:               q || undefined,
          media_type:      filters.mediaType === 'all' ? undefined : filters.mediaType,
          sort_by:         sortBy,
          sort_dir:        sortDir,
          condition:       filters.conditions.length ? filters.conditions : undefined,
          completeness:    filters.completenesses.length ? filters.completenesses : undefined,
          platform_id:     filters.platformIds.length ? filters.platformIds : undefined,
          genre:           filters.genres.length ? filters.genres : undefined,
          release_decade:  releaseDecades.length ? releaseDecades : undefined,
          release_year:    filters.selectedYear || undefined,
          page,
          page_size:       24,
          owner_id:        viewingOwnerId || undefined,
        },
      }).then((r) => r.data),
    placeholderData: keepPreviousData,
  })

  const totalPages = data ? Math.ceil(data.total / 24) : 1
  const viewingUser = sharedInventories.find((p) => p.owner_id === viewingOwnerId)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-chrome tracking-wide">
            {viewingUser ? `${viewingUser.owner_username.toUpperCase()}'S INVENTORY` : 'INVENTORY'}
          </h1>
          {data && <p className="text-chrome-dim text-xs font-mono mt-0.5">{data.total} items</p>}
        </div>
        <div className="flex items-center gap-3">
          {sharedInventories.length > 0 && (
            <div className="relative">
              <select
                className="input text-sm pr-8 appearance-none cursor-pointer"
                value={viewingOwnerId || ''}
                onChange={(e) => { setViewingOwnerId(e.target.value || null); setPage(1) }}
              >
                <option value="">My Inventory</option>
                {sharedInventories.map((p) => (
                  <option key={p.id} value={p.owner_id}>{p.owner_username}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-chrome-dim pointer-events-none" />
            </div>
          )}
          {!viewingOwnerId && <Link to="/add" className="btn-primary">+ Add Item</Link>}
        </div>
      </div>

      <InventoryFilters
        q={q} onQ={updateQ}
        filters={filters} onChange={updateFilters}
        platforms={platforms}
        availableGenres={availableGenres}
      />

      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="aspect-[3/4] bg-ink-800" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-ink-700 rounded w-3/4" />
                <div className="h-2 bg-ink-700 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && <div className="text-center py-20 text-chrome-dim"><p>Failed to load inventory.</p></div>}

      {data && data.items.length === 0 && (
        <div className="text-center py-20">
          <p className="font-display text-2xl text-ink-600 tracking-wide">NOTHING HERE YET</p>
          <p className="text-chrome-dim text-sm mt-2">
            <Link to="/add" className="text-acid hover:underline">Add your first item</Link>
          </p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {data.items.map((item) => <ItemCard key={item.id} item={item} />)}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button className="btn-ghost px-3 py-1.5 text-xs" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
              <span className="text-chrome-dim text-xs font-mono px-2">{page} / {totalPages}</span>
              <button className="btn-ghost px-3 py-1.5 text-xs" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
