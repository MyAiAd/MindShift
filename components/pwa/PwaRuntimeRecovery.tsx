'use client';

import { useEffect, useRef } from 'react';

const CACHE_PREFIXES_TO_CLEAR = ['static-js-assets', 'static-style-assets', 'others'];
const RECOVERY_STORAGE_KEY = 'pwa_runtime_recovery_at';
const RECOVERY_COOLDOWN_MS = 2 * 60 * 1000;
const CHUNK_ERROR_PATTERNS = [
  /ChunkLoadError/i,
  /Loading chunk [\d]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
];

function getErrorMessage(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';

  const maybeMessage = (value as { message?: unknown }).message;
  return typeof maybeMessage === 'string' ? maybeMessage : '';
}

function shouldRecoverFromError(value: unknown): boolean {
  const message = getErrorMessage(value);
  if (!message) return false;

  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

async function clearLegacyRuntimeCaches(): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;

  const cacheKeys = await caches.keys();
  const cacheKeysToDelete = cacheKeys.filter((cacheKey) =>
    CACHE_PREFIXES_TO_CLEAR.some((prefix) => cacheKey === prefix || cacheKey.startsWith(prefix))
  );

  await Promise.all(cacheKeysToDelete.map((cacheKey) => caches.delete(cacheKey)));
}

async function resetServiceWorkers(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
}

export function PwaRuntimeRecovery() {
  const recoveryInProgressRef = useRef(false);

  useEffect(() => {
    void clearLegacyRuntimeCaches();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const triggerRecovery = async () => {
      if (recoveryInProgressRef.current) return;

      const lastAttemptAt = Number(sessionStorage.getItem(RECOVERY_STORAGE_KEY) || 0);
      if (lastAttemptAt && Date.now() - lastAttemptAt < RECOVERY_COOLDOWN_MS) {
        return;
      }

      recoveryInProgressRef.current = true;
      sessionStorage.setItem(RECOVERY_STORAGE_KEY, String(Date.now()));

      try {
        await clearLegacyRuntimeCaches();
        await resetServiceWorkers();
      } catch (error) {
        console.warn('PWA runtime recovery failed:', error);
      } finally {
        window.location.reload();
      }
    };

    const handleError = (event: ErrorEvent) => {
      if (!shouldRecoverFromError(event.error || event.message || event.filename)) {
        return;
      }

      console.warn('Recovering from chunk/runtime load failure via cache reset.');
      void triggerRecovery();
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!shouldRecoverFromError(event.reason)) {
        return;
      }

      console.warn('Recovering from unhandled module/chunk failure via cache reset.');
      void triggerRecovery();
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
