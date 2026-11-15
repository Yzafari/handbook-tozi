import { JOB_ROLE_LABELS } from './jobRoles';
import { PROVINCE_LABELS } from './provinces';
import type { AppLanguage } from '../settings/AppSettingsContext';

const jobRoles: Record<Exclude<AppLanguage, 'fa'>, Record<string, string>> = {
  en: {
    SIMBAN: 'Line worker', TECHNICAL_OPERATION_SPECIALIST: 'Distribution operations specialist', NETWORK_TECHNICIAN: 'Distribution network technician', ENGINEERING_DESIGN_SPECIALIST: 'Engineering and design specialist', METER_READER: 'Meter reader', ELECTRICITY_MANAGER: 'Electricity manager', CONNECTION_SALES_OPERATOR: 'Connection sales operator', ENERGY_SALES_OPERATOR: 'Energy sales operator', CONTRACTOR: 'Contractor', CONSULTANT_SUPERVISOR: 'Consultant supervisor', NETWORK_DESIGNER: 'Network designer', LEGAL_SPECIALIST: 'Legal specialist', FINANCE_ADMIN_SPECIALIST: 'Finance and administration specialist',
  },
  ku: {
    SIMBAN: 'کارمەندی هێڵ', TECHNICAL_OPERATION_SPECIALIST: 'پسپۆڕی کارپێکردنی تۆڕ', NETWORK_TECHNICIAN: 'تەکنسینی تۆڕی کارەبا', ENGINEERING_DESIGN_SPECIALIST: 'پسپۆڕی ئەندازیاری و دیزاین', METER_READER: 'کارمەندی خوێندنەوەی کۆنتۆر', ELECTRICITY_MANAGER: 'بەڕێوەبەری کارەبا', CONNECTION_SALES_OPERATOR: 'ئۆپەراتۆری فرۆشتنی پەیوەندی', ENERGY_SALES_OPERATOR: 'ئۆپەراتۆری فرۆشتنی وزە', CONTRACTOR: 'گرێبەستکار', CONSULTANT_SUPERVISOR: 'چاودێری ڕاوێژکار', NETWORK_DESIGNER: 'دیزاینەری تۆڕ', LEGAL_SPECIALIST: 'پسپۆڕی یاسایی', FINANCE_ADMIN_SPECIALIST: 'پسپۆڕی دارایی و کارگێڕی',
  },
};

const provinces: Record<Exclude<AppLanguage, 'fa'>, Record<string, string>> = {
  en: {
    EAST_AZERBAIJAN: 'East Azerbaijan', WEST_AZERBAIJAN: 'West Azerbaijan', ARDABIL: 'Ardabil', ISFAHAN: 'Isfahan', ALBORZ: 'Alborz', ILAM: 'Ilam', BUSHEHR: 'Bushehr', CHAHARMAHAL_BAKHTIARI: 'Chaharmahal and Bakhtiari', SOUTH_KHORASAN: 'South Khorasan', RAZAVI_KHORASAN: 'Razavi Khorasan', NORTH_KHORASAN: 'North Khorasan', KHUZESTAN: 'Khuzestan', ZANJAN: 'Zanjan', SEMNAN: 'Semnan', SISTAN_BALUCHESTAN: 'Sistan and Baluchestan', FARS: 'Fars', QAZVIN: 'Qazvin', QOM: 'Qom', KURDISTAN: 'Kurdistan', KERMANSHAH: 'Kermanshah', KERMAN: 'Kerman', KOHGILUYEH_BOYER_AHMAD: 'Kohgiluyeh and Boyer-Ahmad', GOLESTAN: 'Golestan', GILAN: 'Gilan', LORESTAN: 'Lorestan', MAZANDARAN: 'Mazandaran', MARKAZI: 'Markazi', HORMOZGAN: 'Hormozgan', HAMEDAN: 'Hamedan', YAZD: 'Yazd', TEHRAN: 'Tehran',
  },
  ku: {
    EAST_AZERBAIJAN: 'ئازەربایجانی ڕۆژهەڵات', WEST_AZERBAIJAN: 'ئازەربایجانی ڕۆژئاوا', ARDABIL: 'ئەردەبیل', ISFAHAN: 'ئیسپاهان', ALBORZ: 'ئەلبۆرز', ILAM: 'ئیلام', BUSHEHR: 'بوشێهر', CHAHARMAHAL_BAKHTIARI: 'چوارمەحاڵ و بەختیاری', SOUTH_KHORASAN: 'خۆراسانی باشوور', RAZAVI_KHORASAN: 'خۆراسانی ڕەزەوی', NORTH_KHORASAN: 'خۆراسانی باکوور', KHUZESTAN: 'خوزستان', ZANJAN: 'زەنجان', SEMNAN: 'سمنان', SISTAN_BALUCHESTAN: 'سیستان و بەلووچستان', FARS: 'فارس', QAZVIN: 'قەزوین', QOM: 'قوم', KURDISTAN: 'کوردستان', KERMANSHAH: 'کرماشان', KERMAN: 'کرمان', KOHGILUYEH_BOYER_AHMAD: 'کۆهگیلۆیە و بۆیەر ئەحمەد', GOLESTAN: 'گوڵستان', GILAN: 'گیلان', LORESTAN: 'لوڕستان', MAZANDARAN: 'مازەندەران', MARKAZI: 'ناوەندی', HORMOZGAN: 'هۆرمزگان', HAMEDAN: 'هەمەدان', YAZD: 'یزد', TEHRAN: 'تاران',
  },
};

export function getLocalizedJobRole(value: string | undefined, language: AppLanguage): string {
  if (!value) return '';
  return language === 'fa' ? JOB_ROLE_LABELS[value] || value : jobRoles[language][value] || JOB_ROLE_LABELS[value] || value;
}

export function getLocalizedProvince(value: string | undefined, language: AppLanguage): string {
  if (!value) return '';
  return language === 'fa' ? PROVINCE_LABELS[value] || value : provinces[language][value] || PROVINCE_LABELS[value] || value;
}

export function getJobRoleAvatar(jobRole?: string | null): string {
  if (jobRole === 'SIMBAN') return '🦺';
  if (jobRole === 'NETWORK_TECHNICIAN') return '🧰';
  if (jobRole === 'ENGINEERING_DESIGN_SPECIALIST' || jobRole === 'NETWORK_DESIGNER') return '📐';
  if (jobRole === 'TECHNICAL_OPERATION_SPECIALIST') return '⚡';
  if (jobRole === 'ELECTRICITY_MANAGER') return '👨‍💼';
  if (jobRole === 'METER_READER') return '📟';
  return '👷';
}
