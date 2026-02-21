'use client';

const HARD_REFRESH_QUERY_PARAM = '__hard_refresh';

function withHardRefreshParam(currentUrl: string): string {
  const nextUrl = new URL(currentUrl);
  nextUrl.searchParams.set(HARD_REFRESH_QUERY_PARAM, Date.now().toString());
  return nextUrl.toString();
}

export async function performHardRefresh(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.allSettled(cacheKeys.map(cacheKey => caches.delete(cacheKey)));
    }

    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(registrations.map(registration => registration.unregister()));
    }
  } catch (error) {
    console.warn('Hard refresh cleanup failed:', error);
  } finally {
    window.location.replace(withHardRefreshParam(window.location.href));
  }
}

export function cleanupHardRefreshParam(): void {
  if (typeof window === 'undefined') return;

  const currentUrl = new URL(window.location.href);
  if (!currentUrl.searchParams.has(HARD_REFRESH_QUERY_PARAM)) return;

  currentUrl.searchParams.delete(HARD_REFRESH_QUERY_PARAM);
  const cleanedPath = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
  window.history.replaceState(window.history.state, '', cleanedPath);
}
