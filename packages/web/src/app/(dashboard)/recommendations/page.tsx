'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import {
  recommendationApi,
  libraryApi,
  gameApi,
  type RecommendationItem,
  type LibraryData,
  type GameListItem,
  ApiError,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/animations';
import { RecommendationSkeleton } from '@/components/ui/skeleton';

const REASON_BADGES: Record<string, { label: string; color: string }> = {
  genre: { label: 'Genre Match', color: 'bg-violet-500/20 text-violet-300' },
  tag: { label: 'Similar Tags', color: 'bg-blue-500/20 text-blue-300' },
  popular: { label: 'Popular', color: 'bg-green-500/20 text-green-300' },
  new_release: { label: 'New Release', color: 'bg-orange-500/20 text-orange-300' },
  collaborative: { label: 'Players Like You', color: 'bg-fuchsia-500/20 text-fuchsia-300' },
};

/** Minimum visible items before we silently fetch more */
const REPLENISH_THRESHOLD = 5;
const PAGE_SIZE = 20;
/** Seconds before a visibility-change refetch is allowed */
const REFETCH_COOLDOWN = 60;

function MetacriticBadge({ score }: { score: number }) {
  const color =
    score >= 75
      ? 'bg-green-500/20 text-green-300 border-green-500/30'
      : score >= 50
        ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
        : 'bg-red-500/20 text-red-300 border-red-500/30';
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${color}`}>
      {score}
    </span>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    const hours = date.getHours();
    const mins = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h = hours % 12 || 12;
    const m = mins.toString().padStart(2, '0');
    return `Updated today at ${h}:${m} ${ampm}`;
  }
  if (diffDays === 1) return 'Updated yesterday';
  if (diffDays < 7) return `Updated ${diffDays} days ago`;
  if (diffDays < 30) return `Updated ${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
  return `Updated ${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
}

export default function RecommendationsPage() {
  const { accessToken, isLoading: authLoading } = useAuth();
  const toast = useToast();

  // Core state — flat list of items with append-style loading
  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [latestGeneratedAt, setLatestGeneratedAt] = useState<string | null>(null);

  const [libraries, setLibraries] = useState<LibraryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [showAddFor, setShowAddFor] = useState<string | null>(null);
  const replenishing = useRef(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showMoreLoading, setShowMoreLoading] = useState(false);

  /** IDs dismissed during a replenish — prevent flicker when fresh data arrives */
  const pendingDismissals = useRef(new Set<string>());
  /** Timestamp of last successful load, for visibility-change refetch */
  const lastLoadTime = useRef<number>(0);

  // Cold-start popular games
  const [popularGames, setPopularGames] = useState<GameListItem[]>([]);
  const [loadingPopular, setLoadingPopular] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!accessToken) return;
    if (!silent) setLoading(true);
    try {
      const [recs, libs] = await Promise.all([
        recommendationApi.getAll(accessToken, 1, PAGE_SIZE),
        libraryApi.getAll(accessToken),
      ]);
      // Filter out any items that were dismissed while we were loading
      let filteredItems = recs.items;
      if (pendingDismissals.current.size > 0) {
        filteredItems = filteredItems.filter((r) => !pendingDismissals.current.has(r.id));
        pendingDismissals.current.clear();
      }
      setItems(filteredItems);
      setTotalCount(recs.total);
      setOffset(1); // page 1 loaded
      setHasMore(recs.hasNext);
      setLatestGeneratedAt(recs.latestGeneratedAt ?? null);
      setLibraries(libs);
      lastLoadTime.current = Date.now();
    } catch {
      if (!silent) toast.error('Failed to load recommendations');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!authLoading) load();
  }, [load, authLoading]);

  // Visibility-change refetch (#8)
  useEffect(() => {
    function handleVisibility() {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - lastLoadTime.current > REFETCH_COOLDOWN * 1000
      ) {
        load(true);
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [load]);

  // "Show More" — append next page
  async function handleShowMore() {
    if (!accessToken || showMoreLoading) return;
    setShowMoreLoading(true);
    try {
      const nextPage = offset + 1;
      const recs = await recommendationApi.getAll(accessToken, nextPage, PAGE_SIZE);
      const newItems = recs.items.filter((r) => !pendingDismissals.current.has(r.id));
      setItems((prev) => {
        const existingIds = new Set(prev.map((i) => i.id));
        const unique = newItems.filter((i) => !existingIds.has(i.id));
        return [...prev, ...unique];
      });
      setTotalCount(recs.total);
      setOffset(nextPage);
      setHasMore(recs.hasNext);
      setLatestGeneratedAt(recs.latestGeneratedAt ?? null);
      lastLoadTime.current = Date.now();
    } catch {
      toast.error('Failed to load more recommendations');
    } finally {
      setShowMoreLoading(false);
    }
  }

  /**
   * Silently replenish recommendations by generating more (does NOT clear dismissals).
   * If generation is already in progress (lock blocked → count 0), polls until it finishes.
   */
  async function replenish() {
    if (!accessToken || replenishing.current) return;
    replenishing.current = true;
    setLoadingMore(true);
    try {
      const { count } = await recommendationApi.generate(accessToken);

      // If generate returned 0, a concurrent generation may be running.
      // Poll the status endpoint until it finishes, then fetch.
      if (count === 0) {
        let retries = 0;
        const MAX_RETRIES = 15; // ~30 seconds max wait (15 × 2s)
        while (retries < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 2000));
          const status = await recommendationApi.getStatus(accessToken);
          if (!status.generating && status.total > 0) break;
          if (!status.generating && status.total === 0) {
            // Nothing in progress and truly no recs — try one more generate
            await recommendationApi.generate(accessToken);
            break;
          }
          retries++;
        }
      }

      const fresh = await recommendationApi.getAll(accessToken, 1, PAGE_SIZE);
      const filteredItems = fresh.items.filter((r) => !pendingDismissals.current.has(r.id));
      pendingDismissals.current.clear();
      setItems(filteredItems);
      setTotalCount(fresh.total);
      setOffset(1);
      setHasMore(fresh.hasNext);
      setLatestGeneratedAt(fresh.latestGeneratedAt ?? null);
      lastLoadTime.current = Date.now();
    } catch {
      pendingDismissals.current.clear();
    }
    replenishing.current = false;
    setLoadingMore(false);
  }

  async function handleRefresh() {
    if (!accessToken) return;
    setRefreshing(true);
    setShowConfirmReset(false);
    try {
      await recommendationApi.refresh(accessToken);
      toast.success('Recommendations refreshed!');
      const fresh = await recommendationApi.getAll(accessToken, 1, PAGE_SIZE);
      setItems(fresh.items);
      setTotalCount(fresh.total);
      setOffset(1);
      setHasMore(fresh.hasNext);
      setLatestGeneratedAt(fresh.latestGeneratedAt ?? null);
      lastLoadTime.current = Date.now();
    } catch {
      toast.error('Failed to refresh recommendations');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDismiss(id: string) {
    if (!accessToken) return;
    try {
      pendingDismissals.current.add(id);

      // Optimistic removal
      const prevItems = items;
      setItems((prev) => prev.filter((r) => r.id !== id));
      setTotalCount((prev) => prev - 1);

      await recommendationApi.dismiss(accessToken, id);

      const remainingItems = prevItems.length - 1;

      if (remainingItems <= REPLENISH_THRESHOLD) {
        replenish();
      }
    } catch {
      toast.error('Failed to dismiss');
    }
  }

  async function handleAddToLibrary(recId: string, gameId: string, libraryId: string) {
    if (!accessToken) return;
    setAddingTo(recId);
    try {
      await libraryApi.addGame(accessToken, libraryId, gameId);
      setShowAddFor(null);
      toast.success('Added to library!');
      await handleDismiss(recId);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to add game');
    } finally {
      setAddingTo(null);
    }
  }

  // Fetch popular games for cold-start empty state
  async function loadPopularGames() {
    if (!accessToken || popularGames.length > 0 || loadingPopular) return;
    setLoadingPopular(true);
    try {
      const result = await gameApi.search(accessToken, { ordering: '-rating', pageSize: '6' });
      setPopularGames(result.items.slice(0, 6));
    } catch {
      // non-critical
    } finally {
      setLoadingPopular(false);
    }
  }

  // Check if user has an empty library (cold start)
  const hasNoLibraryItems = libraries.length > 0 && libraries.every((l) => l.itemCount === 0);
  const showColdStart = !loading && totalCount === 0 && !loadingMore && hasNoLibraryItems;

  // Load popular games when cold start is detected
  useEffect(() => {
    if (showColdStart) loadPopularGames();
  }, [showColdStart]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <PageTransition className="space-y-6">
        <div>
          <div className="h-8 w-36 bg-neutral-800/60 rounded-xl animate-pulse" />
          <div className="h-5 w-72 bg-neutral-800/40 rounded-lg animate-pulse mt-3" />
        </div>
        <RecommendationSkeleton />
      </PageTransition>
    );
  }

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">
              For <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">You</span>
            </h1>
            <p className="mt-1 text-neutral-400">
              Games picked for you based on your library, trending titles, and critic reviews
            </p>
            {latestGeneratedAt && (
              <p className="mt-1 text-xs text-neutral-600">
                {formatRelativeTime(latestGeneratedAt)}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowConfirmReset(true)}
              isLoading={refreshing}
              disabled={showConfirmReset}
            >
              ↻ Refresh
            </Button>
          </div>
        </div>

        {/* Inline confirmation for reset */}
        {showConfirmReset && (
          <div className="mt-3 p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sm text-amber-300 flex-1">
              This will clear your dismissed games and generate a fresh batch. Continue?
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="default" onClick={handleRefresh} isLoading={refreshing}>
                Confirm Reset
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowConfirmReset(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </FadeIn>

      {/* Content */}
      {items.length === 0 ? (
        <FadeIn delay={0.1}>
          {loadingMore ? (
            <div className="space-y-6">
              <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/30 py-10 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-neutral-600 border-t-violet-400 mb-4" />
                <p className="text-lg font-medium text-neutral-300">Generating new recommendations&hellip;</p>
                <p className="text-sm text-neutral-500 mt-1">
                  Finding games you&apos;ll love based on your library
                </p>
              </div>
              <RecommendationSkeleton count={4} />
            </div>
          ) : showColdStart ? (
            /* Cold-start: user has no library items */
            <div className="rounded-2xl border border-dashed border-neutral-800/80 bg-neutral-900/30 py-10 px-6 text-center">
              <p className="text-lg font-medium text-neutral-300">No recommendations yet.</p>
              <p className="text-sm mt-1 text-neutral-500">
                Add some games to your library and we&apos;ll suggest titles you&apos;ll love.
              </p>

              {popularGames.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-4">
                    Popular right now
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
                    {popularGames.map((game) => (
                      <Link key={game.id} href={`/games/${game.slug}`} className="group">
                        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 overflow-hidden transition-all hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-500/5">
                          <div className="relative aspect-[3/4] bg-neutral-800">
                            {(game.coverImage || game.backgroundImage) ? (
                              <Image
                                src={(game.coverImage || game.backgroundImage)!}
                                alt={game.title}
                                fill
                                className="object-cover transition-transform duration-300 group-hover:scale-105"
                                sizes="(max-width: 640px) 50vw, 33vw"
                              />
                            ) : (
                              <div className="flex items-center justify-center h-full text-neutral-600 text-xs">
                                No Image
                              </div>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="text-sm font-medium text-neutral-200 truncate group-hover:text-white transition-colors">
                              {game.title}
                            </p>
                            {game.genres.length > 0 && (
                              <p className="text-xs text-neutral-500 truncate mt-0.5">
                                {game.genres.map((g) => g.name).join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <p className="text-sm text-neutral-500 mt-5">
                    Add any of these to your library to get personalized picks
                  </p>
                </div>
              )}

              <Link href="/games" className="inline-block mt-4">
                <Button size="sm">Browse Games</Button>
              </Link>
            </div>
          ) : (
            /* Normal empty state: user has library items but no recs */
            <div className="rounded-2xl border border-dashed border-neutral-800/80 bg-neutral-900/30 py-16 text-center text-neutral-500">
              <p className="text-lg font-medium">No recommendations yet.</p>
              <p className="text-sm mt-1">
                Add some games to your library and we&apos;ll suggest titles you&apos;ll love.
              </p>
              <Link href="/games" className="inline-block mt-4">
                <Button size="sm">Browse Games</Button>
              </Link>
            </div>
          )}
        </FadeIn>
      ) : (
        <>
          <StaggerContainer className="space-y-4">
            {items.map((rec) => (
              <StaggerItem key={rec.id}>
                <div className="group rounded-2xl border border-neutral-800/80 bg-neutral-900/50 transition-all duration-300 hover:border-violet-500/30 hover:shadow-xl hover:shadow-violet-500/10">
                  <div className="flex flex-col sm:flex-row">
                    {/* Game cover */}
                    <Link href={`/games/${rec.game.slug}`} className="shrink-0 sm:w-48">
                      <div className="relative aspect-[3/4] bg-neutral-800 overflow-hidden rounded-t-2xl sm:rounded-t-none sm:rounded-l-2xl">
                        {(rec.game.coverImage || rec.game.backgroundImage) ? (
                          <Image
                            src={(rec.game.coverImage || rec.game.backgroundImage)!}
                            alt={rec.game.title}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                            sizes="(max-width: 640px) 100vw, 144px"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-neutral-600 text-sm">
                            No Image
                          </div>
                        )}
                      </div>
                    </Link>

                    {/* Info */}
                    <div className="flex-1 p-4 sm:p-5 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <Link href={`/games/${rec.game.slug}`}>
                            <h3 className="text-lg font-semibold group-hover:text-white transition-colors">
                              {rec.game.title}
                            </h3>
                          </Link>
                          {rec.game.genres.length > 0 && (
                            <p className="text-sm text-neutral-500 mt-0.5">
                              {rec.game.genres.map((g) => g.name).join(', ')}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Reason badges */}
                      <div className="flex flex-wrap gap-2">
                        {rec.reasons.map((reason) => {
                          const badge = REASON_BADGES[reason] || {
                            label: reason,
                            color: 'bg-neutral-800 text-neutral-400',
                          };
                          return (
                            <span
                              key={reason}
                              className={`text-xs px-2.5 py-1 rounded-full ${badge.color}`}
                            >
                              {badge.label}
                            </span>
                          );
                        })}
                      </div>

                      {/* Reason text */}
                      <p className="text-sm text-neutral-400">{rec.reasonText}</p>

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-500">
                        {rec.game.rating && (
                          <span className="text-violet-400 font-medium">★ {rec.game.rating.toFixed(1)}</span>
                        )}
                        {rec.game.metacritic && (
                          <span className="flex items-center gap-1">
                            <span className="text-neutral-600 text-xs">Metacritic</span>
                            <MetacriticBadge score={rec.game.metacritic} />
                          </span>
                        )}
                        {rec.game.ratingCount && rec.game.ratingCount > 0 && (
                          <span className="text-neutral-500 text-xs">
                            {rec.game.ratingCount.toLocaleString()} ratings
                          </span>
                        )}
                        {rec.game.releaseDate && (
                          <span>{new Date(rec.game.releaseDate).getFullYear()}</span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <div className="relative">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() =>
                              setShowAddFor(showAddFor === rec.id ? null : rec.id)
                            }
                            isLoading={addingTo === rec.id}
                          >
                            + Add to Library
                          </Button>
                          {showAddFor === rec.id && (
                            <div className="absolute top-full mt-2 left-0 z-50 w-56 rounded-xl border border-neutral-700 bg-neutral-900 shadow-xl overflow-hidden">
                              {libraries.map((lib) => (
                                <button
                                  key={lib.id}
                                  onClick={() => handleAddToLibrary(rec.id, rec.game.id, lib.id)}
                                  className="w-full text-left px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
                                >
                                  {lib.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => handleDismiss(rec.id)}>
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>

          {/* Skeleton placeholders while replenishing */}
          {loadingMore && (
            <RecommendationSkeleton count={Math.max(1, REPLENISH_THRESHOLD - items.length + 1)} />
          )}

          {/* Show More button */}
          {hasMore && !loadingMore && (
            <FadeIn delay={0.15}>
              <div className="flex justify-center pt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleShowMore}
                  isLoading={showMoreLoading}
                >
                  Show More
                </Button>
              </div>
            </FadeIn>
          )}
        </>
      )}
    </PageTransition>
  );
}
