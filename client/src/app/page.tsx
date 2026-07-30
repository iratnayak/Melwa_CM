"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "http://localhost:3001";

type LoginResult =
  | {
      ok: true;
      accessToken: string;
      refreshToken: string;
    }
  | {
      ok: false;
      message: string;
      code?: string;
    };

async function login(identifier: string, password: string): Promise<LoginResult> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
  } catch {
    return {
      ok: false,
      message: "Cannot reach API server. Please check if backend is running on port 3001.",
      code: "network_error",
    };
  }

  if (!res.ok) {
    if (res.status === 429) {
      return { ok: false, message: "Too many attempts. Please try again later.", code: "rate_limit" };
    }
    const body = (await res.json().catch(() => null)) as any;
    const msg = body?.message ?? "Invalid username or password.";
    return { ok: false, message: Array.isArray(msg) ? msg.join(", ") : String(msg) };
  }

  const data = (await res.json()) as any;
  return { ok: true, accessToken: data.accessToken, refreshToken: data.refreshToken };
}

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("accessToken")) {
      router.replace("/dashboard");
    }
  }, [router]);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotInfo, setForgotInfo] = useState<string | null>(null);
  const [lockedOpen, setLockedOpen] = useState(false);

  const canSubmit = useMemo(
    () => identifier.trim().length > 0 && password.trim().length > 0 && !isLoading,
    [identifier, password, isLoading],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const result = await login(identifier, password);
      if (!result.ok) {
        // Example: if you later return a "locked" code from API, open modal.
        if (result.code === "locked") {
          setLockedOpen(true);
          return;
        }
        setError(result.message);
        return;
      }

      localStorage.setItem("accessToken", result.accessToken);
      localStorage.setItem("refreshToken", result.refreshToken);
      router.push("/dashboard");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-xl rounded-2xl shadow-sm border-border/70">
        <CardHeader className="pb-0">
          <div className="pt-6 text-center">
            <div className="text-3xl font-black tracking-wide text-red-600 italic">
              MELWA
            </div>
            <div className="mt-6 text-3xl font-semibold tracking-tight text-foreground">
              CREDIT LEDGER
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              Sign in to your account
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-10 pb-10 pt-8">
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-sm">
                Username
              </Label>
              <Input
                id="identifier"
                placeholder="Enter your username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="pr-12"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-sm font-medium text-red-600 hover:underline"
                  onClick={() => setForgotOpen(true)}
                >
                  Forgot password?
                </button>
              </div>
            </div>

            {error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={!canSubmit}
              className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              {isLoading ? "Signing In..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <AlertDialog open={lockedOpen} onOpenChange={setLockedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Account Locked Alert</AlertDialogTitle>
            <AlertDialogDescription>
              For security, your account has been locked. Please contact the Admin to
              verify your identity and unlock your access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white">
              Contact Admin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={forgotOpen}
        onOpenChange={(open) => {
          setForgotOpen(open);
          if (!open) setForgotInfo(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forgot password</DialogTitle>
            <DialogDescription>
              Self-service email reset is not enabled. An administrator must reset your
              password from the Users screen.
            </DialogDescription>
          </DialogHeader>
          {forgotInfo ? (
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              {forgotInfo}
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setForgotOpen(false)}>
              Close
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() =>
                setForgotInfo(
                  "Please sign out (if needed) and contact your system administrator with your username so they can set a new password for you.",
                )
              }
            >
              I understand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
