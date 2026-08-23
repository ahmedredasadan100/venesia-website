import {
  SEO_LENGTH_STANDARDS,
  assessSeoLength,
  countSeoTextCharacters,
  describeSeoLength,
  type SeoLengthAssessment,
} from "./seo-length-standards";
import {
  markdownToRichTextHtml,
  normalizeArticleMarkdown,
  stripHtml,
} from "../rich-text/html-utils";

export type FaqItem = {
  question?: string;
  answer?: string;
};

export type SeoScoreProfile = "article" | "entity";

export type SeoScoreInput = {
  profile: SeoScoreProfile;
  title: string;
  description: string;
  slug: string;
  content: string;
  image: string;
  imageAlt: string;
  ogImage: string;
  ogImageAlt: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  focusKeyword: string;
  faq: FaqItem[];
};

export type SeoIssue = {
  id?: string;
  type: "error" | "warning" | "success" | "muted";
  label: string;
  points: number;
  hint: string;
};

export type SeoScoreMetric = {
  id: string;
  label: string;
  value: string;
};

export type SeoScoreOutput = {
  score: number;
  label: string;
  blockingErrors: number;
  issues: SeoIssue[];
  metrics: SeoScoreMetric[];
};

export function sortRowsBySeoScore<T>(
  rows: readonly T[],
  direction: "asc" | "desc",
  getScore: (row: T) => number | null,
  getId: (row: T) => number,
) {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    const leftScore = getScore(left);
    const rightScore = getScore(right);

    if (leftScore === null && rightScore === null) {
      return getId(left) - getId(right);
    }
    if (leftScore === null) return 1;
    if (rightScore === null) return -1;

    return (
      (leftScore - rightScore) * multiplier || getId(left) - getId(right)
    );
  });
}

function hasValue(value?: string | null) {
  return Boolean(value && value.trim().length > 0);
}

function normalizeText(text: string) {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\p{M}\p{Cf}\u0640]/gu, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ؤ]/g, "و")
    .replace(/[ئ]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ىی]/g, "ي")
    .replace(/ک/g, "ك");
}

function renderMarkdown(text: string) {
  return markdownToRichTextHtml(normalizeArticleMarkdown(text));
}

function getVisibleText(rendered: string) {
  return stripHtml(
    rendered.replace(/<\/(?:h[1-3]|blockquote|ul|ol)>/gi, "$& "),
  );
}

function toVisibleText(text: string) {
  return getVisibleText(renderMarkdown(text));
}

function tokenizeVisibleText(text: string) {
  return normalizeText(text).match(/[\p{L}\p{N}]+/gu) ?? [];
}

function getWordTokens(text: string) {
  return tokenizeVisibleText(toVisibleText(text));
}

function getEntityWordTokens(text: string) {
  return tokenizeVisibleText(stripHtml(text));
}

export function countWords(text: string) {
  return getWordTokens(text).length;
}

function countTokenMatches(
  textTokens: readonly string[],
  keywordTokens: readonly string[],
) {
  if (!keywordTokens.length) return 0;

  let matches = 0;
  for (let index = 0; index <= textTokens.length - keywordTokens.length; index += 1) {
    if (keywordTokens.every((token, offset) => textTokens[index + offset] === token)) {
      matches += 1;
    }
  }
  return matches;
}

function countHeadings(rendered: string, level: 1 | 2 | 3) {
  return rendered.match(new RegExp(`<h${level}>`, "g"))?.length ?? 0;
}

function includesTokens(source: string, keywordTokens: readonly string[]) {
  return countTokenMatches(getWordTokens(source), keywordTokens) > 0;
}

function isValidEntityPublicPath(value: string) {
  if (!value) return true;
  if (value.length > 240) return false;
  return value.split("/").every(
    (segment) =>
      segment.length > 0 &&
      segment.length <= 80 &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(segment),
  );
}

function includesEntityTokens(source: string, keywordTokens: readonly string[]) {
  return countTokenMatches(getEntityWordTokens(source), keywordTokens) > 0;
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

function addLengthScore(
  issues: SeoIssue[],
  assessment: SeoLengthAssessment,
  successLabel: string,
  failLabel: string,
  points: number,
) {
  const successful = assessment.state === "success";
  issues.push({
    type: successful
      ? "success"
      : assessment.state === "danger"
        ? "error"
        : assessment.state,
    label: successful ? successLabel : failLabel,
    points: successful ? points : 0,
    hint: describeSeoLength(assessment),
  });

  return successful ? points : 0;
}

function assignIssueIds(issues: SeoIssue[], ids: readonly string[]) {
  issues.forEach((issue, index) => {
    issue.id = ids[index] ?? `issue-${index + 1}`;
  });
}

function analyzeArticleSeo(input: SeoScoreInput) {
  const faq = input.faq;
  const filledFaqCount = faq.filter((item) => item.question?.trim() && item.answer?.trim()).length;

  const renderedContent = renderMarkdown(input.content);
  const visibleContent = getVisibleText(renderedContent);
  const visibleContentTokens = tokenizeVisibleText(visibleContent);
  const firstContentTokens = tokenizeVisibleText(visibleContent).slice(0, 150);
  const keywordTokens = getWordTokens(input.focusKeyword);
  const wordCount = visibleContentTokens.length;
  const charCount = countSeoTextCharacters(visibleContent);
  const h1Count = countHeadings(renderedContent, 1);
  const h2Count = countHeadings(renderedContent, 2);
  const h3Count = countHeadings(renderedContent, 3);
  const keywordMatches = countTokenMatches(
    visibleContentTokens,
    keywordTokens,
  );
  const keywordWordCount = keywordTokens.length;
  const rawKeywordDensity =
    wordCount > 0 && keywordMatches > 0
      ? (keywordMatches * keywordWordCount * 100) / wordCount
      : 0;
  const keywordDensity = Number(rawKeywordDensity.toFixed(2));

  const effectiveTitle = input.seoTitle.trim() || input.title.trim();
  const effectiveDescription =
    input.seoDescription.trim() || input.description.trim();
  const keywordInTitle = includesTokens(effectiveTitle, keywordTokens);
  const keywordInDescription = includesTokens(
    effectiveDescription,
    keywordTokens,
  );
  const keywordInFirstWords =
    countTokenMatches(firstContentTokens, keywordTokens) > 0;
  const keywordInAlt = includesTokens(input.imageAlt, keywordTokens);
  const seoTitleLength = assessSeoLength(
    input.seoTitle,
    SEO_LENGTH_STANDARDS.title,
  );
  const seoDescriptionLength = assessSeoLength(
    input.seoDescription,
    SEO_LENGTH_STANDARDS.description,
  );

  const internalLinksCount =
    input.content.match(/\[[^\]]+\]\(\/(?!\/)[^)#]+\)/g)?.length ?? 0;

  const seoIssues: SeoIssue[] = [];
  const contentIssues: SeoIssue[] = [];
  const readinessIssues: SeoIssue[] = [];

  let seoScore = 0;
  let contentScore = 0;
  let readinessScore = 0;

  seoScore += addLengthScore(
    seoIssues,
    seoTitleLength,
    "SEO Title مضبوط",
    "SEO Title محتاج ضبط",
    12,
  );

  seoScore += addLengthScore(
    seoIssues,
    seoDescriptionLength,
    "Meta Description مضبوط",
    "Meta Description محتاج ضبط",
    12,
  );

  seoScore += addScore(
    seoIssues,
    hasValue(input.focusKeyword),
    "Focus Keyword موجود",
    "Focus Keyword غير موجود",
    8,
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
    hasValue(input.image) &&
      countSeoTextCharacters(input.imageAlt) >= 35 &&
      countSeoTextCharacters(input.imageAlt) <= 140,
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
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) && input.slug.length <= 80,
    "Slug صالح ومقروء",
    "Slug غير صالح أو طويل",
    6,
    "استخدم حروفًا إنجليزية صغيرة وأرقامًا وشرطات، وبحد أقصى 80 حرفًا."
  );

  seoScore += addScore(
    seoIssues,
    rawKeywordDensity >= 0.5 && rawKeywordDensity <= 2.5,
    "تكرار الكلمة طبيعي",
    rawKeywordDensity > 2.5 ? "تكرار الكلمة زائد" : "الكلمة قليلة داخل المقال",
    12,
    `الكثافة الحالية ${keywordDensity}%. النطاق الإرشادي من 0.5% إلى 2.5%، ويُحسب بعدد كلمات العبارة داخل النص المرئي.`
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
    h1Count <= 1,
    h1Count === 0 ? "لا يوجد H1 مكرر داخل Markdown" : "يوجد H1 واحد كحد أقصى داخل Markdown",
    "يوجد أكثر من H1 داخل Markdown",
    14,
    "عنوان الصفحة العام قد يملك H1؛ لذلك يتحقق المحلل فقط من عدم تكرار أكثر من H1 داخل محتوى Markdown نفسه."
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
    "اربط المقال بصفحة مفيدة أخرى داخل الموقع."
  );

  contentScore += addScore(
    contentIssues,
    wordCount < 1200 || h3Count >= 1,
    wordCount < 1200 ? "المحتوى لا يحتاج تقسيم H3 إضافيًا" : "يوجد تقسيم H3 للمحتوى الطويل",
    "المحتوى الطويل يحتاج تقسيم H3",
    6,
    "يصبح H3 إرشادًا مفيدًا فقط عندما يتجاوز المحتوى المرئي 1200 كلمة."
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
    countSeoTextCharacters(input.description) >= 80 &&
      countSeoTextCharacters(input.description) <= 220,
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
    hasValue(input.description) && countSeoTextCharacters(input.description) >= 20,
    "الوصف المختصر موجود",
    "الوصف المختصر ناقص",
    10,
    "الوصف المختصر يظهر في الكروت وقد يستخدم كـ fallback.",
    "error"
  );

  readinessScore += addScore(
    readinessIssues,
    charCount >= 300,
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

  assignIssueIds(seoIssues, [
    "seo-title-length",
    "meta-description-length",
    "focus-keyword",
    "keyword-title",
    "keyword-description",
    "keyword-intro",
    "image",
    "image-alt-length",
    "keyword-alt",
    "seo-keywords",
    "slug",
    "keyword-density",
  ]);
  assignIssueIds(contentIssues, [
    "content-length",
    "h1",
    "h2",
    "faq",
    "internal-links",
    "h3",
    "content-depth",
    "excerpt",
  ]);
  assignIssueIds(readinessIssues, [
    "title",
    "slug",
    "excerpt",
    "content",
    "image",
    "image-alt",
    "seo-title",
    "seo-description",
    "focus-keyword",
    "faq",
  ]);

  const overallScore = Math.round(
    seoScore * 0.45 + contentScore * 0.3 + readinessScore * 0.25,
  );

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

function analyzeEntityProfile(input: SeoScoreInput) {
  const issues: SeoIssue[] = [];
  const effectiveTitle = input.seoTitle.trim() || input.title.trim();
  const effectiveDescription =
    input.seoDescription.trim() || input.description.trim();
  const keyword = input.focusKeyword.trim();
  const combinedTokens = getEntityWordTokens(
    `${input.title} ${input.description} ${input.content}`,
  );
  const keywordTokens = getEntityWordTokens(keyword);
  const wordCount = combinedTokens.length;
  const keywordMatches = countTokenMatches(combinedTokens, keywordTokens);
  const keywordWordCount = keywordTokens.length;
  const rawKeywordDensity =
    wordCount > 0 && keywordMatches > 0
      ? (keywordMatches * keywordWordCount * 100) / wordCount
      : 0;
  const keywordDensity = Number(rawKeywordDensity.toFixed(2));
  let score = 0;

  score += addLengthScore(
    issues,
    assessSeoLength(input.seoTitle, SEO_LENGTH_STANDARDS.title),
    "طول عنوان SEO مناسب",
    "راجع طول عنوان SEO",
    12,
  );
  score += addLengthScore(
    issues,
    assessSeoLength(input.seoDescription, SEO_LENGTH_STANDARDS.description),
    "طول وصف Meta مناسب",
    "راجع طول وصف Meta",
    12,
  );
  score += addScore(
    issues,
    Boolean(keyword),
    "الكلمة المفتاحية الرئيسية محددة",
    "أضف الكلمة المفتاحية الرئيسية",
    12,
    "استخدم عبارة بحث رئيسية واضحة لهذا الكيان.",
    "error",
  );
  score += addScore(
    issues,
    includesEntityTokens(effectiveTitle, keywordTokens),
    "الكلمة المفتاحية مستخدمة في العنوان",
    "استخدم الكلمة المفتاحية في العنوان",
    10,
    "يفضل ظهور العبارة الرئيسية طبيعيًا داخل عنوان SEO.",
  );
  score += addScore(
    issues,
    includesEntityTokens(effectiveDescription, keywordTokens),
    "الكلمة المفتاحية مستخدمة في الوصف",
    "استخدم الكلمة المفتاحية في وصف Meta",
    10,
    "أدرج العبارة مرة واحدة دون حشو.",
  );
  score += addScore(
    issues,
    includesEntityTokens(input.content, keywordTokens),
    "الكلمة المفتاحية موجودة في المحتوى",
    "استخدم الكلمة المفتاحية في المحتوى",
    10,
    "ينبغي أن تدعم بيانات الكيان العبارة الرئيسية.",
  );
  score += addScore(
    issues,
    Boolean(input.image.trim()),
    "صورة المشاركة متاحة",
    "أضف صورة مشاركة",
    10,
    "صورة المشاركة تحسن بطاقة Open Graph.",
  );
  score += addScore(
    issues,
    Boolean(input.image.trim()) && Boolean(input.imageAlt.trim()),
    "النص البديل للصورة متاح",
    input.image.trim() ? "أضف النص البديل للصورة" : "أضف صورة المشاركة أولًا",
    8,
    "صف صورة المشاركة نصيًا.",
  );
  score += addScore(
    issues,
    isValidEntityPublicPath(input.slug),
    "Slug صالح ومقروء",
    "Slug أو مسار الصفحة غير صالح أو طويل",
    8,
    "استخدم مقاطع إنجليزية صغيرة وأرقامًا وشرطات؛ المسارات المتداخلة الصحيحة مدعومة.",
  );
  score += addScore(
    issues,
    input.seoKeywords.length > 0,
    "الكلمات الداعمة موجودة",
    "أضف كلمات SEO داعمة",
    8,
    "استخدم كلمات مرتبطة مباشرة بالمحتوى.",
  );

  const ids = [
    "seo-title-length",
    "meta-description-length",
    "focus-keyword",
    "keyword-title",
    "keyword-description",
    "keyword-content",
    "image",
    "image-alt",
    "slug",
    "seo-keywords",
  ] as const;
  assignIssueIds(issues, ids);
  if (!keyword) {
    for (const issue of issues) {
      if (["keyword-title", "keyword-description", "keyword-content"].includes(issue.id ?? "")) {
        issue.type = "muted";
        issue.label = "أضف الكلمة المفتاحية أولًا لإكمال هذا الفحص";
      }
    }
  }
  const overallScore = Math.round(score);

  return {
    overallScore,
    label:
      overallScore >= 80
        ? "جيد جدًا"
        : overallScore >= 60
          ? "جيد"
          : overallScore >= 40
            ? "يحتاج تحسين"
            : "غير مكتمل",
    wordCount,
    keywordMatches,
    keywordDensity,
    blockingErrors: issues.filter((issue) => issue.type === "error").length,
    issues,
  };
}

function normalizeSeoScoreInput(input: SeoScoreInput): SeoScoreInput {
  const keywordKeys = new Set<string>();
  const seoKeywords = input.seoKeywords.flatMap((keyword) => {
    const trimmed = keyword.trim();
    if (!trimmed) return [];
    const key = normalizeText(trimmed);
    if (keywordKeys.has(key)) return [];
    keywordKeys.add(key);
    return [trimmed];
  });
  const faq = input.faq.flatMap((item) => {
    const question = item.question?.trim() ?? "";
    const answer = item.answer?.trim() ?? "";
    return question || answer ? [{ question, answer }] : [];
  });
  const hasOgImage = Boolean(input.ogImage.trim());

  return {
    ...input,
    image: hasOgImage ? input.ogImage : input.image,
    imageAlt: hasOgImage ? input.ogImageAlt : input.imageAlt,
    seoKeywords,
    faq,
  };
}

function buildSeoScoreMetrics(input: SeoScoreInput, analysis: {
  keywordDensity: number;
  faqCount?: number;
}): SeoScoreMetric[] {
  return [
    {
      id: "keyword-density",
      label: "كثافة الكلمة المفتاحية",
      value: input.focusKeyword.trim()
        ? `${analysis.keywordDensity}%`
        : "غير متاح",
    },
    ...(input.profile === "article"
      ? [{
          id: "faq-count",
          label: "أسئلة FAQ المكتملة",
          value: String(analysis.faqCount ?? 0),
        }]
      : []),
  ];
}

/**
 * The single public SEO Score owner. Every consumer submits the same input
 * contract and receives the same official `score` output. The profile is an
 * entity declaration; consumers never select a calculator or score variant.
 * Canonical overrides and robots directives stay outside the score: the
 * current metadata/persistence owners already validate and resolve them, and
 * an explicit noindex/nofollow can be a correct product decision rather than
 * a quality defect.
 */
export function analyzeEntitySeo(input: SeoScoreInput): SeoScoreOutput {
  const normalizedInput = normalizeSeoScoreInput(input);

  if (normalizedInput.profile === "article") {
    const articleAnalysis = analyzeArticleSeo(normalizedInput);
    const severity = { success: 0, muted: 1, warning: 2, error: 3 } as const;
    const mergedIssues = new Map<string, SeoIssue>();
    const weightedSections = [
      [articleAnalysis.issues.seo, 0.45],
      [articleAnalysis.issues.content, 0.3],
      [articleAnalysis.issues.readiness, 0.25],
    ] as const;

    for (const [sectionIssues, sectionWeight] of weightedSections) {
      for (const issue of sectionIssues) {
        const id = issue.id ?? `issue-${mergedIssues.size + 1}`;
        const weightedPoints = Number((issue.points * sectionWeight).toFixed(2));
        const existing = mergedIssues.get(id);
        if (!existing) {
          mergedIssues.set(id, { ...issue, id, points: weightedPoints });
          continue;
        }

        existing.points = Number((existing.points + weightedPoints).toFixed(2));
        if (severity[issue.type] > severity[existing.type]) {
          existing.type = issue.type;
          existing.label = issue.label;
          existing.hint = issue.hint;
        }
      }
    }

    const issues = [...mergedIssues.values()];
    const score = Math.round(
      issues.reduce((total, issue) => total + issue.points, 0),
    );

    return {
      score,
      label: articleAnalysis.label,
      blockingErrors: issues.filter((issue) => issue.type === "error").length,
      issues,
      metrics: buildSeoScoreMetrics(normalizedInput, articleAnalysis),
    };
  }

  const entityAnalysis = analyzeEntityProfile(normalizedInput);
  return {
    score: entityAnalysis.overallScore,
    label: entityAnalysis.label,
    blockingErrors: entityAnalysis.blockingErrors,
    issues: entityAnalysis.issues,
    metrics: buildSeoScoreMetrics(normalizedInput, entityAnalysis),
  };
}
