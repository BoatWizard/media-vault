import { useState, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Html5Qrcode } from 'html5-qrcode'
import { useDropzone } from 'react-dropzone'
import { Barcode, Camera, Search, PenLine, Check, X, Plus, Star } from 'lucide-react'
import api from '../services/api'
import clsx from 'clsx'

const MODES = [
  { id: 'barcode', label: 'Scan Barcode', icon: Barcode },
  { id: 'photo',   label: 'Photo',        icon: Camera },
  { id: 'search',  label: 'Title Search', icon: Search },
  { id: 'manual',  label: 'Manual Entry', icon: PenLine },
]

// ── Metadata candidate card ──────────────────────────────────────────────────
function CandidateCard({ result, onSelect }) {
  return (
    <button
      onClick={() => onSelect(result)}
      className="card p-3 text-left hover:border-acid transition-colors w-full flex gap-3"
    >
      {result.cover_art_url ? (
        <img src={result.cover_art_url} alt={result.title} className="w-12 h-16 object-cover rounded-sm shrink-0" />
      ) : (
        <div className="w-12 h-16 bg-ink-700 rounded-sm shrink-0 flex items-center justify-center">
          <span className="font-display text-xl text-ink-500">{result.title.charAt(0)}</span>
        </div>
      )}
      <div className="min-w-0">
        <p className="text-chrome font-body font-medium text-sm truncate">{result.title}</p>
        <p className="text-chrome-dim text-xs font-mono mt-0.5">
          {result.media_type}{result.release_date ? ` · ${result.release_date.slice(0, 4)}` : ''}
        </p>
        {result.developer && (
          <p className="text-chrome-dim text-xs mt-0.5 truncate">{result.developer}</p>
        )}
        <div className="flex gap-1 mt-1 flex-wrap">
          {result.sources.map((s) => (
            <span key={s} className="badge bg-ink-700 text-chrome-dim">{s}</span>
          ))}
        </div>
      </div>
    </button>
  )
}

// ── Image thumbnail grid ─────────────────────────────────────────────────────
function ImageGrid({ images, onRemove, onAdd }) {
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback(async (files) => {
    setUploading(true)
    try {
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file)
        const { data } = await api.post('/images/upload', fd)
        onAdd({ key: data.key, url: data.url })
      }
    } finally {
      setUploading(false)
    }
  }, [onAdd])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: true,
    disabled: uploading,
  })

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {images.map((img, i) => (
          <div key={img.key} className="relative group w-20 h-24">
            <img
              src={img.url}
              alt=""
              className="w-full h-full object-cover rounded-sm border border-ink-600"
            />
            {i === 0 && (
              <span className="absolute top-1 left-1 bg-acid text-ink-950 rounded-sm px-1 text-[9px] font-mono flex items-center gap-0.5">
                <Star size={8} /> cover
              </span>
            )}
            <button
              onClick={() => onRemove(i)}
              className="absolute top-1 right-1 bg-ink-900/80 rounded-sm p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={10} className="text-chrome-dim" />
            </button>
          </div>
        ))}

        <div
          {...getRootProps()}
          className={clsx(
            'w-20 h-24 border-2 border-dashed rounded-sm flex flex-col items-center justify-center cursor-pointer transition-colors text-ink-500',
            isDragActive ? 'border-acid text-acid' : 'border-ink-600 hover:border-ink-500'
          )}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <span className="text-[10px] font-mono text-chrome-dim">…</span>
          ) : (
            <>
              <Plus size={16} />
              <span className="text-[10px] font-mono mt-1">Add</span>
            </>
          )}
        </div>
      </div>
      <p className="text-chrome-dim text-xs font-mono">First image is the cover · drag &amp; drop or tap Add</p>
    </div>
  )
}

// ── Confirm / edit form ──────────────────────────────────────────────────────
function ConfirmForm({ initial, initialImages, platforms, onSave, onBack, saveLabel = 'Save Item' }) {
  const [form, setForm] = useState({
    title:              initial?.title || '',
    media_type:         initial?.media_type || 'game',
    platform_id:        '',
    release_date:       initial?.release_date || '',
    description:        initial?.description || '',
    developer:          initial?.developer || '',
    publisher:          initial?.publisher || '',
    region:             initial?.region || '',
    upc:                initial?.upc || '',
    condition:          '',
    completeness:       '',
    notes:              '',
    genre:              initial?.genre || [],
    igdb_id:            initial?.igdb_id || null,
    tmdb_id:            initial?.tmdb_id || null,
    screenscraper_id:   initial?.screenscraper_id || null,
    enrichment_sources: initial?.sources || [],
    user_confirmed:     true,
  })

  // Images are tracked separately as [{key, url}] — first is cover
  const [images, setImages] = useState(initialImages || [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const filteredPlatforms = platforms?.filter((p) => p.media_type === form.media_type) || []

  const handleSave = () => {
    const nullIfEmpty = (v) => (v === '' || v === undefined ? null : v)
    onSave({
      ...form,
      platform_id:      form.platform_id ? parseInt(form.platform_id) : null,
      release_date:     nullIfEmpty(form.release_date),
      condition:        nullIfEmpty(form.condition),
      completeness:     nullIfEmpty(form.completeness),
      region:           nullIfEmpty(form.region),
      upc:              nullIfEmpty(form.upc),
      developer:        nullIfEmpty(form.developer),
      publisher:        nullIfEmpty(form.publisher),
      description:      nullIfEmpty(form.description),
      notes:            nullIfEmpty(form.notes),
      cover_image_key:  images[0]?.key || null,
      extra_image_keys: images.slice(1).map((i) => i.key),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        {(images[0]?.url || initial?.cover_art_url) && (
          <img
            src={images[0]?.url || initial?.cover_art_url}
            alt=""
            className="w-16 h-20 object-cover rounded-sm border border-ink-600"
          />
        )}
        <div>
          <p className="font-body font-semibold text-chrome">{form.title || 'New Item'}</p>
          <p className="text-xs font-mono text-chrome-dim">Review and confirm details before saving</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="label">Title *</label>
          <input className="input" value={form.title} onChange={set('title')} required />
        </div>

        <div>
          <label className="label">Media Type</label>
          <select className="input" value={form.media_type} onChange={set('media_type')}>
            {['game', 'movie', 'tv_show', 'music', 'book', 'other'].map((t) => (
              <option key={t} value={t}>{t.replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Platform</label>
          <select className="input" value={form.platform_id} onChange={set('platform_id')}>
            <option value="">— Select —</option>
            {filteredPlatforms.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Release Date</label>
          <input type="date" className="input" value={form.release_date} onChange={set('release_date')} />
        </div>

        <div>
          <label className="label">Region</label>
          <select className="input" value={form.region} onChange={set('region')}>
            <option value="">— Select —</option>
            {['NTSC-U', 'PAL', 'NTSC-J', 'Other'].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Condition</label>
          <select className="input" value={form.condition} onChange={set('condition')}>
            <option value="">— Select —</option>
            {['sealed', 'mint', 'very_good', 'good', 'fair', 'poor'].map((c) => (
              <option key={c} value={c}>{c.replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Completeness</label>
          <select className="input" value={form.completeness} onChange={set('completeness')}>
            <option value="">— Select —</option>
            {['sealed', 'complete_in_box', 'game_only', 'box_only', 'loose', 'other'].map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Developer / Author</label>
          <input className="input" value={form.developer} onChange={set('developer')} />
        </div>

        <div>
          <label className="label">Publisher</label>
          <input className="input" value={form.publisher} onChange={set('publisher')} />
        </div>

        <div className="sm:col-span-2">
          <label className="label">Genre / Subjects</label>
          <input
            className="input"
            value={(form.genre || []).join(', ')}
            onChange={(e) => setForm((f) => ({
              ...f,
              genre: e.target.value.split(',').map((g) => g.trim()).filter(Boolean),
            }))}
            placeholder="e.g. Action, RPG"
          />
        </div>

        <div>
          <label className="label">UPC</label>
          <input className="input font-mono" value={form.upc} onChange={set('upc')} />
        </div>

        <div className="sm:col-span-2">
          <label className="label">Description</label>
          <textarea className="input resize-none" rows={3} value={form.description} onChange={set('description')} />
        </div>

        <div className="sm:col-span-2">
          <label className="label">Photos</label>
          <ImageGrid
            images={images}
            onRemove={(i) => setImages((imgs) => imgs.filter((_, idx) => idx !== i))}
            onAdd={(img) => setImages((imgs) => [...imgs, img])}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <input className="input" value={form.notes} onChange={set('notes')} placeholder="Personal notes, storage location, etc." />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={onBack} className="btn-ghost">← Back</button>
        <button onClick={handleSave} className="btn-primary flex items-center gap-2" disabled={!form.title}>
          <Check size={14} /> {saveLabel}
        </button>
      </div>
    </div>
  )
}

// ── Shared title search ───────────────────────────────────────────────────────
function TitleSearchInput({ initialQuery = '', onResult }) {
  const [q, setQ] = useState(initialQuery)
  const [mediaType, setMediaType] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const search = async () => {
    if (!q.trim()) return
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/metadata/search', {
        params: { q: q.trim(), media_type: mediaType || undefined },
      })
      if (data.length === 0) {
        setError('No results found. Try a different title or use manual entry.')
      } else {
        onResult(data, mediaType)
      }
    } catch {
      setError('Search failed. Check your API keys are configured.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Title…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          autoFocus
        />
        <select className="input w-28 shrink-0" value={mediaType} onChange={(e) => setMediaType(e.target.value)}>
          <option value="">Any</option>
          <option value="game">Game</option>
          <option value="movie">Movie</option>
          <option value="tv_show">TV</option>
          <option value="book">Book</option>
        </select>
        <button className="btn-primary shrink-0" onClick={search} disabled={loading || !q.trim()}>
          {loading ? '…' : 'Search'}
        </button>
      </div>
      {error && <p className="text-red-400 text-sm font-mono">{error}</p>}
    </div>
  )
}

// ── Barcode scanner ──────────────────────────────────────────────────────────
function BarcodeScanner({ onResult }) {
  const scannerRef = useRef(null)
  const [scanning, setScanning] = useState(false)
  const [manualUpc, setManualUpc] = useState('')
  const [loading, setLoading] = useState(false)
  const [fallbackQuery, setFallbackQuery] = useState(null)
  const [error, setError] = useState('')

  const startScan = async () => {
    setScanning(true)
    setError('')
    try {
      const scanner = new Html5Qrcode('barcode-reader')
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 280, height: 120 } },
        async (decodedText) => {
          await scanner.stop()
          setScanning(false)
          lookupUpc(decodedText)
        },
        () => {}
      )
    } catch {
      setError('Camera access denied or unavailable')
      setScanning(false)
    }
  }

  const stopScan = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(() => {})
      scannerRef.current = null
    }
    setScanning(false)
  }

  const lookupUpc = async (upc) => {
    setLoading(true)
    setError('')
    setFallbackQuery(null)
    try {
      const { data } = await api.get(`/metadata/barcode/${upc}`)
      onResult(data, upc)
    } catch (err) {
      if (err.response?.status === 404) {
        setFallbackQuery('')
        setError(`No barcode match for ${upc}. Search by title below:`)
      } else {
        setError('Barcode lookup failed.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (fallbackQuery !== null) {
    return (
      <div className="space-y-4">
        <p className="text-red-400 text-sm font-mono">{error}</p>
        <TitleSearchInput initialQuery={fallbackQuery} onResult={(results, mt) => onResult(results, null, mt)} />
        <button className="text-chrome-dim text-xs hover:text-chrome" onClick={() => { setFallbackQuery(null); setError('') }}>
          ← Try another barcode
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div id="barcode-reader" className={clsx('w-full rounded-sm overflow-hidden', !scanning && 'hidden')} />

      {!scanning && (
        <div className="border-2 border-dashed border-ink-600 rounded-sm p-8 text-center">
          <Barcode size={32} className="mx-auto text-ink-600 mb-3" />
          <p className="text-chrome-dim text-sm">Point camera at a barcode to scan</p>
          <button onClick={startScan} className="btn-primary mt-4">Start Camera</button>
        </div>
      )}

      {scanning && (
        <button onClick={stopScan} className="btn-ghost w-full flex items-center justify-center gap-2">
          <X size={14} /> Stop Scanning
        </button>
      )}

      <div className="flex gap-2">
        <input
          className="input font-mono"
          placeholder="Or enter UPC / EAN manually…"
          value={manualUpc}
          onChange={(e) => setManualUpc(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && manualUpc && lookupUpc(manualUpc)}
        />
        <button className="btn-primary shrink-0" disabled={!manualUpc || loading} onClick={() => lookupUpc(manualUpc)}>
          {loading ? '…' : 'Look up'}
        </button>
      </div>

      {error && fallbackQuery === null && <p className="text-red-400 text-sm font-mono">{error}</p>}
    </div>
  )
}

// ── Photo upload + title search ───────────────────────────────────────────────
function PhotoUpload({ onResult, onImageCaptured }) {
  const [step, setStep] = useState('upload')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const onDrop = useCallback(async (files) => {
    const file = files[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await api.post('/images/upload', fd)
      onImageCaptured({ key: data.key, url: data.url })
      setStep('search')
    } catch {
      setError('Upload failed.')
    } finally {
      setUploading(false)
    }
  }, [onImageCaptured])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false,
    disabled: uploading,
  })

  if (step === 'search') {
    return (
      <div className="space-y-4">
        <p className="text-chrome-dim text-sm font-mono">Image saved — now search for the title.</p>
        <TitleSearchInput onResult={(results, mt) => onResult(results, null, mt)} />
        <button
          className="text-chrome-dim text-xs hover:text-chrome"
          onClick={() => { setStep('upload'); setError('') }}
        >
          ← Upload different image
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={clsx(
          'border-2 border-dashed rounded-sm p-10 text-center cursor-pointer transition-colors',
          isDragActive ? 'border-acid bg-acid/5' : 'border-ink-600 hover:border-ink-500'
        )}
      >
        <input {...getInputProps()} />
        <Camera size={32} className="mx-auto text-ink-600 mb-3" />
        {uploading ? (
          <p className="text-chrome-dim text-sm">Uploading…</p>
        ) : isDragActive ? (
          <p className="text-acid text-sm">Drop it here</p>
        ) : (
          <>
            <p className="text-chrome-dim text-sm">Drop a photo of your item</p>
            <p className="text-chrome-dim text-xs mt-1">or tap to take / choose a photo</p>
          </>
        )}
      </div>
      {error && <p className="text-red-400 text-sm font-mono">{error}</p>}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function AddItemPage() {
  const [mode, setMode] = useState('barcode')
  const [candidates, setCandidates] = useState(null)
  const [selected, setSelected] = useState(null)
  const [scannedUpc, setScannedUpc] = useState(null)
  const [searchMediaType, setSearchMediaType] = useState('')
  // Images captured during this session — persists through back navigation
  const [capturedImages, setCapturedImages] = useState([])
  const [saveError, setSaveError] = useState('')

  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const isWishlist = searchParams.get('wishlist') === 'true'

  const { data: platforms } = useQuery({
    queryKey: ['platforms'],
    queryFn: () => api.get('/platforms').then((r) => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: (form) => api.post('/items', {
      ...form,
      upc: scannedUpc || form.upc || null,
      is_wishlist: isWishlist,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['items'])
      navigate(isWishlist ? '/wishlist' : '/')
    },
    onError: (err) => setSaveError(err.response?.data?.detail || 'Failed to save item'),
  })

  // When a candidate is selected, fetch its cover art into MinIO then open the form
  const handleSelect = async (candidate) => {
    // Fill in media_type from the search filter if the API result didn't set it
    const resolved = {
      ...candidate,
      media_type: candidate.media_type || searchMediaType || 'game',
    }
    if (resolved.cover_art_url) {
      try {
        const { data } = await api.post('/images/fetch', { url: resolved.cover_art_url })
        // Prepend API cover art before any user-uploaded photos
        setCapturedImages((prev) => [{ key: data.key, url: data.url }, ...prev])
      } catch {
        // Cover art fetch failed — continue without it
      }
    }
    setSelected(resolved)
  }

  const handleCandidates = (results, upc, mediaType) => {
    setCandidates(results)
    if (upc) setScannedUpc(upc)
    if (mediaType) setSearchMediaType(mediaType)
    if (results.length === 1) handleSelect(results[0])
  }

  // Only clear the selection — keep candidates and captured images so the user
  // can pick a different match without losing their work
  const handleBack = () => setSelected(null)

  const handleModeChange = (newMode) => {
    setMode(newMode)
    setCandidates(null)
    setCapturedImages([])
    setScannedUpc(null)
    setSearchMediaType('')
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (selected) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="font-display text-2xl text-chrome tracking-wide mb-6">
          {isWishlist ? 'CONFIRM WISHLIST ITEM' : 'CONFIRM ITEM'}
        </h1>
        <ConfirmForm
          initial={selected}
          initialImages={capturedImages}
          platforms={platforms}
          onSave={(form) => saveMutation.mutate(form)}
          onBack={handleBack}
          saveLabel={isWishlist ? 'Save to Wishlist' : 'Save Item'}
        />
        {saveError && <p className="text-red-400 text-sm font-mono mt-3">{saveError}</p>}
      </div>
    )
  }

  if (candidates && candidates.length > 1) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setCandidates(null)} className="text-chrome-dim hover:text-chrome">←</button>
          <h1 className="font-display text-2xl text-chrome tracking-wide">SELECT MATCH</h1>
        </div>
        <div className="space-y-2">
          {candidates.map((c, i) => (
            <CandidateCard key={i} result={c} onSelect={handleSelect} />
          ))}
          <button className="btn-ghost w-full mt-2" onClick={() => setSelected({ title: '', sources: [] })}>
            None of these — enter manually
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-display text-2xl text-chrome tracking-wide mb-6">
        {isWishlist ? 'ADD TO WISHLIST' : 'ADD ITEM'}
      </h1>

      <div className="flex gap-1 mb-6 bg-ink-900 border border-ink-700 rounded-sm p-1">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleModeChange(id)}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-sm text-xs font-mono transition-colors',
              mode === id ? 'bg-acid text-ink-950' : 'text-chrome-dim hover:text-chrome'
            )}
          >
            <Icon size={13} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {mode === 'barcode' && <BarcodeScanner onResult={handleCandidates} />}
      {mode === 'photo' && (
        <PhotoUpload
          onResult={handleCandidates}
          onImageCaptured={(img) => setCapturedImages([img])}
        />
      )}
      {mode === 'search' && <TitleSearchInput onResult={(r, mt) => handleCandidates(r, null, mt)} />}
      {mode === 'manual' && (
        <ConfirmForm
          initial={null}
          initialImages={[]}
          platforms={platforms}
          onSave={(form) => saveMutation.mutate(form)}
          onBack={() => navigate(isWishlist ? '/wishlist' : '/')}
          saveLabel={isWishlist ? 'Save to Wishlist' : 'Save Item'}
        />
      )}
    </div>
  )
}
