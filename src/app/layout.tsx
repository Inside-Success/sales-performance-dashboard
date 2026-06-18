import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { BarChart3, FileText, Home, Send } from "lucide-react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Magic Mike Bot (Formerly Lil Rudy)",
  description: "Simple rep-based coaching feedback for Inside Success TV sales calls.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${plusJakarta.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background">
        <header className="magic-app-header sticky top-0 z-40 border-b backdrop-blur supports-[backdrop-filter]:bg-white/85">
          <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:flex-nowrap sm:gap-3 sm:px-6 sm:py-0 lg:px-8">
            <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold">
              <span className="magic-brand-mark grid size-9 place-items-center rounded-2xl text-white">
                <BarChart3 className="size-4" />
              </span>
              <span className="truncate text-[0.95rem] tracking-normal">Magic Mike Bot</span>
            </Link>
            <nav
              aria-label="Primary navigation"
              className="dashboard-scroll -mx-1 flex w-full min-w-0 items-center gap-1 overflow-x-auto pb-0.5 sm:mx-0 sm:w-auto sm:flex-none sm:justify-end sm:overflow-visible sm:pb-0"
            >
              <Link
                href="/"
                className="magic-nav-link inline-flex h-9 shrink-0 items-center gap-1.5 px-3 text-sm font-semibold transition-colors"
              >
                <Home className="size-4" />
                Home
              </Link>
              <Link
                href="/manual-reports"
                className="magic-nav-link inline-flex h-9 shrink-0 items-center gap-1.5 px-3 text-sm font-semibold transition-colors"
              >
                <FileText className="size-4" />
                Self-submitted reports
              </Link>
              <Link
                href="/submit"
                className="magic-nav-link magic-nav-link-primary inline-flex h-9 shrink-0 items-center gap-1.5 px-3 text-sm font-semibold transition-colors"
              >
                <Send className="size-4" />
                Get feedback
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
