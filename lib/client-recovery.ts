const AUTO_RECOVERY_SESSION_KEY = 'mindshifting:auto-recovery:v1';

const CHUNK_ERROR_PATTERNS = [
  /chunkloaderror/i,
  /loading chunk/i,
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /failed to load module script/i,
  /loading css chunk/i,
  /unexpected token '</i, // stale HTML served where JS chunk is expected
];

function normalizeErrorMessage(reason: unknown): string {
  if (!reason) return '';
  if (typeof reason === 'string') return reason;
  if (reason instanceof Error) return reason.message || String(reason);
  if (typeof reason === 'object' && 'message' in reason) {
    const message = (reason as { message?: unknown }).message;
    return typeof message === 'string' ? message : String(message ?? '');
  }
  return String(reason);
}

export function getRecoveryErrorMessage(reason: unknown): string {
  return normalizeErrorMessage(reason);
}

export function isChunkLoadLikeError(reason: unknown): boolean {
  const message = normalizeErrorMessage(reason);
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function hasAutoRecoveryAttempted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(AUTO_RECOVERY_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function markAutoRecoveryAttempted(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(AUTO_RECOVERY_SESSION_KEY, '1');
  } catch {
    // Ignore storage failures in strict privacy modes.
  }
}

export async function clearRuntimeCaches(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
    }
  } catch (error) {
    console.warn('Cache clear failed during runtime recovery:', error);
  }

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(async (registration) => {
          await registration.update();
        })
      );
    }
  } catch (error) {
    console.warn('Service worker update failed during runtime recovery:', error);
  }
}

export async function forceRefreshApp(): Promise<void> {
  if (typeof window === 'undefined') return;
  await clearRuntimeCaches();
  window.location.reload();
}
