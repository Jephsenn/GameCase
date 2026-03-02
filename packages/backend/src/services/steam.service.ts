import prisma from '../lib/prisma';
import { config } from '../config';
import { searchRawgGames } from '../lib/rawg';
import { ingestRawgGame } from './game.service';
import { logger } from '../lib/logger';
import { AppError } from './auth.service';

// ──────────────────────────────────────────────
// Steam Service — import Steam library games
// ──────────────────────────────────────────────

interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url: string;
}

interface SteamPlayerSummary {
  steamid: string;
  personaname: string;
  avatarfull: string;
  communityvisibilitystate: number;
}

export interface ImportedGameDetail {
  name: string;
  status: 'imported' | 'already_in_library' | 'not_found';
  coverImage?: string | null;
  slug?: string | null;
  gameId?: string | null;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  notFound: number;
  games: ImportedGameDetail[];
}

export interface SteamAccount {
  steamId: string;
  playerName: string;
  avatarUrl: string | null;
}

export interface SteamLinkedGame {
  id: string;       // libraryItem id
  gameId: string;
  name: string;
  slug: string;
  coverImage: string | null;
  addedAt: string;
}

// ── Get Steam games for a user ────────────────

export async function getSteamGames(steamId: string): Promise<SteamGame[]> {
  const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${config.steamApiKey}&steamid=${steamId}&include_appinfo=true&include_played_free_games=true&format=json`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new AppError('Failed to fetch Steam games', 502);
  }

  const data = (await res.json()) as { response?: { games?: SteamGame[] } };
  return data.response?.games ?? [];
}

// ── Resolve a vanity URL to a 64-bit Steam ID ─

export async function resolveVanityUrl(vanityName: string): Promise<string | null> {
  try {
    const url = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${config.steamApiKey}&vanityurl=${encodeURIComponent(vanityName)}&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = (await res.json()) as { response?: { success: number; steamid?: string } };
    if (data.response?.success === 1 && data.response.steamid) {
      return data.response.steamid;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse flexible Steam input into a 64-bit Steam ID.
 * Accepts:
 *   - Raw 64-bit ID (17 digits)
 *   - https://steamcommunity.com/profiles/<id>
 *   - https://steamcommunity.com/id/<vanity>
 *   - A vanity name directly
 */
export async function resolveSteamInput(input: string): Promise<string> {
  const trimmed = input.trim();

  // Check for /profiles/<steamid64>
  const profileMatch = trimmed.match(/steamcommunity\.com\/profiles\/(\d+)/);
  if (profileMatch) return profileMatch[1];

  // Check for /id/<vanity_name>
  const vanityMatch = trimmed.match(/steamcommunity\.com\/id\/([^/]+)/);
  if (vanityMatch) {
    const resolved = await resolveVanityUrl(vanityMatch[1]);
    if (resolved) return resolved;
    throw new AppError('Could not resolve Steam vanity URL. Make sure the profile exists and is public.', 400);
  }

  // If it looks like a raw 64-bit Steam ID
  if (/^\d{17}$/.test(trimmed)) return trimmed;

  // Treat as a vanity name
  const resolved = await resolveVanityUrl(trimmed);
  if (resolved) return resolved;

  throw new AppError('Could not resolve Steam ID. Enter a 64-bit Steam ID, profile URL, or vanity name.', 400);
}

// ── Validate a Steam ID ───────────────────────

export async function validateSteamId(
  steamId: string,
): Promise<{ valid: boolean; playerName?: string; avatarUrl?: string }> {
  try {
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${config.steamApiKey}&steamids=${steamId}&format=json`;
    const res = await fetch(url);
    if (!res.ok) return { valid: false };

    const data = (await res.json()) as {
      response?: { players?: SteamPlayerSummary[] };
    };
    const player = data.response?.players?.[0];
    if (!player) return { valid: false };

    // communityvisibilitystate 3 = public
    if (player.communityvisibilitystate !== 3) {
      return { valid: false };
    }

    return {
      valid: true,
      playerName: player.personaname,
      avatarUrl: player.avatarfull,
    };
  } catch {
    return { valid: false };
  }
}

// ── Match a Steam game — find locally or create from RAWG ────────────

async function findOrCreateGame(
  appId: number,
  name: string,
): Promise<{ id: string } | null> {
  // 1. Try exact title match first (case-insensitive)
  const byTitle = await prisma.game.findFirst({
    where: { title: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (byTitle) return byTitle;

  // 2. Search RAWG and try to match/ingest
  try {
    const rawgResults = await searchRawgGames({
      search: name,
      search_precise: true,
      page_size: 5,
    });

    for (const rawgGame of rawgResults.results) {
      // Check if we already have this RAWG game locally
      const local = await prisma.game.findUnique({
        where: { rawgId: rawgGame.id },
        select: { id: true },
      });
      if (local) return local;

      // If the RAWG result name closely matches the Steam name, ingest it
      if (namesMatch(name, rawgGame.name)) {
        const gameId = await ingestRawgGame(rawgGame);
        return { id: gameId };
      }
    }

    // If no close match, try ingesting the first result anyway if there is one
    if (rawgResults.results.length > 0) {
      const best = rawgResults.results[0];
      const gameId = await ingestRawgGame(best);
      return { id: gameId };
    }
  } catch (err) {
    logger.debug({ err, name }, 'RAWG lookup failed during Steam import');
  }

  return null;
}

/**
 * Fuzzy name comparison — normalizes both names and checks for a match.
 */
function namesMatch(steamName: string, rawgName: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  return normalize(steamName) === normalize(rawgName);
}

// ── Import Steam library ──────────────────────

export async function importSteamLibrary(
  userId: string,
  steamId: string,
): Promise<ImportResult> {
  // Save/update the Steam account link on the user
  const validation = await validateSteamId(steamId);
  if (validation.valid) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        steamId,
        steamPlayerName: validation.playerName || null,
        steamAvatarUrl: validation.avatarUrl || null,
      },
    });
  }

  // Find user's default "Played" library
  const playedLibrary = await prisma.library.findFirst({
    where: { userId, defaultType: 'played' },
    select: { id: true },
  });

  if (!playedLibrary) {
    throw new AppError('Default "Played" library not found', 404);
  }

  const steamGames = await getSteamGames(steamId);

  let imported = 0;
  let skipped = 0;
  let notFound = 0;
  const games: ImportedGameDetail[] = [];

  for (const steamGame of steamGames) {
    const localGame = await findOrCreateGame(steamGame.appid, steamGame.name);

    if (!localGame) {
      notFound++;
      games.push({ name: steamGame.name, status: 'not_found' });
      continue;
    }

    // Fetch game details for the response
    const gameDetails = await prisma.game.findUnique({
      where: { id: localGame.id },
      select: { coverImage: true, slug: true },
    });

    // Check if already in this library
    const existing = await prisma.libraryItem.findUnique({
      where: {
        libraryId_gameId: {
          libraryId: playedLibrary.id,
          gameId: localGame.id,
        },
      },
    });

    if (existing) {
      // Ensure "PC" is in platformsPlayed and mark as steam import
      const updates: Record<string, unknown> = { steamImport: true };
      if (!existing.platformsPlayed.includes('PC')) {
        updates.platformsPlayed = { push: 'PC' };
      }
      await prisma.libraryItem.update({
        where: { id: existing.id },
        data: updates,
      });
      skipped++;
      games.push({
        name: steamGame.name,
        status: 'already_in_library',
        coverImage: gameDetails?.coverImage || null,
        slug: gameDetails?.slug || null,
        gameId: localGame.id,
      });
      continue;
    }

    try {
      await prisma.libraryItem.create({
        data: {
          libraryId: playedLibrary.id,
          gameId: localGame.id,
          platformsPlayed: ['PC'],
          steamImport: true,
        },
      });
      imported++;
      games.push({
        name: steamGame.name,
        status: 'imported',
        coverImage: gameDetails?.coverImage || null,
        slug: gameDetails?.slug || null,
        gameId: localGame.id,
      });
    } catch {
      skipped++;
      games.push({
        name: steamGame.name,
        status: 'already_in_library',
        coverImage: gameDetails?.coverImage || null,
        slug: gameDetails?.slug || null,
        gameId: localGame.id,
      });
    }
  }

  // Sort games: imported first, then already_in_library, then not_found
  const statusOrder = { imported: 0, already_in_library: 1, not_found: 2 };
  games.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  // Invalidate library cache
  const { cacheDel } = await import('../lib/redis');
  await cacheDel(`user:${userId}:libraries`);

  // Create activity feed item for Steam import
  if (imported > 0) {
    await prisma.activityFeedItem.create({
      data: {
        userId,
        type: 'steam_imported',
        gameId: null,
        libraryId: playedLibrary.id,
        metadata: { imported, skipped, notFound },
      },
    });
  }

  return { imported, skipped, notFound, games };
}

// ── Get linked Steam account ──────────────────

export async function getLinkedSteamAccount(userId: string): Promise<SteamAccount | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { steamId: true, steamPlayerName: true, steamAvatarUrl: true },
  });

  if (!user?.steamId || !user?.steamPlayerName) return null;

  return {
    steamId: user.steamId,
    playerName: user.steamPlayerName,
    avatarUrl: user.steamAvatarUrl,
  };
}

// ── Unlink Steam account ──────────────────────

export async function unlinkSteamAccount(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      steamId: null,
      steamPlayerName: null,
      steamAvatarUrl: null,
    },
  });
}

// ── Get all Steam-imported games ──────────────

export async function getSteamImportedGames(userId: string): Promise<SteamLinkedGame[]> {
  const items = await prisma.libraryItem.findMany({
    where: {
      steamImport: true,
      library: { userId },
    },
    select: {
      id: true,
      gameId: true,
      addedAt: true,
      game: {
        select: {
          title: true,
          slug: true,
          coverImage: true,
        },
      },
    },
    orderBy: { game: { title: 'asc' } },
  });

  return items.map((item) => ({
    id: item.id,
    gameId: item.gameId,
    name: item.game.title,
    slug: item.game.slug,
    coverImage: item.game.coverImage,
    addedAt: item.addedAt.toISOString(),
  }));
}

// ── Unsync a single Steam game ────────────────

export async function unsyncSteamGame(userId: string, itemId: string): Promise<void> {
  const item = await prisma.libraryItem.findUnique({
    where: { id: itemId },
    include: { library: { select: { userId: true } } },
  });

  if (!item || item.library.userId !== userId) {
    throw new AppError('Library item not found', 404);
  }

  if (!item.steamImport) {
    throw new AppError('This game was not imported from Steam', 400);
  }

  // Remove the steam tag (keep the game in the library)
  await prisma.libraryItem.update({
    where: { id: itemId },
    data: { steamImport: false },
  });
}

// ── Unsync all Steam games ────────────────────

export async function unsyncAllSteamGames(userId: string): Promise<{ count: number }> {
  const result = await prisma.libraryItem.updateMany({
    where: {
      steamImport: true,
      library: { userId },
    },
    data: { steamImport: false },
  });

  return { count: result.count };
}

// ── Remove all Steam-imported games from library ─

export async function removeAllSteamGames(userId: string): Promise<{ count: number }> {
  const result = await prisma.libraryItem.deleteMany({
    where: {
      steamImport: true,
      library: { userId },
    },
  });

  // Invalidate library cache
  const { cacheDel } = await import('../lib/redis');
  await cacheDel(`user:${userId}:libraries`);

  return { count: result.count };
}
