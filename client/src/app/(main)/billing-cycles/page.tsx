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

type BillingCycle = {
  id: number;
  cycleCode: string;
  startDate: string;
  endDate: string;
  dueDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type ListRes = { items: BillingCycle[]; total: number };

const STATUSES = ["", "draft", "open", "closed"] as const;

export default function BillingCyclesPage() {
  const me = useMe();
  const isAdmin = me.role === "admin";

  const [items, setItems] = useState<BillingCycle[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [qInput, setQInput] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [startFromInput, setStartFromInput] = useState("");
  const [startToInput, setStartToInput] = useState("");
  const [appliedStartFrom, setAppliedStartFrom] = useState("");
  const [appliedStartTo, setAppliedStartTo] = useState("");
  const [skip, setSkip] = useState(0);
  const take = 20;

  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<BillingCycle | null>(null);
  const [deleteRow, setDeleteRow] = useState<BillingCycle | null>(null);
  const [settleRow, setSettleRow] = useState<BillingCycle | null>(null);
  const [reopenRow, setReopenRow] = useState<BillingCycle | null>(null);
  const [saving, setSaving] = useState(false);

  const [formCode, setFormCode] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formDue, setFormDue] = useState("");
  const [formStatus, setFormStatus] = useState<string>("draft");
  const [actionReason, setActionReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (appliedQ.trim()) params.set("q", appliedQ.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (appliedStartFrom.trim()) params.set("startDateFrom", appliedStartFrom.trim());
      if (appliedStartTo.trim()) params.set("startDateTo", appliedStartTo.trim());
      params.set("skip", String(skip));
      params.set("take", String(take));
      const data = await apiFetch<ListRes>(`/billing-cycles?${params.toString()}`);
      setItems(data.items);
      setTotal(data.total);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Failed to load billing cycles");
    } finally {
      setLoading(false);
    }
  }, [appliedQ, statusFilter, appliedStartFrom, appliedStartTo, skip]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setFormCode("");
    setFormStart("");
    setFormEnd("");
    setFormDue("");
    setFormStatus("draft");
    setCreateOpen(true);
  }

  function openEdit(row: BillingCycle) {
    setFormCode(row.cycleCode);
    setFormStart(row.startDate);
    setFormEnd(row.endDate);
    setFormDue(row.dueDate);
    setFormStatus(row.status);
    setEditRow(row);
  }

  async function submitCreate() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch("/billing-cycles", {
        method: "POST",
        body: JSON.stringify({
          cycleCode: formCode,
          startDate: formStart,
          endDate: formEnd,
          dueDate: formDue,
          status: formStatus,
        }),
      });
      setCreateOpen(false);
      setSuccess("Billing cycle created.");
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
    setSuccess(null);
    try {
      await apiFetch(`/billing-cycles/${editRow.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          cycleCode: formCode,
          startDate: formStart,
          endDate: formEnd,
          dueDate: formDue,
          status: formStatus,
        }),
      });
      setEditRow(null);
      setSuccess("Billing cycle updated.");
      await load();
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitDelete() {
    if (!deleteRow) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/billing-cycles/${deleteRow.id}`, { method: "DELETE" });
      setDeleteRow(null);
      setSuccess("Billing cycle deleted.");
      await load();
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitSettle() {
    if (!settleRow) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch<{ success: boolean; affectedEmployees: number }>(
        `/billing-cycles/${settleRow.id}/settle`,
        {
          method: "POST",
          body: JSON.stringify({
            ...(actionReason.trim() ? { reason: actionReason.trim() } : {}),
          }),
        },
      );
      setSettleRow(null);
      setActionReason("");
      setSuccess(`Cycle settled. Recalculated employees: ${res.affectedEmployees}`);
      await load();
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Settle failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitReopen() {
    if (!reopenRow) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/billing-cycles/${reopenRow.id}/reopen`, {
        method: "POST",
        body: JSON.stringify({
          ...(actionReason.trim() ? { reason: actionReason.trim() } : {}),
        }),
      });
      setReopenRow(null);
      setActionReason("");
      setSuccess("Cycle reopened.");
      await load();
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Reopen failed");
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
          <h1 className="text-2xl font-semibold tracking-tight">Billing cycles</h1>
          <p className="text-sm text-muted-foreground">Total: {total}</p>
        </div>
        {isAdmin ? (
          <Button className="bg-red-600 hover:bg-red-700" onClick={openCreate}>
            New billing cycle
          </Button>
        ) : null}
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="space-y-1.5 sm:min-w-[160px]">
              <Label>Search</Label>
              <Input
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="Code or status"
              />
            </div>
            <div className="space-y-1.5 sm:w-36">
              <Label>Status</Label>
              <select
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={statusFilter}
                onChange={(e) => {
                  setSkip(0);
                  setStatusFilter(e.target.value);
                }}
              >
                {STATUSES.map((s) => (
                  <option key={s || "all"} value={s}>
                    {s === "" ? "All" : s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:w-40">
              <Label>Start from</Label>
              <Input
                type="date"
                value={startFromInput}
                onChange={(e) => setStartFromInput(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:w-40">
              <Label>Start to</Label>
              <Input
                type="date"
                value={startToInput}
                onChange={(e) => setStartToInput(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setSkip(0);
                setAppliedQ(qInput);
                setAppliedStartFrom(startFromInput);
                setAppliedStartTo(startToInput);
              }}
            >
              Apply filters
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              {success}
            </div>
          ) : null}
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[1040px] text-left text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 font-medium">Code</th>
                    <th className="px-3 py-2 font-medium">Start</th>
                    <th className="px-3 py-2 font-medium">End</th>
                    <th className="px-3 py-2 font-medium">Due</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-mono text-xs">{row.cycleCode}</td>
                      <td className="px-3 py-2">{row.startDate}</td>
                      <td className="px-3 py-2">{row.endDate}</td>
                      <td className="px-3 py-2">{row.dueDate}</td>
                      <td className="px-3 py-2">{row.status}</td>
                      <td className="px-3 py-2 text-right">
                        {isAdmin ? (
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                              Edit
                            </Button>
                            {row.status !== "closed" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSettleRow(row);
                                  setActionReason("");
                                }}
                              >
                                Settle
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setReopenRow(row);
                                  setActionReason("");
                                }}
                              >
                                Reopen
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive"
                              onClick={() => setDeleteRow(row)}
                            >
                              Delete
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
                        No billing cycles
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
            <DialogTitle>New billing cycle</DialogTitle>
            <DialogDescription>Dates use YYYY-MM-DD. Code is stored uppercase.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Cycle code</Label>
              <Input value={formCode} onChange={(e) => setFormCode(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input type="date" value={formStart} onChange={(e) => setFormStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End date</Label>
              <Input type="date" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input type="date" value={formDue} onChange={(e) => setFormDue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value)}
              >
                <option value="draft">draft</option>
                <option value="open">open</option>
                <option value="closed">closed</option>
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
                !formCode.trim() ||
                !formStart ||
                !formEnd ||
                !formDue ||
                !formStatus
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
            <DialogTitle>Edit billing cycle</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Cycle code</Label>
              <Input value={formCode} onChange={(e) => setFormCode(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input type="date" value={formStart} onChange={(e) => setFormStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End date</Label>
              <Input type="date" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input type="date" value={formDue} onChange={(e) => setFormDue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value)}
              >
                <option value="draft">draft</option>
                <option value="open">open</option>
                <option value="closed">closed</option>
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditRow(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={
                saving ||
                !formCode.trim() ||
                !formStart ||
                !formEnd ||
                !formDue ||
                !formStatus
              }
              onClick={() => void submitEdit()}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteRow} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete billing cycle</DialogTitle>
            <DialogDescription>
              Cannot delete if transactions, balances, or payments reference this cycle.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteRow(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={saving || !deleteRow}
              onClick={() => void submitDelete()}
            >
              {saving ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!settleRow} onOpenChange={(o) => !o && setSettleRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settle billing cycle</DialogTitle>
            <DialogDescription>
              This recalculates balances for the cycle and marks it as closed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <Input
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="Month-end settlement"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSettleRow(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={saving || !settleRow}
              onClick={() => void submitSettle()}
            >
              {saving ? "Settling…" : "Settle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reopenRow} onOpenChange={(o) => !o && setReopenRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen billing cycle</DialogTitle>
            <DialogDescription>
              This sets status back to open and allows new updates.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <Input
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="Post-close correction"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReopenRow(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={saving || !reopenRow}
              onClick={() => void submitReopen()}
            >
              {saving ? "Reopening…" : "Reopen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
