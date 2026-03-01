'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { userApi, type GenreData, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FadeIn } from '@/components/ui/animations';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, accessToken, setUser, isLoading: authLoading } = useAuth();
  const [genres, setGenres] = useState<GenreData[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user?.onboardingDone) {
      router.push('/dashboard');
      return;
    }

    async function loadGenres() {
      try {
        const data = await userApi.getOnboardingGenres();
        setGenres(data.genres);
      } catch {
        setError('Failed to load genres');
      } finally {
        setIsLoading(false);
      }
    }

    loadGenres();
  }, [user, authLoading, router]);

  function toggleGenre(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (selectedIds.size === 0) return;
    if (!accessToken) return;

    setIsSaving(true);
    setError('');

    try {
      const data = await userApi.completeOnboarding(accessToken, Array.from(selectedIds));
      setUser(data.user);
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  function handleSkip() {
    router.push('/dashboard');
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-700 border-t-violet-500" />
      </div>
    );
  }

  return (
    <FadeIn className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-black tracking-tight">
          What do you <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">play</span>?
        </h2>
        <p className="text-sm text-neutral-400">
          Select your favorite genres so we can personalize your experience.
          Pick at least one.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {genres.map((genre) => {
          const selected = selectedIds.has(genre.id);
          return (
            <button
              key={genre.id}
              type="button"
              onClick={() => toggleGenre(genre.id)}
              className={cn(
                'rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-200 cursor-pointer',
                selected
                  ? 'border-violet-500 bg-violet-500/10 text-violet-300 ring-1 ring-violet-500/50'
                  : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700 hover:text-neutral-300',
              )}
            >
              {genre.name}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        <Button
          onClick={handleSubmit}
          size="lg"
          className="w-full"
          isLoading={isSaving}
          disabled={selectedIds.size === 0}
        >
          Continue ({selectedIds.size} selected)
        </Button>
        <Button
          variant="ghost"
          onClick={handleSkip}
          className="w-full"
        >
          Skip for now
        </Button>
      </div>
    </FadeIn>
  );
}
