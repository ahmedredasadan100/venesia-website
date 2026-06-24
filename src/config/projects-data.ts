/**
 * Seed-only project catalog — NOT a runtime source for public pages.
 * Runtime loaders: lib/projects/load-published-projects.ts
 */
import type {
  Project,
  ResidentialAreaOption,
  ResidentialDetails,
  ResidentialExecutionJourneyStage,
} from "../lib/projects/public-types";

export type {
  Project,
  ProjectCategory,
  ProjectHubFilterId,
  PublicProject,
  ResidentialAreaOption,
  ResidentialDetails,
  ResidentialExecutionJourneyStage,
  ResidentialExecutionUpdate,
  ResidentialGalleryImage,
} from "../lib/projects/public-types";
const defaultResidentialTabs = [
  { id: "district", label: "عن الموقع" },
  { id: "overview", label: "نظرة عامة" },
  { id: "plans", label: "المساحات والمخططات" },
  { id: "delivery-specs", label: "مواصفات التنفيذ" },
  { id: "execution", label: "مراحل التنفيذ" },
  { id: "contact", label: "تواصل معنا" },
];

type ResidentialLocationSeed = {
  code: string;
  slug: string;
  imageFolder?: string;
  englishName: string;
  arabicName: string;
  locationLabel: string;
  mapArea: string;
  shortDescription: string;
  overviewBody: string;
  districtTitle: string;
  districtSubtitle: string;
  districtBody: string;
  districtBullets: string[];
  address: string;
  distance: string;
  investmentValue: string;
  suitableFor: string[];
  strengths: string[];
  featured?: boolean;
  homepageOrder: number;
};

const defaultDeliverySpecsItems = [
  "هيكل خرساني مسلح وتنفيذ هندسي معتمد.",
  "باب رئيسي مصفح لكل وحدة.",
  "تأسيس كامل للكهرباء والسباكة.",
  "محارة كاملة للوحدة.",
  "واجهات حجر هاشمة بتصميم معماري حديث.",
  "مدخل وسلالم من رخام الجلالة.",
  "مصعد كهربائي.",
  "جراج خاص للسكان.",
  "عزل حراري ومائي للدور الأخير.",
  "إنتركم مرئي وبنية تحتية للإنترنت والدش المركزي.",
];

function projectImage(slug: string, fileName: string) {
  return `/images/projects/${slug}/${fileName}`;
}

function createDeliverySpecs(slug: string): ResidentialDetails["deliverySpecs"] {
  return {
    title: "مواصفات التنفيذ والتسليم",
    subtitle:
      "نفس منهج فينيسيا في التنفيذ: تفاصيل واضحة، خامات مختارة، وتسليم يحترم قيمة السكن والاستثمار.",
    items: defaultDeliverySpecsItems,
    images: [
      { image: projectImage(slug, "specs-01.jpg"), label: "مدخل المشروع" },
      { image: projectImage(slug, "specs-02.jpg"), label: "المصعد" },
      { image: projectImage(slug, "specs-03.jpg"), label: "السلالم" },
      { image: projectImage(slug, "specs-04.jpg"), label: "الواجهة" },
      { image: projectImage(slug, "specs-05.jpg"), label: "تفاصيل التسليم" },
    ],
  };
}

function createAvailableAreas(slug: string): ResidentialAreaOption[] {
  return [
    {
      area: "130m² + Garden 90m²",
      label: "أرضي بجاردن",
      planImage: projectImage(slug, "floorplan-01.jpg"),
      specs: ["3 غرف", "3 حمامات", "ريسبشن", "سفرة", "مطبخ"],
    },
    {
      area: "130m² + Garden 90m²",
      label: "أرضي بجاردن",
      planImage: projectImage(slug, "floorplan-02.jpg"),
      specs: ["3 غرف", "3 حمامات", "ريسبشن", "سفرة", "مطبخ"],
      featured: true,
    },
    {
      area: "185m²",
      label: "متكرر",
      planImage: projectImage(slug, "floorplan-03.jpg"),
      specs: ["3 غرف", "3 حمامات", "ريسبشن", "سفرة", "مطبخ"],
    },
  ];
}

function createExecutionJourney(slug: string): ResidentialExecutionJourneyStage[] {
  return [
    {
      id: "excavation",
      title: "أعمال الحفر وتجهيز الموقع",
      progress: 100,
      status: "مكتمل",
      image: projectImage(slug, "progress-01.jpg"),
      summary:
        "تم تجهيز الأرض وتنفيذ أعمال الحفر بدقة تمهيدًا لبداية إنشائية مستقرة طبقًا للمناسيب المعتمدة.",
      lastUpdated: "موثق بالموقع",
      updates: [
        {
          id: "excavation-start",
          title: "بداية أعمال الحفر",
          date: "موثق بالموقع",
          progress: 100,
          image: projectImage(slug, "progress-01.jpg"),
          description:
            "بدأ المشروع من أرض واضحة ومملوكة بالكامل، مع تنفيذ أعمال الحفر وتجهيز الموقع تحت إشراف هندسي.",
          gallery: [projectImage(slug, "progress-01.jpg")],
        },
      ],
    },
    {
      id: "foundations",
      title: "الأساسات والبيزمنت",
      progress: 100,
      status: "مكتمل",
      image: projectImage(slug, "progress-02.jpg"),
      summary:
        "تم تنفيذ أعمال القواعد والبيزمنت ومراجعة التسليح والقطاعات بما يدعم قوة المبنى من أول مرحلة.",
      lastUpdated: "موثق بالموقع",
      updates: [
        {
          id: "basement-works",
          title: "أعمال الأساسات والبيزمنت",
          date: "موثق بالموقع",
          progress: 100,
          image: projectImage(slug, "progress-02.jpg"),
          description:
            "تم تنفيذ أعمال النجارة المسلحة والحدادة والصب وفق مواصفات هندسية دقيقة.",
          gallery: [projectImage(slug, "progress-02.jpg")],
        },
      ],
    },
    {
      id: "concrete-structure",
      title: "الهيكل الخرساني",
      progress: 100,
      status: "مكتمل",
      image: projectImage(slug, "progress-03.jpg"),
      summary:
        "اكتملت مراحل الخرسانات الرئيسية وصولًا إلى الأدوار العلوية، مع توثيق مستمر لكل مرحلة تنفيذ.",
      lastUpdated: "موثق بالموقع",
      updates: [
        {
          id: "concrete-stage",
          title: "مرحلة الهيكل الخرساني",
          date: "موثق بالموقع",
          progress: 100,
          image: projectImage(slug, "progress-03.jpg"),
          description:
            "تم تنفيذ الأعمال الخرسانية تحت إشراف هندسي مباشر وبالتزام كامل بجودة التنفيذ.",
          gallery: [projectImage(slug, "progress-03.jpg")],
        },
      ],
    },
    {
      id: "masonry",
      title: "أعمال المباني",
      progress: 100,
      status: "مكتمل",
      image: projectImage(slug, "progress-04.jpg"),
      summary:
        "تم تنفيذ أعمال المباني بما يعكس انتقال المشروع من الهيكل إلى تفاصيل الإغلاق والتجهيز.",
      lastUpdated: "موثق بالموقع",
      updates: [
        {
          id: "masonry-stage",
          title: "مرحلة أعمال المباني",
          date: "موثق بالموقع",
          progress: 100,
          image: projectImage(slug, "progress-04.jpg"),
          description:
            "تم تنفيذ أعمال المباني مع ضبط الفتحات والاستقامة والربط مع باقي عناصر التصميم.",
          gallery: [projectImage(slug, "progress-04.jpg")],
        },
      ],
    },
    {
      id: "internal-finishing",
      title: "المحارة والكهرباء الداخلية",
      progress: 70,
      status: "جاري التنفيذ",
      image: projectImage(slug, "progress-05.jpg"),
      summary:
        "دخل المشروع مراحل متقدمة من الأعمال الداخلية، من المحارة وتجهيزات الكهرباء إلى تفاصيل تمهيد التسليم.",
      lastUpdated: "موثق بالموقع",
      updates: [
        {
          id: "internal-plaster-electric",
          title: "أعمال المحارة وتجهيزات الكهرباء",
          date: "موثق بالموقع",
          progress: 70,
          image: projectImage(slug, "progress-05.jpg"),
          description:
            "جاري تنفيذ أعمال المحارة الداخلية وتجهيزات الكهرباء للوحدات بخامات معتمدة ومراجعة هندسية مباشرة.",
          gallery: [projectImage(slug, "progress-05.jpg")],
        },
      ],
    },
  ];
}

function createResidentialDetails(seed: ResidentialLocationSeed): ResidentialDetails {
  const slug = seed.imageFolder ?? seed.slug;

  return {
    tabs: defaultResidentialTabs,
    overview: {
      title: "لمحة عن المشروع",
      body: seed.overviewBody,
      bullets: [
        seed.locationLabel,
        seed.investmentValue,
        ...seed.strengths.slice(0, 3),
      ],
      videoImage: projectImage(slug, "hero.jpg"),
      images: [
        {
          image: projectImage(slug, "hero.jpg"),
          label: `واجهة مشروع ${seed.code}`,
        },
      ],
    },
    districtProfile: {
      title: seed.districtTitle,
      subtitle: seed.districtSubtitle,
      body: seed.districtBody,
      bullets: seed.districtBullets,
      image: projectImage(slug, "location-map.jpg"),
    },
    deliverySpecs: createDeliverySpecs(slug),
    contactCta: {
      eyebrow: `مشروع ${seed.code}`,
      title: `تابع تنفيذ ${seed.code} خطوة بخطوة.`,
      body: "مشروع موثق من أرض واضحة إلى مراحل تنفيذ متتابعة، يعكس مبدأ فينيسيا في تحويل الثقة إلى فعل على الأرض.",
      buttonLabel: "تواصل معنا",
      href: "https://wa.me/201000000000",
    },
    quickFacts: [
      { label: "الموقع", value: seed.locationLabel },
      { label: "القيمة الاستثمارية", value: seed.investmentValue },
      { label: "مناسب لـ", value: seed.suitableFor.join(" / ") },
    ],
    availableAreas: createAvailableAreas(slug),
    executionJourney: createExecutionJourney(slug),
    location: {
      title: "الموقع",
      address: seed.address,
      distance: seed.distance,
      mapImage: projectImage(slug, "location-map.jpg"),
      mapButtonLabel: "عرض موقع المشروع",
    },
    cta: {
      title: `تعرف على تفاصيل ${seed.code}`,
      body: "اختيار الموقع لا يبدأ من السعر فقط، بل من وضوح الأرض، وقوة المنطقة، وقدرة المطور على التنفيذ.",
      buttonLabel: "تواصل معنا",
    },
  };
}

const residentialSeeds: ResidentialLocationSeed[] = [
  {
    code: "I87",
    slug: "i87",
    englishName: "VIEW ZONE RESIDENCE",
    arabicName: "بيت الوطن — الحي الأول",
    locationLabel: "بيت الوطن — الحي الأول",
    mapArea: "الحي الأول",
    shortDescription:
      "مشروع سكني داخل منطقة الفيو زون بالحي الأول، يجمع بين الإطلالة المفتوحة وقرب النوادي والمحاور الرئيسية.",
    overviewBody:
      "يقع مشروع I87 داخل منطقة الفيو زون بالحي الأول، إحدى أكثر مناطق بيت الوطن تميزًا بفضل الإطلالات المفتوحة وقربها من النوادي والمحاور الرئيسية. يجمع الموقع بين الهدوء السكني وسهولة الوصول إلى الخدمات والمرافق الحيوية.",
    districtTitle: "عن الحي الأول — بيت الوطن",
    districtSubtitle:
      "موقع داخل View Zone يمنح المشروع قيمة سكنية واستثمارية واضحة.",
    districtBody:
      "الحي الأول في بيت الوطن يتميز بالقرب من طريق السويس وشارع التسعين الشمالي ومحور بن زايد، مع قرب واضح من النوادي والخدمات المركزية والمناطق التجارية. وجود المشروع داخل View Zone يمنحه ميزة إضافية لمن يبحث عن سكن هادئ أو استثمار طويل المدى.",
    districtBullets: [
      "داخل View Zone بالحي الأول.",
      "قريب من طريق السويس وشارع التسعين الشمالي ومحور بن زايد.",
      "قريب من منطقة الخدمات المركزية والمناطق التجارية.",
      "قريب من النادي الأهلي ونادي الشرطة ونادي الجزيرة.",
      "مناسب للسكن العائلي والاستثمار طويل المدى.",
    ],
    address: "القاهرة الجديدة — بيت الوطن — الحي الأول — قطعة I87",
    distance:
      "قريب من طريق السويس وشارع التسعين الشمالي ومحور بن زايد، مع سهولة الوصول إلى النوادي والخدمات اليومية.",
    investmentValue:
      "من أعلى المواقع طلبًا داخل الحي الأول بفضل قربه من الفيو زون والنوادي.",
    suitableFor: ["السكن العائلي", "الاستثمار طويل المدى"],
    strengths: ["داخل View Zone", "قريب من النوادي", "قريب من المحاور الرئيسية"],
    featured: true,
    homepageOrder: 1,
  },
  {
    code: "I76",
    slug: "i76",
    imageFolder: "I76",
    englishName: "VIEW ZONE RESIDENCE",
    arabicName: "بيت الوطن — الحي الأول",
    locationLabel: "بيت الوطن — الحي الأول",
    mapArea: "الحي الأول",
    shortDescription:
      "مشروع سكني داخل منطقة الفيو زون بالحي الأول، يجمع بين الهدوء السكني وسهولة الوصول إلى الخدمات والمرافق الحيوية.",
    overviewBody:
      "يقع مشروع I76 داخل منطقة الفيو زون بالحي الأول، إحدى أكثر مناطق بيت الوطن تميزًا بفضل الإطلالات المفتوحة وقربها من النوادي والمحاور الرئيسية. يجمع الموقع بين الهدوء السكني وسهولة الوصول إلى الخدمات والمرافق الحيوية.",
    districtTitle: "عن الحي الأول — بيت الوطن",
    districtSubtitle:
      "موقع داخل View Zone يمنح المشروع قيمة سكنية واستثمارية واضحة.",
    districtBody:
      "يقع المشروع داخل منطقة الفيو زون بالحي الأول، إحدى أكثر مناطق بيت الوطن تميزًا بفضل الإطلالات المفتوحة وقربها من النوادي والمحاور الرئيسية. يجمع الموقع بين الهدوء السكني وسهولة الوصول إلى الخدمات والمرافق الحيوية.",
    districtBullets: [
      "داخل View Zone بالحي الأول.",
      "قريب من طريق السويس وشارع التسعين الشمالي ومحور بن زايد.",
      "قريب من منطقة الخدمات المركزية والمناطق التجارية والخدمات اليومية.",
      "قريب من النادي الأهلي ونادي الشرطة ونادي الجزيرة.",
      "قريب من مدينتي وHeliopark وPalm Hills وMountain View.",
      "مناسب للسكن العائلي والاستثمار طويل المدى.",
    ],
    address: "القاهرة الجديدة — بيت الوطن — الحي الأول — قطعة I76",
    distance:
      "قريب من طريق السويس وشارع التسعين الشمالي ومحور بن زايد، مع سهولة الوصول إلى النوادي والخدمات اليومية والمناطق المحيطة.",
    investmentValue:
      "من أعلى المواقع طلبًا داخل الحي الأول بفضل قربه من الفيو زون والنوادي.",
    suitableFor: ["السكن العائلي", "الاستثمار طويل المدى"],
    strengths: ["داخل View Zone", "قريب من النوادي", "قريب من المحاور الرئيسية"],
    featured: false,
    homepageOrder: 2,
  },
  {
    code: "B84",
    slug: "b84",
    englishName: "CALM RESIDENCE",
    arabicName: "بيت الوطن — الحي الأول",
    locationLabel: "ddddd",
    mapArea: "اdddل",
    shortDescription:
      "مشروع سكني هادئ داخل الحي الأول، مناسب للسكن المستقر مع سهولة الوصول إلى الخدمات والمحاور.",
    overviewBody:
      "يقع مشروع B84 في موقع سكني هادئ داخل الحي الأول، مع سهولة الوصول إلى الخدمات والمحاور الرئيسية، ما يجعله مناسبًا للراغبين في السكن المستقر داخل بيت الوطن.",
    districtTitle: "عن الحي الأول — بيت الوطن",
    districtSubtitle: "حي هادئ بقيمة مستقرة وسهولة حركة يومية.",
    districtBody:
      "يمنح الحي الأول في بيت الوطن بيئة سكنية هادئة مع قرب من طريق السويس وشارع التسعين والخدمات اليومية. موقع B84 مناسب لمن يبحث عن سكن عملي مستقر وقيمة استثمارية جيدة على المدى الطويل.",
    districtBullets: [
      "موقع سكني هادئ داخل الحي الأول.",
      "قريب من طريق السويس وشارع التسعين.",
      "قريب من خدمات الحي الأول والمناطق التجارية.",
      "قيمة استثمارية جيدة ومستقرة.",
    ],
    address: "القاهرة الجديدة — بيت الوطن — الحي الأول — قطعة B84",
    distance:
      "قريب من طريق السويس وشارع التسعين، مع وصول مباشر إلى خدمات الحي الأول والمناطق التجارية.",
    investmentValue: "قيمة جيدة ومستقرة داخل الحي الأول.",
    suitableFor: ["السكن المستقر", "الاستثمار الهادئ"],
    strengths: ["موقع هادئ", "قرب الخدمات", "سهولة الوصول"],
    featured: false,
    homepageOrder: 3,
  },
  {
    code: "C35",
    slug: "c35",
    englishName: "EAST GATE",
    arabicName: "بيت الوطن — الحي الثاني",
    locationLabel: "بيت الوطن — الحي الثاني",
    mapArea: "الحي الثاني",
    shortDescription:
      "مشروع سكني في قلب الحي الثاني، قريب من الخدمات المركزية والمحاور الرئيسية.",
    overviewBody:
      "يقع مشروع C35 بالقرب من منطقة الخدمات المركزية بالحي الثاني، أحد أكثر أحياء بيت الوطن اكتمالًا من حيث البنية التحتية والخدمات. يجمع الموقع بين سهولة الوصول إلى شارع التسعين الشمالي ومحور بن زايد وبين القرب من المرافق اليومية، ما يجعله مناسبًا للسكن والاستثمار على حد سواء.",
    districtTitle: "عن الحي الثاني — بيت الوطن",
    districtSubtitle: "موقع مكتمل البنية وقريب من قلب الحركة في القاهرة الجديدة.",
    districtBody:
      "الحي الثاني في بيت الوطن يُعد من أكثر الأحياء تميزًا داخل القاهرة الجديدة، لقربه من شارع التسعين الشمالي وطريق السويس، واكتمال البنية التحتية، وارتفاع نسب الإنشاءات القائمة، مما يجعله مناسبًا للسكن والاستثمار طويل المدى.",
    districtBullets: [
      "يقع في قلب الحي الثاني.",
      "قريب من شارع التسعين الشمالي ومحور بن زايد وطريق السويس.",
      "قريب من منطقة الخدمات المركزية والهايبر ماركت والمنطقة التجارية.",
      "قريب من النادي الأهلي ونادي الشرطة.",
      "قيمة استثمارية مرتفعة بفضل اكتمال الحي وقرب الخدمات.",
    ],
    address: "القاهرة الجديدة — بيت الوطن — الحي الثاني — قطعة C35",
    distance:
      "قريب من شارع التسعين الشمالي ومحور بن زايد وطريق السويس، مع قرب مباشر من الخدمات المركزية والهايبر ماركت والمنطقة التجارية.",
    investmentValue: "مرتفعة بفضل اكتمال الحي وقرب الخدمات.",
    suitableFor: ["السكن", "الاستثمار"],
    strengths: ["قلب الحي الثاني", "قرب الخدمات", "سهولة الحركة"],
    featured: true,
    homepageOrder: 4,
  },
  {
    code: "J118",
    slug: "j118",
    englishName: "CENTRAL RESIDENCE",
    arabicName: "بيت الوطن — الحي الثاني",
    locationLabel: "بيت الوطن — الحي الثاني",
    mapArea: "الحي الثاني",
    shortDescription:
      "مشروع قريب من الخدمات الرئيسية والهايبر ماركت داخل الحي الثاني.",
    overviewBody:
      "يقع مشروع J118 بالقرب من الخدمات الرئيسية والهايبر ماركت، ما يوفر سهولة الوصول إلى الاحتياجات اليومية ويعزز من القيمة السكنية والاستثمارية للموقع.",
    districtTitle: "عن الحي الثاني — بيت الوطن",
    districtSubtitle: "قرب مباشر من الخدمات اليومية داخل حي مكتمل الحركة.",
    districtBody:
      "يتميز الحي الثاني بسهولة الوصول إلى شارع التسعين ومحور بن زايد، مع توافر الخدمات المركزية والهايبر ماركت والمنطقة التجارية. موقع J118 مناسب لمن يريد سكنًا عمليًا قريبًا من احتياجاته اليومية.",
    districtBullets: [
      "قريب من شارع التسعين ومحور بن زايد.",
      "قريب من الهايبر ماركت والخدمات المركزية.",
      "قريب من المنطقة التجارية.",
      "قيمة استثمارية مرتفعة.",
    ],
    address: "القاهرة الجديدة — بيت الوطن — الحي الثاني — قطعة J118",
    distance:
      "قريب من شارع التسعين ومحور بن زايد، مع وصول سهل إلى الهايبر ماركت والخدمات المركزية والمنطقة التجارية.",
    investmentValue: "مرتفعة.",
    suitableFor: ["السكن العملي", "الاستثمار"],
    strengths: ["قرب الهايبر ماركت", "قرب الخدمات المركزية", "موقع عملي"],
    featured: false,
    homepageOrder: 5,
  },
  {
    code: "J191",
    slug: "j191",
    englishName: "LINK RESIDENCE",
    arabicName: "بيت الوطن — الحي الثاني",
    locationLabel: "بيت الوطن — الحي الثاني",
    mapArea: "الحي الثاني",
    shortDescription:
      "مشروع يربط بين المناطق السكنية والخدمية داخل الحي الثاني.",
    overviewBody:
      "يقع مشروع J191 في موقع يربط بين المناطق السكنية والخدمية داخل الحي الثاني، ويوفر سهولة الوصول إلى المحاور الرئيسية مع الحفاظ على الطابع السكني الهادئ.",
    districtTitle: "عن الحي الثاني — بيت الوطن",
    districtSubtitle: "توازن بين الهدوء السكني وسهولة الوصول للخدمات.",
    districtBody:
      "يوفر الحي الثاني في بيت الوطن مزيجًا عمليًا بين الحركة اليومية والخدمات القريبة والهدوء السكني. موقع J191 مناسب لمن يبحث عن نقطة متوازنة داخل حي مكتمل ومتصاعد القيمة.",
    districtBullets: [
      "قريب من شارع التسعين ومحور بن زايد.",
      "قريب من الخدمات المركزية والمنطقة التجارية.",
      "يربط بين المناطق السكنية والخدمية.",
      "قيمة استثمارية جيدة جدًا.",
    ],
    address: "القاهرة الجديدة — بيت الوطن — الحي الثاني — قطعة J191",
    distance:
      "قريب من شارع التسعين ومحور بن زايد، مع سهولة الوصول إلى الخدمات المركزية والمنطقة التجارية.",
    investmentValue: "جيدة جدًا.",
    suitableFor: ["السكن", "الاستثمار طويل المدى"],
    strengths: ["موقع متوازن", "قرب الخدمات", "طابع سكني هادئ"],
    featured: false,
    homepageOrder: 6,
  },
  {
    code: "F92",
    slug: "f92",
    englishName: "SKY LINE",
    arabicName: "بيت الوطن — الحي الرابع",
    locationLabel: "بيت الوطن — الحي الرابع",
    mapArea: "الحي الرابع",
    shortDescription:
      "مشروع قريب من منطقة النوادي بالحي الرابع، مناسب للسكن والاستثمار.",
    overviewBody:
      "يقع مشروع F92 بالقرب من منطقة النوادي بالحي الرابع، وعلى مسافة قصيرة من النادي الأهلي ونادي الشرطة، ما يجعله من أكثر المواقع طلبًا داخل بيت الوطن للسكن والاستثمار.",
    districtTitle: "عن الحي الرابع — بيت الوطن",
    districtSubtitle: "حي راقٍ يجمع بين الهدوء السكني والقيمة الاستثمارية.",
    districtBody:
      "الحي الرابع في بيت الوطن يتميز بموقع حيوي داخل القاهرة الجديدة، وقربه من شارع النوادي والفيو زون والمحاور الرئيسية، مع شوارع واسعة وكثافة سكانية منخفضة، ليقدم بيئة مناسبة للسكن الهادئ والاستثمار المستقبلي.",
    districtBullets: [
      "قريب من محور بن زايد وطريق السويس وشارع التسعين.",
      "قريب من الخدمات المركزية والمنطقة التجارية.",
      "قريب من النادي الأهلي ونادي الشرطة.",
      "من أعلى المواقع استثماريًا داخل الحي الرابع.",
      "موقع مناسب للسكن والاستثمار بفضل قربه من منطقة النوادي.",
    ],
    address: "القاهرة الجديدة — بيت الوطن — الحي الرابع — قطعة F92",
    distance:
      "قريب من محور بن زايد وطريق السويس وشارع التسعين، مع قرب من الخدمات المركزية والمنطقة التجارية والنادي الأهلي ونادي الشرطة.",
    investmentValue: "من أعلى المواقع استثماريًا داخل الحي الرابع.",
    suitableFor: ["السكن", "الاستثمار"],
    strengths: ["منطقة النوادي", "قرب الخدمات", "سهولة الوصول"],
    featured: true,
    homepageOrder: 7,
  },
  {
    code: "F222",
    slug: "f222",
    englishName: "CLUB SIDE RESIDENCE",
    arabicName: "بيت الوطن — الحي الرابع",
    locationLabel: "بيت الوطن — الحي الرابع",
    mapArea: "الحي الرابع",
    shortDescription:
      "مشروع يربط بين منطقة النوادي والخدمات التجارية داخل الحي الرابع.",
    overviewBody:
      "يقع مشروع F222 في موقع مميز يربط بين منطقة النوادي والخدمات التجارية، ويوفر توازنًا مثاليًا بين الحياة السكنية والاحتياجات اليومية.",
    districtTitle: "عن الحي الرابع — بيت الوطن",
    districtSubtitle: "موقع قريب من النوادي والخدمات اليومية.",
    districtBody:
      "يجمع الحي الرابع بين القرب من النوادي والمحاور والخدمات التجارية، ما يمنح F222 قيمة سكنية واستثمارية واضحة. الموقع مناسب لمن يبحث عن حياة يومية سهلة داخل بيئة سكنية راقية.",
    districtBullets: [
      "قريب من المنطقة التجارية والخدمات المركزية.",
      "قريب من النادي الأهلي ونادي الشرطة.",
      "يربط بين منطقة النوادي والخدمات التجارية.",
      "قيمة استثمارية مرتفعة.",
    ],
    address: "القاهرة الجديدة — بيت الوطن — الحي الرابع — قطعة F222",
    distance:
      "قريب من المنطقة التجارية والخدمات المركزية، مع قرب واضح من النادي الأهلي ونادي الشرطة.",
    investmentValue: "مرتفعة.",
    suitableFor: ["السكن الراقي", "الاستثمار"],
    strengths: ["قريب من النوادي", "قريب من التجاري", "توازن بين السكن والخدمات"],
    featured: false,
    homepageOrder: 8,
  },
  {
    code: "D174",
    slug: "d174",
    englishName: "NORTH HOUSE",
    arabicName: "بيت الوطن — النورث هاوس",
    locationLabel: "بيت الوطن — النورث هاوس",
    mapArea: "النورث هاوس",
    shortDescription:
      "مشروع سكني محدود الوحدات في النورث هاوس، يجمع بين الخصوصية وقرب المحاور والخدمات الرئيسية.",
    overviewBody:
      "يقع مشروع D174 بمنطقة النورث هاوس في بيت الوطن بالقاهرة الجديدة، بالقرب من طريق السويس وشارع التسعين الشمالي وشارع النوادي، مع سهولة الوصول إلى مدينتي والشروق والرحاب. يتميز المشروع بموقع هادئ منخفض الكثافة السكانية مع قربه من الخدمات والمناطق التجارية والترفيهية، مما يجمع بين الخصوصية وسهولة الحركة اليومية.",
    districtTitle: "عن النورث هاوس — بيت الوطن",
    districtSubtitle: "منطقة هادئة منخفضة الكثافة وقريبة من محاور الحركة الرئيسية.",
    districtBody:
      "النورث هاوس واحدة من المناطق السكنية المميزة في بيت الوطن، تجمع بين الهدوء والخصوصية وسهولة الوصول إلى طريق السويس وشارع التسعين الشمالي وشارع النوادي، مع قرب واضح من الرحاب ومدينتي والشروق.",
    districtBullets: [
      "قرب مباشر من طريق السويس ومحاور القاهرة الجديدة.",
      "سهولة الوصول إلى شارع التسعين الشمالي وشارع النوادي.",
      "قريبة من الرحاب ومدينتي والشروق.",
      "كثافة سكانية أقل وخصوصية أعلى للحياة اليومية.",
      "موقع مناسب للعائلات الباحثة عن الهدوء والقيمة المستقبلية.",
    ],
    address: "القاهرة الجديدة — بيت الوطن — النورث هاوس — قطعة D174",
    distance:
      "قريب من طريق السويس وشارع التسعين الشمالي وشارع النوادي، مع سهولة الوصول إلى مدينتي والشروق والرحاب.",
    investmentValue: "قيمة قوية بفضل الهدوء وقرب المحاور والخدمات.",
    suitableFor: ["السكن العائلي", "الاستثمار طويل المدى"],
    strengths: ["موقع مميز داخل النورث هاوس", "قرب المحاور", "خصوصية أعلى"],
    featured: true,
    homepageOrder: 9,
  },
  {
    code: "B137",
    slug: "b137",
    englishName: "NORTH COMMERCIAL SIDE",
    arabicName: "بيت الوطن — النورث هاوس",
    locationLabel: "بيت الوطن — النورث هاوس",
    mapArea: "النورث هاوس",
    shortDescription:
      "مشروع قريب من الشريط التجاري والخدمات الرئيسية بمنطقة النورث هاوس.",
    overviewBody:
      "يقع مشروع B137 بالقرب من الشريط التجاري والخدمات الرئيسية بمنطقة النورث هاوس، ما يمنحه ميزة الجمع بين الراحة السكنية وسهولة الوصول إلى الاحتياجات اليومية.",
    districtTitle: "عن النورث هاوس — بيت الوطن",
    districtSubtitle: "قرب من التجاري والخدمات داخل منطقة هادئة منخفضة الكثافة.",
    districtBody:
      "النورث هاوس منطقة سكنية هادئة داخل بيت الوطن، ويمنح قرب B137 من التجاري والإداري والخدمات الرئيسية ميزة يومية مهمة للسكان وقيمة استثمارية جيدة جدًا.",
    districtBullets: [
      "قريب من التجاري والإداري والخدمات الرئيسية.",
      "يجمع بين الراحة السكنية وسهولة الوصول للاحتياجات اليومية.",
      "قيمة استثمارية جيدة جدًا.",
      "موقع مناسب لمن يريد الهدوء بدون الابتعاد عن الخدمات.",
    ],
    address: "القاهرة الجديدة — بيت الوطن — النورث هاوس — قطعة B137",
    distance:
      "قريب من التجاري والإداري والخدمات الرئيسية بمنطقة النورث هاوس.",
    investmentValue: "جيدة جدًا.",
    suitableFor: ["السكن", "الاستثمار"],
    strengths: ["قريب من الخدمات", "قريب من التجاري", "سهولة الحياة اليومية"],
    featured: false,
    homepageOrder: 10,
  },
  {
    code: "B138",
    slug: "b138",
    englishName: "NORTH ACTIVE RESIDENCE",
    arabicName: "بيت الوطن — النورث هاوس",
    locationLabel: "بيت الوطن — النورث هاوس",
    mapArea: "النورث هاوس",
    shortDescription:
      "مشروع في منطقة حيوية داخل النورث هاوس بالقرب من الخدمات والتجاري.",
    overviewBody:
      "يقع مشروع B138 في واحدة من أكثر المناطق حيوية داخل النورث هاوس، بالقرب من الخدمات والتجاري، مع موقع يحقق توازنًا بين السكن المريح والقيمة الاستثمارية المستقبلية.",
    districtTitle: "عن النورث هاوس — بيت الوطن",
    districtSubtitle: "موقع حيوي داخل منطقة سكنية هادئة ومتنامية القيمة.",
    districtBody:
      "يجمع B138 بين الحيوية وقرب الخدمات داخل النورث هاوس، حيث يقترب من التجاري والإداري والخدمات المركزية، مع الحفاظ على طابع سكني مريح وقيمة مستقبلية مرتفعة.",
    districtBullets: [
      "قريب من التجاري والإداري والخدمات المركزية.",
      "موقع حيوي داخل النورث هاوس.",
      "توازن بين السكن المريح والقيمة الاستثمارية.",
      "سهولة حركة يومية بفضل قرب الخدمات.",
    ],
    address: "القاهرة الجديدة — بيت الوطن — النورث هاوس — قطعة B138",
    distance:
      "قريب من التجاري والإداري والخدمات المركزية داخل منطقة النورث هاوس.",
    investmentValue: "مرتفعة.",
    suitableFor: ["السكن المريح", "الاستثمار المستقبلي"],
    strengths: ["حيوية الموقع", "قرب الخدمات", "سهولة الحركة"],
    featured: false,
    homepageOrder: 11,
  },
];

function createResidentialProject(seed: ResidentialLocationSeed): Project {
  const imageSlug = seed.imageFolder ?? seed.slug;

  return {
    id: seed.slug,
    slug: seed.slug,
    code: seed.code,
    englishName: seed.englishName,
    arabicName: seed.arabicName,
    category: "residential",
    image: projectImage(imageSlug, "cover.jpg"),
    heroImage: projectImage(imageSlug, "hero.jpg"),
    locationLabel: seed.locationLabel,
    shortDescription: seed.shortDescription,
    featured: seed.featured ?? false,
    mapArea: seed.mapArea,
    showOnHomepage: true,
    homepageOrder: seed.homepageOrder,
    brochureUrl: "",
    residentialDetails: createResidentialDetails(seed),
  };
}

/** @deprecated Seed import only — public pages use loadPublishedProjects(). */
export const PROJECTS: Project[] = [
  ...residentialSeeds.map(createResidentialProject),
  {
    id: "vnc",
    slug: "venesia-new-cairo-mall",
    code: "VNC",
    englishName: "Venesia New Cairo Mall",
    arabicName: "فينيسيا نيو كايرو مول",
    category: "commercial",
    image: "/images/6666.png",
    heroImage: "/images/6666.png",
    locationLabel: "القاهرة الجديدة — الحي الثاني",
    shortDescription:
      "وجهة تجارية واستثمارية تقترب من التشغيل بعد رحلة تنفيذ موثقة.",
    featured: true,
    mapArea: "القاهرة الجديدة",
    showOnHomepage: true,
    homepageOrder: 12,
  },
  {
    id: "rm",
    slug: "riyad-mall",
    code: "RM",
    englishName: "Riyad Mall",
    arabicName: "الرياض مول",
    category: "commercial",
    image: "/images/cta-building-night.png",
    heroImage: "/images/cta-building-night.png",
    locationLabel: "القاهرة الجديدة — بيت الوطن",
    shortDescription: "مشروع تجاري قائم على موقع حيوي ومسار تنفيذ واضح.",
    featured: false,
    mapArea: "بيت الوطن",
    showOnHomepage: true,
    homepageOrder: 13,
  },
];

