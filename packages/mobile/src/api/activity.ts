import apiClient from './client';
import type { PublicUser } from './friends';

export interface ActivityGame {
  id: string;
  slug: string;
  title: string;
  coverImage: string | null;
  backgroundImage: string | null;
  rating: number | null;
  releaseDate: string | null;
  platforms: { id: string; name: string; slug: string }[];
  genres: { id: string; name: string; slug: string }[];
}

export interface ActivityItem {
  id: string;
  user: PublicUser;
  type: string;
  game: ActivityGame | null;
  library: {
    id: string;
    name: string;
    slug: string;
    isDefault: boolean;
    defaultType: string | null;
  } | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ActivityPage {
  items: ActivityItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export async function getActivityFeed(page = 1, pageSize = 20): Promise<ActivityPage> {
  const res = await apiClient.get<{ success: true; data: ActivityPage }>('/activity/feed', {
    params: { page, pageSize },
  });
  return res.data.data;
}

export async function getUserActivity(
  userId: string,
  page = 1,
  pageSize = 20,
): Promise<ActivityPage> {
  const res = await apiClient.get<{ success: true; data: ActivityPage }>(
    `/activity/users/${userId}`,
    { params: { page, pageSize } },
  );
  return res.data.data;
}
