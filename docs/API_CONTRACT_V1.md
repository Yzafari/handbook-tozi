# قرارداد API موبایل — نسخه ۱

پیشوند: `/api/v1`

## Envelope
موفق:
```json
{"success":true,"data":{},"message":"..."}
```
خطا:
```json
{"success":false,"error":{"code":"VALIDATION_ERROR","message":"...","details":[],"requestId":"..."}}
```

## احراز هویت موبایل (در این مرحله پیاده‌سازی شده)
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/change-password`
- `GET /users/me` و `PATCH /users/me` — پروفایل، سمت شغلی و استان؛ مقادیر استان از ۳۱ کد معتبر پشتیبانی می‌شوند.

ورود و تمدید نشست، `accessToken` و `refreshToken` را در پاسخ JSON برمی‌گردانند. کلاینت باید Refresh Token را فقط در SecureStore نگهداری کند و Access Token را فقط در حافظه نگه دارد. سمت شغلی (`jobRole`) از نقش امنیتی (`role`) جداست و یکی از ۱۳ کد شغلی مصوب محصول است. مسیرهای وب `/api/auth/*` همچنان Cookie-based هستند.

## اسناد و جستجو (در بستهٔ دیتاسنتر پیاده‌سازی شده‌اند)
- `POST /documents` — بارگذاری فایل برای مدیر؛ multipart field `file` و فیلدهای metadata.
- `GET /documents?limit=20&cursor=...` — فهرست اسناد قابل مشاهده.
- `GET /documents/:id` — فراداده سند.
- `GET /documents/:id/content` — دریافت فایل با پشتیبانی Range؛ برای مرورگر، پیوند امضاشدهٔ کوتاه‌عمر از `open-link` استفاده می‌شود.
- `DELETE /documents/:id` — حذف نرم و خارج‌کردن از ایندکس.
- `POST /documents/:id/restore` — بازیابی سند و صف ایندکس مجدد.
- `GET /documents/:id/index-status` — وضعیت ایندکس، مدیرمحور.
- `GET /search?q=...&limit=20&cursor=...` — جستجوی متن فارسی، قطعه‌بندی صفحه‌ای PDF و صفحه‌بندی Cursor؛ هر نتیجه در صورت امکان `pageNumber` و `snippets` دارد؛ فیلترهای اختیاری `type=pdf|image|text`، `language=fa|en|ku` و بازهٔ `from`/`to` نیز پشتیبانی می‌شوند.
- `GET /documents/:id/open-link` — ساخت پیوند امضاشدهٔ ۶۰ ثانیه‌ای برای بازکردن فایل در مرورگر/نمایشگر سیستم.

## OCR دوربین (در این بسته پیاده‌سازی شده)
- `POST /ocr` — بارگذاری تصویر/PDF با multipart field `file` و دریافت شناسهٔ Job.
- `GET /ocr/:id` — وضعیت، متن استخراج‌شده و امتیاز اطمینان در صورت وجود؛ فقط مالک Job.
- `POST /ocr/:id/retry` — تلاش مجدد برای Job ناموفق.
- `DELETE /ocr/:id` — لغو Job و حذف فایل موقت.

اپلیکیشن موبایل تصویر را قبل از ارسال در فضای پایدار محلی ذخیره می‌کند؛ اگر اینترنت قطع شود، ارسال در صف محلی باقی می‌ماند و پس از اتصال دوباره تلاش می‌شود.

## همگام‌سازی آفلاین (در این بسته برای دفترچه و فرم‌ها پیاده‌سازی شده)
- `POST /sync/push` — ارسال حداکثر ۵۰ عملیات idempotent در هر بسته.
- `GET /sync/pull?cursor=...&limit=100` — دریافت تغییرات و tombstoneها.
- `GET /sync/status` — وضعیت عملیات پذیرفته‌شده و تعارض‌ها.
- `GET /sync/record/:moduleName/:entityType/:entityId` — دریافت نسخهٔ سرور برای حل تعارض؛ entityهای مجاز از رجیستری ماژول‌ها می‌آیند.

ماژول‌های محاسبات مهندسی، محاسبه/پرداخت قبض، پیام‌رسانی، مناقصات، بازار تجهیزات و فرم‌های کامل هنوز قرارداد و پیاده‌سازی نهایی ندارند؛ نباید آن‌ها را API آماده تلقی کرد.

### سمت‌های شغلی
`jobRole` یک فیلد مستقل از `role` امنیتی است. کدهای معتبر:

| کد | عنوان |
|---|---|
| `SIMBAN` | سیم‌بان |
| `TECHNICAL_OPERATION_SPECIALIST` | کارشناس فنی و بهره‌برداری |
| `NETWORK_TECHNICIAN` | تکنسین شبکه برق |
| `ENGINEERING_DESIGN_SPECIALIST` | کارشناس مهندسی و طراحی |
| `METER_READER` | مأمور قرائت |
| `ELECTRICITY_MANAGER` | مدیر برق |
| `CONNECTION_SALES_OPERATOR` | اپراتور فروش انشعاب |
| `ENERGY_SALES_OPERATOR` | اپراتور فروش انرژی |
| `CONTRACTOR` | پیمانکار |
| `CONSULTANT_SUPERVISOR` | ناظر مشاور |
| `NETWORK_DESIGNER` | طراح شبکه |
| `LEGAL_SPECIALIST` | کارشناس حقوقی |
| `FINANCE_ADMIN_SPECIALIST` | کارشناس مالی و اداری |

### استان‌ها
`province` یکی از ۳۱ کد استان در `backend/src/config/provinces.js` است. نام شرکت توزیع و وب‌سایت عمومی آن در کاتالوگ موبایل نمایش داده می‌شود؛ استان تهران، فارس، خوزستان و کرمان به دلیل چندشرکتی بودن نیازمند توجه به محدودهٔ خدمت هستند.

### عملیات مدیریتی اسناد

- `GET /documents/admin/metrics` — شمار اسناد، وضعیت ایندکس، صف OCR و حجم ثبت‌شده؛ فقط مدیر.
- `GET /documents/admin/list?cursor=...&limit=20&q=...&status=...&includeDeleted=true` — فهرست مدیریتی با وضعیت آخرین Job و صفحه‌بندی Cursor؛ فقط مدیر.
- `POST /documents` — بارگذاری `multipart/form-data` با فیلدهای `file`, `title`, `description`, `visibility`, `language`؛ فقط مدیر.
- `POST /documents/:id/reindex` — صف‌کردن ایندکس مجدد؛ فقط مدیر.
- `GET /documents/:id/index-status` — وضعیت Job و آخرین خطا؛ فقط مدیر.
- `DELETE /documents/:id` و `POST /documents/:id/restore` — حذف نرم و بازیابی؛ فایل اصلی با حذف نرم پاک نمی‌شود.

### سلامت سرویس‌ها

- `GET /health/live` — بررسی زنده‌بودن فرآیند API؛ برای liveness probe.
- `GET /health/ready` — بررسی آمادگی PostgreSQL؛ خرابی Storage یا OpenSearch نباید کل API و ماژول‌های مستقل را از مدار خارج کند و در محیط غیر Production وضعیت آن‌ها جداگانه گزارش می‌شود. جزئیات وابستگی‌ها فقط در محیط غیر Production برگردانده می‌شود.
