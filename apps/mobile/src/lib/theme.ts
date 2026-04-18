/**
 * Light/Dark palette + helper to produce a React Navigation theme.
 *
 * J1.10: extend `palette` for screen-level styling. Don't import RN style
 * objects from screens directly — derive from `useTheme()` instead so dark
 * mode follows `useColorScheme()`.
 */
import { useColorScheme } from 'react-native';
import {
  DarkTheme as NavDark,
  DefaultTheme as NavLight,
  type Theme as NavTheme,
} from '@react-navigation/native';

export interface Palette {
  background: string;
  card: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  danger: string;
}

export const lightPalette: Palette = {
  background: '#ffffff',
  card: '#f5f5f7',
  text: '#0b0b0c',
  textMuted: '#5b5b66',
  border: '#e3e3e8',
  primary: '#2f6feb',
  danger: '#d9384b',
};

export const darkPalette: Palette = {
  background: '#0b0b0c',
  card: '#17171a',
  text: '#f5f5f7',
  textMuted: '#9a9aa6',
  border: '#26262c',
  primary: '#5e90ff',
  danger: '#ff5d70',
};

export function navigationTheme(isDark: boolean): NavTheme {
  const p = isDark ? darkPalette : lightPalette;
  const base = isDark ? NavDark : NavLight;
  return {
    ...base,
    colors: {
      ...base.colors,
      background: p.background,
      card: p.card,
      text: p.text,
      border: p.border,
      primary: p.primary,
      notification: p.primary,
    },
  };
}

export function useTheme(): { palette: Palette; isDark: boolean } {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return { palette: isDark ? darkPalette : lightPalette, isDark };
}
