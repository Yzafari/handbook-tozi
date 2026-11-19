import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight, Clock, FileQuestion, Share2 } from 'lucide-react-native';
import {
  getHistoryById,
  type CalculationHistoryRecord,
} from '../../../src/features/technical-tools/services/history.service';
import { TOOLS } from '../../../src/features/technical-tools/registry/tools.registry';
import { useTheme } from '../../../src/core/theme/ThemeContext';

const TOOL_NAMES: Record<string, string> = TOOLS.reduce<Record<string, string>>((acc, tool) => {
  acc[tool.id] = tool.name;
  return acc;
}, {});

function formatDate(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return iso;

  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '—';
    }
  }

  return String(value);
}

function buildShareMessage(record: CalculationHistoryRecord): string {
  const toolName = TOOL_NAMES[record.calculatorId] ?? record.calculatorId;

  const inputLines =
    Object.entries(record.inputs)
      .map(([key, value]) => `• ${key}: ${formatValue(value)}`)
      .join('\n') || '—';

  const resultLines =
    Object.entries(record.result)
      .map(([key, value]) => `• ${key}: ${formatValue(value)}`)
      .join('\n') || '—';

  return [
    `محاسبه ${toolName}`,
    `تاریخ: ${formatDate(record.createdAt)}`,
    `نسخه فرمول: ${record.formulaVersion}`,
    '',
    'ورودی‌ها:',
    inputLines,
    '',
    'خروجی‌ها:',
    resultLines,
  ].join('\n');
}

function KeyValueList({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);

  if (entries.length === 0) {
    return (
      <Text className="text-right text-[11px] text-gray-500 dark:text-gray-400">
        موردی ثبت نشده است.
      </Text>
    );
  }

  return (
    <View className="gap-2">
      {entries.map(([key, value]) => (
        <View
          key={key}
          className="flex-row items-start justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-800"
        >
          <Text className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
            {key}
          </Text>
          <Text className="flex-1 text-left text-[11px] font-bold text-gray-900 dark:text-white">
            {formatValue(value)}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function HistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isDark } = useTheme();

  const [record, setRecord] = useState<CalculationHistoryRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!id) {
        if (isMounted) {
          setIsLoading(false);
          setErrorMessage('شناسه محاسبه یافت نشد.');
        }
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const item = await getHistoryById(id);

        if (!isMounted) return;

        if (!item) {
          setRecord(null);
          setErrorMessage('محاسبه مورد نظر یافت نشد یا حذف شده است.');
        } else {
          setRecord(item);
        }
      } catch (error) {
        if (!isMounted) return;

        const message = error instanceof Error ? error.message : 'خطای ناشناخته';
        setRecord(null);
        setErrorMessage(`بارگذاری محاسبه با خطا مواجه شد: ${message}`);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleShare = useCallback(async () => {
    if (!record) return;

    const toolName = TOOL_NAMES[record.calculatorId] ?? record.calculatorId;

    try {
      await Share.share({
        title: `محاسبه ${toolName}`,
        message: buildShareMessage(record),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'خطای ناشناخته';
      Alert.alert('خطا در اشتراک‌گذاری', message);
    }
  }, [record]);

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

        <Text className="text-lg font-bold text-gray-900 dark:text-white">جزئیات محاسبه</Text>

        {record ? (
          <TouchableOpacity
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="اشتراک‌گذاری محاسبه"
            onPress={() => {
              void handleShare();
            }}
            className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"
          >
            <Share2 size={20} color={isDark ? '#E5E7EB' : '#111827'} />
          </TouchableOpacity>
        ) : (
          <View className="h-10 w-10" />
        )}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={isDark ? '#4ADE80' : '#16A34A'} />
          <Text className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            در حال بارگذاری محاسبه...
          </Text>
        </View>
      ) : !record ? (
        <View className="flex-1 items-center justify-center px-6">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
            <FileQuestion size={28} color={isDark ? '#9CA3AF' : '#6B7280'} />
          </View>

          <Text className="mt-4 text-base font-bold text-gray-900 dark:text-white">
            محاسبه یافت نشد
          </Text>

          <Text className="mt-2 text-center text-xs leading-5 text-gray-500 dark:text-gray-400">
            {errorMessage ?? 'محاسبه مورد نظر یافت نشد یا حذف شده است.'}
          </Text>

          <TouchableOpacity
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="بازگشت به تاریخچه"
            onPress={() => router.back()}
            className="mt-6 rounded-xl bg-blue-600 px-6 py-3"
          >
            <Text className="text-sm font-bold text-white">بازگشت به تاریخچه</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 py-5 pb-10">
          <View className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 text-right text-base font-bold text-gray-900 dark:text-white">
                {TOOL_NAMES[record.calculatorId] ?? record.calculatorId}
              </Text>

              <View className="rounded-full bg-gray-100 px-2.5 py-1 dark:bg-gray-800">
                <Text className="text-[10px] font-bold text-gray-600 dark:text-gray-300">
                  v{record.formulaVersion}
                </Text>
              </View>
            </View>

            <View className="mt-2 flex-row items-center gap-1.5">
              <Clock size={13} color={isDark ? '#9CA3AF' : '#6B7280'} />
              <Text className="text-[11px] text-gray-500 dark:text-gray-400">
                {formatDate(record.createdAt)}
              </Text>
            </View>
          </View>

          <View className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <Text className="mb-3 text-right text-sm font-bold text-gray-900 dark:text-white">
              ورودی‌ها
            </Text>
            <KeyValueList data={record.inputs} />
          </View>

          <View className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <Text className="mb-3 text-right text-sm font-bold text-gray-900 dark:text-white">
              خروجی‌ها
            </Text>
            <KeyValueList data={record.result} />
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="اشتراک‌گذاری محاسبه"
            onPress={() => {
              void handleShare();
            }}
            className="flex-row items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3.5"
          >
            <Share2 size={18} color="#FFFFFF" />
            <Text className="text-base font-bold text-white">اشتراک‌گذاری</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
