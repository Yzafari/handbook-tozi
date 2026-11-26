import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, useColorScheme } from 'react-native';
import { readSetting, writeSetting } from '../database/settings';

export type AppLanguage = 'fa' | 'ku' | 'en';
export type AppTheme = 'system' | 'light' | 'dark' | 'auto';
type TranslationKey = keyof typeof translations.fa;
type TranslationParams = Record<string, string | number>;

const translations = {
  fa: {
    appName: 'هندبوک توزیع', back: 'بازگشت', close: 'بستن', save: 'ذخیره', cancel: 'انصراف',
    settings: 'تنظیمات برنامه', language: 'زبان برنامه', theme: 'پوستهٔ برنامه', persian: 'فارسی', kurdish: 'کوردی', english: 'English',
    systemTheme: 'مطابق دستگاه', autoTheme: 'خودکار بر اساس ساعت', lightTheme: 'روشن', darkTheme: 'تیره', saved: 'تنظیمات ذخیره شد',
    languageSaveError: 'ذخیرهٔ زبان ناموفق بود.', themeSaveError: 'ذخیرهٔ پوسته ناموفق بود.',
    greeting: 'همراه تخصصی صنعت توزیع برق', greetingWithName: 'سلام، {name}', searchPlaceholder: 'هر سؤالی در حوزه توزیع برق داری، اینجا بپرس',
    modules: 'خدمات و ماژول‌ها', modulesHint: 'امکانات تخصصی شبکه توزیع', departments: 'معاونت‌ها',
    chat: 'گفت‌وگوی همکاران', chatSubtitle: 'همکاران امروز چه می‌گویند؟', colleaguesFive: 'پنج همکار', quickAccessTitle: 'فرصت‌ها و خدمات', quickTender: 'مناقصات و مزایده‌ها', quickMarket: 'بازار تجهیزات شبکه، قیمت لحظه‌ای اجناس', quickJobs: 'آگهی‌های کاری', chatPending: 'پیام‌های همکاران پس از فعال‌سازی سرویس گفتگو در این بخش نمایش داده می‌شود.',
    profile: 'پروفایل', loginTitle: 'ورود به هندبوک توزیع', loginSubtitle: 'برای همگام‌سازی اطلاعات و استفاده از امکانات همکاران وارد شوید.', email: 'ایمیل', password: 'رمز عبور', requiredFields: 'ایمیل و رمز عبور را وارد کنید.', loginError: 'ورود انجام نشد. اطلاعات را بررسی کنید.', continueGuest: 'ادامه به‌صورت مهمان', guestUser: 'کاربر مهمان', noAccount: 'بدون ورود به حساب', systemRole: 'نقش سامانه', provinceNote: 'با تغییر استان، نام شرکت توزیع مربوط و وب‌سایت آن در همین بخش به‌روزرسانی می‌شود.', alternateWebsite: 'وب‌سایت جایگزین', profileSaveError: 'ذخیرهٔ اطلاعات پروفایل ناموفق بود.', selectProvinceTitle: 'انتخاب استان', selectJobTitle: 'انتخاب سمت شغلی', jobInfo: 'اطلاعات شغلی و منطقه‌ای', jobRole: 'سمت شغلی', province: 'استان محل فعالیت', selectJob: 'انتخاب سمت شغلی', selectProvince: 'انتخاب استان', logout: 'خروج از حساب',
    search: 'جستجو در دیتاسنتر', noResults: 'نتیجه‌ای پیدا نشد', all: 'همه', image: 'تصویر', text: 'متن', allLanguages: 'همه زبان‌ها', searchStart: 'جستجوی هوشمند اسناد', searchInstructions: 'عنوان، شماره تجهیز، عبارت فنی یا بخشی از متن سند را وارد کنید.', searchOffline: 'نمایش نتایج ذخیره‌شده؛ اتصال اینترنت در دسترس نیست.', searchUnavailable: 'جستجوی آنلاین در دسترس نیست و نتیجهٔ ذخیره‌شده‌ای ندارید.', camera: 'دوربین و تشخیص متن',
    connectionTest: 'تست اتصال به سرور', connectionTestHint: 'آدرس واقعی API در این نصب و پاسخ /api/v1/health را نشان می‌دهد.', apiAddress: 'آدرس API', testConnection: 'تست اتصال', connectionOk: 'اتصال و سلامت سرور برقرار است', connectionFailed: 'اتصال یا سلامت سرور برقرار نیست',
    calculator: 'ماشین‌حساب عمومی', recentCalculations: 'محاسبات اخیر', calculate: 'محاسبه', historyEmpty: 'هنوز محاسبه‌ای ذخیره نشده است.', historyOffline: 'تاریخچه روی همین دستگاه ذخیره می‌شود و بدون اینترنت نیز در دسترس است.', calculationFailed: 'محاسبه انجام نشد', notebook: 'دفترچه فنی', cameraTitle: 'دوربین و تشخیص متن', loginForOcr: 'برای استفاده از OCR وارد حساب شوید', ocrNeedsAccount: 'پردازش تصویر به حساب کاربری و همگام‌سازی امن نیاز دارد.', login: 'ورود به حساب', authAction: 'ورود / ثبت‌نام', signup: 'ساخت حساب کاربری', cameraPermission: 'اجازهٔ دسترسی به دوربین', cameraPermissionText: 'برای ثبت پلاک تجهیزات یا تصویر کنتور، دسترسی دوربین لازم است.', enableCamera: 'فعال‌کردن دوربین', cameraHint: 'پلاک تجهیز یا صفحهٔ کنتور را داخل کادر قرار دهید؛ تصویر واضح و بدون لرزش باشد.', capture: 'ثبت تصویر', imageSaved: 'تصویر روی گوشی ذخیره شد', processingImage: 'در حال پردازش تصویر', autoSend: 'پس از اتصال اینترنت، تصویر به‌صورت خودکار ارسال می‌شود؛ اطلاعات شما از بین نمی‌رود.', ocrProcessing: 'متن فارسی و انگلیسی استخراج می‌شود. می‌توانید این صفحه را باز نگه دارید.', extractedText: 'متن استخراج‌شده', confidence: 'میانگین اطمینان OCR', shareText: 'اشتراک‌گذاری متن', searchText: 'جستجو در دیتاسنتر با این متن', newImage: 'ثبت تصویر جدید', retry: 'تلاش مجدد', cameraCaptureError: 'ثبت تصویر روی گوشی ناموفق بود.', cameraPhotoError: 'تصویر دوربین دریافت نشد', retryError: 'تلاش مجدد ناموفق بود.', documentDetails: 'مشخصات سند', documentNotFound: 'سند پیدا نشد.', openSaved: 'بازکردن نسخهٔ ذخیره‌شده', openOriginal: 'بازکردن فایل اصلی', updateOffline: 'به‌روزرسانی نسخهٔ آفلاین', saveOffline: 'ذخیره برای مطالعه آفلاین', offlineAvailable: 'نسخهٔ آفلاین روی گوشی موجود است.', removeOffline: 'حذف نسخهٔ آفلاین', offlineStale: 'نسخهٔ ذخیره‌شده قدیمی است؛ برای دریافت آخرین نسخه، آن را به‌روزرسانی کنید.', size: 'حجم', pages: 'صفحات', unknown: 'نامشخص', indexStatus: 'وضعیت ایندکس', pageResult: 'نتیجهٔ جستجو در صفحه', documentOnlineUnavailable: 'مشخصات سند آنلاین در دسترس نیست.', documentLinkError: 'پیوند موقت سند از سرور دریافت نشد', documentOpenError: 'بازکردن سند ناموفق بود.', documentDownloadLinkError: 'پیوند دریافت فایل ساخته نشد', documentDownloadFailed: 'دریافت فایل ناموفق بود ({status})', documentSizeMismatch: 'اندازه فایل دریافت‌شده با مشخصات سند مطابقت ندارد؛ نسخه قبلی حفظ شد.', documentSaveOfflineError: 'ذخیره آفلاین سند ناموفق بود.', documentRemoveOfflineError: 'حذف نسخه آفلاین ناموفق بود.', comingSoon: 'در حال تکمیل', devVersion: 'نسخهٔ توسعه',
    ghabz: 'پرداخت قبض', taghiz: 'دستوالعملها و استانداردها', engineering: 'محاسبات فنی', safety: 'پیام‌ها و اصول ایمنی', colleaguesChat: 'گفت‌وگوی همکاران', tenders: 'مناقصات', marketplace: 'بازار تجهیزات', project:'پروژه های من', notebookModule: 'دفترچه فنی', loginToSave: 'برای ذخیرهٔ یادداشت وارد حساب شوید', editNote: 'ویرایش یادداشت', newNote: 'یادداشت جدید', noteTitle: 'عنوان یادداشت', noteBodyPlaceholder: 'متن، نکته فنی یا نتیجه محاسبه...', saveToPhone: 'ذخیره روی گوشی', cancelEdit: 'لغو ویرایش', offlineNote: 'یادداشت ابتدا به‌صورت رمزگذاری‌شده روی گوشی ذخیره می‌شود و پس از اتصال اینترنت همگام‌سازی خواهد شد.', myNotes: 'یادداشت‌های من', refresh: 'بروزرسانی', synced: 'همگام‌شده', conflict: 'نیازمند حل تعارض', savedPending: 'ذخیره‌شده روی گوشی · در انتظار همگام‌سازی', keepMine: 'نگه‌داشتن نسخهٔ من', useServer: 'استفاده از نسخهٔ سرور', noNotes: 'هنوز یادداشتی ثبت نکرده‌اید.', titleAndBodyRequired: 'عنوان و متن یادداشت را وارد کنید.', readNotesError: 'خواندن یادداشت‌های ذخیره‌شده ناموفق بود.', saveNoteError: 'ذخیره یادداشت ناموفق بود.', resolveConflictError: 'حل تعارض ناموفق بود.',
    operations: 'بهره‌برداری', engineeringPlanning: 'مهندسی و برنامه‌ریزی', sales: 'فروش و خدمات مشترکین', consultant: 'ناظر مشاور',
  },
  ku: {
    appName: 'هەندبووکی دابەشکردن', back: 'گەڕانەوە', close: 'داخستن', save: 'پاشەکەوتکردن', cancel: 'هەڵوەشاندنەوە',
    settings: 'ڕێکخستنەکانی بەرنامە', language: 'زمانی بەرنامە', theme: 'ڕووکار', persian: 'فارسی', kurdish: 'کوردی', english: 'English',
    systemTheme: 'وەک ئامێر', autoTheme: 'خۆکار بەپێی کاتژمێر', lightTheme: 'ڕووناک', darkTheme: 'تاریک', saved: 'ڕێکخستنەکان پاشەکەوت کران',
    languageSaveError: 'پاشەکەوتکردنی زمان سەرکەوتوو نەبوو.', themeSaveError: 'پاشەکەوتکردنی ڕووکار سەرکەوتوو نەبوو.',
    greeting: 'هاوڕێی پسپۆڕی پیشەی تۆڕی کارەبا', greetingWithName: 'سڵاو، {name}', searchPlaceholder: 'هەر پرسیارێکت لە بواری دابەشکردنی کارەبا هەیە لێرە بپرسە',
    modules: 'خزمەتگوزاری و مۆدیولەکان', modulesHint: 'تواناکانی پسپۆڕی تۆڕی دابەشکردن', departments: 'بەڕێوەبەرایەتییەکان',
    chat: 'گفتوگۆی هاوکاران', chatSubtitle: 'هاوکاران ئەمڕۆ چی دەڵێن؟', colleaguesFive: 'پێنج هاوکار', quickAccessTitle: 'دەرفەت و خزمەتگوزاری', quickTender: 'مناقصە و مزایدەکان', quickMarket: 'بازاڕی کەرەستەی تۆڕ، نرخی ڕاستەوخۆ', quickJobs: 'ڕاگەیاندنی کار', chatPending: 'نامەکانی هاوکاران لەم بەشەدا پیشان دەدرێن.',
    profile: 'پرۆفایل', loginTitle: 'چوونەژوورەوە بۆ هەندبووکی دابەشکردن', loginSubtitle: 'بۆ هاوکاتکردنی زانیاری و بەکارهێنانی تایبەتمەندییەکان بچۆ ژوورەوە.', email: 'ئیمەیڵ', password: 'وشەی نهێنی', requiredFields: 'ئیمەیڵ و وشەی نهێنی بنووسە.', loginError: 'چوونەژوورەوە سەرکەوتوو نەبوو. زانیارییەکان بپشکنە.', continueGuest: 'بەردەوامبوون وەک میوان', guestUser: 'بەکارهێنەری میوان', noAccount: 'بێ چوونەژوورەوە', systemRole: 'ڕۆڵی سیستەم', provinceNote: 'بە گۆڕینی پارێزگا، ناوی کۆمپانیای دابەشکردن و ماڵپەڕەکەی نوێ دەکرێتەوە.', alternateWebsite: 'ماڵپەڕی جێگرەوە', profileSaveError: 'پاشەکەوتکردنی زانیاریی پرۆفایل سەرکەوتوو نەبوو.', selectProvinceTitle: 'هەڵبژاردنی پارێزگا', selectJobTitle: 'هەڵبژاردنی پیشە', jobInfo: 'زانیاری پیشەیی و ناوچەیی', jobRole: 'پیشە', province: 'پارێزگا', selectJob: 'هەڵبژاردنی پیشە', selectProvince: 'هەڵبژاردنی پارێزگا', logout: 'چوونەدەرەوە',
    search: 'گەڕان لە داتاسەنتەر', noResults: 'هیچ ئەنجامێک نەدۆزرایەوە', all: 'هەموو', image: 'وێنە', text: 'دەق', allLanguages: 'هەموو زمانەکان', searchStart: 'گەڕانی زیرەکی بەڵگەنامەکان', searchInstructions: 'ناونیشان، ژمارەی ئامێر یان دەقی تەکنیکی بنووسە.', searchOffline: 'ئەنجامە پاشەکەوتکراوەکان پیشان دەدرێن؛ ئینتەرنێت نییە.', searchUnavailable: 'گەڕانی ئۆنلاین بەردەست نییە و ئەنجامی پاشەکەوتکراو نییە.', camera: 'کامێرا و ناسینەوەی دەق',
    connectionTest: 'تاقیکردنەوەی پەیوەندی بە سێرڤەر', connectionTestHint: 'ناونیشانی API و وەڵامی /api/v1/health پیشان دەدات.', apiAddress: 'ناونیشانی API', testConnection: 'تاقیکردنەوەی پەیوەندی', connectionOk: 'پەیوەندی و ساغی سێرڤەر باشە', connectionFailed: 'پەیوەندی یان ساغی سێرڤەر نییە',
    calculator: 'ژمێرەری گشتی', recentCalculations: 'ژمێریارییە نوێکان', calculate: 'ژمێرە', historyEmpty: 'هێشتا هیچ ژمێریارییەک پاشەکەوت نەکراوە.', historyOffline: 'مێژوو لەم ئامێرەدا پاشەکەوت دەکرێت و بێ ئینتەرنێتیش بەردەستە.', calculationFailed: 'ژمێریاری ئەنجام نەدرا', notebook: 'دەفتەری تەکنیکی', cameraTitle: 'کامێرا و ناسینەوەی دەق', loginForOcr: 'بۆ بەکارهێنانی OCR بچۆ ژوورەوە', ocrNeedsAccount: 'پرۆسەکردنی وێنە پێویستی بە هەژمار و هاوکاتکردنی پارێزراو هەیە.', login: 'چوونەژوورەوە', authAction: 'چوونەژوورەوە / تۆمارکردن', signup: 'دروستکردنی هەژمار', cameraPermission: 'ڕێگەدان بە کامێرا', cameraPermissionText: 'بۆ تۆمارکردنی پلاکی ئامێر یان کۆنتۆر، دەستگەیشتن بە کامێرا پێویستە.', enableCamera: 'چالاککردنی کامێرا', cameraHint: 'پلاکی ئامێر یان شاشەی کۆنتۆر بخەرە ناو چوارچێوە؛ وێنەکە ڕوون و بێ لەرزین بێت.', capture: 'گرتنی وێنە', imageSaved: 'وێنەکە لە مۆبایل پاشەکەوت کرا', processingImage: 'وێنەکە پرۆسە دەکرێت', autoSend: 'دوای پەیوەستبوون بە ئینتەرنێت، وێنەکە خۆکارانە دەنێردرێت؛ زانیارییەکانت ون نابن.', ocrProcessing: 'دەقی فارسی و ئینگلیزی دەردەهێنرێت.', extractedText: 'دەقی دەرهێنراو', confidence: 'ڕێژەی دڵنیایی OCR', shareText: 'هاوبەشکردنی دەق', searchText: 'گەڕان بەو دەقە لە داتاسەنتەر', newImage: 'گرتنی وێنەی نوێ', retry: 'هەوڵدانەوە', cameraCaptureError: 'تۆمارکردنی وێنە سەرکەوتوو نەبوو.', cameraPhotoError: 'وێنەی کامێرا وەرنەگیرا', retryError: 'هەوڵدانەوە سەرکەوتوو نەبوو.', documentDetails: 'زانیاری بەڵگەنامە', documentNotFound: 'بەڵگەنامە نەدۆزرایەوە.', openSaved: 'کردنەوەی وەشانی پاشەکەوتکراو', openOriginal: 'کردنەوەی فایلی سەرەکی', updateOffline: 'نوێکردنەوەی وەشانی ئۆفلاین', saveOffline: 'پاشەکەوتکردن بۆ خوێندنەوەی ئۆفلاین', offlineAvailable: 'وەشانی ئۆفلاین لە مۆبایل هەیە.', removeOffline: 'سڕینەوەی وەشانی ئۆفلاین', offlineStale: 'وەشانی پاشەکەوتکراو کۆنە؛ بۆ وەرگرتنی وەشانی نوێ نوێی بکەرەوە.', size: 'قەبارە', pages: 'لاپەڕەکان', unknown: 'نەزانراو', indexStatus: 'دۆخی ئیندێکس', pageResult: 'ئەنجامی گەڕان لە لاپەڕە', documentOnlineUnavailable: 'زانیاری بەڵگەنامەی ئۆنلاین بەردەست نییە.', documentLinkError: 'بەستەری کاتی بەڵگەنامە لە سێرڤەر وەرنەگیرا', documentOpenError: 'کردنەوەی بەڵگەنامە سەرکەوتوو نەبوو.', documentDownloadLinkError: 'بەستەری داگرتنی فایل دروست نەکرا', documentDownloadFailed: 'داگرتنی فایل سەرکەوتوو نەبوو ({status})', documentSizeMismatch: 'قەبارەی فایلی داگرتراو لەگەڵ زانیاری بەڵگەنامە ناگونجێت؛ وەشانی پێشوو پارێزرا.', documentSaveOfflineError: 'پاشەکەوتکردنی ئۆفلاینی بەڵگەنامە سەرکەوتوو نەبوو.', documentRemoveOfflineError: 'سڕینەوەی وەشانی ئۆفلاین سەرکەوتوو نەبوو.', comingSoon: 'بە زوویی', devVersion: 'وەشانی گەشەپێدان',
    ghabz: 'پارەدانی پسوڵە', taghiz: 'یاسا و استانداردکان', engineering: 'ژمێریاری تەکنیکی', safety: 'نامە و بنەماکانی سەلامەتی', colleaguesChat: 'گفتوگۆی هاوکاران', tenders: 'مناقصەکان', marketplace: 'بازاڕی کەرەستە', project: 'پروژه کانی من', notebookModule: 'دەفتەری تەکنیکی', loginToSave: 'بۆ پاشەکەوتکردنی تێبینی بچۆ ژوورەوە', editNote: 'دەستکاریکردنی تێبینی', newNote: 'تێبینی نوێ', noteTitle: 'ناونیشانی تێبینی', noteBodyPlaceholder: 'دەق، خاڵی تەکنیکی یان ئەنجامی ژمێریاری...', saveToPhone: 'پاشەکەوتکردن لە مۆبایل', cancelEdit: 'هەڵوەشاندنەوەی دەستکاری', offlineNote: 'تێبینییەکە سەرەتا بە شێوەی پارێزراو لە مۆبایل پاشەکەوت دەکرێت و دوای پەیوەندی ئینتەرنێت هاوکات دەکرێت.', myNotes: 'تێبینییەکانم', refresh: 'نوێکردنەوە', synced: 'هاوکاتکراوە', conflict: 'پێویستی بە چارەسەری ناکۆکی هەیە', savedPending: 'لە مۆبایل پاشەکەوت کراوە · چاوەڕوانی هاوکاتکردن', keepMine: 'هێشتنەوەی وەشانی من', useServer: 'بەکارهێنانی وەشانی سێرڤەر', noNotes: 'هێشتا هیچ تێبینییەک تۆمار نەکراوە.', titleAndBodyRequired: 'ناونیشان و دەقی تێبینی بنووسە.', readNotesError: 'خوێندنەوەی تێبینییەکان سەرکەوتوو نەبوو.', saveNoteError: 'پاشەکەوتکردنی تێبینی سەرکەوتوو نەبوو.', resolveConflictError: 'چارەسەری ناکۆکی سەرکەوتوو نەبوو.',
    operations: 'بەڕێوەبردن', engineeringPlanning: 'ئەندازیاری و پلان‌دانان', sales: 'فرۆشتن و خزمەتگوزاری هاوبەش', consultant: 'چاودێری ڕاوێژکار',
  },
  en: {
    appName: 'Distribution Handbook', back: 'Back', close: 'Close', save: 'Save', cancel: 'Cancel',
    settings: 'App settings', language: 'App language', theme: 'Appearance', persian: 'Persian', kurdish: 'Kurdish', english: 'English',
    systemTheme: 'Use device setting', autoTheme: 'Automatic by time of day', lightTheme: 'Light', darkTheme: 'Dark', saved: 'Settings saved',
    languageSaveError: 'Could not save the language.', themeSaveError: 'Could not save the appearance.',
    greeting: 'Your professional electricity distribution companion', greetingWithName: 'Hello, {name}', searchPlaceholder: 'Ask anything about electricity distribution',
    modules: 'Services and modules', modulesHint: 'Specialized distribution network tools', departments: 'Departments',
    chat: 'Colleague discussion', chatSubtitle: 'What are colleagues discussing today?', colleaguesFive: 'Five colleagues', quickAccessTitle: 'Opportunities and services', quickTender: 'Tenders and auctions', quickMarket: 'Network equipment market · live prices', quickJobs: 'Job listings', chatPending: 'Colleague messages will appear here when chat is enabled.',
    profile: 'Profile', loginTitle: 'Sign in to Distribution Handbook', loginSubtitle: 'Sign in to synchronize data and use colleague features.', email: 'Email', password: 'Password', requiredFields: 'Enter your email and password.', loginError: 'Sign-in failed. Check your details.', continueGuest: 'Continue as guest', guestUser: 'Guest user', noAccount: 'Not signed in', systemRole: 'System role', provinceNote: 'Changing the province updates the associated distribution company and its website here.', alternateWebsite: 'Alternate website', profileSaveError: 'Could not save profile information.', selectProvinceTitle: 'Select province', selectJobTitle: 'Select job role', jobInfo: 'Professional and regional information', jobRole: 'Job role', province: 'Province', selectJob: 'Select job role', selectProvince: 'Select province', logout: 'Sign out',
    search: 'Data center search', noResults: 'No results found', all: 'All', image: 'Image', text: 'Text', allLanguages: 'All languages', searchStart: 'Smart document search', searchInstructions: 'Enter a title, equipment number, technical phrase or part of a document.', searchOffline: 'Showing cached results; internet connection is unavailable.', searchUnavailable: 'Online search is unavailable and no cached result exists.', camera: 'Camera and text recognition',
    connectionTest: 'Server connection test', connectionTestHint: 'Shows the API address this build uses and the /api/v1/health response.', apiAddress: 'API address', testConnection: 'Test connection', connectionOk: 'Server reachable and healthy', connectionFailed: 'Server unreachable or unhealthy',
    calculator: 'General calculator', recentCalculations: 'Recent calculations', calculate: 'Calculate', historyEmpty: 'No calculations saved yet.', historyOffline: 'History is saved on this device and remains available offline.', calculationFailed: 'Calculation failed', notebook: 'Technical notebook', cameraTitle: 'Camera and text recognition', loginForOcr: 'Sign in to use OCR', ocrNeedsAccount: 'Image processing requires an account and secure synchronization.', login: 'Sign in', authAction: 'Sign in / Sign up', signup: 'Create an account', cameraPermission: 'Camera permission', cameraPermissionText: 'Camera access is required to capture equipment nameplates or meter displays.', enableCamera: 'Enable camera', cameraHint: 'Place the equipment nameplate or meter display inside the frame. Keep the image sharp and steady.', capture: 'Capture image', imageSaved: 'Image saved on this phone', processingImage: 'Processing image', autoSend: 'The image will upload automatically when internet returns. Your data is safe.', ocrProcessing: 'Persian and English text is being extracted. You can keep this page open.', extractedText: 'Extracted text', confidence: 'Average OCR confidence', shareText: 'Share text', searchText: 'Search the data center with this text', newImage: 'Capture another image', retry: 'Retry', cameraCaptureError: 'Could not save the image on this device.', cameraPhotoError: 'Could not capture the camera image.', retryError: 'Retry failed.', documentDetails: 'Document details', documentNotFound: 'Document not found.', openSaved: 'Open saved copy', openOriginal: 'Open original file', updateOffline: 'Update offline copy', saveOffline: 'Save for offline reading', offlineAvailable: 'An offline copy is available on this phone.', removeOffline: 'Remove offline copy', offlineStale: 'The saved copy is outdated. Update it to get the latest version.', size: 'Size', pages: 'Pages', unknown: 'Unknown', indexStatus: 'Index status', pageResult: 'Search result on page', documentOnlineUnavailable: 'Online document details are unavailable.', documentLinkError: 'Could not get a temporary document link from the server.', documentOpenError: 'Could not open the document.', documentDownloadLinkError: 'Could not create a file download link.', documentDownloadFailed: 'File download failed ({status}).', documentSizeMismatch: 'The downloaded file size does not match the document. The previous copy was kept.', documentSaveOfflineError: 'Could not save the document for offline use.', documentRemoveOfflineError: 'Could not remove the offline copy.', comingSoon: 'Coming soon', devVersion: 'Development version',
    ghabz: 'Bill payment', taghiz: 'Standards and Guidelines', engineering: 'Engineering calculations', safety: 'Safety messages and principles', colleaguesChat: 'Colleague discussion', tenders: 'Tenders', marketplace: 'Equipment marketplace', project: 'my project', notebookModule: 'Technical notebook', loginToSave: 'Sign in to save notes', editNote: 'Edit note', newNote: 'New note', noteTitle: 'Note title', noteBodyPlaceholder: 'Text, technical detail or calculation result...', saveToPhone: 'Save on this phone', cancelEdit: 'Cancel editing', offlineNote: 'Your note is saved encrypted on this phone first and synchronized when internet returns.', myNotes: 'My notes', refresh: 'Refresh', synced: 'Synced', conflict: 'Conflict needs attention', savedPending: 'Saved on this phone · waiting to sync', keepMine: 'Keep my version', useServer: 'Use server version', noNotes: 'You have not added any notes yet.', titleAndBodyRequired: 'Enter both a title and note text.', readNotesError: 'Could not load saved notes.', saveNoteError: 'Could not save the note.', resolveConflictError: 'Could not resolve the conflict.',
    operations: 'Operations', engineeringPlanning: 'Engineering and planning', sales: 'Sales and customer services', consultant: 'Consultant supervision',
  },
} as const;

interface AppSettingsContextValue {
  language: AppLanguage;
  theme: AppTheme;
  direction: 'rtl' | 'ltr';
  isDark: boolean;
  ready: boolean;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  setLanguage: (value: AppLanguage) => Promise<void>;
  setTheme: (value: AppTheme) => Promise<void>;
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [language, setLanguageState] = useState<AppLanguage>('fa');
  const [theme, setThemeState] = useState<AppTheme>('auto');
  const [localHour, setLocalHour] = useState(() => new Date().getHours());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([readSetting<AppLanguage>('language', 'fa'), readSetting<AppTheme>('theme', 'auto')])
      .then(([storedLanguage, storedTheme]) => {
        if (!active) return;
        setLanguageState(['fa', 'ku', 'en'].includes(storedLanguage) ? storedLanguage : 'fa');
        setThemeState(['system', 'light', 'dark', 'auto'].includes(storedTheme) ? storedTheme : 'auto');
      })
      .catch(() => {})
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') setLocalHour(new Date().getHours()); });
    const interval = setInterval(() => setLocalHour(new Date().getHours()), 60_000);
    return () => { subscription.remove(); clearInterval(interval); };
  }, []);

  const setLanguage = useCallback(async (value: AppLanguage) => { setLanguageState(value); await writeSetting('language', value); }, []);
  const setTheme = useCallback(async (value: AppTheme) => { setThemeState(value); await writeSetting('theme', value); }, []);
  const value = useMemo<AppSettingsContextValue>(() => ({
    language, theme, direction: language === 'en' ? 'ltr' : 'rtl', isDark: theme === 'dark' || (theme === 'system' && systemScheme === 'dark') || (theme === 'auto' && (localHour >= 18 || localHour < 6)), ready,
    t: (key, params) => {
      const template: string = translations[language][key] || translations.fa[key];
      if (!params) return template;
      return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
    },
    setLanguage, setTheme,
  }), [language, theme, systemScheme, localHour, ready, setLanguage, setTheme]);

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (!context) throw new Error('useAppSettings must be used inside AppSettingsProvider');
  return context;
}
