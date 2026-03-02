'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import {
  libraryApi,
  userApi,
  type LibraryData,
  type LibraryItemData,
  type LibraryQueryParams,
  ApiError,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog, Modal } from '@/components/ui/modal';
import { motion } from 'framer-motion';
import { PageTransition, FadeIn } from '@/components/ui/animations';
import { GameGridSkeleton } from '@/components/ui/skeleton';
import { StarRating, StarDisplay } from '@/components/ui/star-rating';

type SortBy = 'added' | 'title' | 'rating' | 'release';
type SortOrder = 'asc' | 'desc';
type RatingFilter = '' | 'rated' | 'unrated';
type ViewMode = 'grid' | 'list';

const SORT_OPTIONS: { value: SortBy; label: string; defaultOrder: SortOrder }[] = [
  { value: 'added',   label: 'Date Added',   defaultOrder: 'desc' },
  { value: 'title',   label: 'Title',         defaultOrder: 'asc' },
  { value: 'rating',  label: 'Your Rating',   defaultOrder: 'desc' },
  { value: 'release', label: 'Release Date',  defaultOrder: 'desc' },
];

export default function LibraryDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const viewingUser = searchParams.get('user');
  const router = useRouter();
  const { accessToken, isLoading: authLoading, user: currentUser } = useAuth();
  const toast = useToast();
  const isPublicView = !!viewingUser && viewingUser !== currentUser?.username;

  const [library, setLibrary] = useState<LibraryData | null>(null);
  const [allItems, setAllItems] = useState<LibraryItemData[]>([]);
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  // Search / Sort / Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('added');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(false);

  // Debounced search
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchQuery]);

  // ConfirmDialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Rating modal state
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingItemId, setRatingItemId] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState<number | null>(null);

  // Platform editor state
  const [platformOpen, setPlatformOpen] = useState(false);
  const [platformItemId, setPlatformItemId] = useState<string | null>(null);
  const [platformSelection, setPlatformSelection] = useState<string[]>([]);

  const PLATFORM_OPTIONS = [
    'PC', 'PlayStation 5', 'PlayStation 4', 'PlayStation 3', 'PlayStation 2',
    'Xbox Series X/S', 'Xbox One', 'Xbox 360', 'Nintendo Switch',
    'Nintendo Wii U', 'Nintendo Wii', 'Nintendo 3DS', 'Nintendo DS',
    'macOS', 'Linux', 'iOS', 'Android', 'Steam Deck',
  ];

  // Build query params from current filter state
  const buildQuery = useCallback((p: number): LibraryQueryParams => {
    const params: LibraryQueryParams = { page: p };
    if (debouncedSearch) params.search = debouncedSearch;
    if (sortBy !== 'added') params.sortBy = sortBy;
    if (sortOrder !== 'desc' || sortBy === 'title') params.sortOrder = sortOrder;
    if (selectedGenres.length > 0) params.genres = selectedGenres;
    if (selectedPlatforms.length > 0) params.platforms = selectedPlatforms;
    if (ratingFilter) params.ratingFilter = ratingFilter;
    return params;
  }, [debouncedSearch, sortBy, sortOrder, selectedGenres, selectedPlatforms, ratingFilter]);

  // Collect unique genres and platforms from loaded items for filter pills
  const availableGenres = useMemo(() => {
    const map = new Map<string, string>();
    allItems.forEach((item) => item.game.genres.forEach((g) => map.set(g.slug, g.name)));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allItems]);

  const availablePlatforms = useMemo(() => {
    const map = new Map<string, string>();
    allItems.forEach((item) => item.game.platforms.forEach((p) => map.set(p.slug, p.name)));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allItems]);

  const loadPage = useCallback(async (p: number, query: LibraryQueryParams) => {
    if (!slug) return;
    if (p > 1) setLoadingMore(true);
    // Public view: fetch via username endpoint (no auth needed)
    if (isPublicView && viewingUser) {
      try {
        const data = await userApi.getPublicLibraryBySlug(viewingUser, slug, query);
        setLibrary(data.library);
        setAllItems((prev) => p === 1 ? data.items.items : [...prev, ...data.items.items]);
        setHasMore(data.items.hasNext);
        setTotalFiltered(data.items.total);
      } catch {
        toast.error('Failed to load library');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
      return;
    }
    // Own library: fetch with auth
    if (!accessToken) return;
    try {
      const data = await libraryApi.getBySlug(accessToken, slug, query);
      setLibrary(data.library);
      setAllItems((prev) => p === 1 ? data.items.items : [...prev, ...data.items.items]);
      setHasMore(data.items.hasNext);
      setTotalFiltered(data.items.total);
    } catch {
      toast.error('Failed to load library');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [accessToken, slug, isPublicView, viewingUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // When page increments (scroll), load next page with current filters
  useEffect(() => {
    if (!authLoading) {
      const query = buildQuery(page);
      loadPage(page, query);
    }
  }, [page, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // When filters change, reset to page 1
  useEffect(() => {
    setPage(1);
    setAllItems([]);
    setLoading(true);
    const query = buildQuery(1);
    if (!authLoading) loadPage(1, query);
  }, [debouncedSearch, sortBy, sortOrder, selectedGenres, selectedPlatforms, ratingFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll observer — use refs so the observer is never recreated on state
  // changes (which would cause an immediate re-fire while the sentinel is still visible).
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const hasMoreRef = useRef(hasMore);
  const loadingMoreRef = useRef(loadingMore);
  const loadingRef = useRef(loading);
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);
  useEffect(() => { loadingMoreRef.current = loadingMore; }, [loadingMore]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreRef.current && !loadingMoreRef.current && !loadingRef.current) {
          setPage((p) => p + 1);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, []); // stable — reads live values through refs

  // Full reload (reset to page 1)
  const reload = useCallback(async () => {
    setPage(1);
    setAllItems([]);
    setLoading(true);
    await loadPage(1, buildQuery(1));
  }, [loadPage, buildQuery]);

  const hasActiveFilters = debouncedSearch || selectedGenres.length > 0 || selectedPlatforms.length > 0 || ratingFilter;

  function clearAllFilters() {
    setSearchQuery('');
    setSelectedGenres([]);
    setSelectedPlatforms([]);
    setRatingFilter('');
  }

  async function handleRemove(itemId: string) {
    if (!accessToken) return;
    try {
      await libraryApi.removeItem(accessToken, itemId);
      toast.success('Game removed');
      await reload();
    } catch {
      toast.error('Failed to remove game');
    }
  }

  async function handleDelete() {
    if (!accessToken || !library) return;
    setDeleting(true);
    try {
      await libraryApi.delete(accessToken, library.id);
      toast.success('Library deleted');
      router.push('/library');
    } catch {
      toast.error('Failed to delete library');
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  async function handleSaveEdit() {
    if (!accessToken || !library) return;
    setSaving(true);
    try {
      await libraryApi.update(accessToken, library.id, {
        name: editName,
        description: editDesc || undefined,
      });
      setEditMode(false);
      toast.success('Library updated');
      await reload();
    } catch {
      toast.error('Failed to update library');
    } finally {
      setSaving(false);
    }
  }

  function openRatingModal(itemId: string, current: number | null) {
    setRatingItemId(itemId);
    setRatingValue(current ?? null);
    setRatingOpen(true);
  }

  function openPlatformModal(itemId: string, current: string[]) {
    setPlatformItemId(itemId);
    setPlatformSelection([...current]);
    setPlatformOpen(true);
  }

  function togglePlatform(platform: string) {
    setPlatformSelection((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    );
  }

  async function handlePlatformSubmit() {
    if (!accessToken || !platformItemId) return;
    try {
      await libraryApi.updateItem(accessToken, platformItemId, {
        platformsPlayed: platformSelection,
      });
      toast.success('Platforms updated');
      setPlatformOpen(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update platforms');
    }
  }

  async function handleRateSubmit(rating: number | null) {
    if (!accessToken || !ratingItemId) return;
    try {
      await libraryApi.updateItem(accessToken, ratingItemId, { userRating: rating });
      toast.success(rating ? `Rated ${rating}/5` : 'Rating cleared');
      setRatingOpen(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to rate');
    }
  }

  if (loading && allItems.length === 0 && !library) {
    return (
      <PageTransition className="space-y-8">
        <div>
          <div className="h-4 w-24 bg-neutral-800/60 rounded animate-pulse" />
          <div className="h-8 w-64 bg-neutral-800/60 rounded-xl animate-pulse mt-3" />
          <div className="h-5 w-32 bg-neutral-800/40 rounded animate-pulse mt-2" />
        </div>
        <GameGridSkeleton count={8} />
      </PageTransition>
    );
  }

  if (!library) {
    return (
      <PageTransition className="py-20 text-center text-neutral-500">
        <p>Library not found.</p>
        <Link href="/library" className="text-violet-400 hover:underline mt-2 inline-block">
          Back to libraries
        </Link>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="space-y-6">
      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Library"
        description="All items will be removed. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />

      {/* Rating modal */}
      <Modal open={ratingOpen} onClose={() => setRatingOpen(false)} size="sm">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Rate this game</h3>
          <p className="text-sm text-neutral-400">Click a star to rate, or click the same star again to clear.</p>
          <div className="flex justify-center py-2">
            <StarRating
              value={ratingValue}
              onChange={(r) => {
                setRatingValue(r);
                handleRateSubmit(r);
              }}
              size="lg"
            />
          </div>
          <div className="flex justify-end">
            <button onClick={() => setRatingOpen(false)} className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 rounded-xl hover:bg-neutral-800 cursor-pointer">
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Platform editor modal */}
      <Modal open={platformOpen} onClose={() => setPlatformOpen(false)} size="sm">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Platforms Played</h3>
          <p className="text-sm text-neutral-400">Select which platforms you&apos;ve played this game on.</p>
          <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
            {PLATFORM_OPTIONS.map((p) => (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors cursor-pointer ${
                  platformSelection.includes(p)
                    ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                    : 'border-neutral-700 bg-neutral-800/50 text-neutral-400 hover:border-neutral-600 hover:text-neutral-300'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setPlatformOpen(false)} className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 rounded-xl hover:bg-neutral-800 cursor-pointer">
              Cancel
            </button>
            <button onClick={handlePlatformSubmit} className="px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-xl hover:bg-violet-500 cursor-pointer">
              Save Platforms
            </button>
          </div>
        </div>
      </Modal>

      {/* Header */}
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {editMode ? (
            <div className="flex-1 space-y-3">
              <input
                className="w-full rounded-xl border border-neutral-700/80 bg-neutral-900/80 px-4 py-2.5 text-lg font-bold text-neutral-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <textarea
                className="w-full rounded-xl border border-neutral-700/80 bg-neutral-900/80 px-4 py-2.5 text-sm text-neutral-100 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
                rows={2}
                placeholder="Description"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit} isLoading={saving}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditMode(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3">
                <Link
                  href={isPublicView ? `/users/${viewingUser}` : '/library'}
                  className="text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  &larr; {isPublicView ? `${viewingUser}'s Profile` : 'Libraries'}
                </Link>
              </div>
              <h1 className="text-3xl font-black tracking-tight mt-2">{library.name}</h1>
              {library.description && (
                <p className="mt-1 text-neutral-400">{library.description}</p>
              )}
              <p className="mt-1 text-sm text-neutral-500">{library.itemCount} games</p>
            </div>
          )}
          {!editMode && !isPublicView && (
            <div className="flex gap-2 shrink-0">
              {!library.isDefault && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditName(library.name);
                      setEditDesc(library.description || '');
                      setEditMode(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setDeleteOpen(true)}>
                    Delete
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </FadeIn>

      {/* ── Toolbar: Search / Sort / Filter / View ── */}
      {library.itemCount > 0 && (
        <FadeIn delay={0.05}>
          <div className="space-y-3">
            {/* Top row: search + sort + view toggle */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search games..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-neutral-700/80 bg-neutral-900/80 pl-10 pr-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 cursor-pointer"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Sort dropdown */}
              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => {
                    const val = e.target.value as SortBy;
                    setSortBy(val);
                    setSortOrder(SORT_OPTIONS.find((o) => o.value === val)!.defaultOrder);
                  }}
                  className="rounded-xl border border-neutral-700/80 bg-neutral-900/80 px-3 py-2.5 text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer appearance-none pr-8"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23737373' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.25rem' }}
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
                  className="rounded-xl border border-neutral-700/80 bg-neutral-900/80 p-2.5 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors cursor-pointer"
                  title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                >
                  <svg className={`h-4 w-4 transition-transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Filter toggle */}
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer flex items-center gap-2 ${
                  showFilters || hasActiveFilters
                    ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                    : 'border-neutral-700/80 bg-neutral-900/80 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600'
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filters
                {hasActiveFilters && (
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-violet-500 text-[10px] font-bold text-white">
                    {(selectedGenres.length > 0 ? 1 : 0) + (selectedPlatforms.length > 0 ? 1 : 0) + (ratingFilter ? 1 : 0) + (debouncedSearch ? 1 : 0)}
                  </span>
                )}
              </button>

              {/* View mode toggle */}
              <div className="flex rounded-xl border border-neutral-700/80 overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2.5 transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-violet-500/20 text-violet-300' : 'bg-neutral-900/80 text-neutral-500 hover:text-neutral-300'}`}
                  title="Grid view"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2.5 transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-violet-500/20 text-violet-300' : 'bg-neutral-900/80 text-neutral-500 hover:text-neutral-300'}`}
                  title="List view"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Filter panel (collapsible) */}
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="rounded-xl border border-neutral-800/80 bg-neutral-900/50 p-4 space-y-4"
              >
                {/* Rating filter */}
                <div>
                  <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">Rating</p>
                  <div className="flex flex-wrap gap-2">
                    {([['', 'All'], ['rated', 'Rated'], ['unrated', 'Unrated']] as [RatingFilter, string][]).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setRatingFilter(val)}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer ${
                          ratingFilter === val
                            ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                            : 'border-neutral-700 bg-neutral-800/50 text-neutral-400 hover:border-neutral-600 hover:text-neutral-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Genre filter */}
                {availableGenres.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">Genres</p>
                    <div className="flex flex-wrap gap-2">
                      {availableGenres.map(([genreSlug, name]) => (
                        <button
                          key={genreSlug}
                          onClick={() => setSelectedGenres((prev) =>
                            prev.includes(genreSlug) ? prev.filter((g) => g !== genreSlug) : [...prev, genreSlug]
                          )}
                          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer ${
                            selectedGenres.includes(genreSlug)
                              ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                              : 'border-neutral-700 bg-neutral-800/50 text-neutral-400 hover:border-neutral-600 hover:text-neutral-300'
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Platform filter */}
                {availablePlatforms.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">Platforms</p>
                    <div className="flex flex-wrap gap-2">
                      {availablePlatforms.map(([platformSlug, name]) => (
                        <button
                          key={platformSlug}
                          onClick={() => setSelectedPlatforms((prev) =>
                            prev.includes(platformSlug) ? prev.filter((p) => p !== platformSlug) : [...prev, platformSlug]
                          )}
                          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer ${
                            selectedPlatforms.includes(platformSlug)
                              ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                              : 'border-neutral-700 bg-neutral-800/50 text-neutral-400 hover:border-neutral-600 hover:text-neutral-300'
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clear all filters */}
                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="text-xs text-violet-400 hover:text-violet-300 hover:underline cursor-pointer"
                  >
                    Clear all filters
                  </button>
                )}
              </motion.div>
            )}

            {/* Active filter summary */}
            {hasActiveFilters && !showFilters && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-neutral-500">Active:</span>
                {debouncedSearch && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-neutral-800 text-neutral-300 border border-neutral-700">
                    &ldquo;{debouncedSearch}&rdquo;
                    <button onClick={() => setSearchQuery('')} className="text-neutral-500 hover:text-neutral-300 cursor-pointer">&times;</button>
                  </span>
                )}
                {selectedGenres.map((g) => (
                  <span key={g} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-violet-500/10 text-violet-300 border border-violet-500/20">
                    {availableGenres.find(([s]) => s === g)?.[1] || g}
                    <button onClick={() => setSelectedGenres((prev) => prev.filter((x) => x !== g))} className="text-violet-400 hover:text-violet-200 cursor-pointer">&times;</button>
                  </span>
                ))}
                {selectedPlatforms.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-violet-500/10 text-violet-300 border border-violet-500/20">
                    {availablePlatforms.find(([s]) => s === p)?.[1] || p}
                    <button onClick={() => setSelectedPlatforms((prev) => prev.filter((x) => x !== p))} className="text-violet-400 hover:text-violet-200 cursor-pointer">&times;</button>
                  </span>
                ))}
                {ratingFilter && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-neutral-800 text-neutral-300 border border-neutral-700">
                    {ratingFilter === 'rated' ? 'Rated' : 'Unrated'}
                    <button onClick={() => setRatingFilter('')} className="text-neutral-500 hover:text-neutral-300 cursor-pointer">&times;</button>
                  </span>
                )}
                <button onClick={clearAllFilters} className="text-xs text-neutral-500 hover:text-neutral-300 cursor-pointer ml-1">
                  Clear all
                </button>
              </div>
            )}

            {/* Results count */}
            {hasActiveFilters && (
              <p className="text-xs text-neutral-500">
                Showing {allItems.length} of {totalFiltered} matching {totalFiltered === 1 ? 'game' : 'games'}
              </p>
            )}
          </div>
        </FadeIn>
      )}

      {/* Items grid / list */}
      {!loading && allItems.length === 0 ? (
        <FadeIn delay={0.1}>
          <div className="rounded-2xl border border-dashed border-neutral-800/80 bg-neutral-900/30 py-16 text-center text-neutral-500">
            {hasActiveFilters ? (
              <>
                <p className="text-lg font-medium">No games match your filters.</p>
                <button onClick={clearAllFilters} className="text-violet-400 hover:underline mt-2 inline-block cursor-pointer">
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <p className="text-lg font-medium">No games in this library yet.</p>
                <Link href="/games" className="text-violet-400 hover:underline mt-2 inline-block">
                  Browse games to add some
                </Link>
              </>
            )}
          </div>
        </FadeIn>
      ) : loading && allItems.length === 0 ? (
        <GameGridSkeleton count={8} />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {allItems.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <div className="group rounded-2xl border border-neutral-800/80 bg-neutral-900/50 overflow-hidden transition-all duration-300 hover:border-violet-500/30 hover:shadow-xl hover:shadow-violet-500/10 hover:-translate-y-0.5">
                <Link href={`/games/${item.game.slug}`} className="block">
                  <div className="relative aspect-[3/4] bg-neutral-800 overflow-hidden">
                    {(item.game.coverImage || item.game.backgroundImage) ? (
                      <Image
                        src={(item.game.coverImage || item.game.backgroundImage)!}
                        alt={item.game.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-neutral-600 text-sm">
                        No Image
                      </div>
                    )}
                  </div>
                </Link>
                <div className="p-4 space-y-2">
                  <Link href={`/games/${item.game.slug}`} className="block">
                    <p className="font-medium text-sm line-clamp-1 group-hover:text-white transition-colors">
                      {item.game.title}
                    </p>
                  </Link>
                  {item.game.genres.length > 0 && (
                    <p className="text-xs text-neutral-500 line-clamp-1">
                      {item.game.genres.map((g) => g.name).join(', ')}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    {isPublicView ? (
                      item.userRating ? (
                        <span className="text-xs px-2 py-1 rounded-lg bg-neutral-800 text-neutral-300">
                          <StarDisplay value={item.userRating} />
                        </span>
                      ) : null
                    ) : (
                      <>
                        <button
                          onClick={() => openRatingModal(item.id, item.userRating)}
                          className="text-xs px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
                        >
                          {item.userRating ? <StarDisplay value={item.userRating} /> : '☆ Rate'}
                        </button>
                        <button
                          onClick={() => openPlatformModal(item.id, item.platformsPlayed || [])}
                          className="text-xs px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
                          title="Edit platforms"
                        >
                          🎮
                        </button>
                        <button
                          onClick={() => handleRemove(item.id)}
                          className="text-xs px-2 py-1 rounded-lg bg-neutral-800 hover:bg-red-900/50 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer ml-auto"
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                  {item.steamImport && (
                    <div className="flex flex-wrap gap-1">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1b2838] text-[#66c0f4] border border-[#66c0f4]/30 text-[10px] font-medium">
                        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M11.979 0C5.678 0 0.511 4.86 0.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z"/>
                        </svg>
                        Synced from Steam
                      </span>
                    </div>
                  )}
                  {item.platformsPlayed && item.platformsPlayed.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.platformsPlayed.map((p) => (
                        <span
                          key={p}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        /* List view */
        <div className="space-y-2">
          {allItems.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <div className="group flex items-center gap-4 rounded-xl border border-neutral-800/80 bg-neutral-900/50 p-3 transition-all duration-200 hover:border-violet-500/30 hover:bg-neutral-900/80">
                <Link href={`/games/${item.game.slug}`} className="shrink-0">
                  <div className="relative w-12 h-16 rounded-lg bg-neutral-800 overflow-hidden">
                    {(item.game.coverImage || item.game.backgroundImage) ? (
                      <Image
                        src={(item.game.coverImage || item.game.backgroundImage)!}
                        alt={item.game.title}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-neutral-600 text-[8px]">
                        N/A
                      </div>
                    )}
                  </div>
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/games/${item.game.slug}`} className="block">
                    <p className="font-medium text-sm truncate group-hover:text-white transition-colors">
                      {item.game.title}
                    </p>
                  </Link>
                  <div className="flex items-center gap-2 mt-0.5">
                    {item.game.genres.length > 0 && (
                      <p className="text-xs text-neutral-500 truncate">
                        {item.game.genres.map((g) => g.name).join(', ')}
                      </p>
                    )}
                  </div>
                  {item.steamImport && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1b2838] text-[#66c0f4] border border-[#66c0f4]/30 text-[10px] font-medium">
                        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M11.979 0C5.678 0 0.511 4.86 0.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z"/>
                        </svg>
                        Synced from Steam
                      </span>
                    </div>
                  )}
                  {item.platformsPlayed && item.platformsPlayed.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.platformsPlayed.map((p) => (
                        <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isPublicView ? (
                    item.userRating ? (
                      <span className="text-xs px-2 py-1 rounded-lg bg-neutral-800 text-neutral-300">
                        <StarDisplay value={item.userRating} />
                      </span>
                    ) : null
                  ) : (
                    <>
                      <button
                        onClick={() => openRatingModal(item.id, item.userRating)}
                        className="text-xs px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
                      >
                        {item.userRating ? <StarDisplay value={item.userRating} /> : '☆ Rate'}
                      </button>
                      <button
                        onClick={() => openPlatformModal(item.id, item.platformsPlayed || [])}
                        className="text-xs px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
                        title="Edit platforms"
                      >
                        🎮
                      </button>
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="text-xs px-2 py-1 rounded-lg bg-neutral-800 hover:bg-red-900/50 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel + loading indicator */}
      {loadingMore && (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        </div>
      )}
      <div ref={sentinelRef} className="h-1" />
    </PageTransition>
  );
}
