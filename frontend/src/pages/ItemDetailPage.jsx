import { useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, Check, X, AlertCircle, ChevronLeft, ChevronRight, Plus, Star } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import api from '../services/api'
import clsx from 'clsx'

const FIELD_LABELS = {
  media_type: 'Type',
  platform_id: 'Platform',
  release_date: 'Released',
  region: 'Region',
  developer: 'Developer',
  publisher: 'Publisher',
  condition: 'Condition',
  completeness: 'Completeness',
  upc: 'UPC',
  serial_number: 'Serial',
  rating: 'Rating',
}

export default function ItemDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [edits, setEdits] = useState({})
  const [editImages, setEditImages] = useState([]) // [{key, url}] during edit
  const [imgUploading, setImgUploading] = useState(false)
  const [lightbox, setLightbox] = useState(null) // index into allImages

  const { data: item, isLoading } = useQuery({
    queryKey: ['item', id],
    queryFn: () => api.get(`/items/${id}`).then((r) => r.data),
  })

  const { data: platforms } = useQuery({
    queryKey: ['platforms'],
    queryFn: () => api.get('/platforms').then((r) => r.data),
  })

  const updateMutation = useMutation({
    mutationFn: (data) => api.patch(`/items/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['item', id])
      queryClient.invalidateQueries(['items'])
      setEditing(false)
      setEdits({})
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['items'])
      navigate('/')
    },
  })

  // Hooks must be called before any conditional returns
  const onDropImages = useCallback(async (files) => {
    setImgUploading(true)
    try {
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file)
        const { data } = await api.post('/images/upload', fd)
        setEditImages((prev) => [...prev, { key: data.key, url: data.url }])
      }
    } finally {
      setImgUploading(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropImages,
    accept: { 'image/*': [] },
    multiple: true,
    disabled: imgUploading,
  })

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-ink-800 rounded w-1/2" />
        <div className="h-64 bg-ink-800 rounded" />
      </div>
    )
  }

  if (!item) return <p className="text-chrome-dim">Item not found.</p>

  const allImages = [item.cover_image_url, ...(item.extra_image_urls || [])].filter(Boolean)
  const platformName = platforms?.find((p) => p.id === item.platform_id)?.name

  const val = (key) => (editing && edits[key] !== undefined ? edits[key] : item[key])
  const set = (k) => (e) => setEdits((prev) => ({ ...prev, [k]: e.target.value }))

  const startEditing = () => {
    const current = [
      item.cover_image_key ? { key: item.cover_image_key, url: item.cover_image_url } : null,
      ...((item.extra_image_keys || []).map((k, i) => ({ key: k, url: item.extra_image_urls?.[i] }))),
    ].filter(Boolean)
    setEditImages(current)
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
    setEdits({})
    setEditImages([])
  }

  const handleSave = () => {
    updateMutation.mutate({
      ...edits,
      user_confirmed: true,
      platform_id: edits.platform_id ? parseInt(edits.platform_id) : item.platform_id,
      cover_image_key: editImages[0]?.key ?? item.cover_image_key,
      extra_image_keys: editImages.length > 0 ? editImages.slice(1).map((i) => i.key) : item.extra_image_keys,
    })
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-mono text-chrome-dim mb-4">
        <Link to="/" className="hover:text-acid">Inventory</Link>
        <span>/</span>
        <span className="text-chrome truncate">{item.title}</span>
      </div>

      <div className="flex gap-6 flex-col sm:flex-row">
        {/* Cover image + extras */}
        <div className="sm:w-48 shrink-0 space-y-2">
          {editing ? (
            // ── Editable image grid ──────────────────────────────────
            <div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {editImages.map((img, i) => (
                  <div key={img.key} className="relative group w-[60px] h-[72px]">
                    <img src={img.url} alt="" className="w-full h-full object-cover rounded-sm border border-ink-600" />
                    {i === 0 && (
                      <span className="absolute top-0.5 left-0.5 bg-acid text-ink-950 rounded-sm px-0.5 text-[8px] font-mono flex items-center gap-0.5">
                        <Star size={7} /> cover
                      </span>
                    )}
                    <button
                      onClick={() => setEditImages((imgs) => imgs.filter((_, idx) => idx !== i))}
                      className="absolute top-0.5 right-0.5 bg-ink-900/80 rounded-sm p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={9} className="text-chrome-dim" />
                    </button>
                  </div>
                ))}
                <div
                  {...getRootProps()}
                  className={clsx(
                    'w-[60px] h-[72px] border-2 border-dashed rounded-sm flex flex-col items-center justify-center cursor-pointer transition-colors text-ink-500',
                    isDragActive ? 'border-acid text-acid' : 'border-ink-600 hover:border-ink-500'
                  )}
                >
                  <input {...getInputProps()} />
                  {imgUploading ? <span className="text-[9px] font-mono">…</span> : <Plus size={14} />}
                </div>
              </div>
              <p className="text-chrome-dim text-[10px] font-mono">First = cover · tap × to remove</p>
            </div>
          ) : (
            // ── View-mode images ─────────────────────────────────────
            <>
              <button
                className="w-full aspect-[3/4] bg-ink-800 rounded-sm overflow-hidden border border-ink-700 block"
                onClick={() => allImages.length > 0 && setLightbox(0)}
              >
                {item.cover_image_url ? (
                  <img src={item.cover_image_url} alt={item.title} className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="font-display text-5xl text-ink-600">{item.title.charAt(0)}</span>
                  </div>
                )}
              </button>
              {item.extra_image_urls?.length > 0 && (
                <div className="grid grid-cols-3 gap-1">
                  {item.extra_image_urls.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setLightbox(i + 1)}
                      className="aspect-square bg-ink-800 rounded-sm overflow-hidden border border-ink-700"
                    >
                      <img src={url} alt={`${item.title} ${i + 2}`} className="w-full h-full object-cover hover:opacity-80 transition-opacity" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Lightbox */}
        {lightbox !== null && (
          <div
            className="fixed inset-0 bg-ink-950/90 z-50 flex items-center justify-center"
            onClick={() => setLightbox(null)}
          >
            <button
              className="absolute top-4 right-4 text-chrome-dim hover:text-chrome"
              onClick={() => setLightbox(null)}
            >
              <X size={28} />
            </button>
            {allImages.length > 1 && (
              <button
                className="absolute left-4 text-chrome-dim hover:text-chrome p-2"
                onClick={(e) => { e.stopPropagation(); setLightbox((lightbox - 1 + allImages.length) % allImages.length) }}
              >
                <ChevronLeft size={36} />
              </button>
            )}
            <img
              src={allImages[lightbox]}
              alt={item.title}
              className="max-h-[85vh] max-w-[85vw] object-contain rounded-sm shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            {allImages.length > 1 && (
              <button
                className="absolute right-4 text-chrome-dim hover:text-chrome p-2"
                onClick={(e) => { e.stopPropagation(); setLightbox((lightbox + 1) % allImages.length) }}
              >
                <ChevronRight size={36} />
              </button>
            )}
            <p className="absolute bottom-4 text-chrome-dim text-xs font-mono">
              {lightbox + 1} / {allImages.length}
            </p>
          </div>
        )}

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1">
            {editing ? (
              <input
                className="input text-lg font-body font-semibold flex-1"
                value={val('title')}
                onChange={set('title')}
              />
            ) : (
              <h1 className="font-body font-semibold text-xl text-chrome">{item.title}</h1>
            )}

            <div className="flex items-center gap-2 shrink-0">
              {!item.user_confirmed && (
                <span title="Unconfirmed" className="text-yellow-500">
                  <AlertCircle size={16} />
                </span>
              )}
              {editing ? (
                <>
                  <button onClick={handleSave} className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1">
                    <Check size={12} /> Save
                  </button>
                  <button onClick={cancelEditing} className="btn-ghost py-1.5 px-3 text-xs flex items-center gap-1">
                    <X size={12} /> Cancel
                  </button>
                </>
              ) : (
                <>
                  <button onClick={startEditing} className="btn-ghost py-1.5 px-3 text-xs flex items-center gap-1">
                    <Pencil size={12} /> Edit
                  </button>
                  <button
                    onClick={() => window.confirm('Delete this item?') && deleteMutation.mutate()}
                    className="text-red-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Badges */}
          <div className="flex gap-2 flex-wrap mb-4">
            <span className={clsx('badge', `badge-${item.media_type}`)}>{item.media_type}</span>
            {platformName && <span className="badge bg-ink-700 text-chrome-dim">{platformName}</span>}
            {item.region && <span className="badge bg-ink-700 text-chrome-dim">{item.region}</span>}
            {item.condition && <span className="badge bg-ink-700 text-chrome-dim">{item.condition.replace('_', ' ')}</span>}
          </div>

          {/* Key fields grid */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
            {[
              ['Released', item.release_date?.slice(0, 4)],
              ['Developer', item.developer],
              ['Publisher', item.publisher],
              ['Completeness', item.completeness?.replace(/_/g, ' ')],
              ['UPC', item.upc],
              ['Serial', item.serial_number],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-mono text-chrome-dim">{label}</dt>
                <dd className="text-chrome font-body">{value}</dd>
              </div>
            ))}
          </dl>

          {/* Description */}
          {(editing || item.description) && (
            <div className="mb-4">
              <label className="label">Description</label>
              {editing ? (
                <textarea
                  className="input resize-none text-sm"
                  rows={4}
                  value={val('description') || ''}
                  onChange={set('description')}
                />
              ) : (
                <p className="text-chrome-dim text-sm font-body leading-relaxed">{item.description}</p>
              )}
            </div>
          )}

          {/* Notes */}
          {(editing || item.notes) && (
            <div className="mb-4">
              <label className="label">Notes</label>
              {editing ? (
                <input className="input text-sm" value={val('notes') || ''} onChange={set('notes')} />
              ) : (
                <p className="text-chrome-dim text-sm italic">{item.notes}</p>
              )}
            </div>
          )}

          {/* Enrichment sources */}
          {item.enrichment_sources?.length > 0 && (
            <div className="mt-2">
              <span className="text-xs font-mono text-ink-600">
                Data from: {item.enrichment_sources.join(', ')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
