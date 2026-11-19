import React from 'react';
import { ScrollView, Text, View } from 'react-native';

export type StaticTableColumn = {
  key: string;
  label: string;
  /** Column width in points. Falls back to DEFAULT_COLUMN_WIDTH. */
  width?: number;
};

export type StaticTableRow = Record<string, string | number>;

export type StaticTableData = {
  title: string;
  unit?: string;
  columns: StaticTableColumn[];
  rows: StaticTableRow[];
};

type StaticTableViewerProps = {
  data: StaticTableData;
};

const DEFAULT_COLUMN_WIDTH = 110;

function formatCell(value: string | number | undefined): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'number' && Number.isNaN(value)) return '—';
  return String(value);
}

export function StaticTableViewer({ data }: StaticTableViewerProps) {
  const { title, unit, columns, rows } = data;
  const lastColumnIndex = columns.length - 1;

  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text className="text-right text-sm font-bold text-gray-900 dark:text-white">
          {title}
        </Text>
        {unit ? (
          <Text className="text-right text-[11px] text-gray-500 dark:text-gray-400">
            واحد مقادیر: {unit}
          </Text>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerClassName="pb-1">
        <View className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <View className="flex-row border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
            {columns.map((column, index) => (
              <View
                key={column.key}
                style={{ width: column.width ?? DEFAULT_COLUMN_WIDTH }}
                className={
                  index < lastColumnIndex
                    ? 'justify-center border-l border-gray-200 px-3 py-3 dark:border-gray-700'
                    : 'justify-center px-3 py-3'
                }
              >
                <Text className="text-right text-xs font-bold text-gray-900 dark:text-white">
                  {column.label}
                </Text>
              </View>
            ))}
          </View>

          {rows.map((row, rowIndex) => (
            <View
              key={rowIndex}
              className={
                rowIndex < rows.length - 1
                  ? 'flex-row border-b border-gray-200 dark:border-gray-700'
                  : 'flex-row'
              }
            >
              {columns.map((column, index) => (
                <View
                  key={column.key}
                  style={{ width: column.width ?? DEFAULT_COLUMN_WIDTH }}
                  className={
                    index < lastColumnIndex
                      ? 'justify-center border-l border-gray-200 px-3 py-3 dark:border-gray-700'
                      : 'justify-center px-3 py-3'
                  }
                >
                  <Text className="text-right text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                    {formatCell(row[column.key])}
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
