"use client";

import Link from "next/link";
import { useMe } from "@/context/me-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const me = useMe();
  const isAdmin = me.role === "admin";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{me.email}</span> ({me.role}
          ).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <div className="text-sm font-medium">Departments</div>
            <div className="text-xs text-muted-foreground">View or manage departments</div>
          </CardHeader>
          <CardContent>
            <Link
              href="/departments"
              className={cn(
                buttonVariants(),
                "bg-red-600 text-white hover:bg-red-700 [a]:hover:bg-red-700",
              )}
            >
              Open
            </Link>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <div className="text-sm font-medium">Employees</div>
            <div className="text-xs text-muted-foreground">View or manage employees</div>
          </CardHeader>
          <CardContent>
            <Link
              href="/employees"
              className={cn(
                buttonVariants(),
                "bg-red-600 text-white hover:bg-red-700 [a]:hover:bg-red-700",
              )}
            >
              Open
            </Link>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <div className="text-sm font-medium">Billing cycles</div>
            <div className="text-xs text-muted-foreground">Credit billing periods</div>
          </CardHeader>
          <CardContent>
            <Link
              href="/billing-cycles"
              className={cn(
                buttonVariants(),
                "bg-red-600 text-white hover:bg-red-700 [a]:hover:bg-red-700",
              )}
            >
              Open
            </Link>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <div className="text-sm font-medium">Credit transactions</div>
            <div className="text-xs text-muted-foreground">Purchases, adjustments, reversals</div>
          </CardHeader>
          <CardContent>
            <Link
              href="/credit-transactions"
              className={cn(
                buttonVariants(),
                "bg-red-600 text-white hover:bg-red-700 [a]:hover:bg-red-700",
              )}
            >
              Open
            </Link>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <div className="text-sm font-medium">Payments</div>
            <div className="text-xs text-muted-foreground">Collections and allocation engine</div>
          </CardHeader>
          <CardContent>
            <Link
              href="/payments"
              className={cn(
                buttonVariants(),
                "bg-red-600 text-white hover:bg-red-700 [a]:hover:bg-red-700",
              )}
            >
              Open
            </Link>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <div className="text-sm font-medium">Balances</div>
            <div className="text-xs text-muted-foreground">Cycle-wise balances and overdue status</div>
          </CardHeader>
          <CardContent>
            <Link
              href="/balances"
              className={cn(
                buttonVariants(),
                "bg-red-600 text-white hover:bg-red-700 [a]:hover:bg-red-700",
              )}
            >
              Open
            </Link>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <div className="text-sm font-medium">Reports</div>
            <div className="text-xs text-muted-foreground">Ledger, aging, collections, outstanding</div>
          </CardHeader>
          <CardContent>
            <Link
              href="/reports"
              className={cn(
                buttonVariants(),
                "bg-red-600 text-white hover:bg-red-700 [a]:hover:bg-red-700",
              )}
            >
              Open
            </Link>
          </CardContent>
        </Card>
        {isAdmin ? (
          <>
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-2">
                <div className="text-sm font-medium">Users</div>
                <div className="text-xs text-muted-foreground">Admin user management</div>
              </CardHeader>
              <CardContent>
                <Link
                  href="/users"
                  className={cn(
                    buttonVariants(),
                    "bg-red-600 text-white hover:bg-red-700 [a]:hover:bg-red-700",
                  )}
                >
                  Open
                </Link>
              </CardContent>
            </Card>
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-2">
                <div className="text-sm font-medium">Audit log</div>
                <div className="text-xs text-muted-foreground">Security and change history</div>
              </CardHeader>
              <CardContent>
                <Link
                  href="/audit"
                  className={cn(
                    buttonVariants(),
                    "bg-red-600 text-white hover:bg-red-700 [a]:hover:bg-red-700",
                  )}
                >
                  Open
                </Link>
              </CardContent>
            </Card>
          </>
        ) : null}
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <div className="text-sm font-medium">Profile</div>
            <div className="text-xs text-muted-foreground">Password and account details</div>
          </CardHeader>
          <CardContent>
            <Link href="/profile" className={cn(buttonVariants({ variant: "outline" }))}>
              Open
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
