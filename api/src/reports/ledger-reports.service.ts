import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

function parseDateOnly(iso: string): Date {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid date');
  return d;
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const headerLine = headers.map((h) => escape(h)).join(',');
  const lines = rows.map((row) => headers.map((h) => escape(row[h])).join(','));
  return [headerLine, ...lines].join('\n');
}

@Injectable()
export class LedgerReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async ledger(params: {
    employeeId: number;
    fromDate: string;
    toDate: string;
    includeOpening?: boolean;
    actorUserId?: number;
    format?: 'json' | 'csv';
  }) {
    const fromDate = parseDateOnly(params.fromDate);
    const toDate = parseDateOnly(params.toDate);
    if (fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException('fromDate must be on or before toDate');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: BigInt(params.employeeId) },
      select: { id: true, employeeCode: true, fullName: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const [openingCredit] = await this.prisma.$queryRaw<Array<{ v: Prisma.Decimal }>>`
      SELECT COALESCE(SUM(
        CASE WHEN transaction_type = 'reversal' THEN -amount ELSE amount END
      ), 0)::numeric AS v
      FROM credit_transactions
      WHERE employee_id = ${BigInt(params.employeeId)}
        AND txn_date < ${fromDate}
    `;
    const [openingPaid] = await this.prisma.$queryRaw<Array<{ v: Prisma.Decimal }>>`
      SELECT COALESCE(SUM(pa.allocated_amount), 0)::numeric AS v
      FROM payment_allocations pa
      JOIN payments p ON p.id = pa.payment_id
      WHERE pa.employee_id = ${BigInt(params.employeeId)}
        AND p.status <> 'reversed'
        AND p.payment_date < ${fromDate}
    `;

    const openingBalance = new Prisma.Decimal(openingCredit?.v ?? 0).sub(
      new Prisma.Decimal(openingPaid?.v ?? 0),
    );

    const txRows = await this.prisma.$queryRaw<
      Array<{
        event_date: Date;
        created_at: Date;
        id: bigint;
        kind: string;
        ref: string;
        description: string | null;
        delta_amount: Prisma.Decimal;
      }>
    >`
      SELECT
        ct.txn_date AS event_date,
        ct.created_at AS created_at,
        ct.id AS id,
        'credit_transaction'::text AS kind,
        ct.transaction_type AS ref,
        ct.description AS description,
        (CASE WHEN ct.transaction_type = 'reversal' THEN -ct.amount ELSE ct.amount END) AS delta_amount
      FROM credit_transactions ct
      WHERE ct.employee_id = ${BigInt(params.employeeId)}
        AND ct.txn_date >= ${fromDate}
        AND ct.txn_date <= ${toDate}
      UNION ALL
      SELECT
        p.payment_date AS event_date,
        p.created_at AS created_at,
        p.id AS id,
        'payment'::text AS kind,
        p.method AS ref,
        p.reference_no AS description,
        (-1 * p.amount) AS delta_amount
      FROM payments p
      WHERE p.employee_id = ${BigInt(params.employeeId)}
        AND p.status <> 'reversed'
        AND p.payment_date >= ${fromDate}
        AND p.payment_date <= ${toDate}
    `;

    txRows.sort((a, b) => {
      if (a.event_date.getTime() !== b.event_date.getTime()) {
        return a.event_date.getTime() - b.event_date.getTime();
      }
      if (a.created_at.getTime() !== b.created_at.getTime()) {
        return a.created_at.getTime() - b.created_at.getTime();
      }
      return Number(a.id - b.id);
    });

    let running = new Prisma.Decimal(openingBalance);
    const entries = txRows.map((r) => {
      running = running.add(r.delta_amount);
      return {
        date: r.event_date.toISOString().slice(0, 10),
        createdAt: r.created_at.toISOString(),
        type: r.kind,
        reference: r.ref,
        description: r.description ?? '',
        deltaAmount: r.delta_amount.toString(),
        runningBalance: running.toString(),
      };
    });

    await this.auditService.log({
      actorUserId: params.actorUserId,
      entityName: 'reports',
      entityId: params.employeeId,
      action: params.format === 'csv' ? 'export_csv_ledger' : 'view_ledger',
      newData: {
        employeeId: params.employeeId,
        fromDate: params.fromDate,
        toDate: params.toDate,
      },
    });

    const payload = {
      employee: {
        id: Number(employee.id),
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
      },
      fromDate: params.fromDate,
      toDate: params.toDate,
      openingBalance: openingBalance.toString(),
      entries,
      closingBalance: running.toString(),
    };
    if (params.format === 'csv') {
      const rows = entries.map((e) => ({
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        fromDate: params.fromDate,
        toDate: params.toDate,
        openingBalance: openingBalance.toString(),
        date: e.date,
        createdAt: e.createdAt,
        type: e.type,
        reference: e.reference,
        description: e.description,
        deltaAmount: e.deltaAmount,
        runningBalance: e.runningBalance,
      }));
      return { csv: toCsv(rows), filename: `ledger-employee-${params.employeeId}.csv` };
    }
    return payload;
  }

  async cycleStatement(params: {
    billingCycleId: number;
    departmentId?: number;
    isOverdue?: boolean;
    skip?: number;
    take?: number;
    actorUserId?: number;
    format?: 'json' | 'csv';
  }) {
    const take = Math.min(Math.max(params.take ?? 50, 1), 200);
    const skip = Math.max(params.skip ?? 0, 0);
    const deptFilter =
      typeof params.departmentId === 'number'
        ? Prisma.sql`AND e.department_id = ${BigInt(params.departmentId)}`
        : Prisma.empty;
    const overdueFilter =
      typeof params.isOverdue === 'boolean'
        ? Prisma.sql`AND ecb.is_overdue = ${params.isOverdue}`
        : Prisma.empty;

    const rows = await this.prisma.$queryRaw<
      Array<{
        balance_id: bigint;
        employee_id: bigint;
        employee_code: string;
        full_name: string;
        department_code: string;
        cycle_code: string;
        opening_balance: Prisma.Decimal;
        total_credit: Prisma.Decimal;
        total_paid: Prisma.Decimal;
        closing_balance: Prisma.Decimal;
        is_overdue: boolean;
      }>
    >`
      SELECT
        ecb.id AS balance_id,
        e.id AS employee_id,
        e.employee_code,
        e.full_name,
        d.code AS department_code,
        bc.cycle_code,
        ecb.opening_balance,
        ecb.total_credit,
        ecb.total_paid,
        ecb.closing_balance,
        ecb.is_overdue
      FROM employee_cycle_balances ecb
      JOIN employees e ON e.id = ecb.employee_id
      JOIN departments d ON d.id = e.department_id
      JOIN billing_cycles bc ON bc.id = ecb.billing_cycle_id
      WHERE ecb.billing_cycle_id = ${BigInt(params.billingCycleId)}
      ${deptFilter}
      ${overdueFilter}
      ORDER BY e.employee_code ASC
      OFFSET ${skip}
      LIMIT ${take}
    `;

    const [count] = await this.prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*)::bigint AS c
      FROM employee_cycle_balances ecb
      JOIN employees e ON e.id = ecb.employee_id
      WHERE ecb.billing_cycle_id = ${BigInt(params.billingCycleId)}
      ${deptFilter}
      ${overdueFilter}
    `;

    await this.auditService.log({
      actorUserId: params.actorUserId,
      entityName: 'reports',
      entityId: params.billingCycleId,
      action: params.format === 'csv' ? 'export_csv_cycle_statement' : 'view_cycle_statement',
      newData: { billingCycleId: params.billingCycleId, departmentId: params.departmentId ?? null },
    });

    const mapped = rows.map((r) => ({
      balanceId: Number(r.balance_id),
      employeeId: Number(r.employee_id),
      employeeCode: r.employee_code,
      fullName: r.full_name,
      departmentCode: r.department_code,
      cycleCode: r.cycle_code,
      openingBalance: r.opening_balance.toString(),
      totalCredit: r.total_credit.toString(),
      totalPaid: r.total_paid.toString(),
      closingBalance: r.closing_balance.toString(),
      isOverdue: r.is_overdue,
    }));
    if (params.format === 'csv') {
      return {
        csv: toCsv(mapped as Array<Record<string, unknown>>),
        filename: `cycle-statement-${params.billingCycleId}.csv`,
      };
    }
    return { items: mapped, total: Number(count?.c ?? 0n) };
  }

  async aging(params: {
    asOfDate: string;
    departmentId?: number;
    employeeId?: number;
    actorUserId?: number;
    format?: 'json' | 'csv';
  }) {
    const asOf = parseDateOnly(params.asOfDate);
    const deptFilter =
      typeof params.departmentId === 'number'
        ? Prisma.sql`AND e.department_id = ${BigInt(params.departmentId)}`
        : Prisma.empty;
    const empFilter =
      typeof params.employeeId === 'number'
        ? Prisma.sql`AND e.id = ${BigInt(params.employeeId)}`
        : Prisma.empty;

    const rows = await this.prisma.$queryRaw<
      Array<{
        employee_id: bigint;
        employee_code: string;
        full_name: string;
        current_bucket: Prisma.Decimal;
        bucket_30: Prisma.Decimal;
        bucket_60: Prisma.Decimal;
        bucket_90_plus: Prisma.Decimal;
        total_outstanding: Prisma.Decimal;
      }>
    >`
      SELECT
        e.id AS employee_id,
        e.employee_code,
        e.full_name,
        COALESCE(SUM(CASE WHEN ${asOf}::date <= bc.due_date THEN ecb.closing_balance ELSE 0 END), 0)::numeric AS current_bucket,
        COALESCE(SUM(CASE WHEN ${asOf}::date - bc.due_date BETWEEN 1 AND 30 THEN ecb.closing_balance ELSE 0 END), 0)::numeric AS bucket_30,
        COALESCE(SUM(CASE WHEN ${asOf}::date - bc.due_date BETWEEN 31 AND 60 THEN ecb.closing_balance ELSE 0 END), 0)::numeric AS bucket_60,
        COALESCE(SUM(CASE WHEN ${asOf}::date - bc.due_date > 60 THEN ecb.closing_balance ELSE 0 END), 0)::numeric AS bucket_90_plus,
        COALESCE(SUM(ecb.closing_balance), 0)::numeric AS total_outstanding
      FROM employee_cycle_balances ecb
      JOIN employees e ON e.id = ecb.employee_id
      JOIN billing_cycles bc ON bc.id = ecb.billing_cycle_id
      WHERE ecb.closing_balance > 0
      ${deptFilter}
      ${empFilter}
      GROUP BY e.id, e.employee_code, e.full_name
      ORDER BY e.employee_code ASC
    `;

    await this.auditService.log({
      actorUserId: params.actorUserId,
      entityName: 'reports',
      entityId: 0,
      action: params.format === 'csv' ? 'export_csv_aging' : 'view_aging',
      newData: { asOfDate: params.asOfDate },
    });

    const mapped = rows.map((r) => ({
      employeeId: Number(r.employee_id),
      employeeCode: r.employee_code,
      fullName: r.full_name,
      current: r.current_bucket.toString(),
      bucket30: r.bucket_30.toString(),
      bucket60: r.bucket_60.toString(),
      bucket90Plus: r.bucket_90_plus.toString(),
      totalOutstanding: r.total_outstanding.toString(),
    }));
    if (params.format === 'csv') {
      return { csv: toCsv(mapped as Array<Record<string, unknown>>), filename: `aging-${params.asOfDate}.csv` };
    }
    return { asOfDate: params.asOfDate, items: mapped };
  }

  async collections(params: {
    fromDate: string;
    toDate: string;
    method?: string;
    receivedByUserId?: number;
    actorUserId?: number;
    format?: 'json' | 'csv';
  }) {
    const fromDate = parseDateOnly(params.fromDate);
    const toDate = parseDateOnly(params.toDate);
    if (fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException('fromDate must be on or before toDate');
    }
    const methodFilter = params.method?.trim()
      ? Prisma.sql`AND p.method = ${params.method.trim()}`
      : Prisma.empty;
    const userFilter =
      typeof params.receivedByUserId === 'number'
        ? Prisma.sql`AND p.received_by_user_id = ${BigInt(params.receivedByUserId)}`
        : Prisma.empty;

    const rows = await this.prisma.$queryRaw<
      Array<{
        method: string;
        received_by_user_id: bigint;
        receiver_name: string;
        payment_count: bigint;
        total_amount: Prisma.Decimal;
      }>
    >`
      SELECT
        p.method,
        p.received_by_user_id,
        u.name AS receiver_name,
        COUNT(*)::bigint AS payment_count,
        COALESCE(SUM(p.amount), 0)::numeric AS total_amount
      FROM payments p
      JOIN users u ON u.id = p.received_by_user_id
      WHERE p.status <> 'reversed'
        AND p.payment_date >= ${fromDate}
        AND p.payment_date <= ${toDate}
      ${methodFilter}
      ${userFilter}
      GROUP BY p.method, p.received_by_user_id, u.name
      ORDER BY p.method ASC, receiver_name ASC
    `;

    await this.auditService.log({
      actorUserId: params.actorUserId,
      entityName: 'reports',
      entityId: 0,
      action: params.format === 'csv' ? 'export_csv_collections' : 'view_collections',
      newData: { fromDate: params.fromDate, toDate: params.toDate },
    });

    const mapped = rows.map((r) => ({
      method: r.method,
      receivedByUserId: Number(r.received_by_user_id),
      receiverName: r.receiver_name,
      paymentCount: Number(r.payment_count),
      totalAmount: r.total_amount.toString(),
    }));
    if (params.format === 'csv') {
      return {
        csv: toCsv(mapped as Array<Record<string, unknown>>),
        filename: `collections-${params.fromDate}-to-${params.toDate}.csv`,
      };
    }
    return { fromDate: params.fromDate, toDate: params.toDate, items: mapped };
  }

  async outstanding(params: {
    asOfDate?: string;
    departmentId?: number;
    groupBy: 'employee' | 'department';
    actorUserId?: number;
    format?: 'json' | 'csv';
  }) {
    if (params.asOfDate) parseDateOnly(params.asOfDate);
    const deptFilter =
      typeof params.departmentId === 'number'
        ? Prisma.sql`AND d.id = ${BigInt(params.departmentId)}`
        : Prisma.empty;

    let mapped: Array<Record<string, unknown>>;
    if (params.groupBy === 'department') {
      const rows = await this.prisma.$queryRaw<
        Array<{
          department_id: bigint;
          department_code: string;
          department_name: string;
          outstanding: Prisma.Decimal;
        }>
      >`
        SELECT
          d.id AS department_id,
          d.code AS department_code,
          d.name AS department_name,
          COALESCE(SUM(ecb.closing_balance), 0)::numeric AS outstanding
        FROM employee_cycle_balances ecb
        JOIN employees e ON e.id = ecb.employee_id
        JOIN departments d ON d.id = e.department_id
        WHERE ecb.closing_balance > 0
        ${deptFilter}
        GROUP BY d.id, d.code, d.name
        ORDER BY d.code ASC
      `;
      mapped = rows.map((r) => ({
        departmentId: Number(r.department_id),
        departmentCode: r.department_code,
        departmentName: r.department_name,
        outstanding: r.outstanding.toString(),
      }));
    } else {
      const rows = await this.prisma.$queryRaw<
        Array<{
          employee_id: bigint;
          employee_code: string;
          full_name: string;
          department_code: string;
          outstanding: Prisma.Decimal;
        }>
      >`
        SELECT
          e.id AS employee_id,
          e.employee_code,
          e.full_name,
          d.code AS department_code,
          COALESCE(SUM(ecb.closing_balance), 0)::numeric AS outstanding
        FROM employee_cycle_balances ecb
        JOIN employees e ON e.id = ecb.employee_id
        JOIN departments d ON d.id = e.department_id
        WHERE ecb.closing_balance > 0
        ${deptFilter}
        GROUP BY e.id, e.employee_code, e.full_name, d.code
        ORDER BY e.employee_code ASC
      `;
      mapped = rows.map((r) => ({
        employeeId: Number(r.employee_id),
        employeeCode: r.employee_code,
        fullName: r.full_name,
        departmentCode: r.department_code,
        outstanding: r.outstanding.toString(),
      }));
    }

    await this.auditService.log({
      actorUserId: params.actorUserId,
      entityName: 'reports',
      entityId: 0,
      action: params.format === 'csv' ? 'export_csv_outstanding' : 'view_outstanding',
      newData: { groupBy: params.groupBy, asOfDate: params.asOfDate ?? null },
    });

    if (params.format === 'csv') {
      return { csv: toCsv(mapped), filename: `outstanding-${params.groupBy}.csv` };
    }
    return { groupBy: params.groupBy, items: mapped };
  }
}

