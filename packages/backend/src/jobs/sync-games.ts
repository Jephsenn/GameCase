import cron from 'node-cron';
import { importGamesFromRawg } from '../services/game.service';
import { regenerateAllRecommendations } from '../services/recommendation.service';
import { config } from '../config';

// ──────────────────────────────────────────────
// Background Sync Jobs — node-cron scheduled tasks
// ──────────────────────────────────────────────

/**
 * Sync newly released and trending games from RAWG on a schedule.
 *
 * Runs every Sunday at 3:00 AM to pick up new releases from the past week
 * and popular/trending titles.
 */
export function startSyncJobs(): void {
  if (!config.rawgApiKey) {
    console.log('   ⏭ RAWG_API_KEY not set — skipping game sync jobs');
    return;
  }

  // ── Weekly new releases sync (every Sunday at 3:00 AM) ──
  cron.schedule('0 3 * * 0', async () => {
    console.log('[sync] Starting weekly new-releases sync…');
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const dates = `${formatDate(oneWeekAgo)},${formatDate(now)}`;

    try {
      const result = await importGamesFromRawg(
        { dates, ordering: '-released', page_size: 40 },
        3,
      );
      console.log(`[sync] New releases: imported ${result.imported}, failed ${result.failed}`);
    } catch (err) {
      console.error('[sync] New releases sync failed:', err);
    }
  });

  // ── Weekly trending sync (every Sunday at 4:00 AM) ──
  cron.schedule('0 4 * * 0', async () => {
    console.log('[sync] Starting weekly trending sync…');

    try {
      const result = await importGamesFromRawg(
        { ordering: '-rating', metacritic: '75,100' },
        2,
      );
      console.log(`[sync] Trending: imported ${result.imported}, failed ${result.failed}`);
    } catch (err) {
      console.error('[sync] Trending sync failed:', err);
    }
  });

  // ── Daily popular games refresh (every day at 5:00 AM) ──
  cron.schedule('0 5 * * *', async () => {
    console.log('[sync] Starting daily popular games refresh…');

    try {
      const result = await importGamesFromRawg(
        { ordering: '-added', page_size: 40 },
        1,
      );
      console.log(`[sync] Popular refresh: imported ${result.imported}, failed ${result.failed}`);
    } catch (err) {
      console.error('[sync] Popular refresh failed:', err);
    }
  });

  // ── Nightly recommendation refresh (every day at 2:00 AM) ──
  cron.schedule('0 2 * * *', async () => {
    console.log('[sync] Starting nightly recommendation regeneration…');

    try {
      const result = await regenerateAllRecommendations();
      console.log(`[sync] Recommendations: processed ${result.processed}, errors ${result.errors}`);
    } catch (err) {
      console.error('[sync] Recommendation regeneration failed:', err);
    }
  });

  console.log('   ⏰ Game sync & recommendation cron jobs scheduled');
}

// ── Helpers ────────────────────────────────────

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}
