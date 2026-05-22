import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background">
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold">
              <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                <BarChart3 className="size-4" />
              </span>
              <span className="truncate">Magic Mike Bot</span>
            </Link>
            <nav
              aria-label="Primary navigation"
              className="dashboard-scroll flex min-w-0 flex-1 items-center justify-end gap-1 overflow-x-auto pb-0.5 sm:flex-none sm:overflow-visible sm:pb-0"
            >
              <Link
                href="/"
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
              >
                <Home className="size-4" />
                Home
              </Link>
              <Link
                href="/manual-reports"
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
              >
                <FileText className="size-4" />
                Self-submitted reports
              </Link>
              <Link
                href="/submit"
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
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
