'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { activityApi, type ActivityItemData, type PaginatedData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { PageTransition, FadeIn } from '@/components/ui/animations';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeTime } from '@gametracker/shared';

function ActivityDescription({ item }: { item: ActivityItemData }) {
  const userName = item.user.displayName || item.user.username;
  switch (item.type) {
    case 'game_added':
      return (
        <p className="text-sm text-neutral-300">
          <Link href={`/users/${item.user.username}`} className="font-medium text-white hover:text-violet-400">
            {userName}
          </Link>{' '}
          added{' '}
          {item.game ? (
            <Link href={`/games/${item.game.slug}`} className="font-medium text-violet-400 hover:text-violet-300">
              {item.game.title}
            </Link>
          ) : 'a game'}{' '}
          {item.library && <>to <span className="text-neutral-200">{item.library.name}</span></>}
        </p>
      );
    case 'game_rated': {
      const meta = item.metadata as { oldRating?: number; newRating?: number } | null;
      return (
        <p className="text-sm text-neutral-300">
          <Link href={`/users/${item.user.username}`} className="font-medium text-white hover:text-violet-400">
            {userName}
          </Link>{' '}
          rated{' '}
          {item.game ? (
            <Link href={`/games/${item.game.slug}`} className="font-medium text-violet-400 hover:text-violet-300">
              {item.game.title}
            </Link>
          ) : 'a game'}{' '}
          {meta?.newRating !== undefined && (
            <span className="text-yellow-400">{meta.newRating}/5</span>
          )}
          {meta?.oldRating !== undefined && meta.oldRating !== null && (
            <span className="text-neutral-500"> (was {meta.oldRating}/5)</span>
          )}
        </p>
      );
    }
    case 'game_noted':
      return (
        <p className="text-sm text-neutral-300">
          <Link href={`/users/${item.user.username}`} className="font-medium text-white hover:text-violet-400">
            {userName}
          </Link>{' '}
          added notes to{' '}
          {item.game ? (
            <Link href={`/games/${item.game.slug}`} className="font-medium text-violet-400 hover:text-violet-300">
              {item.game.title}
            </Link>
          ) : 'a game'}
        </p>
      );
    case 'library_created':
      return (
        <p className="text-sm text-neutral-300">
          <Link href={`/users/${item.user.username}`} className="font-medium text-white hover:text-violet-400">
            {userName}
          </Link>{' '}
          created library{' '}
          {item.library ? (
            <span className="font-medium text-violet-400">{item.library.name}</span>
          ) : 'a new library'}
        </p>
      );
    default:
      return <p className="text-sm text-neutral-400">Unknown activity</p>;
  }
}

export default function FeedPage() {
  const { accessToken, isLoading: authLoading } = useAuth();
  const toast = useToast();

  const [items, setItems] = useState<ActivityItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  const loadFeed = useCallback(async (pageNum: number, append: boolean) => {
    if (!accessToken) return;
    const setLoad = append ? setLoadingMore : setLoading;
    setLoad(true);
    try {
      const data: PaginatedData<ActivityItemData> = await activityApi.getMyFeed(accessToken, pageNum);
      setItems((prev) => (append ? [...prev, ...data.items] : data.items));
      setHasNext(data.hasNext);
      setPage(pageNum);
    } catch {
      toast.error('Failed to load feed');
    } finally {
      setLoad(false);
    }
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!authLoading) loadFeed(1, false);
  }, [loadFeed, authLoading]);

  if (loading) {
    return (
      <PageTransition className="space-y-8">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-64 mt-3" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="space-y-8">
      <FadeIn>
        <h1 className="text-3xl font-black tracking-tight">
          <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Feed</span>
        </h1>
        <p className="mt-1 text-neutral-400">See what your friends are playing</p>
      </FadeIn>

      {items.length === 0 ? (
        <FadeIn delay={0.1}>
          <div className="rounded-2xl border border-dashed border-neutral-800/80 bg-neutral-900/30 py-16 text-center text-neutral-500">
            <p className="text-4xl mb-3">🎮</p>
            <p className="font-medium">Your feed is empty</p>
            <p className="text-sm mt-1">
              Follow some friends to see their activity here!
            </p>
            <Link href="/friends" className="inline-block mt-4">
              <Button size="sm" variant="secondary">Find Friends</Button>
            </Link>
          </div>
        </FadeIn>
      ) : (
        <FadeIn delay={0.1}>
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-neutral-800/80 bg-neutral-900/50 p-4 flex items-center gap-4 transition-colors hover:bg-neutral-900/70"
              >
                {/* Avatar */}
                <Link href={`/users/${item.user.username}`} className="flex-shrink-0">
                  {item.user.avatarUrl ? (
                    <img
                      src={item.user.avatarUrl}
                      alt={item.user.username}
                      aria-label={item.user.displayName || item.user.username}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-xs font-bold text-white"
                      aria-label={item.user.displayName || item.user.username}
                    >
                      {(item.user.displayName || item.user.username).slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </Link>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <ActivityDescription item={item} />
                  <p className="text-xs text-neutral-500 mt-0.5">{formatRelativeTime(item.createdAt)}</p>
                </div>

                {/* Game thumbnail */}
                {(item.type === 'game_added' || item.type === 'game_rated') && item.game?.coverImage && (
                  <Link href={`/games/${item.game.slug}`} className="flex-shrink-0">
                    <img
                      src={item.game.coverImage}
                      alt={item.game.title}
                      className="h-14 w-10 rounded object-cover"
                    />
                  </Link>
                )}
              </div>
            ))}
          </div>

          {hasNext && (
            <div className="flex justify-center pt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => loadFeed(page + 1, true)}
                isLoading={loadingMore}
              >
                Load More
              </Button>
            </div>
          )}
        </FadeIn>
      )}
    </PageTransition>
  );
}
