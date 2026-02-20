
export type ThemeId = 'original' | 'midnight' | 'forest' | 'crimson' | 'daylight' | 'sunset' | 'noir' | 'zen' | 'abyss' | 'solar';

export interface Theme {
  id: ThemeId;
  name: string;
  colors: {
    primary: string;
    onPrimary: string; // New: Color for text/icons ON TOP of primary
    secondary: string;
    darker: string;
    dark: string;
    surface: string;
    textMain: string;
    textMuted: string;
  };
}

export const themes: Theme[] = [
  {
    id: 'original',
    name: 'SoulSync Original',
    colors: {
      primary: '#6366f1', 
      onPrimary: '#ffffff', // White text on Indigo
      secondary: '#a855f7',
      darker: '#020617',
      dark: '#0f172a',
      surface: '#1e293b',
      textMain: '#f8fafc',
      textMuted: '#94a3b8'
    }
  },
  {
    id: 'midnight',
    name: 'Midnight Blue',
    colors: {
      primary: '#38bdf8',
      onPrimary: '#000000', // Black text on bright Sky Blue
      secondary: '#2563eb',
      darker: '#000000',
      dark: '#0c0a09',
      surface: '#171717',
      textMain: '#f8fafc',
      textMuted: '#64748b'
    }
  },
  {
    id: 'forest',
    name: 'Neon Forest',
    colors: {
      primary: '#10b981',
      onPrimary: '#000000', // Black text on Emerald
      secondary: '#a3e635',
      darker: '#052e16',
      dark: '#064e3b',
      surface: '#065f46',
      textMain: '#ecfccb',
      textMuted: '#6ee7b7'
    }
  },
  {
    id: 'crimson',
    name: 'Cyber Samurai',
    colors: {
      primary: '#f43f5e',
      onPrimary: '#ffffff',
      secondary: '#f59e0b',
      darker: '#1f040b',
      dark: '#2c0612', 
      surface: '#4c0519',
      textMain: '#ffe4e6',
      textMuted: '#fda4af'
    }
  },
  {
    id: 'daylight',
    name: 'Clean Day',
    colors: {
      primary: '#4f46e5',
      onPrimary: '#ffffff',
      secondary: '#9333ea',
      darker: '#f8fafc',
      dark: '#f1f5f9',
      surface: '#ffffff',
      textMain: '#0f172a',
      textMuted: '#475569'
    }
  },
  {
    id: 'sunset',
    name: 'Sunset Drive',
    colors: {
      primary: '#f472b6',
      onPrimary: '#000000', // Black text on Pink
      secondary: '#22d3ee',
      darker: '#2e1065',
      dark: '#4c1d95',
      surface: '#5b21b6',
      textMain: '#fae8ff',
      textMuted: '#c084fc'
    }
  },
  {
    id: 'noir',
    name: 'Noir Monochrome',
    colors: {
      primary: '#ffffff', 
      onPrimary: '#000000', // Black text on White button
      secondary: '#a3a3a3',
      darker: '#000000',
      dark: '#0a0a0a',
      surface: '#171717',
      textMain: '#ffffff',
      textMuted: '#737373'
    }
  },
  {
    id: 'zen',
    name: 'Zen Garden',
    colors: {
      primary: '#84cc16',
      onPrimary: '#000000',
      secondary: '#14b8a6',
      darker: '#1c1917',
      dark: '#292524',
      surface: '#44403c',
      textMain: '#f5f5f4',
      textMuted: '#a8a29e'
    }
  },
  {
    id: 'abyss',
    name: 'Deep Abyss',
    colors: {
      primary: '#2dd4bf',
      onPrimary: '#000000',
      secondary: '#38bdf8',
      darker: '#082f49',
      dark: '#0c4a6e',
      surface: '#075985',
      textMain: '#f0f9ff', 
      textMuted: '#7dd3fc'
    }
  },
  {
    id: 'solar',
    name: 'Solar Flare',
    colors: {
      primary: '#fb923c',
      onPrimary: '#000000',
      secondary: '#facc15',
      darker: '#450a0a',
      dark: '#7f1d1d',
      surface: '#991b1b',
      textMain: '#fff7ed', 
      textMuted: '#fdba74'
    }
  }
];

const STORAGE_KEY = 'soulsync_theme_pref';

export const applyTheme = (themeId: ThemeId) => {
    const theme = themes.find(t => t.id === themeId) || themes[0];
    const root = document.documentElement;

    root.style.setProperty('--color-primary', theme.colors.primary);
    root.style.setProperty('--color-on-primary', theme.colors.onPrimary); // Set the contrast color
    root.style.setProperty('--color-secondary', theme.colors.secondary);
    root.style.setProperty('--color-bg-darker', theme.colors.darker);
    root.style.setProperty('--color-bg-dark', theme.colors.dark);
    root.style.setProperty('--color-bg-surface', theme.colors.surface);
    root.style.setProperty('--color-text-main', theme.colors.textMain);
    root.style.setProperty('--color-text-muted', theme.colors.textMuted);

    // Update meta theme color for browser chrome
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.colors.darker);

    localStorage.setItem(STORAGE_KEY, themeId);
};

export const getSavedTheme = (): ThemeId => {
    return (localStorage.getItem(STORAGE_KEY) as ThemeId) || 'original';
};
