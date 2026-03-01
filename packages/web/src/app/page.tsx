'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { FadeIn } from '@/components/ui/animations';

/* ── Game cover URLs (RAWG CDN) ── */
const COVERS = [
  'https://media.rawg.io/media/games/456/456dea5e1c7e3cd07060c14e96612001.jpg',
  'https://media.rawg.io/media/games/4be/4be6a6ad0364751a96229c56bf69be73.jpg',
  'https://media.rawg.io/media/games/021/021c4e21a1824d2526f925eff6735d33.jpg',
  'https://media.rawg.io/media/games/f87/f87457e8347484033cb34cde6101d08d.jpg',
  'https://media.rawg.io/media/games/b54/b54598d1d5cc31899f4f0a7e3122a7b0.jpg',
  'https://media.rawg.io/media/games/8cc/8cce7c0e99dcc43d66c8efd42f9d03e3.jpg',
  'https://media.rawg.io/media/games/7cf/7cfc9220b401b7a300e409e539c9afd5.jpg',
  'https://media.rawg.io/media/games/fc1/fc1307a2774506b5bd65d7e8424664a7.jpg',
  'https://media.rawg.io/media/games/9fa/9fa63622543e5d4f6d99aa9d73b043de.jpg',
  'https://media.rawg.io/media/games/c24/c24ec439abf4a2e92f3429dfa83f7f94.jpg',
  'https://media.rawg.io/media/games/26d/26d4437715bee60138dab4a7c8c59c92.jpg',
  'https://media.rawg.io/media/games/d47/d47240271d7027db71e98bb92e7efff6.jpg',
];

const STATS = [
  { label: 'Games Tracked', value: '500K+' },
  { label: 'Library Entries', value: '1M+' },
  { label: 'Active Users', value: '50K+' },
];

/* ── Helpers ── */

function buildColumns(count: number, perCol: number): string[][] {
  const cols: string[][] = [];
  for (let i = 0; i < count; i++) {
    const col: string[] = [];
    for (let j = 0; j < perCol; j++) {
      col.push(COVERS[(i + j * 2) % COVERS.length]);
    }
    cols.push(col);
  }
  return cols;
}

function MosaicColumn({
  images,
  direction,
  duration,
}: {
  images: string[];
  direction: 'up' | 'down';
  duration: number;
}) {
  return (
    <motion.div
      className="flex flex-1 flex-col gap-2 will-change-transform"
      animate={{
        y: direction === 'up' ? ['0%', '-50%'] : ['-50%', '0%'],
      }}
      transition={{
        y: { duration, repeat: Infinity, ease: 'linear' },
      }}
    >
      {/* Two identical copies → seamless infinite loop */}
      {[0, 1].map((copy) =>
        images.map((src, j) => (
          <div
            key={`${copy}-${j}`}
            className="relative aspect-[3/4] w-full flex-shrink-0 overflow-hidden rounded-lg"
          >
            <Image
              src={src}
              alt=""
              fill
              sizes="(min-width:640px) 15vw, 33vw"
              className="object-cover"
            />
          </div>
        )),
      )}
    </motion.div>
  );
}

/* ── Page ── */

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  const columns = useMemo(() => buildColumns(7, 6), []);

  return (
    <div className="relative flex h-screen items-center justify-center overflow-hidden bg-neutral-950">
      {/* ── Animated mosaic background ── */}
      <div
        className="absolute inset-[-8%] flex items-start gap-3 -rotate-[4deg]"
        aria-hidden="true"
      >
        {columns.map((col, i) => (
          <MosaicColumn
            key={i}
            images={col}
            direction={i % 2 === 0 ? 'up' : 'down'}
            duration={80 + i * 6}
          />
        ))}
      </div>

      {/* ── Overlays for text legibility ── */}
      <div className="pointer-events-none absolute inset-0 bg-neutral-950/70" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(10,10,10,0.85)_60%,rgba(10,10,10,1)_100%)]" />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/10 blur-[128px]" />
      <div className="pointer-events-none absolute left-1/2 top-[45%] h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-500/10 blur-[96px]" />

      {/* ── Hero content ── */}
      <main className="relative z-10 flex max-w-3xl flex-col items-center gap-7 px-6 text-center">
        {/* Logo */}
        <FadeIn delay={0.1} direction="none">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-3xl font-black text-white shadow-2xl shadow-violet-500/30">
              G
            </div>
            <span className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Game<span className="text-violet-400">Tracker</span>
            </span>
          </div>
        </FadeIn>

        {/* Headline */}
        <FadeIn delay={0.2}>
          <h1 className="text-5xl font-black leading-none tracking-tighter text-white sm:text-6xl lg:text-7xl">
            Your games.
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
              All in one place.
            </span>
          </h1>
        </FadeIn>

        {/* Subheadline */}
        <FadeIn delay={0.35}>
          <p className="max-w-lg text-lg text-neutral-400 sm:text-xl">
            Track your games. Build your library. Discover what to play next.
          </p>
        </FadeIn>

        {/* CTAs */}
        <FadeIn delay={0.5}>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="rounded-full bg-violet-600 px-10 py-3.5 text-lg font-semibold text-white transition-all hover:bg-violet-500 hover:shadow-[0_0_40px_rgba(139,92,246,0.45)] active:scale-[0.97]"
            >
              Get Started
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-neutral-700 px-10 py-3.5 text-lg font-semibold text-neutral-300 transition-all hover:border-neutral-500 hover:text-white active:scale-[0.97]"
            >
              Sign In
            </Link>
          </div>
        </FadeIn>

        {/* Stats */}
        <FadeIn delay={0.65}>
          <div className="mt-2 flex flex-wrap justify-center gap-3 sm:gap-4">
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col items-center gap-1 rounded-xl border border-neutral-800/60 bg-neutral-900/50 px-5 py-3 backdrop-blur-sm sm:px-6"
              >
                <span className="text-lg font-bold text-violet-400 sm:text-xl">
                  {stat.value}
                </span>
                <span className="text-xs text-neutral-500">{stat.label}</span>
              </div>
            ))}
          </div>
        </FadeIn>
      </main>
    </div>
  );
}
