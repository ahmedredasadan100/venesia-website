export const SEO_SITE = {
  name: "Venesia Developments",
  arabicName: "فينيسيا للتطوير العقاري",
  legalName: "Venesia Developments",
  tagline: "الثقة مش وعد… الثقة فعل.",
  defaultLocale: "ar_EG",
  language: "ar",
  direction: "rtl",
  country: "EG",
  city: "New Cairo",
  defaultUrl:
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://www.venesia-developments.net",
  defaultImage: "/images/venesia-5.png",
  logo: "/logo.png",
  themeColor: "#0B0B0B",
  twitterHandle: "",
  contact: {
    phone: "15875",
    areaServed: "Egypt",
  },
} as const;