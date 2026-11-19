import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Headphones, Network, TowerControl, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../../core/theme/ThemeContext';

type DeputyCardDefinition = {
  id: string;
  title: string;
  icon: LucideIcon;
  containerClass: string;
  iconContainerClass: string;
  iconColor: string;
  iconColorDark: string;
  textClass: string;
};

const DEPUTY_CARDS: DeputyCardDefinition[] = [
  {
    id: 'operation',
    title: 'معاونت بهره‌برداری',
    icon: TowerControl,
    containerClass: 'bg-blue-50 dark:bg-blue-950',
    iconContainerClass: 'bg-white dark:bg-white/10',
    iconColor: '#1D4ED8',
    iconColorDark: '#93C5FD',
    textClass: 'text-blue-900 dark:text-blue-100',
  },
  {
    id: 'engineering',
    title: 'معاونت مهندسی',
    icon: Network,
    containerClass: 'bg-green-50 dark:bg-green-950',
    iconContainerClass: 'bg-white dark:bg-white/10',
    iconColor: '#15803D',
    iconColorDark: '#86EFAC',
    textClass: 'text-green-900 dark:text-green-100',
  },
  {
    id: 'support',
    title: 'معاونت پشتیبانی',
    icon: Headphones,
    containerClass: 'bg-purple-50 dark:bg-purple-950',
    iconContainerClass: 'bg-white dark:bg-white/10',
    iconColor: '#7E22CE',
    iconColorDark: '#D8B4FE',
    textClass: 'text-purple-900 dark:text-purple-100',
  },
];

export function DeputyCards() {
  const { isDark } = useTheme();

  return (
    <View className="flex-row gap-3">
      {DEPUTY_CARDS.map((card) => {
        const Icon = card.icon;

        return (
          <TouchableOpacity
            key={card.id}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={card.title}
            className={`flex-1 items-center rounded-2xl p-3 ${card.containerClass}`}
          >
            <View
              className={`h-11 w-11 items-center justify-center rounded-xl ${card.iconContainerClass}`}
            >
              <Icon size={22} color={isDark ? card.iconColorDark : card.iconColor} />
            </View>

            <Text
              className={`mt-2 text-center text-[11px] font-bold leading-4 ${card.textClass}`}
            >
              {card.title}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default DeputyCards;
