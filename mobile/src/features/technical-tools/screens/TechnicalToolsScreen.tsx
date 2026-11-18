import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';

type Tool = {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
};

const TOOLS: Tool[] = [
  {
    id: 'calculator',
    title: 'Calculator',
    description: 'Perform basic and advanced calculations.',
    icon: '🧮',
    route: '/calculator',
  },
  {
    id: 'unit-converter',
    title: 'Unit Converter',
    description: 'Convert between common units of measurement.',
    icon: '📐',
    route: '/unit-converter',
  },
  {
    id: 'currency-converter',
    title: 'Currency Converter',
    description: 'Convert currencies using up-to-date rates.',
    icon: '💱',
    route: '/currency-converter',
  },
  {
    id: 'date-calculator',
    title: 'Date Calculator',
    description: 'Calculate the difference between two dates.',
    icon: '📅',
    route: '/date-calculator',
  },
  {
    id: 'bmi-calculator',
    title: 'BMI Calculator',
    description: 'Estimate your body mass index.',
    icon: '⚖️',
    route: '/bmi-calculator',
  },
];

export default function TechnicalToolsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950">
      <ScrollView contentContainerClassName="p-4">
        <Text className="text-2xl font-bold text-gray-900 dark:text-white">
          Technical Tools
        </Text>
        <Text className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          A collection of handy utilities to get things done.
        </Text>

        <View className="mt-6 gap-3">
          {TOOLS.map((tool) => (
            <TouchableOpacity
              key={tool.id}
              activeOpacity={0.7}
              onPress={() => router.push(tool.route as Href)}
              className="flex-row items-center rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
            >
              <View className="h-12 w-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
                <Text className="text-2xl">{tool.icon}</Text>
              </View>

              <View className="ml-4 flex-1">
                <Text className="text-base font-semibold text-gray-900 dark:text-white">
                  {tool.title}
                </Text>
                <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  {tool.description}
                </Text>
              </View>

              <Text className="ml-2 text-lg text-gray-400 dark:text-gray-500">›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
