export const CMS_MEDIA_REPLACE_BEHAVIOR = {
  summary:
    "استبدال الملف يعمل بشكل آمن عند تمرير replacePath — على Supabase Storage يُستبدل نفس المفتاح، وعلى نظام الملفات المحلي يُكتب فوق نفس المسار إن وُجد.",
  modes: [
    {
      id: "supabase-storage",
      behavior:
        "عند replacePath صالح داخل نفس المجلد، يُرفع الملف على نفس object key مع upsert=true — المراجع الحالية تبقى صالحة.",
    },
    {
      id: "filesystem-dev",
      behavior:
        "عند replacePath صالح تحت public/، يُستبدل الملف على القرص بنفس الاسم — المراجع النسبية تبقى صالحة.",
    },
    {
      id: "new-upload",
      behavior:
        "بدون replacePath يُنشأ اسم جديد بختم زمني — المراجع القديمة لا تتغير وقد تبقى ملفات يتيمة.",
    },
    {
      id: "legacy-form-upload",
      behavior:
        "مسارات actions القديمة (uploadTopicImage/uploadMediaImage) ما زالت تنشئ ملفًا جديدًا دائمًا — غير مستخدمة من واجهة المكتبة الحالية.",
    },
  ],
  limitations: [
    "لا يوجد حذف تلقائي للملفات اليتيمة بعد الاستبدال.",
    "لا يوجد سجل استخدام في قاعدة البيانات بعد — الفحص الحالي للقراءة فقط.",
    "استبدال عبر مسار خاطئ أو مجلد مختلف ينشئ ملفًا جديدًا بدل الاستبدال.",
  ],
  futureRecommendation:
    "لاحقًا: جدول media_assets + media_asset_usages مع replace مدعوم وآمن على مستوى المنصة، بعد اعتماد migration منفصل.",
} as const;
