import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { randomUUID } from 'expo-crypto';
import { api } from '../../core/network/api';
import { useAuth } from '../../core/auth/AuthContext';
import { cacheDocument, getCachedDocument, getCachedDocumentEvictions, removeCachedDocument } from '../../core/offline/repository';
import type { SearchDocument } from '../../core/search/search';
import { useAppSettings } from '../../core/settings/AppSettingsContext';

const safeFileSegment = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
async function cleanupDocumentFiles(directory: string, prefix: string, keepUri?: string) {
  const names = await FileSystem.readDirectoryAsync(directory).catch(() => []);
  for (const name of names) {
    const uri = `${directory}${name}`;
    if (name.startsWith(`${prefix}.`) && uri !== keepUri) await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }
}

export default function DocumentScreen() {
  const params = useLocalSearchParams<{ id: string; page?: string }>();
  const { id } = params;
  const router = useRouter();
  const { user } = useAuth();
  const { t, isDark, direction } = useAppSettings();
  const userId = user?.id ?? 'guest';
  const [document, setDocument] = useState<SearchDocument | null>(null);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [offlineVersionStale, setOfflineVersionStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      const cached = await getCachedDocument(userId, String(id)).catch(() => null);
      let cachedFileExists = false;
      if (active && cached) {
        setDocument(cached.metadata as SearchDocument);
        if (cached.localUri) {
          const info = await FileSystem.getInfoAsync(cached.localUri).catch(() => ({ exists: false } as any));
          if (active && info.exists) {
            setLocalUri(cached.localUri); cachedFileExists = true;
            if (FileSystem.documentDirectory) {
              const directory = `${FileSystem.documentDirectory}handbook-documents/`;
              const filePrefix = `${safeFileSegment(userId)}_${safeFileSegment(String(id))}`;
              void cleanupDocumentFiles(directory, filePrefix, cached.localUri);
            }
          }
        }
      }
      try {
        const response = await api.get(`/documents/${encodeURIComponent(String(id))}`);
        const latest = response.data?.data?.document ?? response.data?.data;
        if (active && latest) {
          setDocument(latest);
          setOfflineVersionStale(Boolean(cachedFileExists && cached?.version && latest.updatedAt && cached.version !== latest.updatedAt));
          await cacheDocument({ userId, documentId: String(id), metadata: latest });
        }
      } catch (e: any) {
        if (active && !cached) setError(e?.response?.data?.error?.message || t('documentOnlineUnavailable'));
      } finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [id, userId]);

  const openDocument = async () => {
    if (!document) return;
    setWorking(true); setError('');
    try {
      if (localUri) {
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(localUri, { mimeType: document.mimeType, dialogTitle: document.title });
        else await Linking.openURL(localUri);
      } else {
        const response = await api.get(`/documents/${encodeURIComponent(String(id))}/open-link`);
        const url = response.data?.data?.url;
        if (!url) throw new Error(t('documentLinkError'));
        await Linking.openURL(params.page ? `${url}#page=${encodeURIComponent(String(params.page))}` : url);
      }
    } catch (e: any) { setError(e?.response?.data?.error?.message || e?.message || t('documentOpenError')); }
    finally { setWorking(false); }
  };

  const downloadOffline = async () => {
    if (!document || !FileSystem.documentDirectory) return;
    setWorking(true); setError('');
    try {
      const response = await api.get(`/documents/${encodeURIComponent(String(id))}/open-link`);
      const url = response.data?.data?.url;
      if (!url) throw new Error(t('documentDownloadLinkError'));
      const directory = `${FileSystem.documentDirectory}handbook-documents/`;
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true }).catch(() => {});
      const extension = document.mimeType === 'application/pdf' ? 'pdf' : document.mimeType === 'image/png' ? 'png' : document.mimeType === 'image/webp' ? 'webp' : document.mimeType === 'image/jpeg' ? 'jpg' : 'txt';
      const filePrefix = `${safeFileSegment(userId)}_${safeFileSegment(String(id))}`;
      const destination = `${directory}${filePrefix}.${randomUUID()}.${extension}`;
      const temporary = `${destination}.download`;
      await FileSystem.deleteAsync(temporary, { idempotent: true });
      let result: Awaited<ReturnType<typeof FileSystem.downloadAsync>>;
      try { result = await FileSystem.downloadAsync(url, temporary); }
      catch (downloadError) { await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => {}); throw downloadError; }
      if (result.status < 200 || result.status >= 300) {
        await FileSystem.deleteAsync(temporary, { idempotent: true });
        throw new Error(t('documentDownloadFailed', { status: result.status }));
      }
      const downloaded = await FileSystem.getInfoAsync(temporary);
      if (!downloaded.exists || !Number.isFinite(downloaded.size) || downloaded.size !== document.sizeBytes) {
        await FileSystem.deleteAsync(temporary, { idempotent: true });
        throw new Error(t('documentSizeMismatch'));
      }
      try { await FileSystem.moveAsync({ from: temporary, to: destination }); }
      catch (moveError) { await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => {}); throw moveError; }
      try {
        // The old path remains valid until this metadata pointer is committed.
        await cacheDocument({ userId, documentId: String(id), metadata: document, localUri: destination, version: document.updatedAt, sizeBytes: document.sizeBytes });
      } catch (cacheError) {
        await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => {});
        throw cacheError;
      }
      await cleanupDocumentFiles(directory, filePrefix, destination);
      const evictions = await getCachedDocumentEvictions(userId, String(id)).catch(() => []);
      for (const item of evictions) {
        await FileSystem.deleteAsync(item.localUri, { idempotent: true }).catch(() => {});
        await removeCachedDocument(userId, item.documentId).catch(() => {});
      }
      setLocalUri(destination); setOfflineVersionStale(false);
    } catch (e: any) { setError(e?.response?.data?.error?.message || e?.message || t('documentSaveOfflineError')); }
    finally { setWorking(false); }
  };

  const removeOffline = async () => {
    if (!localUri) return;
    setWorking(true);
    try {
      await FileSystem.deleteAsync(localUri, { idempotent: true });
      await removeCachedDocument(userId, String(id));
      const directory = `${FileSystem.documentDirectory}handbook-documents/`;
      const filePrefix = `${safeFileSegment(userId)}_${safeFileSegment(String(id))}`;
      await cleanupDocumentFiles(directory, filePrefix);
      setLocalUri(null);
    } catch (e: any) { setError(e?.message || t('documentRemoveOfflineError')); }
    finally { setWorking(false); }
  };

  return (
    <SafeAreaView style={[styles.safe, isDark && styles.safeDark]}>
      <View style={[styles.header, direction === 'ltr' && styles.rowLtr]}><Pressable onPress={() => router.back()}><Text style={styles.back}>{t('back')}</Text></Pressable><Text style={[styles.heading, isDark && styles.textDark]}>{t('documentDetails')}</Text></View>
      {loading && !document ? <ActivityIndicator color="#00A86B" style={{ marginTop: 50 }} /> : document ? <View style={[styles.card, isDark && styles.cardDark]}>
        <Text style={styles.icon}>{document.mimeType === 'application/pdf' ? '📕' : '📄'}</Text>
        <Text style={[styles.title, isDark && styles.textDark]}>{document.title}</Text>
        {!!params.page && <Text style={styles.pageHint}>{t('pageResult')} {params.page}</Text>}
        <Text style={[styles.meta, isDark && styles.mutedDark]}>{document.originalName}</Text>
        {!!document.description && <Text style={[styles.description, isDark && styles.mutedDark, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{document.description}</Text>}
        <View style={styles.details}><Text style={[styles.detail, isDark && styles.mutedDark]}>{t('size')}: {(document.sizeBytes / (1024 * 1024)).toFixed(2)} MB</Text><Text style={[styles.detail, isDark && styles.mutedDark]}>{t('pages')}: {document.pageCount ?? t('unknown')}</Text><Text style={[styles.detail, isDark && styles.mutedDark]}>{t('indexStatus')}: {document.indexStatus}</Text></View>
        <Pressable style={[styles.primary, working && styles.disabled]} onPress={openDocument} disabled={working}>{working ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{localUri ? t('openSaved') : t('openOriginal')}</Text>}</Pressable>
        {offlineVersionStale && <Text style={styles.stale}>{t('offlineStale')}</Text>}
        {!localUri || offlineVersionStale ? <Pressable style={styles.secondary} onPress={downloadOffline} disabled={working}><Text style={styles.secondaryText}>{localUri ? t('updateOffline') : t('saveOffline')}</Text></Pressable>
          : <><Text style={styles.saved}>{t('offlineAvailable')}</Text><Pressable style={styles.remove} onPress={removeOffline} disabled={working}><Text style={styles.removeText}>{t('removeOffline')}</Text></Pressable></>}
      </View> : <Text style={styles.error}>{error || t('documentNotFound')}</Text>}
      {!!error && document && <Text style={styles.error}>{error}</Text>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#F5F7F8', paddingHorizontal: 16 }, safeDark: { backgroundColor: '#121212' }, textDark: { color: '#F4F7F5' }, mutedDark: { color: '#B4BDB8' }, cardDark: { backgroundColor: '#1E1E1E', borderColor: '#343A37' }, rowLtr: { flexDirection: 'row' }, header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 }, heading: { color: '#17231E', fontSize: 20, fontWeight: '800' }, back: { color: '#0077C8', fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E4ECE7', alignItems: 'center' }, icon: { fontSize: 42 }, title: { color: '#17231E', fontSize: 18, fontWeight: '800', textAlign: 'center', marginTop: 12 }, meta: { color: '#7B8781', fontSize: 12, marginTop: 8, textAlign: 'center' }, description: { color: '#4E5D55', textAlign: 'right', lineHeight: 23, marginTop: 16, width: '100%' }, details: { width: '100%', borderTopWidth: 1, borderTopColor: '#EDF1EE', marginTop: 18, paddingTop: 12 }, detail: { color: '#637169', textAlign: 'right', marginVertical: 4, fontSize: 13 }, primary: { backgroundColor: '#00A86B', borderRadius: 13, padding: 15, alignItems: 'center', width: '100%', marginTop: 20 }, primaryText: { color: '#fff', fontWeight: '800' }, secondary: { backgroundColor: '#E8F5EF', borderRadius: 13, padding: 14, alignItems: 'center', width: '100%', marginTop: 9 }, secondaryText: { color: '#007A4D', fontWeight: '800' }, saved: { color: '#008957', fontSize: 11, marginTop: 12 }, remove: { padding: 12, marginTop: 5 }, removeText: { color: '#B3261E', fontWeight: '700', fontSize: 12 },   disabled: { opacity: 0.6 }, error: { color: '#B3261E', textAlign: 'right', marginTop: 16 },
  pageHint: { color: '#0077C8', fontSize: 12, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  stale: { color: '#8A5A00', backgroundColor: '#FFF4D6', borderRadius: 10, padding: 10, fontSize: 12, marginTop: 12, textAlign: 'right', width: '100%' },
});
