import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // در محیط پروداکشن، اینجا خطاها را به سرویس‌هایی مثل Sentry ارسال می‌کنیم
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4" dir="rtl">
          <div className="text-center max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-red-100">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              ⚠️
            </div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">
              متأسفانه خطایی رخ داد
            </h1>
            <p className="text-gray-500 mb-6 text-sm leading-relaxed">
              برنامه با یک مشکل غیرمنتظره مواجه شد. لطفاً صفحه را رفرش کنید یا بعداً دوباره تلاش کنید.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-red-600 text-white py-3 rounded-xl font-medium hover:bg-red-700 transition-colors duration-200"
            >
              رفرش صفحه
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export { ErrorBoundary };
export default ErrorBoundary;