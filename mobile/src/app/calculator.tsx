import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../core/auth/AuthContext';
import { evaluateExpression, formatCalculatorResult } from '../core/calculations/expression';
import { listCalculations, saveCalculation } from '../core/offline/repository';
import { useAppSettings } from '../core/settings/AppSettingsContext';

type CalculationEntry = { id: string; expression: string; result: string; createdAt: string };
const KEYS = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '(', ')', '%', '+', '⌫', 'C'];

export default function CalculatorScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, isDark, direction } = useAppSettings();
  const userId = user?.id ?? 'guest';
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<CalculationEntry[]>([]);

  const loadHistory = useCallback(async () => {
    const items = await listCalculations(userId).catch(() => []);
    setHistory(items.slice(0, 8) as CalculationEntry[]);
  }, [userId]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const pressKey = (key: string) => {
    setError(''); setResult(null);
    if (key === 'C') { setExpression(''); return; }
    if (key === '⌫') { setExpression((value: string) => value.slice(0, -1)); return; }
    const translated = key === '×' ? '*' : key === '÷' ? '/' : key === '−' ? '-' : key;
    setExpression((value: string) => (value + translated).slice(0, 120));
  };

  const calculate = async () => {
    try {
      const value = evaluateExpression(expression);
      const formatted = formatCalculatorResult(value);
      setResult(formatted); setError('');
      await saveCalculation({ userId, calculatorId: 'general', formulaVersion: '1.0.0', inputs: { expression }, result: { value } }).catch(() => {});
      await loadHistory();
    } catch (e: any) { setResult(null); setError(e?.message || t('calculationFailed')); }
  };

  return (
    <SafeAreaView style={[styles.safe, isDark && styles.safeDark]}>
      <View style={[styles.header, direction === 'ltr' && styles.rowLtr]}><Pressable onPress={() => router.back()}><Text style={styles.back}>{t('back')}</Text></Pressable><Text style={[styles.heading, isDark && styles.textDark]}>{t('calculator')}</Text></View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.display}>
          <Text style={styles.expression} numberOfLines={2}>{expression || '۰'}</Text>
          <Text style={styles.result}>{result ?? ' '}</Text>
          {!!error && <Text style={[styles.error, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}>{error}</Text>}
        </View>
        <View style={styles.keypad}>{KEYS.map(key => <Pressable key={key} style={[styles.key, isDark && styles.keyDark, ['÷', '×', '−', '+', '%'].includes(key) && styles.operatorKey, key === 'C' && styles.clearKey, key === '⌫' && styles.deleteKey]} onPress={() => pressKey(key)}><Text style={[styles.keyText, isDark && styles.textDark, ['÷', '×', '−', '+', '%'].includes(key) && styles.operatorText, key === 'C' && styles.clearText]}>{key}</Text></Pressable>)}</View>
        <Pressable style={styles.equals} onPress={calculate}><Text style={styles.equalsText}>= {t('calculate')}</Text></Pressable>
        <View style={[styles.historyHeader, direction === 'ltr' && styles.rowLtr]}><Text style={[styles.historyTitle, isDark && styles.textDark]}>{t('recentCalculations')}</Text><Pressable onPress={() => void loadHistory()}><Text style={styles.refresh}>{t('refresh')}</Text></Pressable></View>
        {history.length ? history.map((item: CalculationEntry) => <Pressable key={item.id} style={[styles.historyRow, isDark && styles.cardDark]} onPress={() => { setExpression(item.expression); setResult(item.result); setError(''); }}><Text style={[styles.historyResult, isDark && styles.historyResultDark]}>{formatCalculatorResult(Number(item.result))}</Text><Text style={[styles.historyExpression, isDark && styles.mutedDark]}>{item.expression}</Text></Pressable>) : <Text style={[styles.empty, isDark && styles.mutedDark]}>{t('historyEmpty')}</Text>}
        <Text style={[styles.note, isDark && styles.mutedDark]}>{t('historyOffline')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7F8' }, safeDark: { backgroundColor: '#121212' }, textDark: { color: '#F4F7F5' }, mutedDark: { color: '#B4BDB8' }, cardDark: { backgroundColor: '#1E1E1E', borderColor: '#343A37' }, rowLtr: { flexDirection: 'row' }, header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14 }, heading: { color: '#17231E', fontSize: 19, fontWeight: '800' }, back: { color: '#0077C8', fontWeight: '700' }, content: { padding: 16, paddingBottom: 36 },
  display: { backgroundColor: '#172A22', borderRadius: 20, padding: 20, minHeight: 132, justifyContent: 'space-between' }, expression: { color: '#D6E6DE', fontSize: 24, textAlign: 'left', minHeight: 34 }, result: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', textAlign: 'left', marginTop: 14 }, error: { color: '#FFB4AB', fontSize: 12, textAlign: 'right', marginTop: 8 },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 16 }, key: { width: '23.5%', height: 58, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5ECE8', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }, keyText: { color: '#26372F', fontSize: 22, fontWeight: '700' }, operatorKey: { backgroundColor: '#E5F4EC' }, operatorText: { color: '#007A4D' }, clearKey: { backgroundColor: '#FDECEA' }, clearText: { color: '#B3261E' }, deleteKey: { backgroundColor: '#EEF3F6' },
  equals: { backgroundColor: '#00A86B', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 2 }, equalsText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' }, historyHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 8 }, historyTitle: { color: '#24342C', fontSize: 15, fontWeight: '800' }, refresh: { color: '#0077C8', fontSize: 11, fontWeight: '700' }, historyRow: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginBottom: 7, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, historyResult: { color: '#007A4D', fontWeight: '800', fontSize: 14 }, historyExpression: { color: '#69776F', fontSize: 12 }, empty: { color: '#87938C', textAlign: 'center', padding: 18, fontSize: 12 },   note: { color: '#8A968F', textAlign: 'center', fontSize: 10, marginTop: 12 },
  keyDark: { backgroundColor: '#1E1E1E', borderColor: '#343A37' },
  historyResultDark: { color: '#7BE3B0' },
});
