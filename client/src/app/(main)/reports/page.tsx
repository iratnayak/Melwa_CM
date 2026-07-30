"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE, ApiError, apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type EmployeeOption = { id: number; employeeCode: string; fullName: string };
type BillingCycleOption = { id: number; cycleCode: string; status: string };
type UserOption = { id: number; name: string; email: string };

type TabId = "ledger" | "cycle" | "aging" | "collections" | "outstanding";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "ledger", label: "Ledger" },
  { id: "cycle", label: "Cycle statement" },
  { id: "aging", label: "Aging" },
  { id: "collections", label: "Collections" },
  { id: "outstanding", label: "Outstanding" },
];

async function downloadCsv(path: string, filename: string) {
  const token = localStorage.getItem("accessToken");
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`CSV export failed (${res.status})`);
  const text = await res.text();
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [tab, setTab] = useState<TabId>("ledger");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [cycles, setCycles] = useState<BillingCycleOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [ledgerEmployeeId, setLedgerEmployeeId] = useState("");
  const [ledgerFromDate, setLedgerFromDate] = useState("");
  const [ledgerToDate, setLedgerToDate] = useState("");
  const [ledgerResult, setLedgerResult] = useState<{
    openingBalance: string;
    closingBalance: string;
    entries: Array<{
      date: string;
      type: string;
      reference: string;
      description: string;
      deltaAmount: string;
      runningBalance: string;
    }>;
  } | null>(null);

  const [cycleBillingCycleId, setCycleBillingCycleId] = useState("");
  const [cycleResult, setCycleResult] = useState<{ items: Array<Record<string, unknown>>; total: number } | null>(null);

  const [agingAsOfDate, setAgingAsOfDate] = useState("");
  const [agingResult, setAgingResult] = useState<Array<Record<string, unknown>>>([]);

  const [collectionsFromDate, setCollectionsFromDate] = useState("");
  const [collectionsToDate, setCollectionsToDate] = useState("");
  const [collectionsMethod, setCollectionsMethod] = useState("");
  const [collectionsUserId, setCollectionsUserId] = useState("");
  const [collectionsResult, setCollectionsResult] = useState<Array<Record<string, unknown>>>([]);

  const [outstandingGroupBy, setOutstandingGroupBy] = useState<"employee" | "department">("employee");
  const [outstandingResult, setOutstandingResult] = useState<Array<Record<string, unknown>>>([]);

  const loadOptions = useCallback(async () => {
    try {
      const [employeeRes, cycleRes] = await Promise.all([
        apiFetch<{ items: EmployeeOption[] }>("/employees?take=100&skip=0"),
        apiFetch<{ items: BillingCycleOption[] }>("/billing-cycles?take=100&skip=0"),
      ]);
      setEmployees(employeeRes.items);
      setCycles(cycleRes.items);
      if (!ledgerEmployeeId && employeeRes.items[0]) {
        setLedgerEmployeeId(String(employeeRes.items[0].id));
      }
      if (!cycleBillingCycleId && cycleRes.items[0]) {
        setCycleBillingCycleId(String(cycleRes.items[0].id));
      }
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Failed to load report filters");
    }

    try {
      const userRes = await apiFetch<{ items: UserOption[] }>("/users?take=100&skip=0");
      setUsers(userRes.items);
      if (!collectionsUserId && userRes.items[0]) {
        setCollectionsUserId(String(userRes.items[0].id));
      }
    } catch {
      // Users list is admin-only and only needed for collections filter.
    }
  }, [ledgerEmployeeId, cycleBillingCycleId, collectionsUserId]);

  useEffect(() => {
    void loadOptions();
    const today = new Date().toISOString().slice(0, 10);
    setLedgerFromDate(today);
    setLedgerToDate(today);
    setAgingAsOfDate(today);
    setCollectionsFromDate(today);
    setCollectionsToDate(today);
  }, [loadOptions]);

  const runLedger = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{
        openingBalance: string;
        closingBalance: string;
        entries: Array<{
          date: string;
          type: string;
          reference: string;
          description: string;
          deltaAmount: string;
          runningBalance: string;
        }>;
      }>(`/reports/ledger?employeeId=${ledgerEmployeeId}&fromDate=${ledgerFromDate}&toDate=${ledgerToDate}`);
      setLedgerResult(res);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Failed to load ledger");
    } finally {
      setLoading(false);
    }
  };

  const runCycleStatement = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ items: Array<Record<string, unknown>>; total: number }>(
        `/reports/cycle-statement?billingCycleId=${cycleBillingCycleId}`,
      );
      setCycleResult(res);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Failed to load cycle statement");
    } finally {
      setLoading(false);
    }
  };

  const runAging = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ items: Array<Record<string, unknown>> }>(
        `/reports/aging?asOfDate=${agingAsOfDate}`,
      );
      setAgingResult(res.items);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Failed to load aging");
    } finally {
      setLoading(false);
    }
  };

  const runCollections = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        fromDate: collectionsFromDate,
        toDate: collectionsToDate,
      });
      if (collectionsMethod.trim()) params.set("method", collectionsMethod.trim());
      if (collectionsUserId) params.set("receivedByUserId", collectionsUserId);
      const res = await apiFetch<{ items: Array<Record<string, unknown>> }>(
        `/reports/collections?${params.toString()}`,
      );
      setCollectionsResult(res.items);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Failed to load collections");
    } finally {
      setLoading(false);
    }
  };

  const runOutstanding = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ items: Array<Record<string, unknown>> }>(
        `/reports/outstanding?groupBy=${outstandingGroupBy}`,
      );
      setOutstandingResult(res.items);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Failed to load outstanding");
    } finally {
      setLoading(false);
    }
  };

  const activeRows = useMemo(() => {
    if (tab === "ledger") return ledgerResult?.entries ?? [];
    if (tab === "cycle") return cycleResult?.items ?? [];
    if (tab === "aging") return agingResult;
    if (tab === "collections") return collectionsResult;
    return outstandingResult;
  }, [tab, ledgerResult, cycleResult, agingResult, collectionsResult, outstandingResult]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">Ledger and summary reports with CSV export</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button
            key={t.id}
            variant={tab === t.id ? "default" : "outline"}
            className={cn(tab === t.id ? "bg-red-600 hover:bg-red-700" : "")}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3 space-y-3">
          {tab === "ledger" ? (
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Employee</Label>
                <select className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={ledgerEmployeeId} onChange={(e) => setLedgerEmployeeId(e.target.value)}>
                  <option value="">{employees.length === 0 ? "No employees — create one first" : "Select employee"}</option>
                  {employees.map((e) => (
                    <option key={e.id} value={String(e.id)}>
                      {e.employeeCode} — {e.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>From</Label>
                <Input type="date" value={ledgerFromDate} onChange={(e) => setLedgerFromDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>To</Label>
                <Input type="date" value={ledgerToDate} onChange={(e) => setLedgerToDate(e.target.value)} />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={() => void runLedger()} className="bg-red-600 hover:bg-red-700">Run</Button>
                <Button variant="outline" onClick={() => void downloadCsv(`/reports/ledger?employeeId=${ledgerEmployeeId}&fromDate=${ledgerFromDate}&toDate=${ledgerToDate}&format=csv`, "ledger.csv")}>CSV</Button>
              </div>
            </div>
          ) : null}

          {tab === "cycle" ? (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Billing cycle</Label>
                <select className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={cycleBillingCycleId} onChange={(e) => setCycleBillingCycleId(e.target.value)}>
                  <option value="">{cycles.length === 0 ? "No billing cycles — create one first" : "Select billing cycle"}</option>
                  {cycles.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.cycleCode} ({c.status})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={() => void runCycleStatement()} className="bg-red-600 hover:bg-red-700">Run</Button>
                <Button variant="outline" onClick={() => void downloadCsv(`/reports/cycle-statement?billingCycleId=${cycleBillingCycleId}&format=csv`, "cycle-statement.csv")}>CSV</Button>
              </div>
            </div>
          ) : null}

          {tab === "aging" ? (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>As of date</Label>
                <Input type="date" value={agingAsOfDate} onChange={(e) => setAgingAsOfDate(e.target.value)} />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={() => void runAging()} className="bg-red-600 hover:bg-red-700">Run</Button>
                <Button variant="outline" onClick={() => void downloadCsv(`/reports/aging?asOfDate=${agingAsOfDate}&format=csv`, "aging.csv")}>CSV</Button>
              </div>
            </div>
          ) : null}

          {tab === "collections" ? (
            <div className="grid gap-3 md:grid-cols-5">
              <div className="space-y-1.5">
                <Label>From</Label>
                <Input type="date" value={collectionsFromDate} onChange={(e) => setCollectionsFromDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>To</Label>
                <Input type="date" value={collectionsToDate} onChange={(e) => setCollectionsToDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Method (optional)</Label>
                <Input value={collectionsMethod} onChange={(e) => setCollectionsMethod(e.target.value)} placeholder="cash / bank_transfer" />
              </div>
              <div className="space-y-1.5">
                <Label>Received by</Label>
                <select className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={collectionsUserId} onChange={(e) => setCollectionsUserId(e.target.value)}>
                  <option value="">All</option>
                  {users.map((u) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={() => void runCollections()} className="bg-red-600 hover:bg-red-700">Run</Button>
                <Button variant="outline" onClick={() => {
                  const p = new URLSearchParams({ fromDate: collectionsFromDate, toDate: collectionsToDate, format: "csv" });
                  if (collectionsMethod.trim()) p.set("method", collectionsMethod.trim());
                  if (collectionsUserId) p.set("receivedByUserId", collectionsUserId);
                  void downloadCsv(`/reports/collections?${p.toString()}`, "collections.csv");
                }}>CSV</Button>
              </div>
            </div>
          ) : null}

          {tab === "outstanding" ? (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Group by</Label>
                <select className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={outstandingGroupBy} onChange={(e) => setOutstandingGroupBy(e.target.value as "employee" | "department")}>
                  <option value="employee">employee</option>
                  <option value="department">department</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={() => void runOutstanding()} className="bg-red-600 hover:bg-red-700">Run</Button>
                <Button variant="outline" onClick={() => void downloadCsv(`/reports/outstanding?groupBy=${outstandingGroupBy}&format=csv`, "outstanding.csv")}>CSV</Button>
              </div>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div> : null}
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <>
              {tab === "ledger" && ledgerResult ? (
                <div className="text-sm text-muted-foreground">
                  Opening: <span className="font-mono">{ledgerResult.openingBalance}</span> · Closing:{" "}
                  <span className="font-mono">{ledgerResult.closingBalance}</span>
                </div>
              ) : null}
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      {activeRows[0]
                        ? Object.keys(activeRows[0]).map((k) => (
                            <th key={k} className="px-3 py-2 font-medium">
                              {k}
                            </th>
                          ))
                        : null}
                    </tr>
                  </thead>
                  <tbody>
                    {activeRows.map((row, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-3 py-2">
                            {String(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {activeRows.length === 0 ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-muted-foreground">No data</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

