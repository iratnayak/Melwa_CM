"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMe } from "@/context/me-context";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type UserRow = {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ListRes = { items: UserRow[]; total: number };

export default function UsersPage() {
  const me = useMe();
  const isAdmin = me.role === "admin";

  const [items, setItems] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [qInput, setQInput] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [isActiveFilter, setIsActiveFilter] = useState<"" | "true" | "false">("");
  const [skip, setSkip] = useState(0);
  const take = 20;

  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<UserRow | null>(null);
  const [resetRow, setResetRow] = useState<UserRow | null>(null);
  const [activeRow, setActiveRow] = useState<UserRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("officer");

  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("officer");

  const [newPassword, setNewPassword] = useState("");

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (appliedQ.trim()) params.set("q", appliedQ.trim());
      if (roleFilter) params.set("role", roleFilter);
      if (isActiveFilter) params.set("isActive", isActiveFilter);
      params.set("skip", String(skip));
      params.set("take", String(take));
      const data = await apiFetch<ListRes>(`/users?${params.toString()}`);
      setItems(data.items);
      setTotal(data.total);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [appliedQ, roleFilter, isActiveFilter, skip, isAdmin]);

  useEffect(() => {
    if (isAdmin) void load();
    else setLoading(false);
  }, [load, isAdmin]);

  if (!isAdmin) {
    return (
      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <h1 className="text-xl font-semibold">Users</h1>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This area is only available to administrators.
          </p>
        </CardContent>
      </Card>
    );
  }

  function openCreate() {
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormRole("officer");
    setCreateOpen(true);
  }

  function openEdit(row: UserRow) {
    setEditName(row.name);
    setEditEmail(row.email);
    setEditRole(row.role);
    setEditRow(row);
  }

  async function submitCreate() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/users", {
        method: "POST",
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          password: formPassword,
          role: formRole,
        }),
      });
      setCreateOpen(false);
      await load();
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitEdit() {
    if (!editRow) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/users/${editRow.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          role: editRole,
        }),
      });
      setEditRow(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitReset() {
    if (!resetRow) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/users/${resetRow.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ newPassword }),
      });
      setResetRow(null);
      setNewPassword("");
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitActive(next: boolean) {
    if (!activeRow) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/users/${activeRow.id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: next }),
      });
      setActiveRow(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  const pageMax = useMemo(() => Math.max(0, Math.ceil(total / take) - 1), [total]);
  const page = Math.floor(skip / take);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">Total: {total}</p>
        </div>
        <Button className="bg-red-600 hover:bg-red-700" onClick={openCreate}>
          New user
        </Button>
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="space-y-1.5 sm:min-w-[200px]">
              <Label>Search</Label>
              <Input
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="Name or email"
              />
            </div>
            <div className="space-y-1.5 sm:w-40">
              <Label>Role</Label>
              <select
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={roleFilter}
                onChange={(e) => {
                  setSkip(0);
                  setRoleFilter(e.target.value);
                }}
              >
                <option value="">All</option>
                <option value="admin">admin</option>
                <option value="officer">officer</option>
                <option value="viewer">viewer</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:w-40">
              <Label>Status</Label>
              <select
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={isActiveFilter}
                onChange={(e) => {
                  setSkip(0);
                  setIsActiveFilter(e.target.value as "" | "true" | "false");
                }}
              >
                <option value="">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setSkip(0);
                setAppliedQ(qInput);
              }}
            >
              Apply search
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Active</th>
                    <th className="px-3 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2">{row.email}</td>
                      <td className="px-3 py-2">{row.role}</td>
                      <td className="px-3 py-2">{row.isActive ? "Yes" : "No"}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setResetRow(row)}>
                            Reset PW
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveRow(row)}
                            disabled={row.id === me.id}
                          >
                            {row.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                        No users
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              Page {page + 1} of {Math.max(1, pageMax + 1)}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={skip <= 0}
                onClick={() => setSkip((s) => Math.max(0, s - take))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={skip + take >= total}
                onClick={() => setSkip((s) => s + take)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New user</DialogTitle>
            <DialogDescription>Minimum password length 6.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <select
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
              >
                <option value="admin">admin</option>
                <option value="officer">officer</option>
                <option value="viewer">viewer</option>
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={
                saving ||
                !formName.trim() ||
                !formEmail.trim() ||
                formPassword.trim().length < 6
              }
              onClick={() => void submitCreate()}
            >
              {saving ? "Saving…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <select
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
              >
                <option value="admin">admin</option>
                <option value="officer">officer</option>
                <option value="viewer">viewer</option>
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditRow(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={saving || !editName.trim() || !editEmail.trim()}
              onClick={() => void submitEdit()}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetRow} onOpenChange={(o) => !o && setResetRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              User will need to sign in with the new password. Sessions are cleared.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>New password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResetRow(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={saving || newPassword.trim().length < 6}
              onClick={() => void submitReset()}
            >
              {saving ? "Saving…" : "Reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!activeRow} onOpenChange={(o) => !o && setActiveRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {activeRow?.isActive ? "Deactivate user" : "Activate user"}
            </DialogTitle>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setActiveRow(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={saving || !activeRow || activeRow.id === me.id}
              onClick={() => void submitActive(!activeRow?.isActive)}
            >
              {saving ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
