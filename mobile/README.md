# Mobile app — Handbook Distribution

## Requirements
- Node.js 22 LTS
- Expo SDK 54 toolchain
- Android Studio / Android SDK for Android builds
- Xcode on macOS for iOS builds

## Configuration
1. Copy `.env.example` to `.env`.
2. Set `EXPO_PUBLIC_API_URL` to the full API base URL, including `/api/v1`.
   - Android emulator: `http://10.0.2.2:3000/api/v1`
   - iOS simulator: `http://localhost:3000/api/v1`
   - Physical phone: use the development computer's LAN IP; both devices must be on the same network.
   - Release builds: a public HTTPS URL. The value is inlined at build time and a release build without it fails with a clear error instead of calling a LAN address.
3. Install dependencies with `npm ci`.

## Native development build
The app enables SQLCipher through the `expo-sqlite` config plugin and uses the native camera and persistent file storage. These features require a native development build; Expo Go is not a valid test target.

```bash
npx expo prebuild
npx expo run:android
```

On macOS, use `npx expo run:ios` for iOS.

## Offline and sync behavior
- SQLite is encrypted with SQLCipher; its random key is stored in SecureStore/Keychain.
- Refresh tokens and the last authenticated user profile are stored in SecureStore. Access tokens remain in memory.
- Notes, form drafts, search result pages, cached document metadata, calculations and captured OCR photos are stored locally.
- `startAutoSync(userId)` is started after account restoration/login and stopped on logout/account switch. It retries in the foreground and preserves local data while offline.
- OCR photos are copied into the app's persistent documents directory before upload. They are not discarded when a network request fails.

## Current mobile routes
- `/` — compact home screen with Persian/Kurdish/English labels and RTL/LTR layout
- `/search` — debounced data-center search with user-scoped offline result cache
- `/document/:id` — document metadata and short-lived signed file opening link
- `/camera` — camera capture, persistent local OCR queue, Persian/English extraction
- `/notebook` — offline-first technical notebook with conflict resolution
- `/profile` — job role and province selection, localized province labels and distribution-company website
- `/settings` — persisted language and light/dark/system/automatic-by-hour appearance settings
- `/calculator` — general calculator with offline calculation history
- `/login` — account login; public search remains available to guests

The other product modules are represented in the home navigation design but are not yet active. They must be implemented against approved formulas, source material and backend contracts before activation.

## سیاست نگهداری آفلاین و محدودیت منابع

- فایل‌های آفلاین اسناد به‌صورت پیش‌فرض حداکثر ۲۵ فایل و ۱۰۰ مگابایت برای هر حساب نگهداری می‌شوند؛ با رسیدن به سقف، قدیمی‌ترین فایل‌های کم‌استفاده حذف می‌شوند و فایل فعلی حفظ می‌شود.
- metadata حداکثر ۲۰۰ سند، cache جست‌وجو حداکثر ۱۰۰ صفحه و تاریخچهٔ محاسبات حداکثر ۱۰۰ مورد اخیر نگهداری می‌شود.
- عملیات همگام‌شدهٔ outbox پس از ۳۰ روز پاک می‌شوند؛ Pending، Retry و Conflict هرگز با پاک‌سازی خودکار حذف نمی‌شوند.
- فایل اصلی کتابخانه به‌طور خودکار روی گوشی دریافت نمی‌شود؛ فقط با درخواست کاربر و از طریق لینک کوتاه‌عمر ذخیره می‌شود.
- SQLCipher باید با build بومی Android/iOS تأیید شود؛ Expo Go برای این تنظیمات کافی نیست.
