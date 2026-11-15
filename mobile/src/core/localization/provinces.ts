export type ProvinceInfo = { value: string; label: string; company: string; website: string; note?: string; alternateWebsite?: string };

// Company names and public websites compiled from published Iranian electricity
// distribution company listings. Review this directory periodically because
// regional service boundaries and domains can change.
export const PROVINCES: ProvinceInfo[] = [
  { value: 'EAST_AZERBAIJAN', label: 'آذربایجان شرقی', company: 'شرکت توزیع نیروی برق استان آذربایجان شرقی', website: 'https://www.eaedc.ir', note: 'در شهر تبریز شرکت توزیع نیروی برق تبریز نیز فعالیت دارد؛ پیوند مستقل آن باید جداگانه تأیید شود.' },
  { value: 'WEST_AZERBAIJAN', label: 'آذربایجان غربی', company: 'شرکت توزیع نیروی برق استان آذربایجان غربی', website: 'https://www.waepd.ir' },
  { value: 'ARDABIL', label: 'اردبیل', company: 'شرکت توزیع نیروی برق استان اردبیل', website: 'https://www.aped.ir' },
  { value: 'ISFAHAN', label: 'اصفهان', company: 'شرکت توزیع نیروی برق استان اصفهان', website: 'https://www.epedc.ir', note: 'شرکت توزیع نیروی برق شهرستان اصفهان نیز مستقل از شرکت استانی فعالیت می‌کند.' },
  { value: 'ALBORZ', label: 'البرز', company: 'شرکت توزیع نیروی برق استان البرز', website: 'https://www.aepdc.ir' },
  { value: 'ILAM', label: 'ایلام', company: 'شرکت توزیع نیروی برق استان ایلام', website: 'https://www.ilamedc.ir' },
  { value: 'BUSHEHR', label: 'بوشهر', company: 'شرکت توزیع نیروی برق استان بوشهر', website: 'https://www.bedc.ir' },
  { value: 'CHAHARMAHAL_BAKHTIARI', label: 'چهارمحال و بختیاری', company: 'شرکت توزیع نیروی برق استان چهارمحال و بختیاری', website: 'https://chb-edc.ir/fa' },
  { value: 'SOUTH_KHORASAN', label: 'خراسان جنوبی', company: 'شرکت توزیع نیروی برق استان خراسان جنوبی', website: 'https://www.skedc.ir' },
  { value: 'RAZAVI_KHORASAN', label: 'خراسان رضوی', company: 'شرکت توزیع نیروی برق استان خراسان رضوی', website: 'https://kedc.ir', note: 'در شهر مشهد شرکت توزیع نیروی برق مشهد نیز فعالیت دارد.' },
  { value: 'NORTH_KHORASAN', label: 'خراسان شمالی', company: 'شرکت توزیع نیروی برق استان خراسان شمالی', website: 'https://www.nkedc.ir' },
  { value: 'KHUZESTAN', label: 'خوزستان', company: 'شرکت توزیع نیروی برق استان خوزستان', website: 'https://www.kepdc.co.ir', note: 'در شهر اهواز شرکت توزیع نیروی برق اهواز نیز فعالیت دارد.' },
  { value: 'ZANJAN', label: 'زنجان', company: 'شرکت توزیع نیروی برق استان زنجان', website: 'https://www.zedc.ir' },
  { value: 'SEMNAN', label: 'سمنان', company: 'شرکت توزیع نیروی برق استان سمنان', website: 'https://www.semepd.ir' },
  { value: 'SISTAN_BALUCHESTAN', label: 'سیستان و بلوچستان', company: 'شرکت توزیع نیروی برق استان سیستان و بلوچستان', website: 'https://sbepdc.ir/fa' },
  { value: 'FARS', label: 'فارس', company: 'شرکت توزیع نیروی برق استان فارس', website: 'https://www.farsedc.ir', note: 'در شهر شیراز شرکت توزیع نیروی برق شیراز نیز فعالیت دارد.' },
  { value: 'QAZVIN', label: 'قزوین', company: 'شرکت توزیع نیروی برق استان قزوین', website: 'https://www.qazvin-ed.co.ir' },
  { value: 'QOM', label: 'قم', company: 'شرکت توزیع نیروی برق استان قم', website: 'https://www.qepd.co.ir' },
  { value: 'KURDISTAN', label: 'کردستان', company: 'شرکت توزیع نیروی برق استان کردستان', website: 'https://kurdelectric.ir' },
  { value: 'KERMANSHAH', label: 'کرمانشاه', company: 'شرکت توزیع نیروی برق استان کرمانشاه', website: 'https://www.kpedc.ir' },
  { value: 'KERMAN', label: 'کرمان', company: 'شرکت‌های توزیع نیروی برق شمال و جنوب استان کرمان', website: 'https://www.nked.co.ir', note: 'استان کرمان دو شرکت توزیع مستقل دارد؛ محدودهٔ شمال استان از طریق شرکت شمال و محدودهٔ جنوب از طریق شرکت جنوب پوشش داده می‌شود.', alternateWebsite: 'https://www.sked.co.ir' },
  { value: 'KOHGILUYEH_BOYER_AHMAD', label: 'کهگیلویه و بویراحمد', company: 'شرکت توزیع نیروی برق استان کهگیلویه و بویراحمد', website: 'http://www.kbepdco.ir', note: 'دامنه در فهرست‌های عمومی شرکت‌های توزیع درج شده است؛ دسترسی مستقیم آن در زمان ممیزی تأیید نشد.' },
  { value: 'GOLESTAN', label: 'گلستان', company: 'شرکت توزیع نیروی برق استان گلستان', website: 'https://www.goped.ir' },
  { value: 'GILAN', label: 'گیلان', company: 'شرکت توزیع نیروی برق استان گیلان', website: 'http://www.gilanpdc.ir' },
  { value: 'LORESTAN', label: 'لرستان', company: 'شرکت توزیع نیروی برق استان لرستان', website: 'https://www.ledc.ir' },
  { value: 'MAZANDARAN', label: 'مازندران', company: 'شرکت توزیع نیروی برق استان مازندران', website: 'https://www.maztozi.ir', note: 'برای برخی مناطق غرب استان، شرکت توزیع برق غرب مازندران نیز مطرح است؛ محدوده و پیوند آن باید با شرکت استانی تطبیق داده شود.' },
  { value: 'MARKAZI', label: 'مرکزی', company: 'شرکت توزیع نیروی برق استان مرکزی', website: 'http://mpedc.ir' },
  { value: 'HORMOZGAN', label: 'هرمزگان', company: 'شرکت توزیع نیروی برق استان هرمزگان', website: 'https://www.hedc.co.ir/FA/Home' },
  { value: 'HAMEDAN', label: 'همدان', company: 'شرکت توزیع نیروی برق استان همدان', website: 'https://www.edch.ir' },
  { value: 'YAZD', label: 'یزد', company: 'شرکت توزیع نیروی برق استان یزد', website: 'https://www.yed.co.ir' },
  { value: 'TEHRAN', label: 'تهران', company: 'شرکت توزیع نیروی برق تهران بزرگ', website: 'https://tbtb.ir', note: 'برای برخی شهرستان‌های استان تهران، شرکت توزیع نیروی برق استان تهران مسئولیت دارد.', alternateWebsite: 'https://www.tvedc.ir' },
];

export const PROVINCE_LABELS = Object.fromEntries(PROVINCES.map(item => [item.value, item.label])) as Record<string, string>;
