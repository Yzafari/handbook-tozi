import React from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import {
  BarChart3,
  Bell,
  FileText,
  LayoutGrid,
  Map,
  Search,
  Settings,
  User,
  Wrench,
  type LucideIcon,
} from 'lucide-react-native';
import { useTheme } from '../src/core/theme/ThemeContext';
import { SearchBar } from '../src/features/home/components/SearchBar';
import { PunchBanner } from '../src/features/home/components/PunchBanner';
import { LiveChatCard, type LiveChatCardProps } from '../src/features/home/components/LiveChatCard';
import { DeputyCards } from '../src/features/home/components/DeputyCards';

type QuickAccessItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  route?: Href;
};

const QUICK_ACCESS: QuickAccessItem[] = [
  { id: 'tools', label: 'ابزارهای فنی', icon: Wrench, route: '/tools' },
  { id: 'gis', label: 'GIS', icon: Map },
  { id: 'stats', label: 'آمار', icon: BarChart3 },
  { id: 'documents', label: 'اسناد', icon: FileText },
  { id: 'other', label: 'سایر ماژول‌ها', icon: LayoutGrid },
];

const MOCK_CHATS: LiveChatCardProps[] = [
  {
    id: '1',
    name: 'مهندس نمونه',
    role: 'ناظر بهره‌برداری',
    province: 'کرمانشاه',
    message: 'دوستان در زمان مانور شبکه...',
    time: '۵ دقیقه پیش',
    isAudio: true,
  },
  {
    id: '2',
    name: 'علی احمدی',
    role: 'تکنسین خط گرم',
    province: 'اصفهان',
    message: 'سلام همکار، برای پانچ امروز هماهنگ کنیم.',
    time: '۱۰ دقیقه پیش',
    isAudio: false,
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { isDark } = useTheme();

  const gridIconColor = isDark ? '#E5E7EB' : '#1F2937';

  const handleQuickAccessPress = (item: QuickAccessItem) => {
    if (item.route) {
      router.push(item.route);
    }
  };

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-950">
      <SafeAreaView edges={['top']} className="bg-blue-950">
        <View className="px-4 pb-5 pt-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="اعلان‌ها"
                className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
              >
                <Bell size={20} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="تنظیمات"
                onPress={() => router.push('/settings')}
                className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
              >
                <Settings size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View className="flex-row items-center gap-3">
              <View className="items-end">
                <Text className="text-sm font-bold text-white">مهندس احمد رضایی</Text>
                <Text className="mt-0.5 text-[11px] text-blue-200">مدیر پروژه</Text>
              </View>

              <View>
                <View className="h-11 w-11 items-center justify-center rounded-full bg-white/15">
                  <User size={22} color="#FFFFFF" />
                </View>
                <View className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-blue-950 bg-green-500" />
              </View>
            </View>
          </View>

          <View className="mt-4 flex-row items-center rounded-xl bg-white/10 px-3 py-2.5">
            <Search size={18} color="#BFDBFE" />
            <TextInput
              className="ml-2 flex-1 text-sm text-white"
              placeholder="جستجو در ماژول‌ها..."
              placeholderTextColor="#93C5FD"
              returnKeyType="search"
            />
          </View>
        </View>
      </SafeAreaView>

      <ScrollView className="flex-1" contentContainerClassName="pb-10">
        <View className="mt-5 px-4">
          <Text className="mb-3 text-base font-bold text-gray-900 dark:text-white">
            دسترسی سریع
          </Text>

          <View className="flex-row">
            {QUICK_ACCESS.map((item) => {
              const Icon = item.icon;

              return (
                <View key={item.id} className="w-1/5 items-center">
                  <TouchableOpacity
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    onPress={() => handleQuickAccessPress(item)}
                    className="h-14 w-14 items-center justify-center rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
                  >
                    <Icon size={24} color={gridIconColor} />
                  </TouchableOpacity>

                  <Text
                    numberOfLines={2}
                    className="mt-2 text-center text-[11px] font-medium text-gray-700 dark:text-gray-300"
                  >
                    {item.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View className="mt-5 px-4">
          <SearchBar />
        </View>

        <View className="mt-4 px-4">
          <PunchBanner />
        </View>

        <View className="mt-6 px-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-bold text-gray-900 dark:text-white">
              گفت‌وگوی زنده همکاران
            </Text>
            <Text className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              مشاهده همه
            </Text>
          </View>

          <View className="gap-3">
            {MOCK_CHATS.map((chat) => (
              <LiveChatCard
                key={chat.id}
                id={chat.id}
                name={chat.name}
                role={chat.role}
                province={chat.province}
                message={chat.message}
                time={chat.time}
                isAudio={chat.isAudio}
              />
            ))}
          </View>
        </View>

        <View className="mt-6 px-4">
          <DeputyCards />
        </View>
      </ScrollView>
    </View>
  );
}
