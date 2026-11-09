/**
 * Helpers for running on a host such as Railway. They are plain functions so they can be tested.
 */

/** Railway tells the app its public address. Use it for the PayPal return address and the frontend address unless set explicitly. */
export function applyHostedDefaults(env: NodeJS.ProcessEnv): string[] {
  const domain = env.RAILWAY_PUBLIC_DOMAIN?.trim();
  const applied: string[] = [];
  if (!domain) return applied;
  const url = `https://${domain}`;
  for (const name of ['APP_BASE_URL', 'FRONTEND_URL']) {
    if (!env[name]) {
      env[name] = url;
      applied.push(name);
    }
  }
  return applied;
}

const underVolume = (path: string, volume: string) => path === volume || path.startsWith(volume.replace(/\/+$/, '') + '/');

/** The database file path inside a SQLite url like file:/data/app.db (undefined for anything else). */
function databasePath(url: string | undefined): string | undefined {
  return url?.startsWith('file:') ? url.slice('file:'.length) : undefined;
}

/**
 * When a persistent volume is attached, data written anywhere else disappears on the next deploy.
 * Returns a warning for each thing that is not on the volume.
 */
export function storageWarnings(env: NodeJS.ProcessEnv): string[] {
  const volume = env.RAILWAY_VOLUME_MOUNT_PATH;
  if (!volume) return [];
  const warnings: string[] = [];
  const db = databasePath(env.DATABASE_URL);
  if (!db || !underVolume(db, volume)) {
    warnings.push(`DATABASE_URL (${env.DATABASE_URL ?? 'not set'}) is not on the volume at ${volume}, so the database will be lost on every redeploy.`);
  }
  if (!env.UPLOADS_DIR || !underVolume(env.UPLOADS_DIR, volume)) {
    warnings.push(`UPLOADS_DIR (${env.UPLOADS_DIR ?? 'not set'}) is not on the volume at ${volume}, so uploaded photos will be lost on every redeploy.`);
  }
  return warnings;
}
