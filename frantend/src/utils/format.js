const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
const arabicDigits = '٠١٢٣٤٥٦٧٨٩';

export function toPersianDigits(value) {
  return String(value ?? '').replace(/\d/g, (digit) => persianDigits[digit]);
}

export function formatToman(value) {
  if (value === null || value === undefined || value === '') return 'مبلغ نامشخص';
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 'مبلغ نامشخص';
  }

  const formatted = new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: 0
  }).format(number);

  return `${formatted} تومان`;
}

export function formatJalaliDate(iso, options = {}) {
  if (iso === null || iso === undefined || iso === '') {
    return '—';
  }

  const date = iso instanceof Date ? iso : new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...options
    }).format(date);
  } catch {
    return '—';
  }
}

export function formatRelativeDays(value) {
  const days = Number(value);

  if (!Number.isFinite(days)) {
    return 'نامشخص';
  }

  const rounded = Math.trunc(days);

  if (rounded === 0) return 'امروز';
  if (rounded === 1) return '۱ روز';
  if (rounded === -1) return '۱ روز قبل';
  if (rounded > 0) return `${toPersianDigits(rounded)} روز`;
  return `${toPersianDigits(Math.abs(rounded))} روز قبل`;
}

export function toEnglishDigits(value) {
  return String(value ?? '').replace(/[۰-۹٠-٩]/g, (digit) => {
    const persianIndex = persianDigits.indexOf(digit);
    if (persianIndex !== -1) return String(persianIndex);

    const arabicIndex = arabicDigits.indexOf(digit);
    return arabicIndex !== -1 ? String(arabicIndex) : digit;
  });
}