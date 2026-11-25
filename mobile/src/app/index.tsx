import React, { useMemo } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BookOpen, Briefcase, Calculator, Camera, ClipboardList, CreditCard, Gavel, Headset,
  MessageCircle, Network, Receipt, Search, ShieldCheck, Store, TowerControl, Users, Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { getHomeModules, type AppModule } from '../core/modules/registry';
import { useAppSettings } from '../core/settings/AppSettingsContext';
import { useDesignTokens } from '../core/theme/useDesignTokens';
import { getJobRoleAvatar } from '../core/localization/labels';
import { useAuth } from '../core/auth/AuthContext';
import { getUi, NAVY, photos, type Ui } from '../core/theme/gridhandUi';

const modules = getHomeModules();

type Meta = { icon: LucideIcon; tint: string; grad: [string, string]; photo: keyof typeof photos | null };
const META: Record<string, Meta> = {
  'bill-payment': { icon: CreditCard, tint: '#3B9EFF', grad: ['#0B3D91', '#1D6FE0'], photo: 'ghabz' },
  'bill-calculator': { icon: Receipt, tint: '#18D68C', grad: ['#0B5C4A', '#14A877'], photo: 'taghiz' },
  engineering: { icon: Calculator, tint: '#FFC21A', grad: ['#16345C', '#2A5A9A'], photo: 'engineering' },
  safety: { icon: ShieldCheck, tint: '#18D68C', grad: ['#0B5C4A', '#14A877'], photo: 'safety' },
  project: { icon: ClipboardList, tint: '#B79CFF', grad: ['#3B2A7A', '#6A4FD0'], photo: 'project' },
  notebook: { icon: BookOpen, tint: '#3B9EFF', grad: ['#0B3D91', '#1D6FE0'], photo: 'notebook' },
};
const FALLBACK: Meta = { icon: Zap, tint: '#FFC21A', grad: ['#16345C', '#2A5A9A'], photo: null };

const QUICK: { key: string; icon: LucideIcon }[] = [
  { key: 'quickTender', icon: Gavel }, { key: 'quickMarket', icon: Store }, { key: 'quickJobs', icon: Briefcase },
];
const DEPTS: { key: string; icon: LucideIcon }[] = [
  { key: 'operations', icon: TowerControl }, { key: 'engineeringPlanning', icon: Network },
  { key: 'sales', icon: Users }, { key: 'consultant', icon: Headset },
];

function Backdrop({ photo, colors, style, children }: {
  photo: (typeof photos)[keyof typeof photos]; colors: [string, string]; style: ViewStyle | ViewStyle[]; children: React.ReactNode;
}) {
  if (photo) return <ImageBackground source={photo} resizeMode="cover" style={style}>{children}</ImageBackground>;
  return <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>{children}</LinearGradient>;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useAppSettings();
  const { isDark, isRTL, rowDirection, textAlign } = useDesignTokens();
  const ui = getUi(isDark);
  const s = useMemo(() => createStyles(ui, rowDirection, textAlign), [ui, rowDirection, textAlign]);

  const moduleKeys: Record<string, Parameters<typeof t>[0]> = { 'bill-payment': 'ghabz', 'bill-calculator': 'taghiz', engineering: 'engineering', safety: 'safety', project: 'project', notebook: 'notebookModule' };
  const moduleLabel = (item: Readonly<AppModule>): string => {
    const key = moduleKeys[item.id];
    if (!key) return item.label;
    const translated: unknown = t(key);
    return typeof translated === 'string' && translated.trim().length > 0 ? translated : item.label;
  };
  const isLive = (m: Readonly<AppModule>) => m.status === 'active' && !!m.route;
  const sorted = [...modules].sort((a, b) => Number(isLive(b)) - Number(isLive(a)));
  const headline = user?.name ? t('greetingWithName', { name: user.name }) : t('greeting');

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <Backdrop photo={photos.hero} colors={NAVY} style={[s.hero, { paddingTop: insets.top + 14 }]}>
          <LinearGradient colors={['rgba(6,21,43,0.45)', 'rgba(6,21,43,0.96)']} style={StyleSheet.absoluteFill} />
          <View style={s.heroRow}>
            <View style={s.brandRow}>
              <View style={s.brandChip}><Zap size={18} color="#04121F" fill="#04121F" /></View>
              <Text style={s.brandName}>{t('appName')}</Text>
            </View>
            <Pressable style={s.avatar} onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel={t('profile' as Parameters<typeof t>[0])}>
              <Text style={s.avatarText}>{getJobRoleAvatar(user?.jobRole)}</Text>
            </Pressable>
          </View>
          <Text style={s.headline}>{headline}</Text>
        </Backdrop>

        <Pressable style={s.search} onPress={() => router.push('/search')} accessibilityRole="search">
          <Search size={20} color={ui.muted} />
          <Text style={s.searchText} numberOfLines={1}>{t('searchPlaceholder')}</Text>
          <Pressable style={s.cameraBtn} onPress={() => router.push('/camera')} accessibilityLabel={t('camera')} hitSlop={8}>
            <Camera size={18} color={ui.accent} />
          </Pressable>
        </Pressable>

        <View style={s.pad}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>{t('modules')}</Text>
            <Text style={s.sectionHint}>{t('modulesHint')}</Text>
          </View>
          <View style={s.grid}>
            {sorted.map((item) => {
              const meta = META[item.id] ?? FALLBACK;
              const live = isLive(item);
              const Icon = meta.icon;
              return (
                <Pressable key={item.id} disabled={!live} style={[s.tileWrap, !live && { opacity: 0.72 }]}
                  onPress={() => router.push(item.route as Href)} accessibilityRole="button" accessibilityLabel={moduleLabel(item)}>
                  <Backdrop photo={meta.photo ? photos[meta.photo] : null} colors={meta.grad} style={s.tile}>
                    <LinearGradient colors={['rgba(4,14,28,0.05)', 'rgba(4,14,28,0.9)']} style={StyleSheet.absoluteFill} />
                    <View style={s.tileTop}>
                      <View style={[s.chip, { backgroundColor: meta.tint }]}><Icon size={18} color="#04121F" /></View>
                      {!live && <View style={s.soon}><Text style={s.soonText}>{t('comingSoon')}</Text></View>}
                    </View>
                    <Text style={s.tileLabel} numberOfLines={2}>{moduleLabel(item)}</Text>
                  </Backdrop>
                </Pressable>
              );
            })}
          </View>

          <View style={s.card}>
            <View style={s.cardHead}>
              <View style={s.iconBox}><MessageCircle size={20} color={ui.accent} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{t('chat')}</Text>
                <Text style={s.cardSub}>{t('chatSubtitle')}</Text>
              </View>
              <View style={s.liveDot} />
            </View>
            <View style={s.chatEmpty}>
              <Text style={s.chatEmptyText}>{t('chatPending')}</Text>
              <View style={s.pill}><Users size={14} color={ui.accent} /><Text style={s.pillText}>{t('colleaguesFive')}</Text></View>
            </View>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>{t('quickAccessTitle')}</Text>
            {QUICK.map((q, i) => {
              const Icon = q.icon;
              return (
                <View key={q.key} style={[s.quickRow, i > 0 && s.quickDivider]}>
                  <View style={s.iconBoxSm}><Icon size={16} color={ui.blue} /></View>
                  <Text style={s.quickLabel}>{t(q.key as Parameters<typeof t>[0])}</Text>
                  <View style={s.soon2}><Text style={s.soon2Text}>{t('comingSoon')}</Text></View>
                </View>
              );
            })}
          </View>

          <Text style={[s.sectionTitle, { marginTop: 4, marginBottom: 10 }]}>{t('departments')}</Text>
          <View style={s.depts}>
            {DEPTS.map((d) => {
              const Icon = d.icon;
              return (
                <View key={d.key} style={s.dept}>
                  <Icon size={14} color={ui.accent} />
                  <Text style={s.deptText}>{t(d.key as Parameters<typeof t>[0])}</Text>
                </View>
              );
            })}
          </View>
          <Text style={s.footer}>{t('devVersion')} · {t('appName')}</Text>
        </View>
      </ScrollView>

      <Pressable style={s.fab} onPress={() => router.push('/calculator')} accessibilityRole="button" accessibilityLabel={t('calculator')}>
        <LinearGradient colors={['#18D68C', '#00A36C']} style={s.fabInner}><Calculator size={26} color="#04140E" /></LinearGradient>
      </Pressable>
    </View>
  );
}

const createStyles = (ui: Ui, row: 'row' | 'row-reverse', align: 'left' | 'right') => StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.bg },
  pad: { paddingHorizontal: 16 },
  hero: { paddingHorizontal: 18, paddingBottom: 46, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden', minHeight: 210 },
  heroRow: { flexDirection: row, alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: row, alignItems: 'center', gap: 10 },
  brandChip: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#FFC21A', alignItems: 'center', justifyContent: 'center' },
  brandName: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24 },
  headline: { color: '#FFFFFF', fontSize: 24, lineHeight: 34, fontWeight: '800', marginTop: 26, textAlign: align },
  search: { flexDirection: row, alignItems: 'center', gap: 10, marginTop: -26, marginHorizontal: 16, paddingHorizontal: 14, minHeight: 54, borderRadius: 18, backgroundColor: ui.surface, borderWidth: 1, borderColor: ui.border, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  searchText: { flex: 1, color: ui.muted, fontSize: 13, textAlign: align },
  cameraBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: ui.accentSoft, alignItems: 'center', justifyContent: 'center' },
  sectionHead: { flexDirection: row, alignItems: 'baseline', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 },
  sectionTitle: { color: ui.text, fontSize: 17, fontWeight: '800', textAlign: align },
  sectionHint: { color: ui.muted, fontSize: 11 },
  grid: { flexDirection: row, flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 18 },
  tileWrap: { width: '48.5%' },
  tile: { height: 124, borderRadius: 20, overflow: 'hidden', padding: 12, justifyContent: 'space-between' },
  tileTop: { flexDirection: row, justifyContent: 'space-between', alignItems: 'center' },
  chip: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  soon: { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  soonText: { color: '#E6EEF7', fontSize: 9, fontWeight: '700' },
  tileLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', lineHeight: 20, textAlign: align },
  card: { backgroundColor: ui.surface, borderRadius: 22, borderWidth: 1, borderColor: ui.border, padding: 16, marginBottom: 14 },
  cardHead: { flexDirection: row, alignItems: 'center', gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 13, backgroundColor: ui.accentSoft, alignItems: 'center', justifyContent: 'center' },
  iconBoxSm: { width: 32, height: 32, borderRadius: 10, backgroundColor: ui.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: ui.text, fontSize: 15, fontWeight: '800', textAlign: align },
  cardSub: { color: ui.muted, fontSize: 11, marginTop: 2, textAlign: align },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: ui.accent },
  chatEmpty: { backgroundColor: ui.surfaceAlt, borderRadius: 14, padding: 14, marginTop: 14, gap: 12 },
  chatEmptyText: { color: ui.muted, fontSize: 12, lineHeight: 20, textAlign: align },
  pill: { alignSelf: row === 'row' ? 'flex-start' : 'flex-end', flexDirection: row, alignItems: 'center', gap: 6, backgroundColor: ui.accentSoft, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  pillText: { color: ui.accent, fontSize: 11, fontWeight: '800' },
  quickRow: { flexDirection: row, alignItems: 'center', gap: 12, minHeight: 50 },
  quickDivider: { borderTopWidth: 1, borderTopColor: ui.border },
  quickLabel: { flex: 1, color: ui.text, fontSize: 13, fontWeight: '600', textAlign: align },
  soon2: { backgroundColor: ui.surfaceAlt, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 3 },
  soon2Text: { color: ui.muted, fontSize: 9, fontWeight: '700' },
  depts: { flexDirection: row, flexWrap: 'wrap', gap: 8 },
  dept: { flexDirection: row, alignItems: 'center', gap: 6, backgroundColor: ui.surface, borderWidth: 1, borderColor: ui.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  deptText: { color: ui.text, fontSize: 12, fontWeight: '700' },
  footer: { color: ui.muted, textAlign: 'center', fontSize: 10, marginTop: 22 },
  fab: { position: 'absolute', right: 18, bottom: 24, width: 58, height: 58, borderRadius: 20, shadowColor: '#00A36C', shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  fabInner: { flex: 1, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
