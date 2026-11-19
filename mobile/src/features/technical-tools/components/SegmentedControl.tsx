import React from 'react';
import { Pressable, Text, View } from 'react-native';

export type SegmentedControlOption<T extends string = string> = {
  label: string;
  value: T;
};

type SegmentedControlProps<T extends string = string> = {
  options: SegmentedControlOption<T>[];
  selectedValue: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string = string>({
  options,
  selectedValue,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <View className="flex-row gap-2">
      {options.map((option) => {
        const isSelected = option.value === selectedValue;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            className={
              isSelected
                ? 'flex-1 items-center justify-center rounded-xl bg-green-600 px-3 py-2.5'
                : 'flex-1 items-center justify-center rounded-xl bg-gray-100 px-3 py-2.5 dark:bg-gray-800'
            }
          >
            <Text
              className={
                isSelected
                  ? 'text-sm font-bold text-white'
                  : 'text-sm font-semibold text-gray-700 dark:text-gray-300'
              }
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default SegmentedControl;
