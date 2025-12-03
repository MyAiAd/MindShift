/**
 * Global Audio Cache for Natural Voice
 * 
 * Singleton cache that persists audio URLs across component lifecycles.
 * Used to preload and store TTS audio for instant playback.
 */

class GlobalAudioCache {
    private static instance: GlobalAudioCache;
    private cache: Map<string, string> = new Map();

    private constructor() {}

    static getInstance(): GlobalAudioCache {
        if (!GlobalAudioCache.instance) {
            GlobalAudioCache.instance = new GlobalAudioCache();
        }
        return GlobalAudioCache.instance;
    }

    set(key: string, value: string): void {
        this.cache.set(key, value);
    }

    get(key: string): string | undefined {
        return this.cache.get(key);
    }

    has(key: string): boolean {
        return this.cache.has(key);
    }

    clear(): void {
        // Revoke all blob URLs to prevent memory leaks
        this.cache.forEach((url) => {
            URL.revokeObjectURL(url);
        });
        this.cache.clear();
    }

    size(): number {
        return this.cache.size;
    }
}

export const globalAudioCache = GlobalAudioCache.getInstance();

