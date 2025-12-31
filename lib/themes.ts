/**
 * Multi-Theme System Configuration
 * 
 * This file defines all available themes and their configurations.
 * Each theme includes metadata, color previews, and mode (light/dark).
 */

export type ThemeMode = 'light' | 'dark';

export type ThemeId = 
  | 'solarized-light' 
  | 'solarized-dark' 
  | 'gruvbox-light'
  | 'gruvbox-dark'
  | 'nord'
  | 'dracula'
  | 'catppuccin-mocha'
  | 'tokyo-night';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  mode: ThemeMode;
  description: string;
  author?: string;
  preview: {
    background: string;
    foreground: string;
    primary: string;
    secondary: string;
  };
}

export const themes: Record<ThemeId, ThemeConfig> = {
  'solarized-light': {
    id: 'solarized-light',
    name: 'Solarized Light',
    mode: 'light',
    description: 'Clean, warm light theme with excellent readability',
    author: 'Ethan Schoonover',
    preview: {
      background: '#fdf6e3',
      foreground: '#002b36',
      primary: '#268bd2',
      secondary: '#eee8d5',
    },
  },
  'solarized-dark': {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    mode: 'dark',
    description: 'Sophisticated dark theme with warm undertones',
    author: 'Ethan Schoonover',
    preview: {
      background: '#002b36',
      foreground: '#93a1a1',
      primary: '#268bd2',
      secondary: '#073642',
    },
  },
  'gruvbox-light': {
    id: 'gruvbox-light',
    name: 'Gruvbox Light',
    mode: 'light',
    description: 'Retro groove with warm earthy tones',
    author: 'Pavel Pertsev',
    preview: {
      background: '#fbf1c7',
      foreground: '#3c3836',
      primary: '#d79921',
      secondary: '#ebdbb2',
    },
  },
  'gruvbox-dark': {
    id: 'gruvbox-dark',
    name: 'Gruvbox Dark',
    mode: 'dark',
    description: 'Retro groove with warm, comfortable colors',
    author: 'Pavel Pertsev',
    preview: {
      background: '#282828',
      foreground: '#ebdbb2',
      primary: '#fabd2f',
      secondary: '#3c3836',
    },
  },
  'nord': {
    id: 'nord',
    name: 'Nord',
    mode: 'dark',
    description: 'Arctic, north-bluish color palette',
    author: 'Arctic Ice Studio',
    preview: {
      background: '#2e3440',
      foreground: '#d8dee9',
      primary: '#88c0d0',
      secondary: '#3b4252',
    },
  },
  'dracula': {
    id: 'dracula',
    name: 'Dracula',
    mode: 'dark',
    description: 'Dark theme with vibrant, energetic colors',
    author: 'Zeno Rocha',
    preview: {
      background: '#282a36',
      foreground: '#f8f8f2',
      primary: '#bd93f9',
      secondary: '#44475a',
    },
  },
  'catppuccin-mocha': {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    mode: 'dark',
    description: 'Soothing pastel theme with excellent contrast',
    author: 'Catppuccin',
    preview: {
      background: '#1e1e2e',
      foreground: '#cdd6f4',
      primary: '#89b4fa',
      secondary: '#313244',
    },
  },
  'tokyo-night': {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    mode: 'dark',
    description: 'Clean dark theme inspired by Tokyo nights',
    author: 'Enkia',
    preview: {
      background: '#1a1b26',
      foreground: '#a9b1d6',
      primary: '#7aa2f7',
      secondary: '#24283b',
    },
  },
};

// Helper functions
export const getThemeById = (id: ThemeId): ThemeConfig => themes[id];

export const getLightThemes = (): ThemeConfig[] => 
  Object.values(themes).filter(t => t.mode === 'light');

export const getDarkThemes = (): ThemeConfig[] => 
  Object.values(themes).filter(t => t.mode === 'dark');

export const getDefaultTheme = (): ThemeId => 'solarized-dark';

export const getAllThemes = (): ThemeConfig[] => Object.values(themes);
