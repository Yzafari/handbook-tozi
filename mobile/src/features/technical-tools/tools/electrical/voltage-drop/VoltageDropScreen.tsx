import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowRight, Zap } from 'lucide-react-native';
import { SegmentedControl } from '../../../components/SegmentedControl';
import { useTheme } from '../../../../../core/theme/ThemeContext';

type NetworkType = 'single' | 'three';
type InstallationMethod = 'cable' | 'overhead';
type ConductorMaterial = 'copper' | 'aluminum';

const NETWORK_OPTIONS: { label: string; value: NetworkType }[] = [
  { label: 'تک‌فاز', value: 'single' },
  { label: 'سه‌فاز', value: 'three' },
];

const METHOD_OPTIONS: { label: string; value: InstallationMethod }[] = [
  { label: 'کابل', value: 'cable' },
  { label: 'هوایی', value: 'overhead' },
];

const MATERIAL_OPTIONS: { label: string; value: ConductorMaterial }[] = [
  { label: 'مس', value: 'copper' },
  { label: 'آلومینیوم', value: 'aluminum' },
];

export default function VoltageDropScreen() {
  const router = useRouter();
  const { isDark } = useTheme();

  const [networkType, setNetworkType] = useState<NetworkType>('single');
  const [installationMethod, setInstallationMethod] = useState<InstallationMethod>('cable');
  const [conductorMaterial, setConductorMaterial] = useState<ConductorMaterial>('copper');

  const [current, setCurrent] = useState<string>('');
  const [length, setLength] = useState<string>('');
  const [powerFactor, setPowerFactor] = useState<string>('');

  const handleCalculate = () => {
    Alert.alert('محاسبه', 'فرمول این ابزار در حال تأیید است');
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

        <Text className="text-lg font-bold text-gray-900 dark:text-white">افت ولتاژ</Text>

        <View className="h-10 w-10" />
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-5 px-4 py-5 pb-10"
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-2">
            <Text className="text-sm font-bold text-gray-900 dark:text-white">نوع شبکه</Text>
            <SegmentedControl
              options={NETWORK_OPTIONS}
              selectedValue={networkType}
              onChange={setNetworkType}
            />
          </View>

          <View className="gap-2">
            <Text className="text-sm font-bold text-gray-900 dark:text-white">روش اجرا</Text>
            <SegmentedControl
              options={METHOD_OPTIONS}
              selectedValue={installationMethod}
              onChange={setInstallationMethod}
            />
          </View>

          <View className="gap-2">
            <Text className="text-sm font-bold text-gray-900 dark:text-white">جنس هادی</Text>
            <SegmentedControl
              options={MATERIAL_OPTIONS}
              selectedValue={conductorMaterial}
              onChange={setConductorMaterial}
            />
          </View>

          <View className="gap-2">
            <Text className="text-sm font-bold text-gray-900 dark:text-white">
              جریان عبوری (آمپر)
            </Text>
            <TextInput
              value={current}
              onChangeText={setCurrent}
              keyboardType="numeric"
              placeholder="مثلاً 25"
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-right text-sm text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
            />
          </View>

          <View className="gap-2">
            <Text className="text-sm font-bold text-gray-900 dark:text-white">
              طول مسیر (متر)
            </Text>
            <TextInput
              value={length}
              onChangeText={setLength}
              keyboardType="numeric"
              placeholder="مثلاً 50"
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-right text-sm text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
            />
          </View>

          <View className="gap-2">
            <Text className="text-sm font-bold text-gray-900 dark:text-white">ضریب توان</Text>
            <TextInput
              value={powerFactor}
              onChangeText={setPowerFactor}
              keyboardType="numeric"
              placeholder="مثلاً 0.9"
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-right text-sm text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="محاسبه"
            onPress={handleCalculate}
            className="mt-2 flex-row items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3.5"
          >
            <Zap size={18} color="#FFFFFF" />
            <Text className="text-base font-bold text-white">محاسبه</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
