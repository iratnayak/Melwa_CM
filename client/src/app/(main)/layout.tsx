"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { MeProvider, type MeUser } from "@/context/me-context";
import { AppShell } from "@/components/app-shell";
import { apiFetch } from "@/lib/api";

export default function MainLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<MeUser | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      router.replace("/");
      return;
    }
    (async () => {
      try {
        const data = await apiFetch<MeUser>("/auth/me");
        setMe(data);
        setPhase("ready");
      } catch {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        router.replace("/");
      }
    })();
  }, [router]);

  if (phase === "loading" || !me) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-24 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <MeProvider me={me}>
      <AppShell>{children}</AppShell>
    </MeProvider>
  );
}
