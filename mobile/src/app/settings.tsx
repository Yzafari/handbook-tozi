import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppSettings, type AppLanguage, type AppTheme } from '../core/settings/AppSettingsContext';
import { ConnectionTestCard } from '../features/diagnostics/ConnectionTestCard';

export default function SettingsScreen() {
  const router = useRouter();
  const { language, theme, direction, isDark, t, setLanguage, setTheme } = useAppSettings();
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const palette = isDark ? dark : light;
  const chooseLanguage = async (value: AppLanguage) => { try { setError(''); await setLanguage(value); setSaved(true); } catch { setError(t('languageSaveError')); } };
  const chooseTheme = async (value: AppTheme) => { try { setError(''); await setTheme(value); setSaved(true); } catch { setError(t('themeSaveError')); } };
  const languages: Array<{ value: AppLanguage; label: string }> = [{ value: 'fa', label: t('persian') }, { value: 'ku', label: t('kurdish') }, { value: 'en', label: t('english') }];
  const themes: Array<{ value: AppTheme; label: string }> = [{ value: 'auto', label: t('autoTheme') }, { value: 'system', label: t('systemTheme') }, { value: 'light', label: t('lightTheme') }, { value: 'dark', label: t('darkTheme') }];

  return <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
    <View style={[styles.header, { flexDirection: direction === 'rtl' ? 'row-reverse' : 'row' }]}><Pressable onPress={() => router.back()}><Text style={[styles.back, { color: palette.accent }]}>{t('back')}</Text></Pressable><Text style={[styles.title, { color: palette.text }]}>{t('settings')}</Text></View>
    <Text style={[styles.section, { color: palette.text, textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{t('connectionTest')}</Text>
    <ConnectionTestCard />
    <Text style={[styles.section, { color: palette.text, textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{t('language')}</Text>
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>{languages.map(item => <Pressable key={item.value} onPress={() => void chooseLanguage(item.value)} style={[styles.option, { flexDirection: direction === 'rtl' ? 'row-reverse' : 'row', borderBottomColor: palette.border }]}><Text style={[styles.optionText, { color: palette.text }]}>{item.label}</Text><Text style={[styles.check, { color: palette.accent }]}>{language === item.value ? '✓' : ''}</Text></Pressable>)}</View>
    <Text style={[styles.section, { color: palette.text, textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{t('theme')}</Text>
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>{themes.map(item => <Pressable key={item.value} onPress={() => void chooseTheme(item.value)} style={[styles.option, { flexDirection: direction === 'rtl' ? 'row-reverse' : 'row', borderBottomColor: palette.border }]}><Text style={[styles.optionText, { color: palette.text }]}>{item.label}</Text><Text style={[styles.check, { color: palette.accent }]}>{theme === item.value ? '✓' : ''}</Text></Pressable>)}</View>
    {saved && <Text style={styles.success}>{t('saved')}</Text>}
    {!!error && <Text style={styles.error}>{error}</Text>}
  </SafeAreaView>;
}

const light = { background: '#F5F7F8', card: '#FFFFFF', text: '#17231E', border: '#E4ECE7', accent: '#0077C8' };
const dark = { background: '#121212', card: '#1E1E1E', text: '#F4F7F5', border: '#343A37', accent: '#55B8F2' };
const styles = StyleSheet.create({ safe: { flex: 1, padding: 18 }, header: { alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }, back: { fontWeight: '700' }, title: { fontSize: 21, fontWeight: '900' }, section: { fontSize: 14, fontWeight: '900', marginBottom: 9, marginTop: 12 }, card: { borderWidth: 1, borderRadius: 15, paddingHorizontal: 14 }, option: { minHeight: 54, alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth }, optionText: { fontSize: 14, fontWeight: '700' }, check: { fontSize: 20, fontWeight: '900' }, success: { color: '#008957', marginTop: 14, textAlign: 'center', fontWeight: '700' }, error: { color: '#D04444', marginTop: 14, textAlign: 'right' } });
