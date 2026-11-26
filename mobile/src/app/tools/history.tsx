import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { AppScreen } from '../../features/common/AppScreen';
import { getCalculationHistory, type CalculationHistoryRecord } from '../../features/technical-tools/services/history.service';
import { useDesignTokens } from '../../core/theme/useDesignTokens';
import { getUi } from '../../core/theme/gridhandUi';

export default function CalculationHistoryScreen() {
  const { isDark, textAlign, rowDirection } = useDesignTokens();
  const ui = getUi(isDark);
  const [rows, setRows] = useState<CalculationHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await getCalculationHistory()); }
    catch { setRows([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <AppScreen title="تاریخچهٔ محاسبات" subtitle="محاسبات ابزارهای فنی روی همین گوشی ذخیره می‌شوند.">
      <Pressable onPress={() => void load()} style={[styles.refresh, { flexDirection: rowDirection, backgroundColor: ui.surface, borderColor: ui.border }]}>
        <RefreshCw size={14} color={ui.blue} />
        <Text style={{ color: ui.blue, fontWeight: '700', fontSize: 12 }}>بروزرسانی</Text>
      </Pressable>

      {loading && <ActivityIndicator color={ui.accent} style={{ marginTop: 24 }} />}
      {!loading && rows.length === 0 && (
        <Text style={{ color: ui.muted, textAlign, marginTop: 20 }}>هنوز محاسبه‌ای ثبت نشده است.</Text>
      )}

      {rows.map(row => (
        <View key={row.calculationId} style={[styles.card, { backgroundColor: ui.surface, borderColor: ui.border }]}>
          <Text style={[styles.id, { color: ui.text, textAlign }]}>{row.calculatorId}</Text>
          <Text style={[styles.inputs, { color: ui.muted }]}>{JSON.stringify(row.inputs)}</Text>
          <Text style={[styles.result, { color: ui.accent, textAlign }]}>{JSON.stringify(row.result)}</Text>
          <Text style={[styles.date, { color: ui.muted, textAlign }]}>{new Date(row.createdAt).toLocaleString('fa-IR')}</Text>
        </View>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  refresh: { alignSelf: 'flex-start', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14 },
  card: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 9 },
  id: { fontSize: 12, fontWeight: '800', writingDirection: 'ltr' },
  inputs: { fontSize: 11, marginTop: 6, writingDirection: 'ltr' },
  result: { fontSize: 13, fontWeight: '800', marginTop: 4, writingDirection: 'ltr' },
  date: { fontSize: 10, marginTop: 6 },
});
