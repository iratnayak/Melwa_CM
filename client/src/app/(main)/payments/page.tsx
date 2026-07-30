"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { useMe } from "@/context/me-context";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type EmployeeOption = {
  id: number;
  employeeCode: string;
  fullName: string;
};

type BillingCycleOption = {
  id: number;
  cycleCode: string;
  status: string;
};

function cycleLabel(
  cycles: BillingCycleOption[],
  id: number | null | undefined,
): string {
  if (id == null) return "—";
  const c = cycles.find((x) => x.id === id);
  return c ? `${c.cycleCode} (${c.status})` : `#${id}`;
}

type Payment = {
  id: number;
  employeeId: number;
  billingCycleId: number | null;
  advanceAppliedBillingCycleId: number | null;
  receivedByUserId: number;
  paymentDate: string;
  amount: string;
  method: string;
  referenceNo: string | null;
  status: "recorded" | "allocated" | "partially_allocated" | "reversed";
  allocatedAmount: string;
  allocatedAt: string | null;
  reversedAt: string | null;
  reversalReason: string | null;
  createdAt: string;
  updatedAt: string;
  employee: {
    id: number;
    employeeCode: string;
    fullName: string;
  };
  billingCycle: {
    id: number;
    cycleCode: string;
    status: string;
  } | null;
  receivedByUser: {
    id: number;
    name: string;
    email: string;
  };
};

type PaymentAllocation = {
  id: number;
  paymentId: number;
  employeeId: number;
  billingCycleId: number;
  allocatedAmount: string;
  createdAt: string;
  billingCycle: {
    id: number;
    cycleCode: string;
    status: string;
  };
};

type PaymentListRes = { items: Payment[]; total: number };
type PaymentGetRes = Payment & { allocations: PaymentAllocation[] };
type PaymentAllocateRes = {
  payment: Payment;
  allocations: PaymentAllocation[];
  leftoverAppliedAsAdvance: string;
  advanceBillingCycleId: number | null;
  dryRun: boolean;
};
type EmployeeListRes = { items: EmployeeOption[]; total: number };
type BillingCycleListRes = { items: BillingCycleOption[]; total: number };

const PAYMENT_STATUSES = ["", "recorded", "allocated", "partially_allocated", "reversed"] as const;

export default function PaymentsPage() {
  const me = useMe();
  const isAdmin = me.role === "admin";

  const [items, setItems] = useState<Payment[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [cycles, setCycles] = useState<BillingCycleOption[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [qInput, setQInput] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [cycleFilter, setCycleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [fromDateInput, setFromDateInput] = useState("");
  const [toDateInput, setToDateInput] = useState("");
  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");
  const [skip, setSkip] = useState(0);
  const [take, setTake] = useState(20);

  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<Payment | null>(null);
  const [allocateRow, setAllocateRow] = useState<Payment | null>(null);
  const [allocatePreview, setAllocatePreview] = useState<PaymentAllocateRes | null>(null);
  const [reverseRow, setReverseRow] = useState<Payment | null>(null);
  const [saving, setSaving] = useState(false);

  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formBillingCycleId, setFormBillingCycleId] = useState("");
  const [formPaymentDate, setFormPaymentDate] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formMethod, setFormMethod] = useState("");
  const [formReferenceNo, setFormReferenceNo] = useState("");
  const [formReversalReason, setFormReversalReason] = useState("");

  const loadOptions = useCallback(async () => {
    try {
      const [employeeRes, cycleRes] = await Promise.all([
        apiFetch<EmployeeListRes>("/employees?take=100&skip=0"),
        apiFetch<BillingCycleListRes>("/billing-cycles?take=100&skip=0"),
      ]);
      setEmployees(employeeRes.items);
      setCycles(cycleRes.items);
    } catch {
      // still allow list loading
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (appliedQ.trim()) params.set("q", appliedQ.trim());
      if (employeeFilter) params.set("employeeId", employeeFilter);
      if (cycleFilter) params.set("billingCycleId", cycleFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (appliedFromDate) params.set("fromDate", appliedFromDate);
      if (appliedToDate) params.set("toDate", appliedToDate);
      params.set("skip", String(skip));
      params.set("take", String(take));
      const data = await apiFetch<PaymentListRes>(`/payments?${params.toString()}`);
      setItems(data.items);
      setTotal(data.total);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, [appliedQ, employeeFilter, cycleFilter, statusFilter, appliedFromDate, appliedToDate, skip, take]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setFormEmployeeId(employees[0] ? String(employees[0].id) : "");
    setFormBillingCycleId("");
    setFormPaymentDate("");
    setFormAmount("");
    setFormMethod("");
    setFormReferenceNo("");
    setFormReversalReason("");
  }

  function openCreate() {
    resetForm();
    setCreateOpen(true);
  }

  async function openEdit(row: Payment) {
    setFormEmployeeId(String(row.employeeId));
    setFormBillingCycleId(row.billingCycleId ? String(row.billingCycleId) : "");
    setFormPaymentDate(row.paymentDate);
    setFormAmount(String(row.amount));
    setFormMethod(row.method);
    setFormReferenceNo(row.referenceNo ?? "");
    setEditRow(row);
  }

  async function submitCreate() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch("/payments", {
        method: "POST",
        body: JSON.stringify({
          employeeId: Number(formEmployeeId),
          ...(formBillingCycleId ? { billingCycleId: Number(formBillingCycleId) } : {}),
          paymentDate: formPaymentDate,
          amount: Number(formAmount),
          method: formMethod,
          ...(formReferenceNo.trim() ? { referenceNo: formReferenceNo.trim() } : {}),
        }),
      });
      setCreateOpen(false);
      setSuccess("Payment recorded.");
      await load();
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Create failed");
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
      await apiFetch(`/payments/${editRow.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          employeeId: Number(formEmployeeId),
          ...(formBillingCycleId ? { billingCycleId: Number(formBillingCycleId) } : {}),
          paymentDate: formPaymentDate,
          amount: Number(formAmount),
          method: formMethod,
          referenceNo: formReferenceNo,
        }),
      });
      setEditRow(null);
      setSuccess("Payment updated.");
      await load();
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function openAllocate(row: Payment) {
    setAllocateRow(row);
    setAllocatePreview(null);
    setError(null);
    try {
      const preview = await apiFetch<PaymentAllocateRes>(`/payments/${row.id}/allocate`, {
        method: "POST",
        body: JSON.stringify({ dryRun: true }),
      });
      setAllocatePreview(preview);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Preview failed");
    }
  }

  async function submitAllocate() {
    if (!allocateRow) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch<PaymentAllocateRes>(`/payments/${allocateRow.id}/allocate`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setAllocateRow(null);
      setAllocatePreview(null);
      setSuccess("Payment allocated.");
      await load();
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Allocation failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitReverse() {
    if (!reverseRow) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/payments/${reverseRow.id}/reverse`, {
        method: "POST",
        body: JSON.stringify({
          ...(formReversalReason.trim() ? { reason: formReversalReason.trim() } : {}),
        }),
      });
      setReverseRow(null);
      setFormReversalReason("");
      setSuccess("Payment reversed.");
      await load();
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Reverse failed");
    } finally {
      setSaving(false);
    }
  }

  const pageMax = useMemo(() => Math.max(0, Math.ceil(total / take) - 1), [total, take]);
  const page = Math.floor(skip / take);

  const canSubmitForm =
    !saving &&
    formEmployeeId &&
    formPaymentDate &&
    formMethod.trim().length > 0 &&
    formAmount.trim().length > 0 &&
    Number(formAmount) > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
          <p className="text-sm text-muted-foreground">Total: {total}</p>
        </div>
        {isAdmin ? (
          <Button className="bg-red-600 hover:bg-red-700" onClick={openCreate}>
            Record payment
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
                placeholder="method/reference/employee"
              />
            </div>
            <div className="space-y-1.5 sm:w-48">
              <Label>Employee</Label>
              <select
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={employeeFilter}
                onChange={(e) => {
                  setSkip(0);
                  setEmployeeFilter(e.target.value);
                }}
              >
                <option value="">All</option>
                {employees.map((e) => (
                  <option key={e.id} value={String(e.id)}>
                    {e.employeeCode} — {e.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:w-48">
              <Label>Billing cycle</Label>
              <select
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={cycleFilter}
                onChange={(e) => {
                  setSkip(0);
                  setCycleFilter(e.target.value);
                }}
              >
                <option value="">All</option>
                {cycles.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.cycleCode} ({c.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:w-44">
              <Label>Status</Label>
              <select
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={statusFilter}
                onChange={(e) => {
                  setSkip(0);
                  setStatusFilter(e.target.value);
                }}
              >
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s || "all"} value={s}>
                    {s || "All"}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:w-40">
              <Label>From</Label>
              <Input
                type="date"
                value={fromDateInput}
                onChange={(e) => setFromDateInput(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:w-40">
              <Label>To</Label>
              <Input
                type="date"
                value={toDateInput}
                onChange={(e) => setToDateInput(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:w-28">
              <Label>Page size</Label>
              <select
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={String(take)}
                onChange={(e) => {
                  setSkip(0);
                  setTake(Number(e.target.value));
                }}
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setSkip(0);
                setAppliedQ(qInput);
                setAppliedFromDate(fromDateInput);
                setAppliedToDate(toDateInput);
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
              <table className="w-full min-w-[1480px] text-left text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 font-medium">Employee</th>
                    <th className="px-3 py-2 font-medium">Cycle</th>
                    <th className="px-3 py-2 font-medium">Advance to cycle</th>
                    <th className="px-3 py-2 font-medium">Payment date</th>
                    <th className="px-3 py-2 font-medium text-right">Amount</th>
                    <th className="px-3 py-2 font-medium text-right">Allocated</th>
                    <th className="px-3 py-2 font-medium">Method</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Entered by</th>
                    <th className="px-3 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <div className="text-xs font-mono">{row.employee.employeeCode}</div>
                        <div>{row.employee.fullName}</div>
                      </td>
                      <td className="px-3 py-2">
                        {row.billingCycle ? (
                          <>
                            <div className="font-mono text-xs">{row.billingCycle.cycleCode}</div>
                            <div className="text-xs text-muted-foreground">{row.billingCycle.status}</div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Auto/FIFO</span>
                        )}
                      </td>
                      <td className="px-3 py-2 max-w-[200px]">
                        {row.advanceAppliedBillingCycleId != null ? (
                          <>
                            <div className="font-mono text-xs">
                              {cycleLabel(cycles, row.advanceAppliedBillingCycleId)}
                            </div>
                            <div className="text-[11px] text-muted-foreground leading-tight">
                              Overpayment stored as advance on this cycle (reversal uses this).
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.paymentDate}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {Number(row.amount).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {Number(row.allocatedAmount).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-2">
                        <div>{row.method}</div>
                        <div className="text-xs text-muted-foreground">{row.referenceNo ?? "—"}</div>
                      </td>
                      <td className="px-3 py-2">{row.status}</td>
                      <td className="px-3 py-2">
                        <div>{row.receivedByUser.name}</div>
                        <div className="text-xs text-muted-foreground">{row.receivedByUser.email}</div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          {isAdmin ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void openEdit(row)}
                                disabled={row.status === "reversed"}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void openAllocate(row)}
                                disabled={row.status === "reversed"}
                              >
                                Allocate
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive"
                                onClick={() => setReverseRow(row)}
                                disabled={row.status === "reversed"}
                              >
                                Reverse
                              </Button>
                            </>
                          ) : null}
                          <Link
                            href="/audit?entityName=payments"
                            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                          >
                            Audit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">
                        No payments
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
            <DialogTitle>Record payment</DialogTitle>
          </DialogHeader>
          <PaymentForm
            employees={employees}
            cycles={cycles}
            formEmployeeId={formEmployeeId}
            setFormEmployeeId={setFormEmployeeId}
            formBillingCycleId={formBillingCycleId}
            setFormBillingCycleId={setFormBillingCycleId}
            formPaymentDate={formPaymentDate}
            setFormPaymentDate={setFormPaymentDate}
            formAmount={formAmount}
            setFormAmount={setFormAmount}
            formMethod={formMethod}
            setFormMethod={setFormMethod}
            formReferenceNo={formReferenceNo}
            setFormReferenceNo={setFormReferenceNo}
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={!canSubmitForm}
              onClick={() => void submitCreate()}
            >
              {saving ? "Saving…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit payment</DialogTitle>
          </DialogHeader>
          <PaymentForm
            employees={employees}
            cycles={cycles}
            formEmployeeId={formEmployeeId}
            setFormEmployeeId={setFormEmployeeId}
            formBillingCycleId={formBillingCycleId}
            setFormBillingCycleId={setFormBillingCycleId}
            formPaymentDate={formPaymentDate}
            setFormPaymentDate={setFormPaymentDate}
            formAmount={formAmount}
            setFormAmount={setFormAmount}
            formMethod={formMethod}
            setFormMethod={setFormMethod}
            formReferenceNo={formReferenceNo}
            setFormReferenceNo={setFormReferenceNo}
          />
          {editRow &&
          (editRow.status === "allocated" || editRow.status === "partially_allocated") &&
          editRow.advanceAppliedBillingCycleId != null ? (
            <p className="text-xs text-muted-foreground">
              Advance recorded on:{" "}
              <span className="font-mono">{cycleLabel(cycles, editRow.advanceAppliedBillingCycleId)}</span>
              . Cycle/amount changes are blocked after allocation.
            </p>
          ) : null}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditRow(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={!canSubmitForm}
              onClick={() => void submitEdit()}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!allocateRow} onOpenChange={(open) => !open && setAllocateRow(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Allocate payment</DialogTitle>
            <DialogDescription>
              FIFO preview shown below. Continue to apply allocation.
            </DialogDescription>
          </DialogHeader>
          {allocatePreview ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border px-3 py-2 space-y-1">
                <div>
                  Leftover applied as advance:{" "}
                  <span className="font-mono">{allocatePreview.leftoverAppliedAsAdvance}</span>
                </div>
                <div>
                  Target cycle for advance:{" "}
                  <span className="font-medium">
                    {Number(allocatePreview.leftoverAppliedAsAdvance) > 0
                      ? cycleLabel(cycles, allocatePreview.advanceBillingCycleId)
                      : "—"}
                  </span>
                </div>
                {Number(allocatePreview.leftoverAppliedAsAdvance) > 0 &&
                allocatePreview.advanceBillingCycleId == null ? (
                  <p className="text-xs text-amber-700 dark:text-amber-500">
                    No open/draft billing cycle found — leftover may remain unapplied until you run
                    allocate again.
                  </p>
                ) : null}
              </div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className="px-3 py-2 font-medium">Cycle</th>
                      <th className="px-3 py-2 font-medium text-right">Allocated amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocatePreview.allocations.map((a) => (
                      <tr key={a.id} className="border-b last:border-0">
                        <td className="px-3 py-2">{cycleLabel(cycles, a.billingCycleId)}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {Number(a.allocatedAmount).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                    {allocatePreview.allocations.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-3 py-4 text-center text-muted-foreground">
                          No cycle allocations in preview.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Loading preview…</div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setAllocateRow(null);
                setAllocatePreview(null);
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={saving || !allocateRow}
              onClick={() => void submitAllocate()}
            >
              {saving ? "Saving…" : "Apply allocation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reverseRow} onOpenChange={(open) => !open && setReverseRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse payment</DialogTitle>
            <DialogDescription>Full reversal only.</DialogDescription>
          </DialogHeader>
          {reverseRow ? (
            <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground space-y-1">
              <div>
                Payment amount:{" "}
                <span className="font-mono text-foreground">{reverseRow.amount}</span> · Allocated:{" "}
                <span className="font-mono text-foreground">{reverseRow.allocatedAmount}</span>
              </div>
              <div>
                Advance rollback cycle:{" "}
                <span className="font-medium text-foreground">
                  {cycleLabel(
                    cycles,
                    reverseRow.advanceAppliedBillingCycleId ?? reverseRow.billingCycleId,
                  )}
                </span>
              </div>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <Input
              value={formReversalReason}
              onChange={(e) => setFormReversalReason(e.target.value)}
              placeholder="Reason for reversal"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setReverseRow(null);
                setFormReversalReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={saving || !reverseRow}
              onClick={() => void submitReverse()}
            >
              {saving ? "Saving…" : "Reverse"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentForm(props: {
  employees: EmployeeOption[];
  cycles: BillingCycleOption[];
  formEmployeeId: string;
  setFormEmployeeId: (v: string) => void;
  formBillingCycleId: string;
  setFormBillingCycleId: (v: string) => void;
  formPaymentDate: string;
  setFormPaymentDate: (v: string) => void;
  formAmount: string;
  setFormAmount: (v: string) => void;
  formMethod: string;
  setFormMethod: (v: string) => void;
  formReferenceNo: string;
  setFormReferenceNo: (v: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>Employee</Label>
        <select
          className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
          value={props.formEmployeeId}
          onChange={(e) => props.setFormEmployeeId(e.target.value)}
        >
          <option value="">Select employee</option>
          {props.employees.map((e) => (
            <option key={e.id} value={String(e.id)}>
              {e.employeeCode} — {e.fullName}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>Billing cycle (optional)</Label>
        <select
          className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
          value={props.formBillingCycleId}
          onChange={(e) => props.setFormBillingCycleId(e.target.value)}
        >
          <option value="">Auto/FIFO</option>
          {props.cycles.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.cycleCode} ({c.status})
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>Payment date</Label>
        <Input
          type="date"
          value={props.formPaymentDate}
          onChange={(e) => props.setFormPaymentDate(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Amount</Label>
        <Input
          type="number"
          min="0.01"
          step="0.01"
          value={props.formAmount}
          onChange={(e) => props.setFormAmount(e.target.value)}
          placeholder="0.00"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Method</Label>
        <Input
          value={props.formMethod}
          onChange={(e) => props.setFormMethod(e.target.value)}
          placeholder="cash / bank_transfer / cheque"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Reference no (optional)</Label>
        <Input
          value={props.formReferenceNo}
          onChange={(e) => props.setFormReferenceNo(e.target.value)}
          placeholder="Bank slip / cheque no"
        />
      </div>
    </div>
  );
}
