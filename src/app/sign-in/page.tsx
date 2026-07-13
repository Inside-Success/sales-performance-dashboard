import type { Metadata } from "next";
import { Bot, ShieldCheck } from "lucide-react";
import { signIn } from "@/auth";
import { GoogleSignInButton } from "@/components/dashboard/google-sign-in-button";

export const metadata: Metadata = {
  title: "Sign in | Magic Mike Bot",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[]; error?: string | string[] }>;
}) {
  const params = await searchParams;
  const callbackUrl = Array.isArray(params.callbackUrl) ? params.callbackUrl[0] : params.callbackUrl;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const redirectTo = getSafeRedirect(callbackUrl);

  return (
    <main className="magic-auth-page flex min-h-screen items-center justify-center px-5 py-10">
      <div className="relative z-10 w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="grid size-16 place-items-center rounded-[22px] bg-[#DC2626] text-white shadow-[0_14px_32px_-10px_rgba(220,38,38,.75)]">
            <Bot className="size-9" strokeWidth={2.2} />
          </span>
          <span className="mt-4 text-[13px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Inside Success TV
          </span>
        </div>

        <section className="rounded-[22px] border border-black/[0.05] bg-white p-8 shadow-[0_1px_2px_rgba(17,17,26,.035),0_5px_18px_-10px_rgba(17,17,26,.09),0_28px_60px_-28px_rgba(17,17,26,.16)] sm:p-10">
          <div className="text-center">
            <h1 className="text-[27px] font-extrabold leading-[1.15] tracking-normal text-slate-900 sm:text-[30px]">
              Welcome to Magic Mike <span className="text-[#DC2626]">Bot</span>
            </h1>
            <p className="mt-2.5 text-[15px] font-medium leading-relaxed text-slate-500">
              Sign in to access Coaching and Ask Sales FAQ.
            </p>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-6 text-red-700">
              This Google account is not approved for Magic Mike. Use an approved company email.
            </div>
          ) : null}

          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo });
            }}
          >
            <GoogleSignInButton />
          </form>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[13px] font-medium text-slate-400">
            <ShieldCheck className="size-3.5" strokeWidth={2.3} />
            Use your company Google account
          </p>
        </section>
      </div>
    </main>
  );
}

function getSafeRedirect(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.startsWith("/sign-in")) return "/";
  return value;
}
