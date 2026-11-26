import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useAppSettings } from '../../core/settings/AppSettingsContext';
import { useDesignTokens } from '../../core/theme/useDesignTokens';
import { getUi, type Ui } from '../../core/theme/gridhandUi';

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
};

/**
 * Shared, direction-aware screen frame for the content modules. Keeping the
 * header/back-arrow logic in one place is what makes the layout consistent
 * across the app on RTL devices.
 */
export function AppScreen({ title, subtitle, children, scroll = true, contentStyle }: Props) {
  const router = useRouter();
  const { t } = useAppSettings();
  const { isDark, isRTL, textAlign, rowDirection } = useDesignTokens();
  const ui = getUi(isDark);
  const s = React.useMemo(() => createStyles(ui, textAlign, rowDirection), [ui, textAlign, rowDirection]);
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={s.backBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('back')}
        >
          <BackIcon size={20} color={ui.text} />
        </Pressable>
        <View style={s.headerText}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          {!!subtitle && <Text style={s.subtitle} numberOfLines={2}>{subtitle}</Text>}
        </View>
      </View>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[s.body, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[s.body, { flex: 1 }, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function SectionTitle({ children, ui, align }: { children: React.ReactNode; ui: Ui; align: 'left' | 'right' }) {
  return <Text style={{ color: ui.text, fontSize: 15, fontWeight: '800', marginTop: 18, marginBottom: 8, textAlign: align }}>{children}</Text>;
}

export function Card({ children, ui, style }: { children: React.ReactNode; ui: Ui; style?: ViewStyle }) {
  return (
    <View style={[{ backgroundColor: ui.surface, borderWidth: 1, borderColor: ui.border, borderRadius: 18, padding: 15, marginBottom: 10 }, style]}>
      {children}
    </View>
  );
}

const createStyles = (ui: Ui, align: 'left' | 'right', row: 'row' | 'row-reverse') => StyleSheet.create({
  safe: { flex: 1, backgroundColor: ui.bg },
  header: { flexDirection: row, alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: ui.surface, borderWidth: 1, borderColor: ui.border, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  title: { color: ui.text, fontSize: 18, fontWeight: '800', textAlign: align },
  subtitle: { color: ui.muted, fontSize: 11, lineHeight: 17, marginTop: 3, textAlign: align },
  body: { padding: 16, paddingBottom: 40 },
});
