import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, RefreshCw, Wifi, XCircle } from 'lucide-react-native';
import { useAppSettings } from '../../core/settings/AppSettingsContext';
import { useDesignTokens } from '../../core/theme/useDesignTokens';
import { getUi } from '../../core/theme/gridhandUi';
import { testApiConnection, type ConnectionTestResult } from '../../core/network/connectionTest';
import { getApiBaseUrl } from '../../core/network/api';

type Props = {
  /** Run a first check as soon as the card appears. */
  autoRun?: boolean;
};

/**
 * Shows exactly which API address the installed build uses and what
 * `/api/v1/health` returned, so a network problem can be told apart from a
 * server or credential problem without guessing.
 */
export function ConnectionTestCard({ autoRun = false }: Props) {
  const { isDark, textAlign, rowDirection } = useDesignTokens();
  const { t } = useAppSettings();
  const ui = getUi(isDark);
  const [result, setResult] = useState<ConnectionTestResult | null>(null);
  const [loading, setLoading] = useState(false);

  const apiUrl = React.useMemo(() => {
    try { return getApiBaseUrl(); } catch { return '—'; }
  }, []);

  const run = useCallback(async () => {
    setLoading(true);
    try { setResult(await testApiConnection()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (autoRun) void run(); }, [autoRun, run]);

  return (
    <View style={[styles.card, { backgroundColor: ui.surface, borderColor: ui.border }]}>
      <View style={[styles.head, { flexDirection: rowDirection }]}>
        <View style={[styles.icon, { backgroundColor: ui.accentSoft }]}>
          <Wifi size={18} color={ui.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: ui.text, textAlign }]}>{t('connectionTest')}</Text>
          <Text style={[styles.sub, { color: ui.muted, textAlign }]}>{t('connectionTestHint')}</Text>
        </View>
      </View>

      <View style={[styles.row, { borderTopColor: ui.border }]}>
        <Text style={[styles.label, { color: ui.muted, textAlign }]}>{t('apiAddress')}</Text>
        <Text selectable style={[styles.value, { color: ui.text, textAlign }]}>{result?.apiUrl ?? apiUrl}</Text>
      </View>

      {result && (
        <>
          <View style={styles.row}>
            <Text style={[styles.label, { color: ui.muted, textAlign }]}>/api/v1/health</Text>
            <View style={[styles.statusRow, { flexDirection: 'row-reverse' }]}>
              {result.ok ? <CheckCircle2 size={16} color={ui.accent} /> : <XCircle size={16} color={ui.danger} />}
              <Text style={[styles.value, { color: result.ok ? ui.accent : ui.danger, textAlign }]}>
                {result.ok ? t('connectionOk') : t('connectionFailed')} · {result.status ?? '—'} · {result.latencyMs} ms
              </Text>
            </View>
            <Text style={[styles.message, { color: ui.muted, textAlign }]}>{result.message}</Text>
            {result.health != null && (
              <Text selectable style={[styles.json, { color: ui.text, backgroundColor: ui.surfaceAlt }]}>
                {safeJson(result.health)}
              </Text>
            )}
          </View>
        </>
      )}

      <Pressable
        onPress={() => void run()}
        disabled={loading}
        accessibilityRole="button"
        style={({ pressed }) => [styles.button, { backgroundColor: ui.accent }, (pressed || loading) && { opacity: 0.7 }]}
      >
        {loading ? <ActivityIndicator color="#04140E" /> : (
          <>
            <RefreshCw size={16} color="#04140E" />
            <Text style={styles.buttonText}>{result ? t('retry') : t('testConnection')}</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

function safeJson(value: unknown): string {
  try { return JSON.stringify(value, null, 2).slice(0, 900); }
  catch { return String(value); }
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 15, marginBottom: 14 },
  head: { alignItems: 'center', gap: 10 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800' },
  sub: { fontSize: 11, lineHeight: 18, marginTop: 3 },
  row: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'transparent', marginTop: 12, paddingTop: 10, gap: 5 },
  label: { fontSize: 11, fontWeight: '700' },
  value: { fontSize: 13, fontWeight: '700', writingDirection: 'ltr' },
  statusRow: { alignItems: 'center', gap: 6, marginTop: 2 },
  message: { fontSize: 11, lineHeight: 18 },
  json: { fontSize: 10, lineHeight: 15, padding: 9, borderRadius: 10, writingDirection: 'ltr', fontVariant: ['tabular-nums'] },
  button: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, paddingVertical: 12, marginTop: 14 },
  buttonText: { color: '#04140E', fontSize: 13, fontWeight: '800' },
});
