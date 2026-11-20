import { useMemo } from 'react';
import { useAppSettings } from '../settings/AppSettingsContext';
import { getDesignTokens, type DesignTokens } from './designSystem';

export type DesignSystem = {
  tokens: DesignTokens;
  isDark: boolean;
  direction: 'rtl' | 'ltr';
  isRTL: boolean;
  textAlign: 'right' | 'left';
  rowDirection: 'row' | 'row-reverse';
  writingDirection: 'rtl' | 'ltr';
};

/**
 * Derives GridHand design tokens from the existing app settings.
 *
 * This keeps the current AppSettingsContext API untouched while giving screens
 * a single, direction-aware source for colors, typography, spacing, shadows,
 * and layout values.
 */
export function useDesignTokens(): DesignSystem {
  const { isDark, direction } = useAppSettings();

  return useMemo<DesignSystem>(() => {
    const isRTL = direction === 'rtl';

    return {
      tokens: getDesignTokens(isDark),
      isDark,
      direction,
      isRTL,
      textAlign: isRTL ? 'right' : 'left',
      rowDirection: isRTL ? 'row-reverse' : 'row',
      writingDirection: isRTL ? 'rtl' : 'ltr',
    };
  }, [isDark, direction]);
}

/**
 * Memoized style factory helper.
 *
 * The factory should be defined at module scope so its identity stays stable:
 *
 * const createStyles = (system: DesignSystem) =>
 *   StyleSheet.create({ ... });
 *
 * const styles = useThemedStyles(createStyles);
 */
export function useThemedStyles<T>(factory: (system: DesignSystem) => T): T {
  const system = useDesignTokens();

  return useMemo(() => factory(system), [factory, system]);
}
