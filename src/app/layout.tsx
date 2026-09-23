import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Capital Sourcing Platform",
  description:
    "Upload deal documents, extract a structured deal spec, and match against a researched capital-provider database.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-neutral-50 text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/deals" className="text-sm font-semibold tracking-tight">
              Capital Sourcing Platform
            </Link>
            <nav className="flex gap-4 text-sm text-neutral-600 dark:text-neutral-400">
              <Link href="/deals" className="hover:text-neutral-900 dark:hover:text-neutral-100">
                Deals
              </Link>
              <Link href="/providers" className="hover:text-neutral-900 dark:hover:text-neutral-100">
                Providers
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
