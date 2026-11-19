import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import {
  StaticTableViewer,
  type StaticTableData,
  type StaticTableRow,
} from '../../../components/StaticTableViewer';
import { useTheme } from '../../../../../core/theme/ThemeContext';
import clearancesData from '../../../data/clearances_table.json';

/**
 * The clearances JSON stores a voltage matrix (voltage_levels + clearances).
 * StaticTableViewer expects a column-driven shape, so the matrix is flattened
 * into one column per voltage level here. The JSON file itself is unchanged.
 */
const TABLE_DATA: StaticTableData = {
  title: clearancesData.title,
  unit: clearancesData.unit,
  columns: [
    { key: 'condition', label: 'شرح', width: 160 },
    ...clearancesData.voltage_levels.map((level) => ({
      key: level,
      label: level,
      width: 80,
    })),
  ],
  rows: clearancesData.rows.map((row) => {
    const mapped: StaticTableRow = { condition: row.condition };

    for (const level of clearancesData.voltage_levels) {
      mapped[level] = row.clearances[level] ?? '—';
    }

    return mapped;
  }),
};

export default function ClearancesScreen() {
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

        <Text className="text-lg font-bold text-gray-900 dark:text-white">حریم هوایی هادی</Text>

        <View className="h-10 w-10" />
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-4 py-5 pb-10">
        <StaticTableViewer data={TABLE_DATA} />
      </ScrollView>
    </SafeAreaView>
  );
}
