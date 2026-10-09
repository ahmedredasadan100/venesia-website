/** Technical rendering defaults only. Managed identity comes from seo.global. */
export const SEO_SITE = {
  name: "الموقع",
  arabicName: "",
  legalName: "",
  tagline: "",
  defaultLocale: "ar_EG",
  language: "ar",
  direction: "rtl",
  country: "",
  city: "",
  // Valid loopback safety base only. Deployment origins resolve through the validated environment owner.
  defaultUrl: "http://localhost:3000",
  defaultImage: "",
  logo: "/logo.png",
  themeColor: "#0B0B0B",
  twitterHandle: "",
  contact: {
    phone: "",
    areaServed: "",
  },
} as const;