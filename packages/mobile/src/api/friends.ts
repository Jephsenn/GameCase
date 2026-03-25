import apiClient from './client';

export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked';

export interface PublicUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
}

export interface Friendship {
  id: string;
  requester: PublicUser;
  recipient: PublicUser;
  status: FriendshipStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FriendshipStatusResponse {
  id: string;
  requester: PublicUser;
  recipient: PublicUser;
  status: FriendshipStatus;
  direction: 'sent' | 'received';
  createdAt: string;
  updatedAt: string;
}

export interface FriendItem extends PublicUser {
  friendshipId: string;
}

export async function getFriends(): Promise<FriendItem[]> {
  const res = await apiClient.get<{ success: true; data: FriendItem[] }>('/friends');
  return res.data.data;
}

export async function getPendingRequests(): Promise<Friendship[]> {
  const res = await apiClient.get<{ success: true; data: Friendship[] }>('/friends/pending');
  return res.data.data;
}

export async function getSentRequests(): Promise<Friendship[]> {
  const res = await apiClient.get<{ success: true; data: Friendship[] }>('/friends/sent');
  return res.data.data;
}

export async function sendFriendRequest(username: string): Promise<Friendship> {
  const res = await apiClient.post<{ success: true; data: Friendship }>('/friends/request', {
    username,
  });
  return res.data.data;
}

export async function respondToRequest(
  friendshipId: string,
  action: 'accept' | 'decline',
): Promise<Friendship> {
  const res = await apiClient.patch<{ success: true; data: Friendship }>(
    `/friends/${friendshipId}/respond`,
    { action },
  );
  return res.data.data;
}

export async function removeFriend(friendshipId: string): Promise<{ message: string }> {
  const res = await apiClient.delete<{ success: true; data: { message: string } }>(
    `/friends/${friendshipId}`,
  );
  return res.data.data;
}

export async function blockUser(targetUserId: string): Promise<{ message: string }> {
  const res = await apiClient.post<{ success: true; data: { message: string } }>(
    '/friends/block',
    { targetUserId },
  );
  return res.data.data;
}

export async function getFriendshipStatus(
  targetUserId: string,
): Promise<FriendshipStatusResponse | null> {
  const res = await apiClient.get<{ success: true; data: FriendshipStatusResponse | null }>(
    `/friends/status/${targetUserId}`,
  );
  return res.data.data;
}
