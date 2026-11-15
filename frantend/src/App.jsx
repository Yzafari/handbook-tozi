import { AppRoutes } from './routes/AppRoutes.jsx';
import { Toast } from './components/common/Toast.jsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.jsx';

export default function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
        <AppRoutes />
        <Toast />
      </div>
    </ErrorBoundary>
  );
}