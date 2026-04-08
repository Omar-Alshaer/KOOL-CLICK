# Kool Click — شرح الموقع والخطوات والكود

هذا الملف يشرح بنظرة منظمة مشروع **Kool Click**: فكرة الموقع، أدوار المستخدمين، الصفحات الأساسية، والخطوات التشغيلية، مع لمحة واضحة عن هيكلة الكود.

## 1) فكرة المشروع باختصار
Kool Click نظام طلبات أكل داخل الحرم الجامعي، يقسم المستخدمين إلى 3 أدوار رئيسية:
- **Clicker (الطالب/العميل)**: يتصفح المطاعم، يضيف إلى السلة، يطلب، يتابع الطلبات ويكسب نقاط.
- **Cashier (الكاشير)**: يستقبل الطلبات، يحدّث الحالة، ويؤكد الاستلام/الدفع.
- **Manager (المدير)**: يدير المنتجات والعروض والبروموكودز، ويتابع الإحصائيات والتقارير.

## 2) هيكل الصفحات
كل دور له مجموعة صفحات مستقلة:

### Clicker
- `public/pages/clicker/login.html`
- `public/pages/clicker/register.html`
- `public/pages/clicker/forgot-password.html`
- `public/pages/clicker/home.html`
- `public/pages/clicker/menu.html`
- `public/pages/clicker/restaurant.html`
- `public/pages/clicker/cart.html`
- `public/pages/clicker/orders.html`
- `public/pages/clicker/profile.html`

### Cashier
- `public/pages/cashier/login.html`
- `public/pages/cashier/dashboard.html`
- `public/pages/cashier/order.html`
- `public/pages/cashier/completed.html`

### Manager
- `public/pages/manager/login.html`
- `public/pages/manager/dashboard.html`
- `public/pages/manager/products.html`
- `public/pages/manager/products-view.html`
- `public/pages/manager/offers.html`
- `public/pages/manager/reports.html`

## 3) مسار الدخول
الملف `index.html` يحول مباشرة إلى:
- `public/pages/clicker/login.html`

## 4) خطوات التشغيل (High-Level Flow)
1. **Clicker** يسجل/يدخل بحساب.
2. يتصفح المطاعم والمنتجات ويضيف للسلة.
3. يضع الطلب، والدفع إما `CashOnDelivery` أو `InstaPay`.
4. الطلب يذهب للكاشير ويظهر في الـDashboard.
5. الكاشير يحدث حالة الطلب حتى الاستلام.
6. بعد الاستلام تُضاف النقاط للعميل.
7. المدير يدير المنتجات والعروض ويراقب الأداء.

## 5) هيكل الكود (JavaScript)
الكود مقسم حسب الدور + خدمات مشتركة:

### A) ملفات Clicker
- `public/js/clicker-common.js`: حماية الصفحات + الهيدر + البيانات المصغرة للمستخدم.
- `public/js/clicker-login.js`: تسجيل الدخول.
- `public/js/clicker-register.js`: التسجيل واختيار الصورة.
- `public/js/clicker-home.js`: الصفحة الرئيسية + عرض العروض.
- `public/js/clicker-menu.js`: قائمة المطاعم.
- `public/js/clicker-restaurant.js`: قائمة منتجات مطعم محدد.
- `public/js/clicker-cart.js`: السلة + الدفع + البروموكود.
- `public/js/clicker-orders.js`: متابعة الطلبات وعرض QR.
- `public/js/clicker-profile.js`: بيانات المستخدم وتعديل اسم المستخدم.
- `public/js/clicker-forgot-password.js`: إعادة تعيين كلمة المرور.

### B) ملفات Cashier
- `public/js/cashier-common.js`: حماية الصفحات + الهيدر.
- `public/js/cashier-login.js`: تسجيل دخول الكاشير.
- `public/js/cashier-dashboard.js`: عرض الطلبات + QR scanning + تحديث الحالة.
- `public/js/cashier-order.js`: صفحة طلب واحد بالتفاصيل.
- `public/js/cashier-completed.js`: الطلبات المكتملة.

### C) ملفات Manager
- `public/js/manager-common.js`: حماية الصفحات + الهيدر.
- `public/js/manager-login.js`: تسجيل دخول المدير.
- `public/js/manager-dashboard.js`: مؤشرات سريعة عن الطلبات.
- `public/js/manager-products.js`: إضافة/تعديل/حذف منتجات.
- `public/js/manager-products-view.js`: عرض كتالوج المنتجات.
- `public/js/manager-offers.js`: إدارة العروض والبروموكود.
- `public/js/manager-reports.js`: تقارير مبيعات شاملة.

### D) خدمات (Services)
- `public/js/services/auth-service.js`: تسجيل/دخول المستخدمين (Clicker).
- `public/js/services/cashier-service.js`: خدمات خاصة بالكاشير.
- `public/js/services/manager-service.js`: خدمات الإدارة.
- `public/js/services/order-service.js`: إنشاء الطلبات، الإلغاء، الحسابات.
- `public/js/services/restaurant-service.js`: بيانات المطاعم.
- `public/js/services/offers-service.js`: العروض النشطة.
- `public/js/services/promo-service.js`: التحقق من البروموكود.
- `public/js/services/upload-service.js`: رفع الصور لـ Cloudinary.

### E) Utilities
- `public/js/utils/validators.js`: التحقق من البريد/الهاتف.
- `public/js/utils/storage.js`: تخزين السلة في LocalStorage.
- `public/js/utils/promo.js`: حساب خصم البروموكود.
- `public/js/utils/popup.js`: رسائل وتنبيهات.
- `public/js/utils/loading.js`: Loading states للأزرار.
- `public/js/utils/levels.js`: حساب نقاط ومستوى المستخدم.
- `public/js/utils/dom.js`: حماية من XSS + sanitize.

## 6) قواعد الحالة والطلب
حالات الطلب موجودة في:
- `public/js/config/app-config.js`

المسار الأساسي للطلب:
`Pending → Preparing → Ready → Collected`
مع دعم لحالة `Cancelled`.

## 7) نقاط المكافآت
- التسجيل: يحصل المستخدم على نقاط مبدئية.
- الدفع InstaPay: النقاط تُضاف فورًا.
- الدفع عند الاستلام: النقاط تُضاف عند جمع الطلب.

## 8) إعدادات خارجية
### Firebase
الإعدادات موجودة في:
- `public/js/config/firebase.js`

### Cloudinary
الإعدادات موجودة في:
- `public/js/config/app-config.js`

## 9) ملاحظات مهمة للفريق
- أي بيانات قادمة من Firestore يتم تعقيمها قبل العرض لحماية الواجهة.
- حالات الطلب تُسجّل في `statusHistory` مع `serverTimestamp`.
- إلغاء الطلب لا يحذف الـDocument، بل يغيّر الحالة إلى `Cancelled`.

---

لو حابب أضيف جزء إضافي (مثلاً: خطوات النشر، قواعد الـFirestore، أو API flow)، قولّي و أزوده فورًا.
