"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMe } from "@/context/me-context";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type AuditRow = {
  id: number;
  userId: number | null;
  entityName: string;
  entityId: number;
  action: string;
  oldData: unknown;
  newData: unknown;
  createdAt: string;
};

type ListRes = { items: AuditRow[]; total: number };

export default function AuditPage() {
  const me = useMe();
  const isAdmin = me.role === "admin";
  const searchParams = useSearchParams();

  const [items, setItems] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entityName, setEntityName] = useState("");
  const [appliedEntity, setAppliedEntity] = useState("");
  const [skip, setSkip] = useState(0);
  const take = 25;

  useEffect(() => {
    const fromQuery = searchParams.get("entityName") ?? "";
    setEntityName(fromQuery);
    setAppliedEntity(fromQuery);
  }, [searchParams]);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (appliedEntity.trim()) params.set("entityName", appliedEntity.trim());
      params.set("skip", String(skip));
      params.set("take", String(take));
      const data = await apiFetch<ListRes>(`/admin/audit-logs?${params.toString()}`);
      setItems(data.items);
      setTotal(data.total);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [appliedEntity, skip, isAdmin]);

  useEffect(() => {
    if (isAdmin) void load();
    else setLoading(false);
  }, [load, isAdmin]);

  const pageMax = useMemo(() => Math.max(0, Math.ceil(total / take) - 1), [total]);
  const page = Math.floor(skip / take);

  if (!isAdmin) {
    return (
      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <h1 className="text-xl font-semibold">Audit log</h1>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This area is only available to administrators.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">Total: {total}</p>
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1.5 sm:min-w-[220px]">
              <Label>Entity name (optional)</Label>
              <input
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
                placeholder="e.g. users, departments"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setSkip(0);
                setAppliedEntity(entityName);
              }}
            >
              Apply filter
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
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 font-medium">When</th>
                    <th className="px-3 py-2 font-medium">Actor</th>
                    <th className="px-3 py-2 font-medium">Entity</th>
                    <th className="px-3 py-2 font-medium">Id</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-b last:border-0 align-top">
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {row.userId ?? "—"}
                      </td>
                      <td className="px-3 py-2">{row.entityName}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.entityId}</td>
                      <td className="px-3 py-2">{row.action}</td>
                    </tr>
                  ))}
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                        No entries
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
    </div>
  );
}
