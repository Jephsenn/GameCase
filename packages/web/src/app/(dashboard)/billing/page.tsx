'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { billingApi, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { PageTransition, FadeIn } from '@/components/ui/animations';

const features = [
  { name: 'Custom Libraries', free: '3', pro: 'Unlimited' },
  { name: 'Friends', free: '20', pro: 'Unlimited' },
  { name: 'Private Libraries', free: '—', pro: '✓' },
  { name: 'Steam Library Import', free: '—', pro: '✓' },
  { name: 'Year in Review Stats', free: '—', pro: '✓' },
  { name: 'Game Tracking', free: '✓', pro: '✓' },
  { name: 'Recommendations', free: '✓', pro: '✓' },
  { name: 'Activity Feed', free: '✓', pro: '✓' },
];

export default function BillingPage() {
  const { user, accessToken, refreshUser } = useAuth();
  const toast = useToast();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(false);

  const isPro = user?.plan === 'pro';

  useEffect(() => {
    if (searchParams.get('success') !== 'true' || !accessToken) return;

    let cancelled = false;

    async function verifyAndRefresh() {
      // Call /billing/verify to sync plan from Stripe (doesn't depend on webhooks)
      try {
        const { plan } = await billingApi.verifySubscription(accessToken!);
        if (!cancelled && plan === 'pro') {
          await refreshUser();
          toast.success('Welcome to Pro! Your account has been upgraded.');
          return;
        }
      } catch {
        // verify endpoint failed — fall through to refreshUser
      }

      // Fallback: maybe webhook already processed it
      if (!cancelled) {
        await refreshUser();
        toast.success('Welcome to Pro! Your account has been upgraded.');
      }
    }

    verifyAndRefresh();
    return () => { cancelled = true; };
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCheckout() {
    if (!accessToken) return;
    setLoading(true);
    try {
      const { url } = await billingApi.createCheckout(accessToken);
      if (url) window.location.href = url;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to start checkout';
      console.error('Checkout error:', err);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handlePortal() {
    if (!accessToken) return;
    setLoading(true);
    try {
      const { url } = await billingApi.createPortal(accessToken);
      if (url) window.location.href = url;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to open billing portal');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageTransition className="space-y-8">
      <FadeIn>
        <h1 className="text-3xl font-black tracking-tight">
          <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            Billing
          </span>
        </h1>
        <p className="mt-1 text-neutral-400">Manage your subscription and plan</p>
      </FadeIn>

      {/* Current plan card */}
      <FadeIn delay={0.05}>
        <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/50 p-8 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-6">
            <div
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold ${
                isPro
                  ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                  : 'bg-neutral-800 text-neutral-300 border border-neutral-700'
              }`}
            >
              {isPro ? '⭐ Pro' : 'Free'}
            </div>
            <p className="text-neutral-400 text-sm">
              {isPro
                ? 'You have access to all Pro features.'
                : 'Upgrade to Pro to unlock all features.'}
            </p>
          </div>

          {isPro ? (
            <Button onClick={handlePortal} isLoading={loading} variant="secondary">
              Manage Subscription
            </Button>
          ) : (
            <Button onClick={handleCheckout} isLoading={loading}>
              Upgrade to Pro
            </Button>
          )}
        </div>
      </FadeIn>

      {/* Feature comparison */}
      <FadeIn delay={0.1}>
        <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/50 backdrop-blur-sm overflow-hidden">
          <div className="p-6 border-b border-neutral-800/80">
            <h2 className="text-lg font-bold text-white">Plan Comparison</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800/80">
                  <th className="text-left px-6 py-3 text-neutral-400 font-medium">Feature</th>
                  <th className="text-center px-6 py-3 text-neutral-400 font-medium">Free</th>
                  <th className="text-center px-6 py-3 text-violet-400 font-medium">Pro</th>
                </tr>
              </thead>
              <tbody>
                {features.map((feature, i) => (
                  <tr
                    key={feature.name}
                    className={i < features.length - 1 ? 'border-b border-neutral-800/50' : ''}
                  >
                    <td className="px-6 py-3 text-neutral-300">{feature.name}</td>
                    <td className="px-6 py-3 text-center text-neutral-500">{feature.free}</td>
                    <td className="px-6 py-3 text-center text-violet-300 font-medium">
                      {feature.pro}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </FadeIn>
    </PageTransition>
  );
}
