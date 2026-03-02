import Stripe from 'stripe';
import { config } from '../config';

let _stripe: Stripe | null = null;

/**
 * Lazily initialised Stripe client.
 * - Dev: uses STRIPE_TEST_SECRET_KEY (sk_test_…). Won't start if given a live key.
 * - Prod: uses STRIPE_LIVE_SECRET_KEY (sk_live_…). Won't start if given a test key.
 */
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = config.stripeSecretKey;
    if (!key) {
      throw new Error(
        'Stripe secret key is not configured. Set STRIPE_TEST_SECRET_KEY (dev) or STRIPE_LIVE_SECRET_KEY (prod) in your .env.',
      );
    }
    if (config.isProduction && key.startsWith('sk_test_')) {
      throw new Error('FATAL: Test Stripe key detected in production. Set STRIPE_LIVE_SECRET_KEY.');
    }
    if (!config.isProduction && key.startsWith('sk_live_')) {
      console.warn(
        '⚠️  Using a LIVE Stripe key in development. Set STRIPE_TEST_SECRET_KEY to use test mode instead.',
      );
    }
    _stripe = new Stripe(key, {
      apiVersion: '2024-04-10' as Stripe.LatestApiVersion,
    });
  }
  return _stripe;
}

/** @deprecated — prefer getStripe() for lazy init. Kept for backwards compat. */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
