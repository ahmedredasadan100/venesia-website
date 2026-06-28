function AndroidIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-[#D8B87A]">
      <path
        fill="currentColor"
        d="M17.6 9.5 18.8 7l.2-.4a.6.6 0 0 0-.2-.8.6.6 0 0 0-.8.2l-.2.4-1.1 2.1a7.2 7.2 0 0 0-4.7-1.7 7.2 7.2 0 0 0-4.7 1.7L6.2 6.4a.6.6 0 0 0-.8-.2.6.6 0 0 0-.2.8l.2.4 1.2 2.5A6.4 6.4 0 0 0 4 14.8v1.2a1.6 1.6 0 0 0 1.6 1.6h.8v3.2a1.6 1.6 0 0 0 3.2 0v-3.2h4.8v3.2a1.6 1.6 0 0 0 3.2 0v-3.2h.8A1.6 1.6 0 0 0 20 16V14.8a6.4 6.4 0 0 0-2.4-5.3ZM9.2 13.2a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Zm5.6 0a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Z"
      />
    </svg>
  );
}

function IPhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-[#D8B87A]">
      <path
        fill="currentColor"
        d="M16.8 2H7.2A2.2 2.2 0 0 0 5 4.2v15.6A2.2 2.2 0 0 0 7.2 22h9.6a2.2 2.2 0 0 0 2.2-2.2V4.2A2.2 2.2 0 0 0 16.8 2ZM12 19.1a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2Zm4.8-14H7.2V16h9.6V5.1Z"
      />
    </svg>
  );
}

export default function MaintenanceInstallTeaser() {
  return (
    <div className="rounded-[28px] border border-white/8 bg-[#05070B]/55 px-5 py-5 backdrop-blur-sm">
      <p className="text-sm font-medium leading-7 text-white/80">تجربة فينيسيا الجديدة ستكون أقرب إليك.</p>
      <p className="mt-1 text-xs leading-6 text-white/45">ثبّت Venesia على شاشة موبايلك عند الإطلاق.</p>

      <div className="mt-5 flex items-center justify-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D8B87A]/20 bg-[#D8B87A]/8">
            <AndroidIcon />
          </div>
          <span className="text-[11px] text-white/45">Android</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D8B87A]/20 bg-[#D8B87A]/8">
            <IPhoneIcon />
          </div>
          <span className="text-[11px] text-white/45">iPhone</span>
        </div>
      </div>
    </div>
  );
}
