import React from 'react';
import { ScrollView, Text, View } from 'react-native';

export type StaticTableRow = {
  id: number;
  condition: string;
  clearances: Record<string, number>;
};

export type StaticTableData = {
  title: string;
  unit: string;
  voltage_levels: string[];
  rows: StaticTableRow[];
};

type StaticTableViewerProps = {
  data: StaticTableData;
};

const CONDITION_COLUMN_WIDTH = 160;
const VALUE_COLUMN_WIDTH = 80;

function formatClearance(value: number | undefined): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return String(value);
}

export function StaticTableViewer({ data }: StaticTableViewerProps) {
  const { title, unit, voltage_levels: voltageLevels, rows } = data;

  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text className="text-right text-sm font-bold text-gray-900 dark:text-white">
          {title}
        </Text>
        <Text className="text-right text-[11px] text-gray-500 dark:text-gray-400">
          واحد مقادیر: {unit}
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerClassName="pb-1">
        <View className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <View className="flex-row border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
            <View
              style={{ width: CONDITION_COLUMN_WIDTH }}
              className="justify-center border-l border-gray-200 px-3 py-3 dark:border-gray-700"
            >
              <Text className="text-right text-xs font-bold text-gray-900 dark:text-white">
                شرح
              </Text>
            </View>

            {voltageLevels.map((level, index) => (
              <View
                key={level}
                style={{ width: VALUE_COLUMN_WIDTH }}
                className={
                  index < voltageLevels.length - 1
                    ? 'items-center justify-center border-l border-gray-200 px-2 py-3 dark:border-gray-700'
                    : 'items-center justify-center px-2 py-3'
                }
              >
                <Text className="text-xs font-bold text-gray-900 dark:text-white">{level}</Text>
              </View>
            ))}
          </View>

          {rows.map((row, rowIndex) => (
            <View
              key={row.id}
              className={
                rowIndex < rows.length - 1
                  ? 'flex-row border-b border-gray-200 dark:border-gray-700'
                  : 'flex-row'
              }
            >
              <View
                style={{ width: CONDITION_COLUMN_WIDTH }}
                className="justify-center border-l border-gray-200 px-3 py-3 dark:border-gray-700"
              >
                <Text className="text-right text-[11px] leading-5 text-gray-700 dark:text-gray-300">
                  {row.condition}
                </Text>
              </View>

              {voltageLevels.map((level, index) => (
                <View
                  key={`${row.id}-${level}`}
                  style={{ width: VALUE_COLUMN_WIDTH }}
                  className={
                    index < voltageLevels.length - 1
                      ? 'items-center justify-center border-l border-gray-200 px-2 py-3 dark:border-gray-700'
                      : 'items-center justify-center px-2 py-3'
                  }
                >
                  <Text className="text-[11px] font-semibold text-gray-900 dark:text-white">
                    {formatClearance(row.clearances[level])}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export default StaticTableViewer;
