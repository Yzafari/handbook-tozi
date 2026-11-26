import React from 'react';
import { I18nManager, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../core/auth/AuthContext';
import { AppSettingsProvider, useAppSettings } from '../core/settings/AppSettingsContext';
import { ThemeProvider } from '../core/theme/ThemeContext';
import '../../global.css';

/**
 * The app chooses its own reading direction from the language setting
 * (`direction` in AppSettingsContext). A Persian phone whose OS locale is
 * Arabic/Persian makes React Native mirror every `row` layout automatically,
 * which then fights the explicit `row-reverse` styles used for RTL and leaves
 * elements such as the home logo on the wrong side. Turning the automatic
 * mirroring off gives one predictable LTR layout base that our own direction
 * styles control everywhere.
 *
 * `allowRTL(false)` has to be in effect when the native view is created; the
 * setting is applied on the next launch of the installed app.
 */
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

function AppNavigator() {
  const { isDark } = useAppSettings();

  // The root deliberately has no `direction` style: each screen applies the
  // language direction through explicit `row-reverse`/`textAlign` styles, and
  // letting Yoga mirror rows here would flip them a second time.
  return (
    <View style={styles.root}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: isDark ? '#121212' : '#F5F7F8' },
        }}
      />
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppSettingsProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </ThemeProvider>
    </AppSettingsProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
