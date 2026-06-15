/** Production Render backend — used when VITE_API_BASE_URL is missing on Vercel builds. */
export const PRODUCTION_API_BASE_URL = 'https://factorymap.onrender.com';

/**
 * Resolve API base URL for fetch calls.
 * - Prefer VITE_API_BASE_URL from the build environment.
 * - Fall back to Render in production (fixes mobile when env var was not set).
 * - Use localhost only in local dev.
 */
export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (fromEnv && String(fromEnv).trim()) {
    return String(fromEnv).trim().replace(/\/$/, '');
  }
  if (import.meta.env.PROD) {
    return PRODUCTION_API_BASE_URL;
  }
  return 'http://localhost:5000';
}
