import React from 'react';
import { useTheme } from '../../context/ThemeContext';

// ما هم به صورت Named Export و هم Default Export می‌نویسیم تا به هر طریقی که Aider صدا زده باشه، کار کنه
export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
      title="تغییر حالت روشن/تاریک"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
};

export default ThemeToggle;