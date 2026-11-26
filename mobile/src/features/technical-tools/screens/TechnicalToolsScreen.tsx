import React, { useMemo, useState } from 'react';
import { FlatList, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowRight, History, Search } from 'lucide-react-native';
import {
  TOOLS,
  TOOL_CATEGORY_LABELS,
  type ToolCategory,
  type ToolDefinition,
} from '../registry/tools.registry';
import { useTheme } from '../../../core/theme/ThemeContext';

type CategoryFilter = 'all' | ToolCategory;

const CATEGORY_FILTERS: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: 'همه' },
  { key: 'electrical', label: TOOL_CATEGORY_LABELS.electrical },
  { key: 'mechanical', label: TOOL_CATEGORY_LABELS.mechanical },
  { key: 'civil', label: TOOL_CATEGORY_LABELS.civil },
];

export default function TechnicalToolsScreen() {
  const router = useRouter();
  const { isDark } = useTheme();

  const [query, setQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');

  const filteredTools = useMemo<ToolDefinition[]>(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return TOOLS.filter((tool) => {
      const matchesCategory = activeCategory === 'all' || tool.category === activeCategory;
      if (!matchesCategory) return false;

      if (!normalizedQuery) return true;

      return (
        tool.name.toLowerCase().includes(normalizedQuery) ||
        tool.description.toLowerCase().includes(normalizedQuery) ||
        tool.id.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [query, activeCategory]);

  const renderTool = ({ item }: { item: ToolDefinition }) => {
    const Icon = item.icon;
    const isAvailable = item.status === 'available';

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={item.name}
        onPress={() => router.push(`/tools/${item.id}`)}
        className="flex-row items-center rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
      >
        <View className="h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950">
          <Icon size={24} color={isDark ? '#93C5FD' : '#1D4ED8'} />
        </View>

        <View className="mx-3 flex-1">
          <Text className="text-base font-bold text-gray-900 dark:text-white">
            {item.name}
          </Text>
          <Text
            numberOfLines={2}
            className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400"
          >
            {item.description}
          </Text>
        </View>

        <View
          className={
            isAvailable
              ? 'rounded-full bg-green-100 px-2.5 py-1 dark:bg-green-900'
              : 'rounded-full bg-red-100 px-2.5 py-1 dark:bg-red-900'
          }
        >
          <Text
            className={
              isAvailable
                ? 'text-[10px] font-bold text-green-700 dark:text-green-300'
                : 'text-[10px] font-bold text-red-700 dark:text-red-300'
            }
          >
            {isAvailable ? 'فعال' : 'در حال توسعه'}
          </Text>
        </View>
      </TouchableOpacity>
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

        <Text className="text-lg font-bold text-gray-900 dark:text-white">ابزارها و محاسبات فنی</Text>

        <TouchableOpacity
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="تاریخچه محاسبات"
          onPress={() => router.push('/tools/history')}
          className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"
        >
          <History size={20} color={isDark ? '#E5E7EB' : '#111827'} />
        </TouchableOpacity>
      </View>

      <View className="mx-4 mt-4 flex-row items-center rounded-xl border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-800 dark:bg-gray-900">
        <Search size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          className="ml-2 flex-1 text-sm text-gray-900 dark:text-white"
          placeholder="جستجوی ابزار..."
          placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
          returnKeyType="search"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-4 py-3"
      >
        {CATEGORY_FILTERS.map((filter) => {
          const isActive = filter.key === activeCategory;

          return (
            <TouchableOpacity
              key={filter.key}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={filter.label}
              onPress={() => setActiveCategory(filter.key)}
              className={
                isActive
                  ? 'rounded-full bg-blue-600 px-4 py-2'
                  : 'rounded-full border border-gray-200 bg-white px-4 py-2 dark:border-gray-800 dark:bg-gray-900'
              }
            >
              <Text
                className={
                  isActive
                    ? 'text-xs font-bold text-white'
                    : 'text-xs font-semibold text-gray-600 dark:text-gray-300'
                }
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        className="flex-1"
        data={filteredTools}
        keyExtractor={(item) => item.id}
        renderItem={renderTool}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-3 px-4 pb-8"
        ListEmptyComponent={
          <View className="items-center justify-center py-16">
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              ابزاری با این مشخصات یافت نشد.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
