import React, { createContext, useContext, useState, useEffect } from 'react';
import tw, { useAppColorScheme } from 'twrnc';
import { getAccentColorFromDB, setAccentColorInDB } from '../db/database';

export type AccentPaletteKey = 'emerald' | 'indigo' | 'amber' | 'cyan' | 'rose';

export interface PaletteConfig {
  key: AccentPaletteKey;
  name: string;
  light: string;
  dark: string;
  swatch: string;
}

export const ACCENT_PALETTES: Record<AccentPaletteKey, PaletteConfig> = {
  emerald: { key: 'emerald', name: 'Emerald', light: '#10B981', dark: '#34D399', swatch: '#10B981' },
  indigo: { key: 'indigo', name: 'Electric Indigo', light: '#6366F1', dark: '#818CF8', swatch: '#6366F1' },
  amber: { key: 'amber', name: 'Amber', light: '#F59E0B', dark: '#FBBF24', swatch: '#F59E0B' },
  cyan: { key: 'cyan', name: 'Cyan', light: '#06B6D4', dark: '#22D3EE', swatch: '#06B6D4' },
  rose: { key: 'rose', name: 'Rose', light: '#F43F5E', dark: '#FB7185', swatch: '#F43F5E' },
};

/**
 * Calculates contrast-safe text color for use directly on top of dynamic accent colors
 * using perceived luminance (sRGB / Rec. 709).
 */
export function getContrastTextColor(hexColor: string): '#FFFFFF' | '#000000' {
  const cleanHex = hexColor.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#000000' : '#FFFFFF';
}

export interface ThemeTextTokens {
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnAccent: string;
}

interface ThemeContextType extends ThemeTextTokens {
  accentKey: AccentPaletteKey;
  accentColor: string;
  palette: PaletteConfig;
  isDark: boolean;
  setAccentColor: (key: AccentPaletteKey) => void;
  toggleDarkMode: () => void;
  setColorScheme: (scheme: 'light' | 'dark') => void;
}

const ThemeContext = createContext<ThemeContextType>({
  accentKey: 'emerald',
  accentColor: '#10B981',
  palette: ACCENT_PALETTES.emerald,
  isDark: false,
  textPrimary: '#18181B',
  textSecondary: '#71717A',
  textMuted: '#A1A1AA',
  textOnAccent: '#FFFFFF',
  setAccentColor: () => {},
  toggleDarkMode: () => {},
  setColorScheme: () => {},
});

export const CustomThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [colorScheme, toggleColorScheme, setColorScheme] = useAppColorScheme(tw);
  const isDark = colorScheme === 'dark';
  const [accentKey, setAccentState] = useState<AccentPaletteKey>('emerald');

  useEffect(() => {
    try {
      const savedKey = getAccentColorFromDB() as AccentPaletteKey;
      if (savedKey && ACCENT_PALETTES[savedKey]) {
        setAccentState(savedKey);
      }
    } catch (e) {
      console.warn('Failed to load accent color:', e);
    }
  }, []);

  const setAccentColor = (key: AccentPaletteKey) => {
    if (!ACCENT_PALETTES[key]) return;
    setAccentState(key);
    setAccentColorInDB(key);
  };

  const toggleDarkMode = () => {
    toggleColorScheme();
  };

  const activePalette = ACCENT_PALETTES[accentKey] || ACCENT_PALETTES.emerald;
  const accentColor = isDark ? activePalette.dark : activePalette.light;

  // Semantic dynamic text tokens based on current mode (isDark)
  const textPrimary = isDark ? '#FFFFFF' : '#18181B';
  const textSecondary = isDark ? '#A1A1AA' : '#71717A';
  const textMuted = isDark ? '#71717A' : '#A1A1AA';
  const textOnAccent = getContrastTextColor(accentColor);

  return (
    <ThemeContext.Provider value={{ 
      accentKey, 
      accentColor, 
      palette: activePalette, 
      isDark,
      textPrimary,
      textSecondary,
      textMuted,
      textOnAccent,
      setAccentColor, 
      toggleDarkMode,
      setColorScheme
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
