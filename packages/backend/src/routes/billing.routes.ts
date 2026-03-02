import { Router, Request, Response } from 'express';
import express from 'express';
import { requireAuth } from '../middleware/auth';
import type { AuthenticatedRequest } from '../middleware/auth';
import { stripe } from '../lib/stripe';
import { config } from '../config';
import prisma from '../lib/prisma';
import { logger } from '../lib/logger';

const router = Router();

// ── POST /billing/checkout — Create Stripe Checkout session ──

router.post('/checkout', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, stripeCustomerId: true, plan: true },
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    if (user.plan === 'pro') {
      res.status(400).json({ success: false, error: 'You are already on the Pro plan' });
      return;
    }

    // Create or retrieve Stripe customer — detect mode mismatch
    let customerId = user.stripeCustomerId;

    // If the stored customer was created in a different mode (live vs test), discard it
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
      } catch {
        logger.warn({ customerId }, '[checkout] Stored customer not found in current Stripe mode — will create a new one');
        customerId = null;
        await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: null } });
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: config.stripeProPriceId,
          quantity: 1,
        },
      ],
      success_url: `${config.corsOrigin.split(',')[0].trim()}/billing?success=true`,
      cancel_url: `${config.corsOrigin.split(',')[0].trim()}/billing`,
      metadata: { userId: user.id },
    });
    res.json({ success: true, data: { url: session.url } });
  } catch (error) {
    logger.error({ err: error, message: (error as Error).message, stack: (error as Error).stack }, 'Checkout session error');
    res.status(500).json({ success: false, error: 'Failed to create checkout session', detail: (error as Error).message });
  }
});

// ── POST /billing/verify — Check Stripe subscription and sync plan ──
// Called by the frontend after checkout redirect to guarantee plan is up-to-date
// even if the webhook hasn't fired yet.

router.post('/verify', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, stripeCustomerId: true, plan: true, stripeSubscriptionId: true },
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Already pro — nothing to do
    if (user.plan === 'pro' && user.stripeSubscriptionId) {
      res.json({ success: true, data: { plan: 'pro' } });
      return;
    }

    // No Stripe customer yet — can't verify
    if (!user.stripeCustomerId) {
      res.json({ success: true, data: { plan: user.plan } });
      return;
    }

    // Check Stripe for active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length > 0) {
      const sub = subscriptions.data[0];
      await prisma.user.update({
        where: { id: user.id },
        data: {
          plan: 'pro',
          stripeSubscriptionId: sub.id,
        },
      });
      logger.info({ userId: user.id, subscriptionId: sub.id }, 'Plan verified and synced to pro via /billing/verify');
      res.json({ success: true, data: { plan: 'pro' } });
    } else {
      res.json({ success: true, data: { plan: user.plan } });
    }
  } catch (error) {
    logger.error({ err: error }, 'Billing verify error');
    res.status(500).json({ success: false, error: 'Failed to verify subscription' });
  }
});

// ── POST /billing/portal — Create Stripe Customer Portal session ──

router.post('/portal', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      res.status(400).json({ success: false, error: 'No billing account found' });
      return;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${config.corsOrigin.split(',')[0].trim()}/billing`,
    });

    res.json({ success: true, data: { url: session.url } });
  } catch (error) {
    logger.error({ err: error }, 'Billing portal error');
    res.status(500).json({ success: false, error: 'Failed to create portal session' });
  }
});

// ── POST /billing/webhook — Stripe webhook handler ──
// Exported separately so app.ts can mount it before express.json()

export const billingWebhookRouter = Router();

billingWebhookRouter.post(
  '/',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string;

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, config.stripeWebhookSecret);
    } catch (err) {
      logger.error({ err }, 'Webhook signature verification failed');
      res.status(400).json({ success: false, error: 'Invalid webhook signature' });
      return;
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const userId = session.metadata?.userId;
          const subscriptionId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription?.toString() ?? null;

          if (userId && subscriptionId) {
            // Idempotency: only update if not already pro with this subscription
            const user = await prisma.user.findUnique({
              where: { id: userId },
              select: { plan: true, stripeSubscriptionId: true },
            });
            if (user && (user.plan !== 'pro' || user.stripeSubscriptionId !== subscriptionId)) {
              await prisma.user.update({
                where: { id: userId },
                data: {
                  plan: 'pro',
                  stripeSubscriptionId: subscriptionId,
                },
              });
              logger.info({ userId, subscriptionId }, 'User upgraded to Pro');
            }
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          const subscriptionId = subscription.id;

          // Find user by subscription ID
          const user = await prisma.user.findFirst({
            where: { stripeSubscriptionId: subscriptionId },
            select: { id: true, plan: true },
          });

          if (user && user.plan !== 'free') {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                plan: 'free',
                stripeSubscriptionId: null,
              },
            });
            logger.info({ userId: user.id }, 'User downgraded to Free (subscription deleted)');
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          const subDetail = invoice.parent?.subscription_details?.subscription;
          const subscriptionId =
            typeof subDetail === 'string'
              ? subDetail
              : subDetail?.id ?? null;

          if (subscriptionId) {
            const user = await prisma.user.findFirst({
              where: { stripeSubscriptionId: subscriptionId },
              select: { id: true },
            });

            if (user) {
              await prisma.user.update({
                where: { id: user.id },
                data: {
                  plan: 'free',
                  stripeSubscriptionId: null,
                },
              });
              logger.info({ userId: user.id }, 'User downgraded to Free (payment failed)');
            }
          }
          break;
        }

        default:
          logger.debug({ type: event.type }, 'Unhandled Stripe event');
      }

      res.json({ received: true });
    } catch (error) {
      logger.error({ err: error, eventType: event.type }, 'Webhook processing error');
      res.status(500).json({ success: false, error: 'Webhook processing failed' });
    }
  },
);

export default router;
