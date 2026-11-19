import React from 'react';
import { Text, View } from 'react-native';
import { AlertTriangle, CheckCircle } from 'lucide-react-native';
import type { VoltageDropResult } from '../services/calculator.service';
import { useTheme } from '../../../core/theme/ThemeContext';

type ResultDisplayProps = {
  result: VoltageDropResult;
};

export function ResultDisplay({ result }: ResultDisplayProps) {
  const { isDark } = useTheme();

  const isAllowed = result.status === 'مجاز';
  const Icon = isAllowed ? CheckCircle : AlertTriangle;

  const iconColor = isAllowed
    ? isDark
      ? '#4ADE80'
      : '#16A34A'
    : isDark
      ? '#F87171'
      : '#DC2626';

  const containerClass = isAllowed
    ? 'rounded-2xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20'
    : 'rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20';

  const titleClass = isAllowed
    ? 'text-sm font-bold text-green-700 dark:text-green-400'
    : 'text-sm font-bold text-red-700 dark:text-red-400';

  const valueClass = isAllowed
    ? 'text-lg font-bold text-green-700 dark:text-green-400'
    : 'text-lg font-bold text-red-700 dark:text-red-400';

  const labelClass = isAllowed
    ? 'text-[11px] text-green-700 dark:text-green-400'
    : 'text-[11px] text-red-700 dark:text-red-400';

  return (
    <View className={containerClass}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Icon size={20} color={iconColor} />
          <Text className={titleClass}>وضعیت: {result.status}</Text>
        </View>

        <View
          className={
            isAllowed
              ? 'rounded-full bg-green-600 px-2.5 py-1'
              : 'rounded-full bg-red-600 px-2.5 py-1'
          }
        >
          <Text className="text-[10px] font-bold text-white">
            {isAllowed ? 'حد مجاز رعایت شده' : 'بیش از حد مجاز'}
          </Text>
        </View>
      </View>

      <View className="mt-3 flex-row gap-3">
        <View className="flex-1 rounded-xl bg-white px-3 py-2.5 dark:bg-gray-900">
          <Text className={labelClass}>افت ولتاژ</Text>
          <Text className={`mt-1 ${valueClass}`}>{result.deltaV} V</Text>
        </View>

        <View className="flex-1 rounded-xl bg-white px-3 py-2.5 dark:bg-gray-900">
          <Text className={labelClass}>درصد افت ولتاژ</Text>
          <Text className={`mt-1 ${valueClass}`}>{result.percent}%</Text>
        </View>
      </View>

      <Text className="mt-3 text-right text-[10px] leading-5 text-gray-500 dark:text-gray-400">
        این محاسبه صرفا جنبه راهنما دارد و فرمول‌های نهایی در حال تأیید هستند.
      </Text>
    </View>
  );
}

export default ResultDisplay;
