import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme } from 'nativewind';

export type ThemeMode = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
};

const STORAGE_KEY = '@theme_mode';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'system') {
    return Appearance.getColorScheme() === 'dark';
  }
  return mode === 'dark';
}

function applyColorScheme(mode: ThemeMode): void {
  // NativeWind accepts 'light' | 'dark' | 'system'.
  colorScheme.set(mode);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isDark, setIsDark] = useState<boolean>(resolveIsDark('system'));

  // Load the persisted theme mode on mount.
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const mode: ThemeMode = isThemeMode(stored) ? stored : 'system';

        if (!mounted) return;

        setThemeModeState(mode);
        applyColorScheme(mode);
        setIsDark(resolveIsDark(mode));
      } catch {
        if (!mounted) return;

        setThemeModeState('system');
        applyColorScheme('system');
        setIsDark(resolveIsDark('system'));
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // When following the system, react to OS appearance changes.
  useEffect(() => {
    if (themeMode !== 'system') return;

    const subscription = Appearance.addChangeListener(({ colorScheme: scheme }) => {
      setIsDark(scheme === 'dark');
    });

    return () => subscription.remove();
  }, [themeMode]);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    applyColorScheme(mode);
    setIsDark(resolveIsDark(mode));

    try {
      await AsyncStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Persistence failures should not break the UI.
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ themeMode, isDark, setThemeMode }),
    [themeMode, isDark, setThemeMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}
