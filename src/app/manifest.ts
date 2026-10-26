import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand/colors";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "TezDukan",
    short_name: "TezDukan",
    description:
      "Order stock from distributors in minutes and run your whole dukan: billing, inventory, khata and reports.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: brand.surface,
    theme_color: brand.surface,
    lang: "en",
    dir: "auto",
    categories: ["business", "shopping", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
