'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import { libraryApi, recommendationApi, type LibraryData, type RecommendationItem } from '@/lib/api';
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/animations';
import { StatCardSkeleton } from '@/components/ui/skeleton';

const STAT_COLORS: Record<string, string> = {
  played: 'from-green-500/20 to-green-500/5',
  currently_playing: 'from-blue-500/20 to-blue-500/5',
  want_to_play: 'from-violet-500/20 to-violet-500/5',
  backlog: 'from-orange-500/20 to-orange-500/5',
};

export default function DashboardPage() {
  const { user, accessToken } = useAuth();
  const [libraries, setLibraries] = useState<LibraryData[]>([]);
  const [recs, setRecs] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (accessToken) {
      Promise.all([
        libraryApi.getAll(accessToken).then(setLibraries).catch(() => {}),
        recommendationApi.getAll(accessToken, 1, 6).then((d) => setRecs(d.items)).catch(() => {}),
      ]).finally(() => setLoading(false));
    }
  }, [accessToken]);

  if (!user) return null;

  const defaultLibs = libraries.filter((l) => l.isDefault);
  const customLibs = libraries.filter((l) => !l.isDefault);
  const totalGames = libraries.reduce((sum, l) => sum + l.itemCount, 0);

  return (
    <PageTransition className="space-y-8">
      {/* Welcome */}
      <FadeIn>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome, {user.displayName || user.username} 👋
        </h1>
        <p className="mt-2 text-neutral-400">
          {loading
            ? 'Loading your library…'
            : totalGames === 0
            ? 'Your library is empty — browse games and start tracking!'
            : `You're tracking ${totalGames} game${totalGames !== 1 ? 's' : ''} across ${libraries.length} libraries.`}
        </p>
      </FadeIn>

      {/* Default library stat cards */}
      {loading ? (
        <StatCardSkeleton />
      ) : (
        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {defaultLibs.map((lib) => (
            <StaggerItem key={lib.id}>
              <Link
                href={`/library/${lib.slug}`}
                className={`block rounded-2xl border border-neutral-800 bg-gradient-to-br ${STAT_COLORS[lib.defaultType || ''] || 'from-neutral-800/20 to-neutral-800/5'} p-6 transition-all hover:border-neutral-700 hover:shadow-lg hover:shadow-violet-500/5`}
              >
                <p className="text-sm text-neutral-400">{lib.name}</p>
                <p className="mt-1 text-2xl font-bold">{lib.itemCount}</p>
              </Link>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}

      {/* Custom libraries */}
      {customLibs.length > 0 && (
        <FadeIn delay={0.2}>
          <h2 className="text-lg font-semibold mb-4">Custom Libraries</h2>
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" delay={0.1}>
            {customLibs.map((lib) => (
              <StaggerItem key={lib.id}>
                <Link
                  href={`/library/${lib.slug}`}
                  className="block rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 transition-all hover:border-neutral-700 hover:shadow-lg hover:shadow-violet-500/5"
                >
                  <p className="font-medium">{lib.name}</p>
                  {lib.description && (
                    <p className="mt-1 text-sm text-neutral-500 line-clamp-2">{lib.description}</p>
                  )}
                  <p className="mt-2 text-sm text-neutral-400">{lib.itemCount} games</p>
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </FadeIn>
      )}

      {/* Recommendations preview */}
      {recs.length > 0 && (
        <FadeIn delay={0.3}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recommended For You</h2>
            <Link href="/recommendations" className="text-sm text-violet-400 hover:underline">
              View all →
            </Link>
          </div>
          <StaggerContainer className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4" delay={0.1}>
            {recs.map((rec) => (
              <StaggerItem key={rec.id}>
                <Link
                  href={`/games/${rec.game.slug}`}
                  className="group block rounded-2xl border border-neutral-800 bg-neutral-900/50 overflow-hidden transition-all hover:border-neutral-700 hover:shadow-lg hover:shadow-violet-500/5"
                >
                  <div className="relative aspect-[3/4] bg-neutral-800">
                    {rec.game.coverImage ? (
                      <Image
                        src={rec.game.coverImage}
                        alt={rec.game.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 50vw, 16vw"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-neutral-600 text-xs">
                        No Image
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-medium line-clamp-1 group-hover:text-white transition-colors">
                      {rec.game.title}
                    </p>
                    <p className="text-[10px] text-neutral-500 mt-0.5">
                      {Math.round(rec.score * 100)}% match
                    </p>
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </FadeIn>
      )}

      {/* Profile info */}
      <FadeIn delay={0.4}>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
          <h2 className="text-lg font-semibold mb-4">Your Profile</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-neutral-500">Username</dt>
              <dd className="text-neutral-100">@{user.username}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Email</dt>
              <dd className="text-neutral-100">{user.email}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Display Name</dt>
              <dd className="text-neutral-100">{user.displayName || '—'}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Member Since</dt>
              <dd className="text-neutral-100">
                {new Date(user.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </dd>
            </div>
          </dl>
        </div>
      </FadeIn>
    </PageTransition>
  );
}
