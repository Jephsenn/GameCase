'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { FadeIn } from '@/components/ui/animations';

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 overflow-hidden">
      <main className="flex flex-col items-center gap-8 text-center">
        {/* Logo mark */}
        <FadeIn delay={0.1} direction="none">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-2xl font-bold shadow-lg shadow-violet-500/20">
              G
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              Game<span className="text-violet-400">Tracker</span>
            </h1>
          </div>
        </FadeIn>

        <FadeIn delay={0.25}>
          <p className="max-w-md text-lg text-neutral-400">
            Track your games. Build your library. Discover what to play next.
          </p>
        </FadeIn>

        <FadeIn delay={0.4}>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="rounded-full bg-violet-600 px-8 py-3 font-medium text-white transition-all hover:bg-violet-500 hover:shadow-lg hover:shadow-violet-500/20 active:scale-[0.97]"
            >
              Get Started
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-neutral-700 px-8 py-3 font-medium text-neutral-300 transition-all hover:border-neutral-500 hover:text-white active:scale-[0.97]"
            >
              Sign In
            </Link>
          </div>
        </FadeIn>

        {/* Feature highlights */}
        <FadeIn delay={0.6}>
          <div className="flex flex-wrap justify-center gap-6 mt-4 text-sm text-neutral-500">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-violet-500" />
              Track &amp; organize
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-fuchsia-500" />
              Smart recommendations
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-pink-500" />
              All platforms
            </span>
          </div>
        </FadeIn>
      </main>

      {/* Subtle gradient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
    </div>
  );
}
