'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
import { SteamImport } from './steam-import';
import { formatRelativeTime, formatDate } from '@gamecase/shared';

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
    case 'steam_imported': {
      const meta = item.metadata as { imported?: number; skipped?: number; notFound?: number } | null;
      return (
        <p className="text-sm text-neutral-300">
          Synced{' '}
          <span className="font-semibold text-blue-400">{meta?.imported ?? 0} games</span>{' '}from Steam
          {(meta?.skipped ?? 0) > 0 && (
            <span className="text-neutral-500"> · {meta!.skipped} already in library</span>
          )}
        </p>
      );
    }
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
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [activity, setActivity] = useState<ActivityItemData[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;
    setAvatarUploading(true);
    try {
      const data = await userApi.uploadAvatar(accessToken, file);
      setAvatarUrl(data.avatarUrl);
      setUser(data.user);
      toast.success('Profile picture updated!');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to upload image');
    } finally {
      setAvatarUploading(false);
      // Reset so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
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
          {/* Avatar + upload button */}
            <div className="flex-shrink-0 flex flex-col items-center gap-3">
              <div className="relative group">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName || user.username}
                    className="h-24 w-24 rounded-full object-cover ring-2 ring-violet-500/30"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="h-24 w-24 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-2xl font-bold text-white ring-2 ring-violet-500/30">
                    {initials}
                  </div>
                )}
                {avatarUploading && (
                  <span className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                    <svg className="h-6 w-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                {avatarUploading ? 'Uploading…' : 'Change Photo'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
                aria-label="Upload profile picture"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xl font-bold text-white">{displayName || user.username}</p>
              <p className="text-neutral-400">@{user.username}</p>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-sm text-neutral-500">Member since {formatDate(user.createdAt)}</p>
                {user.plan === 'pro' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 px-3 py-0.5 text-xs font-semibold text-violet-300">
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd" />
                    </svg>
                    Pro
                  </span>
                ) : (
                  <Link
                    href="/billing"
                    className="inline-flex items-center gap-1 rounded-full bg-neutral-800/80 px-2.5 py-0.5 text-xs font-medium text-neutral-400 hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
                  >
                    Free Plan
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </Link>
                )}
              </div>
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

            <Button type="submit" size="sm" isLoading={saving} disabled={!dirty}>
              Save Changes
            </Button>
          </div>
        </form>
      </FadeIn>

      {/* Steam Import */}
      <FadeIn delay={0.08}>
        <SteamImport />
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
                {item.type === 'steam_imported' && (
                  <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <svg className="h-6 w-6 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658a3.387 3.387 0 0 1 1.912-.59c.064 0 .128.003.19.008l2.861-4.142V8.91a4.528 4.528 0 0 1 4.524-4.524c2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396a3.406 3.406 0 0 1-3.362-2.898L.453 14.83A11.99 11.99 0 0 0 11.979 24c6.627 0 12-5.373 12-12s-5.372-12-12-12z" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </FadeIn>
    </PageTransition>
  );
}
