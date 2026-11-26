import React, { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Briefcase, ExternalLink, Gavel, Store } from 'lucide-react-native';
import { AppScreen } from '../features/common/AppScreen';
import { useDesignTokens } from '../core/theme/useDesignTokens';
import { getUi } from '../core/theme/gridhandUi';

type SectionKey = 'tenders' | 'market' | 'jobs';

const SECTIONS: { key: SectionKey; label: string; icon: typeof Gavel }[] = [
  { key: 'tenders', label: 'مناقصات و مزایده‌ها', icon: Gavel },
  { key: 'market', label: 'بازار تجهیزات', icon: Store },
  { key: 'jobs', label: 'آگهی‌های کاری', icon: Briefcase },
];

const CONTENT: Record<SectionKey, { title: string; tag?: string; body: string }[]> = {
  tenders: [
    { title: 'شرایط عمومی شرکت در مناقصه', body: 'ثبت‌نام در سامانهٔ الکترونیکی، ارائهٔ ضمانت‌نامه، مدارک رتبه‌بندی و پاکت فنی و مالی.' },
    { title: 'مدارک لازم برای ارزیابی', body: 'اساسنامه، آگهی تأسیس و آخرین تغییرات، صورت‌های مالی دو سال، رتبهٔ پیمانکاری و سابقهٔ کار مشابه.' },
    { title: 'بررسی پیش از تسلیم پاکت', tag: 'چک‌لیست', body: 'کنترل مهلت، مبلغ ضمانت، امضا و مهر، فهرست بها و تطابق با شرایط خصوصی.' },
  ],
  market: [
    { title: 'کابل و هادی', body: 'کابل مسی و آلومینیومی فشار ضعیف و متوسط، سیم مهار و اتصالات.' },
    { title: 'ترانسفورماتور و تابلو', body: 'ترانس توزیع روغنی و خشک، تابلو فشار متوسط، کلید و سکسیونر.' },
    { title: 'تجهیزات اندازه‌گیری', body: 'کنتور تک‌فاز و سه‌فاز، CT و PT، مولتی‌متر و آشکارساز ولتاژ.' },
    { title: 'پایه و یراق', body: 'پایهٔ بتنی و فلزی، مقره، کراس‌آرم و مهاربندی خطوط هوایی.' },
  ],
  jobs: [
    { title: 'کارشناس بهره‌برداری شبکه', body: 'مدیریت خاموشی، مانور شبکه و رسیدگی به حوادث خطوط ۲۰ کیلوولت.' },
    { title: 'کارشناس طراحی و نظارت', body: 'طراحی شبکهٔ توزیع، محاسبهٔ افت ولتاژ و نظارت بر اجرای پیمانکار.' },
    { title: 'کارشناس خدمات مشترکین', body: 'پذیرش درخواست انشعاب، قرائت کنتور و رسیدگی به اعتراضات.' },
  ],
};

export default function OpportunitiesScreen() {
  const params = useLocalSearchParams<{ section?: string }>();
  const initial = (['tenders', 'market', 'jobs'] as SectionKey[]).includes(params.section as SectionKey)
    ? params.section as SectionKey
    : 'tenders';
  const { isDark, textAlign, rowDirection } = useDesignTokens();
  const ui = getUi(isDark);
  const [section, setSection] = useState<SectionKey>(initial);
  const items = useMemo(() => CONTENT[section], [section]);

  return (
    <AppScreen title="فرصت‌ها و خدمات" subtitle="مناقصات، بازار تجهیزات و آگهی‌های کاری">
      <View style={[styles.tabs, { flexDirection: rowDirection }]}>
        {SECTIONS.map(item => {
          const active = section === item.key;
          const Icon = item.icon;
          return (
            <Pressable key={item.key} onPress={() => setSection(item.key)}
              style={[styles.tab, { backgroundColor: active ? ui.accentSoft : ui.surface, borderColor: active ? ui.accent : ui.border }]}>
              <Icon size={14} color={active ? ui.accent : ui.muted} />
              <Text style={{ color: active ? ui.accent : ui.muted, fontSize: 10.5, fontWeight: '800', textAlign: 'center' }}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {items.map(item => (
        <View key={item.title} style={[styles.card, { backgroundColor: ui.surface, borderColor: ui.border }]}>
          <View style={[styles.head, { flexDirection: rowDirection }]}>
            <Text style={[styles.title, { color: ui.text, textAlign }]}>{item.title}</Text>
            {!!item.tag && <View style={[styles.tag, { backgroundColor: ui.surfaceAlt }]}><Text style={{ color: ui.muted, fontSize: 9, fontWeight: '800' }}>{item.tag}</Text></View>}
          </View>
          <Text style={[styles.body, { color: ui.muted, textAlign }]}>{item.body}</Text>
        </View>
      ))}

      {section === 'tenders' && (
        <Pressable onPress={() => Linking.openURL('https://www.setadiran.ir')} style={[styles.link, { flexDirection: rowDirection, borderColor: ui.border }]}>
          <ExternalLink size={15} color={ui.blue} />
          <Text style={{ color: ui.blue, fontSize: 11, fontWeight: '700' }}>سامانهٔ تدارکات الکترونیکی دولت (ستاد)</Text>
        </Pressable>
      )}

      <Text style={[styles.note, { color: ui.muted, textAlign }]}>
        این بخش راهنمای مرجع و فهرست خدمات است. فهرست زندهٔ آگهی‌ها پس از اتصال سرویس سرور در همین صفحه نمایش داده می‌شود.
      </Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  tabs: { gap: 7, marginBottom: 14 },
  tab: { flex: 1, alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 13, paddingVertical: 10, paddingHorizontal: 4 },
  card: { borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 9 },
  head: { alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 13, fontWeight: '800' },
  tag: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  body: { fontSize: 11.5, lineHeight: 20, marginTop: 6 },
  link: { alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 12, padding: 11, marginTop: 4 },
  note: { fontSize: 10, lineHeight: 17, marginTop: 16 },
});
