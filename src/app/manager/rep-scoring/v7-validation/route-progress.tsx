"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function RouteProgress() {
  const pathname = usePathname();
  const [targetPath, setTargetPath] = useState("");
  const loading = Boolean(targetPath && targetPath !== pathname);

  useEffect(() => {
    const begin = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.origin !== window.location.origin) return;
      if (!anchor.pathname.startsWith("/manager/rep-scoring/v7-validation") || anchor.pathname === window.location.pathname) return;
      setTargetPath(anchor.pathname);
    };
    document.addEventListener("click", begin, true);
    return () => document.removeEventListener("click", begin, true);
  }, []);

  if (!loading) return null;
  return <div className="fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-red-100" role="status" aria-label="Loading page"><div className="h-full w-2/3 animate-pulse rounded-r-full bg-red-600" /></div>;
}
