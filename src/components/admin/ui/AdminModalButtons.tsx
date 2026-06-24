import type { ButtonHTMLAttributes, ReactNode } from "react";

type ModalButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function AdminModalCancelButton({ children, className = "", ...props }: ModalButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 cursor-pointer items-center rounded-2xl border border-white/10 px-5 text-sm text-white/58 transition hover:border-white/18 hover:bg-white/[0.045] hover:text-white ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function AdminModalPrimaryButton({ children, className = "", ...props }: ModalButtonProps) {
  return (
    <button
      className={`inline-flex min-h-11 cursor-pointer items-center rounded-2xl bg-[#D8B87A] px-5 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d] ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function AdminModalDangerButton({ children, className = "", ...props }: ModalButtonProps) {
  return (
    <button
      className={`inline-flex min-h-11 cursor-pointer items-center rounded-2xl bg-[#C9333E] px-5 text-sm font-semibold text-white transition hover:bg-[#E23B46] ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
