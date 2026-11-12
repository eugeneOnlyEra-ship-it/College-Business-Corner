import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Where to send the browser back to inside the website, for example "/orders/abc" -> ".../#/orders/abc".
 *
 * When the website is bundled with the API (the Docker/Railway setup) it lives at the SAME address as the API,
 * so a relative link is always right, even if FRONTEND_URL is missing or wrong. Otherwise FRONTEND_URL is used.
 * Returns null when neither is available (for example while testing the API in Swagger).
 */
export function websiteUrl(hashPath: string, frontendUrl?: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const hash = `/#${hashPath.startsWith('/') ? hashPath : `/${hashPath}`}`;
  const website = env.PUBLIC_DIR ?? join(process.cwd(), 'public');
  if (existsSync(join(website, 'index.html'))) return hash;
  const base = frontendUrl?.trim().replace(/\/+$/, '');
  return base ? `${base}${hash}` : null;
}
