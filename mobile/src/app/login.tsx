import React, { useState } from 'react';
import { ActivityIndicator, ImageBackground, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Zap } from 'lucide-react-native';
import { useAuth } from '../core/auth/AuthContext';
import { useAppSettings } from '../core/settings/AppSettingsContext';
import { NAVY, photos } from '../core/theme/gridhandUi';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { t, direction } = useAppSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const align = direction === 'rtl' ? 'right' : 'left';

  const submit = async () => {
    if (!email.trim() || !password) { setError(t('requiredFields')); return; }
    setLoading(true); setError('');
    try { await login(email.trim(), password); router.replace('/'); }
    catch (e: any) { setError(e?.response?.data?.error?.message || t('loginError')); }
    finally { setLoading(false); }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={NAVY} style={StyleSheet.absoluteFill} />
      {photos.login ? <ImageBackground source={photos.login} resizeMode="cover" style={StyleSheet.absoluteFill} /> : null}
      <LinearGradient colors={['rgba(6,21,43,0.35)', 'rgba(6,21,43,0.92)']} locations={[0.1, 0.65]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        {/* Android draws edge to edge on SDK 54, so the window no longer resizes
            for the keyboard. Padding on both platforms plus a scroll container
            keeps the fields and the guest button reachable while typing. */}
        <KeyboardAvoidingView style={styles.container} behavior="padding">
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.logo}><Zap size={34} color="#04121F" fill="#04121F" /></View>
            <Text style={styles.title}>{t('loginTitle')}</Text>
            <Text style={styles.subtitle}>{t('loginSubtitle')}</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder={t('email')} placeholderTextColor="rgba(255,255,255,0.55)" autoCapitalize="none" keyboardType="email-address" textAlign={align} />
            <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder={t('password')} placeholderTextColor="rgba(255,255,255,0.55)" secureTextEntry textAlign={align} />
            {!!error && <Text style={[styles.error, { textAlign: align }]}>{error}</Text>}
            <Pressable style={[styles.primary, loading && styles.disabled]} onPress={submit} disabled={loading}>
              {loading ? <ActivityIndicator color="#04140E" /> : <Text style={styles.primaryText}>{t('login')}</Text>}
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => router.back()}><Text style={styles.secondaryText}>{t('continueGuest')}</Text></Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#06152B' },
  safe: { flex: 1 },
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'flex-end', padding: 24, paddingBottom: 36 },
  logo: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#FFC21A', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 23, marginTop: 8, marginBottom: 26 },
  input: { backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 15, marginBottom: 12, color: '#FFFFFF' },
  error: { color: '#FFB4AB', marginBottom: 12 },
  primary: { backgroundColor: '#18D68C', borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 4 },
  disabled: { opacity: 0.6 },
  primaryText: { color: '#04140E', fontWeight: '800', fontSize: 16 },
  secondary: { padding: 16, alignItems: 'center' },
  secondaryText: { color: '#8CC8FF', fontWeight: '700' },
});
