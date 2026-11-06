"use client";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    router.push("/signin");
    router.refresh();
  }
  return (
    <button onClick={signOut} className="mt-2 text-xs text-ink-muted hover:text-ink">
      Sign out
    </button>
  );
}
