'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import {
  libraryApi,
  type LibraryData,
  type LibraryItemData,
  type PaginatedData,
  ApiError,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog, Modal } from '@/components/ui/modal';
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/animations';
import { GameGridSkeleton } from '@/components/ui/skeleton';

export default function LibraryDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { accessToken, isLoading: authLoading } = useAuth();
  const toast = useToast();

  const [library, setLibrary] = useState<LibraryData | null>(null);
  const [items, setItems] = useState<PaginatedData<LibraryItemData> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  // ConfirmDialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Rating modal state
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingItemId, setRatingItemId] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState('');

  const load = useCallback(async () => {
    if (!accessToken || !slug) return;
    try {
      const data = await libraryApi.getBySlug(accessToken, slug, page);
      setLibrary(data.library);
      setItems(data.items);
    } catch {
      toast.error('Failed to load library');
    } finally {
      setLoading(false);
    }
  }, [accessToken, slug, page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!authLoading) load();
  }, [load, authLoading]);

  async function handleRemove(itemId: string) {
    if (!accessToken) return;
    try {
      await libraryApi.removeItem(accessToken, itemId);
      toast.success('Game removed');
      await load();
    } catch {
      toast.error('Failed to remove game');
    }
  }

  async function handleDelete() {
    if (!accessToken || !library) return;
    setDeleting(true);
    try {
      await libraryApi.delete(accessToken, library.id);
      toast.success('Library deleted');
      router.push('/library');
    } catch {
      toast.error('Failed to delete library');
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  async function handleSaveEdit() {
    if (!accessToken || !library) return;
    setSaving(true);
    try {
      await libraryApi.update(accessToken, library.id, {
        name: editName,
        description: editDesc || undefined,
      });
      setEditMode(false);
      toast.success('Library updated');
      await load();
    } catch {
      toast.error('Failed to update library');
    } finally {
      setSaving(false);
    }
  }

  function openRatingModal(itemId: string, current: number | null) {
    setRatingItemId(itemId);
    setRatingValue(current?.toString() || '');
    setRatingOpen(true);
  }

  async function handleRateSubmit() {
    if (!accessToken || !ratingItemId) return;
    const rating = ratingValue.trim() === '' ? null : parseInt(ratingValue, 10);
    if (rating !== null && (isNaN(rating) || rating < 1 || rating > 10)) {
      toast.error('Rating must be between 1 and 10');
      return;
    }
    try {
      await libraryApi.updateItem(accessToken, ratingItemId, { userRating: rating });
      toast.success(rating ? `Rated ${rating}/10` : 'Rating cleared');
      setRatingOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to rate');
    }
  }

  if (loading) {
    return (
      <PageTransition className="space-y-8">
        <div>
          <div className="h-4 w-24 bg-neutral-800/60 rounded animate-pulse" />
          <div className="h-8 w-64 bg-neutral-800/60 rounded-xl animate-pulse mt-3" />
          <div className="h-5 w-32 bg-neutral-800/40 rounded animate-pulse mt-2" />
        </div>
        <GameGridSkeleton count={8} />
      </PageTransition>
    );
  }

  if (!library) {
    return (
      <PageTransition className="py-20 text-center text-neutral-500">
        <p>Library not found.</p>
        <Link href="/library" className="text-violet-400 hover:underline mt-2 inline-block">
          Back to libraries
        </Link>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="space-y-8">
      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Library"
        description="All items will be removed. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />

      {/* Rating modal */}
      <Modal open={ratingOpen} onClose={() => setRatingOpen(false)} size="sm">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Rate this game</h3>
          <p className="text-sm text-neutral-400">Enter a rating from 1–10, or leave empty to clear.</p>
          <input
            type="number"
            min={1}
            max={10}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="1–10"
            value={ratingValue}
            onChange={(e) => setRatingValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRateSubmit(); }}
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <button onClick={() => setRatingOpen(false)} className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 rounded-xl hover:bg-neutral-800 cursor-pointer">
              Cancel
            </button>
            <button onClick={handleRateSubmit} className="px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-xl hover:bg-violet-500 cursor-pointer">
              Save Rating
            </button>
          </div>
        </div>
      </Modal>

      {/* Header */}
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {editMode ? (
            <div className="flex-1 space-y-3">
              <input
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-lg font-bold text-neutral-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <textarea
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm text-neutral-100 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
                rows={2}
                placeholder="Description"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit} isLoading={saving}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditMode(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3">
                <Link href="/library" className="text-neutral-500 hover:text-neutral-300 transition-colors">
                  ← Libraries
                </Link>
              </div>
              <h1 className="text-3xl font-bold tracking-tight mt-2">{library.name}</h1>
              {library.description && (
                <p className="mt-1 text-neutral-400">{library.description}</p>
              )}
              <p className="mt-1 text-sm text-neutral-500">{library.itemCount} games</p>
            </div>
          )}
          {!editMode && (
            <div className="flex gap-2 shrink-0">
              {!library.isDefault && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditName(library.name);
                      setEditDesc(library.description || '');
                      setEditMode(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setDeleteOpen(true)}>
                    Delete
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </FadeIn>

      {/* Items grid */}
      {items && items.items.length === 0 ? (
        <FadeIn delay={0.1}>
          <div className="rounded-2xl border border-dashed border-neutral-800 py-16 text-center text-neutral-500">
            <p className="text-lg">No games in this library yet.</p>
            <Link href="/games" className="text-violet-400 hover:underline mt-2 inline-block">
              Browse games to add some
            </Link>
          </div>
        </FadeIn>
      ) : (
        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items?.items.map((item) => (
            <StaggerItem key={item.id}>
              <div className="group rounded-2xl border border-neutral-800 bg-neutral-900/50 overflow-hidden transition-all hover:border-neutral-700 hover:shadow-lg hover:shadow-violet-500/5">
                <Link href={`/games/${item.game.slug}`} className="block">
                  <div className="relative aspect-[3/4] bg-neutral-800 overflow-hidden">
                    {(item.game.coverImage || item.game.backgroundImage) ? (
                      <Image
                        src={(item.game.coverImage || item.game.backgroundImage)!}
                        alt={item.game.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-neutral-600 text-sm">
                        No Image
                      </div>
                    )}
                  </div>
                </Link>
                <div className="p-4 space-y-2">
                  <Link href={`/games/${item.game.slug}`} className="block">
                    <p className="font-medium text-sm line-clamp-1 group-hover:text-white transition-colors">
                      {item.game.title}
                    </p>
                  </Link>
                  {item.game.genres.length > 0 && (
                    <p className="text-xs text-neutral-500 line-clamp-1">
                      {item.game.genres.map((g) => g.name).join(', ')}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openRatingModal(item.id, item.userRating)}
                      className="text-xs px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
                    >
                      {item.userRating ? `★ ${item.userRating}/10` : '☆ Rate'}
                    </button>
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="text-xs px-2 py-1 rounded-lg bg-neutral-800 hover:bg-red-900/50 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer ml-auto"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}

      {/* Pagination */}
      {items && items.totalPages > 1 && (
        <FadeIn delay={0.15}>
          <div className="flex items-center justify-center gap-4">
            <Button
              size="sm"
              variant="outline"
              disabled={!items.hasPrevious}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Previous
            </Button>
            <span className="text-sm text-neutral-400">
              Page {items.page} of {items.totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={!items.hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </Button>
          </div>
        </FadeIn>
      )}
    </PageTransition>
  );
}
