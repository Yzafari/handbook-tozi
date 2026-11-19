import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Zap } from 'lucide-react-native';

type PunchBannerProps = {
  onPress?: () => void;
};

export function PunchBanner({ onPress }: PunchBannerProps) {
  const content = (
    <View className="flex-row items-center gap-3 px-4 py-4">
      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
        <Zap size={24} color="#FFFFFF" />
      </View>

      <View className="flex-1">
        <Text className="text-right text-base font-bold text-white">پانچ همکار</Text>
        <Text className="mt-1 text-right text-xs text-green-50">
          یه پانچ بزن همکارت رو خبر کن!
        </Text>
      </View>
    </View>
  );

  return (
    <LinearGradient
      colors={['#22C55E', '#16A34A']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 16, overflow: 'hidden' }}
    >
      {onPress ? (
        <TouchableOpacity
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="پانچ همکار"
          onPress={onPress}
        >
          {content}
        </TouchableOpacity>
      ) : (
        content
      )}
    </LinearGradient>
  );
}

export default PunchBanner;
