import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Search, SlidersHorizontal, AlertCircle } from 'lucide-react'
import api from '../services/api'
import clsx from 'clsx'

const MEDIA_TYPES = ['all', 'game', 'movie', 'tv_show', 'music', 'book', 'other']

const TYPE_LABELS = {
  all: 'All',
  game: 'Games',
  movie: 'Movies',
  tv_show: 'TV',
  music: 'Music',
  book: 'Books',
  other: 'Other',
}

function ItemCard({ item }) {
  return (
    <Link to={`/item/${item.id}`} className="card group hover:border-ink-600 transition-colors block">
      <div className="aspect-[3/4] bg-ink-800 overflow-hidden">
        {item.cover_image_url ? (
          <img
            src={item.cover_image_url}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="font-display text-4xl text-ink-600">
              {item.title.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-chrome text-sm font-body font-medium leading-tight truncate">{item.title}</p>
        <div className="flex items-center justify-between mt-1.5 gap-2">
          <span className={clsx('badge', `badge-${item.media_type}`)}>
            {item.media_type}
          </span>
          {!item.user_confirmed && (
            <AlertCircle size={12} className="text-yellow-500 shrink-0" title="Unconfirmed" />
          )}
        </div>
        {item.release_date && (
          <p className="text-chrome-dim text-xs font-mono mt-1">
            {item.release_date.slice(0, 4)}
          </p>
        )}
      </div>
    </Link>
  )
}

export default function InventoryPage() {
  const [q, setQ] = useState('')
  const [mediaType, setMediaType] = useState('all')
  const [page, setPage] = useState(1)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['items', q, mediaType, page],
    queryFn: () =>
      api
        .get('/items', {
          params: {
            q: q || undefined,
            media_type: mediaType === 'all' ? undefined : mediaType,
            page,
            page_size: 24,
          },
        })
        .then((r) => r.data),
    placeholderData: keepPreviousData,
  })

  const totalPages = data ? Math.ceil(data.total / 24) : 1

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-chrome tracking-wide">INVENTORY</h1>
          {data && (
            <p className="text-chrome-dim text-xs font-mono mt-0.5">{data.total} items</p>
          )}
        </div>
        <Link to="/add" className="btn-primary">
          + Add Item
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-chrome-dim" />
          <input
            className="input pl-8"
            placeholder="Search by title…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1) }}
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {MEDIA_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => { setMediaType(t); setPage(1) }}
              className={clsx(
                'px-3 py-2 text-xs font-mono rounded-sm border transition-colors',
                mediaType === t
                  ? 'bg-acid text-ink-950 border-acid'
                  : 'border-ink-600 text-chrome-dim hover:border-chrome-dim'
              )}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
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

      {isError && (
        <div className="text-center py-20 text-chrome-dim">
          <p>Failed to load inventory.</p>
        </div>
      )}

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
            {data.items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                className="btn-ghost px-3 py-1.5 text-xs"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Prev
              </button>
              <span className="text-chrome-dim text-xs font-mono px-2">
                {page} / {totalPages}
              </span>
              <button
                className="btn-ghost px-3 py-1.5 text-xs"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
