import { join } from 'node:path';

/**
 * Where uploaded listing photos are stored (a "listings" folder inside it).
 * Locally this is ./uploads. When hosting, point UPLOADS_DIR at a persistent volume so photos survive redeploys.
 * Set it as a real environment variable (it is read as soon as the app starts).
 */
export const UPLOADS_DIR = process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');
