export type FaqItem = {
  question?: string;
  answer?: string;
};

export type SeoScoreInput = {
  title: string;
  excerpt: string;
  slug: string;
  content: string;
  image: string;
  imageAlt: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  focusKeyword: string;
  faq?: FaqItem[];
};

export type SeoIssue = {
  type: "error" | "warning" | "success";
  label: string;
  points: number;
  hint: string;
};

function hasValue(value?: string | null) {
  return Boolean(value && value.trim().length > 0);
}

export function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}

function countMatches(text: string, keyword: string) {
  const cleanKeyword = normalizeText(keyword.trim());
  if (!cleanKeyword) return 0;

  const cleanText = normalizeText(text);
  const escapedKeyword = cleanKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return cleanText.match(new RegExp(escapedKeyword, "g"))?.length ?? 0;
}

function countHeadings(content: string, level: 1 | 2 | 3) {
  const pattern = level === 1 ? /^#\s+/gm : level === 2 ? /^##\s+/gm : /^###\s+/gm;
  return content.match(pattern)?.length ?? 0;
}

function getFirstWords(content: string, limit = 150) {
  return content.trim().split(/\s+/).slice(0, limit).join(" ");
}

function includesText(source: string, target: string) {
  if (!source || !target) return false;
  return normalizeText(source).includes(normalizeText(target));
}

function addScore(
  issues: SeoIssue[],
  condition: boolean,
  successLabel: string,
  failLabel: string,
  points: number,
  hint: string,
  failType: "error" | "warning" = "warning"
) {
  issues.push({
    type: condition ? "success" : failType,
    label: condition ? successLabel : failLabel,
    points: condition ? points : 0,
    hint,
  });

  return condition ? points : 0;
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function analyzeTopicSeo(input: SeoScoreInput) {
  const faq = input.faq ?? [];
  const filledFaqCount = faq.filter((item) => item.question?.trim() && item.answer?.trim()).length;

  const wordCount = countWords(input.content);
  const charCount = input.content.length;
  const h1Count = countHeadings(input.content, 1);
  const h2Count = countHeadings(input.content, 2);
  const h3Count = countHeadings(input.content, 3);
  const keywordMatches = countMatches(input.content, input.focusKeyword);
  const keywordDensity =
    wordCount > 0 && keywordMatches > 0
      ? Number(((keywordMatches / wordCount) * 100).toFixed(1))
      : 0;

  const keywordInTitle =
    includesText(input.title, input.focusKeyword) || includesText(input.seoTitle, input.focusKeyword);
  const keywordInDescription =
    includesText(input.excerpt, input.focusKeyword) ||
    includesText(input.seoDescription, input.focusKeyword);
  const keywordInFirstWords = includesText(getFirstWords(input.content), input.focusKeyword);
  const keywordInAlt = includesText(input.imageAlt, input.focusKeyword);
  const keywordInSlug = includesText(input.slug.replace(/-/g, " "), input.focusKeyword);

  const internalLinksCount =
    input.content.match(/\[[^\]]+\]\((\/topics\/|\/projects\/)[^)]+\)/g)?.length ?? 0;

  const seoIssues: SeoIssue[] = [];
  const contentIssues: SeoIssue[] = [];
  const readinessIssues: SeoIssue[] = [];

  let seoScore = 0;
  let contentScore = 0;
  let readinessScore = 0;

  seoScore += addScore(
    seoIssues,
    input.seoTitle.length >= 45 && input.seoTitle.length <= 60,
    "SEO Title مضبوط",
    "SEO Title محتاج ضبط",
    14,
    "اكتب عنوانًا بين 45 و60 حرفًا، واضح ومقنع ويحتوي على زاوية البحث."
  );

  seoScore += addScore(
    seoIssues,
    input.seoDescription.length >= 120 && input.seoDescription.length <= 160,
    "Meta Description مضبوط",
    "Meta Description محتاج ضبط",
    14,
    "الوصف المثالي بين 120 و160 حرفًا، ويشرح وعد المقال بدون حشو."
  );

  seoScore += addScore(
    seoIssues,
    hasValue(input.focusKeyword),
    "Focus Keyword موجود",
    "Focus Keyword غير موجود",
    10,
    "حدد كلمة أو عبارة بحثية رئيسية واحدة تقود المقال.",
    "error"
  );

  seoScore += addScore(
    seoIssues,
    keywordInTitle,
    "الكلمة الرئيسية ظاهرة في العنوان",
    "الكلمة الرئيسية غائبة عن العنوان",
    10,
    "ظهورها في العنوان أو SEO Title يساعد جوجل والمحرر يفهمان زاوية المقال."
  );

  seoScore += addScore(
    seoIssues,
    keywordInDescription,
    "الكلمة الرئيسية ظاهرة في الوصف",
    "الكلمة الرئيسية غائبة عن الوصف",
    8,
    "ضع الكلمة طبيعيًا داخل الوصف المختصر أو Meta Description."
  );

  seoScore += addScore(
    seoIssues,
    keywordInFirstWords,
    "الكلمة موجودة في بداية المقال",
    "الكلمة غير موجودة في أول المقال",
    8,
    "أول 150 كلمة لازم تقول لجوجل والقارئ المقال عن إيه."
  );

  seoScore += addScore(
    seoIssues,
    hasValue(input.image),
    "الصورة الرئيسية موجودة",
    "الصورة الرئيسية غير موجودة",
    6,
    "كل موضوع يحتاج صورة رئيسية واضحة.",
    "error"
  );

  seoScore += addScore(
    seoIssues,
    input.imageAlt.length >= 35 && input.imageAlt.length <= 140,
    "Alt Text مناسب",
    "Alt Text محتاج تحسين",
    8,
    "اكتب وصفًا طبيعيًا للصورة بين 35 و140 حرفًا.",
    hasValue(input.imageAlt) ? "warning" : "error"
  );

  seoScore += addScore(
    seoIssues,
    keywordInAlt,
    "الكلمة الرئيسية داخل Alt Text",
    "الكلمة الرئيسية غير موجودة في Alt Text",
    5,
    "ضع الكلمة داخل وصف الصورة لو كان طبيعيًا وغير مفتعل."
  );

  seoScore += addScore(
    seoIssues,
    input.seoKeywords.length >= 3,
    "SEO Keywords كافية",
    "SEO Keywords قليلة",
    5,
    "استخدم 3 كلمات أو أكثر بدون حشو."
  );

  seoScore += addScore(
    seoIssues,
    (keywordInSlug && input.slug.length <= 80) || (input.slug.length >= 8 && input.slug.length <= 80),
    "Slug واضح ومناسب",
    "Slug يحتاج تحسين",
    5,
    "الرابط الأفضل قصير، واضح، ولا يتجاوز 80 حرفًا."
  );

  seoScore += addScore(
    seoIssues,
    keywordMatches >= 2 && keywordDensity <= 2.5,
    "تكرار الكلمة طبيعي",
    keywordDensity > 2.5 ? "تكرار الكلمة زائد" : "الكلمة قليلة داخل المقال",
    12,
    "استهدف كثافة طبيعية تقريبية بين 0.5% و2% بدون حشو."
  );

  contentScore += addScore(
    contentIssues,
    wordCount >= 800,
    "طول المقال جيد",
    "المقال قصير",
    22,
    "المقالات التعليمية القوية غالبًا تحتاج 800 إلى 1800 كلمة."
  );

  contentScore += addScore(
    contentIssues,
    h1Count === 1,
    "يوجد H1 واحد واضح",
    h1Count === 0 ? "لا يوجد H1" : "يوجد أكثر من H1",
    14,
    "ابدأ المقال بعنوان رئيسي واحد فقط بصيغة # عنوان المقال.",
    "error"
  );

  contentScore += addScore(
    contentIssues,
    h2Count >= 2,
    "عناوين H2 كافية",
    "عناوين H2 قليلة",
    14,
    "قسّم المقال بعناوين فرعية واضحة."
  );

  contentScore += addScore(
    contentIssues,
    filledFaqCount >= 3,
    "FAQ قوي",
    "FAQ يحتاج زيادة",
    14,
    "الأفضل 3 إلى 6 أسئلة تبحث عنها الناس فعلًا."
  );

  contentScore += addScore(
    contentIssues,
    internalLinksCount >= 1,
    "يوجد رابط داخلي",
    "لا توجد روابط داخلية",
    10,
    "اربط المقال بموضوعات أو مشاريع داخل الموقع."
  );

  contentScore += addScore(
    contentIssues,
    h3Count >= 1,
    "يوجد تقسيم H3",
    "لا يوجد H3",
    6,
    "مفيد في المقالات الطويلة لتقسيم التفاصيل."
  );

  contentScore += addScore(
    contentIssues,
    charCount >= 2500,
    "عمق المحتوى جيد",
    "المحتوى يحتاج عمق أكثر",
    14,
    "لا تكتب فقرة جميلة فقط؛ اكتب إجابة كاملة تكسب الثقة."
  );

  contentScore += addScore(
    contentIssues,
    input.excerpt.length >= 80 && input.excerpt.length <= 220,
    "الوصف المختصر مناسب للكروت",
    "الوصف المختصر يحتاج ضبط",
    6,
    "الوصف المختصر يفضل يكون واضحًا ومقنعًا بين 80 و220 حرفًا."
  );

  readinessScore += addScore(
    readinessIssues,
    hasValue(input.title),
    "العنوان موجود",
    "العنوان غير موجود",
    10,
    "العنوان حقل أساسي.",
    "error"
  );

  readinessScore += addScore(
    readinessIssues,
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug),
    "Slug صالح",
    "Slug غير صالح",
    10,
    "استخدم حروف إنجليزية صغيرة وأرقام وشرطة بين الكلمات.",
    "error"
  );

  readinessScore += addScore(
    readinessIssues,
    hasValue(input.excerpt) && input.excerpt.length >= 20,
    "الوصف المختصر موجود",
    "الوصف المختصر ناقص",
    10,
    "الوصف المختصر يظهر في الكروت وقد يستخدم كـ fallback.",
    "error"
  );

  readinessScore += addScore(
    readinessIssues,
    input.content.length >= 300,
    "المحتوى الأساسي موجود",
    "المحتوى قصير جدًا",
    15,
    "لا تنشر مقالًا بدون محتوى حقيقي.",
    "error"
  );

  readinessScore += addScore(
    readinessIssues,
    hasValue(input.image),
    "الصورة موجودة",
    "الصورة غير موجودة",
    10,
    "الصورة مطلوبة.",
    "error"
  );

  readinessScore += addScore(
    readinessIssues,
    hasValue(input.imageAlt),
    "Alt Text موجود",
    "Alt Text غير موجود",
    10,
    "وصف الصورة مطلوب.",
    "error"
  );

  readinessScore += addScore(
    readinessIssues,
    hasValue(input.seoTitle),
    "SEO Title موجود",
    "SEO Title غير موجود",
    10,
    "مطلوب قبل النشر.",
    "error"
  );

  readinessScore += addScore(
    readinessIssues,
    hasValue(input.seoDescription),
    "SEO Description موجود",
    "SEO Description غير موجود",
    10,
    "مطلوب قبل النشر.",
    "error"
  );

  readinessScore += addScore(
    readinessIssues,
    hasValue(input.focusKeyword),
    "Focus Keyword موجود",
    "Focus Keyword غير موجود",
    10,
    "مطلوب قبل النشر.",
    "error"
  );

  readinessScore += addScore(
    readinessIssues,
    filledFaqCount >= 1,
    "يوجد FAQ واحد على الأقل",
    "لا يوجد FAQ",
    5,
    "وجود FAQ واحد على الأقل أفضل من عدمه."
  );

  seoScore = clampScore(seoScore);
  contentScore = clampScore(contentScore);
  readinessScore = clampScore(readinessScore);

  const overallScore = clampScore(seoScore * 0.45 + contentScore * 0.3 + readinessScore * 0.25);

  const label =
    overallScore >= 90
      ? "ممتاز"
      : overallScore >= 75
        ? "جاهز"
        : overallScore >= 55
          ? "متوسط"
          : "يحتاج تحسين";

  const blockingErrors = [...seoIssues, ...contentIssues, ...readinessIssues].filter(
    (issue) => issue.type === "error"
  ).length;

  return {
    seoScore,
    contentScore,
    readinessScore,
    overallScore,
    label,
    blockingErrors,
    wordCount,
    charCount,
    h1Count,
    h2Count,
    h3Count,
    faqCount: filledFaqCount,
    keywordMatches,
    keywordDensity,
    internalLinksCount,
    issues: {
      seo: seoIssues,
      content: contentIssues,
      readiness: readinessIssues,
    },
  };
}
