import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { GlobalHeader } from "@/components/navigation/GlobalHeader";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trade3 · Capital Sourcing Platform",
  description:
    "Institutional AI platform for Trade Finance, Invoice Factoring, and Startup Capital Sourcing. Powered by autonomous domain agents and Zod DSL compile pipelines.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${inter.variable} ${plusJakartaSans.variable}`}>
      <body className="min-h-full bg-[#fafafa] dark:bg-[#111422] text-[#1a1f3a] dark:text-neutral-100 antialiased flex flex-col font-sans">
        <GlobalHeader />
        <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
