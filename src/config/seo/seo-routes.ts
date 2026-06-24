import type { SeoRouteConfig } from "./seo-types";

export const SEO_ROUTES: SeoRouteConfig[] = [
  {
    path: "/",
    title: "فينيسيا للتطوير العقاري | الثقة مش وعد… الثقة فعل",
    description:
      "فينيسيا للتطوير العقاري توثق مشروعاتها على أرض الواقع، من مراحل التنفيذ إلى التسليم، برؤية هندسية واضحة وثقة تُبنى بالفعل.",
    kind: "home",
    priority: 1,
    changeFrequency: "weekly",
    openGraph: {
      type: "website",
      image: "/images/venesia-5.png",
    },
  },
  {
    path: "/about",
    title: "من نحن | فينيسيا للتطوير العقاري",
    description:
      "تعرف على فينيسيا للتطوير العقاري، رؤيتها، منهجها في التنفيذ، وفلسفتها القائمة على وضوح الملكية، جودة البناء، وتوثيق كل خطوة.",
    kind: "static",
    priority: 0.9,
    changeFrequency: "monthly",
    openGraph: {
      type: "website",
      image: "/images/about/about-hero.png",
    },
  },
  {
    path: "/contact",
    title: "تواصل معنا | فينيسيا للتطوير العقاري",
    description:
      "تواصل مع فريق فينيسيا للتطوير العقاري لمعرفة تفاصيل المشروعات السكنية والتجارية ومتابعة أحدث مراحل التنفيذ.",
    kind: "static",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/projects",
    title: "المشروعات | فينيسيا للتطوير العقاري",
    description:
      "استكشف مشروعات فينيسيا السكنية والتجارية في القاهرة الجديدة وبيت الوطن، مع توثيق مراحل التنفيذ خطوة بخطوة.",
    kind: "project-listing",
    priority: 0.95,
    changeFrequency: "weekly",
    openGraph: {
      type: "website",
      image: "/images/venesia-3.png",
    },
  },
  {
    path: "/media-center",
    title: "المركز الإعلامي | فينيسيا للتطوير العقاري",
    description:
      "أخبار فينيسيا، تحديثات الموقع، الجولات المرئية، والمواد الإعلامية التي توثق ما يحدث داخل المشروعات على أرض الواقع.",
    kind: "media-listing",
    priority: 0.85,
    changeFrequency: "daily",
  },
  {
    path: "/media-center/news",
    title: "الأخبار | المركز الإعلامي | فينيسيا للتطوير العقاري",
    description:
      "آخر أخبار فينيسيا للتطوير العقاري وتحديثات المشروعات، موثقة من أرض التنفيذ بلغة واضحة وواقعية.",
    kind: "media-listing",
    priority: 0.8,
    changeFrequency: "daily",
  },
  {
    path: "/media-center/site-updates",
    title: "تحديثات الموقع | فينيسيا للتطوير العقاري",
    description:
      "توثيق مستمر لمراحل التنفيذ في مشروعات فينيسيا، من الحفر والخرسانة إلى التشطيبات والاستعداد للتسليم.",
    kind: "media-listing",
    priority: 0.8,
    changeFrequency: "daily",
  },
  {
    path: "/media-center/videos",
    title: "الفيديوهات | فينيسيا للتطوير العقاري",
    description:
      "جولات مرئية ولقطات من مواقع التنفيذ توضح تقدم الأعمال داخل مشروعات فينيسيا للتطوير العقاري.",
    kind: "media-listing",
    priority: 0.75,
    changeFrequency: "weekly",
  },
  {
    path: "/media-center/gallery",
    title: "معرض الصور | فينيسيا للتطوير العقاري",
    description:
      "صور واقعية من مواقع ومشروعات فينيسيا للتطوير العقاري، توثق مراحل البناء والتفاصيل التنفيذية.",
    kind: "media-listing",
    priority: 0.75,
    changeFrequency: "weekly",
  },
  {
    path: "/media-center/press",
    title: "الصحافة | فينيسيا للتطوير العقاري",
    description:
      "المواد الصحفية والإعلانات الرسمية الخاصة بفينيسيا للتطوير العقاري ومشروعاتها.",
    kind: "media-listing",
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    path: "/topics",
    title: "الموضوعات العقارية | فينيسيا للتطوير العقاري",
    description:
      "موضوعات توعوية تساعدك على فهم السوق العقاري، قراءة العقود، تقييم المطور، واختيار الاستثمار بوعي.",
    kind: "topic-listing",
    priority: 0.85,
    changeFrequency: "weekly",
  },

  {
    path: "/track-your-project",
    title: "تابع مشروعك | فينيسيا للتطوير العقاري",
    description:
      "تابع تطورات مشروعك مع فينيسيا للتطوير العقاري من خلال تحديثات موثقة تعكس تقدم التنفيذ على أرض الواقع.",
    kind: "static",
    priority: 0.8,
    changeFrequency: "weekly",
  },
];