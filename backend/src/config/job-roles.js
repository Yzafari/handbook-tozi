export const JOB_ROLES = Object.freeze([
  { value: 'SIMBAN', label: 'سیم‌بان' },
  { value: 'TECHNICAL_OPERATION_SPECIALIST', label: 'کارشناس فنی و بهره‌برداری' },
  { value: 'NETWORK_TECHNICIAN', label: 'تکنسین شبکه برق' },
  { value: 'ENGINEERING_DESIGN_SPECIALIST', label: 'کارشناس مهندسی و طراحی' },
  { value: 'METER_READER', label: 'مأمور قرائت' },
  { value: 'ELECTRICITY_MANAGER', label: 'مدیر برق' },
  { value: 'CONNECTION_SALES_OPERATOR', label: 'اپراتور فروش انشعاب' },
  { value: 'ENERGY_SALES_OPERATOR', label: 'اپراتور فروش انرژی' },
  { value: 'CONTRACTOR', label: 'پیمانکار' },
  { value: 'CONSULTANT_SUPERVISOR', label: 'ناظر مشاور' },
  { value: 'NETWORK_DESIGNER', label: 'طراح شبکه' },
  { value: 'LEGAL_SPECIALIST', label: 'کارشناس حقوقی' },
  { value: 'FINANCE_ADMIN_SPECIALIST', label: 'کارشناس مالی و اداری' },
]);

export const JOB_ROLE_VALUES = Object.freeze(JOB_ROLES.map(role => role.value));
