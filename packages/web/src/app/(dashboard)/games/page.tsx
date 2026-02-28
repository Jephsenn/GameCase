'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import { gameApi, type GameListItem, type PaginatedData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/animations';
import { GameGridSkeleton } from '@/components/ui/skeleton';

export default function BrowseGamesPage() {
  const { accessToken } = useAuth();
  const [results, setResults] = useState<PaginatedData<GameListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [genre, setGenre] = useState('');
  const [platform, setPlatform] = useState('');
  const [genres, setGenres] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [platforms, setPlatforms] = useState<{ id: string; name: string; slug: string }[]>([]);

  // Load filter options
  useEffect(() => {
    gameApi.getGenres().then(setGenres).catch(() => {});
    gameApi.getPlatforms().then(setPlatforms).catch(() => {});
  }, []);

  const search = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page) };
      if (query.trim()) params.q = query.trim();
      if (genre) params.genre = genre;
      if (platform) params.platform = platform;
      const data = await gameApi.search(accessToken, params);
      setResults(data);
    } catch {
      /* swallow */
    } finally {
      setLoading(false);
    }
  }, [accessToken, query, page, genre, platform]);

  useEffect(() => {
    search();
  }, [search]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    search();
  }

  return (
    <PageTransition className="space-y-6">
      <FadeIn>
        <h1 className="text-3xl font-bold tracking-tight">Browse Games</h1>
        <p className="mt-1 text-neutral-400">
          Search and discover games to add to your library
        </p>
      </FadeIn>

      {/* Search + Filters */}
      <FadeIn delay={0.1}>
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search games..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            value={genre}
            onChange={(e) => { setGenre(e.target.value); setPage(1); }}
            className="h-11 rounded-xl border border-neutral-800 bg-neutral-900 px-3 text-sm text-neutral-300 focus:outline-none focus:ring-2 focus:ring-violet-500 hover:border-neutral-700 transition-colors"
          >
            <option value="">All Genres</option>
            {genres.map((g) => (
              <option key={g.id} value={g.slug}>{g.name}</option>
            ))}
          </select>
          <select
            value={platform}
            onChange={(e) => { setPlatform(e.target.value); setPage(1); }}
            className="h-11 rounded-xl border border-neutral-800 bg-neutral-900 px-3 text-sm text-neutral-300 focus:outline-none focus:ring-2 focus:ring-violet-500 hover:border-neutral-700 transition-colors"
          >
            <option value="">All Platforms</option>
            {platforms.map((p) => (
              <option key={p.id} value={p.slug}>{p.name}</option>
            ))}
          </select>
          <Button type="submit" size="sm">
            Search
          </Button>
        </form>
      </FadeIn>

      {/* Results */}
      {loading ? (
        <GameGridSkeleton />
      ) : results && results.items.length > 0 ? (
        <>
          <p className="text-sm text-neutral-500">
            {results.total} result{results.total !== 1 ? 's' : ''} found
          </p>
          <StaggerContainer className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {results.items.map((game) => (
              <StaggerItem key={game.id}>
                <Link
                  href={`/games/${game.slug}`}
                  className="group block rounded-2xl border border-neutral-800 bg-neutral-900/50 overflow-hidden transition-all hover:border-neutral-700 hover:shadow-lg hover:shadow-violet-500/5"
                >
                  <div className="relative aspect-[3/4] bg-neutral-800 overflow-hidden">
                    {game.coverImage ? (
                      <Image
                        src={game.coverImage}
                        alt={game.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-neutral-600 text-sm">
                        No Image
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="font-medium text-sm line-clamp-1 group-hover:text-white transition-colors">
                      {game.title}
                    </p>
                    {game.genres.length > 0 && (
                      <p className="text-xs text-neutral-500 line-clamp-1">
                        {game.genres.map((g) => g.name).join(', ')}
                      </p>
                    )}
                    {game.releaseDate && (
                      <p className="text-xs text-neutral-600">
                        {new Date(game.releaseDate).getFullYear()}
                      </p>
                    )}
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>

          {/* Pagination */}
          {results.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <Button
                size="sm"
                variant="outline"
                disabled={!results.hasPrevious}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Previous
              </Button>
              <span className="text-sm text-neutral-400">
                Page {results.page} of {results.totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={!results.hasNext}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </Button>
            </div>
          )}
        </>
      ) : (
        <FadeIn>
          <div className="rounded-2xl border border-dashed border-neutral-800 py-16 text-center text-neutral-500">
            <p className="text-lg">No games found.</p>
            <p className="text-sm mt-1">Try different search terms or filters.</p>
          </div>
        </FadeIn>
      )}
    </PageTransition>
  );
}
