import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight, Wrench } from 'lucide-react-native';
import VoltageDropScreen from '../../src/features/technical-tools/tools/electrical/voltage-drop/VoltageDropScreen';
import TransformerScreen from '../../src/features/technical-tools/tools/electrical/transformer/TransformerScreen';
import ClearancesScreen from '../../src/features/technical-tools/tools/mechanical/clearances/ClearancesScreen';
import AcsrScreen from '../../src/features/technical-tools/tools/mechanical/acsr/AcsrScreen';
import { ErrorBoundary } from '../../src/core/components/ErrorBoundary';
import { useTheme } from '../../src/core/theme/ThemeContext';

function UnderDevelopmentScreen() {
  const router = useRouter();
  const { isDark } = useTheme();

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-gray-50 dark:bg-gray-950">
      <View className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
        <TouchableOpacity
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="بازگشت"
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"
        >
          <ArrowRight size={20} color={isDark ? '#E5E7EB' : '#111827'} />
        </TouchableOpacity>

        <Text className="text-lg font-bold text-gray-900 dark:text-white">ابزار فنی</Text>

        <View className="h-10 w-10" />
      </View>

      <View className="flex-1 items-center justify-center px-6">
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950">
          <Wrench size={28} color={isDark ? '#93C5FD' : '#1D4ED8'} />
        </View>
        <Text className="mt-4 text-base font-bold text-gray-900 dark:text-white">
          در حال توسعه
        </Text>
        <Text className="mt-2 text-center text-sm leading-6 text-gray-500 dark:text-gray-400">
          این ابزار هنوز آماده استفاده نیست و به‌زودی اضافه می‌شود.
        </Text>
      </View>
    </SafeAreaView>
  );
}

export default function ToolRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const renderTool = () => {
    if (id === 'electrical.voltage-drop') {
      return <VoltageDropScreen />;
    }

    if (id === 'electrical.transformer') {
      return <TransformerScreen />;
    }

    if (id === 'mechanical.clearances') {
      return <ClearancesScreen />;
    }

    if (id === 'mechanical.acsr') {
      return <AcsrScreen />;
    }

    return <UnderDevelopmentScreen />;
  };

  return <ErrorBoundary resetKey={id}>{renderTool()}</ErrorBoundary>;
}
