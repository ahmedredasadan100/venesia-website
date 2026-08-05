import type { IntegrationKey } from "../../../lib/admin/integrations/integrations-contract";

const ICON_PATHS = {
  google_analytics:
    "M22.84 2.998v17.999c.009 1.647-1.32 2.99-2.967 2.998a2.98 2.98 0 0 1-.368-.021c-1.528-.226-2.648-1.556-2.61-3.1V3.12C16.858 1.575 17.98.244 19.51.02a3 3 0 0 1 3.33 2.978ZM4.133 18.055a2.973 2.973 0 1 0 0 5.945 2.973 2.973 0 0 0 0-5.945Zm7.872-9.01h-.051c-1.65.09-2.93 1.474-2.891 3.126v7.984c0 2.167.953 3.483 2.35 3.763a2.973 2.973 0 0 0 3.57-2.927v-8.958a2.973 2.973 0 0 0-2.977-2.988Z",
  google_search_console:
    "M8.548 1.156 6.832 2.872v1.682h1.716Zm0 3.398v.035H6.832v-.035H3.386L0 7.844v3.577h2.826V8.94c0-.525.429-.954.954-.954h16.476c.525 0 .954.43.954.954v2.48h2.754V7.844l-3.386-3.29H17.3v.035h-1.717v-.035Zm7.035 0H17.3V2.872l-1.717-1.716ZM8.679 1.188V2.84h6.773V1.188Zm11.471 7.07a.834.834 0 0 0-.132.01l-.543.002c-5.216.014-10.432-.008-15.648.01-.435-.063-.794.436-.716.883v2.264h17.812c-.016-.888.045-1.782-.034-2.666-.104-.342-.427-.502-.739-.502ZM.036 11.645v9.156c0 1.05.858 1.908 1.907 1.908h.883V11.645Zm21.174 0v11.064h.882c1.05 0 1.908-.858 1.908-1.908v-9.156ZM4.057 13.133v6.85h6.137v-6.85Zm13.243.021v3.777l-1.708.977-1.708-.977v-3.758a4.006 4.006 0 0 0 0 7.23v2.441h3.457v-2.442a4.006 4.006 0 0 0-.041-7.248Zm-13.243 8.26v1.43h7.925v-1.43Z",
  meta_business:
    "M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973.32 1.39 1.412 3.548 4.229 3.548 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.942-1.664 2.335 3.895c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 2.628 0 4.126-1.83 4.126-5.84 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056C9.187 4.367 8.054 4.03 6.915 4.03Zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.9 44.9 0 0 0-1.255-1.98c1.26-1.95 2.3-2.93 3.568-2.93Zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.745-1.126 1.633-1.818 2.621-1.818Z",
  tiktok_ads:
    "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.2-2.48.76-4.89 2.58-6.45 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37a3.25 3.25 0 0 0-1.36 1.75c-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07Z",
  snapchat_ads:
    "M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.033.57c.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.415-.22 1.178-.12 1.433.28.57.89-.39 1.389-.939 1.708-.54.314-1.407.42-1.677.92-.12.225-.061.524.12.868.06.136 1.526 3.475 4.791 4.014.69.12.48.824.375 1.033-.24.569-1.273.988-3.146 1.271-.165.15-.224.824-.298 1.123-.076.271-.27.405-.555.405-.345 0-.974-.224-1.811-.224-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288h-.329c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.599.12-1.048.12-1.123-.346-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.21-.51.045-.929.365-1.12 3.264-.54 4.73-3.879 4.791-4.02.18-.36.224-.66.119-.884-.195-.434-.884-.658-1.332-.809-1.138-.36-1.707-.778-1.543-1.392.135-.51.719-.793 1.213-.793.405 0 .868.375 1.487.375.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.479-.015Z",
  whatsapp_business:
    "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-2.825-1.415-4.03-3.744-4.161-4.114-.173-.297-.018-.458.13-.606.432-.428.644-.739.744-1.017.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.99 0-1.832 1.155-1.832 2.851 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487 2.981 1.288 3.587.87 4.565.728.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347Zm-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 5.46 0 9.88 4.442 9.881 9.892-.003 5.45-4.437 9.884-9.885 9.884ZM20.464 3.488A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448c6.56 0 11.895-5.335 11.898-11.893a11.821 11.821 0 0 0-3.48-8.413Z",
} as const;

function StandardPathIcon({ path, color }: { path: string; color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-8" aria-hidden="true">
      <path d={path} fill={color} />
    </svg>
  );
}

function GoogleAdsIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-9" aria-hidden="true">
      <path d="M27 7 42 33" stroke="#4285F4" strokeWidth="8" strokeLinecap="round" />
      <path d="M27 7 11 35" stroke="#FBBC04" strokeWidth="8" strokeLinecap="round" />
      <circle cx="10" cy="36" r="6" fill="#34A853" />
    </svg>
  );
}

function ClarityIcon() {
  return (
    <svg viewBox="0 0 256 256" className="size-9" aria-hidden="true">
      <defs>
        <linearGradient id="clarity-top" x1=".2" y1="0" x2=".82" y2="1">
          <stop offset="0" stopColor="#a9dcff" />
          <stop offset="1" stopColor="#52b5ea" />
        </linearGradient>
        <linearGradient id="clarity-bottom" x1=".1" y1=".2" x2=".9" y2="1">
          <stop offset="0" stopColor="#0d4fbd" />
          <stop offset="1" stopColor="#286fce" />
        </linearGradient>
        <clipPath id="clarity-shape">
          <path d="M114 23c6-10 22-10 28 0l112 194c6 11-2 24-14 24H16c-12 0-20-13-14-24Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#clarity-shape)">
        <path d="M-5 248 118 18l78 112Z" fill="url(#clarity-top)" />
        <path d="m42 143 155-42 64 140Z" fill="#2f7fd3" />
        <path d="m-4 245 46-102 219 101Z" fill="url(#clarity-bottom)" />
      </g>
    </svg>
  );
}

function TiktokIcon() {
  const path = ICON_PATHS.tiktok_ads;
  return (
    <svg viewBox="0 0 24 24" className="size-8" aria-hidden="true">
      <path d={path} fill="#25F4EE" transform="translate(-.45 .2)" />
      <path d={path} fill="#FE2C55" transform="translate(.45 .25)" />
      <path d={path} fill="white" />
    </svg>
  );
}

function VenesiaCrmIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-9 text-[#E4C683]" fill="none" aria-hidden="true">
      <path d="M11 11c0-4 26-4 26 0v8c0 4-26 4-26 0v-8Z" stroke="currentColor" strokeWidth="2.4" />
      <path d="M11 19v9c0 4 26 4 26 0v-9M11 28v9c0 4 26 4 26 0v-9" stroke="currentColor" strokeWidth="2.4" />
      <path d="M18 14h12M18 23h12M18 32h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".75" />
      <circle cx="32.5" cy="34.5" r="5.5" fill="#D8B87A" fillOpacity=".16" stroke="currentColor" strokeWidth="2" />
      <path d="M30.5 34.5h4M32.5 32.5v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function IntegrationBrandIcon({ integration }: { integration: IntegrationKey }) {
  const shell = "grid size-14 shrink-0 place-items-center rounded-[18px] border shadow-[0_16px_45px_rgba(0,0,0,.24)]";
  if (integration === "google_ads") {
    return <span className={`${shell} border-white/12 bg-white`}> <GoogleAdsIcon /> </span>;
  }
  if (integration === "microsoft_clarity") {
    return <span className={`${shell} border-blue-300/20 bg-[#07162f]`}> <ClarityIcon /> </span>;
  }
  if (integration === "tiktok_ads") {
    return <span className={`${shell} border-white/12 bg-[#050505]`}> <TiktokIcon /> </span>;
  }
  if (integration === "snapchat_ads") {
    return <span className={`${shell} border-yellow-200/30 bg-[#FFFC00]`}> <StandardPathIcon path={ICON_PATHS.snapchat_ads} color="#111111" /> </span>;
  }
  if (integration === "whatsapp_business") {
    return <span className={`${shell} border-emerald-300/20 bg-[#092b1b]`}> <StandardPathIcon path={ICON_PATHS.whatsapp_business} color="#25D366" /> </span>;
  }
  if (integration === "meta_business") {
    return <span className={`${shell} border-blue-300/20 bg-[#071c3e]`}> <StandardPathIcon path={ICON_PATHS.meta_business} color="#4385F5" /> </span>;
  }
  if (integration === "venesia_crm") {
    return <span className={`${shell} border-[#D8B87A]/25 bg-[#D8B87A]/[0.07]`}> <VenesiaCrmIcon /> </span>;
  }
  if (integration === "google_search_console") {
    return <span className={`${shell} border-blue-300/20 bg-[#071c3e]`}> <StandardPathIcon path={ICON_PATHS.google_search_console} color="#458CF5" /> </span>;
  }
  return <span className={`${shell} border-orange-300/20 bg-[#30170a]`}> <StandardPathIcon path={ICON_PATHS.google_analytics} color="#F9AB00" /> </span>;
}
