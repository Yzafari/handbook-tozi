import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Mic, Search } from 'lucide-react-native';
import { useTheme } from '../../../core/theme/ThemeContext';

export function SearchBar() {
  const { isDark } = useTheme();
  const [query, setQuery] = useState<string>('');

  const iconColor = isDark ? '#9CA3AF' : '#6B7280';

  return (
    <View className="flex-row items-center rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
      <Mic size={20} color={iconColor} />

      <TextInput
        value={query}
        onChangeText={setQuery}
        className="mx-3 flex-1 text-right text-sm text-gray-900 dark:text-white"
        placeholder="هر سوالی در حوزه توزیع برق داری بپرس..."
        placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
        returnKeyType="search"
      />

      <Search size={20} color={iconColor} />
    </View>
  );
}

export default SearchBar;
