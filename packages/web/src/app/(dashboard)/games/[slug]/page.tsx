'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import {
  gameApi,
  libraryApi,
  type GameDetail,
  type LibraryData,
  type GameLibraryStatus,
  ApiError,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { PageTransition, FadeIn } from '@/components/ui/animations';
import { GameDetailSkeleton } from '@/components/ui/skeleton';

export default function GameDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { accessToken, isLoading: authLoading } = useAuth();
  const toast = useToast();

  const [game, setGame] = useState<GameDetail | null>(null);
  const [libraries, setLibraries] = useState<LibraryData[]>([]);
  const [gameStatus, setGameStatus] = useState<GameLibraryStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;

    // Fetch the game detail (public — no token required)
    let g: GameDetail;
    try {
      g = await gameApi.getDetail(slug, accessToken || undefined);
      setGame(g);
    } catch {
      toast.error('Failed to load game details');
      setLoading(false);
      return;
    }

    // Fetch library data separately — failures are non-critical
    if (accessToken) {
      try {
        const [libs, status] = await Promise.all([
          libraryApi.getAll(accessToken),
          libraryApi.getGameStatus(accessToken, g.id),
        ]);
        setLibraries(libs);
        setGameStatus(status);
      } catch {
        // Library data is supplemental — silently ignore errors
      }
    }

    setLoading(false);
  }, [slug, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Wait until auth has finished initialising before loading
    if (!authLoading) load();
  }, [load, authLoading]);

  async function handleAddToLibrary(libraryId: string) {
    if (!accessToken || !game) return;
    setAdding(true);
    try {
      await libraryApi.addGame(accessToken, libraryId, game.id);
      setShowAdd(false);
      toast.success('Added to library!');
      const status = await libraryApi.getGameStatus(accessToken, game.id);
      setGameStatus(status);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to add game');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveFromLibrary(itemId: string) {
    if (!accessToken || !game) return;
    try {
      await libraryApi.removeItem(accessToken, itemId);
      toast.success('Removed from library');
      const status = await libraryApi.getGameStatus(accessToken, game.id);
      setGameStatus(status);
    } catch {
      toast.error('Failed to remove from library');
    }
  }

  if (loading) {
    return (
      <PageTransition>
        <GameDetailSkeleton />
      </PageTransition>
    );
  }

  if (!game) {
    return (
      <PageTransition className="py-20 text-center text-neutral-500">
        <p>Game not found.</p>
        <Link href="/games" className="text-violet-400 hover:underline mt-2 inline-block">
          Browse games
        </Link>
      </PageTransition>
    );
  }

  const inLibraryIds = new Set(gameStatus.map((s) => s.libraryId));
  const availableLibraries = libraries.filter((l) => !inLibraryIds.has(l.id));

  return (
    <PageTransition className="space-y-8">
      {/* Hero section */}
      <FadeIn>
        <div className="relative rounded-2xl border border-neutral-800">
        {game.backgroundImage && (
          <div className="absolute inset-0 overflow-hidden rounded-2xl">
            <Image
              src={game.backgroundImage}
              alt=""
              fill
              className="object-cover opacity-30"
              priority
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent" />
          </div>
        )}
        <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row gap-6">
          {/* Cover */}
          <div className="shrink-0 w-40 sm:w-48">
            <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-neutral-800">
              {(game.coverImage || game.backgroundImage) ? (
                <Image
                  src={(game.coverImage || game.backgroundImage)!}
                  alt={game.title}
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 640px) 160px, 192px"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-neutral-600">
                  No Image
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 space-y-4">
            <div>
              <Link href="/games" className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors">
                ← Back to games
              </Link>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-2">{game.title}</h1>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap gap-3 text-sm text-neutral-400">
              {game.releaseDate && (
                <span className="bg-neutral-800/80 px-3 py-1 rounded-full">
                  {new Date(game.releaseDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              )}
              {game.metacritic && (
                <span className={`px-3 py-1 rounded-full font-medium ${
                  game.metacritic >= 75
                    ? 'bg-green-500/20 text-green-400'
                    : game.metacritic >= 50
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  Metacritic: {game.metacritic}
                </span>
              )}
              {game.rating && (
                <span className="bg-violet-500/20 text-violet-400 px-3 py-1 rounded-full">
                  ★ {game.rating.toFixed(1)}
                </span>
              )}
              {game.playtime !== null && game.playtime > 0 && (
                <span className="bg-neutral-800/80 px-3 py-1 rounded-full">
                  ~{game.playtime}h to beat
                </span>
              )}
              {game.esrbRating && (
                <span className="bg-neutral-800/80 px-3 py-1 rounded-full">
                  {game.esrbRating}
                </span>
              )}
            </div>

            {/* Genres + Platforms */}
            <div className="space-y-2">
              {game.genres.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {game.genres.map((g) => (
                    <span key={g.id} className="text-xs bg-neutral-800 text-neutral-300 px-2.5 py-1 rounded-lg">
                      {g.name}
                    </span>
                  ))}
                </div>
              )}
              {game.platforms.length > 0 && (
                <p className="text-xs text-neutral-500">
                  {game.platforms.map((p) => p.name).join(' · ')}
                </p>
              )}
            </div>

            {/* Add to library */}
            <div className="flex flex-wrap items-start gap-3">
              {gameStatus.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {gameStatus.map((s) => (
                    <span
                      key={s.itemId}
                      className="inline-flex items-center gap-2 text-xs bg-violet-500/15 text-violet-300 px-3 py-1.5 rounded-full"
                    >
                      In: {s.libraryName}
                      <button
                        onClick={() => handleRemoveFromLibrary(s.itemId)}
                        className="hover:text-red-400 transition-colors cursor-pointer"
                        title="Remove"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {availableLibraries.length > 0 && (
                <div className="relative">
                  <Button size="sm" variant="secondary" onClick={() => setShowAdd(!showAdd)}>
                    + Add to Library
                  </Button>
                  {showAdd && (
                    <div className="absolute top-full mt-2 left-0 z-50 w-56 rounded-xl border border-neutral-700 bg-neutral-900 shadow-xl overflow-hidden">
                      {availableLibraries.map((lib) => (
                        <button
                          key={lib.id}
                          onClick={() => handleAddToLibrary(lib.id)}
                          disabled={adding}
                          className="w-full text-left px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {lib.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </FadeIn>

      {/* Description */}
      {game.description && (
        <FadeIn delay={0.15}>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
            <h2 className="text-lg font-semibold mb-3">About</h2>
            <div
              className="text-sm text-neutral-300 leading-relaxed prose prose-invert max-w-none prose-p:my-2"
              dangerouslySetInnerHTML={{ __html: game.description }}
            />
          </div>
        </FadeIn>
      )}

      {/* Tags */}
      {game.tags.length > 0 && (
        <FadeIn delay={0.2}>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
            <h2 className="text-lg font-semibold mb-3">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {game.tags.map((t) => (
                <span key={t.id} className="text-xs bg-neutral-800 text-neutral-400 px-2.5 py-1 rounded-lg">
                  {t.name}
                </span>
              ))}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Screenshots */}
      {game.screenshots.length > 0 && (
        <FadeIn delay={0.25}>
          <h2 className="text-lg font-semibold mb-4">Screenshots</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {game.screenshots.map((url, i) => (
              <div key={i} className="relative aspect-video rounded-xl overflow-hidden border border-neutral-800">
                <Image
                  src={url}
                  alt={`${game.title} screenshot ${i + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 50vw"
                />
              </div>
            ))}
          </div>
        </FadeIn>
      )}

      {/* External link */}
      {game.websiteUrl && (
        <div className="text-sm">
          <a
            href={game.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-400 hover:underline"
          >
            Official Website →
          </a>
        </div>
      )}
    </PageTransition>
  );
}
