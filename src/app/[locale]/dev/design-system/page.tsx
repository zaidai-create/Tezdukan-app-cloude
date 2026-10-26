import type { Metadata } from "next";
import { DesignSystem } from "./design-system";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

/** Living catalogue of tokens, components and states. Not linked from the app. */
export default function DesignSystemPage() {
  return <DesignSystem />;
}
