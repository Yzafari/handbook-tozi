import { Anchor, FileText, ShieldAlert, Zap, type LucideIcon } from 'lucide-react-native';

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

export const TOOLS: ToolDefinition[] = [
  {
    id: 'electrical.voltage-drop',
    name: 'افت ولتاژ',
    description: 'محاسبه افت ولتاژ کابل‌ها بر اساس جریان، سطح مقطع و طول مسیر.',
    type: 'dynamic',
    category: 'electrical',
    icon: Zap,
    status: 'under_development',
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
    id: 'mechanical.sag-tension',
    name: 'فلش و کشش هادی',
    description: 'محاسبه فلش و کشش مکانیکی هادی در خطوط انتقال هوایی.',
    type: 'static',
    category: 'mechanical',
    icon: Anchor,
    status: 'available',
  },
  {
    id: 'civil.pole-codes',
    name: 'کدهای پایه بتنی',
    description: 'مرجع کدها و مشخصات پایه‌های بتنی شبکه توزیع.',
    type: 'static',
    category: 'civil',
    icon: FileText,
    status: 'available',
  },
];

export const TOOL_CATEGORY_LABELS: Record<ToolCategory, string> = {
  electrical: 'الکتریکی',
  mechanical: 'مکانیکی',
  civil: 'عمرانی',
};
