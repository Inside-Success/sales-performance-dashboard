"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Mail, UserCircle } from "lucide-react";
import { signOut } from "next-auth/react";

export function ProfileMenu({ userName, userEmail, compact = false }: { userName: string; userEmail: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const initials = getInitials(userName, userEmail);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Open profile menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={compact ? "grid size-11 place-items-center rounded-full border border-red-100 bg-white text-[#DC2626] shadow-sm ring-2 ring-white transition hover:border-red-200 hover:bg-red-50" : "grid size-13 place-items-center rounded-full border border-red-100 bg-white text-[#DC2626] shadow-[0_10px_28px_rgba(15,23,42,.12),0_8px_22px_rgba(220,38,38,.14)] ring-4 ring-white transition hover:border-red-200 hover:bg-red-50 hover:shadow-[0_14px_32px_rgba(15,23,42,.14),0_10px_26px_rgba(220,38,38,.18)]"}
      >
        <span className={compact ? "grid size-9 place-items-center rounded-full bg-[#DC2626] text-[11px] font-extrabold uppercase tracking-normal text-white shadow-inner" : "grid size-10 place-items-center rounded-full bg-[#DC2626] text-[12px] font-extrabold uppercase tracking-normal text-white shadow-inner"}>
          {initials}
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+12px)] z-50 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-2xl shadow-slate-900/12"
        >
          <div className="border-b border-slate-100 p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-[#FEF2F2] text-[#DC2626]">
                <UserCircle className="size-6" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold tracking-normal text-slate-950">
                  {userName}
                </p>
                <p className="mt-0.5 truncate text-xs font-medium text-slate-500">{userEmail}</p>
              </div>
            </div>
          </div>

          <div className="space-y-1 p-2">
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500">
              <Mail className="size-4 text-slate-400" />
              Google profile
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => signOut({ callbackUrl: "/sign-in" })}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-red-50 hover:text-[#DC2626]"
            >
              <span className="inline-flex items-center gap-2">
                <LogOut className="size-4" />
                Log out
              </span>
              <ChevronDown className="size-4 rotate-[-90deg] opacity-50" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getInitials(name: string, email: string) {
  const source = name !== "Signed-in user" ? name : email.split("@")[0] || "U";
  const parts = source
    .replace(/[^a-zA-Z0-9\s._-]/g, " ")
    .split(/[\s._-]+/)
    .filter(Boolean);

  return (parts[0]?.[0] || "U").concat(parts[1]?.[0] || "").slice(0, 2).toUpperCase();
}
