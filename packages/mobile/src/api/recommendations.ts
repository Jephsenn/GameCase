import client from './client';
import type { ApiResponse, GameListItem } from '@gamecase/shared';

export interface Recommendation {
  id: string;
  game: GameListItem;
  score: number;
  reason: string;
  createdAt: string;
}

export interface RecommendationPage {
  items: Recommendation[];
  total: number;
  page: number;
  totalPages: number;
}

export interface RecommendationStatus {
  total: number;
  generated: boolean;
}

export async function getRecommendations(
  page = 1,
  pageSize = 20,
): Promise<RecommendationPage> {
  const { data } = await client.get<ApiResponse<RecommendationPage>>(
    '/recommendations',
    { params: { page, pageSize } },
  );
  return data.data;
}

export async function getRecommendationStatus(): Promise<RecommendationStatus> {
  const { data } = await client.get<ApiResponse<RecommendationStatus>>(
    '/recommendations/status',
  );
  return data.data;
}

export async function generateRecommendations(): Promise<{
  count: number;
  message: string;
}> {
  const { data } = await client.post<
    ApiResponse<{ count: number; message: string }>
  >('/recommendations/generate');
  return data.data;
}

export async function refreshRecommendations(): Promise<{
  count: number;
  message: string;
}> {
  const { data } = await client.post<
    ApiResponse<{ count: number; message: string }>
  >('/recommendations/refresh');
  return data.data;
}

export async function dismissRecommendation(id: string): Promise<void> {
  await client.delete(`/recommendations/${id}`);
}
