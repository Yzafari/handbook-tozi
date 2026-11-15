import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Activity,
  CreditCard,
  FileSearch,
  Database,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  X
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../../hooks/useToast.js';
import { Button } from '../common/Button.jsx';
import { ThemeToggle } from '../common/ThemeToggle.jsx';

const ADMIN_NAVIGATION = [
  {
    to: '/admin',
    label: 'داشبورد',
    icon: LayoutDashboard,
    end: true
  },
  {
    to: '/admin/users',
    label: 'کاربران',
    icon: Users
  },
  {
    to: '/admin/payments',
    label: 'پرداخت‌ها',
    icon: CreditCard
  },
  {
    to: '/admin/audit-logs',
    label: 'گزارش‌های ممیزی',
    icon: FileSearch
  },
  {
    to: '/admin/documents',
    label: 'دیتاسنتر و اسناد',
    icon: Database
  }
];

function NavigationLinks({ onNavigate }) {
  return (
    <nav aria-label="منوی مدیریت" className="space-y-1 px-3 py-4">
      {ADMIN_NAVIGATION.map((item) => {
        const Icon = item.icon;

        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) => [
              'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
              isActive
                ? 'bg-gradient-to-l from-violet-600 to-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
            ].join(' ')}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function SidebarContent({ user, onNavigate, onLogout, logoutLoading }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-100 px-5 py-5 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-sm">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="font-black text-slate-900 dark:text-white">هندبوک توزیع</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">پنل مدیریت</p>
          </div>
        </div>
      </div>

      <NavigationLinks onNavigate={onNavigate} />

      <div className="mt-auto border-t border-slate-100 p-4 dark:border-slate-800">
        <div className="mb-3 min-w-0 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {user?.fullName || 'مدیر سامانه'}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
            {user?.email || ''}
          </p>
          <p className="mt-2 text-xs font-semibold text-violet-700 dark:text-violet-300">
            {user?.role === 'SUPER_ADMIN' ? 'مدیر ارشد' : 'مدیر'}
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          className="w-full justify-center"
          loading={logoutLoading}
          onClick={onLogout}
        >
          <LogOut className="size-4" />
          خروج از حساب
        </Button>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const handleLogout = async () => {
    if (logoutLoading) return;

    setLogoutLoading(true);

    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(error?.message || 'خروج از حساب انجام نشد.');
    } finally {
      setLogoutLoading(false);
    }
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-64 border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:block">
        <SidebarContent
          user={user}
          onLogout={handleLogout}
          logoutLoading={logoutLoading}
        />
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="بستن منوی مدیریت"
            onClick={closeMobileMenu}
            className="absolute inset-0 bg-slate-950/50"
          />
          <aside className="absolute inset-y-0 right-0 z-10 w-[min(19rem,85vw)] border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="absolute left-3 top-4 z-10">
              <button
                type="button"
                onClick={closeMobileMenu}
                aria-label="بستن منو"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-5" />
              </button>
            </div>
            <SidebarContent
              user={user}
              onNavigate={closeMobileMenu}
              onLogout={handleLogout}
              logoutLoading={logoutLoading}
            />
          </aside>
        </div>
      )}

      <div className="min-h-screen lg:pe-64">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="باز کردن منوی مدیریت"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
            >
              <Menu className="size-5" />
            </button>
            <div className="hidden items-center gap-2 text-sm text-slate-500 dark:text-slate-400 sm:flex">
              <Activity className="size-4" />
              <span>سامانه مدیریت هندبوک توزیع</span>
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 lg:hidden">
              پنل مدیریت
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="hidden max-w-48 text-left sm:block">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                {user?.fullName || user?.email || 'مدیر'}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {user?.role === 'SUPER_ADMIN' ? 'مدیر ارشد' : 'مدیر'}
              </p>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}