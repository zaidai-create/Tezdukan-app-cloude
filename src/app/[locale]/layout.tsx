import { SerwistProvider } from "@serwist/turbopack/react";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Inter, Noto_Naskh_Arabic, Noto_Nastaliq_Urdu, Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import { ServerOnlyScript } from "@/components/server-only-script";
import { localeDir } from "@/i18n/locales";
import { routing } from "@/i18n/routing";
import { themeColor } from "@/lib/brand/colors";
import { publicEnv } from "@/lib/env";
import { themeBootScript } from "@/lib/theme/theme";
import "../globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-jakarta",
  display: "swap",
});
// Arabic-script fonts load only when Urdu/Sindhi glyphs render (unicode-range subsets).
const naskh = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-naskh",
  display: "swap",
  preload: false,
});
const nastaliq = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-nastaliq-urdu",
  display: "swap",
  preload: false,
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL),
    applicationName: "TezDukan",
    title: { default: t("title"), template: `%s · ${t("appName")}` },
    description: t("description"),
    appleWebApp: { capable: true, title: t("appName"), statusBarStyle: "default" },
    formatDetection: { telephone: false },
    icons: {
      icon: [
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/favicon.svg", type: "image/svg+xml" },
      ],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // The theme boot script swaps this to the dark value when dark mode is on.
  themeColor: themeColor.light,
};

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  const dir = localeDir(locale);
  return (
    <html
      lang={locale}
      dir={dir}
      // The boot script adds `dark` before hydration.
      suppressHydrationWarning
      className={`${inter.variable} ${jakarta.variable} ${naskh.variable} ${nastaliq.variable}`}
    >
      <head>
        {/* Runs before first paint, so dark mode never flashes white. */}
        <ServerOnlyScript code={themeBootScript} />
      </head>
      <body>
        <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV === "development"}>
          <NextIntlClientProvider>
            <Providers dir={dir}>{children}</Providers>
          </NextIntlClientProvider>
        </SerwistProvider>
      </body>
    </html>
  );
}
