import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { getHomeModules } from '../core/modules/registry.js';
import { useAppSettings } from '../core/settings/AppSettingsContext';
import { getJobRoleAvatar } from '../core/localization/labels';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../core/auth/AuthContext';

const modules = getHomeModules();

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, isDark, direction } = useAppSettings();
  const moduleKeys: Record<string, Parameters<typeof t>[0]> = { 'bill-payment': 'billPayment', 'bill-calculator': 'billCalculator', engineering: 'engineering', safety: 'safety', forms: 'forms', notebook: 'notebookModule' };
  const departments = [{ key: 'operations', label: t('operations') }, { key: 'engineeringPlanning', label: t('engineeringPlanning') }, { key: 'sales', label: t('sales') }, { key: 'consultant', label: t('consultant') }];
  const profileIcon = getJobRoleAvatar(user?.jobRole);
  return (
    <SafeAreaView style={[styles.safe, isDark && styles.safeDark]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, direction === 'ltr' && styles.headerLtr]}>
          <Pressable style={styles.profile} onPress={() => router.push('/profile')}>
            <Text style={styles.profileIcon}>{profileIcon}</Text>
          </Pressable>
          <View style={[styles.brand, direction === 'ltr' && styles.brandLtr]}>
            <Text style={[styles.brandTitle, isDark && styles.textDark]}>{t('appName')}</Text>
            <Text style={[styles.brandSubtitle, isDark && styles.mutedDark]}>{user?.name ? (direction === 'rtl' ? `سلام، ${user.name}` : `Hello, ${user.name}`) : t('greeting')}</Text>
          </View>
        </View>

        <View style={[styles.searchRow, isDark && styles.cardDark, direction === 'ltr' && styles.rowLtr]}>
          <Pressable style={styles.searchButton} onPress={() => router.push('/search')} accessibilityLabel={t('search')}>
            <Text style={styles.searchButtonText}>🔍</Text>
          </Pressable>
          <Pressable style={styles.searchField} onPress={() => router.push('/search')}>
            <Text style={[styles.searchPlaceholder, isDark && styles.mutedDark, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{t('searchPlaceholder')}</Text>
          </Pressable>
          <Pressable style={styles.cameraButton} onPress={() => router.push('/camera')} accessibilityLabel={t('camera')}>
            <Text style={styles.cameraText}>📷</Text>
          </Pressable>
        </View>

        <View style={[styles.sectionHeader, direction === 'ltr' && styles.rowLtr]}><Text style={[styles.sectionTitle, isDark && styles.textDark]}>{t('modules')}</Text><Text style={[styles.sectionHint, isDark && styles.mutedDark]}>{t('modulesHint')}</Text></View>
        <View style={[styles.grid, direction === 'ltr' && styles.rowLtr]}>
          {modules.map(item => item.status === 'active' && item.route ? (
            <Pressable key={item.id} style={[styles.moduleCard, isDark && styles.cardDark]} onPress={() => router.push(item.route as Href)}>
              <Text style={styles.moduleIcon}>{item.icon}</Text><Text style={[styles.moduleLabel, isDark && styles.textDark]}>{t(moduleKeys[item.id])}</Text>
            </Pressable>
          ) : (
            <View key={item.id} style={[styles.moduleCard, styles.modulePending, isDark && styles.cardDark]}>
              <Text style={styles.moduleIcon}>{item.icon}</Text><Text style={[styles.moduleLabel, isDark && styles.textDark]}>{t(moduleKeys[item.id])}</Text>
              {item.status === 'coming-soon' && <Text style={styles.pendingLabel}>{t('comingSoon')}</Text>}
            </View>
          ))}
        </View>

        <View style={[styles.chatCard, isDark && styles.cardDark]}>
          <View style={[styles.chatHeader, direction === 'ltr' && styles.rowLtr]}><Text style={styles.chatIcon}>💬</Text><View style={{ flex: 1 }}><Text style={[styles.chatTitle, isDark && styles.textDark, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{t('chat')}</Text><Text style={[styles.chatSubtitle, isDark && styles.mutedDark, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{t('chatSubtitle')}</Text></View></View>
          <View style={[styles.chatEmpty, isDark && styles.chatEmptyDark]}>
            <Text style={[styles.chatEmptyText, isDark && styles.mutedDark, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{t('chatPending')}</Text>
            <View style={[styles.colleaguesPill, direction === 'ltr' && styles.rowLtr, direction === 'rtl' && styles.alignEnd]}><Text style={styles.colleaguesPillIcon}>👥</Text><Text style={styles.colleaguesPillText}>{t('colleaguesFive')}</Text></View>
          </View>
        </View>

        <View style={[styles.quickAccessCard, isDark && styles.cardDark]}>
          <Text style={[styles.quickAccessTitle, isDark && styles.textDark, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{t('quickAccessTitle')}</Text>
          <View style={styles.quickAccessList}>
            {[{ key: 'quickTender', icon: '📑' }, { key: 'quickMarket', icon: '🧰' }, { key: 'quickJobs', icon: '💼' }].map(item => (
              <View key={item.key} style={[styles.quickAccessItem, isDark && styles.quickAccessItemDark, direction === 'ltr' && styles.rowLtr]}>
                <Text style={styles.quickAccessIcon}>{item.icon}</Text>
                <Text style={[styles.quickAccessLabel, isDark && styles.textDark, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{t(item.key as Parameters<typeof t>[0])}</Text>
                <Text style={styles.pendingLabel}>{t('comingSoon')}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, isDark && styles.textDark]}>{t('departments')}</Text></View>
        <View style={[styles.departments, direction === 'ltr' && styles.rowLtr]}>
          {departments.map(item => <View key={item.key} style={[styles.department, isDark && styles.departmentDark]}><Text style={[styles.departmentText, isDark && styles.textDark]}>{item.label}</Text></View>)}
        </View>
        <Text style={[styles.footer, isDark && styles.mutedDark]}>نسخهٔ توسعه · {t('appName')}</Text>
      </ScrollView>
      <Pressable style={[styles.floatingCalculator, isDark && styles.floatingCalculatorDark]} onPress={() => router.push('/calculator')} accessibilityRole="button" accessibilityLabel="ماشین‌حساب عمومی"><Text style={styles.floatingCalculatorIcon}>🧮</Text></Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7F8' }, safeDark: { backgroundColor: '#121212' }, textDark: { color: '#F4F7F5' }, mutedDark: { color: '#B4BDB8' }, cardDark: { backgroundColor: '#1E1E1E', borderColor: '#343A37' }, headerLtr: { flexDirection: 'row' }, brandLtr: { alignItems: 'flex-start', marginRight: 0, marginLeft: 11 }, rowLtr: { flexDirection: 'row' }, alignEnd: { alignSelf: 'flex-end' }, departmentDark: { backgroundColor: '#24352D' }, chatEmptyDark: { backgroundColor: '#292F2C' }, floatingCalculatorDark: { backgroundColor: '#0077C8' }, floatingCalculator: { position: 'absolute', right: 18, bottom: 22, width: 56, height: 56, borderRadius: 20, backgroundColor: '#0077C8', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }, floatingCalculatorIcon: { fontSize: 25 }, content: { paddingHorizontal: 15, paddingBottom: 28 },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, paddingBottom: 16 },
  profile: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#DDF5EA', alignItems: 'center', justifyContent: 'center' }, profileIcon: { fontSize: 24 },
  brand: { flex: 1, alignItems: 'flex-end', marginRight: 11 }, brandTitle: { color: '#17231E', fontSize: 21, fontWeight: '900' }, brandSubtitle: { color: '#718078', fontSize: 11, marginTop: 3 },
  searchRow: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E1EAE5', padding: 5, marginBottom: 20 },
  searchButton: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#E8F5EF', alignItems: 'center', justifyContent: 'center' }, searchButtonText: { color: '#0077C8', fontSize: 30, lineHeight: 34 },
  searchField: { flex: 1, paddingHorizontal: 10, justifyContent: 'center', minHeight: 42 }, searchPlaceholder: { color: '#7B8982', fontSize: 12, textAlign: 'right' },
  cameraButton: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#E8F5EF', alignItems: 'center', justifyContent: 'center' }, cameraText: { color: '#008957', fontSize: 25 },
  sectionHeader: { flexDirection: 'row-reverse', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, marginTop: 3 }, sectionTitle: { color: '#1B2B23', fontSize: 16, fontWeight: '900' }, sectionHint: { color: '#8A9690', fontSize: 10 },
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 18 }, moduleCard: { width: '31.8%', minHeight: 94, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E6ECE8', borderRadius: 15, marginBottom: 8, paddingVertical: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  modulePending: { opacity: 0.82 }, moduleIcon: { fontSize: 23, marginBottom: 5 }, moduleLabel: { color: '#26352D', fontSize: 11, fontWeight: '800', textAlign: 'center', lineHeight: 16 }, pendingLabel: { color: '#9AA49E', fontSize: 8, marginTop: 3 },
  departments: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7, marginBottom: 18 }, department: { backgroundColor: '#EAF3EF', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 8 }, departmentText: { color: '#426252', fontSize: 10, fontWeight: '700' },
  chatCard: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#E4ECE7', padding: 14 }, chatHeader: { flexDirection: 'row-reverse', alignItems: 'center' }, chatIcon: { fontSize: 26, marginLeft: 10 }, chatTitle: { color: '#1B2B23', fontSize: 15, fontWeight: '900', textAlign: 'right' }, chatSubtitle: { color: '#7B8982', fontSize: 11, textAlign: 'right', marginTop: 3 }, chatEmpty: { backgroundColor: '#F7F9F8', borderRadius: 12, marginTop: 12, padding: 13 }, chatEmptyText: { color: '#7B8982', fontSize: 11, lineHeight: 19, textAlign: 'right' }, colleaguesPill: { alignSelf: 'flex-start', flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: '#E5F3EC', borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7, marginTop: 10 }, colleaguesPillIcon: { fontSize: 14 }, colleaguesPillText: { color: '#087B4B', fontSize: 10, fontWeight: '800' }, quickAccessCard: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#E4ECE7', padding: 14, marginTop: 14, marginBottom: 18 }, quickAccessTitle: { color: '#1B2B23', fontSize: 15, fontWeight: '900', marginBottom: 8 }, quickAccessList: { gap: 2 }, quickAccessItem: { flexDirection: 'row-reverse', alignItems: 'center', minHeight: 45, borderTopWidth: 1, borderTopColor: '#EDF1EE', gap: 9 }, quickAccessItemDark: { borderTopColor: '#343A37' }, quickAccessIcon: { fontSize: 18, width: 26, textAlign: 'center' }, quickAccessLabel: { flex: 1, color: '#33443A', fontSize: 11, fontWeight: '700' }, footer: { color: '#A4ADA8', textAlign: 'center', fontSize: 9, marginTop: 18 },
});
