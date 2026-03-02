'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

interface ProGateProps {
  children?: ReactNode;
  /** Custom message when the user is on the free plan */
  message?: string;
  /** If true, render inline (no card wrapper) */
  inline?: boolean;
}

/**
 * Shows children if the user is on the Pro plan.
 * Otherwise shows an upgrade prompt card.
 */
export function ProGate({ children, message, inline }: ProGateProps) {
  const { user } = useAuth();

  if (user?.plan === 'pro') {
    return <>{children}</>;
  }

  if (inline) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-neutral-400">
        <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-semibold text-violet-400">
          PRO
        </span>
        {message || 'Upgrade to Pro to unlock this feature.'}
        <Link
          href="/billing"
          className="ml-1 text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors"
        >
          Upgrade
        </Link>
      </span>
    );
  }

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6 text-center">
      <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-violet-500/15 mb-3">
        <svg
          className="h-6 w-6 text-violet-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-bold text-white mb-1">Pro Feature</h3>
      <p className="text-sm text-neutral-400 mb-4">
        {message || 'This feature is available on the Pro plan.'}
      </p>
      <Link
        href="/billing"
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-violet-500 hover:shadow-[0_0_24px_rgba(139,92,246,0.35)] transition-all duration-200"
      >
        Upgrade to Pro
      </Link>
    </div>
  );
}
