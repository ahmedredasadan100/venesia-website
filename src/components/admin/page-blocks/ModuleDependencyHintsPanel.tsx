import { getModuleDependencyHints, getModuleKindMetadata } from "../../../lib/page-composition/slot-module-registry";

type ModuleDependencyHintsPanelProps = {
  moduleKind: string;
  templateSlug?: string | null;
};

export default function ModuleDependencyHintsPanel({
  moduleKind,
  templateSlug,
}: ModuleDependencyHintsPanelProps) {
  const meta = getModuleKindMetadata(moduleKind);
  const hints = getModuleDependencyHints(moduleKind, templateSlug);

  if (!meta && !hints.length) return null;

  return (
    <section className="rounded-[24px] border border-[#D8B87A]/12 bg-[#080B10]/88 p-5">
      <p className="font-en text-[11px] tracking-[0.28em] text-[#D8B87A]/70">MODULE HINTS</p>
      <h3 className="mt-2 text-lg font-semibold text-white">تلميحات الاعتماد والتركيب</h3>
      {meta?.descriptionAr ? <p className="mt-2 text-sm text-white/48">{meta.descriptionAr}</p> : null}

      {hints.length ? (
        <ul className="mt-4 space-y-2 text-sm leading-7 text-white/55">
          {hints.map((hint) => (
            <li key={hint}>• {hint}</li>
          ))}
        </ul>
      ) : null}

      {meta?.previewNoteAr ? (
        <p className="mt-4 rounded-[14px] border border-white/8 bg-black/20 px-3 py-2 text-xs leading-6 text-white/40">
          {meta.previewNoteAr}
        </p>
      ) : null}
    </section>
  );
}
