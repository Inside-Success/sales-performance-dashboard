import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Bot } from "lucide-react";
import { MainNav } from "@/components/dashboard/main-nav";
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
          <div className="mx-auto flex min-h-[72px] w-full max-w-6xl flex-col items-start justify-center gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-0">
            <Link href="/" className="flex min-w-0 items-center gap-3 font-semibold">
              <span className="magic-brand-mark grid size-11 place-items-center rounded-2xl text-white">
                <Bot className="size-6" />
              </span>
              <span className="leading-tight">
                <span className="block text-[19px] font-extrabold tracking-normal text-slate-900">
                  Magic Mike <span className="text-[#DC2626]">Bot</span>
                </span>
                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Inside Success TV
                </span>
              </span>
            </Link>
            <MainNav />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
