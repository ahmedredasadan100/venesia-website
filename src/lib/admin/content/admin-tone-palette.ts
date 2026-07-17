export const ADMIN_TONE_TOKENS = [
  "gold",
  "sky",
  "blue",
  "cyan",
  "emerald",
  "amber",
  "orange",
  "rose",
  "violet",
  "slate",
] as const;

export type AdminToneToken = (typeof ADMIN_TONE_TOKENS)[number];

export const ADMIN_TONE_PALETTE: ReadonlyArray<{
  token: AdminToneToken;
  label: string;
  className: string;
  swatchClassName: string;
}> = [
  { token: "gold", label: "ذهبي", className: "border-[#D8B87A]/35 bg-[#D8B87A]/12 text-[#F4D99A]", swatchClassName: "bg-[#D8B87A]" },
  { token: "sky", label: "سماوي", className: "border-sky-300/30 bg-sky-500/12 text-sky-100", swatchClassName: "bg-sky-400" },
  { token: "blue", label: "أزرق", className: "border-blue-300/30 bg-blue-500/12 text-blue-100", swatchClassName: "bg-blue-400" },
  { token: "cyan", label: "فيروزي", className: "border-cyan-300/30 bg-cyan-500/12 text-cyan-100", swatchClassName: "bg-cyan-400" },
  { token: "emerald", label: "زمردي", className: "border-emerald-300/30 bg-emerald-500/12 text-emerald-100", swatchClassName: "bg-emerald-400" },
  { token: "amber", label: "كهرماني", className: "border-amber-300/30 bg-amber-500/12 text-amber-100", swatchClassName: "bg-amber-400" },
  { token: "orange", label: "برتقالي", className: "border-orange-300/30 bg-orange-500/12 text-orange-100", swatchClassName: "bg-orange-400" },
  { token: "rose", label: "وردي", className: "border-rose-300/30 bg-rose-500/12 text-rose-100", swatchClassName: "bg-rose-400" },
  { token: "violet", label: "بنفسجي", className: "border-violet-300/30 bg-violet-500/12 text-violet-100", swatchClassName: "bg-violet-400" },
  { token: "slate", label: "رمادي", className: "border-slate-300/25 bg-slate-500/12 text-slate-100", swatchClassName: "bg-slate-400" },
];

const PALETTE_BY_TOKEN = new Map(ADMIN_TONE_PALETTE.map((tone) => [tone.token, tone]));

export function isAdminToneToken(value: unknown): value is AdminToneToken {
  return typeof value === "string" && PALETTE_BY_TOKEN.has(value as AdminToneToken);
}

export function resolveAdminTone(value?: string | null) {
  return PALETTE_BY_TOKEN.get(isAdminToneToken(value) ? value : "slate") ?? ADMIN_TONE_PALETTE[9];
}

export function getDeterministicAdminTone(seed: string | number) {
  const source = String(seed);
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return ADMIN_TONE_TOKENS[hash % ADMIN_TONE_TOKENS.length];
}
