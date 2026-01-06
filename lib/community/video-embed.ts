export interface VideoEmbed {
  provider: 'youtube' | 'vimeo' | 'wistia' | 'other';
  url: string;
  embedUrl: string;
  thumbnail?: string;
  title?: string;
  duration?: number;
}

export interface VideoProvider {
  name: 'youtube' | 'vimeo' | 'wistia' | 'other';
  urlPatterns: RegExp[];
  extractId: (url: string) => string | null;
  getEmbedUrl: (id: string) => string;
  getThumbnail: (id: string) => Promise<string | null>;
}

export const videoProviders: Record<string, VideoProvider> = {
  youtube: {
    name: 'youtube',
    urlPatterns: [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/v\/([a-zA-Z0-9_-]+)/,
    ],
    extractId: (url: string) => {
      for (const pattern of videoProviders.youtube.urlPatterns) {
        const match = url.match(pattern);
        if (match) return match[1];
      }
      return null;
    },
    getEmbedUrl: (id: string) => `https://www.youtube.com/embed/${id}`,
    getThumbnail: async (id: string) => {
      // Try high quality first, fall back to default
      const qualities = ['maxresdefault', 'hqdefault', 'mqdefault', 'default'];
      for (const quality of qualities) {
        const url = `https://img.youtube.com/vi/${id}/${quality}.jpg`;
        try {
          const response = await fetch(url, { method: 'HEAD' });
          if (response.ok) return url;
        } catch {
          continue;
        }
      }
      return `https://img.youtube.com/vi/${id}/default.jpg`;
    },
  },

  vimeo: {
    name: 'vimeo',
    urlPatterns: [
      /vimeo\.com\/([0-9]+)/,
      /player\.vimeo\.com\/video\/([0-9]+)/,
    ],
    extractId: (url: string) => {
      for (const pattern of videoProviders.vimeo.urlPatterns) {
        const match = url.match(pattern);
        if (match) return match[1];
      }
      return null;
    },
    getEmbedUrl: (id: string) => `https://player.vimeo.com/video/${id}`,
    getThumbnail: async (id: string) => {
      try {
        const response = await fetch(`https://vimeo.com/api/v2/video/${id}.json`);
        if (!response.ok) return null;
        const data = await response.json();
        return data[0]?.thumbnail_large || null;
      } catch {
        return null;
      }
    },
  },

  wistia: {
    name: 'wistia',
    urlPatterns: [
      /wistia\.com\/medias\/([a-zA-Z0-9]+)/,
      /fast\.wistia\.net\/embed\/iframe\/([a-zA-Z0-9]+)/,
      /\.wistia\.com\/medias\/([a-zA-Z0-9]+)/,
    ],
    extractId: (url: string) => {
      for (const pattern of videoProviders.wistia.urlPatterns) {
        const match = url.match(pattern);
        if (match) return match[1];
      }
      return null;
    },
    getEmbedUrl: (id: string) => `https://fast.wistia.net/embed/iframe/${id}`,
    getThumbnail: async (id: string) => {
      try {
        const response = await fetch(
          `https://fast.wistia.net/oembed?url=https://home.wistia.com/medias/${id}`
        );
        if (!response.ok) return null;
        const data = await response.json();
        return data.thumbnail_url || null;
      } catch {
        return null;
      }
    },
  },
};

export class VideoEmbedParser {
  /**
   * Detect video provider from URL
   */
  detectProvider(url: string): VideoProvider | null {
    for (const provider of Object.values(videoProviders)) {
      for (const pattern of provider.urlPatterns) {
        if (pattern.test(url)) {
          return provider;
        }
      }
    }
    return null;
  }

  /**
   * Parse video URL and create embed object
   */
  async parseVideoUrl(url: string): Promise<VideoEmbed | null> {
    const provider = this.detectProvider(url);
    if (!provider) {
      return null;
    }

    const videoId = provider.extractId(url);
    if (!videoId) {
      return null;
    }

    const embedUrl = provider.getEmbedUrl(videoId);
    const thumbnail = await provider.getThumbnail(videoId);

    return {
      provider: provider.name,
      url,
      embedUrl,
      thumbnail: thumbnail || undefined,
    };
  }

  /**
   * Parse multiple video URLs
   */
  async parseMultipleUrls(urls: string[]): Promise<VideoEmbed[]> {
    const promises = urls.map(url => this.parseVideoUrl(url));
    const results = await Promise.all(promises);
    return results.filter((r): r is VideoEmbed => r !== null);
  }

  /**
   * Validate video URL
   */
  isValidVideoUrl(url: string): boolean {
    return this.detectProvider(url) !== null;
  }

  /**
   * Extract video URLs from text
   */
  extractVideoUrls(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlRegex) || [];
    return urls.filter(url => this.isValidVideoUrl(url));
  }
}

export const videoParser = new VideoEmbedParser();

