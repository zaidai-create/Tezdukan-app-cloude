import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "InvoicePilot AI",
  description: "Conversational AI agent for processing invoice PDFs and images.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface-elevated text-ink antialiased">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{ className: "rounded-xl shadow-raised" }}
        />
      </body>
    </html>
  );
}
