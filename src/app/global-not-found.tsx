import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Page not found · TezDukan",
};

/** Requests that never reach a locale (unknown files, unknown API paths). English only. */
export default function GlobalNotFound() {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
          <LogoMark className="size-14" />
          <h1 className="font-heading text-2xl font-semibold text-ink">{"Page not found"}</h1>
          <p className="max-w-sm text-base text-muted">
            {"This page does not exist or has moved."}
          </p>
          <Link
            href="/"
            className="inline-flex h-12 items-center rounded-md bg-action px-5 font-semibold text-on-action"
          >
            {"Go to TezDukan"}
          </Link>
        </main>
      </body>
    </html>
  );
}
