# راهنمای اجرای محیط توسعه

## همهٔ سرویس‌ها با Docker

```bash
cp .env.example .env   # سپس JWT_ACCESS_SECRET، ENCRYPTION_KEY، PAYMENT_WEBHOOK_SECRET و DATACENTER_SIGNING_SECRET را پر کنید
./scripts/setup.sh
docker compose up -d
```

Compose از تصاویر `backend/Dockerfile` و `frontend/Dockerfile` ساخته می‌شود، قبل از بالا آمدن API مهاجرت‌های Prisma را اعمال می‌کند و فقط پس از healthy شدن دیتابیس و API سرویس بعدی را بالا می‌آورد. هیچ secretی در `docker-compose.yml` hardcode نشده است و اجرا بدون `.env` معتبر عمداً شکست می‌خورد.

## Backend (اجرای مستقیم)
1. وارد پوشه `backend` شوید.
2. `npm ci` را اجرا کنید.
3. `.env.example` را به `.env` کپی و مقادیر واقعی را وارد کنید.
4. `npx prisma generate` را اجرا کنید.
5. پس از تهیه پشتیبان دیتابیس، `npx prisma migrate deploy` را اجرا کنید.
6. `npm run check` و `npm test` را اجرا کنید.
7. API را با `npm run dev` یا `npm start` اجرا کنید.
8. پردازش اسناد و OCR را در یک Worker جداگانه با `npm run worker:all` اجرا کنید؛ Worker باید به PostgreSQL، دیتاسنتر و OpenSearch دسترسی شبکه‌ای داشته باشد.
9. برای ورود کتابخانهٔ موجود، ابتدا `DOCUMENT_IMPORT_DIR` را تنظیم و `npm run documents:import -- --dry-run` را اجرا کنید؛ پس از بررسی گزارش، `npm run documents:import` را اجرا کنید.

## Mobile
1. وارد پوشه `mobile` شوید.
2. `.env.example` را به `.env` کپی و `EXPO_PUBLIC_API_URL` را تنظیم کنید؛ مقدار باید خود مسیر API را هم شامل شود (مثلاً `https://api.example.com/api/v1`). این متغیر در زمان build داخل باندل قرار می‌گیرد و برای بیلد release الزامی است.
3. `npm ci` را اجرا کنید.
4. به دلیل SQLCipher و دوربین، Expo Go کافی نیست؛ `npx expo prebuild` و سپس `npx expo run:android` را اجرا کنید. برای iOS، روی macOS از `npx expo run:ios` استفاده کنید.

## نکات Production
- از `.env.example` در Production استفاده نکنید؛ همه secretها باید تصادفی، منحصربه‌فرد و خارج از مخزن نگهداری شوند.
- TLS، CORS allowlist، `COOKIE_SAME_SITE`، backup، log retention و مانیتورینگ را قبل از انتشار تنظیم کنید. اگر فرانت‌اند و API واقعاً cross-site هستند، `COOKIE_SAME_SITE=none` و HTTPS برای هر دو cookie لازم است؛ استقرار هم‌مبدأ پشت reverse proxy ترجیح دارد.
- دیتاسنتر فایل و Search Engine را روی منابع جدا از API اصلی مستقر کنید. در Production، `DATACENTER_PUBLIC_URL` را به HTTPS storage host تنظیم کنید و `DATACENTER_SIGNING_SECRET` مستقل و حداقل ۳۲ کاراکتری را بین API و storage به‌صورت امن هماهنگ کنید؛ لینک‌های فایل با HMAC و عمر ۱۲۰ ثانیه صادر می‌شوند و دانلود مستقیماً از Storage انجام می‌شود. در توسعه، خالی‌گذاشتن `DATACENTER_PUBLIC_URL` باعث استفاده از API proxy می‌شود. در Production، TLS و احراز هویت OpenSearch را فعال کنید؛ تنظیمات compose این بسته برای توسعه/شبکه خصوصی است.
- Redis را فقط به شبکه خصوصی متصل کنید؛ در Production متغیر `REDIS_URL` باید `rediss://` باشد. Redis برای cache و شمارندهٔ مشترک rate limit بین چند API replica استفاده می‌شود؛ هنگام قطعی Redis، fallback محلی فقط در همان replica اعمال می‌شود. Redis cache است و نباید تنها محل نگهداری داده باشد.
- برای اجرای محلی سرویس‌های دیتاسنتر: `docker compose --env-file backend/.env -f docker-compose.datacenter.yml up -d opensearch redis document-storage`. برای Workerهای جداگانهٔ ایندکس و OCR، `WORKER_DATABASE_URL` را در `backend/.env` تنظیم و `docker compose --env-file backend/.env -f docker-compose.datacenter.yml up -d document-index-worker ocr-worker` را اجرا کنید. برای استقرار واقعی، Storage و OpenSearch را روی میزبان‌های جدا با دیسک پایدار، Snapshot و Backup مستقل مستقر کنید.
- قبل از هر Migration نسخه پشتیبان و برنامه بازگشت داشته باشید.

## Frontend پنل مدیریت
1. وارد پوشه `frontend` شوید.
2. `npm ci` را اجرا کنید.
3. `npm run build` برای ساخت نسخه انتشار یا `npm run dev` برای توسعه اجرا شود.
4. Vite به‌صورت پیش‌فرض API را به `http://localhost:3000` پروکسی می‌کند؛ در صورت تغییر پورت بک‌اند، `vite.config.js` نیز باید هماهنگ شود.

## آدرس API موبایل
- Android Emulator معمولاً برای دسترسی به میزبان توسعه از `http://10.0.2.2:3000` استفاده می‌کند.
- iOS Simulator معمولاً می‌تواند از `http://localhost:3000` استفاده کند.
- گوشی واقعی باید از IP شبکه محلی رایانه/سرور استفاده کند؛ در Production فقط HTTPS.

## پشتیبان‌گیری و بازیابی

- برای PostgreSQL، اسکریپت `backend/scripts/backup-database.sh` را روزانه با کاربر محدود و `DATABASE_URL` اجرا کنید؛ خروجی custom-format و SHA-256 تولید می‌شود.
- روی میزبان دیتاسنتر، `datacenter/scripts/backup-storage.sh` را برای snapshot افزایشی مبتنی بر hard-link اجرا کنید. `DATACENTER_STORAGE_DIR` باید مسیر volume واقعی Storage باشد و `BACKUP_DIR` روی دیسک/میزبان مستقل قرار گیرد.
- Backup دیتابیس و فایل‌ها باید در مقصدی جدا، رمزگذاری‌شده و خارج از میزبان اصلی نگهداری شود. سیاست پیشنهادی: روزانه، نگهداری حداقل ۱۴ نسخه، یک نسخهٔ هفتگی خارج از سایت و آزمون بازیابی ماهانه.
- OpenSearch منبع حقیقت نیست؛ در صورت خرابی، پس از بازیابی PostgreSQL و فایل‌ها، ایندکس با `npm run documents:reindex` بازسازی می‌شود. پنل مدیریت در مسیر `/admin/documents` برای بارگذاری، مشاهدهٔ وضعیت، ایندکس مجدد، حذف نرم و بازیابی اسناد قرار دارد.
- قبل از اتکا به Backup، بازیابی آزمایشی را روی محیط جداگانه انجام دهید. اجرای Backup به‌تنهایی اثبات قابل‌بازیابی‌بودن آن نیست.
