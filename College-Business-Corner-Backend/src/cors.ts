const LOCAL_DEV = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

type Callback = (err: Error | null, allow?: boolean) => void;

/**
 * Which browser addresses may call the API.
 * - FRONTEND_URL (one address, or several separated by commas) is always allowed.
 * - Outside production, any localhost port is also allowed, because Vite moves to the next free port
 *   (5174, 5175...) when 5173 is taken, and that must not silently break sign-in.
 * - Requests with no Origin (curl, Swagger, server to server) are not affected by CORS.
 */
export function corsOrigin(frontendUrl: string | undefined, nodeEnv: string | undefined) {
  const allowed = (frontendUrl ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return (origin: string | undefined, callback: Callback) => {
    if (!origin) return callback(null, true);
    if (allowed.includes(origin)) return callback(null, true);
    if (nodeEnv !== 'production' && LOCAL_DEV.test(origin)) return callback(null, true);
    return callback(null, false);
  };
}
