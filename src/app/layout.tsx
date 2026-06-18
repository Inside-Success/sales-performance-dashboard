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
              className="grid w-full min-w-0 grid-cols-3 items-center gap-1 sm:flex sm:w-auto sm:flex-none sm:justify-end"
            >
              <Link
                href="/"
                className="magic-nav-link inline-flex h-9 shrink-0 items-center justify-center gap-1.5 px-2 text-sm font-semibold transition-colors sm:px-3"
              >
                <Home className="size-4" />
                Home
              </Link>
              <Link
                href="/manual-reports"
                className="magic-nav-link inline-flex h-9 shrink-0 items-center justify-center gap-1.5 px-2 text-sm font-semibold transition-colors sm:px-3"
              >
                <FileText className="size-4" />
                <span className="sm:hidden">Reports</span>
                <span className="hidden sm:inline">Self-submitted reports</span>
              </Link>
              <Link
                href="/submit"
                className="magic-nav-link magic-nav-link-primary inline-flex h-9 shrink-0 items-center justify-center gap-1.5 px-2 text-sm font-semibold transition-colors sm:px-3"
              >
                <Send className="size-4" />
                <span className="sm:hidden">Feedback</span>
                <span className="hidden sm:inline">Get feedback</span>
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
