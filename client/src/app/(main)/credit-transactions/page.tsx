"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMe } from "@/context/me-context";
import { ApiError, apiFetch } from "@/lib/api";
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
  isActive: boolean;
};

type BillingCycleOption = {
  id: number;
  cycleCode: string;
  status: "draft" | "open" | "closed" | string;
};

type CreditTransaction = {
  id: number;
  employeeId: number;
  billingCycleId: number;
  enteredByUserId: number;
  txnDate: string;
  description: string | null;
  amount: string;
  transactionType: "purchase" | "adjustment" | "reversal";
  createdAt: string;
  employee: {
    id: number;
    employeeCode: string;
    fullName: string;
  };
  billingCycle: {
    id: number;
    cycleCode: string;
    status: string;
  };
  enteredByUser: {
    id: number;
    name: string;
    email: string;
  };
};

type TxListRes = { items: CreditTransaction[]; total: number };
type EmployeeListRes = { items: EmployeeOption[]; total: number };
type BillingCycleListRes = { items: BillingCycleOption[]; total: number };

const TX_TYPES = ["", "purchase", "adjustment", "reversal"] as const;

export default function CreditTransactionsPage() {
  const me = useMe();
  const isAdmin = me.role === "admin";

  const [items, setItems] = useState<CreditTransaction[]>([]);
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
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [fromDateInput, setFromDateInput] = useState("");
  const [toDateInput, setToDateInput] = useState("");
  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");
  const [skip, setSkip] = useState(0);
  const [take, setTake] = useState(20);

  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<CreditTransaction | null>(null);
  const [deleteRow, setDeleteRow] = useState<CreditTransaction | null>(null);
  const [saving, setSaving] = useState(false);

  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formCycleId, setFormCycleId] = useState("");
  const [formTxnDate, setFormTxnDate] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formType, setFormType] = useState<"purchase" | "adjustment" | "reversal">(
    "purchase",
  );
  const [formDescription, setFormDescription] = useState("");
  const [formSourceReference, setFormSourceReference] = useState("");

  const loadOptions = useCallback(async () => {
    try {
      const [employeeRes, cycleRes] = await Promise.all([
        apiFetch<EmployeeListRes>("/employees?take=100&skip=0"),
        apiFetch<BillingCycleListRes>("/billing-cycles?take=100&skip=0"),
      ]);
      setEmployees(employeeRes.items);
      setCycles(cycleRes.items);
    } catch {
      // Lists can still load even if dropdown options fail.
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
      if (typeFilter) params.set("transactionType", typeFilter);
      if (appliedFromDate) params.set("fromDate", appliedFromDate);
      if (appliedToDate) params.set("toDate", appliedToDate);
      params.set("skip", String(skip));
      params.set("take", String(take));
      const data = await apiFetch<TxListRes>(`/credit-transactions?${params.toString()}`);
      setItems(data.items);
      setTotal(data.total);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Failed to load credit transactions");
    } finally {
      setLoading(false);
    }
  }, [appliedQ, employeeFilter, cycleFilter, typeFilter, appliedFromDate, appliedToDate, skip, take]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setFormEmployeeId(employees[0] ? String(employees[0].id) : "");
    setFormCycleId(cycles[0] ? String(cycles[0].id) : "");
    setFormTxnDate("");
    setFormAmount("");
    setFormType("purchase");
    setFormDescription("");
    setFormSourceReference("");
  }

  function openCreate() {
    resetForm();
    setCreateOpen(true);
  }

  function openEdit(row: CreditTransaction) {
    setFormEmployeeId(String(row.employeeId));
    setFormCycleId(String(row.billingCycleId));
    setFormTxnDate(row.txnDate);
    setFormAmount(String(row.amount));
    setFormType(row.transactionType);
    setFormDescription(row.description ?? "");
    const refMatch = (row.description ?? "").match(/ref:([^\s|]+)$/);
    setFormSourceReference(refMatch?.[1] ?? "");
    setEditRow(row);
  }

  function formPayload() {
    return {
      employeeId: Number(formEmployeeId),
      billingCycleId: Number(formCycleId),
      txnDate: formTxnDate,
      amount: Number(formAmount),
      transactionType: formType,
      ...(formDescription.trim() ? { description: formDescription.trim() } : {}),
      ...(formType === "reversal" && formSourceReference.trim()
        ? { sourceReference: formSourceReference.trim() }
        : {}),
    };
  }

  async function submitCreate() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch("/credit-transactions", {
        method: "POST",
        body: JSON.stringify(formPayload()),
      });
      setCreateOpen(false);
      setSuccess("Credit transaction created.");
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
      await apiFetch(`/credit-transactions/${editRow.id}`, {
        method: "PATCH",
        body: JSON.stringify(formPayload()),
      });
      setEditRow(null);
      setSuccess("Credit transaction updated.");
      await load();
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Update failed");
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
      await apiFetch(`/credit-transactions/${deleteRow.id}`, { method: "DELETE" });
      setDeleteRow(null);
      setSuccess("Credit transaction deleted.");
      await load();
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  const canSubmitForm =
    !saving &&
    formEmployeeId &&
    formCycleId &&
    formTxnDate &&
    formAmount.trim() &&
    Number(formAmount) >= 0 &&
    (formType !== "reversal" || formSourceReference.trim().length > 0);

  const pageMax = useMemo(() => Math.max(0, Math.ceil(total / take) - 1), [total, take]);
  const page = Math.floor(skip / take);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Credit transactions</h1>
          <p className="text-sm text-muted-foreground">Total: {total}</p>
        </div>
        {isAdmin ? (
          <Button className="bg-red-600 hover:bg-red-700" onClick={openCreate}>
            New transaction
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
                placeholder="Description/employee"
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

            <div className="space-y-1.5 sm:w-40">
              <Label>Type</Label>
              <select
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={typeFilter}
                onChange={(e) => {
                  setSkip(0);
                  setTypeFilter(e.target.value);
                }}
              >
                {TX_TYPES.map((t) => (
                  <option key={t || "all"} value={t}>
                    {t || "All"}
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
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 font-medium">Employee</th>
                    <th className="px-3 py-2 font-medium">Cycle</th>
                    <th className="px-3 py-2 font-medium">Txn date</th>
                    <th className="px-3 py-2 font-medium text-right">Amount</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Description</th>
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
                        <div className="font-mono text-xs">{row.billingCycle.cycleCode}</div>
                        <div className="text-xs text-muted-foreground">{row.billingCycle.status}</div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.txnDate}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {Number(row.amount).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-2">{row.transactionType}</td>
                      <td className="px-3 py-2 max-w-[360px] truncate">{row.description ?? "—"}</td>
                      <td className="px-3 py-2">
                        <div>{row.enteredByUser.name}</div>
                        <div className="text-xs text-muted-foreground">{row.enteredByUser.email}</div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          {isAdmin ? (
                            <>
                              <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive"
                                onClick={() => setDeleteRow(row)}
                              >
                                Delete
                              </Button>
                              <Link
                                href="/audit?entityName=credit_transactions"
                                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                              >
                                Audit
                              </Link>
                            </>
                          ) : (
                            <>
                              <Link
                                href="/audit?entityName=credit_transactions"
                                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                              >
                                Audit
                              </Link>
                              <span className="px-2 py-1 text-muted-foreground">—</span>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                        No credit transactions
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
            <DialogTitle>New credit transaction</DialogTitle>
            <DialogDescription>
              Reversal type requires source reference.
            </DialogDescription>
          </DialogHeader>
          <TxForm
            employees={employees}
            cycles={cycles}
            formEmployeeId={formEmployeeId}
            setFormEmployeeId={setFormEmployeeId}
            formCycleId={formCycleId}
            setFormCycleId={setFormCycleId}
            formTxnDate={formTxnDate}
            setFormTxnDate={setFormTxnDate}
            formAmount={formAmount}
            setFormAmount={setFormAmount}
            formType={formType}
            setFormType={setFormType}
            formDescription={formDescription}
            setFormDescription={setFormDescription}
            formSourceReference={formSourceReference}
            setFormSourceReference={setFormSourceReference}
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
            <DialogTitle>Edit credit transaction</DialogTitle>
          </DialogHeader>
          <TxForm
            employees={employees}
            cycles={cycles}
            formEmployeeId={formEmployeeId}
            setFormEmployeeId={setFormEmployeeId}
            formCycleId={formCycleId}
            setFormCycleId={setFormCycleId}
            formTxnDate={formTxnDate}
            setFormTxnDate={setFormTxnDate}
            formAmount={formAmount}
            setFormAmount={setFormAmount}
            formType={formType}
            setFormType={setFormType}
            formDescription={formDescription}
            setFormDescription={setFormDescription}
            formSourceReference={formSourceReference}
            setFormSourceReference={setFormSourceReference}
          />
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

      <Dialog open={!!deleteRow} onOpenChange={(open) => !open && setDeleteRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete credit transaction</DialogTitle>
            <DialogDescription>
              This can fail if the billing cycle is closed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteRow(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={saving || !deleteRow} onClick={() => void submitDelete()}>
              {saving ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TxForm(props: {
  employees: EmployeeOption[];
  cycles: BillingCycleOption[];
  formEmployeeId: string;
  setFormEmployeeId: (v: string) => void;
  formCycleId: string;
  setFormCycleId: (v: string) => void;
  formTxnDate: string;
  setFormTxnDate: (v: string) => void;
  formAmount: string;
  setFormAmount: (v: string) => void;
  formType: "purchase" | "adjustment" | "reversal";
  setFormType: (v: "purchase" | "adjustment" | "reversal") => void;
  formDescription: string;
  setFormDescription: (v: string) => void;
  formSourceReference: string;
  setFormSourceReference: (v: string) => void;
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
              {e.employeeCode} — {e.fullName} {e.isActive ? "" : "(inactive)"}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>Billing cycle</Label>
        <select
          className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
          value={props.formCycleId}
          onChange={(e) => props.setFormCycleId(e.target.value)}
        >
          <option value="">Select cycle</option>
          {props.cycles.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.cycleCode} ({c.status})
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>Transaction date</Label>
        <Input
          type="date"
          value={props.formTxnDate}
          onChange={(e) => props.setFormTxnDate(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Amount</Label>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={props.formAmount}
          onChange={(e) => props.setFormAmount(e.target.value)}
          placeholder="0.00"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Type</Label>
        <select
          className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
          value={props.formType}
          onChange={(e) =>
            props.setFormType(e.target.value as "purchase" | "adjustment" | "reversal")
          }
        >
          <option value="purchase">purchase</option>
          <option value="adjustment">adjustment</option>
          <option value="reversal">reversal</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>Source reference {props.formType === "reversal" ? "(required)" : "(optional)"}</Label>
        <Input
          value={props.formSourceReference}
          onChange={(e) => props.setFormSourceReference(e.target.value)}
          placeholder="INV-123 / TX-456"
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Description</Label>
        <Input
          value={props.formDescription}
          onChange={(e) => props.setFormDescription(e.target.value)}
          placeholder="Optional note"
        />
      </div>
    </div>
  );
}
