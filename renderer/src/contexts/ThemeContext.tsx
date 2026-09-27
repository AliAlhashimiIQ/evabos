import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'dark' | 'light';

export interface DarkTonePreset {
  id: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  bgPrimary: string;
  bgSecondary: string;
  bgCard: string;
  bgInput: string;
  borderColor: string;
}

export const DARK_TONE_PRESETS: DarkTonePreset[] = [
  {
    id: 'anti-glare-slate',
    nameAr: 'رمادي إردوازي (مضاد للانعكاس)',
    nameEn: 'Slate Anti-Glare',
    descAr: 'أفضل تباين للشاشات اللامعة والعاكسة في المتاجر الساطعة',
    bgPrimary: '#1e293b',
    bgSecondary: '#0f172a',
    bgCard: '#334155',
    bgInput: '#1e293b',
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  {
    id: 'charcoal-graphite',
    nameAr: 'رمادي فحمي (Charcoal)',
    nameEn: 'Charcoal Graphite',
    descAr: 'رمادي ناعم هادئ مريح للعين بدون انعكاسات مزعجة',
    bgPrimary: '#18181b',
    bgSecondary: '#121215',
    bgCard: '#27272a',
    bgInput: '#1c1c20',
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  {
    id: 'deep-navy',
    nameAr: 'كحلي ناصع (Deep Navy)',
    nameEn: 'Deep Navy (Default)',
    descAr: 'كحلي عصري راقٍ ومتوازن',
    bgPrimary: '#0f172a',
    bgSecondary: '#131c31',
    bgCard: '#1e293b',
    bgInput: '#151f33',
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  {
    id: 'soft-dark',
    nameAr: 'رمادي ليلي دافئ (Soft Dark)',
    nameEn: 'Soft Night',
    descAr: 'درجة داكنة معتدلة تمنع إجهاد العين',
    bgPrimary: '#21262d',
    bgSecondary: '#161b22',
    bgCard: '#30363d',
    bgInput: '#1c2128',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  {
    id: 'oled-black',
    nameAr: 'أسود عميق (OLED Black)',
    nameEn: 'OLED Pure Black',
    descAr: 'تباين فائق لشاشات OLED عالية الدقة',
    bgPrimary: '#000000',
    bgSecondary: '#0a0a0a',
    bgCard: '#171717',
    bgInput: '#0d0d0d',
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
];

export const ACCENT_COLOR_PRESETS = [
  { id: 'royal-blue', label: 'أزرق ملكي (Royal Blue)', value: '#3b82f6' },
  { id: 'electric-cobalt', label: 'كوبالت (Cobalt)', value: '#2563eb' },
  { id: 'emerald', label: 'أخضر زمردي (Emerald)', value: '#10b981' },
  { id: 'royal-purple', label: 'بنفسجي ملكي (Violet)', value: '#8b5cf6' },
  { id: 'amber', label: 'عنبري / ذهبي (Amber)', value: '#f59e0b' },
  { id: 'rose', label: 'ياقوتي (Rose)', value: '#f43f5e' },
  { id: 'cyan', label: 'تركواز سماوي (Cyan)', value: '#06b6d4' },
  { id: 'crimson', label: 'أحمر قرمزي (Crimson)', value: '#ef4444' },
];

export const DEFAULT_DARK_TONE_ID = 'anti-glare-slate';
export const DEFAULT_ACCENT_COLOR = '#3b82f6';

function adjustHex(hex: string, percent: number): string {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length !== 6) return hex;
  const num = parseInt(cleanHex, 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amt));
  const B = Math.min(255, Math.max(0, (num & 0xff) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  darkToneId: string;
  setDarkToneId: (presetId: string) => void;
  customDarkBg: string;
  setCustomDarkBg: (color: string) => void;
  resetDarkTheme: () => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
  resetAccentColor: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [darkToneId, setDarkToneIdState] = useState<string>(DEFAULT_DARK_TONE_ID);
  const [customDarkBg, setCustomDarkBgState] = useState<string>('#1e293b');
  const [accentColor, setAccentColorState] = useState<string>(DEFAULT_ACCENT_COLOR);

  const applyAccentColor = (color: string) => {
    document.documentElement.style.setProperty('--accent-primary', color);
    const hex = color.replace('#', '');
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      document.documentElement.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.35)`);
    }
  };

  const applyDarkTone = (toneId: string, customBg?: string) => {
    // Only apply custom dark variables if in dark mode
    const currentTheme = document.documentElement.getAttribute('data-theme') || theme;
    if (currentTheme !== 'dark') return;

    if (toneId === 'custom' && customBg && customBg.startsWith('#') && customBg.length === 7) {
      document.documentElement.style.setProperty('--bg-primary', customBg);
      document.documentElement.style.setProperty('--bg-secondary', adjustHex(customBg, -8));
      document.documentElement.style.setProperty('--bg-tertiary', adjustHex(customBg, 6));
      document.documentElement.style.setProperty('--bg-card', adjustHex(customBg, 12));
      document.documentElement.style.setProperty('--bg-input', adjustHex(customBg, -4));
      document.documentElement.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.16)');
      document.documentElement.style.setProperty('--border-light', 'rgba(255, 255, 255, 0.09)');
      return;
    }

    const preset = DARK_TONE_PRESETS.find((p) => p.id === toneId) || DARK_TONE_PRESETS[0];
    document.documentElement.style.setProperty('--bg-primary', preset.bgPrimary);
    document.documentElement.style.setProperty('--bg-secondary', preset.bgSecondary);
    document.documentElement.style.setProperty('--bg-tertiary', adjustHex(preset.bgPrimary, 5));
    document.documentElement.style.setProperty('--bg-card', preset.bgCard);
    document.documentElement.style.setProperty('--bg-input', preset.bgInput);
    document.documentElement.style.setProperty('--border-color', preset.borderColor);
    document.documentElement.style.setProperty('--border-light', 'rgba(255, 255, 255, 0.08)');
  };

  const clearDarkCustomOverrides = () => {
    document.documentElement.style.removeProperty('--bg-primary');
    document.documentElement.style.removeProperty('--bg-secondary');
    document.documentElement.style.removeProperty('--bg-tertiary');
    document.documentElement.style.removeProperty('--bg-card');
    document.documentElement.style.removeProperty('--bg-input');
    document.documentElement.style.removeProperty('--border-color');
    document.documentElement.style.removeProperty('--border-light');
  };

  // Load on mount
  useEffect(() => {
    const savedTheme = (localStorage.getItem('appTheme') as Theme) || 'dark';
    setThemeState(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    const savedTone = localStorage.getItem('appDarkTone') || DEFAULT_DARK_TONE_ID;
    setDarkToneIdState(savedTone);

    const savedCustomBg = localStorage.getItem('appCustomDarkBg') || '#1e293b';
    setCustomDarkBgState(savedCustomBg);

    if (savedTheme === 'dark') {
      applyDarkTone(savedTone, savedCustomBg);
    }

    const savedAccent = localStorage.getItem('appAccentColor') || DEFAULT_ACCENT_COLOR;
    setAccentColorState(savedAccent);
    applyAccentColor(savedAccent);
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('appTheme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);

    if (newTheme === 'dark') {
      applyDarkTone(darkToneId, customDarkBg);
    } else {
      clearDarkCustomOverrides();
    }
    applyAccentColor(accentColor);
  };

  const setDarkToneId = (presetId: string) => {
    setDarkToneIdState(presetId);
    localStorage.setItem('appDarkTone', presetId);
    if (theme === 'dark') {
      applyDarkTone(presetId, customDarkBg);
    }
  };

  const setCustomDarkBg = (color: string) => {
    setCustomDarkBgState(color);
    setDarkToneIdState('custom');
    localStorage.setItem('appCustomDarkBg', color);
    localStorage.setItem('appDarkTone', 'custom');
    if (theme === 'dark') {
      applyDarkTone('custom', color);
    }
  };

  const resetDarkTheme = () => {
    setDarkToneIdState(DEFAULT_DARK_TONE_ID);
    localStorage.setItem('appDarkTone', DEFAULT_DARK_TONE_ID);
    localStorage.removeItem('appCustomDarkBg');
    if (theme === 'dark') {
      applyDarkTone(DEFAULT_DARK_TONE_ID);
    }
  };

  const setAccentColor = (newColor: string) => {
    setAccentColorState(newColor);
    localStorage.setItem('appAccentColor', newColor);
    applyAccentColor(newColor);
  };

  const resetAccentColor = () => {
    setAccentColorState(DEFAULT_ACCENT_COLOR);
    localStorage.removeItem('appAccentColor');
    applyAccentColor(DEFAULT_ACCENT_COLOR);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        darkToneId,
        setDarkToneId,
        customDarkBg,
        setCustomDarkBg,
        resetDarkTheme,
        accentColor,
        setAccentColor,
        resetAccentColor,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
