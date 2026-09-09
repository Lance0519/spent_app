import React, { createContext, useContext, useState, useEffect } from 'react';
import tw, { useAppColorScheme } from 'twrnc';
import { getAccentColorFromDB, setAccentColorInDB, getUserProfile, updateUserProfile } from '../db/database';

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
  // Darkened Amber & Cyan in light mode to ensure WCAG AA contrast against light surfaces
  amber: { key: 'amber', name: 'Amber', light: '#D97706', dark: '#FBBF24', swatch: '#D97706' },
  cyan: { key: 'cyan', name: 'Cyan', light: '#0891B2', dark: '#22D3EE', swatch: '#0891B2' },
  rose: { key: 'rose', name: 'Rose', light: '#F43F5E', dark: '#FB7185', swatch: '#F43F5E' },
};

export const SUPPORTED_CURRENCIES: { code: string; symbol: string; name: string }[] = [
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'AU$', name: 'Australian Dollar' },
  { code: 'SGD', symbol: 'SG$', name: 'Singapore Dollar' },
];

export const CURRENCY_SYMBOLS: Record<string, string> = {
  PHP: '₱',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: 'CA$',
  AUD: 'AU$',
  SGD: 'SG$',
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
  currency: string;
  currencySymbol: string;
  formatCurrency: (amount: number, options?: { showSign?: boolean; minimumFractionDigits?: number; maximumFractionDigits?: number }) => string;
  setCurrency: (code: string) => void;
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
  currency: 'PHP',
  currencySymbol: '₱',
  formatCurrency: (val: number) => `₱${val.toFixed(2)}`,
  setCurrency: () => {},
  setAccentColor: () => {},
  toggleDarkMode: () => {},
  setColorScheme: () => {},
});

export const CustomThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [colorScheme, toggleColorScheme, setColorScheme] = useAppColorScheme(tw);
  const isDark = colorScheme === 'dark';
  const [accentKey, setAccentState] = useState<AccentPaletteKey>('emerald');
  const [currency, setCurrencyState] = useState<string>('PHP');

  useEffect(() => {
    try {
      const savedKey = getAccentColorFromDB() as AccentPaletteKey;
      if (savedKey && ACCENT_PALETTES[savedKey]) {
        setAccentState(savedKey);
      }
      const prof = getUserProfile();
      if (prof.currency) {
        setCurrencyState(prof.currency);
      }
    } catch (e) {
      console.warn('Failed to load theme settings:', e);
    }
  }, []);

  const setAccentColor = (key: AccentPaletteKey) => {
    if (!ACCENT_PALETTES[key]) return;
    setAccentState(key);
    setAccentColorInDB(key);
  };

  const setCurrency = (code: string) => {
    setCurrencyState(code);
    try {
      updateUserProfile(undefined, undefined, code);
    } catch (e) {
      console.warn('Failed to save currency to DB:', e);
    }
  };

  const toggleDarkMode = () => {
    toggleColorScheme();
  };

  const activePalette = ACCENT_PALETTES[accentKey] || ACCENT_PALETTES.emerald;
  const accentColor = isDark ? activePalette.dark : activePalette.light;
  const currencySymbol = CURRENCY_SYMBOLS[currency] || '₱';

  const formatCurrency = (
    amount: number,
    options?: { showSign?: boolean; minimumFractionDigits?: number; maximumFractionDigits?: number }
  ) => {
    const minDigits = options?.minimumFractionDigits ?? 2;
    const maxDigits = options?.maximumFractionDigits ?? 2;
    const isNegative = amount < 0;
    const absFormatted = Math.abs(amount).toLocaleString(undefined, {
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
    });
    const sign = options?.showSign ? (isNegative ? '-' : '+') : (isNegative ? '-' : '');
    return `${sign}${currencySymbol}${absFormatted}`;
  };

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
      currency,
      currencySymbol,
      formatCurrency,
      setCurrency,
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

