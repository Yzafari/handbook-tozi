import type { TextStyle, ViewStyle } from 'react-native';

/**
 * GridHand design system.
 *
 * This module is additive and intentionally does not change the existing
 * AppSettingsContext API. Consumers should derive tokens through
 * `useDesignTokens()` so light/dark mode and RTL/LTR direction stay in sync
 * with the existing app settings.
 *
 * Localization note:
 * - Typography tokens intentionally avoid `letterSpacing` and `textTransform`.
 *   Both can break cursive joining in Persian and Kurdish text.
 * - Direction-aware layout values are exposed by `useDesignTokens()`.
 */

export type DesignColorScheme = 'light' | 'dark';

export type ThemeColors = {
  // Brand
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  accent: string;
  accentPressed: string;
  accentSoft: string;

  // Surfaces
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  overlay: string;

  // Borders
  border: string;
  borderStrong: string;
  borderFocus: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  textOnPrimary: string;
  textOnAccent: string;

  // Semantic
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerPressed: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;

  // Utility
  shadow: string;
  skeleton: string;
  disabled: string;
  disabledText: string;
};

const lightColors: ThemeColors = {
  primary: '#0077C8',
  primaryPressed: '#005EA6',
  primarySoft: '#E6F2FB',
  accent: '#008957',
  accentPressed: '#006B45',
  accentSoft: '#E5F3EC',

  background: '#F4F7FA',
  backgroundAlt: '#EEF3F7',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#F8FAFC',
  overlay: 'rgba(15, 23, 42, 0.45)',

  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  borderFocus: '#0077C8',

  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',
  textOnPrimary: '#FFFFFF',
  textOnAccent: '#FFFFFF',

  success: '#0E9F6E',
  successSoft: '#E6F7F0',
  warning: '#D97706',
  warningSoft: '#FEF3E2',
  danger: '#DC2626',
  dangerPressed: '#B91C1C',
  dangerSoft: '#FEE2E2',
  info: '#0284C7',
  infoSoft: '#E0F2FE',

  shadow: '#0F172A',
  skeleton: '#E2E8F0',
  disabled: '#E2E8F0',
  disabledText: '#94A3B8',
};

const darkColors: ThemeColors = {
  primary: '#3B9EFF',
  primaryPressed: '#2B8AE6',
  primarySoft: '#102A43',
  accent: '#2ECC8F',
  accentPressed: '#25B37C',
  accentSoft: '#0F2A22',

  background: '#0B0F14',
  backgroundAlt: '#0E131A',
  surface: '#151A21',
  surfaceElevated: '#1B222B',
  surfaceMuted: '#11161D',
  overlay: 'rgba(0, 0, 0, 0.6)',

  border: '#2A333F',
  borderStrong: '#3A4553',
  borderFocus: '#3B9EFF',

  textPrimary: '#F2F5F8',
  textSecondary: '#A9B4C0',
  textMuted: '#7C8794',
  textInverse: '#0B0F14',
  textOnPrimary: '#04121F',
  textOnAccent: '#04140E',

  success: '#34D399',
  successSoft: '#0F2A22',
  warning: '#FBBF24',
  warningSoft: '#2A2110',
  danger: '#F87171',
  dangerPressed: '#EF4444',
  dangerSoft: '#2A1414',
  info: '#38BDF8',
  infoSoft: '#0B2533',

  shadow: '#000000',
  skeleton: '#2A333F',
  disabled: '#2A333F',
  disabledText: '#7C8794',
};

export type TypographyVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'title'
  | 'subtitle'
  | 'body'
  | 'bodyStrong'
  | 'small'
  | 'smallStrong'
  | 'caption'
  | 'overline'
  | 'button'
  | 'numeric';

const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;

export const typography: Record<TypographyVariant, TextStyle> = {
  display: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: fontWeights.extrabold,
  },
  h1: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: fontWeights.extrabold,
  },
  h2: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: fontWeights.bold,
  },
  h3: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: fontWeights.bold,
  },
  title: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: fontWeights.bold,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: fontWeights.semibold,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: fontWeights.regular,
  },
  bodyStrong: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: fontWeights.semibold,
  },
  small: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: fontWeights.regular,
  },
  smallStrong: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: fontWeights.semibold,
  },
  caption: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: fontWeights.medium,
  },
  overline: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: fontWeights.bold,
  },
  button: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: fontWeights.bold,
  },
  numeric: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: fontWeights.extrabold,
    fontVariant: ['tabular-nums'],
  },
};

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 48,
  colossal: 64,
} as const;

export const radii = {
  none: 0,
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
  pill: 999,
} as const;

export const iconSizes = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  xxl: 32,
  display: 40,
} as const;

export const layout = {
  screenPadding: 16,
  sectionGap: 24,
  cardPadding: 16,
  cardGap: 12,
  headerHeight: 56,
  tabBarHeight: 64,
  maxContentWidth: 720,
  minTouchTarget: 44,
  hitSlop: 8,
  borderWidth: 1,
  focusRingWidth: 2,
} as const;

export const opacity = {
  disabled: 0.5,
  muted: 0.7,
  pressed: 0.85,
  overlay: 0.45,
} as const;

export const zIndex = {
  base: 0,
  card: 1,
  sticky: 10,
  header: 20,
  overlay: 30,
  modal: 40,
  toast: 50,
} as const;

export const motion = {
  fast: 120,
  normal: 200,
  slow: 320,
} as const;

export type ShadowLevel = 'none' | 'sm' | 'md' | 'lg' | 'xl';

export type ShadowToken = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

const lightShadows: Record<ShadowLevel, ShadowToken> = {
  none: {},
  sm: {
    shadowColor: lightColors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: lightColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: lightColors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  xl: {
    shadowColor: lightColors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 10,
  },
};

const darkShadows: Record<ShadowLevel, ShadowToken> = {
  none: {},
  sm: {
    shadowColor: darkColors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: darkColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: darkColors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  xl: {
    shadowColor: darkColors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 10,
  },
};

export type DesignTokens = {
  scheme: DesignColorScheme;
  colors: ThemeColors;
  typography: Record<TypographyVariant, TextStyle>;
  spacing: typeof spacing;
  radii: typeof radii;
  iconSizes: typeof iconSizes;
  layout: typeof layout;
  shadows: Record<ShadowLevel, ShadowToken>;
  opacity: typeof opacity;
  zIndex: typeof zIndex;
  motion: typeof motion;
};

export const lightTokens: DesignTokens = {
  scheme: 'light',
  colors: lightColors,
  typography,
  spacing,
  radii,
  iconSizes,
  layout,
  shadows: lightShadows,
  opacity,
  zIndex,
  motion,
};

export const darkTokens: DesignTokens = {
  scheme: 'dark',
  colors: darkColors,
  typography,
  spacing,
  radii,
  iconSizes,
  layout,
  shadows: darkShadows,
  opacity,
  zIndex,
  motion,
};

export function getDesignTokens(isDark: boolean): DesignTokens {
  return isDark ? darkTokens : lightTokens;
}

export type CardVariant = 'default' | 'elevated' | 'outlined' | 'filled' | 'accent';

export function getCardStyle(
  tokens: DesignTokens,
  variant: CardVariant = 'default'
): ViewStyle {
  const base: ViewStyle = {
    borderRadius: tokens.radii.lg,
    padding: tokens.layout.cardPadding,
  };

  switch (variant) {
    case 'elevated':
      return {
        ...base,
        backgroundColor: tokens.colors.surfaceElevated,
        ...tokens.shadows.md,
      };
    case 'outlined':
      return {
        ...base,
        backgroundColor: 'transparent',
        borderWidth: tokens.layout.borderWidth,
        borderColor: tokens.colors.borderStrong,
      };
    case 'filled':
      return {
        ...base,
        backgroundColor: tokens.colors.surfaceMuted,
      };
    case 'accent':
      return {
        ...base,
        backgroundColor: tokens.colors.accentSoft,
        borderWidth: tokens.layout.borderWidth,
        borderColor: tokens.colors.accent,
      };
    case 'default':
    default:
      return {
        ...base,
        backgroundColor: tokens.colors.surface,
        borderWidth: tokens.layout.borderWidth,
        borderColor: tokens.colors.border,
        ...tokens.shadows.sm,
      };
  }
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonStyleSet = {
  container: ViewStyle;
  pressedContainer: ViewStyle;
  label: TextStyle;
  pressedLabel: TextStyle;
  iconColor: string;
};

export type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  direction?: 'rtl' | 'ltr';
};

const buttonHeights: Record<ButtonSize, number> = {
  sm: 36,
  md: 44,
  lg: 52,
};

const buttonPadding: Record<ButtonSize, number> = {
  sm: 12,
  md: 16,
  lg: 20,
};

const buttonLabelVariant: Record<ButtonSize, TypographyVariant> = {
  sm: 'smallStrong',
  md: 'button',
  lg: 'title',
};

export function getButtonStyle(
  tokens: DesignTokens,
  options: ButtonStyleOptions = {}
): ButtonStyleSet {
  const { variant = 'primary', size = 'md', direction = 'rtl' } = options;

  const base: ViewStyle = {
    minHeight: buttonHeights[size],
    paddingHorizontal: buttonPadding[size],
    borderRadius: tokens.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: direction === 'rtl' ? 'row-reverse' : 'row',
    gap: tokens.spacing.sm,
  };

  const label: TextStyle = {
    ...tokens.typography[buttonLabelVariant[size]],
    textAlign: 'center',
  };

  switch (variant) {
    case 'secondary':
      return {
        container: {
          ...base,
          backgroundColor: tokens.colors.surface,
          borderWidth: tokens.layout.borderWidth,
          borderColor: tokens.colors.borderStrong,
        },
        pressedContainer: {
          ...base,
          backgroundColor: tokens.colors.surfaceMuted,
          borderWidth: tokens.layout.borderWidth,
          borderColor: tokens.colors.borderStrong,
        },
        label: { ...label, color: tokens.colors.textPrimary },
        pressedLabel: { ...label, color: tokens.colors.textPrimary },
        iconColor: tokens.colors.textPrimary,
      };
    case 'ghost':
      return {
        container: {
          ...base,
          backgroundColor: 'transparent',
        },
        pressedContainer: {
          ...base,
          backgroundColor: tokens.colors.primarySoft,
        },
        label: { ...label, color: tokens.colors.primary },
        pressedLabel: { ...label, color: tokens.colors.primaryPressed },
        iconColor: tokens.colors.primary,
      };
    case 'danger':
      return {
        container: {
          ...base,
          backgroundColor: tokens.colors.danger,
        },
        pressedContainer: {
          ...base,
          backgroundColor: tokens.colors.dangerPressed,
        },
        label: { ...label, color: tokens.colors.textInverse },
        pressedLabel: { ...label, color: tokens.colors.textInverse },
        iconColor: tokens.colors.textInverse,
      };
    case 'accent':
      return {
        container: {
          ...base,
          backgroundColor: tokens.colors.accent,
        },
        pressedContainer: {
          ...base,
          backgroundColor: tokens.colors.accentPressed,
        },
        label: { ...label, color: tokens.colors.textOnAccent },
        pressedLabel: { ...label, color: tokens.colors.textOnAccent },
        iconColor: tokens.colors.textOnAccent,
      };
    case 'primary':
    default:
      return {
        container: {
          ...base,
          backgroundColor: tokens.colors.primary,
        },
        pressedContainer: {
          ...base,
          backgroundColor: tokens.colors.primaryPressed,
        },
        label: { ...label, color: tokens.colors.textOnPrimary },
        pressedLabel: { ...label, color: tokens.colors.textOnPrimary },
        iconColor: tokens.colors.textOnPrimary,
      };
  }
}

export type IconButtonVariant = 'ghost' | 'soft' | 'solid' | 'outline';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export type IconButtonStyleSet = {
  container: ViewStyle;
  pressedContainer: ViewStyle;
  iconColor: string;
};

export type IconButtonStyleOptions = {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
};

const iconButtonSizes: Record<IconButtonSize, number> = {
  sm: 32,
  md: 40,
  lg: 48,
};

export function getIconButtonStyle(
  tokens: DesignTokens,
  options: IconButtonStyleOptions = {}
): IconButtonStyleSet {
  const { variant = 'ghost', size = 'md' } = options;

  const dimension = iconButtonSizes[size];

  const base: ViewStyle = {
    width: dimension,
    height: dimension,
    borderRadius: tokens.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  };

  switch (variant) {
    case 'soft':
      return {
        container: {
          ...base,
          backgroundColor: tokens.colors.primarySoft,
        },
        pressedContainer: {
          ...base,
          backgroundColor: tokens.colors.primarySoft,
          opacity: tokens.opacity.pressed,
        },
        iconColor: tokens.colors.primary,
      };
    case 'solid':
      return {
        container: {
          ...base,
          backgroundColor: tokens.colors.primary,
        },
        pressedContainer: {
          ...base,
          backgroundColor: tokens.colors.primaryPressed,
        },
        iconColor: tokens.colors.textOnPrimary,
      };
    case 'outline':
      return {
        container: {
          ...base,
          backgroundColor: 'transparent',
          borderWidth: tokens.layout.borderWidth,
          borderColor: tokens.colors.borderStrong,
        },
        pressedContainer: {
          ...base,
          backgroundColor: tokens.colors.surfaceMuted,
          borderWidth: tokens.layout.borderWidth,
          borderColor: tokens.colors.borderStrong,
        },
        iconColor: tokens.colors.textPrimary,
      };
    case 'ghost':
    default:
      return {
        container: {
          ...base,
          backgroundColor: 'transparent',
        },
        pressedContainer: {
          ...base,
          backgroundColor: tokens.colors.surfaceMuted,
        },
        iconColor: tokens.colors.textPrimary,
      };
  }
}
