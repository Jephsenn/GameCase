import client from './client';
import type { ApiResponse, AuthResponse, User } from '@gamecase/shared';

interface SignupPayload {
  email: string;
  username: string;
  password: string;
  displayName?: string;
}

interface LoginPayload {
  email: string;
  password: string;
}

export async function signup(payload: SignupPayload): Promise<AuthResponse> {
  const { data } = await client.post<ApiResponse<AuthResponse>>('/auth/signup', payload);
  return data.data;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await client.post<ApiResponse<AuthResponse>>('/auth/login', payload);
  return data.data;
}

export async function oauthLogin(
  token: string,
  provider: 'google' | 'apple',
): Promise<AuthResponse> {
  const { data } = await client.post<ApiResponse<AuthResponse>>('/auth/oauth', {
    token,
    provider,
  });
  return data.data;
}

/** Exchange a Google authorization code for app JWT tokens via the backend. */
export async function googleCodeExchange(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<AuthResponse> {
  const { data } = await client.post<ApiResponse<AuthResponse>>(
    '/auth/google/code-exchange',
    { code, codeVerifier, redirectUri },
  );
  return data.data;
}

export async function refreshTokens(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const { data } = await client.post<
    ApiResponse<{ accessToken: string; refreshToken: string }>
  >('/auth/refresh', { refreshToken });
  return data.data;
}

export async function logout(refreshToken: string): Promise<void> {
  await client.post('/auth/logout', { refreshToken });
}

export async function getMe(): Promise<User> {
  const { data } = await client.get<ApiResponse<{ user: User }>>('/auth/me');
  return data.data.user;
}

export async function updateMe(updates: {
  username?: string;
  displayName?: string;
  bio?: string;
}): Promise<User> {
  const { data } = await client.patch<ApiResponse<{ user: User }>>('/users/profile', updates);
  return data.data.user;
}

export async function uploadAvatar(
  uri: string,
  mimeType: string = 'image/jpeg',
): Promise<string> {
  const formData = new FormData();
  formData.append('avatar', {
    uri,
    type: mimeType,
    name: 'avatar.jpg',
  } as unknown as Blob);

  const { data } = await client.post<ApiResponse<{ user: User; avatarUrl: string }>>(
    '/users/profile/avatar',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    },
  );
  return data.data.avatarUrl;
}

export async function deleteAccount(): Promise<void> {
  await client.delete('/auth/me');
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const { data } = await client.post<ApiResponse<{ message: string }>>('/auth/forgot-password', { email });
  return data.data;
}

export async function resetPassword(token: string, password: string): Promise<{ message: string }> {
  const { data } = await client.post<ApiResponse<{ message: string }>>('/auth/reset-password', { token, password });
  return data.data;
}
