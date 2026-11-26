import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Headset, MessageCircle, Network, TowerControl, Users, type LucideIcon } from 'lucide-react-native';
import { AppScreen } from '../features/common/AppScreen';
import { useDesignTokens } from '../core/theme/useDesignTokens';
import { getUi } from '../core/theme/gridhandUi';

type Department = {
  id: 'operations' | 'engineeringPlanning' | 'sales' | 'consultant';
  title: string;
  icon: LucideIcon;
  scope: string[];
};

const DEPARTMENTS: Department[] = [
  {
    id: 'operations',
    title: 'معاونت بهره‌برداری',
    icon: TowerControl,
    scope: ['مدیریت خاموشی و مانور شبکه', 'رسیدگی به حوادث خطوط ۲۰ کیلوولت', 'نگهداری پیشگیرانهٔ پست‌ها'],
  },
  {
    id: 'engineeringPlanning',
    title: 'معاونت مهندسی و برنامه‌ریزی',
    icon: Network,
    scope: ['طراحی و توسعهٔ شبکه', 'محاسبات فنی و مطالعات بار', 'استانداردها و مشخصات فنی'],
  },
  {
    id: 'sales',
    title: 'معاونت فروش و خدمات مشترکین',
    icon: Users,
    scope: ['انشعاب و تغییر تعرفه', 'قرائت، صورتحساب و وصول', 'رسیدگی به اعتراض مشترکین'],
  },
  {
    id: 'consultant',
    title: 'ناظر مشاور',
    icon: Headset,
    scope: ['نظارت بر اجرای پیمان', 'کنترل کیفیت و تحویل موقت', 'هماهنگی با پیمانکار'],
  },
];

export default function DepartmentsScreen() {
  const params = useLocalSearchParams<{ focus?: string }>();
  const router = useRouter();
  const { isDark, textAlign, rowDirection } = useDesignTokens();
  const ui = getUi(isDark);

  return (
    <AppScreen title="معاونت‌ها" subtitle="حوزهٔ مسئولیت هر معاونت و مسیر گفتگو">
      {DEPARTMENTS.map(department => {
        const focused = params.focus === department.id;
        const Icon = department.icon;
        return (
          <View key={department.id} style={[styles.card, { backgroundColor: ui.surface, borderColor: focused ? ui.accent : ui.border }]}>
            <View style={[styles.head, { flexDirection: rowDirection }]}>
              <View style={[styles.icon, { backgroundColor: ui.accentSoft }]}><Icon size={18} color={ui.accent} /></View>
              <Text style={[styles.title, { color: ui.text, textAlign }]}>{department.title}</Text>
            </View>
            {department.scope.map(item => (
              <View key={item} style={[styles.scopeRow, { flexDirection: rowDirection }]}>
                <View style={[styles.dot, { backgroundColor: ui.accent }]} />
                <Text style={[styles.scope, { color: ui.muted, textAlign }]}>{item}</Text>
              </View>
            ))}
            <Pressable onPress={() => router.push(`/chat?room=${department.id}`)}
              style={[styles.chatButton, { flexDirection: rowDirection, backgroundColor: ui.surfaceAlt }]}>
              <MessageCircle size={14} color={ui.blue} />
              <Text style={{ color: ui.blue, fontSize: 11, fontWeight: '800' }}>گفتگو با این معاونت</Text>
            </Pressable>
          </View>
        );
      })}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10 },
  head: { alignItems: 'center', gap: 9, marginBottom: 9 },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 14, fontWeight: '800' },
  scopeRow: { alignItems: 'center', gap: 8, marginBottom: 6 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  scope: { flex: 1, fontSize: 11.5, lineHeight: 19 },
  chatButton: { alignSelf: 'flex-start', alignItems: 'center', gap: 7, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 8, marginTop: 6 },
});
