import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronDown, ChevronUp, FileText, Search } from 'lucide-react-native';
import { AppScreen } from '../features/common/AppScreen';
import { STANDARDS, type StandardEntry } from '../features/knowledge/data/standards';
import { useDesignTokens } from '../core/theme/useDesignTokens';
import { getUi } from '../core/theme/gridhandUi';

const CATEGORIES = ['همه', 'توانیر', 'ایمنی', 'تجهیزات', 'طراحی'] as const;

export default function StandardsScreen() {
  const { isDark, textAlign, rowDirection } = useDesignTokens();
  const ui = getUi(isDark);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('همه');
  const [openId, setOpenId] = useState<string | null>(null);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return STANDARDS.filter(item => {
      const inCategory = category === 'همه' || item.category === category;
      const matches = !q || [item.title, item.code, item.summary, item.appliesTo]
        .some(value => value.toLowerCase().includes(q));
      return inCategory && matches;
    });
  }, [query, category]);

  return (
    <AppScreen title="استانداردها و دستورالعمل‌ها" subtitle="مرجع سریع ضوابط توزیع، ایمنی و تجهیزات">
      <View style={[styles.search, { flexDirection: rowDirection, backgroundColor: ui.surface, borderColor: ui.border }]}>
        <Search size={17} color={ui.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="جستجوی استاندارد، شماره یا موضوع..."
          placeholderTextColor={ui.muted}
          style={[styles.searchInput, { color: ui.text, textAlign }]}
        />
      </View>

      <View style={styles.chips}>
        {CATEGORIES.map(item => {
          const active = item === category;
          return (
            <Pressable key={item} onPress={() => setCategory(item)}
              style={[styles.chip, { backgroundColor: active ? ui.accentSoft : ui.surface, borderColor: active ? ui.accent : ui.border }]}>
              <Text style={{ color: active ? ui.accent : ui.muted, fontSize: 11, fontWeight: '700' }}>{item}</Text>
            </Pressable>
          );
        })}
      </View>

      {items.length === 0 && <Text style={{ color: ui.muted, textAlign, marginTop: 24 }}>موردی با این مشخصات پیدا نشد.</Text>}

      {items.map((item: StandardEntry) => {
        const open = openId === item.id;
        return (
          <Pressable key={item.id} onPress={() => setOpenId(open ? null : item.id)}
            style={[styles.card, { backgroundColor: ui.surface, borderColor: ui.border }]}>
            <View style={[styles.cardHead, { flexDirection: rowDirection }]}>
              <View style={[styles.icon, { backgroundColor: ui.surfaceAlt }]}><FileText size={17} color={ui.blue} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.code, { color: ui.blue, textAlign }]}>{item.code}</Text>
                <Text style={[styles.title, { color: ui.text, textAlign }]}>{item.title}</Text>
              </View>
              {open ? <ChevronUp size={17} color={ui.muted} /> : <ChevronDown size={17} color={ui.muted} />}
            </View>
            {open && (
              <View style={[styles.body, { borderTopColor: ui.border }]}>
                <Text style={[styles.summary, { color: ui.muted, textAlign }]}>{item.summary}</Text>
                <Text style={[styles.applies, { color: ui.text, textAlign }]}>کاربرد: {item.appliesTo}</Text>
                <Text style={[styles.warning, { color: ui.muted, textAlign }]}>
                  این خلاصه فقط برای مرور سریع است؛ در تصمیم اجرایی به متن رسمی همان استاندارد مراجعه کنید.
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  search: { alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 13, paddingVertical: 4 },
  chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7, marginVertical: 12 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  card: { borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 9 },
  cardHead: { alignItems: 'center', gap: 10 },
  icon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  code: { fontSize: 10, fontWeight: '800' },
  title: { fontSize: 13, fontWeight: '800', marginTop: 3, lineHeight: 20 },
  body: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 10, paddingTop: 10, gap: 8 },
  summary: { fontSize: 12, lineHeight: 21 },
  applies: { fontSize: 11, fontWeight: '700' },
  warning: { fontSize: 10, lineHeight: 17 },
});
