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
import { StarRating, StarDisplay } from '@/components/ui/star-rating';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import { PageTransition, FadeIn } from '@/components/ui/animations';
import { GameDetailSkeleton } from '@/components/ui/skeleton';

function WhereToBuy({ title }: { title: string }) {
  const stores = [
    {
      name: 'Steam',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658a3.387 3.387 0 0 1 1.912-.59c.064 0 .128.003.19.008l2.861-4.142V8.91a4.528 4.528 0 0 1 4.524-4.524c2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396a3.406 3.406 0 0 1-3.362-2.898L.453 14.83A11.99 11.99 0 0 0 11.979 24c6.627 0 12-5.373 12-12s-5.372-12-12-12z" />
        </svg>
      ),
      color: 'from-blue-600 to-blue-800',
      url: `https://store.steampowered.com/search/?term=${encodeURIComponent(title)}`,
      note: 'Check Steam',
    },
    {
      name: 'Fanatical',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      ),
      color: 'from-orange-600 to-orange-800',
      url: `https://www.fanatical.com/en/search?search=${encodeURIComponent(title)}`,
      note: 'Find deals',
    },
    {
      name: 'Humble Bundle',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      ),
      color: 'from-red-600 to-red-800',
      url: `https://www.humblebundle.com/store/search?search=${encodeURIComponent(title)}`,
      note: 'Support charity',
    },
    {
      name: 'GOG',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
        </svg>
      ),
      color: 'from-purple-600 to-purple-800',
      url: `https://www.gog.com/games?search=${encodeURIComponent(title)}`,
      note: 'DRM-free',
    },
    {
      name: 'Green Man Gaming',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1z" />
        </svg>
      ),
      color: 'from-green-600 to-green-800',
      url: `https://www.greenmangaming.com/games/?search=${encodeURIComponent(title)}`,
      note: 'Best prices',
    },
  ];

  return (
    <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/50 p-6 backdrop-blur-sm">
      <h2 className="text-lg font-bold mb-4">Where to Buy</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stores.map((store) => (
          <a
            key={store.name}
            href={store.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`group flex flex-col items-center gap-2 rounded-xl bg-gradient-to-br ${store.color} p-4 text-center text-white transition-all duration-200 hover:scale-105 hover:shadow-lg`}
          >
            <span className="flex items-center justify-center h-8 w-8 rounded-full bg-white/15">
              {store.icon}
            </span>
            <span className="text-sm font-semibold">{store.name}</span>
            <span className="text-xs text-white/70">{store.note}</span>
          </a>
        ))}
      </div>
      <p className="text-xs text-neutral-500 mt-4">
        Links may contain affiliate codes. Prices vary by store.
      </p>
    </div>
  );
}

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

  // Rating modal state
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingValue, setRatingValue] = useState<number | null>(null);

  // Platform editor state
  const [platformOpen, setPlatformOpen] = useState(false);
  const [platformSelection, setPlatformSelection] = useState<string[]>([]);

  const PLATFORM_OPTIONS = [
    'PC', 'PlayStation 5', 'PlayStation 4', 'PlayStation 3', 'PlayStation 2',
    'Xbox Series X/S', 'Xbox One', 'Xbox 360', 'Nintendo Switch',
    'Nintendo Wii U', 'Nintendo Wii', 'Nintendo 3DS', 'Nintendo DS',
    'macOS', 'Linux', 'iOS', 'Android', 'Steam Deck',
  ];

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

  function openRatingModal() {
    if (!gameStatus.length) return;
    const first = gameStatus[0];
    setRatingValue(first.userRating ?? null);
    setRatingOpen(true);
  }

  async function handleRateSubmit(rating: number | null) {
    if (!accessToken || !game || !gameStatus.length) return;
    try {
      await Promise.all(
        gameStatus.map((s) => libraryApi.updateItem(accessToken, s.itemId, { userRating: rating })),
      );
      toast.success(rating ? `Rated ${rating}/5` : 'Rating cleared');
      setRatingOpen(false);
      const status = await libraryApi.getGameStatus(accessToken, game.id);
      setGameStatus(status);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to rate');
    }
  }

  function openPlatformModal() {
    if (!gameStatus.length) return;
    const first = gameStatus[0];
    setPlatformSelection([...(first.platformsPlayed || [])]);
    setPlatformOpen(true);
  }

  function togglePlatform(platform: string) {
    setPlatformSelection((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    );
  }

  async function handlePlatformSubmit() {
    if (!accessToken || !game || !gameStatus.length) return;
    try {
      await Promise.all(
        gameStatus.map((s) =>
          libraryApi.updateItem(accessToken, s.itemId, { platformsPlayed: platformSelection }),
        ),
      );
      toast.success('Platforms updated');
      setPlatformOpen(false);
      const status = await libraryApi.getGameStatus(accessToken, game.id);
      setGameStatus(status);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update platforms');
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

      {/* Hero section */}
      <FadeIn>
        <div className="relative rounded-2xl border border-neutral-800/80">
        {game.backgroundImage && (
          <div className="absolute inset-0 overflow-hidden rounded-2xl">
            <Image
              src={game.backgroundImage}
              alt=""
              fill
              className="object-cover opacity-25"
              priority
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-neutral-950/40" />
            <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/60 via-transparent to-neutral-950/60" />
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
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-2">{game.title}</h1>
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
                <span className="bg-violet-500/20 text-violet-300 px-3 py-1 rounded-full font-medium border border-violet-500/20">
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

            {/* Library status & actions */}
            <div className="space-y-3">
              {gameStatus.length > 0 && (
                <div className="space-y-2">
                  {/* Library badges */}
                  <div className="flex flex-wrap gap-2">
                    {gameStatus.map((s) => (
                      <span
                        key={s.itemId}
                        className="inline-flex items-center gap-2 text-xs bg-violet-500/15 text-violet-300 px-3 py-1.5 rounded-full"
                      >
                        In: {s.libraryName}
                        {s.steamImport && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1b2838] text-[#66c0f4] border border-[#66c0f4]/30 text-[10px] font-medium leading-none">
                            <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M11.979 0C5.678 0 0.511 4.86 0.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z"/>
                            </svg>
                            Steam
                          </span>
                        )}
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
                  {/* Single set of rate + platform controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={openRatingModal}
                      className="text-xs px-2.5 py-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
                    >
                      {gameStatus[0].userRating ? <StarDisplay value={gameStatus[0].userRating} /> : '☆ Rate'}
                    </button>
                    <button
                      onClick={openPlatformModal}
                      className="text-xs px-2.5 py-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
                      title="Edit platforms played"
                    >
                      🎮 Platforms
                    </button>
                  </div>
                  {/* Platform chips */}
                  {gameStatus[0].platformsPlayed && gameStatus[0].platformsPlayed.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {gameStatus[0].platformsPlayed.map((p) => (
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
          <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/50 p-6 backdrop-blur-sm">
            <h2 className="text-lg font-bold mb-3">About</h2>
            <div
              className="text-sm text-neutral-300 game-description max-w-none"
              dangerouslySetInnerHTML={{ __html: game.description }}
            />
          </div>
        </FadeIn>
      )}

      {/* Tags */}
      {game.tags.length > 0 && (
        <FadeIn delay={0.2}>
          <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/50 p-6 backdrop-blur-sm">
            <h2 className="text-lg font-bold mb-3">Tags</h2>
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
          <h2 className="text-lg font-bold mb-4">Screenshots</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {game.screenshots.map((url, i) => (
              <div key={i} className="relative aspect-video rounded-xl overflow-hidden border border-neutral-800/80 group">
                <Image
                  src={url}
                  alt={`${game.title} screenshot ${i + 1}`}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, 50vw"
                />
              </div>
            ))}
          </div>
        </FadeIn>
      )}

      {/* Where to Buy */}
      <FadeIn delay={0.3}>
        <WhereToBuy title={game.title} />
      </FadeIn>

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
