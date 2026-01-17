# الغدير نقل و تخليص — Offline

## تشغيل بدون إنترنت
هذا المشروع لا يحتاج إنترنت للتشغيل/الحفظ.  
لكن بسبب استخدام ES Modules (`type="module"`)، يُفضّل تشغيله عبر سيرفر محلي (بدون إنترنت).

### الطريقة الأسرع (Python)
داخل مجلد المشروع:
```bash
python -m http.server 8000
```
ثم افتح:
- http://localhost:8000/alghadeer-app/index.html

### VS Code
استخدم إضافة Live Server وافتح `index.html`.

## التصدير إلى Excel
- بدون أي مكتبة: التصدير يكون بصيغة **.xls (SpreadsheetML)** ويُفتح في Excel.
- إذا تريد **.xlsx** الحقيقي Offline:
  - ضع ملف: `assets/vendor/xlsx.full.min.js`
  - ثم فعّل السطر المعلّق في `invoice.html` و `reports.html`.
