import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../core/auth/AuthContext';
import { useAppSettings } from '../core/settings/AppSettingsContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { t, isDark, direction } = useAppSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!email.trim() || !password) { setError(t('requiredFields')); return; }
    setLoading(true); setError('');
    try { await login(email.trim(), password); router.replace('/'); }
    catch (e: any) { setError(e?.response?.data?.error?.message || t('loginError')); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={[styles.safe, isDark && styles.safeDark]}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.logo}><Text style={styles.logoText}>ه</Text></View>
        <Text style={[styles.title, isDark && styles.textDark]}>{t('loginTitle')}</Text>
        <Text style={[styles.subtitle, isDark && styles.mutedDark]}>{t('loginSubtitle')}</Text>
        <TextInput style={[styles.input, isDark && styles.inputDark]} value={email} onChangeText={setEmail} placeholder={t('email')} autoCapitalize="none" keyboardType="email-address" textAlign={direction === 'rtl' ? 'right' : 'left'} />
        <TextInput style={[styles.input, isDark && styles.inputDark]} value={password} onChangeText={setPassword} placeholder={t('password')} secureTextEntry textAlign={direction === 'rtl' ? 'right' : 'left'} />
        {!!error && <Text style={[styles.error, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{error}</Text>}
        <Pressable style={[styles.primary, loading && styles.disabled]} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('login')}</Text>}
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => router.back()}><Text style={styles.secondaryText}>{t('continueGuest')}</Text></Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7F8' }, safeDark: { backgroundColor: '#121212' }, textDark: { color: '#F4F7F5' }, mutedDark: { color: '#B4BDB8' }, inputDark: { backgroundColor: '#1E1E1E', borderColor: '#343A37', color: '#F4F7F5' }, container: { flex: 1, justifyContent: 'center', padding: 24 },
  logo: { width: 68, height: 68, borderRadius: 22, backgroundColor: '#00A86B', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  logoText: { color: '#fff', fontSize: 36, fontWeight: '800' }, title: { fontSize: 24, fontWeight: '800', color: '#16251F', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#68756F', textAlign: 'center', lineHeight: 23, marginTop: 8, marginBottom: 28 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E8E4', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12, color: '#17231E' },
  error: { color: '#C62828', textAlign: 'right', marginBottom: 12 }, primary: { backgroundColor: '#00A86B', borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 4 },
  disabled: { opacity: 0.6 }, primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 }, secondary: { padding: 16, alignItems: 'center' }, secondaryText: { color: '#0077C8', fontWeight: '700' },
});
