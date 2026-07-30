import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BalancesService } from '../balances/balances.service';
import type { BillingCycleListItem, BillingCycleStatus } from './billing-cycle.types';

function normalizeCycleCode(code: string): string {
  return code.trim().toUpperCase();
}

function parseDateOnly(iso: string): Date {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException('Invalid date');
  }
  return d;
}

function dateOnlyToIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class BillingCyclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly balancesService: BalancesService,
  ) {}

  private assertRangeOrder(start: Date, end: Date, due: Date): void {
    if (start.getTime() > end.getTime()) {
      throw new BadRequestException('startDate must be on or before endDate');
    }
    if (due.getTime() < start.getTime()) {
      throw new BadRequestException('dueDate must be on or after startDate');
    }
  }

  private async assertNoOverlap(
    start: Date,
    end: Date,
    excludeId?: number,
  ): Promise<void> {
    const found = await this.prisma.billingCycle.findFirst({
      where: {
        ...(typeof excludeId === 'number'
          ? { id: { not: BigInt(excludeId) } }
          : {}),
        AND: [{ startDate: { lte: end } }, { endDate: { gte: start } }],
      },
      select: { id: true, cycleCode: true },
    });
    if (found) {
      throw new BadRequestException(
        `Date range overlaps an existing billing cycle (${found.cycleCode})`,
      );
    }
  }

  private async dependencyCounts(billingCycleId: number): Promise<number> {
    const id = BigInt(billingCycleId);
    const [tx] = await this.prisma.$queryRaw<{ c: bigint }[]>(
      Prisma.sql`SELECT COUNT(*)::bigint AS c FROM credit_transactions WHERE billing_cycle_id = ${id}`,
    );
    const [bal] = await this.prisma.$queryRaw<{ c: bigint }[]>(
      Prisma.sql`SELECT COUNT(*)::bigint AS c FROM employee_cycle_balances WHERE billing_cycle_id = ${id}`,
    );
    const [pay] = await this.prisma.$queryRaw<{ c: bigint }[]>(
      Prisma.sql`SELECT COUNT(*)::bigint AS c FROM payments WHERE billing_cycle_id = ${id}`,
    );
    return Number(tx.c) + Number(bal.c) + Number(pay.c);
  }

  async create(
    input: {
      cycleCode: string;
      startDate: string;
      endDate: string;
      dueDate: string;
      status: BillingCycleStatus;
    },
    actorUserId?: number,
  ): Promise<BillingCycleListItem> {
    const cycleCode = normalizeCycleCode(input.cycleCode);
    const startDate = parseDateOnly(input.startDate);
    const endDate = parseDateOnly(input.endDate);
    const dueDate = parseDateOnly(input.dueDate);
    this.assertRangeOrder(startDate, endDate, dueDate);
    await this.assertNoOverlap(startDate, endDate);

    try {
      const created = await this.prisma.billingCycle.create({
        data: {
          cycleCode,
          startDate,
          endDate,
          dueDate,
          status: input.status,
        },
      });
      const item = this.toListItem(created);
      await this.auditService.log({
        actorUserId,
        entityName: 'billing_cycles',
        entityId: Number(created.id),
        action: 'create',
        newData: item,
      });
      return item;
    } catch (err: unknown) {
      const codeErr = err as { code?: string };
      if (codeErr?.code === 'P2002') {
        throw new BadRequestException('Billing cycle code already exists');
      }
      throw err;
    }
  }

  async list(params?: {
    q?: string;
    status?: BillingCycleStatus;
    startDateFrom?: string;
    startDateTo?: string;
    skip?: number;
    take?: number;
  }): Promise<{ items: BillingCycleListItem[]; total: number }> {
    const q = params?.q?.trim();
    const startDateFilter: Prisma.DateTimeFilter | undefined =
      params?.startDateFrom || params?.startDateTo
        ? {
            ...(params.startDateFrom
              ? { gte: parseDateOnly(params.startDateFrom) }
              : {}),
            ...(params.startDateTo ? { lte: parseDateOnly(params.startDateTo) } : {}),
          }
        : undefined;

    const where: Prisma.BillingCycleWhereInput = {
      ...(params?.status ? { status: params.status } : {}),
      ...(startDateFilter ? { startDate: startDateFilter } : {}),
      ...(q
        ? {
            OR: [
              { cycleCode: { contains: q, mode: 'insensitive' } },
              { status: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const take = Math.min(Math.max(params?.take ?? 50, 1), 100);
    const skip = Math.max(params?.skip ?? 0, 0);

    const [rows, total] = await Promise.all([
      this.prisma.billingCycle.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take,
      }),
      this.prisma.billingCycle.count({ where }),
    ]);

    return { items: rows.map((r) => this.toListItem(r)), total };
  }

  async get(id: number): Promise<BillingCycleListItem> {
    const row = await this.prisma.billingCycle.findUnique({
      where: { id: BigInt(id) },
    });
    if (!row) {
      throw new NotFoundException('Billing cycle not found');
    }
    return this.toListItem(row);
  }

  async update(
    id: number,
    input: {
      cycleCode?: string;
      startDate?: string;
      endDate?: string;
      dueDate?: string;
      status?: BillingCycleStatus;
    },
    actorUserId?: number,
  ): Promise<BillingCycleListItem> {
    const before = await this.prisma.billingCycle.findUnique({
      where: { id: BigInt(id) },
    });
    if (!before) {
      throw new NotFoundException('Billing cycle not found');
    }

    const startDate = input.startDate
      ? parseDateOnly(input.startDate)
      : before.startDate;
    const endDate = input.endDate ? parseDateOnly(input.endDate) : before.endDate;
    const dueDate = input.dueDate ? parseDateOnly(input.dueDate) : before.dueDate;

    if (
      input.startDate !== undefined ||
      input.endDate !== undefined ||
      input.dueDate !== undefined
    ) {
      this.assertRangeOrder(startDate, endDate, dueDate);
    }

    if (
      input.startDate !== undefined ||
      input.endDate !== undefined ||
      input.cycleCode !== undefined ||
      input.status !== undefined ||
      input.dueDate !== undefined
    ) {
      // Re-check overlap if range or code change could affect uniqueness — overlap only on dates
      if (input.startDate !== undefined || input.endDate !== undefined) {
        await this.assertNoOverlap(startDate, endDate, id);
      }
    }

    const data: Prisma.BillingCycleUpdateInput = {};
    if (typeof input.cycleCode === 'string') {
      data.cycleCode = normalizeCycleCode(input.cycleCode);
    }
    if (input.startDate !== undefined) data.startDate = startDate;
    if (input.endDate !== undefined) data.endDate = endDate;
    if (input.dueDate !== undefined) data.dueDate = dueDate;
    if (input.status !== undefined) data.status = input.status;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    try {
      const updated = await this.prisma.billingCycle.update({
        where: { id: BigInt(id) },
        data,
      });
      const item = this.toListItem(updated);
      await this.auditService.log({
        actorUserId,
        entityName: 'billing_cycles',
        entityId: id,
        action: 'update',
        oldData: this.toListItem(before),
        newData: item,
      });
      if (
        input.status !== undefined ||
        input.startDate !== undefined ||
        input.endDate !== undefined ||
        input.dueDate !== undefined
      ) {
        await this.balancesService.recalculateCycleForAllEmployees(id);
      }
      return item;
    } catch (err: unknown) {
      const codeErr = err as { code?: string };
      if (codeErr?.code === 'P2025') {
        throw new NotFoundException('Billing cycle not found');
      }
      if (codeErr?.code === 'P2002') {
        throw new BadRequestException('Billing cycle code already exists');
      }
      throw err;
    }
  }

  async remove(id: number, actorUserId?: number): Promise<{ success: boolean }> {
    const before = await this.prisma.billingCycle.findUnique({
      where: { id: BigInt(id) },
    });
    if (!before) {
      throw new NotFoundException('Billing cycle not found');
    }
    const deps = await this.dependencyCounts(id);
    if (deps > 0) {
      throw new BadRequestException(
        'Cannot delete billing cycle while transactions, balances, or payments reference it',
      );
    }
    await this.prisma.billingCycle.delete({
      where: { id: BigInt(id) },
    });
    await this.auditService.log({
      actorUserId,
      entityName: 'billing_cycles',
      entityId: id,
      action: 'delete',
      oldData: this.toListItem(before),
    });
    return { success: true };
  }

  async settle(
    id: number,
    actorUserId?: number,
    reason?: string,
  ): Promise<{ success: boolean; cycle: BillingCycleListItem; affectedEmployees: number }> {
    const before = await this.prisma.billingCycle.findUnique({
      where: { id: BigInt(id) },
    });
    if (!before) throw new NotFoundException('Billing cycle not found');
    if (before.status === 'closed') {
      throw new BadRequestException('Billing cycle is already closed');
    }

    const affectedEmployees =
      await this.balancesService.recalculateCycleForAllEmployees(id);

    const updated = await this.prisma.billingCycle.update({
      where: { id: BigInt(id) },
      data: { status: 'closed' },
    });

    await this.auditService.log({
      actorUserId,
      entityName: 'billing_cycles',
      entityId: id,
      action: 'settle',
      oldData: this.toListItem(before),
      newData: {
        ...this.toListItem(updated),
        reason: reason?.trim() || null,
        affectedEmployees,
      },
    });

    return {
      success: true,
      cycle: this.toListItem(updated),
      affectedEmployees,
    };
  }

  async reopen(
    id: number,
    actorUserId?: number,
    reason?: string,
  ): Promise<{ success: boolean; cycle: BillingCycleListItem }> {
    const before = await this.prisma.billingCycle.findUnique({
      where: { id: BigInt(id) },
    });
    if (!before) throw new NotFoundException('Billing cycle not found');
    if (before.status !== 'closed') {
      throw new BadRequestException('Only closed cycles can be reopened');
    }

    const updated = await this.prisma.billingCycle.update({
      where: { id: BigInt(id) },
      data: { status: 'open' },
    });

    await this.auditService.log({
      actorUserId,
      entityName: 'billing_cycles',
      entityId: id,
      action: 'reopen',
      oldData: this.toListItem(before),
      newData: {
        ...this.toListItem(updated),
        reason: reason?.trim() || null,
      },
    });

    return {
      success: true,
      cycle: this.toListItem(updated),
    };
  }

  private toListItem(row: {
    id: bigint;
    cycleCode: string;
    startDate: Date;
    endDate: Date;
    dueDate: Date;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }): BillingCycleListItem {
    return {
      id: Number(row.id),
      cycleCode: row.cycleCode,
      startDate: dateOnlyToIso(row.startDate),
      endDate: dateOnlyToIso(row.endDate),
      dueDate: dateOnlyToIso(row.dueDate),
      status: row.status as BillingCycleStatus,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
