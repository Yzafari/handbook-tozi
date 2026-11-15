import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../core/auth/AuthContext';
import { listNotebookEntries, saveNotebookEntry } from '../core/offline/repository';
import { resolveNotebookConflict } from '../core/sync/transport';
import { useAppSettings } from '../core/settings/AppSettingsContext';

type Entry = Awaited<ReturnType<typeof listNotebookEntries>>[number];

export default function NotebookScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, isDark, direction } = useAppSettings();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [editingId, setEditingId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try { setEntries(await listNotebookEntries(user.id)); }
    catch { setError(t('readNotesError')); }
    finally { setLoading(false); }
  }, [user?.id, t]);

  useEffect(() => { void refresh(); }, [refresh]);

  const save = async () => {
    if (!user) { router.push('/login'); return; }
    if (!title.trim() || !body.trim()) { setError(t('titleAndBodyRequired')); return; }
    setSaving(true); setError('');
    try {
      await saveNotebookEntry({ userId: user.id, entryId: editingId, title: title.trim(), body });
      setTitle(''); setBody(''); setEditingId(undefined); await refresh();
    } catch (e: any) { setError(e?.message || t('saveNoteError')); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={[styles.safe, isDark && styles.safeDark]}>
      <View style={[styles.header, direction === 'ltr' && styles.rowLtr]}><Pressable onPress={() => router.back()}><Text style={styles.back}>{t('back')}</Text></Pressable><Text style={[styles.heading, isDark && styles.textDark]}>{t('notebook')}</Text></View>
      {!user ? <View style={styles.empty}><Text style={[styles.title, isDark && styles.textDark]}>{t('loginToSave')}</Text><Pressable style={styles.primary} onPress={() => router.push('/login')}><Text style={styles.primaryText}>{t('login')}</Text></Pressable></View> : <ScrollView keyboardShouldPersistTaps="handled">
        <View style={[styles.editor, isDark && styles.cardDark]}><Text style={[styles.editorTitle, isDark && styles.textDark]}>{editingId ? t('editNote') : t('newNote')}</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder={t('noteTitle')} textAlign={direction === 'rtl' ? 'right' : 'left'} style={[styles.titleInput, isDark && styles.inputDark]} />
          <TextInput value={body} onChangeText={setBody} placeholder={t('noteBodyPlaceholder')} textAlign={direction === 'rtl' ? 'right' : 'left'} multiline style={[styles.bodyInput, isDark && styles.inputDark]} />
          {!!error && <Text style={[styles.error, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{error}</Text>}
          <Pressable style={[styles.primary, saving && styles.disabled]} onPress={save} disabled={saving}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('saveToPhone')}</Text>}</Pressable>
          {editingId && <Pressable style={styles.cancel} onPress={() => { setEditingId(undefined); setTitle(''); setBody(''); }}><Text style={styles.cancelText}>{t('cancelEdit')}</Text></Pressable>}
          <Text style={[styles.offlineNote, isDark && styles.mutedDark, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{t('offlineNote')}</Text>
        </View>
        <View style={[styles.listHeader, direction === 'ltr' && styles.rowLtr]}><Text style={[styles.listTitle, isDark && styles.textDark]}>{t('myNotes')}</Text><Pressable onPress={refresh}><Text style={styles.refresh}>{t('refresh')}</Text></Pressable></View>
        {loading ? <ActivityIndicator color="#00A86B" style={{ margin: 20 }} /> : entries.length ? entries.map((entry: Entry) => <View key={entry.entryId} style={[styles.entry, isDark && styles.cardDark]}><Pressable onPress={() => { setEditingId(entry.entryId); setTitle(entry.title); setBody(entry.body); }}>
          <Text style={[styles.entryTitle, isDark && styles.textDark, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{entry.title}</Text><Text numberOfLines={2} style={[styles.entryBody, isDark && styles.mutedDark, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{entry.body}</Text><Text style={styles.entryStatus}>{entry.syncStatus === 'SYNCED' ? t('synced') : entry.syncStatus === 'CONFLICT' ? t('conflict') : t('savedPending')}</Text>
        </Pressable>{entry.syncStatus === 'CONFLICT' && <View style={styles.conflictActions}><Pressable style={styles.keepLocal} onPress={async () => { try { await resolveNotebookConflict(user.id, entry.entryId, 'LOCAL'); await refresh(); } catch (e: any) { setError(e?.message || t('resolveConflictError')); } }}><Text style={styles.keepLocalText}>{t('keepMine')}</Text></Pressable><Pressable style={styles.useServer} onPress={async () => { try { await resolveNotebookConflict(user.id, entry.entryId, 'SERVER'); await refresh(); } catch (e: any) { setError(e?.message || t('resolveConflictError')); } }}><Text style={styles.useServerText}>{t('useServer')}</Text></Pressable></View>}</View>) : <Text style={[styles.emptyText, isDark && styles.mutedDark]}>{t('noNotes')}</Text>}
      </ScrollView>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#F5F7F8', paddingHorizontal: 15 }, safeDark: { backgroundColor: '#121212' }, textDark: { color: '#F4F7F5' }, mutedDark: { color: '#B4BDB8' }, cardDark: { backgroundColor: '#1E1E1E', borderColor: '#343A37' }, inputDark: { backgroundColor: '#292F2C', color: '#F4F7F5' }, rowLtr: { flexDirection: 'row' }, header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13 }, heading: { color: '#17231E', fontSize: 20, fontWeight: '900' }, back: { color: '#0077C8', fontWeight: '700' },
  editor: { backgroundColor: '#fff', borderRadius: 17, padding: 14, borderWidth: 1, borderColor: '#E4ECE7' }, editorTitle: { color: '#1B2B23', fontWeight: '900', textAlign: 'right', marginBottom: 10 }, titleInput: { backgroundColor: '#F7F9F8', borderRadius: 10, padding: 12, color: '#17231E', marginBottom: 9 }, bodyInput: { backgroundColor: '#F7F9F8', borderRadius: 10, padding: 12, color: '#17231E', minHeight: 120, textAlignVertical: 'top' },
  primary: { backgroundColor: '#00A86B', borderRadius: 12, padding: 13, alignItems: 'center', marginTop: 10 }, primaryText: { color: '#fff', fontWeight: '800' }, disabled: { opacity: 0.6 }, cancel: { padding: 10, alignItems: 'center' }, cancelText: { color: '#0077C8', fontWeight: '700' }, offlineNote: { color: '#7C8982', fontSize: 10, lineHeight: 17, textAlign: 'right', marginTop: 10 },
  conflictActions: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 8, marginTop: 10 }, keepLocal: { flex: 1, backgroundColor: '#FFF3E5', padding: 9, borderRadius: 9, alignItems: 'center' }, keepLocalText: { color: '#965000', fontWeight: '700', fontSize: 10 }, useServer: { flex: 1, backgroundColor: '#E8F5EF', padding: 9, borderRadius: 9, alignItems: 'center' }, useServerText: { color: '#007A4D', fontWeight: '700', fontSize: 10 },
  listHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 }, listTitle: { color: '#1B2B23', fontWeight: '900', fontSize: 15 }, refresh: { color: '#0077C8', fontWeight: '700' }, entry: { backgroundColor: '#fff', borderRadius: 14, padding: 13, marginBottom: 8, borderWidth: 1, borderColor: '#E7EDE9' }, entryTitle: { color: '#1B2B23', textAlign: 'right', fontWeight: '800' }, entryBody: { color: '#5F6E66', textAlign: 'right', marginTop: 6, lineHeight: 19, fontSize: 12 }, entryStatus: { color: '#008957', textAlign: 'right', marginTop: 8, fontSize: 10 }, empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }, title: { color: '#17231E', fontWeight: '800', fontSize: 16, textAlign: 'center' }, emptyText: { textAlign: 'center', color: '#7B8982', marginVertical: 24 }, error: { color: '#B3261E', textAlign: 'right', marginTop: 8 },
});
