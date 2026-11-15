import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../core/auth/AuthContext';
import { getCachedSearchPage, searchDocuments } from '../core/search/search';
import type { SearchDocument, SearchFilters } from '../core/search/search';
import { useAppSettings } from '../core/settings/AppSettingsContext';

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const { user } = useAuth();
  const { t, isDark, direction } = useAppSettings();
  const userId = user?.id ?? 'guest';
  const [query, setQuery] = useState(params.q || '');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [items, setItems] = useState<SearchDocument[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => { if (params.q !== undefined) setQuery(String(params.q).slice(0, 200)); }, [params.q]);
  const sequence = useRef(0);

  const runSearch = useCallback(async (value: string) => {
    const q = value.trim();
    const current = ++sequence.current;
    requestRef.current?.abort();
    if (q.length < 2) { setItems([]); setCursor(null); setHasMore(false); setError(''); setOffline(false); return; }
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true); setError('');
    const cached = await getCachedSearchPage(userId, q, null, filters).catch(() => null);
    if (current !== sequence.current) return;
    if (cached) { setItems(cached.page.items); setCursor(cached.page.nextCursor); setHasMore(cached.page.hasMore); setOffline(cached.stale); }
    try {
      const page = await searchDocuments(userId, q, null, filters, controller.signal);
      if (current !== sequence.current) return;
      setItems(page.items); setCursor(page.nextCursor); setHasMore(page.hasMore); setOffline(false);
    } catch (e: any) {
      if (e?.code !== 'ERR_CANCELED' && current === sequence.current) {
        if (!cached) setError(t('searchUnavailable'));
        else setOffline(true);
      }
    } finally { if (current === sequence.current) setLoading(false); }
  }, [userId, filters, t]);

  useEffect(() => {
    const timer = setTimeout(() => { void runSearch(query); }, 400);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  useEffect(() => () => requestRef.current?.abort(), []);

  const loadMore = async () => {
    if (!hasMore || !cursor || loadingMore || query.trim().length < 2) return;
    setLoadingMore(true);
    const cached = await getCachedSearchPage(userId, query, cursor, filters).catch(() => null);
    try {
      const page = await searchDocuments(userId, query, cursor, filters);
      setItems((previous: SearchDocument[]) => [...previous, ...page.items.filter((item: SearchDocument) => !previous.some((old: SearchDocument) => old.id === item.id))]);
      setCursor(page.nextCursor); setHasMore(page.hasMore); setOffline(false);
    } catch {
      if (cached) {
        setItems((previous: SearchDocument[]) => [...previous, ...cached.page.items.filter((item: SearchDocument) => !previous.some((old: SearchDocument) => old.id === item.id))]);
        setCursor(cached.page.nextCursor); setHasMore(cached.page.hasMore); setOffline(true);
      } else setOffline(true);
    }
    finally { setLoadingMore(false); }
  };

  const renderItem = ({ item }: { item: SearchDocument }) => (
    <Pressable style={[styles.result, isDark && styles.cardDark]} onPress={() => router.push({ pathname: '/document/[id]', params: { id: item.id, page: item.pageNumber ? String(item.pageNumber) : undefined } })}>
      <View style={[styles.resultTop, direction === 'ltr' && styles.rowLtr]}>
        <Text style={styles.fileIcon}>{item.mimeType === 'application/pdf' ? '📕' : item.mimeType.startsWith('image/') ? '🖼️' : '📄'}</Text>
        <View style={styles.resultTitleWrap}><Text style={[styles.resultTitle, isDark && styles.textDark, { textAlign: direction === 'rtl' ? 'right' : 'left' }]} numberOfLines={2}>{item.title}</Text><Text style={[styles.resultMeta, isDark && styles.mutedDark, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{item.originalName} · {item.pageCount ? `${item.pageCount} صفحه` : 'سند'}{item.pageNumber ? ` · نتیجه در صفحه ${item.pageNumber}` : ''}</Text></View>
      </View>
      {!!item.snippets?.[0] && <Text style={[styles.snippet, isDark && styles.mutedDark, { textAlign: direction === 'rtl' ? 'right' : 'left' }]} numberOfLines={3}>{item.snippets[0]}</Text>}
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.safe, isDark && styles.safeDark]}>
      <View style={[styles.header, direction === 'ltr' && styles.rowLtr]}><Pressable onPress={() => router.back()}><Text style={styles.back}>{t('back')}</Text></Pressable><Text style={[styles.heading, isDark && styles.textDark]}>{t('search')}</Text></View>
      <View style={[styles.searchBox, isDark && styles.cardDark, direction === 'ltr' && styles.rowLtr]}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput value={query} onChangeText={setQuery} placeholder={t('searchPlaceholder')} placeholderTextColor="#87948E" style={[styles.input, isDark && styles.textDark]} textAlign={direction === 'rtl' ? 'right' : 'left'} returnKeyType="search" />
      </View>
      <View style={[styles.filters, direction === 'ltr' && styles.rowLtr]}>{([{ label: t('all'), value: undefined }, { label: 'PDF', value: 'pdf' as const }, { label: t('image'), value: 'image' as const }, { label: t('text'), value: 'text' as const }] as Array<{ label: string; value: SearchFilters['type'] }>).map(item => <Pressable key={item.label} style={[styles.filterChip, isDark && styles.filterChipDark, filters.type === item.value && styles.filterActive]} onPress={() => setFilters((previous: SearchFilters) => ({ ...previous, type: item.value }))}><Text style={[styles.filterText, isDark && styles.mutedDark, filters.type === item.value && styles.filterTextActive]}>{item.label}</Text></Pressable>)}</View>
      <View style={[styles.filters, direction === 'ltr' && styles.rowLtr]}>{([{ label: t('allLanguages'), value: undefined }, { label: t('persian'), value: 'fa' as const }, { label: t('english'), value: 'en' as const }, { label: t('kurdish'), value: 'ku' as const }] as Array<{ label: string; value: SearchFilters['language'] }>).map(item => <Pressable key={item.label} style={[styles.filterChip, isDark && styles.filterChipDark, filters.language === item.value && styles.filterActive]} onPress={() => setFilters((previous: SearchFilters) => ({ ...previous, language: item.value }))}><Text style={[styles.filterText, isDark && styles.mutedDark, filters.language === item.value && styles.filterTextActive]}>{item.label}</Text></Pressable>)}</View>
      {offline && <Text style={[styles.offline, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{t('searchOffline')}</Text>}
      {!!error && <Text style={[styles.error, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{error}</Text>}
      {query.trim().length < 2 ? <View style={styles.empty}><Text style={styles.emptyIcon}>⌕</Text><Text style={[styles.emptyTitle, isDark && styles.textDark]}>{t('searchStart')}</Text><Text style={[styles.emptyText, isDark && styles.mutedDark]}>{t('searchInstructions')}</Text></View>
        : loading && !items.length ? <ActivityIndicator style={{ marginTop: 36 }} color="#00A86B" size="large" />
        : <FlatList data={items} keyExtractor={(item: SearchDocument) => item.id} renderItem={renderItem} contentContainerStyle={styles.list} onEndReached={loadMore} onEndReachedThreshold={0.4}
            ListEmptyComponent={!loading ? <Text style={[styles.noResult, isDark && styles.mutedDark]}>{t('noResults')}</Text> : null}
            ListFooterComponent={loadingMore ? <ActivityIndicator color="#00A86B" style={{ padding: 18 }} /> : null} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7F8', paddingHorizontal: 16 }, safeDark: { backgroundColor: '#121212' }, filterChipDark: { backgroundColor: '#2A302D' }, textDark: { color: '#F4F7F5' }, mutedDark: { color: '#B4BDB8' }, cardDark: { backgroundColor: '#1E1E1E', borderColor: '#343A37' }, rowLtr: { flexDirection: 'row' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  heading: { color: '#17231E', fontSize: 20, fontWeight: '800' }, back: { color: '#0077C8', fontWeight: '700' },
  searchBox: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E1EAE5', borderRadius: 15, paddingHorizontal: 12, minHeight: 54 },
  searchIcon: { fontSize: 26, color: '#0077C8', paddingHorizontal: 6 }, input: { flex: 1, color: '#17231E', paddingVertical: 12, fontSize: 14 },
  offline: { color: '#A15B00', textAlign: 'right', fontSize: 12, marginTop: 10 }, error: { color: '#B3261E', textAlign: 'right', marginTop: 12 },
  empty: { alignItems: 'center', marginTop: 72, paddingHorizontal: 24 }, emptyIcon: { color: '#00A86B', fontSize: 54 }, emptyTitle: { fontSize: 17, color: '#17231E', fontWeight: '800', marginTop: 12 }, emptyText: { fontSize: 13, color: '#6B7972', textAlign: 'center', lineHeight: 22, marginTop: 8 },
  filters: { flexDirection: 'row-reverse', gap: 7, marginTop: 10 }, filterChip: { borderRadius: 18, backgroundColor: '#E9EFEB', paddingHorizontal: 14, paddingVertical: 8 }, filterActive: { backgroundColor: '#D8F2E5' }, filterText: { color: '#68756F', fontSize: 11, fontWeight: '700' }, filterTextActive: { color: '#007A4D' },
  list: { paddingTop: 12, paddingBottom: 32 }, result: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E6ECE8', padding: 14, marginBottom: 10 }, resultTop: { flexDirection: 'row-reverse', alignItems: 'center' }, fileIcon: { fontSize: 25, marginLeft: 10 }, resultTitleWrap: { flex: 1 }, resultTitle: { color: '#17231E', fontSize: 15, fontWeight: '800', textAlign: 'right' }, resultMeta: { color: '#7A8781', fontSize: 11, textAlign: 'right', marginTop: 5 }, snippet: { color: '#52615A', textAlign: 'right', fontSize: 12, lineHeight: 20, marginTop: 10 }, noResult: { color: '#748078', textAlign: 'center', padding: 30 },
});
