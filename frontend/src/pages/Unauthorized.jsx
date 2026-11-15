import React from 'react';
import { Link } from 'react-router-dom';

export default function Unauthorized() {
  return (
    <div dir="rtl" className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl"
          aria-hidden="true"
        >
          🔒
        </div>
        <h1 className="mt-4 text-xl font-bold text-gray-900">دسترسی غیرمجاز</h1>
        <p className="mt-2 text-sm text-gray-500">
          شما اجازه دسترسی به این صفحه را ندارید. در صورت نیاز با پشتیبانی تماس بگیرید.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            to="/dashboard"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            بازگشت به داشبورد
          </Link>
          <Link
            to="/"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            صفحه اصلی
          </Link>
        </div>
      </div>
    </div>
  );
}
