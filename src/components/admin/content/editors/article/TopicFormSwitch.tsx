export const TOPIC_SETTINGS_SURFACE_CLASS_NAME =
  "rounded-xl border border-white/10 bg-black/16 px-4 py-3";

type TopicFormSwitchProps = {
  name: string;
  label: string;
  defaultChecked: boolean;
  surface?: boolean;
};

export default function TopicFormSwitch({
  name,
  label,
  defaultChecked,
  surface = false,
}: TopicFormSwitchProps) {
  return (
    <label
      className={`flex min-w-0 cursor-pointer items-center gap-2 text-xs text-white/70 lg:whitespace-nowrap ${
        surface ? TOPIC_SETTINGS_SURFACE_CLASS_NAME : "rounded-lg px-1 py-1.5"
      }`}
    >
      <span className="relative inline-flex h-5 w-9 shrink-0">
        <input
          type="checkbox"
          role="switch"
          name={name}
          defaultChecked={defaultChecked}
          className="peer sr-only"
        />
        <span className="absolute inset-0 rounded-full bg-white/10 transition peer-checked:bg-[#C9972F] peer-focus-visible:ring-2 peer-focus-visible:ring-[#E2B84F]" />
        <span className="absolute start-0.5 top-0.5 size-4 rounded-full bg-white/80 shadow transition peer-checked:translate-x-4 peer-checked:bg-white rtl:peer-checked:-translate-x-4" />
      </span>
      <span>{label}</span>
    </label>
  );
}
