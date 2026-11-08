import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/new", label: "New Project" },
  { href: "/projects", label: "My Projects" },
  { href: "/history", label: "Document History" },
  { href: "/settings", label: "Settings" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/signin");

  return (
    <div className="flex min-h-screen bg-surface-elevated">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface/60 backdrop-blur-xl p-5 md:flex">
        <div className="mb-8 flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-ink text-surface grid place-items-center text-xs font-semibold">IP</div>
          <span className="font-semibold tracking-tight">InvoicePilot</span>
        </div>
        <nav className="flex flex-col gap-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface-panel transition"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-line pt-4">
          <div className="truncate text-xs text-ink-muted">{data.user.email}</div>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
