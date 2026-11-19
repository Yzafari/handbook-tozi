import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowRight, Check, Monitor, Moon, Sun, type LucideIcon } from 'lucide-react-native';
import { useTheme, type ThemeMode } from '../src/core/theme/ThemeContext';

type ThemeOption = {
  value: ThemeMode;
  label: string;
  description: string;
  icon: LucideIcon;
};

const THEME_OPTIONS: ThemeOption[] = [
  {
    value: 'light',
    label: 'روشن',
    description: 'همیشه از پوسته روشن استفاده می‌شود',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'تاریک',
    description: 'همیشه از پوسته تاریک استفاده می‌شود',
    icon: Moon,
  },
  {
    value: 'system',
    label: 'هماهنگ با سیستم',
    description: 'پوسته بر اساس تنظیمات دستگاه تغییر می‌کند',
    icon: Monitor,
  },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { themeMode, isDark, setThemeMode } = useTheme();

  const handleSelect = (mode: ThemeMode) => {
    void setThemeMode(mode);
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

        <Text className="text-lg font-bold text-gray-900 dark:text-white">تنظیمات</Text>

        <View className="h-10 w-10" />
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4 py-5 pb-10">
        <View>
          <Text className="mb-3 text-sm font-bold text-gray-900 dark:text-white">
            ظاهر برنامه
          </Text>

          <View className="gap-3">
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = option.value === themeMode;

              return (
                <TouchableOpacity
                  key={option.value}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => handleSelect(option.value)}
                  className={
                    isSelected
                      ? 'flex-row items-center rounded-2xl border-2 border-green-600 bg-green-50 p-4 dark:bg-green-950'
                      : 'flex-row items-center rounded-2xl border-2 border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900'
                  }
                >
                  <View
                    className={
                      isSelected
                        ? 'h-11 w-11 items-center justify-center rounded-xl bg-green-600'
                        : 'h-11 w-11 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800'
                    }
                  >
                    <Icon size={22} color={isSelected ? '#FFFFFF' : isDark ? '#9CA3AF' : '#6B7280'} />
                  </View>

                  <View className="mx-3 flex-1">
                    <Text
                      className={
                        isSelected
                          ? 'text-right text-base font-bold text-green-700 dark:text-green-300'
                          : 'text-right text-base font-bold text-gray-900 dark:text-white'
                      }
                    >
                      {option.label}
                    </Text>
                    <Text
                      className={
                        isSelected
                          ? 'mt-1 text-right text-xs leading-5 text-green-700 dark:text-green-400'
                          : 'mt-1 text-right text-xs leading-5 text-gray-500 dark:text-gray-400'
                      }
                    >
                      {option.description}
                    </Text>
                  </View>

                  {isSelected ? (
                    <View className="h-6 w-6 items-center justify-center rounded-full bg-green-600">
                      <Check size={14} color="#FFFFFF" />
                    </View>
                  ) : (
                    <View className="h-6 w-6 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
