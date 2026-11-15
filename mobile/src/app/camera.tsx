import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../core/auth/AuthContext';
import { deleteOcrJobLocal, enqueueOcrPhoto, getOcrJobLocal, listOcrJobs, retryOcrJobLocal, syncOcrQueue } from '../core/ocr/queue';
import type { LocalOcrJob } from '../core/ocr/queue';
import { useAppSettings } from '../core/settings/AppSettingsContext';

export default function CameraScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, isDark, direction } = useAppSettings();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [job, setJob] = useState<LocalOcrJob | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!user?.id) return;
    listOcrJobs(user.id).then(items => { if (active && items.length) setJob(items[0]); }).catch(() => {});
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!job?.localId || !user?.id) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const pollLocal = async () => {
      const latest = await getOcrJobLocal(user.id, job.localId).catch(() => null);
      if (!active) return;
      if (latest) setJob(latest);
      if (latest && !['DONE', 'FAILED', 'CANCELLED'].includes(latest.status)) timer = setTimeout(async () => {
        if (latest.status === 'UPLOADED' || latest.status === 'RUNNING' || latest.status === 'RETRY_UPLOAD') await syncOcrQueue(user.id).catch(() => {});
        await pollLocal();
      }, 4000);
    };
    timer = setTimeout(pollLocal, 800);
    return () => { active = false; clearTimeout(timer); };
  }, [job?.localId, job?.status, user?.id]);

  const capture = async () => {
    if (!cameraRef.current || !ready || capturing || !user) return;
    setCapturing(true); setError('');
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.82, skipProcessing: false });
      if (!photo?.uri) throw new Error('تصویر دوربین دریافت نشد');
      // Copy into the app's persistent documents directory before any network request.
      const local = await enqueueOcrPhoto(user.id, photo.uri);
      setJob(local);
      await syncOcrQueue(user.id);
      const latest = await getOcrJobLocal(user.id, local.localId);
      if (latest) setJob(latest);
    } catch (e: any) {
      setError(e?.message || t('cameraCaptureError'));
    } finally { setCapturing(false); }
  };

  const retry = async () => {
    if (!job || !user) return;
    setError('');
    try {
      await retryOcrJobLocal(user.id, job.localId);
      await syncOcrQueue(user.id);
      const latest = await getOcrJobLocal(user.id, job.localId);
      if (latest) setJob(latest);
    } catch (e: any) { setError(e?.message || t('retryError')); }
  };

  const clearJob = async () => {
    if (job && user) await deleteOcrJobLocal(user.id, job.localId).catch(() => {});
    setJob(null);
  };

  if (!user) {
    return <SafeAreaView style={[styles.safe, isDark && styles.safeDark]}><View style={[styles.header, direction === 'ltr' && styles.rowLtr]}><Pressable onPress={() => router.back()}><Text style={styles.back}>{t('back')}</Text></Pressable><Text style={[styles.heading, isDark && styles.textDark]}>{t('cameraTitle')}</Text></View><View style={styles.permissionBox}><Text style={[styles.infoTitle, isDark && styles.textDark]}>{t('loginForOcr')}</Text><Text style={[styles.infoText, isDark && styles.mutedDark]}>{t('ocrNeedsAccount')}</Text><Pressable style={styles.primary} onPress={() => router.push('/login')}><Text style={styles.primaryText}>{t('login')}</Text></Pressable></View></SafeAreaView>;
  }

  if (!permission) return <SafeAreaView style={[styles.safe, isDark && styles.safeDark]}><ActivityIndicator color="#00A86B" /></SafeAreaView>;
  if (!permission.granted) {
    return <SafeAreaView style={[styles.safe, isDark && styles.safeDark]}><View style={[styles.header, direction === 'ltr' && styles.rowLtr]}><Pressable onPress={() => router.back()}><Text style={styles.back}>{t('back')}</Text></Pressable><Text style={[styles.heading, isDark && styles.textDark]}>{t('camera')}</Text></View><View style={styles.permissionBox}><Text style={[styles.infoTitle, isDark && styles.textDark]}>{t('cameraPermission')}</Text><Text style={[styles.infoText, isDark && styles.mutedDark]}>{t('cameraPermissionText')}</Text><Pressable style={styles.primary} onPress={requestPermission}><Text style={styles.primaryText}>{t('enableCamera')}</Text></Pressable></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.safe, isDark && styles.safeDark]}>
      <View style={[styles.header, direction === 'ltr' && styles.rowLtr]}><Pressable onPress={() => router.back()}><Text style={styles.back}>{t('back')}</Text></Pressable><Text style={[styles.heading, isDark && styles.textDark]}>{t('cameraTitle')}</Text></View>
      <Text style={[styles.hint, isDark && styles.mutedDark, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{t('cameraHint')}</Text>
      {!job || job.status === 'FAILED' || job.status === 'CANCELLED' ? <View style={styles.cameraWrap}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" onCameraReady={() => setReady(true)} />
        <View style={styles.frame} pointerEvents="none" />
        <Pressable style={[styles.capture, (!ready || capturing) && styles.disabled]} onPress={capture} disabled={!ready || capturing}>
          {capturing ? <ActivityIndicator color="#fff" /> : <Text style={styles.captureText}>●</Text>}
        </Pressable>
      </View> : <View style={[styles.jobCard, isDark && styles.cardDark]}>
        {job.status !== 'DONE' ? <><ActivityIndicator color="#00A86B" size="large" /><Text style={[styles.jobTitle, isDark && styles.textDark]}>{job.status === 'PENDING_UPLOAD' || job.status === 'RETRY_UPLOAD' ? t('imageSaved') : t('processingImage')}</Text><Text style={[styles.infoText, isDark && styles.mutedDark]}>{job.status === 'PENDING_UPLOAD' || job.status === 'RETRY_UPLOAD' ? t('autoSend') : t('ocrProcessing')}</Text></>
          : <><Text style={[styles.jobTitle, isDark && styles.textDark]}>{t('extractedText')}</Text>{job.confidence != null && <Text style={styles.confidence}>{t('confidence')}: {job.confidence}%</Text>}<ScrollView style={[styles.resultScroll, isDark && styles.resultScrollDark]}><Text selectable style={[styles.resultText, isDark && styles.textDark, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{job.resultText}</Text></ScrollView><Pressable style={styles.primary} onPress={() => Share.share({ message: job.resultText || '' })}><Text style={styles.primaryText}>{t('shareText')}</Text></Pressable><Pressable style={styles.secondary} onPress={() => router.push({ pathname: '/search', params: { q: (job.resultText || '').slice(0, 200) } })}><Text style={styles.secondaryText}>{t('searchText')}</Text></Pressable><Pressable style={styles.secondary} onPress={clearJob}><Text style={styles.secondaryText}>{t('newImage')}</Text></Pressable></>}
      </View>}
      {!!job?.errorMessage && <Text style={[styles.error, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{job.errorMessage}</Text>}
      {!!error && <Text style={[styles.error, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{error}</Text>}
      {(job?.status === 'FAILED' || job?.status === 'RETRY_UPLOAD') && <Pressable style={styles.retry} onPress={retry}><Text style={styles.retryText}>{t('retry')}</Text></Pressable>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7F8', paddingHorizontal: 16 }, safeDark: { backgroundColor: '#121212' }, textDark: { color: '#F4F7F5' }, cardDark: { backgroundColor: '#1E1E1E', borderColor: '#343A37' }, resultScrollDark: { backgroundColor: '#292F2C' }, mutedDark: { color: '#B4BDB8' }, rowLtr: { flexDirection: 'row' }, header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 }, heading: { fontSize: 19, fontWeight: '800', color: '#17231E' }, back: { color: '#0077C8', fontWeight: '700' },
  hint: { textAlign: 'right', color: '#65736C', lineHeight: 21, fontSize: 12, marginBottom: 12 }, cameraWrap: { flex: 1, minHeight: 360, maxHeight: 580, borderRadius: 22, overflow: 'hidden', backgroundColor: '#101815', justifyContent: 'center' }, camera: { flex: 1 }, frame: { position: 'absolute', left: '10%', right: '10%', top: '25%', bottom: '25%', borderWidth: 2, borderColor: '#00D68A', borderRadius: 16 }, capture: { position: 'absolute', bottom: 22, alignSelf: 'center', width: 70, height: 70, borderRadius: 35, backgroundColor: '#00A86B', borderWidth: 5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, captureText: { color: '#fff', fontSize: 32, lineHeight: 36 }, disabled: { opacity: 0.55 },
  permissionBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }, infoTitle: { color: '#17231E', fontSize: 18, fontWeight: '800', textAlign: 'center' }, infoText: { color: '#65736C', fontSize: 13, lineHeight: 22, textAlign: 'center', marginTop: 10, marginBottom: 18 }, primary: { backgroundColor: '#00A86B', borderRadius: 13, padding: 14, alignItems: 'center', marginTop: 12 }, primaryText: { color: '#fff', fontWeight: '800' }, secondary: { padding: 14, alignItems: 'center' }, secondaryText: { color: '#0077C8', fontWeight: '700' },
  jobCard: { flex: 1, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#E3ECE7', padding: 18, alignItems: 'center', justifyContent: 'center' }, jobTitle: { color: '#17231E', fontSize: 18, fontWeight: '800', marginTop: 12, textAlign: 'center' }, confidence: { color: '#008957', marginTop: 8, fontWeight: '700' }, resultScroll: { width: '100%', maxHeight: 340, marginTop: 16, borderRadius: 12, backgroundColor: '#F7F9F8', padding: 12 }, resultText: { color: '#25332C', fontSize: 14, lineHeight: 24, textAlign: 'right' }, error: { color: '#B3261E', textAlign: 'right', marginTop: 12 }, retry: { backgroundColor: '#FFF2E7', borderRadius: 12, padding: 13, alignItems: 'center', marginTop: 12 }, retryText: { color: '#A15B00', fontWeight: '800' },
});
