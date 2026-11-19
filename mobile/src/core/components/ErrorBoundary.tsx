import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AlertTriangle, ArrowRight, RotateCcw } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';

type ErrorFallbackProps = {
  error: Error | null;
  onRetry: () => void;
};

function ErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  const router = useRouter();
  const { isDark } = useTheme();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/tools');
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-red-50 dark:bg-red-900/20">
      <View className="flex-1 items-center justify-center px-6">
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/40">
          <AlertTriangle size={30} color={isDark ? '#FCA5A5' : '#DC2626'} />
        </View>

        <Text className="mt-4 text-center text-base font-bold text-red-700 dark:text-red-300">
          خطایی رخ داد
        </Text>

        <Text className="mt-2 text-center text-sm leading-6 text-red-700 dark:text-red-300">
          خطایی در این ابزار رخ داد. لطفا دوباره تلاش کنید یا به صفحه قبل بازگردید.
        </Text>

        {__DEV__ && error?.message ? (
          <View className="mt-3 w-full rounded-xl bg-white/70 px-3 py-2 dark:bg-black/20">
            <Text className="text-center text-[10px] leading-5 text-red-800 dark:text-red-200">
              {error.message}
            </Text>
          </View>
        ) : null}

        <View className="mt-6 w-full gap-3">
          <TouchableOpacity
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="بازگشت"
            onPress={handleBack}
            className="flex-row items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3.5"
          >
            <ArrowRight size={18} color="#FFFFFF" />
            <Text className="text-base font-bold text-white">بازگشت</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="تلاش دوباره"
            onPress={onRetry}
            className="flex-row items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-3.5 dark:border-red-800 dark:bg-gray-900"
          >
            <RotateCcw size={18} color={isDark ? '#FCA5A5' : '#DC2626'} />
            <Text className="text-base font-bold text-red-700 dark:text-red-300">
              تلاش دوباره
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

export type ErrorBoundaryProps = {
  children: React.ReactNode;
  /**
   * When this value changes, a boundary that is currently showing the
   * fallback UI resets itself. Pass the route param so navigating to a
   * different tool clears a previous crash.
   */
  resetKey?: string | number;
};

export type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
