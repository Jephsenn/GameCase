import apiClient from './client';
import type { PublicUser } from './friends';

export interface PublicLibrary {
  id: string;
  name: string;
  slug: string;
  itemCount: number;
  visibility: string;
}

export interface PublicUserProfile extends PublicUser {
  libraries?: PublicLibrary[];
}

export async function searchUsers(query: string): Promise<PublicUser[]> {
  const res = await apiClient.get<{ success: true; data: { users: PublicUser[] } }>(
    '/users/search',
    { params: { q: query } },
  );
  return res.data.data.users;
}

export async function getPublicProfile(username: string): Promise<PublicUserProfile> {
  const res = await apiClient.get<{ success: true; data: { user: PublicUserProfile } }>(
    `/users/${username}`,
  );
  return res.data.data.user;
}

export async function getPublicLibraries(username: string): Promise<PublicLibrary[]> {
  const res = await apiClient.get<{ success: true; data: PublicLibrary[] }>(
    `/users/${username}/libraries`,
  );
  return res.data.data;
}

export interface PublicLibraryDetailResponse {
  library: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    visibility: string;
    isDefault: boolean;
    defaultType: string | null;
    itemCount: number;
  };
  items: import('./library').LibraryItem[];
  total: number;
  page: number;
  totalPages: number;
}

export async function getPublicLibraryBySlug(
  username: string,
  slug: string,
  opts: import('./library').GetLibraryOptions = {},
): Promise<PublicLibraryDetailResponse> {
  const raw = await apiClient.get<{
    success: true;
    data: {
      library: PublicLibraryDetailResponse['library'];
      items: { items: import('./library').LibraryItem[]; total: number; page: number; pageSize: number; totalPages: number };
    };
  }>(`/users/${username}/libraries/${slug}`, { params: opts });
  const d = raw.data.data;
  return {
    library: d.library,
    items: d.items.items,
    total: d.items.total,
    page: d.items.page,
    totalPages: d.items.totalPages,
  };
}
