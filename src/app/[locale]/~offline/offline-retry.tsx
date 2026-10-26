"use client";

import { RotateCw } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Reloads as soon as the connection comes back, or when tapped. */
export function OfflineRetry({ label }: { label: string }) {
  useEffect(() => {
    const onOnline = () => window.location.reload();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);
  return (
    <Button size="lg" onClick={() => window.location.reload()}>
      <RotateCw aria-hidden />
      {label}
    </Button>
  );
}
