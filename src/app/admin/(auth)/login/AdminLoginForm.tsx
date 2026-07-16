"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

import { resolveSafeInternalPath } from "../../../../lib/security/safe-internal-path";

export default function AdminLoginForm() {
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const trimmedUsername = username.trim();
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username: trimmedUsername, password, rememberMe }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        if (response.status === 401) {
          setError("بيانات الدخول غير صحيحة.");
          return;
        }
        if (response.status === 503) {
          setError(payload.error ?? "نظام الدخول غير مهيأ على السيرفر.");
          return;
        }
        setError(payload.error ?? "تعذر تسجيل الدخول.");
        return;
      }

      const safePath = resolveSafeInternalPath(searchParams.get("next"), "/admin");
      const destination = safePath.startsWith("/admin") ? safePath : "/admin";
      window.location.assign(destination);
    } catch {
      setError("تعذر الاتصال بالخادم.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-md space-y-4" dir="rtl">
      <label className="block space-y-2 text-sm text-white/55">
        <span>اسم المستخدم</span>
        <input
          name="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          required
          className="w-full rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-white outline-none focus:border-[#D8B87A]/45"
        />
      </label>

      <label className="block space-y-2 text-sm text-white/55">
        <span>كلمة المرور</span>
        <input
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          className="w-full rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-white outline-none focus:border-[#D8B87A]/45"
        />
      </label>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-white/55">
        <input
          type="checkbox"
          name="rememberMe"
          checked={rememberMe}
          onChange={(event) => setRememberMe(event.target.checked)}
          className="h-4 w-4 rounded border-white/20 bg-[#05070B] accent-[#D8B87A]"
        />
        <span>تذكرني</span>
      </label>

      <div className="text-sm">
        <Link href="/admin/forgot-password" className="text-[#D8B87A]/85 transition hover:text-[#D8B87A]">
          نسيت كلمة المرور؟
        </Link>
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl border border-[#D8B87A]/30 bg-[#D8B87A] px-4 py-3 text-sm font-bold text-[#06101C] transition hover:bg-[#e5c98d] disabled:opacity-60"
      >
        {loading ? "جاري الدخول…" : "دخول لوحة التحكم"}
      </button>
    </form>
  );
}
