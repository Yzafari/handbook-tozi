import React, { useState } from 'react';
import { ActivityIndicator, ImageBackground, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Zap } from 'lucide-react-native';
import { useAuth } from '../core/auth/AuthContext';
import { useAppSettings } from '../core/settings/AppSettingsContext';
import { apiErrorMessage } from '../core/network/errors';
import { NAVY, photos } from '../core/theme/gridhandUi';

export default function SignupScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const { t, direction } = useAppSettings();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const align = direction === 'rtl' ? 'right' : 'left';

  const submit = async () => {
    setError('');
    if (!fullName.trim() || !email.trim() || !password) { setError('نام، ایمیل و رمز عبور را کامل کنید.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('فرمت ایمیل معتبر نیست.'); return; }
    if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      setError('رمز عبور باید حداقل ۸ کاراکتر و شامل حرف کوچک، حرف بزرگ و عدد باشد.');
      return;
    }
    if (password !== confirm) { setError('تکرار رمز عبور مطابقت ندارد.'); return; }

    setLoading(true);
    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
      router.replace('/');
    } catch (e: any) {
      setError(apiErrorMessage(e, 'ثبت‌نام انجام نشد.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={NAVY} style={StyleSheet.absoluteFill} />
      {photos.login ? <ImageBackground source={photos.login} resizeMode="cover" style={StyleSheet.absoluteFill} /> : null}
      <LinearGradient colors={['rgba(6,21,43,0.35)', 'rgba(6,21,43,0.92)']} locations={[0.1, 0.65]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
               <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.logo}><Zap size={34} color="#04121F" fill="#04121F" /></View>
            <Text style={styles.title}>ساخت حساب کاربری</Text>
            <Text style={styles.subtitle}>برای همگام‌سازی اطلاعات، دفترچه فنی و امکانات همکاران ثبت‌نام کنید.</Text>
            <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="نام و نام خانوادگی" placeholderTextColor="rgba(255,255,255,0.55)" textAlign={align} />
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder={t('email')} placeholderTextColor="rgba(255,255,255,0.55)" autoCapitalize="none" keyboardType="email-address" textAlign={align} />
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="شماره موبایل (اختیاری)" placeholderTextColor="rgba(255,255,255,0.55)" keyboardType="phone-pad" textAlign={align} />
            <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder={t('password')} placeholderTextColor="rgba(255,255,255,0.55)" secureTextEntry textAlign={align} />
            <TextInput style={styles.input} value={confirm} onChangeText={setConfirm} placeholder="تکرار رمز عبور" placeholderTextColor="rgba(255,255,255,0.55)" secureTextEntry textAlign={align} />
            {!!error && <Text style={[styles.error, { textAlign: align }]}>{error}</Text>}
            <Pressable style={[styles.primary, loading && styles.disabled]} onPress={() => void submit()} disabled={loading}>
              {loading ? <ActivityIndicator color="#04140E" /> : <Text style={styles.primaryText}>ثبت‌نام و ورود</Text>}
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => router.replace('/login')}>
              <Text style={styles.secondaryText}>حساب دارم؛ ورود به حساب</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => router.replace('/')}>
              <Text style={styles.guestText}>{t('continueGuest')}</Text>
            </Pressable>
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
  title: { fontSize: 25, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 23, marginTop: 8, marginBottom: 24 },
  input: { backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 15, marginBottom: 12, color: '#FFFFFF' },
  error: { color: '#FFB4AB', marginBottom: 12, lineHeight: 20 },
  primary: { backgroundColor: '#18D68C', borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 4 },
  disabled: { opacity: 0.6 },
  primaryText: { color: '#04140E', fontWeight: '800', fontSize: 16 },
  secondary: { padding: 12, alignItems: 'center' },
  secondaryText: { color: '#8CC8FF', fontWeight: '700' },
  guestText: { color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
});
