/**
 * Shared filter + sort panel used by InventoryPage and WishlistPage.
 * All array filters (conditions, completenesses, platformIds, genres) are multi-select.
 */
import { useState } from 'react'
import { Search, ChevronDown, SlidersHorizontal } from 'lucide-react'
import clsx from 'clsx'

export const MEDIA_TYPES = ['all', 'game', 'movie', 'tv_show', 'music', 'book', 'other']
export const TYPE_LABELS  = { all: 'All', game: 'Games', movie: 'Movies', tv_show: 'TV', music: 'Music', book: 'Books', other: 'Other' }

export const SORT_OPTIONS = [
  { value: 'created_at:desc',   label: 'Recently Added' },
  { value: 'created_at:asc',    label: 'Oldest Added' },
  { value: 'title:asc',         label: 'Title A → Z' },
  { value: 'title:desc',        label: 'Title Z → A' },
  { value: 'release_date:desc', label: 'Release: Newest' },
  { value: 'release_date:asc',  label: 'Release: Oldest' },
]

export const CONDITIONS = ['sealed', 'mint', 'very_good', 'good', 'fair', 'poor']
export const CONDITION_LABELS = { sealed: 'Sealed', mint: 'Mint', very_good: 'Very Good', good: 'Good', fair: 'Fair', poor: 'Poor' }

export const COMPLETENESSES = ['sealed', 'complete_in_box', 'game_only', 'box_only', 'loose', 'other']
export const COMPLETENESS_LABELS = {
  sealed: 'Sealed', complete_in_box: 'CIB', game_only: 'Game Only',
  box_only: 'Box Only', loose: 'Loose', other: 'Other',
}

export const DECADES = [
  { label: 'Pre-1970', min: null, max: 1969 },
  { label: '1970s',    min: 1970, max: 1979 },
  { label: '1980s',    min: 1980, max: 1989 },
  { label: '1990s',    min: 1990, max: 1999 },
  { label: '2000s',    min: 2000, max: 2009 },
  { label: '2010s',    min: 2010, max: 2019 },
  { label: '2020s',    min: 2020, max: 2029 },
]

export const DEFAULT_FILTERS = {
  sort: 'created_at:desc',
  mediaType: 'all',
  conditions: [],
  completenesses: [],
  platformIds: [],
  genres: [],
  selectedDecades: [],  // array of DECADES indices
  selectedYear: null,   // specific year; only active when exactly one decade selected
}

// Toggle a value in/out of an array
const toggle = (arr, val) =>
  arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]

export function activeFilterCount(f) {
  return (
    (f.conditions.length > 0 ? 1 : 0) +
    (f.completenesses.length > 0 ? 1 : 0) +
    (f.platformIds.length > 0 ? 1 : 0) +
    (f.genres.length > 0 ? 1 : 0) +
    (f.selectedDecades.length > 0 ? 1 : 0)
  )
}

function PillButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-2.5 py-1 text-xs font-mono rounded-sm border transition-colors whitespace-nowrap',
        active ? 'bg-acid text-ink-950 border-acid' : 'border-ink-600 text-chrome-dim hover:border-chrome-dim'
      )}
    >
      {children}
    </button>
  )
}

function FilterSection({ label, children }) {
  return (
    <div>
      <p className="text-xs font-mono text-chrome-dim uppercase tracking-wider mb-2">{label}</p>
      {children}
    </div>
  )
}

export default function InventoryFilters({ q, onQ, filters, onChange, platforms = [], availableGenres = [] }) {
  const [showFilters, setShowFilters] = useState(false)

  const count = activeFilterCount(filters)

  const handleDecadeClick = (idx) => {
    const next = toggle(filters.selectedDecades, idx)
    // Clear year sub-filter whenever decade selection changes
    onChange({ selectedDecades: next, selectedYear: null })
  }

  const reset = () => onChange({
    conditions: [], completenesses: [], platformIds: [], genres: [],
    selectedDecades: [], selectedYear: null,
  })

  const visiblePlatforms = platforms.filter((p) => p.media_type === filters.mediaType)

  // Year sub-filter only makes sense when exactly one decade is selected and it has a min year
  const singleDecade = filters.selectedDecades.length === 1 ? DECADES[filters.selectedDecades[0]] : null
  const yearRange = singleDecade?.min
    ? Array.from({ length: 10 }, (_, i) => singleDecade.min + i)
    : []

  return (
    <>
      {/* Search + sort + toggle */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-chrome-dim" />
          <input
            className="input pl-8"
            placeholder="Search by title…"
            value={q}
            onChange={(e) => onQ(e.target.value)}
          />
        </div>

        <div className="relative shrink-0">
          <select
            className="input text-xs pr-7 appearance-none cursor-pointer"
            value={filters.sort}
            onChange={(e) => onChange({ sort: e.target.value })}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-chrome-dim pointer-events-none" />
        </div>

        <button
          onClick={() => setShowFilters((v) => !v)}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-2 rounded-sm border text-xs font-mono transition-colors shrink-0',
            showFilters || count > 0
              ? 'border-acid text-acid'
              : 'border-ink-600 text-chrome-dim hover:border-chrome-dim'
          )}
        >
          <SlidersHorizontal size={13} />
          Filters
          {count > 0 && (
            <span className="bg-acid text-ink-950 rounded-sm px-1 font-bold leading-none py-0.5">{count}</span>
          )}
        </button>
      </div>

      {/* Media type pills */}
      <div className="flex gap-1 flex-wrap mb-4">
        {MEDIA_TYPES.map((t) => (
          <PillButton
            key={t}
            active={filters.mediaType === t}
            onClick={() => onChange({ mediaType: t, platformIds: [] })}
          >
            {TYPE_LABELS[t]}
          </PillButton>
        ))}
      </div>

      {/* Expanded filter panel */}
      {showFilters && (
        <div className="bg-ink-900 border border-ink-700 rounded-sm p-4 mb-4 space-y-5">

          {/* Condition */}
          <FilterSection label="Condition">
            <div className="flex gap-1 flex-wrap">
              <PillButton active={filters.conditions.length === 0} onClick={() => onChange({ conditions: [] })}>
                Any
              </PillButton>
              {CONDITIONS.map((c) => (
                <PillButton
                  key={c}
                  active={filters.conditions.includes(c)}
                  onClick={() => onChange({ conditions: toggle(filters.conditions, c) })}
                >
                  {CONDITION_LABELS[c]}
                </PillButton>
              ))}
            </div>
          </FilterSection>

          {/* Completeness */}
          <FilterSection label="Completeness">
            <div className="flex gap-1 flex-wrap">
              <PillButton active={filters.completenesses.length === 0} onClick={() => onChange({ completenesses: [] })}>
                Any
              </PillButton>
              {COMPLETENESSES.map((c) => (
                <PillButton
                  key={c}
                  active={filters.completenesses.includes(c)}
                  onClick={() => onChange({ completenesses: toggle(filters.completenesses, c) })}
                >
                  {COMPLETENESS_LABELS[c]}
                </PillButton>
              ))}
            </div>
          </FilterSection>

          {/* Platform — only shown when a specific media type is selected */}
          {filters.mediaType !== 'all' && visiblePlatforms.length > 0 && (
            <FilterSection label="Platform / Format">
              <div className="flex gap-1 flex-wrap">
                <PillButton active={filters.platformIds.length === 0} onClick={() => onChange({ platformIds: [] })}>
                  Any
                </PillButton>
                {visiblePlatforms.map((p) => (
                  <PillButton
                    key={p.id}
                    active={filters.platformIds.includes(String(p.id))}
                    onClick={() => onChange({ platformIds: toggle(filters.platformIds, String(p.id)) })}
                  >
                    {p.short_name || p.name}
                  </PillButton>
                ))}
              </div>
            </FilterSection>
          )}
          {filters.mediaType === 'all' && (
            <FilterSection label="Platform / Format">
              <p className="text-chrome-dim text-xs font-mono">Select a media type above to filter by platform.</p>
            </FilterSection>
          )}

          {/* Genre — dynamic from collection */}
          <FilterSection label="Genre">
            {availableGenres.length > 0 ? (
              <div className="flex gap-1 flex-wrap max-h-28 overflow-y-auto pr-1">
                <PillButton active={filters.genres.length === 0} onClick={() => onChange({ genres: [] })}>
                  Any
                </PillButton>
                {availableGenres.map((g) => (
                  <PillButton
                    key={g}
                    active={filters.genres.some((s) => s.toLowerCase() === g.toLowerCase())}
                    onClick={() => onChange({
                      genres: filters.genres.some((s) => s.toLowerCase() === g.toLowerCase())
                        ? filters.genres.filter((s) => s.toLowerCase() !== g.toLowerCase())
                        : [...filters.genres, g],
                    })}
                  >
                    {g}
                  </PillButton>
                ))}
              </div>
            ) : (
              <p className="text-chrome-dim text-xs font-mono">No genre data in your collection yet.</p>
            )}
          </FilterSection>

          {/* Release period */}
          <FilterSection label="Release Period">
            <div className="flex gap-1 flex-wrap">
              <PillButton active={filters.selectedDecades.length === 0} onClick={() => onChange({ selectedDecades: [], selectedYear: null })}>
                Any
              </PillButton>
              {DECADES.map((d, idx) => (
                <PillButton
                  key={d.label}
                  active={filters.selectedDecades.includes(idx)}
                  onClick={() => handleDecadeClick(idx)}
                >
                  {d.label}
                </PillButton>
              ))}
            </div>
            {yearRange.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-2">
                <p className="w-full text-xs font-mono text-chrome-dim mb-1">Narrow to year:</p>
                {yearRange.map((yr) => (
                  <PillButton
                    key={yr}
                    active={filters.selectedYear === yr}
                    onClick={() => onChange({ selectedYear: filters.selectedYear === yr ? null : yr })}
                  >
                    {yr}
                  </PillButton>
                ))}
              </div>
            )}
          </FilterSection>

          {count > 0 && (
            <button onClick={reset} className="text-xs font-mono text-chrome-dim hover:text-chrome underline">
              Clear all filters
            </button>
          )}
        </div>
      )}
    </>
  )
}
