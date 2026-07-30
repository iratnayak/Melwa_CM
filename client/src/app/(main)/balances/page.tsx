"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { useMe } from "@/context/me-context";
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

type BalanceRow = {
  id: number;
  employeeId: number;
  billingCycleId: number;
  openingBalance: string;
  totalCredit: string;
  totalPaid: string;
  closingBalance: string;
  carriedForwardBalance: string;
  advanceBalance: string;
  isOverdue: boolean;
  calculatedAt: string;
  employee: {
    id: number;
    employeeCode: string;
    fullName: string;
  };
  billingCycle: {
    id: number;
    cycleCode: string;
    startDate: string;
    dueDate: string;
    status: string;
  };
};

type BalanceListRes = { items: BalanceRow[]; total: number };
type EmployeeListRes = { items: EmployeeOption[]; total: number };
type BillingCycleListRes = { items: BillingCycleOption[]; total: number };

type RecalcMode = "employee_cycle" | "employee_all_cycles" | "cycle_all_employees";

const RECALC_MODES: Array<{ id: RecalcMode; label: string }> = [
  { id: "employee_cycle", label: "Single employee + cycle" },
  { id: "employee_all_cycles", label: "Single employee (all cycles)" },
  { id: "cycle_all_employees", label: "Single cycle (all employees)" },
];

export default function BalancesPage() {
  const me = useMe();
  const isAdmin = me.role === "admin";

  const [items, setItems] = useState<BalanceRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [cycles, setCycles] = useState<BillingCycleOption[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [employeeFilter, setEmployeeFilter] = useState("");
  const [cycleFilter, setCycleFilter] = useState("");
  const [overdueFilter, setOverdueFilter] = useState("");
  const [skip, setSkip] = useState(0);
  const [take, setTake] = useState(20);

  const [recalcOpen, setRecalcOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recalcMode, setRecalcMode] = useState<RecalcMode>("employee_cycle");
  const [recalcEmployeeId, setRecalcEmployeeId] = useState("");
  const [recalcBillingCycleId, setRecalcBillingCycleId] = useState("");
  const [recalcReason, setRecalcReason] = useState("");

  const loadOptions = useCallback(async () => {
    try {
      const [employeeRes, cycleRes] = await Promise.all([
        apiFetch<EmployeeListRes>("/employees?take=100&skip=0"),
        apiFetch<BillingCycleListRes>("/billing-cycles?take=100&skip=0"),
      ]);
      setEmployees(employeeRes.items);
      setCycles(cycleRes.items);
      if (!recalcEmployeeId && employeeRes.items[0]) {
        setRecalcEmployeeId(String(employeeRes.items[0].id));
      }
      if (!recalcBillingCycleId && cycleRes.items[0]) {
        setRecalcBillingCycleId(String(cycleRes.items[0].id));
      }
    } catch {
      // page can still function without options
    }
  }, [recalcBillingCycleId, recalcEmployeeId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (employeeFilter) params.set("employeeId", employeeFilter);
      if (cycleFilter) params.set("billingCycleId", cycleFilter);
      if (overdueFilter) params.set("isOverdue", overdueFilter);
      params.set("skip", String(skip));
      params.set("take", String(take));
      const data = await apiFetch<BalanceListRes>(`/balances?${params.toString()}`);
      setItems(data.items);
      setTotal(data.total);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Failed to load balances");
    } finally {
      setLoading(false);
    }
  }, [employeeFilter, cycleFilter, overdueFilter, skip, take]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitRecalculate() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const body: {
        mode: RecalcMode;
        employeeId?: number;
        billingCycleId?: number;
        reason?: string;
      } = { mode: recalcMode };
      if (recalcMode !== "cycle_all_employees") {
        body.employeeId = Number(recalcEmployeeId);
      }
      if (recalcMode !== "employee_all_cycles") {
        body.billingCycleId = Number(recalcBillingCycleId);
      }
      if (recalcReason.trim()) body.reason = recalcReason.trim();
      const res = await apiFetch<{ success: boolean; affectedRows: number; mode: string }>(
        "/balances/recalculate",
        { method: "POST", body: JSON.stringify(body) },
      );
      setSuccess(`Recalculation completed (${res.mode}) · affected rows: ${res.affectedRows}`);
      setRecalcOpen(false);
      await load();
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Recalculate failed");
    } finally {
      setSaving(false);
    }
  }

  const canSubmitRecalc = useMemo(() => {
    if (!isAdmin) return false;
    if (saving) return false;
    if (recalcMode !== "cycle_all_employees" && !recalcEmployeeId) return false;
    if (recalcMode !== "employee_all_cycles" && !recalcBillingCycleId) return false;
    return true;
  }, [isAdmin, saving, recalcMode, recalcEmployeeId, recalcBillingCycleId]);

  const pageMax = useMemo(() => Math.max(0, Math.ceil(total / take) - 1), [total, take]);
  const page = Math.floor(skip / take);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Balances</h1>
          <p className="text-sm text-muted-foreground">Total: {total}</p>
        </div>
        {isAdmin ? (
          <Button className="bg-red-600 hover:bg-red-700" onClick={() => setRecalcOpen(true)}>
            Recalculate balances
          </Button>
        ) : null}
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="space-y-1.5 sm:w-56">
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
            <div className="space-y-1.5 sm:w-56">
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
              <Label>Overdue</Label>
              <select
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={overdueFilter}
                onChange={(e) => {
                  setSkip(0);
                  setOverdueFilter(e.target.value);
                }}
              >
                <option value="">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
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
              <table className="w-full min-w-[1400px] text-left text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 font-medium">Employee</th>
                    <th className="px-3 py-2 font-medium">Cycle</th>
                    <th className="px-3 py-2 font-medium text-right">Opening</th>
                    <th className="px-3 py-2 font-medium text-right">Credit</th>
                    <th className="px-3 py-2 font-medium text-right">Paid</th>
                    <th className="px-3 py-2 font-medium text-right">Closing</th>
                    <th className="px-3 py-2 font-medium text-right">Carry fwd</th>
                    <th className="px-3 py-2 font-medium text-right">Advance</th>
                    <th className="px-3 py-2 font-medium">Overdue</th>
                    <th className="px-3 py-2 font-medium">Calculated</th>
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
                        <div className="text-xs font-mono">{row.billingCycle.cycleCode}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.billingCycle.startDate} → due {row.billingCycle.dueDate}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{row.openingBalance}</td>
                      <td className="px-3 py-2 text-right font-mono">{row.totalCredit}</td>
                      <td className="px-3 py-2 text-right font-mono">{row.totalPaid}</td>
                      <td className="px-3 py-2 text-right font-mono">{row.closingBalance}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {row.carriedForwardBalance}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{row.advanceBalance}</td>
                      <td className="px-3 py-2">
                        {row.isOverdue ? (
                          <span className="rounded bg-red-600/10 px-2 py-0.5 text-xs text-red-700 dark:text-red-400">
                            overdue
                          </span>
                        ) : (
                          <span className="text-muted-foreground">no</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(row.calculatedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">
                        No balances
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

      <Dialog open={recalcOpen} onOpenChange={setRecalcOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Recalculate balances</DialogTitle>
            <DialogDescription>
              Admin action. Choose scope and run recalculation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <select
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={recalcMode}
                onChange={(e) => setRecalcMode(e.target.value as RecalcMode)}
              >
                {RECALC_MODES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            {recalcMode !== "cycle_all_employees" ? (
              <div className="space-y-1.5">
                <Label>Employee</Label>
                <select
                  className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  value={recalcEmployeeId}
                  onChange={(e) => setRecalcEmployeeId(e.target.value)}
                >
                  <option value="">Select employee</option>
                  {employees.map((e) => (
                    <option key={e.id} value={String(e.id)}>
                      {e.employeeCode} — {e.fullName}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {recalcMode !== "employee_all_cycles" ? (
              <div className="space-y-1.5">
                <Label>Billing cycle</Label>
                <select
                  className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  value={recalcBillingCycleId}
                  onChange={(e) => setRecalcBillingCycleId(e.target.value)}
                >
                  <option value="">Select cycle</option>
                  {cycles.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.cycleCode} ({c.status})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Input
                value={recalcReason}
                onChange={(e) => setRecalcReason(e.target.value)}
                placeholder="Manual correction / settlement preparation"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRecalcOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={!canSubmitRecalc}
              onClick={() => void submitRecalculate()}
            >
              {saving ? "Running…" : "Run recalculate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

