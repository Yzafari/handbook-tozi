import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowRight, Clock, History as HistoryIcon, Inbox } from 'lucide-react-native';
import {
  getCalculationHistory,
  type CalculationHistoryRecord,
} from '../../src/features/technical-tools/services/history.service';
import { TOOLS } from '../../src/features/technical-tools/registry/tools.registry';
import { useTheme } from '../../src/core/theme/ThemeContext';

const TOOL_NAMES: Record<string, string> = TOOLS.reduce<Record<string, string>>((acc, tool) => {
  acc[tool.id] = tool.name;
  return acc;
}, {});

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

function summarizeInputs(inputs: Record<string, unknown>): string {
  const entries = Object.entries(inputs);

  if (entries.length === 0) return 'بدون ورودی ثبت‌شده';

  return entries
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${formatValue(value)}`)
    .join(' • ');
}

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

export default function CalculationHistoryScreen() {
  const router = useRouter();
  const { isDark } = useTheme();

  const [history, setHistory] = useState<CalculationHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadHistory = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'initial') {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const records = await getCalculationHistory();
      setHistory(records);
      setErrorMessage(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'خطای ناشناخته';
      setErrorMessage(`بارگذاری تاریخچه با خطا مواجه شد: ${message}`);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory('initial');
  }, [loadHistory]);

  const handleRefresh = useCallback(() => {
    void loadHistory('refresh');
  }, [loadHistory]);

  const renderItem = ({ item }: { item: CalculationHistoryRecord }) => {
    const toolName = TOOL_NAMES[item.calculatorId] ?? item.calculatorId;

    return (
      <View className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950">
              <HistoryIcon size={18} color={isDark ? '#93C5FD' : '#1D4ED8'} />
            </View>
            <Text
              numberOfLines={1}
              className="max-w-[190px] text-sm font-bold text-gray-900 dark:text-white"
            >
              {toolName}
            </Text>
          </View>

          <View className="rounded-full bg-gray-100 px-2.5 py-1 dark:bg-gray-800">
            <Text className="text-[10px] font-bold text-gray-600 dark:text-gray-300">
              v{item.formulaVersion}
            </Text>
          </View>
        </View>

        <View className="mt-3 flex-row items-center gap-1.5">
          <Clock size={13} color={isDark ? '#9CA3AF' : '#6B7280'} />
          <Text className="text-[11px] text-gray-500 dark:text-gray-400">
            {formatDate(item.createdAt)}
          </Text>
        </View>

        <View className="mt-3 rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-800">
          <Text
            numberOfLines={2}
            className="text-right text-[11px] leading-5 text-gray-600 dark:text-gray-300"
          >
            {summarizeInputs(item.inputs)}
          </Text>
        </View>
      </View>
    );
  };

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

        <Text className="text-lg font-bold text-gray-900 dark:text-white">تاریخچه محاسبات</Text>

        <View className="h-10 w-10" />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={isDark ? '#4ADE80' : '#16A34A'} />
          <Text className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            در حال بارگذاری تاریخچه...
          </Text>
        </View>
      ) : (
        <FlatList
          className="flex-1"
          data={history}
          keyExtractor={(item) => item.calculationId}
          renderItem={renderItem}
          contentContainerClassName="gap-3 px-4 py-4 pb-10"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={isDark ? '#4ADE80' : '#16A34A'}
            />
          }
          ListHeaderComponent={
            errorMessage ? (
              <View className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-900 dark:bg-red-950">
                <Text className="text-right text-[11px] leading-5 text-red-700 dark:text-red-300">
                  {errorMessage}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <View className="h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
                <Inbox size={28} color={isDark ? '#9CA3AF' : '#6B7280'} />
              </View>
              <Text className="mt-4 text-base font-bold text-gray-900 dark:text-white">
                هیچ محاسبه‌ای ثبت نشده است
              </Text>
              <Text className="mt-2 px-8 text-center text-xs leading-5 text-gray-500 dark:text-gray-400">
                پس از انجام محاسبات در ابزارهای فنی، نتایج در این بخش نمایش داده می‌شود.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
