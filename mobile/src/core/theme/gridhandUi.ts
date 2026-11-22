import type { ImageSourcePropType } from 'react-native';

export type Ui = {
  bg: string; surface: string; surfaceAlt: string; border: string;
  text: string; muted: string; accent: string; accentSoft: string;
  blue: string; volt: string; danger: string; dangerSoft: string;
};

const light: Ui = {
  bg: '#F1F5FA', surface: '#FFFFFF', surfaceAlt: '#E8EFF7', border: '#DCE5EF',
  text: '#0A1B2E', muted: '#587089', accent: '#00A36C', accentSoft: 'rgba(0,163,108,0.12)',
  blue: '#0A6CD6', volt: '#F5A300', danger: '#C62828', dangerSoft: 'rgba(198,40,40,0.10)',
};
const dark: Ui = {
  bg: '#07121F', surface: '#0E2036', surfaceAlt: '#132A45', border: '#1E3A5C',
  text: '#EAF2FB', muted: '#8FA6BE', accent: '#18D68C', accentSoft: 'rgba(24,214,140,0.14)',
  blue: '#3B9EFF', volt: '#FFC21A', danger: '#FF8A80', dangerSoft: 'rgba(255,138,128,0.14)',
};

export const getUi = (isDark: boolean): Ui => (isDark ? dark : light);

/** هدر و نمایشگر ماشین‌حساب در هر دو تم تیره‌اند */
export const NAVY: [string, string] = ['#06152B', '#0B2F63'];

type PhotoKey = 'hero' | 'engineering' | 'safety' | 'taghiz' | 'notebook' | 'ghabz' | 'login' |;

/**
 * بعد از ساخت هر عکس، null را با require جایگزین کنید. مثال:
 * hero: require('../../../assets/photos/hero.jpg'),
 */
export const photos: Record<PhotoKey, ImageSourcePropType | null> = {
  hero: require,
  engineering: require,
  safety: require,
  forms: require,
  notebook: require,
  ghabz: require,
  login: require
};
