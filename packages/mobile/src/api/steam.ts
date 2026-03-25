import client from './client';
import type { ApiResponse } from '@gamecase/shared';

export interface SteamAccount {
  steamId: string;
  steamUsername: string;
  avatarUrl: string;
}

export interface SteamGame {
  appId: number;
  name: string;
  playtimeForever: number;
  imgIconUrl: string | null;
  headerImage: string | null;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  total: number;
}

export interface ValidateResult {
  valid: boolean;
  steamId: string;
  username?: string;
  avatarUrl?: string;
}

export async function getSteamAccount(): Promise<SteamAccount | null> {
  const { data } = await client.get<ApiResponse<SteamAccount | null>>(
    '/steam/account',
  );
  return data.data;
}

export async function unlinkSteamAccount(): Promise<{ message: string }> {
  const { data } = await client.delete<ApiResponse<{ message: string }>>(
    '/steam/account',
  );
  return data.data;
}

export async function getSteamGames(): Promise<SteamGame[]> {
  const { data } = await client.get<ApiResponse<SteamGame[]>>('/steam/games');
  return data.data;
}

export async function importSteamLibrary(steamId: string): Promise<ImportResult> {
  const { data } = await client.post<ApiResponse<ImportResult>>(
    '/steam/import',
    { steamId },
  );
  return data.data;
}

export async function validateSteamId(steamId: string): Promise<ValidateResult> {
  const { data } = await client.post<ApiResponse<ValidateResult>>(
    '/steam/validate',
    { steamId },
  );
  return data.data;
}

export async function unsyncAllSteamGames(): Promise<{ unsynced: number }> {
  const { data } = await client.delete<ApiResponse<{ unsynced: number }>>(
    '/steam/games',
  );
  return data.data;
}

export async function removeAllSteamGames(): Promise<{ removed: number }> {
  const { data } = await client.delete<ApiResponse<{ removed: number }>>(
    '/steam/games/remove-all',
  );
  return data.data;
}
