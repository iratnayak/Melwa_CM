"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMe } from "@/context/me-context";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", roles: ["admin", "officer", "viewer"] as const },
  { href: "/departments", label: "Departments", roles: ["admin", "officer", "viewer"] as const },
  { href: "/employees", label: "Employees", roles: ["admin", "officer", "viewer"] as const },
  {
    href: "/credit-transactions",
    label: "Credit transactions",
    roles: ["admin", "officer", "viewer"] as const,
  },
  { href: "/payments", label: "Payments", roles: ["admin", "officer", "viewer"] as const },
  { href: "/balances", label: "Balances", roles: ["admin", "officer", "viewer"] as const },
  { href: "/reports", label: "Reports", roles: ["admin", "officer", "viewer"] as const },
  {
    href: "/billing-cycles",
    label: "Billing cycles",
    roles: ["admin", "officer", "viewer"] as const,
  },
  { href: "/users", label: "Users", roles: ["admin"] as const },
  { href: "/audit", label: "Audit log", roles: ["admin"] as const },
  { href: "/profile", label: "Profile", roles: ["admin", "officer", "viewer"] as const },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      router.replace("/");
    }
  }

  const links = NAV.filter((item) =>
    (item.roles as readonly string[]).includes(me.role),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-lg font-black italic tracking-wide text-red-600">
              MELWA
            </Link>
            <span className="hidden text-sm text-muted-foreground sm:inline">Credit Ledger</span>
          </div>
          <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  pathname === l.href
                    ? "bg-red-600 text-white"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <span className="truncate text-muted-foreground">
              <span className="font-medium text-foreground">{me.name}</span>
              <span className="mx-1">·</span>
              {me.role}
            </span>
            <Button variant="outline" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
