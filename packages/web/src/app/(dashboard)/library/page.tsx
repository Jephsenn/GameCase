'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { libraryApi, type LibraryData, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/animations';
import { LibraryCardSkeleton } from '@/components/ui/skeleton';
import { AnimatePresence, motion } from 'framer-motion';

export default function LibraryPage() {
  const { accessToken, isLoading: authLoading } = useAuth();
  const toast = useToast();
  const [libraries, setLibraries] = useState<LibraryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await libraryApi.getAll(accessToken);
      setLibraries(data);
    } catch {
      toast.error('Failed to load libraries');
    } finally {
      setLoading(false);
    }
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!authLoading) load();
  }, [load, authLoading]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !newName.trim()) return;
    setCreating(true);
    try {
      await libraryApi.create(accessToken, { name: newName.trim(), description: newDesc.trim() || undefined });
      setNewName('');
      setNewDesc('');
      setShowCreate(false);
      toast.success('Library created!');
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create library');
    } finally {
      setCreating(false);
    }
  }

  const defaultLibs = libraries.filter((l) => l.isDefault);
  const customLibs = libraries.filter((l) => !l.isDefault);
  const totalGames = libraries.reduce((sum, l) => sum + l.itemCount, 0);

  if (loading) {
    return (
      <PageTransition className="space-y-8">
        <div>
          <div className="h-8 w-48 bg-neutral-800/60 rounded-xl animate-pulse" />
          <div className="h-5 w-64 bg-neutral-800/40 rounded-lg animate-pulse mt-3" />
        </div>
        <LibraryCardSkeleton />
      </PageTransition>
    );
  }

  return (
    <PageTransition className="space-y-8">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your Library</h1>
            <p className="mt-1 text-neutral-400">
              {totalGames} game{totalGames !== 1 ? 's' : ''} across {libraries.length} libraries
            </p>
          </div>
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Cancel' : '+ New Library'}
          </Button>
        </div>
      </FadeIn>

      {/* Create library form */}
      <AnimatePresence>
        {showCreate && (
          <motion.form
            onSubmit={handleCreate}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 space-y-4">
              <Input
                label="Library Name"
                placeholder="e.g. Couch Co-op Favorites"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-neutral-300">Description (optional)</label>
                <textarea
                  className="flex w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent hover:border-neutral-700 transition-colors resize-none"
                  rows={2}
                  placeholder="What's this library for?"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>
              <Button type="submit" size="sm" isLoading={creating}>
                Create Library
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Default libraries */}
      <FadeIn delay={0.1}>
        <h2 className="text-lg font-semibold mb-4">Default Libraries</h2>
        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {defaultLibs.map((lib) => (
            <StaggerItem key={lib.id}>
              <Link
                href={`/library/${lib.slug}`}
                className="group block rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 transition-all hover:border-neutral-700 hover:shadow-lg hover:shadow-violet-500/5"
              >
                <p className="font-medium group-hover:text-white transition-colors">{lib.name}</p>
                <p className="mt-1 text-2xl font-bold text-violet-400">{lib.itemCount}</p>
                <p className="text-xs text-neutral-500 mt-1">games</p>
              </Link>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </FadeIn>

      {/* Custom libraries */}
      <FadeIn delay={0.2}>
        <h2 className="text-lg font-semibold mb-4">Custom Libraries</h2>
        {customLibs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-800 py-12 text-center text-neutral-500">
            <p>No custom libraries yet.</p>
            <p className="text-sm mt-1">Create one to organize your games your way.</p>
          </div>
        ) : (
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {customLibs.map((lib) => (
              <StaggerItem key={lib.id}>
                <Link
                  href={`/library/${lib.slug}`}
                  className="group block rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 transition-all hover:border-neutral-700 hover:shadow-lg hover:shadow-violet-500/5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium group-hover:text-white transition-colors">{lib.name}</p>
                      {lib.description && (
                        <p className="mt-1 text-sm text-neutral-500 line-clamp-2">{lib.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-neutral-500 bg-neutral-800 px-2 py-1 rounded-full">
                      {lib.visibility}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-neutral-400">{lib.itemCount} games</p>
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}
      </FadeIn>
    </PageTransition>
  );
}
