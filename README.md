# 🌍 Ghadeer Logistics Site

موقع تجريبي لشركة الغدير للخدمات اللوجستية  
🚛 إدارة حسابات العملاء، تتبع الشحنات، وصفحات تعريفية (عن الشركة، تواصل معنا).

![Preview](screenshot.png)

## ✨ المميزات
- **📦 تتبع الشحنات** (بيانات تجريبية حالياً).
- **💼 إدارة العملاء**:
  - إضافة / تعديل / حذف عميل.
  - لكل عميل صفحة خاصة بالفواتير.
  - جمع تلقائي لمجموع الحساب.
- **🔑 تسجيل الدخول** (تجريبي: admin / 1234).
- **📤 تصدير CSV**: تنزيل بيانات العملاء لاستخدامها في Excel.
- **🔍 بحث + فرز** في قائمة العملاء.

## 📂 هيكل الملفات
```
ghadeer-logistics-site/
│
├── index.html       ← الصفحة الرئيسية
├── about.html       ← عن الشركة
├── contact.html     ← اتصل بنا
├── track.html       ← تتبع الشحنات
├── accounts.html    ← إدارة العملاء
├── client.html      ← صفحة العميل (ديناميكية عبر localStorage)
├── login.html       ← تسجيل الدخول
├── your-logo.jpeg   ← شعار الشركة
```

## 🚀 النشر على GitHub Pages
1. أنشئ مستودع جديد في GitHub (مثلاً: `ghadeer-logistics-site`).
2. ارفع فيه هذه الملفات.
3. من `Settings > Pages` فعّل **GitHub Pages** على فرع `main`.
4. موقعك سيكون متاح على:
   ```
   https://username.github.io/ghadeer-logistics-site/
   ```

## 📝 ملاحظات
- البيانات تُحفظ محلياً في المتصفح (localStorage).
- لا توجد قاعدة بيانات أو PHP لأن GitHub Pages يستضيف صفحات **static** فقط.
- لتجربة كاملة مع backend (تتبع حقيقي + تسجيل دخول فعلي)، تحتاج استضافة تدعم **PHP/MySQL**.

## 🔗 Demo
بعد رفع المشروع على GitHub Pages سيكون متاح عبر الرابط (غيّر *username* باسم حسابك):
```
https://username.github.io/ghadeer-logistics-site/
```

## 💻 تشغيل محلي
لتجربة الموقع على جهازك بدون رفعه:
1. حمّل الملفات كـ ZIP أو استنسخ المستودع.
2. فك الضغط وافتح المجلد.
3. ببساطة افتح ملف `index.html` بالمتصفح (Chrome / Edge / Firefox).
4. جميع الميزات (الحسابات، الفواتير، البحث...) تعمل باستخدام `localStorage`.

## 📸 لقطات شاشة إضافية
**صفحة الحسابات:**
![Accounts](screenshot-accounts.png)

**صفحة العميل:**
![Client](screenshot-client.png)
