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

type Department = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type Employee = {
  id: number;
  employeeCode: string;
  fullName: string;
  departmentId: number;
  department: { id: number; code: string; name: string };
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ListRes = { items: Employee[]; total: number };

export default function EmployeesPage() {
  const me = useMe();
  const isAdmin = me.role === "admin";

  const [deptOptions, setDeptOptions] = useState<Department[]>([]);
  const [items, setItems] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [qInput, setQInput] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("");
  const [isActiveFilter, setIsActiveFilter] = useState<"" | "true" | "false">("");
  const [skip, setSkip] = useState(0);
  const take = 20;

  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<Employee | null>(null);
  const [activeRow, setActiveRow] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);

  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formDeptId, setFormDeptId] = useState("");
  const [formPhone, setFormPhone] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const d = await apiFetch<{ items: Department[]; total: number }>(
          "/departments?take=100&skip=0",
        );
        setDeptOptions(d.items);
      } catch {
        // ignore — filter dropdown stays empty
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (appliedQ.trim()) params.set("q", appliedQ.trim());
      if (deptFilter) params.set("departmentId", deptFilter);
      if (isActiveFilter) params.set("isActive", isActiveFilter);
      params.set("skip", String(skip));
      params.set("take", String(take));
      const data = await apiFetch<ListRes>(`/employees?${params.toString()}`);
      setItems(data.items);
      setTotal(data.total);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }, [appliedQ, deptFilter, isActiveFilter, skip]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setFormCode("");
    setFormName("");
    setFormDeptId(deptOptions[0] ? String(deptOptions[0].id) : "");
    setFormPhone("");
    setCreateOpen(true);
  }

  function openEdit(row: Employee) {
    setFormCode(row.employeeCode);
    setFormName(row.fullName);
    setFormDeptId(String(row.departmentId));
    setFormPhone(row.phone ?? "");
    setEditRow(row);
  }

  async function submitCreate() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/employees", {
        method: "POST",
        body: JSON.stringify({
          employeeCode: formCode,
          fullName: formName,
          departmentId: Number(formDeptId),
          ...(formPhone.trim() ? { phone: formPhone.trim() } : {}),
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
      await apiFetch(`/employees/${editRow.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          employeeCode: formCode,
          fullName: formName,
          departmentId: Number(formDeptId),
          phone: formPhone,
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

  async function submitActive(next: boolean) {
    if (!activeRow) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/employees/${activeRow.id}/active`, {
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
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground">Total: {total}</p>
        </div>
        {isAdmin ? (
          <Button className="bg-red-600 hover:bg-red-700" onClick={openCreate}>
            New employee
          </Button>
        ) : null}
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="space-y-1.5 sm:min-w-[200px]">
              <Label>Search</Label>
              <Input
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="Name, code, phone"
              />
            </div>
            <div className="space-y-1.5 sm:w-48">
              <Label>Department</Label>
              <select
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={deptFilter}
                onChange={(e) => {
                  setSkip(0);
                  setDeptFilter(e.target.value);
                }}
              >
                <option value="">All</option>
                {deptOptions.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.code} — {d.name}
                  </option>
                ))}
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
                    <th className="px-3 py-2 font-medium">Code</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Department</th>
                    <th className="px-3 py-2 font-medium">Phone</th>
                    <th className="px-3 py-2 font-medium">Active</th>
                    <th className="px-3 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-mono text-xs">{row.employeeCode}</td>
                      <td className="px-3 py-2">{row.fullName}</td>
                      <td className="px-3 py-2 text-xs">
                        {row.department.code}{" "}
                        <span className="text-muted-foreground">({row.department.name})</span>
                      </td>
                      <td className="px-3 py-2">{row.phone ?? "—"}</td>
                      <td className="px-3 py-2">{row.isActive ? "Yes" : "No"}</td>
                      <td className="px-3 py-2 text-right">
                        {isAdmin ? (
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setActiveRow(row)}
                            >
                              {row.isActive ? "Deactivate" : "Activate"}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                        No employees
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New employee</DialogTitle>
            <DialogDescription>Department must be active.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Employee code</Label>
              <Input value={formCode} onChange={(e) => setFormCode(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <select
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={formDeptId}
                onChange={(e) => setFormDeptId(e.target.value)}
              >
                {deptOptions.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Phone (optional)</Label>
              <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={
                saving || !formCode.trim() || !formName.trim() || !formDeptId
              }
              onClick={() => void submitCreate()}
            >
              {saving ? "Saving…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit employee</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Employee code</Label>
              <Input value={formCode} onChange={(e) => setFormCode(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <select
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={formDeptId}
                onChange={(e) => setFormDeptId(e.target.value)}
              >
                {deptOptions.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditRow(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={
                saving || !formCode.trim() || !formName.trim() || !formDeptId
              }
              onClick={() => void submitEdit()}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!activeRow} onOpenChange={(o) => !o && setActiveRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {activeRow?.isActive ? "Deactivate employee" : "Activate employee"}
            </DialogTitle>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setActiveRow(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={saving || !activeRow}
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
