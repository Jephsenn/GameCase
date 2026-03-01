'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  userApi,
  activityApi,
  type ActivityItemData,
  ApiError,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { PageTransition, FadeIn } from '@/components/ui/animations';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeTime, formatDate } from '@gametracker/shared';

function ActivityDescription({ item }: { item: ActivityItemData }) {
  switch (item.type) {
    case 'game_added':
      return (
        <p className="text-sm text-neutral-300">
          Added{' '}
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
          Rated{' '}
          {item.game ? (
            <Link href={`/games/${item.game.slug}`} className="font-medium text-violet-400 hover:text-violet-300">
              {item.game.title}
            </Link>
          ) : 'a game'}{' '}
          {meta?.newRating !== undefined && <span className="text-yellow-400">{meta.newRating}/5</span>}
          {meta?.oldRating !== undefined && meta.oldRating !== null && (
            <span className="text-neutral-500"> (was {meta.oldRating}/5)</span>
          )}
        </p>
      );
    }
    case 'game_noted':
      return (
        <p className="text-sm text-neutral-300">
          Added notes to{' '}
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
          Created library{' '}
          {item.library ? (
            <span className="font-medium text-violet-400">{item.library.name}</span>
          ) : 'a new library'}
        </p>
      );
    default:
      return <p className="text-sm text-neutral-400">Unknown activity</p>;
  }
}

export default function ProfilePage() {
  const { user, accessToken, isLoading: authLoading, setUser } = useAuth();
  const toast = useToast();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [activity, setActivity] = useState<ActivityItemData[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
      setAvatarUrl(user.avatarUrl || '');
    }
  }, [user]);

  const loadActivity = useCallback(async () => {
    if (!accessToken) return;
    setActivityLoading(true);
    try {
      const data = await activityApi.getMyFeed(accessToken, 1, 10);
      // Filter to only my own items
      setActivity(data.items.filter((item) => item.user.id === user?.id));
    } catch {
      // Feed might be empty
    } finally {
      setActivityLoading(false);
    }
  }, [accessToken, user?.id]);

  useEffect(() => {
    if (!authLoading && accessToken) loadActivity();
  }, [loadActivity, authLoading, accessToken]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      const data = await userApi.updateProfile(accessToken, {
        displayName: displayName.trim() || undefined,
        bio: bio.trim() || undefined,
      });
      setUser(data.user);
      setDirty(false);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  const initials = (displayName || user?.username || '').slice(0, 2).toUpperCase();

  if (authLoading || !user) {
    return (
      <PageTransition className="space-y-8">
        <Skeleton className="h-8 w-48" />
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 space-y-4">
          <Skeleton className="h-24 w-24 rounded-full" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="space-y-8">
      <FadeIn>
        <h1 className="text-3xl font-black tracking-tight">
          <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Profile</span>
        </h1>
        <p className="mt-1 text-neutral-400">Manage your public profile</p>
      </FadeIn>

      {/* Profile Form */}
      <FadeIn delay={0.05}>
        <form onSubmit={handleSave} className="rounded-2xl border border-neutral-800/80 bg-neutral-900/50 p-8 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row items-start gap-6 mb-6">
            {/* Avatar preview */}
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName || user.username}
                aria-label={displayName || user.username}
                className="h-24 w-24 rounded-full object-cover ring-2 ring-violet-500/30"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div
                className="h-24 w-24 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-2xl font-bold text-white ring-2 ring-violet-500/30"
                aria-label={displayName || user.username}
              >
                {initials}
              </div>
            )}
            <div className="space-y-1">
              <p className="text-xl font-bold text-white">{displayName || user.username}</p>
              <p className="text-neutral-400">@{user.username}</p>
              <p className="text-sm text-neutral-500">Member since {formatDate(user.createdAt)}</p>
            </div>
          </div>

          <div className="space-y-4 max-w-lg">
            <Input
              label="Display Name"
              placeholder="Your display name"
              value={displayName}
              onChange={(e) => { setDisplayName(e.target.value); setDirty(true); }}
              aria-label="Display name"
            />
            <div className="space-y-1.5">
              <label htmlFor="bio" className="block text-sm font-medium text-neutral-300">Bio</label>
              <textarea
                id="bio"
                className="flex w-full rounded-xl border border-neutral-800/80 bg-neutral-900/80 px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent hover:border-neutral-700 transition-colors resize-none backdrop-blur-sm"
                rows={3}
                placeholder="Tell others about yourself"
                value={bio}
                onChange={(e) => { setBio(e.target.value); setDirty(true); }}
                maxLength={500}
                aria-label="Bio"
              />
            </div>
            <Input
              label="Avatar URL"
              placeholder="https://example.com/avatar.jpg"
              value={avatarUrl}
              onChange={(e) => { setAvatarUrl(e.target.value); setDirty(true); }}
              type="url"
              aria-label="Avatar URL"
            />
            <Button type="submit" size="sm" isLoading={saving} disabled={!dirty}>
              Save Changes
            </Button>
          </div>
        </form>
      </FadeIn>

      {/* Recent Activity */}
      <FadeIn delay={0.1}>
        <h2 className="text-lg font-bold mb-4">Your Recent Activity</h2>
        {activityLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ) : activity.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-800/80 bg-neutral-900/30 py-12 text-center text-neutral-500">
            <p className="font-medium">No recent activity</p>
            <p className="text-sm mt-1">Start adding games to your library to see activity here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activity.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-neutral-800/80 bg-neutral-900/50 p-4 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <ActivityDescription item={item} />
                  <p className="text-xs text-neutral-500 mt-0.5">{formatRelativeTime(item.createdAt)}</p>
                </div>
                {(item.type === 'game_added' || item.type === 'game_rated') && item.game?.coverImage && (
                  <Link href={`/games/${item.game.slug}`} className="flex-shrink-0">
                    <img
                      src={item.game.coverImage}
                      alt={item.game.title}
                      className="h-12 w-9 rounded object-cover"
                    />
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </FadeIn>
    </PageTransition>
  );
}
