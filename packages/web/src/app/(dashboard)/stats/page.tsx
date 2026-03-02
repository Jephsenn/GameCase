'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { statsApi, type UserStatsData, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { PageTransition, FadeIn } from '@/components/ui/animations';
import { Skeleton } from '@/components/ui/skeleton';

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/50 p-6 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className={`flex items-center justify-center h-10 w-10 rounded-xl ${accent || 'bg-violet-500/15'}`}>
          {icon}
        </div>
        <span className="text-sm font-medium text-neutral-400">{label}</span>
      </div>
      <p className="text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function GenreBar({ name, count, maxCount }: { name: string; count: number; maxCount: number }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-300">{name}</span>
        <span className="text-neutral-500">{count} games</span>
      </div>
      <div className="h-2.5 rounded-full bg-neutral-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <span
        key={i}
        className={i <= Math.round(rating) ? 'text-yellow-400' : 'text-neutral-700'}
      >
        ★
      </span>,
    );
  }
  return <span className="text-lg">{stars}</span>;
}

export default function StatsPage() {
  const { user, accessToken, isLoading: authLoading } = useAuth();
  const toast = useToast();

  const [stats, setStats] = useState<UserStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isPro = user?.plan === 'pro';

  useEffect(() => {
    if (authLoading || !accessToken || !isPro) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const data = await statsApi.getUserStats(accessToken);
        setStats(data);
      } catch (err) {
        setError(true);
        if (err instanceof ApiError && err.status !== 403) {
          toast.error('Failed to load stats');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [accessToken, authLoading, isPro]); // eslint-disable-line react-hooks/exhaustive-deps

  if (authLoading) {
    return (
      <PageTransition className="space-y-8">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </PageTransition>
    );
  }

  if (!isPro) {
    return (
      <PageTransition className="space-y-8">
        <FadeIn>
          <h1 className="text-3xl font-black tracking-tight">
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              Year in Review
            </span>
          </h1>
          <p className="mt-1 text-neutral-400">Your gaming stats and insights</p>
        </FadeIn>
        <FadeIn delay={0.05}>
          <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-12 text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-violet-500/15 mb-4">
              <svg className="h-8 w-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Unlock Your Year in Review</h2>
            <p className="text-neutral-400 mb-6 max-w-md mx-auto">
              Get detailed insights into your gaming habits — top genres, most played months, ratings breakdown, and more.
            </p>
            <Link
              href="/billing"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-8 py-3 text-sm font-medium text-white hover:bg-violet-500 hover:shadow-[0_0_24px_rgba(139,92,246,0.35)] transition-all duration-200"
            >
              Upgrade to Pro
            </Link>
          </div>
        </FadeIn>
      </PageTransition>
    );
  }

  if (loading) {
    return (
      <PageTransition className="space-y-8">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-64 mt-3" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </PageTransition>
    );
  }

  if (!stats || error) {
    return (
      <PageTransition className="py-20 text-center text-neutral-500">
        <p>Failed to load stats. Please try again later.</p>
      </PageTransition>
    );
  }

  const currentYear = new Date().getFullYear();
  const maxGenreCount = stats.topGenres.length > 0 ? stats.topGenres[0].count : 1;

  // Format month name
  const formatMonth = (ym: string) => {
    const [year, month] = ym.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <PageTransition className="space-y-8">
      <FadeIn>
        <h1 className="text-3xl font-black tracking-tight">
          <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            {currentYear} Year in Review
          </span>
        </h1>
        <p className="mt-1 text-neutral-400">Your gaming journey this year</p>
      </FadeIn>

      {/* Top stat cards */}
      <FadeIn delay={0.05}>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label="Games Tracked"
            value={stats.totalGamesTracked}
            accent="bg-violet-500/15"
            icon={
              <svg className="h-5 w-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            }
          />
          <StatCard
            label="Added This Year"
            value={stats.gamesAddedThisYear}
            accent="bg-green-500/15"
            icon={
              <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            }
          />
          <StatCard
            label="Games Rated"
            value={stats.gamesRatedCount}
            accent="bg-yellow-500/15"
            icon={<span className="text-yellow-400 text-lg">★</span>}
          />
          <StatCard
            label="Libraries"
            value={stats.totalLibraries}
            accent="bg-blue-500/15"
            icon={
              <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
          />
          <StatCard
            label="Friends"
            value={stats.friendCount}
            accent="bg-pink-500/15"
            icon={
              <svg className="h-5 w-5 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
          />
          <StatCard
            label="Average Rating"
            value={stats.averageRating !== null ? `${stats.averageRating.toFixed(1)}/5` : 'N/A'}
            accent="bg-amber-500/15"
            icon={<span className="text-amber-400 text-lg">⭐</span>}
          />
        </div>
      </FadeIn>

      {/* Top Genres */}
      {stats.topGenres.length > 0 && (
        <FadeIn delay={0.1}>
          <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/50 p-6 backdrop-blur-sm">
            <h2 className="text-lg font-bold mb-4">Top Genres</h2>
            <div className="space-y-3">
              {stats.topGenres.map((genre) => (
                <GenreBar
                  key={genre.name}
                  name={genre.name}
                  count={genre.count}
                  maxCount={maxGenreCount}
                />
              ))}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Top Rated Games */}
      {stats.topRatedGames.length > 0 && (
        <FadeIn delay={0.15}>
          <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/50 p-6 backdrop-blur-sm">
            <h2 className="text-lg font-bold mb-4">Your Top Rated Games</h2>
            <div className="space-y-3">
              {stats.topRatedGames.map((game, i) => (
                <Link
                  key={game.slug}
                  href={`/games/${game.slug}`}
                  className="flex items-center gap-4 rounded-xl p-3 -mx-3 hover:bg-neutral-800/50 transition-colors"
                >
                  <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-neutral-800 text-sm font-bold text-neutral-400">
                    {i + 1}
                  </span>
                  {game.backgroundImage ? (
                    <img
                      src={game.backgroundImage}
                      alt={game.title}
                      className="h-12 w-20 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-12 w-20 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-600 text-xs">
                      No img
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{game.title}</p>
                    <StarRating rating={game.userRating} />
                  </div>
                  <span className="text-lg font-bold text-yellow-400">
                    {game.userRating}/5
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Most Active Month */}
      {stats.mostActiveMonth && (
        <FadeIn delay={0.2}>
          <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/50 p-6 backdrop-blur-sm text-center">
            <p className="text-sm text-neutral-400 mb-1">Most Active Month</p>
            <p className="text-2xl font-black text-white">
              {formatMonth(stats.mostActiveMonth.month)}
            </p>
            <p className="text-violet-400 font-medium mt-1">
              {stats.mostActiveMonth.count} games added
            </p>
          </div>
        </FadeIn>
      )}
    </PageTransition>
  );
}
