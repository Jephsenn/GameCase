'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  friendApi,
  type FriendData,
  type FriendRequestData,
  ApiError,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/animations';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';

type Tab = 'friends' | 'requests' | 'sent';

function Avatar({ username, displayName, avatarUrl, size = 'md' }: {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const initials = (displayName || username).slice(0, 2).toUpperCase();
  const sizeClasses = { sm: 'h-8 w-8 text-xs', md: 'h-12 w-12 text-sm', lg: 'h-16 w-16 text-lg' };

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={displayName || username}
        aria-label={displayName || username}
        className={`${sizeClasses[size]} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center font-bold text-white`}
      aria-label={displayName || username}
    >
      {initials}
    </div>
  );
}

export default function FriendsPage() {
  const { accessToken, isLoading: authLoading } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<FriendData[]>([]);
  const [pending, setPending] = useState<FriendRequestData[]>([]);
  const [sent, setSent] = useState<FriendRequestData[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');

  const [removeModal, setRemoveModal] = useState<FriendData | null>(null);
  const [removing, setRemoving] = useState(false);

  const loadAll = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [f, p, s] = await Promise.all([
        friendApi.getAll(accessToken),
        friendApi.getPending(accessToken),
        friendApi.getSent(accessToken),
      ]);
      setFriends(f);
      setPending(p);
      setSent(s);
    } catch {
      toast.error('Failed to load friends data');
    } finally {
      setLoading(false);
    }
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!authLoading) loadAll();
  }, [loadAll, authLoading]);

  async function handleSendRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !addUsername.trim()) return;
    setAdding(true);
    setAddError('');
    setAddSuccess('');
    try {
      const result = await friendApi.sendRequest(accessToken, addUsername.trim());
      setSent((prev) => [result, ...prev]);
      setAddSuccess(`Friend request sent to ${addUsername.trim()}!`);
      setAddUsername('');
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : 'Failed to send request');
    } finally {
      setAdding(false);
    }
  }

  async function handleAccept(request: FriendRequestData) {
    if (!accessToken) return;
    // Optimistic update
    setPending((prev) => prev.filter((r) => r.id !== request.id));
    setFriends((prev) => [
      {
        friendshipId: request.id,
        id: request.requester.id,
        username: request.requester.username,
        displayName: request.requester.displayName,
        avatarUrl: request.requester.avatarUrl,
        bio: request.requester.bio,
      },
      ...prev,
    ]);
    try {
      await friendApi.respond(accessToken, request.id, 'accept');
      toast.success(`You are now friends with ${request.requester.username}!`);
    } catch (err) {
      // Rollback
      setPending((prev) => [request, ...prev]);
      setFriends((prev) => prev.filter((f) => f.friendshipId !== request.id));
      toast.error(err instanceof ApiError ? err.message : 'Failed to accept request');
    }
  }

  async function handleDecline(request: FriendRequestData) {
    if (!accessToken) return;
    // Optimistic update
    setPending((prev) => prev.filter((r) => r.id !== request.id));
    try {
      await friendApi.respond(accessToken, request.id, 'decline');
      toast.info('Request declined');
    } catch (err) {
      setPending((prev) => [request, ...prev]);
      toast.error(err instanceof ApiError ? err.message : 'Failed to decline request');
    }
  }

  async function handleCancelSent(request: FriendRequestData) {
    if (!accessToken) return;
    setSent((prev) => prev.filter((r) => r.id !== request.id));
    try {
      await friendApi.remove(accessToken, request.id);
      toast.info('Request cancelled');
    } catch {
      setSent((prev) => [request, ...prev]);
      toast.error('Failed to cancel request');
    }
  }

  async function handleRemoveFriend() {
    if (!accessToken || !removeModal) return;
    setRemoving(true);
    const friend = removeModal;
    setFriends((prev) => prev.filter((f) => f.friendshipId !== friend.friendshipId));
    setRemoveModal(null);
    try {
      await friendApi.remove(accessToken, friend.friendshipId);
      toast.success(`Removed ${friend.username} from friends`);
    } catch (err) {
      setFriends((prev) => [friend, ...prev]);
      toast.error(err instanceof ApiError ? err.message : 'Failed to remove friend');
    } finally {
      setRemoving(false);
    }
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'friends', label: 'Friends' },
    { key: 'requests', label: 'Requests', count: pending.length },
    { key: 'sent', label: 'Sent' },
  ];

  if (loading) {
    return (
      <PageTransition className="space-y-8">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-64 mt-3" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 space-y-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="space-y-8">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Friends</span>
            </h1>
            <p className="mt-1 text-neutral-400">
              {friends.length} friend{friends.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button size="sm" onClick={() => { setShowAdd(true); setAddError(''); setAddSuccess(''); }}>
            + Add Friend
          </Button>
        </div>
      </FadeIn>

      {/* Tabs */}
      <FadeIn delay={0.05}>
        <div className="flex gap-1 border-b border-neutral-800/80">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                tab === t.key ? 'text-white' : 'text-neutral-400 hover:text-neutral-200'
              }`}
              aria-label={`${t.label} tab`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold">
                  {t.count}
                </span>
              )}
              {tab === t.key && (
                <motion.div
                  layoutId="friends-tab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </FadeIn>

      {/* Friends Tab */}
      {tab === 'friends' && (
        <FadeIn delay={0.1}>
          {friends.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-800/80 bg-neutral-900/30 py-16 text-center text-neutral-500">
              <p className="text-4xl mb-3">👋</p>
              <p className="font-medium">No friends yet</p>
              <p className="text-sm mt-1">Add friends to see what they&apos;re playing!</p>
            </div>
          ) : (
            <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {friends.map((friend) => (
                <StaggerItem key={friend.friendshipId}>
                  <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/50 p-6 transition-all duration-300 hover:border-neutral-700/80">
                    <div className="flex items-start gap-4">
                      <Avatar username={friend.username} displayName={friend.displayName} avatarUrl={friend.avatarUrl} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{friend.displayName || friend.username}</p>
                        <p className="text-sm text-neutral-400 truncate">@{friend.username}</p>
                        {friend.bio && (
                          <p className="text-sm text-neutral-500 mt-1 line-clamp-2">{friend.bio}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Link href={`/users/${friend.username}`} className="flex-1">
                        <Button variant="secondary" size="sm" className="w-full">
                          View Profile
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRemoveModal(friend)}
                        aria-label={`Remove ${friend.username}`}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          )}
        </FadeIn>
      )}

      {/* Requests Tab */}
      {tab === 'requests' && (
        <FadeIn delay={0.1}>
          {pending.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-800/80 bg-neutral-900/30 py-16 text-center text-neutral-500">
              <p className="font-medium">No pending requests</p>
              <p className="text-sm mt-1">When someone sends you a friend request, it will appear here.</p>
            </div>
          ) : (
            <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pending.map((req) => (
                <StaggerItem key={req.id}>
                  <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/50 p-6">
                    <div className="flex items-start gap-4">
                      <Avatar username={req.requester.username} displayName={req.requester.displayName} avatarUrl={req.requester.avatarUrl} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{req.requester.displayName || req.requester.username}</p>
                        <p className="text-sm text-neutral-400 truncate">@{req.requester.username}</p>
                        {req.requester.bio && (
                          <p className="text-sm text-neutral-500 mt-1 line-clamp-2">{req.requester.bio}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button size="sm" className="flex-1" onClick={() => handleAccept(req)}>
                        Accept
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => handleDecline(req)}>
                        Decline
                      </Button>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          )}
        </FadeIn>
      )}

      {/* Sent Tab */}
      {tab === 'sent' && (
        <FadeIn delay={0.1}>
          {sent.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-800/80 bg-neutral-900/30 py-16 text-center text-neutral-500">
              <p className="font-medium">No sent requests</p>
              <p className="text-sm mt-1">Friend requests you&apos;ve sent will appear here.</p>
            </div>
          ) : (
            <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sent.map((req) => (
                <StaggerItem key={req.id}>
                  <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/50 p-6">
                    <div className="flex items-start gap-4">
                      <Avatar username={req.recipient.username} displayName={req.recipient.displayName} avatarUrl={req.recipient.avatarUrl} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{req.recipient.displayName || req.recipient.username}</p>
                        <p className="text-sm text-neutral-400 truncate">@{req.recipient.username}</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <Button variant="outline" size="sm" className="w-full" onClick={() => handleCancelSent(req)}>
                        Cancel Request
                      </Button>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          )}
        </FadeIn>
      )}

      {/* Add Friend Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)}>
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white">Add Friend</h2>
          <p className="text-sm text-neutral-400">Enter a username to send a friend request.</p>
          <form onSubmit={handleSendRequest} className="space-y-4">
            <Input
              label="Username"
              placeholder="Enter username"
              value={addUsername}
              onChange={(e) => { setAddUsername(e.target.value); setAddError(''); setAddSuccess(''); }}
              required
              aria-label="Friend username"
            />
            {addError && <p className="text-sm text-red-400">{addError}</p>}
            {addSuccess && <p className="text-sm text-green-400">{addSuccess}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowAdd(false)} type="button">
                Cancel
              </Button>
              <Button size="sm" type="submit" isLoading={adding}>
                Send Request
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Remove Friend Modal */}
      <Modal open={!!removeModal} onClose={() => setRemoveModal(null)}>
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white">Remove Friend</h2>
          <p className="text-sm text-neutral-400">
            Are you sure you want to remove <span className="text-white font-medium">{removeModal?.displayName || removeModal?.username}</span> from your friends?
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setRemoveModal(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleRemoveFriend} isLoading={removing}>
              Remove
            </Button>
          </div>
        </div>
      </Modal>
    </PageTransition>
  );
}
