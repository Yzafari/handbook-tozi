import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../core/auth/AuthContext';
import { AppSettingsProvider, useAppSettings } from '../core/settings/AppSettingsContext';

function AppNavigator() {
  const { isDark } = useAppSettings();
  return <>
    <StatusBar style={isDark ? 'light' : 'dark'} />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: isDark ? '#121212' : '#F5F7F8' } }} />
  </>;
}

export default function RootLayout() {
  return <AppSettingsProvider><AuthProvider><AppNavigator /></AuthProvider></AppSettingsProvider>;
}
