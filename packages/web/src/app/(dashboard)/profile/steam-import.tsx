'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  steamApi,
  libraryApi,
  type SteamValidation,
  type SteamImportResult,
  type SteamAccount,
  type SteamLinkedGame,
  ApiError,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProGate } from '@/components/ui/pro-gate';
import { useToast } from '@/components/ui/toast';

// ── Steam icon SVG ───────────────────────────────

function SteamIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658a3.387 3.387 0 0 1 1.912-.59c.064 0 .128.003.19.008l2.861-4.142V8.91a4.528 4.528 0 0 1 4.524-4.524c2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396a3.406 3.406 0 0 1-3.362-2.898L.453 14.83A11.99 11.99 0 0 0 11.979 24c6.627 0 12-5.373 12-12s-5.372-12-12-12z" />
    </svg>
  );
}

// ── Slide-over drawer for Steam games ────────────

function SteamGamesDrawer({
  open,
  onClose,
  games,
  loading,
  onUnsync,
  onUnsyncAll,
  onRemove,
  onRemoveAll,
  unsyncingId,
  unsyncingAll,
  removingId,
  removingAll,
}: {
  open: boolean;
  onClose: () => void;
  games: SteamLinkedGame[];
  loading: boolean;
  onUnsync: (itemId: string) => void;
  onUnsyncAll: () => void;
  onRemove: (itemId: string) => void;
  onRemoveAll: () => void;
  unsyncingId: string | null;
  unsyncingAll: boolean;
  removingId: string | null;
  removingAll: boolean;
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Prevent scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-md transform transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col bg-neutral-900 border-l border-neutral-800 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
            <div className="flex items-center gap-3">
              <SteamIcon className="h-5 w-5 text-blue-400" />
              <div>
                <h3 className="text-lg font-bold text-white">Steam Games</h3>
                <p className="text-xs text-neutral-400">{games.length} games synced</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Actions bar */}
          {games.length > 0 && (
            <div className="flex items-center justify-between border-b border-neutral-800/50 px-6 py-3">
              <p className="text-xs text-neutral-500">{games.length} games synced from Steam</p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowBulkModal(true)}
                disabled={unsyncingAll || removingAll}
                className="text-xs shrink-0 ml-3"
              >
                Manage All
              </Button>
            </div>
          )}

          {/* Game list */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-neutral-800/30 p-3 animate-pulse">
                    <div className="h-12 w-9 rounded bg-neutral-700" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-32 rounded bg-neutral-700" />
                      <div className="h-2.5 w-20 rounded bg-neutral-700/50" />
                    </div>
                  </div>
                ))}
              </div>
            ) : games.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <SteamIcon className="h-10 w-10 text-neutral-700 mb-3" />
                <p className="text-neutral-500 text-sm">No Steam-synced games</p>
                <p className="text-neutral-600 text-xs mt-1">Import games from your Steam library to see them here</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {games.map((game) => (
                  <div
                    key={game.id}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                      confirmingId === game.id ? 'bg-neutral-800/50' : 'hover:bg-neutral-800/50'
                    }`}
                  >
                    {/* Game cover */}
                    <Link href={`/games/${game.slug}`} className="shrink-0">
                      {game.coverImage ? (
                        <img
                          src={game.coverImage}
                          alt={game.name}
                          loading="lazy"
                          decoding="async"
                          className="h-12 w-9 rounded object-cover ring-1 ring-neutral-700/50"
                        />
                      ) : (
                        <div className="h-12 w-9 rounded bg-neutral-800 ring-1 ring-neutral-700/50 flex items-center justify-center">
                          <svg className="h-4 w-4 text-neutral-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                          </svg>
                        </div>
                      )}
                    </Link>

                    {/* Game info */}
                    <div className="flex-1 min-w-0">
                      <Link href={`/games/${game.slug}`} className="block">
                        <p className="text-sm font-medium text-neutral-200 truncate hover:text-white transition-colors">
                          {game.name}
                        </p>
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-400/70 bg-blue-500/10 px-1.5 py-0.5 rounded">
                          <SteamIcon className="h-2.5 w-2.5" />
                          Steam
                        </span>
                        <span className="text-[10px] text-neutral-600">PC</span>
                      </div>
                    </div>

                    {/* Actions */}
                    {confirmingId === game.id ? (
                      <div className="shrink-0 flex items-center gap-1">
                        <button
                          onClick={() => { onUnsync(game.id); setConfirmingId(null); }}
                          disabled={unsyncingId === game.id}
                          className="text-[11px] font-medium px-2 py-1 rounded-md bg-neutral-700/80 hover:bg-neutral-700 text-neutral-200 transition-colors disabled:opacity-50"
                          title="Remove Steam tag, keep game in library"
                        >
                          Keep
                        </button>
                        <button
                          onClick={() => { onRemove(game.id); setConfirmingId(null); }}
                          disabled={removingId === game.id}
                          className="text-[11px] font-medium px-2 py-1 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors disabled:opacity-50"
                          title="Remove game from library entirely"
                        >
                          Remove
                        </button>
                        <button
                          onClick={() => setConfirmingId(null)}
                          className="p-1 text-neutral-600 hover:text-neutral-400 transition-colors"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingId(game.id)}
                        disabled={unsyncingId === game.id || removingId === game.id}
                        className="shrink-0 opacity-0 group-hover:opacity-100 rounded-lg p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                        title="Manage game"
                      >
                        {(unsyncingId === game.id || removingId === game.id) ? (
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4m-3.93 7.07l-2.83-2.83M7.76 7.76L4.93 4.93" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.181 8.68a4.503 4.503 0 011.903 6.405m-9.768-2.782L3.56 14.06a4.5 4.5 0 006.364 6.365l.693-.693m0 0a4.504 4.504 0 006.405-1.903m-9.768-2.782a4.503 4.503 0 01-1.903-6.405m9.768 2.782l1.757-1.757a4.5 4.5 0 00-6.364-6.365l-.693.694m0 0L8.68 10.819" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bulk manage modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowBulkModal(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Manage Steam Games</h3>
            <p className="text-sm text-neutral-400 mb-5">Choose what happens to your {games.length} Steam-synced games.</p>
            <div className="space-y-3">
              <button
                onClick={() => { onUnsyncAll(); setShowBulkModal(false); }}
                disabled={unsyncingAll || removingAll}
                className="w-full text-left rounded-xl border border-neutral-700/50 bg-neutral-800/40 px-4 py-3 hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                <p className="text-sm font-medium text-white">Remove Steam tags only</p>
                <p className="text-xs text-neutral-400 mt-0.5">Games stay in your library, Steam badge is removed</p>
              </button>
              <button
                onClick={() => { onRemoveAll(); setShowBulkModal(false); }}
                disabled={unsyncingAll || removingAll}
                className="w-full text-left rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                <p className="text-sm font-medium text-red-400">Remove from library</p>
                <p className="text-xs text-neutral-500 mt-0.5">All Steam-imported games will be deleted from your library</p>
              </button>
            </div>
            <button
              onClick={() => setShowBulkModal(false)}
              className="mt-4 w-full text-center text-sm text-neutral-500 hover:text-neutral-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Import results mini-view (shown after import) ─

function ImportResults({ result }: { result: SteamImportResult }) {
  return (
    <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 space-y-3">
      <p className="font-medium text-green-400">Import Complete!</p>
      <div className="flex flex-wrap gap-4 text-sm text-neutral-300">
        <span>
          <span className="font-semibold text-green-400">{result.imported}</span> imported
        </span>
        <span>
          <span className="font-semibold text-yellow-400">{result.skipped}</span> already in library
        </span>
        {result.notFound > 0 && (
          <span>
            <span className="font-semibold text-neutral-500">{result.notFound}</span> not matched
          </span>
        )}
      </div>

      {/* Game grid with covers */}
      {result.games && result.games.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 max-h-64 overflow-y-auto pr-1">
          {result.games
            .filter((g) => g.status !== 'not_found')
            .map((g, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg bg-neutral-800/30 px-2.5 py-2 text-xs"
              >
                {g.coverImage ? (
                  <img
                    src={g.coverImage}
                    alt={g.name}
                    loading="lazy"
                    decoding="async"
                    className="h-10 w-7 rounded object-cover shrink-0"
                  />
                ) : (
                  <div className="h-10 w-7 rounded bg-neutral-700/50 shrink-0" />
                )}
                <span
                  className={`truncate ${
                    g.status === 'imported'
                      ? 'text-green-300'
                      : 'text-yellow-300/70'
                  }`}
                >
                  {g.name}
                </span>
              </div>
            ))}
        </div>
      )}

      {result.notFound > 0 && result.games && (
        <details className="mt-2">
          <summary className="text-xs text-neutral-500 cursor-pointer hover:text-neutral-400">
            {result.notFound} games not matched
          </summary>
          <div className="mt-1 space-y-0.5 pl-2">
            {result.games
              .filter((g) => g.status === 'not_found')
              .map((g, i) => (
                <p key={i} className="text-xs text-neutral-600">{g.name}</p>
              ))}
          </div>
        </details>
      )}

      <p className="text-xs text-neutral-500 mt-2">
        All Steam imports are tagged with the PC platform.
      </p>
    </div>
  );
}

// ── Main Steam Import Component ──────────────────

export function SteamImport() {
  const { user, accessToken, refreshUser } = useAuth();
  const toast = useToast();

  // Linked account state
  const [linkedAccount, setLinkedAccount] = useState<SteamAccount | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);

  // Import flow state
  const [steamId, setSteamId] = useState('');
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState<SteamValidation | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<SteamImportResult | null>(null);
  const [showLinkForm, setShowLinkForm] = useState(false);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [steamGames, setSteamGames] = useState<SteamLinkedGame[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [unsyncingId, setUnsyncingId] = useState<string | null>(null);
  const [unsyncingAll, setUnsyncingAll] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removingAll, setRemovingAll] = useState(false);

  // Unlinking
  const [unlinking, setUnlinking] = useState(false);
  const [showUnlinkModal, setShowUnlinkModal] = useState(false);

  const isPro = user?.plan === 'pro';

  // Load linked Steam account on mount
  const loadAccount = useCallback(async () => {
    if (!accessToken || !isPro) {
      setAccountLoading(false);
      return;
    }
    try {
      const account = await steamApi.getAccount(accessToken);
      setLinkedAccount(account);
    } catch {
      // No linked account
    } finally {
      setAccountLoading(false);
    }
  }, [accessToken, isPro]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  // Load Steam games for drawer
  const loadSteamGames = useCallback(async () => {
    if (!accessToken) return;
    setGamesLoading(true);
    try {
      const games = await steamApi.getGames(accessToken);
      setSteamGames(games);
    } catch {
      toast.error('Failed to load Steam games');
    } finally {
      setGamesLoading(false);
    }
  }, [accessToken, toast]);

  function openDrawer() {
    setDrawerOpen(true);
    loadSteamGames();
  }

  // Validate Steam ID
  async function handleValidate() {
    if (!accessToken || !steamId.trim()) return;
    setValidating(true);
    setValidated(null);
    setResult(null);
    try {
      const data = await steamApi.validate(accessToken, steamId.trim());
      setValidated(data);
      if (!data.valid) {
        toast.error('Steam profile not found or is private. Please ensure your Game details are set to Public in Steam privacy settings.');
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to validate Steam ID');
    } finally {
      setValidating(false);
    }
  }

  // Import
  async function handleImport(steamIdToUse?: string) {
    const id = steamIdToUse || steamId.trim();
    if (!accessToken || !id) return;
    setImporting(true);
    try {
      const data = await steamApi.import(accessToken, id);
      setResult(data);
      toast.success(`Imported ${data.imported} games!`);
      // Refresh account info (import saves the steam link)
      await loadAccount();
      await refreshUser();
      setShowLinkForm(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to import Steam library');
    } finally {
      setImporting(false);
    }
  }

  // Update (re-import from linked account)
  async function handleUpdate() {
    if (!linkedAccount) return;
    await handleImport(linkedAccount.steamId);
  }

  // Unlink
  async function handleUnlink(mode: 'keep' | 'unsync' | 'remove' = 'keep') {
    if (!accessToken) return;
    setUnlinking(true);
    setShowUnlinkModal(false);
    try {
      if (mode === 'unsync') {
        await steamApi.unsyncAll(accessToken);
      } else if (mode === 'remove') {
        await steamApi.removeAll(accessToken);
      }
      await steamApi.unlinkAccount(accessToken);
      setLinkedAccount(null);
      setSteamGames([]);
      setResult(null);
      setValidated(null);
      setSteamId('');
      await refreshUser();
      toast.success('Steam account unlinked');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to unlink Steam account');
    } finally {
      setUnlinking(false);
    }
  }

  // Remove single game from library entirely
  async function handleRemove(itemId: string) {
    if (!accessToken) return;
    setRemovingId(itemId);
    try {
      await libraryApi.removeItem(accessToken, itemId);
      setSteamGames((prev) => prev.filter((g) => g.id !== itemId));
      toast.success('Game removed from library');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to remove game');
    } finally {
      setRemovingId(null);
    }
  }

  // Remove all Steam games from library entirely
  async function handleRemoveAll() {
    if (!accessToken) return;
    setRemovingAll(true);
    try {
      const { count } = await steamApi.removeAll(accessToken);
      setSteamGames([]);
      toast.success(`Removed ${count} games from library`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to remove games');
    } finally {
      setRemovingAll(false);
    }
  }

  // Unsync single game
  async function handleUnsync(itemId: string) {
    if (!accessToken) return;
    setUnsyncingId(itemId);
    try {
      await steamApi.unsyncGame(accessToken, itemId);
      setSteamGames((prev) => prev.filter((g) => g.id !== itemId));
      toast.success('Game unsynced from Steam');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to unsync game');
    } finally {
      setUnsyncingId(null);
    }
  }

  // Unsync all games
  async function handleUnsyncAll() {
    if (!accessToken) return;
    setUnsyncingAll(true);
    try {
      const { count } = await steamApi.unsyncAll(accessToken);
      setSteamGames([]);
      toast.success(`Unsynced ${count} games from Steam`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to unsync games');
    } finally {
      setUnsyncingAll(false);
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/50 p-6 backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-blue-500/15">
            <SteamIcon className="h-5 w-5 text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white">Steam Library Import</h3>
            <p className="text-sm text-neutral-400">Import your Steam games into GameTracker</p>
          </div>
          {!isPro && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2.5 py-1 text-xs font-semibold text-violet-400">
              PRO
            </span>
          )}
        </div>

        {!isPro ? (
          <ProGate message="Upgrade to Pro to import your Steam library." />
        ) : accountLoading ? (
          <div className="space-y-3">
            <div className="h-16 rounded-xl bg-neutral-800/30 animate-pulse" />
          </div>
        ) : linkedAccount && !showLinkForm ? (
          /* ── Linked Account View ─────────────── */
          <div className="space-y-4">
            {/* Account card */}
            <div className="flex items-center gap-4 rounded-xl border border-neutral-800/80 bg-neutral-800/20 p-4">
              {linkedAccount.avatarUrl && (
                <img
                  src={linkedAccount.avatarUrl}
                  alt={linkedAccount.playerName}
                  className="h-12 w-12 rounded-full ring-2 ring-blue-500/20"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white">{linkedAccount.playerName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="inline-flex items-center gap-1 text-xs text-green-400">
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 8 8">
                      <circle cx="4" cy="4" r="4" />
                    </svg>
                    Linked
                  </span>
                  <span className="text-xs text-neutral-600">&bull;</span>
                  <span className="text-xs text-neutral-500 truncate">{linkedAccount.steamId}</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleUpdate} isLoading={importing}>
                <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
                Update Library
              </Button>
              <Button size="sm" variant="secondary" onClick={openDrawer}>
                <SteamIcon className="h-3.5 w-3.5 mr-1.5" />
                View Synced Games
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setShowLinkForm(true);
                  setSteamId('');
                  setValidated(null);
                  setResult(null);
                }}
                className="text-neutral-400"
              >
                Change Account
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowUnlinkModal(true)}
                isLoading={unlinking}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                Unlink
              </Button>
            </div>

            {/* Import results (if just imported) */}
            {result && <ImportResults result={result} />}
          </div>
        ) : (
          /* ── Link / Import Form ──────────────── */
          <div className="space-y-4">
            {linkedAccount && showLinkForm && (
              <button
                onClick={() => setShowLinkForm(false)}
                className="text-sm text-neutral-400 hover:text-neutral-300 flex items-center gap-1 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Back to linked account
              </button>
            )}

            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Steam ID, profile URL, or vanity name"
                  value={steamId}
                  onChange={(e) => {
                    setSteamId(e.target.value);
                    setValidated(null);
                    setResult(null);
                  }}
                  aria-label="Steam ID"
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleValidate}
                isLoading={validating}
                disabled={!steamId.trim()}
              >
                Validate
              </Button>
            </div>

            {validated?.valid && (
              <div className="flex items-center gap-4 rounded-xl border border-neutral-800/80 bg-neutral-800/30 p-4">
                {validated.avatarUrl && (
                  <img
                    src={validated.avatarUrl}
                    alt={validated.playerName || 'Steam avatar'}
                    className="h-12 w-12 rounded-full"
                  />
                )}
                <div className="flex-1">
                  <p className="font-medium text-white">{validated.playerName}</p>
                  <p className="text-sm text-neutral-400">Steam profile verified</p>
                </div>
                <Button size="sm" onClick={() => handleImport()} isLoading={importing}>
                  Import Games
                </Button>
              </div>
            )}

            {validated && !validated.valid && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
                Steam profile not found or is private. Please ensure your Steam profile is public and
                you&apos;re using a valid 64-bit Steam ID.
              </div>
            )}

            {result && <ImportResults result={result} />}
          </div>
        )}
      </div>

      {/* Drawer for viewing synced games */}
      <SteamGamesDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        games={steamGames}
        loading={gamesLoading}
        onUnsync={handleUnsync}
        onUnsyncAll={handleUnsyncAll}
        onRemove={handleRemove}
        onRemoveAll={handleRemoveAll}
        unsyncingId={unsyncingId}
        unsyncingAll={unsyncingAll}
        removingId={removingId}
        removingAll={removingAll}
      />

      {/* Unlink modal */}
      {showUnlinkModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowUnlinkModal(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Unlink Steam Account</h3>
            <p className="text-sm text-neutral-400 mb-5">What should happen to your Steam-imported games?</p>
            <div className="space-y-3">
              <button
                onClick={() => handleUnlink('keep')}
                className="w-full text-left rounded-xl border border-neutral-700/50 bg-neutral-800/40 px-4 py-3 hover:bg-neutral-800 transition-colors"
              >
                <p className="text-sm font-medium text-white">Keep all games in library</p>
                <p className="text-xs text-neutral-400 mt-0.5">Your library stays intact, Steam badge is preserved</p>
              </button>
              <button
                onClick={() => handleUnlink('unsync')}
                className="w-full text-left rounded-xl border border-neutral-700/50 bg-neutral-800/40 px-4 py-3 hover:bg-neutral-800 transition-colors"
              >
                <p className="text-sm font-medium text-white">Remove Steam tags only</p>
                <p className="text-xs text-neutral-400 mt-0.5">Games stay in your library, Steam badge is removed</p>
              </button>
              <button
                onClick={() => handleUnlink('remove')}
                className="w-full text-left rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 hover:bg-red-500/10 transition-colors"
              >
                <p className="text-sm font-medium text-red-400">Remove all Steam games from library</p>
                <p className="text-xs text-neutral-500 mt-0.5">All Steam-imported games will be deleted from your library</p>
              </button>
            </div>
            <button
              onClick={() => setShowUnlinkModal(false)}
              className="mt-4 w-full text-center text-sm text-neutral-500 hover:text-neutral-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
