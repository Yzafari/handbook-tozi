import React from 'react';

const statusConfig = {
  ACTIVE: { label: 'فعال', className: 'bg-green-100 text-green-800 border-green-200' },
  EXPIRED: { label: 'منقضی شده', className: 'bg-red-100 text-red-800 border-red-200' },
  CANCELED: { label: 'لغو شده', className: 'bg-gray-100 text-gray-800 border-gray-200' },
  SUCCESS: { label: 'موفق', className: 'bg-green-100 text-green-800 border-green-200' },
  PENDING: { label: 'در انتظار', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  FAILED: { label: 'ناموفق', className: 'bg-red-100 text-red-800 border-red-200' },
};

export default function StatusBadge({ status }) {
  const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800 border-gray-200' };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}>
      {config.label}
    </span>
  );
}