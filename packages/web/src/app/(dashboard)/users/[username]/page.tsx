'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  userApi,
  friendApi,
  activityApi,
  type FriendRequestData,
  type ActivityItemData,
  ApiError,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/animations';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeTime, formatDate } from '@gamecase/shared';

interface PublicProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
  libraryCount: number;
  totalGamesTracked: number;
  libraries: { id: string; name: string; slug: string; itemCount: number }[];
}

function Avatar({ username, displayName, avatarUrl }: {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}) {
  const initials = (displayName || username).slice(0, 2).toUpperCase();

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={displayName || username}
        aria-label={displayName || username}
        className="h-24 w-24 rounded-full object-cover ring-2 ring-violet-500/30"
      />
    );
  }

  return (
    <div
      className="h-24 w-24 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-2xl font-bold text-white ring-2 ring-violet-500/30"
      aria-label={displayName || username}
    >
      {initials}
    </div>
  );
}

function ActivityDescription({ item }: { item: ActivityItemData }) {
  const userName = item.user.displayName || item.user.username;
  switch (item.type) {
    case 'game_added':
      return (
        <p className="text-sm text-neutral-300">
          <span className="font-medium text-white">{userName}</span> added{' '}
          {item.game ? (
            <Link href={`/games/${item.game.slug}`} className="font-medium text-violet-400 hover:text-violet-300">
              {item.game.title}
            </Link>
          ) : 'a game'}{' '}
          {item.library && (
            <>to <span className="text-neutral-200">{item.library.name}</span></>
          )}
        </p>
      );
    case 'game_rated': {
      const meta = item.metadata as { oldRating?: number; newRating?: number } | null;
      return (
        <p className="text-sm text-neutral-300">
          <span className="font-medium text-white">{userName}</span> rated{' '}
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
          <span className="font-medium text-white">{userName}</span> added notes to{' '}
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
          <span className="font-medium text-white">{userName}</span> created library{' '}
          {item.library ? (
            <span className="font-medium text-violet-400">{item.library.name}</span>
          ) : 'a new library'}
        </p>
      );
    case 'steam_imported': {
      const meta = item.metadata as { imported?: number; skipped?: number; notFound?: number } | null;
      return (
        <p className="text-sm text-neutral-300">
          <span className="font-medium text-white">{userName}</span> synced{' '}
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

type FriendState =
  | { type: 'none' }
  | { type: 'self' }
  | { type: 'pending_outgoing'; friendship: FriendRequestData }
  | { type: 'pending_incoming'; friendship: FriendRequestData }
  | { type: 'accepted'; friendship: FriendRequestData }
  | { type: 'blocked' };

export default function UserProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const { user: authUser, accessToken, isLoading: authLoading } = useAuth();
  const toast = useToast();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [friendState, setFriendState] = useState<FriendState>({ type: 'none' });
  const [actioning, setActioning] = useState(false);
  const [activity, setActivity] = useState<ActivityItemData[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);

  const isSelf = authUser?.username?.toLowerCase() === username?.toLowerCase();

  const loadProfile = useCallback(async () => {
    try {
      const data = await userApi.getPublicProfile(username);
      const u = data.user as unknown as PublicProfile;
      setProfile(u);

      // Load friendship status if not self and authenticated
      if (accessToken && !isSelf && u.id) {
        try {
          const status = await friendApi.getStatus(accessToken, u.id);
          if (!status) {
            setFriendState({ type: 'none' });
          } else if (status.status === 'accepted') {
            setFriendState({ type: 'accepted', friendship: status });
          } else if (status.status === 'pending') {
            if (status.requester.id === authUser?.id) {
              setFriendState({ type: 'pending_outgoing', friendship: status });
            } else {
              setFriendState({ type: 'pending_incoming', friendship: status });
            }
          } else if (status.status === 'blocked') {
            setFriendState({ type: 'blocked' });
          } else {
            setFriendState({ type: 'none' });
          }
        } catch {
          setFriendState({ type: 'none' });
        }
      } else if (isSelf) {
        setFriendState({ type: 'self' });
      }
    } catch {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [username, accessToken, isSelf, authUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadActivity = useCallback(async () => {
    if (!accessToken || !profile?.id) return;
    setActivityLoading(true);
    try {
      const data = await activityApi.getUserActivity(accessToken, profile.id, 1, 10);
      setActivity(data.items);
    } catch {
      // Not friends or no activity — that's fine
    } finally {
      setActivityLoading(false);
    }
  }, [accessToken, profile?.id]);

  useEffect(() => {
    if (!authLoading) loadProfile();
  }, [loadProfile, authLoading]);

  useEffect(() => {
    if (profile?.id) loadActivity();
  }, [loadActivity, profile?.id]);

  async function handleAddFriend() {
    if (!accessToken) return;
    setActioning(true);
    try {
      const result = await friendApi.sendRequest(accessToken, username);
      setFriendState({ type: 'pending_outgoing', friendship: result });
      toast.success('Friend request sent!');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to send request');
    } finally {
      setActioning(false);
    }
  }

  async function handleAccept() {
    if (!accessToken || friendState.type !== 'pending_incoming') return;
    setActioning(true);
    try {
      const result = await friendApi.respond(accessToken, friendState.friendship.id, 'accept');
      setFriendState({ type: 'accepted', friendship: result });
      toast.success(`You are now friends with ${username}!`);
      loadActivity();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to accept');
    } finally {
      setActioning(false);
    }
  }

  async function handleDecline() {
    if (!accessToken || friendState.type !== 'pending_incoming') return;
    setActioning(true);
    try {
      await friendApi.respond(accessToken, friendState.friendship.id, 'decline');
      setFriendState({ type: 'none' });
      toast.info('Request declined');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to decline');
    } finally {
      setActioning(false);
    }
  }

  async function handleRemove() {
    if (!accessToken || friendState.type !== 'accepted') return;
    setActioning(true);
    try {
      await friendApi.remove(accessToken, friendState.friendship.id);
      setFriendState({ type: 'none' });
      setShowRemoveModal(false);
      toast.success('Friend removed');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to remove friend');
    } finally {
      setActioning(false);
    }
  }

  async function handleBlock() {
    if (!accessToken || !profile) return;
    setActioning(true);
    try {
      await friendApi.block(accessToken, profile.id);
      setFriendState({ type: 'blocked' });
      setShowRemoveModal(false);
      toast.info('User blocked');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to block user');
    } finally {
      setActioning(false);
    }
  }

  if (loading) {
    return (
      <PageTransition className="space-y-8">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8">
          <div className="flex items-center gap-6">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        </div>
      </PageTransition>
    );
  }

  if (!profile) {
    return (
      <PageTransition className="py-16 text-center">
        <p className="text-neutral-400">User not found.</p>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="space-y-8">
      {/* Profile Card */}
      <FadeIn>
        <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/50 p-8 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <Avatar
              username={profile.username}
              displayName={profile.displayName}
              avatarUrl={profile.avatarUrl}
            />
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-white">
                {profile.displayName || profile.username}
              </h1>
              <p className="text-neutral-400">@{profile.username}</p>
              {profile.bio && <p className="mt-2 text-neutral-300">{profile.bio}</p>}
              <div className="flex flex-wrap gap-4 mt-4 text-sm text-neutral-400">
                <span>Member since {formatDate(profile.createdAt)}</span>
                <span>{profile.totalGamesTracked} games tracked</span>
                <span>{profile.libraryCount} public libraries</span>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {friendState.type === 'self' && (
                <Link href="/profile">
                  <Button variant="secondary" size="sm">Edit Profile</Button>
                </Link>
              )}
              {friendState.type === 'none' && (
                <Button size="sm" onClick={handleAddFriend} isLoading={actioning}>
                  Add Friend
                </Button>
              )}
              {friendState.type === 'pending_outgoing' && (
                <Button variant="secondary" size="sm" disabled>
                  Request Sent
                </Button>
              )}
              {friendState.type === 'pending_incoming' && (
                <>
                  <Button size="sm" onClick={handleAccept} isLoading={actioning}>
                    Accept Request
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDecline} isLoading={actioning}>
                    Decline
                  </Button>
                </>
              )}
              {friendState.type === 'accepted' && (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled>
                    Friends ✓
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowRemoveModal(true)}>
                    •••
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Recent Activity */}
      <FadeIn delay={0.1}>
        <h2 className="text-lg font-bold mb-4">Recent Activity</h2>
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
            {friendState.type !== 'accepted' && friendState.type !== 'self' && (
              <p className="text-sm mt-1">Become friends to see their activity.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {activity.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-neutral-800/80 bg-neutral-900/50 p-4 flex items-center gap-4"
              >
                <div className="flex-shrink-0">
                  {item.user.avatarUrl ? (
                    <img
                      src={item.user.avatarUrl}
                      alt={item.user.username}
                      aria-label={item.user.username}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-xs font-bold text-white"
                      aria-label={item.user.username}
                    >
                      {(item.user.displayName || item.user.username).slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
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

      {/* Public Libraries */}
      <FadeIn delay={0.2}>
        <h2 className="text-lg font-bold mb-4">Public Libraries</h2>
        {profile.libraries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-800/80 bg-neutral-900/30 py-12 text-center text-neutral-500">
            <p className="font-medium">No public libraries</p>
          </div>
        ) : (
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {profile.libraries.map((lib) => (
              <StaggerItem key={lib.id}>
                <Link
                  href={`/library/${lib.slug}?user=${profile.username}`}
                  className="group block rounded-2xl border border-neutral-800/80 bg-neutral-900/50 p-6 transition-all duration-300 hover:border-violet-500/30 hover:shadow-xl hover:shadow-violet-500/10 hover:-translate-y-0.5"
                >
                  <p className="font-medium group-hover:text-white transition-colors">{lib.name}</p>
                  <p className="mt-1 text-2xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                    {lib.itemCount}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">games</p>
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}
      </FadeIn>

      {/* Remove/Block Modal */}
      <Modal open={showRemoveModal} onClose={() => setShowRemoveModal(false)}>
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white">Friend Options</h2>
          <div className="space-y-2">
            <Button
              variant="danger"
              size="sm"
              className="w-full"
              onClick={handleRemove}
              isLoading={actioning}
            >
              Remove Friend
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleBlock}
              isLoading={actioning}
            >
              Block User
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowRemoveModal(false)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </PageTransition>
  );
}
