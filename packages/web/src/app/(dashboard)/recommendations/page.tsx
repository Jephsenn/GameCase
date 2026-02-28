'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import {
  recommendationApi,
  libraryApi,
  type RecommendationItem,
  type PaginatedData,
  type LibraryData,
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

export default function RecommendationsPage() {
  const { accessToken, isLoading: authLoading } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<PaginatedData<RecommendationItem> | null>(null);
  const [libraries, setLibraries] = useState<LibraryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [showAddFor, setShowAddFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [recs, libs] = await Promise.all([
        recommendationApi.getAll(accessToken, page),
        libraryApi.getAll(accessToken),
      ]);
      setData(recs);
      setLibraries(libs);
    } catch {
      toast.error('Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  }, [accessToken, page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!authLoading) load();
  }, [load, authLoading]);

  async function handleRefresh() {
    if (!accessToken) return;
    setRefreshing(true);
    try {
      await recommendationApi.refresh(accessToken);
      setPage(1);
      toast.success('Recommendations refreshed!');
      await load();
    } catch {
      toast.error('Failed to refresh recommendations');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDismiss(id: string) {
    if (!accessToken) return;
    try {
      await recommendationApi.dismiss(accessToken, id);
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.filter((r) => r.id !== id),
              total: prev.total - 1,
            }
          : prev,
      );
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
            <h1 className="text-3xl font-bold tracking-tight">For You</h1>
            <p className="mt-1 text-neutral-400">
              Personalized game recommendations based on your library
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={handleRefresh} isLoading={refreshing}>
            ↻ Refresh
          </Button>
        </div>
      </FadeIn>

      {/* Recommendations */}
      {!data || data.items.length === 0 ? (
        <FadeIn delay={0.1}>
          <div className="rounded-2xl border border-dashed border-neutral-800 py-16 text-center text-neutral-500">
            <p className="text-lg">No recommendations yet.</p>
            <p className="text-sm mt-1">
              Add some games to your library and we&apos;ll suggest titles you&apos;ll love.
            </p>
            <Link href="/games" className="inline-block mt-4">
              <Button size="sm">Browse Games</Button>
            </Link>
          </div>
        </FadeIn>
      ) : (
        <>
          <StaggerContainer className="space-y-4">
            {data.items.map((rec) => (
              <StaggerItem key={rec.id}>
                <div className="group rounded-2xl border border-neutral-800 bg-neutral-900/50 transition-all hover:border-neutral-700 hover:shadow-lg hover:shadow-violet-500/5">
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
                        <div className="shrink-0 text-right">
                          <span className="text-xs text-neutral-400 bg-neutral-800 px-2.5 py-1 rounded-full">
                            {Math.round(rec.score * 100)}% match
                          </span>
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
                          <span className="text-violet-400">★ {rec.game.rating.toFixed(1)}</span>
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

          {/* Pagination */}
          {data.totalPages > 1 && (
            <FadeIn delay={0.15}>
              <div className="flex items-center justify-center gap-4 pt-4">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!data.hasPrevious}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ← Previous
                </Button>
                <span className="text-sm text-neutral-400">
                  Page {data.page} of {data.totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!data.hasNext}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next →
                </Button>
              </div>
            </FadeIn>
          )}
        </>
      )}
    </PageTransition>
  );
}
