import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { BarChart3, Home } from "lucide-react";
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
  title: "Lil Rudy Sales Feedback Bot",
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
          <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold">
              <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                <BarChart3 className="size-4" />
              </span>
              <span className="truncate">Lil Rudy Feedback</span>
            </Link>
            <nav aria-label="Primary navigation" className="flex items-center gap-2">
              <Link
                href="/"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-card px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
              >
                <Home className="size-4" />
                Home
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
