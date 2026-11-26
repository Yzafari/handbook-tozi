import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '../features/common/AppScreen';
import { ConnectionTestCard } from '../features/diagnostics/ConnectionTestCard';
import { useDesignTokens } from '../core/theme/useDesignTokens';
import { getUi } from '../core/theme/gridhandUi';

export default function ConnectionTestScreen() {
  const { isDark, textAlign } = useDesignTokens();
  const ui = getUi(isDark);

  return (
    <AppScreen title="تست اتصال به سرور" subtitle="آدرس API و پاسخ /api/v1/health">
      <ConnectionTestCard autoRun />
      <View style={[styles.note, { backgroundColor: ui.surfaceAlt }]}>
        <Text style={[styles.noteTitle, { color: ui.text, textAlign }]}>راهنمای تفسیر نتیجه</Text>
        <Text style={[styles.noteText, { color: ui.muted, textAlign }]}>
          اگر «ناموفق» بود و خطای شبکه دیدید، مشکل از آدرس API، اینترنت گوشی یا دسترسی سرور است.
          اگر سلامت سرور «موفق» بود ولی ورود انجام نشد، مشکل از حساب کاربری، رمز عبور یا پایگاه داده است و باید در سرور بررسی شود.
        </Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  note: { borderRadius: 16, padding: 14, marginTop: 6 },
  noteTitle: { fontSize: 13, fontWeight: '800', marginBottom: 6 },
  noteText: { fontSize: 11, lineHeight: 20 },
});
