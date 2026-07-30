import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { BalanceListItem } from './balance.types';

type BalanceRow = {
  id: bigint;
  employee_id: bigint;
  billing_cycle_id: bigint;
  opening_balance: Prisma.Decimal;
  total_credit: Prisma.Decimal;
  total_paid: Prisma.Decimal;
  closing_balance: Prisma.Decimal;
  carried_forward_balance: Prisma.Decimal;
  advance_balance: Prisma.Decimal;
  is_overdue: boolean;
  calculated_at: Date;
  employee_code: string;
  full_name: string;
  cycle_code: string;
  cycle_start_date: Date;
  cycle_due_date: Date;
  cycle_status: string;
};

function dateOnlyToIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class BalancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private toItem(row: BalanceRow): BalanceListItem {
    return {
      id: Number(row.id),
      employeeId: Number(row.employee_id),
      billingCycleId: Number(row.billing_cycle_id),
      openingBalance: row.opening_balance.toString(),
      totalCredit: row.total_credit.toString(),
      totalPaid: row.total_paid.toString(),
      closingBalance: row.closing_balance.toString(),
      carriedForwardBalance: row.carried_forward_balance.toString(),
      advanceBalance: row.advance_balance.toString(),
      isOverdue: row.is_overdue,
      calculatedAt: row.calculated_at.toISOString(),
      employee: {
        id: Number(row.employee_id),
        employeeCode: row.employee_code,
        fullName: row.full_name,
      },
      billingCycle: {
        id: Number(row.billing_cycle_id),
        cycleCode: row.cycle_code,
        startDate: dateOnlyToIso(row.cycle_start_date),
        dueDate: dateOnlyToIso(row.cycle_due_date),
        status: row.cycle_status,
      },
    };
  }

  async list(params?: {
    employeeId?: number;
    billingCycleId?: number;
    isOverdue?: boolean;
    skip?: number;
    take?: number;
  }): Promise<{ items: BalanceListItem[]; total: number }> {
    const take = Math.min(Math.max(params?.take ?? 50, 1), 200);
    const skip = Math.max(params?.skip ?? 0, 0);
    const employeeFilter =
      typeof params?.employeeId === 'number' ? Prisma.sql`AND ecb.employee_id = ${BigInt(params.employeeId)}` : Prisma.empty;
    const cycleFilter =
      typeof params?.billingCycleId === 'number'
        ? Prisma.sql`AND ecb.billing_cycle_id = ${BigInt(params.billingCycleId)}`
        : Prisma.empty;
    const overdueFilter =
      typeof params?.isOverdue === 'boolean'
        ? Prisma.sql`AND ecb.is_overdue = ${params.isOverdue}`
        : Prisma.empty;

    const rows = await this.prisma.$queryRaw<BalanceRow[]>`
      SELECT
        ecb.id,
        ecb.employee_id,
        ecb.billing_cycle_id,
        ecb.opening_balance,
        ecb.total_credit,
        ecb.total_paid,
        ecb.closing_balance,
        ecb.carried_forward_balance,
        ecb.advance_balance,
        ecb.is_overdue,
        ecb.calculated_at,
        e.employee_code,
        e.full_name,
        bc.cycle_code,
        bc.start_date AS cycle_start_date,
        bc.due_date AS cycle_due_date,
        bc.status AS cycle_status
      FROM employee_cycle_balances ecb
      JOIN employees e ON e.id = ecb.employee_id
      JOIN billing_cycles bc ON bc.id = ecb.billing_cycle_id
      WHERE 1 = 1
      ${employeeFilter}
      ${cycleFilter}
      ${overdueFilter}
      ORDER BY bc.start_date DESC, ecb.id DESC
      OFFSET ${skip}
      LIMIT ${take}
    `;

    const [countRow] = await this.prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*)::bigint AS c
      FROM employee_cycle_balances ecb
      WHERE 1 = 1
      ${employeeFilter}
      ${cycleFilter}
      ${overdueFilter}
    `;

    return { items: rows.map((r) => this.toItem(r)), total: Number(countRow?.c ?? 0n) };
  }

  async get(id: number): Promise<BalanceListItem> {
    const rows = await this.prisma.$queryRaw<BalanceRow[]>`
      SELECT
        ecb.id,
        ecb.employee_id,
        ecb.billing_cycle_id,
        ecb.opening_balance,
        ecb.total_credit,
        ecb.total_paid,
        ecb.closing_balance,
        ecb.carried_forward_balance,
        ecb.advance_balance,
        ecb.is_overdue,
        ecb.calculated_at,
        e.employee_code,
        e.full_name,
        bc.cycle_code,
        bc.start_date AS cycle_start_date,
        bc.due_date AS cycle_due_date,
        bc.status AS cycle_status
      FROM employee_cycle_balances ecb
      JOIN employees e ON e.id = ecb.employee_id
      JOIN billing_cycles bc ON bc.id = ecb.billing_cycle_id
      WHERE ecb.id = ${BigInt(id)}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new NotFoundException('Balance row not found');
    return this.toItem(row);
  }

  async recalculateCycleBalance(employeeId: number, billingCycleId: number): Promise<void> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: BigInt(employeeId) },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const cycle = await this.prisma.billingCycle.findUnique({
      where: { id: BigInt(billingCycleId) },
      select: { id: true, dueDate: true, startDate: true },
    });
    if (!cycle) throw new NotFoundException('Billing cycle not found');

    const [base] = await this.prisma.$queryRaw<
      Array<{
        total_credit: Prisma.Decimal;
        total_paid: Prisma.Decimal;
        direct_advance: Prisma.Decimal;
      }>
    >`
      SELECT
        COALESCE((
          SELECT SUM(
            CASE
              WHEN ct.transaction_type = 'reversal' THEN -ct.amount
              ELSE ct.amount
            END
          )
          FROM credit_transactions ct
          WHERE ct.employee_id = ${BigInt(employeeId)}
            AND ct.billing_cycle_id = ${BigInt(billingCycleId)}
        ), 0)::numeric AS total_credit,
        COALESCE((
          SELECT SUM(pa.allocated_amount)
          FROM payment_allocations pa
          JOIN payments p ON p.id = pa.payment_id
          WHERE pa.employee_id = ${BigInt(employeeId)}
            AND pa.billing_cycle_id = ${BigInt(billingCycleId)}
            AND p.status <> 'reversed'
        ), 0)::numeric AS total_paid,
        COALESCE((
          SELECT SUM(
            GREATEST(p.amount - COALESCE((
              SELECT SUM(pa2.allocated_amount)
              FROM payment_allocations pa2
              WHERE pa2.payment_id = p.id
            ), 0), 0)
          )
          FROM payments p
          WHERE p.employee_id = ${BigInt(employeeId)}
            AND p.status <> 'reversed'
            AND p.advance_applied_billing_cycle_id = ${BigInt(billingCycleId)}
        ), 0)::numeric AS direct_advance
    `;

    const [prev] = await this.prisma.$queryRaw<
      Array<{ prev_closing: Prisma.Decimal; prev_advance: Prisma.Decimal }>
    >`
      SELECT
        ecb.closing_balance AS prev_closing,
        ecb.advance_balance AS prev_advance
      FROM employee_cycle_balances ecb
      JOIN billing_cycles bc ON bc.id = ecb.billing_cycle_id
      WHERE ecb.employee_id = ${BigInt(employeeId)}
        AND (
          bc.start_date < ${cycle.startDate}
          OR (bc.start_date = ${cycle.startDate} AND ecb.billing_cycle_id < ${BigInt(billingCycleId)})
        )
      ORDER BY bc.start_date DESC, ecb.billing_cycle_id DESC
      LIMIT 1
    `;

    const opening = new Prisma.Decimal(prev?.prev_closing ?? 0);
    const incomingAdvance = new Prisma.Decimal(prev?.prev_advance ?? 0);
    const totalCredit = new Prisma.Decimal(base?.total_credit ?? 0);
    const totalPaid = new Prisma.Decimal(base?.total_paid ?? 0);
    const directAdvance = new Prisma.Decimal(base?.direct_advance ?? 0);

    const baseClosing = opening.add(totalCredit).sub(totalPaid);
    const payable = Prisma.Decimal.max(baseClosing, new Prisma.Decimal(0));
    const consumedAdvance = Prisma.Decimal.min(payable, incomingAdvance);
    const closing = baseClosing.sub(consumedAdvance);
    const carriedForward = Prisma.Decimal.max(closing, new Prisma.Decimal(0));
    const advanceBalance = incomingAdvance.sub(consumedAdvance).add(directAdvance);
    const overdue = cycle.dueDate.getTime() < Date.now() && carriedForward.gt(0);

    await this.prisma.$executeRaw`
      INSERT INTO employee_cycle_balances (
        employee_id,
        billing_cycle_id,
        opening_balance,
        total_credit,
        total_paid,
        closing_balance,
        carried_forward_balance,
        advance_balance,
        is_overdue,
        calculated_at
      )
      VALUES (
        ${BigInt(employeeId)},
        ${BigInt(billingCycleId)},
        ${opening},
        ${totalCredit},
        ${totalPaid},
        ${closing},
        ${carriedForward},
        ${advanceBalance},
        ${overdue},
        NOW()
      )
      ON CONFLICT (employee_id, billing_cycle_id)
      DO UPDATE SET
        opening_balance = EXCLUDED.opening_balance,
        total_credit = EXCLUDED.total_credit,
        total_paid = EXCLUDED.total_paid,
        closing_balance = EXCLUDED.closing_balance,
        carried_forward_balance = EXCLUDED.carried_forward_balance,
        advance_balance = EXCLUDED.advance_balance,
        is_overdue = EXCLUDED.is_overdue,
        calculated_at = NOW()
    `;
  }

  async recalculateEmployeeAllCycles(employeeId: number): Promise<number> {
    const cycles = await this.prisma.billingCycle.findMany({
      orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    for (const cycle of cycles) {
      await this.recalculateCycleBalance(employeeId, Number(cycle.id));
    }
    return cycles.length;
  }

  async recalculateCycleForAllEmployees(billingCycleId: number): Promise<number> {
    const cycle = await this.prisma.billingCycle.findUnique({
      where: { id: BigInt(billingCycleId) },
      select: { id: true },
    });
    if (!cycle) throw new NotFoundException('Billing cycle not found');

    const employeeRows = await this.prisma.$queryRaw<Array<{ employee_id: bigint }>>`
      SELECT DISTINCT employee_id
      FROM (
        SELECT employee_id FROM credit_transactions WHERE billing_cycle_id = ${BigInt(billingCycleId)}
        UNION
        SELECT employee_id FROM payment_allocations WHERE billing_cycle_id = ${BigInt(billingCycleId)}
        UNION
        SELECT employee_id FROM payments WHERE billing_cycle_id = ${BigInt(billingCycleId)}
        UNION
        SELECT employee_id FROM payments WHERE advance_applied_billing_cycle_id = ${BigInt(billingCycleId)}
        UNION
        SELECT employee_id FROM employee_cycle_balances WHERE billing_cycle_id = ${BigInt(billingCycleId)}
      ) src
      ORDER BY employee_id ASC
    `;

    for (const row of employeeRows) {
      await this.recalculateCycleBalance(Number(row.employee_id), billingCycleId);
    }
    return employeeRows.length;
  }

  async recalculateWithMode(
    input: {
      mode?: 'employee_cycle' | 'employee_all_cycles' | 'cycle_all_employees';
      employeeId?: number;
      billingCycleId?: number;
      reason?: string;
    },
    actorUserId?: number,
  ): Promise<{ success: boolean; mode: string; affectedRows: number }> {
    const mode = input.mode ?? 'employee_cycle';
    let affectedRows = 0;

    if (mode === 'employee_cycle') {
      if (!input.employeeId || !input.billingCycleId) {
        throw new BadRequestException('employeeId and billingCycleId are required');
      }
      await this.recalculateCycleBalance(input.employeeId, input.billingCycleId);
      affectedRows = 1;
    } else if (mode === 'employee_all_cycles') {
      if (!input.employeeId) throw new BadRequestException('employeeId is required');
      affectedRows = await this.recalculateEmployeeAllCycles(input.employeeId);
    } else {
      if (!input.billingCycleId) throw new BadRequestException('billingCycleId is required');
      affectedRows = await this.recalculateCycleForAllEmployees(input.billingCycleId);
    }

    await this.auditService.log({
      actorUserId,
      entityName: 'employee_cycle_balances',
      entityId: input.billingCycleId ?? input.employeeId ?? 0,
      action: 'recalculate',
      newData: {
        mode,
        affectedRows,
        employeeId: input.employeeId ?? null,
        billingCycleId: input.billingCycleId ?? null,
        reason: input.reason ?? null,
      },
    });

    await this.prisma.$executeRaw`
      INSERT INTO balance_calculation_runs (triggered_by_user_id, mode, employee_id, billing_cycle_id, reason, affected_rows)
      VALUES (
        ${actorUserId ? BigInt(actorUserId) : null},
        ${mode},
        ${input.employeeId ? BigInt(input.employeeId) : null},
        ${input.billingCycleId ? BigInt(input.billingCycleId) : null},
        ${input.reason?.trim() || null},
        ${affectedRows}
      )
    `;

    return { success: true, mode, affectedRows };
  }
}

