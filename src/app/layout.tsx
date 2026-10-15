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
            <nav className="flex items-center gap-2 text-sm">
              <div className="flex items-center rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
                <Link
                  href="/deals"
                  className="rounded-md px-3 py-1 font-medium text-neutral-700 hover:text-neutral-900 hover:bg-white dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-700 transition-all"
                >
                  Invoice Deals
                </Link>
                <Link
                  href="/trade-deals"
                  className="rounded-md px-3 py-1 font-medium text-neutral-700 hover:text-neutral-900 hover:bg-white dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-700 transition-all"
                >
                  Trade Deals
                </Link>
                <Link
                  href="/vc-deals"
                  className="rounded-md bg-emerald-600 px-3 py-1 font-semibold text-white shadow-xs hover:bg-emerald-700 transition-all"
                >
                  VC Deals (New)
                </Link>
              </div>

              <div className="h-4 w-[1px] bg-neutral-200 dark:bg-neutral-800 mx-2" />

              <Link href="/providers" className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
                Invoice Providers
              </Link>
              <Link
                href="/trade-funders"
                className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
              >
                Trade Funders
              </Link>
              <Link
                href="/vc-investors"
                className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
              >
                VC Investors
              </Link>
              <Link href="/research" className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
                Research
              </Link>
              <Link href="/export" className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
                Export
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
