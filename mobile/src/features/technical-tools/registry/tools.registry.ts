import {
  Activity,
  Anchor,
  FileText,
  ShieldAlert,
  Table,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';

export type ToolType = 'dynamic' | 'static';

export type ToolStatus = 'available' | 'under_development';

export type ToolCategory = 'electrical' | 'mechanical' | 'civil';

export type ToolDefinition = {
  id: string;
  name: string;
  description: string;
  type: ToolType;
  category: ToolCategory;
  icon: LucideIcon;
  status: ToolStatus;
};

/**
 * Invariant: every entry with `status: 'available'` must have a matching
 * branch in `app/tools/[id].tsx`. Tools without a screen stay
 * `under_development` so the card badge never promises a working screen.
 */
export const TOOLS: ToolDefinition[] = [
  {
    id: 'electrical.voltage-drop',
    name: 'افت ولتاژ',
    description: 'محاسبه افت ولتاژ کابل‌ها بر اساس جریان، سطح مقطع و طول مسیر.',
    type: 'dynamic',
    category: 'electrical',
    icon: Zap,
    status: 'available',
  },
  {
    id: 'electrical.short-circuit',
    name: 'محاسبه اتصال کوتاه',
    description: 'محاسبه جریان اتصال کوتاه و انتخاب تجهیزات حفاظتی شبکه.',
    type: 'dynamic',
    category: 'electrical',
    icon: ShieldAlert,
    status: 'under_development',
  },
  {
    id: 'electrical.transformer',
    name: 'حفاظت ترانسفورماتور',
    description: 'جدول جریان‌ها، کلید حفاظتی و کابل ورودی ترانسفورماتورهای توزیع.',
    type: 'static',
    category: 'electrical',
    icon: Zap,
    status: 'available',
  },
  {
    id: 'mechanical.sag-tension',
    name: 'فلش و کشش هادی',
    description: 'محاسبه فلش و کشش مکانیکی هادی در خطوط انتقال هوایی.',
    type: 'static',
    category: 'mechanical',
    icon: Anchor,
    status: 'under_development',
  },
  {
    id: 'mechanical.clearances',
    name: 'حریم هوایی هادی',
    description: 'جدول فواصل هوایی مجاز هادی خطوط از تاسیسات بر اساس سطح ولتاژ.',
    type: 'static',
    category: 'mechanical',
    icon: Table,
    status: 'available',
  },
  {
    id: 'mechanical.acsr',
    name: 'هادی‌های ACSR',
    description: 'مشخصات فنی هادی‌های ACSR شامل سطح مقطع، جریان مجاز و وزن.',
    type: 'static',
    category: 'mechanical',
    icon: Activity,
    status: 'available',
  },
  {
    id: 'civil.pole-codes',
    name: 'کدهای پایه بتنی',
    description: 'مرجع کدها و مشخصات پایه‌های بتنی شبکه توزیع.',
    type: 'static',
    category: 'civil',
    icon: FileText,
    status: 'under_development',
  },
];

export const TOOL_CATEGORY_LABELS: Record<ToolCategory, string> = {
  electrical: 'الکتریکی',
  mechanical: 'مکانیکی',
  civil: 'عمرانی',
};
