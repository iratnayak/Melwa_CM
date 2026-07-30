"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useMe } from "@/context/me-context";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ProfilePage() {
  const me = useMe();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const [pwOpen, setPwOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const canSavePw = useMemo(
    () => currentPassword.trim().length >= 6 && newPassword.trim().length >= 6 && !pwSaving,
    [currentPassword, newPassword, pwSaving],
  );

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

  async function savePassword() {
    setPwSaving(true);
    setError(null);
    try {
      await apiFetch("/users/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPwOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      await logout();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to change password");
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">My profile</h1>
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="text-sm text-muted-foreground">Account details from /auth/me</div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setPwOpen(true)}>
                Change password
              </Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={logout}>
                Logout
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {error ? (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <div className="rounded-md border bg-background px-3 py-2 text-sm">{me.name}</div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="rounded-md border bg-background px-3 py-2 text-sm">{me.email}</div>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <div className="rounded-md border bg-background px-3 py-2 text-sm">{me.role}</div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="rounded-md border bg-background px-3 py-2 text-sm">
                {me.isActive ? "Active" : "Inactive"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>
              After changing your password, you will be asked to sign in again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="pr-12"
                />
                <button
                  type="button"
                  aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground hover:text-foreground"
                  onClick={() => setShowCurrentPassword((p) => !p)}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-12"
                />
                <button
                  type="button"
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNewPassword((p) => !p)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPwOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={!canSavePw}
              onClick={() => void savePassword()}
            >
              {pwSaving ? "Saving…" : "Update password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
