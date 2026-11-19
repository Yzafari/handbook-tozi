import React from 'react';
import { Text, View } from 'react-native';
import { Play, User } from 'lucide-react-native';
import { useTheme } from '../../../core/theme/ThemeContext';

export type LiveChatCardProps = {
  id: string;
  name: string;
  role: string;
  province: string;
  message: string;
  time: string;
  isAudio: boolean;
};

export function LiveChatCard({
  id,
  name,
  role,
  province,
  message,
  time,
  isAudio,
}: LiveChatCardProps) {
  const { isDark } = useTheme();

  return (
    <View
      testID={`live-chat-card-${id}`}
      className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
    >
      <View className="flex-row items-center">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
          <User size={20} color={isDark ? '#93C5FD' : '#1D4ED8'} />
        </View>

        <View className="mx-3 flex-1">
          <Text className="text-right text-sm font-bold text-gray-900 dark:text-white">
            {name}
          </Text>
          <Text className="mt-0.5 text-right text-[11px] text-gray-500 dark:text-gray-400">
            {role} • {province}
          </Text>
        </View>

        <Text className="text-[10px] text-gray-400 dark:text-gray-500">{time}</Text>
      </View>

      <View className="mt-3 flex-row items-center gap-2 rounded-xl bg-gray-100 px-3 py-2.5 dark:bg-gray-800">
        {isAudio ? (
          <View className="h-7 w-7 items-center justify-center rounded-full bg-green-600">
            <Play size={14} color="#FFFFFF" />
          </View>
        ) : null}

        <Text className="flex-1 text-right text-xs leading-5 text-gray-700 dark:text-gray-300">
          {message}
        </Text>
      </View>
    </View>
  );
}

export default LiveChatCard;
