import React, { useMemo, useState } from 'react';
import { FlatList, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../core/auth/AuthContext';
import { JOB_ROLE_LABELS } from '../core/localization/jobRoles';
import { PROVINCES } from '../core/localization/provinces';
import type { ProvinceInfo } from '../core/localization/provinces';
import { useAppSettings } from '../core/settings/AppSettingsContext';
import { getJobRoleAvatar, getLocalizedJobRole, getLocalizedProvince } from '../core/localization/labels';

type Selector = 'province' | 'jobRole' | null;

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, updateProfile } = useAuth();
  const { t, isDark, direction, language } = useAppSettings();
  const [selector, setSelector] = useState<Selector>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const province = PROVINCES.find(item => item.value === user?.province);
  const options = useMemo(() => selector === 'province'
    ? PROVINCES.map(item => ({ value: item.value, label: getLocalizedProvince(item.value, language) }))
    : Object.entries(JOB_ROLE_LABELS).map(([value]) => ({ value, label: getLocalizedJobRole(value, language) })), [selector, language]);

  const choose = async (value: string) => {
    if (!user) { setSelector(null); router.push('/login'); return; }
    setSaving(true); setError('');
    try { await updateProfile(selector === 'province' ? { province: value } : { jobRole: value }); setSelector(null); }
    catch (e: any) { setError(e?.response?.data?.error?.message || t('profileSaveError')); }
    finally { setSaving(false); }
  };

  const renderProvince = (item: ProvinceInfo) => <View key={item.value} style={styles.companyCard}>
    <Text style={[styles.companyName, isDark && styles.textDark, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{item.company}</Text>
    <Pressable onPress={() => Linking.openURL(item.website)}><Text style={[styles.website, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{item.website}</Text></Pressable>
    {!!item.note && <Text style={[styles.note, isDark && styles.mutedDark, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{item.note}</Text>}
    {item.alternateWebsite && <Pressable onPress={() => Linking.openURL(item.alternateWebsite!)}><Text style={[styles.website, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{t('alternateWebsite')}: {item.alternateWebsite}</Text></Pressable>}
  </View>;

  return (
    <SafeAreaView style={[styles.safe, isDark && styles.safeDark]}>
      <View style={[styles.header, direction === 'ltr' && styles.headerLtr]}><Pressable onPress={() => router.back()}><Text style={styles.back}>{t('back')}</Text></Pressable><Text style={[styles.heading, isDark && styles.textDark]}>{t('profile')}</Text></View>
      <View style={[styles.card, isDark && styles.cardDark]}>
        <View style={[styles.avatar, isDark && styles.avatarDark]}><Text style={styles.avatarText}>{getJobRoleAvatar(user?.jobRole)}</Text></View>
        <Text style={[styles.name, isDark && styles.textDark]}>{user?.name || t('guestUser')}</Text>
        <Text style={[styles.meta, isDark && styles.mutedDark]}>{user?.email || t('noAccount')}</Text>
        {!!user && <Text style={[styles.meta, isDark && styles.mutedDark]}>{t('systemRole')}: {user.role}</Text>}
      </View>
      <Pressable style={[styles.settingsButton, direction === 'ltr' && styles.rowLtr, isDark && styles.cardDark]} onPress={() => router.push('/settings')}><Text style={[styles.settingsButtonText, isDark && styles.textDark]}>{t('settings')}</Text><Text style={styles.chevron}>‹</Text></Pressable>

      {user ? <>
        <Text style={[styles.sectionTitle, isDark && styles.textDark]}>{t('jobInfo')}</Text>
        <Pressable style={[styles.selectorCard, direction === 'ltr' && styles.rowLtr, isDark && styles.cardDark]} onPress={() => setSelector('jobRole')}><View><Text style={[styles.selectorLabel, isDark && styles.mutedDark, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{t('jobRole')}</Text><Text style={[styles.selectorValue, isDark && styles.textDark, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{user.jobRole ? getLocalizedJobRole(user.jobRole, language) : t('selectJob')}</Text></View><Text style={styles.chevron}>‹</Text></Pressable>
        <Pressable style={[styles.selectorCard, direction === 'ltr' && styles.rowLtr, isDark && styles.cardDark]} onPress={() => setSelector('province')}><View><Text style={[styles.selectorLabel, isDark && styles.mutedDark, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{t('province')}</Text><Text style={[styles.selectorValue, isDark && styles.textDark, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{user.province ? getLocalizedProvince(user.province, language) : t('selectProvince')}</Text></View><Text style={styles.chevron}>‹</Text></Pressable>
        {province && renderProvince(province)}
        <Text style={[styles.note, isDark && styles.mutedDark, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{t('provinceNote')}</Text>
        <Pressable style={[styles.logout, isDark && styles.logoutDark]} onPress={async () => { await logout(); router.replace('/'); }}><Text style={styles.logoutText}>{t('logout')}</Text></Pressable>
      </> : <Pressable style={styles.login} onPress={() => router.push('/login')}><Text style={styles.loginText}>{t('login')}</Text></Pressable>}
      {!!error && <Text style={[styles.error, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{error}</Text>}

      <Modal visible={selector !== null} animationType="slide" transparent onRequestClose={() => setSelector(null)}>
        <View style={styles.modalBackdrop}><View style={[styles.modal, isDark && styles.cardDark]}>
          <View style={[styles.modalHeader, direction === 'ltr' && styles.rowLtr]}><Pressable onPress={() => setSelector(null)}><Text style={styles.back}>{t('close')}</Text></Pressable><Text style={[styles.modalTitle, isDark && styles.textDark]}>{selector === 'province' ? t('selectProvince') : t('selectJob')}</Text></View>
          <FlatList data={options} keyExtractor={(item: { value: string; label: string }) => item.value} renderItem={({ item }: { item: { value: string; label: string } }) => <Pressable style={[styles.option, direction === 'ltr' && styles.rowLtr, isDark && styles.optionDark]} onPress={() => choose(item.value)} disabled={saving}><Text style={[styles.optionText, isDark && styles.textDark, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{item.label}</Text><Text style={styles.optionCheck}>{(selector === 'province' ? user?.province : user?.jobRole) === item.value ? '✓' : ''}</Text></Pressable>} />
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7F8', padding: 18 }, safeDark: { backgroundColor: '#121212' }, textDark: { color: '#F4F7F5' }, mutedDark: { color: '#B4BDB8' }, cardDark: { backgroundColor: '#1E1E1E', borderColor: '#343A37' }, optionDark: { borderBottomColor: '#343A37' }, headerLtr: { flexDirection: 'row' }, rowLtr: { flexDirection: 'row' }, settingsButton: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5ECE8', borderRadius: 14, padding: 14, marginBottom: 14 }, settingsButtonText: { color: '#1D2D24', fontSize: 14, fontWeight: '800' }, header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }, heading: { fontSize: 21, fontWeight: '800', color: '#17231E' }, back: { color: '#0077C8', fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E8EEEB', marginBottom: 18 }, avatar: { width: 76, height: 76, borderRadius: 26, backgroundColor: '#DDF5EA', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }, avatarDark: { backgroundColor: '#24352D' }, avatarText: { color: '#008957', fontSize: 32, fontWeight: '800' }, name: { fontSize: 19, fontWeight: '800', color: '#17231E' }, meta: { color: '#68756F', marginTop: 8, textAlign: 'center' },
  sectionTitle: { textAlign: 'right', color: '#17231E', fontWeight: '900', fontSize: 15, marginBottom: 9 }, selectorCard: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5ECE8', padding: 14, marginBottom: 8 }, selectorLabel: { textAlign: 'right', color: '#7C8982', fontSize: 11 }, selectorValue: { textAlign: 'right', color: '#1D2D24', fontSize: 14, fontWeight: '800', marginTop: 5 }, chevron: { color: '#008957', fontSize: 28 },
  companyCard: { backgroundColor: '#EAF5EF', borderRadius: 14, padding: 14, marginTop: 8 }, companyName: { color: '#244333', fontWeight: '800', textAlign: 'right', lineHeight: 21 }, website: { color: '#0077C8', textAlign: 'right', textDecorationLine: 'underline', marginTop: 8, fontSize: 12 }, note: { color: '#75827B', fontSize: 10, textAlign: 'right', lineHeight: 17, marginTop: 9 },
  logoutDark: { backgroundColor: '#4A2424' }, logout: { marginTop: 18, backgroundColor: '#FDECEC', borderRadius: 14, padding: 15, alignItems: 'center' }, logoutText: { color: '#C62828', fontWeight: '800' }, login: { marginTop: 18, backgroundColor: '#00A86B', borderRadius: 14, padding: 15, alignItems: 'center' }, loginText: { color: '#fff', fontWeight: '800' }, error: { color: '#B3261E', textAlign: 'right', marginTop: 10 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }, modal: { backgroundColor: '#F8FAF9', borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '82%', paddingHorizontal: 18, paddingBottom: 20 }, modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18 }, modalTitle: { color: '#17231E', fontSize: 18, fontWeight: '900' }, option: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E8EEEB' }, optionText: { color: '#27372E', fontSize: 14, textAlign: 'right' }, optionCheck: { color: '#00A86B', fontWeight: '900', fontSize: 18 },
});
