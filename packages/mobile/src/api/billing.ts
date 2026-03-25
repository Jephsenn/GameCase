import client from './client';
import type { ApiResponse } from '@gamecase/shared';

export async function createCheckoutSession(): Promise<{ url: string }> {
  const { data } = await client.post<ApiResponse<{ url: string }>>(
    '/billing/checkout',
  );
  return data.data;
}

export async function createPortalSession(): Promise<{ url: string }> {
  const { data } = await client.post<ApiResponse<{ url: string }>>(
    '/billing/portal',
  );
  return data.data;
}

export async function verifySubscription(): Promise<{ plan: string }> {
  const { data } = await client.post<ApiResponse<{ plan: string }>>(
    '/billing/verify',
  );
  return data.data;
}

export interface PriceInfo {
  amount: number | null;
  currency: string;
  formatted: string | null;
}

export async function getBillingPrice(): Promise<PriceInfo> {
  const { data } = await client.get<ApiResponse<PriceInfo>>('/billing/price');
  return data.data;
}
