import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppScreen } from '../../features/common/AppScreen';
import AcsrScreen from '../../features/technical-tools/tools/mechanical/acsr/AcsrScreen';
import ClearancesScreen from '../../features/technical-tools/tools/mechanical/clearances/ClearancesScreen';
import TransformerScreen from '../../features/technical-tools/tools/electrical/transformer/TransformerScreen';
import VoltageDropScreen from '../../features/technical-tools/tools/electrical/voltage-drop/VoltageDropScreen';
import { useDesignTokens } from '../../core/theme/useDesignTokens';
import { getUi } from '../../core/theme/gridhandUi';

/**
 * Routes every registered tool id to its screen. The registry keeps a tool
 * `under_development` unless a branch exists here, so a card never opens a
 * blank screen.
 */
const SCREENS: Record<string, React.ComponentType<any>> = {
  'electrical.voltage-drop': VoltageDropScreen,
  'electrical.transformer': TransformerScreen,
  'mechanical.clearances': ClearancesScreen,
  'mechanical.acsr': AcsrScreen,
};

export default function ToolRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { isDark, textAlign } = useDesignTokens();
  const ui = getUi(isDark);
  const Screen = id ? SCREENS[id] : undefined;

  if (!Screen) {
    return (
      <AppScreen title="ابزار فنی">
        <View style={[styles.empty, { backgroundColor: ui.surface, borderColor: ui.border }]}>
          <Text style={{ color: ui.muted, textAlign }}>این ابزار در این نسخه فعال نیست.</Text>
        </View>
      </AppScreen>
    );
  }

  return <Screen />;
}

const styles = StyleSheet.create({
  empty: { borderWidth: 1, borderRadius: 16, padding: 18 },
});
