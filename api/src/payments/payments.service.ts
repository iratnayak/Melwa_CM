import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BalancesService } from '../balances/balances.service';
import type {
  PaymentAllocationItem,
  PaymentListItem,
  PaymentStatus,
} from './payment.types';

const paymentInclude = {
  employee: { select: { id: true, employeeCode: true, fullName: true, isActive: true } },
  billingCycle: { select: { id: true, cycleCode: true, status: true } },
  receivedByUser: { select: { id: true, name: true, email: true } },
} as const;

function parseDateOnly(iso: string): Date {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException('Invalid paymentDate');
  }
  return d;
}

function dateOnlyToIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly balancesService: BalancesService,
  ) {}

  private async assertEmployeeActive(employeeId: number): Promise<void> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: BigInt(employeeId) },
      select: { id: true, isActive: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    if (!employee.isActive) {
      throw new BadRequestException('Cannot record payment for an inactive employee');
    }
  }

  private async assertBillingCycleWritable(
    billingCycleId: number | undefined,
  ): Promise<void> {
    if (!billingCycleId) return;
    const cycle = await this.prisma.billingCycle.findUnique({
      where: { id: BigInt(billingCycleId) },
      select: { id: true, status: true },
    });
    if (!cycle) throw new NotFoundException('Billing cycle not found');
    if (cycle.status === 'closed') {
      throw new BadRequestException('Cannot modify payments in a closed billing cycle');
    }
  }

  private toPaymentItem(row: {
    id: bigint;
    employeeId: bigint;
    billingCycleId: bigint | null;
    advanceAppliedBillingCycleId: bigint | null;
    receivedByUserId: bigint;
    paymentDate: Date;
    amount: Prisma.Decimal;
    method: string;
    referenceNo: string | null;
    status: string;
    allocatedAmount: Prisma.Decimal;
    allocatedAt: Date | null;
    reversedAt: Date | null;
    reversalReason: string | null;
    createdAt: Date;
    updatedAt: Date;
    employee: { id: bigint; employeeCode: string; fullName: string };
    billingCycle: { id: bigint; cycleCode: string; status: string } | null;
    receivedByUser: { id: bigint; name: string; email: string };
  }): PaymentListItem {
    return {
      id: Number(row.id),
      employeeId: Number(row.employeeId),
      billingCycleId: row.billingCycleId === null ? null : Number(row.billingCycleId),
      advanceAppliedBillingCycleId:
        row.advanceAppliedBillingCycleId === null
          ? null
          : Number(row.advanceAppliedBillingCycleId),
      receivedByUserId: Number(row.receivedByUserId),
      paymentDate: dateOnlyToIso(row.paymentDate),
      amount: row.amount.toString(),
      method: row.method,
      referenceNo: row.referenceNo,
      status: row.status as PaymentStatus,
      allocatedAmount: row.allocatedAmount.toString(),
      allocatedAt: row.allocatedAt?.toISOString() ?? null,
      reversedAt: row.reversedAt?.toISOString() ?? null,
      reversalReason: row.reversalReason,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      employee: {
        id: Number(row.employee.id),
        employeeCode: row.employee.employeeCode,
        fullName: row.employee.fullName,
      },
      billingCycle: row.billingCycle
        ? {
            id: Number(row.billingCycle.id),
            cycleCode: row.billingCycle.cycleCode,
            status: row.billingCycle.status,
          }
        : null,
      receivedByUser: {
        id: Number(row.receivedByUser.id),
        name: row.receivedByUser.name,
        email: row.receivedByUser.email,
      },
    };
  }

  private toAllocationItem(row: {
    id: bigint;
    paymentId: bigint;
    employeeId: bigint;
    billingCycleId: bigint;
    allocatedAmount: Prisma.Decimal;
    createdAt: Date;
    billingCycle: { id: bigint; cycleCode: string; status: string };
  }): PaymentAllocationItem {
    return {
      id: Number(row.id),
      paymentId: Number(row.paymentId),
      employeeId: Number(row.employeeId),
      billingCycleId: Number(row.billingCycleId),
      allocatedAmount: row.allocatedAmount.toString(),
      createdAt: row.createdAt.toISOString(),
      billingCycle: {
        id: Number(row.billingCycle.id),
        cycleCode: row.billingCycle.cycleCode,
        status: row.billingCycle.status,
      },
    };
  }

  async create(
    input: {
      employeeId: number;
      billingCycleId?: number;
      paymentDate: string;
      amount: number;
      method: string;
      referenceNo?: string;
      status?: PaymentStatus;
    },
    actorUserId: number,
  ): Promise<PaymentListItem> {
    const paymentDate = parseDateOnly(input.paymentDate);
    if (input.amount <= 0) {
      throw new BadRequestException('Payment amount must be > 0');
    }

    await this.assertEmployeeActive(input.employeeId);
    await this.assertBillingCycleWritable(input.billingCycleId);

    const status = input.status ?? 'recorded';
    if (status !== 'recorded') {
      throw new BadRequestException(
        'Payments can only be created with recorded status; use allocate/reverse actions later',
      );
    }

    const created = await this.prisma.payment.create({
      data: {
        employeeId: BigInt(input.employeeId),
        ...(typeof input.billingCycleId === 'number'
          ? { billingCycleId: BigInt(input.billingCycleId) }
          : {}),
        receivedByUserId: BigInt(actorUserId),
        paymentDate,
        amount: new Prisma.Decimal(input.amount),
        method: input.method.trim(),
        referenceNo: input.referenceNo?.trim() || null,
        status,
      },
      include: paymentInclude,
    });

    const item = this.toPaymentItem(created);
    await this.auditService.log({
      actorUserId,
      entityName: 'payments',
      entityId: Number(created.id),
      action: 'create',
      newData: item,
    });
    if (typeof input.billingCycleId === 'number') {
      await this.balancesService.recalculateCycleBalance(
        input.employeeId,
        input.billingCycleId,
      );
    }
    return item;
  }

  async list(params?: {
    q?: string;
    employeeId?: number;
    billingCycleId?: number;
    status?: PaymentStatus;
    fromDate?: string;
    toDate?: string;
    skip?: number;
    take?: number;
  }): Promise<{ items: PaymentListItem[]; total: number }> {
    const q = params?.q?.trim();
    const paymentDateFilter: Prisma.DateTimeFilter | undefined =
      params?.fromDate || params?.toDate
        ? {
            ...(params.fromDate ? { gte: parseDateOnly(params.fromDate) } : {}),
            ...(params.toDate ? { lte: parseDateOnly(params.toDate) } : {}),
          }
        : undefined;

    const where: Prisma.PaymentWhereInput = {
      ...(typeof params?.employeeId === 'number'
        ? { employeeId: BigInt(params.employeeId) }
        : {}),
      ...(typeof params?.billingCycleId === 'number'
        ? { billingCycleId: BigInt(params.billingCycleId) }
        : {}),
      ...(params?.status ? { status: params.status } : {}),
      ...(paymentDateFilter ? { paymentDate: paymentDateFilter } : {}),
      ...(q
        ? {
            OR: [
              { method: { contains: q, mode: 'insensitive' } },
              { referenceNo: { contains: q, mode: 'insensitive' } },
              { employee: { fullName: { contains: q, mode: 'insensitive' } } },
              { employee: { employeeCode: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const take = Math.min(Math.max(params?.take ?? 50, 1), 100);
    const skip = Math.max(params?.skip ?? 0, 0);

    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take,
        include: paymentInclude,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { items: rows.map((r) => this.toPaymentItem(r)), total };
  }

  async get(id: number): Promise<PaymentListItem & { allocations: PaymentAllocationItem[] }> {
    const row = await this.prisma.payment.findUnique({
      where: { id: BigInt(id) },
      include: {
        ...paymentInclude,
        allocations: {
          include: {
            billingCycle: { select: { id: true, cycleCode: true, status: true } },
          },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!row) throw new NotFoundException('Payment not found');
    return {
      ...this.toPaymentItem(row),
      allocations: row.allocations.map((a) => this.toAllocationItem(a)),
    };
  }

  async update(
    id: number,
    input: {
      employeeId?: number;
      billingCycleId?: number;
      paymentDate?: string;
      amount?: number;
      method?: string;
      referenceNo?: string;
    },
    actorUserId: number,
  ): Promise<PaymentListItem> {
    const before = await this.prisma.payment.findUnique({
      where: { id: BigInt(id) },
      include: paymentInclude,
    });
    if (!before) throw new NotFoundException('Payment not found');
    if (before.status === 'reversed') {
      throw new BadRequestException('Cannot update a reversed payment');
    }

    const employeeId = input.employeeId ?? Number(before.employeeId);
    const billingCycleId =
      input.billingCycleId !== undefined
        ? input.billingCycleId
        : before.billingCycleId === null
          ? undefined
          : Number(before.billingCycleId);

    if (input.amount !== undefined && input.amount <= 0) {
      throw new BadRequestException('Payment amount must be > 0');
    }

    if (before.status === 'allocated' || before.status === 'partially_allocated') {
      if (
        input.employeeId !== undefined ||
        input.billingCycleId !== undefined ||
        input.amount !== undefined
      ) {
        throw new BadRequestException(
          'Cannot change employee, billingCycle, or amount after allocation',
        );
      }
    }

    await this.assertEmployeeActive(employeeId);
    await this.assertBillingCycleWritable(billingCycleId);

    const data: Prisma.PaymentUncheckedUpdateInput = {};
    if (input.employeeId !== undefined) data.employeeId = BigInt(input.employeeId);
    if (input.billingCycleId !== undefined) data.billingCycleId = BigInt(input.billingCycleId);
    if (input.paymentDate !== undefined) data.paymentDate = parseDateOnly(input.paymentDate);
    if (input.amount !== undefined) data.amount = new Prisma.Decimal(input.amount);
    if (input.method !== undefined) data.method = input.method.trim();
    if (input.referenceNo !== undefined) data.referenceNo = input.referenceNo.trim() || null;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    const updated = await this.prisma.payment.update({
      where: { id: BigInt(id) },
      data,
      include: paymentInclude,
    });

    const item = this.toPaymentItem(updated);
    await this.auditService.log({
      actorUserId,
      entityName: 'payments',
      entityId: id,
      action: 'update',
      oldData: this.toPaymentItem(before),
      newData: item,
    });
    if (updated.status === 'allocated' || updated.status === 'partially_allocated') {
      await this.balancesService.recalculateEmployeeAllCycles(employeeId);
    }

    return item;
  }

  private async buildAllocationPlanTx(
    tx: Prisma.TransactionClient,
    payment: {
      id: bigint;
      employeeId: bigint;
      billingCycleId: bigint | null;
      amount: Prisma.Decimal;
      allocatedAmount: Prisma.Decimal;
      status: string;
    },
  ): Promise<{
    allocations: Array<{ billingCycleId: number; amount: Prisma.Decimal }>;
    leftover: Prisma.Decimal;
  }> {
    const amount = payment.amount;
    const alreadyAllocated = payment.allocatedAmount;
    const remaining = amount.sub(alreadyAllocated);

    if (remaining.lte(new Prisma.Decimal(0))) {
      throw new ConflictException('Payment is already fully allocated');
    }

    const rawBalances = await tx.$queryRaw<
      Array<{ billing_cycle_id: bigint; closing_balance: Prisma.Decimal }>
    >`
      SELECT ecb.billing_cycle_id, ecb.closing_balance
      FROM employee_cycle_balances ecb
      JOIN billing_cycles bc ON bc.id = ecb.billing_cycle_id
      WHERE ecb.employee_id = ${payment.employeeId}
        AND ecb.closing_balance > 0
        AND (${payment.billingCycleId}::bigint IS NULL OR ecb.billing_cycle_id = ${payment.billingCycleId})
      ORDER BY bc.start_date ASC, ecb.billing_cycle_id ASC
      FOR UPDATE
    `;

    const plan: Array<{ billingCycleId: number; amount: Prisma.Decimal }> = [];
    let remainingWork = new Prisma.Decimal(remaining);

    for (const row of rawBalances) {
      if (remainingWork.lte(new Prisma.Decimal(0))) break;
      const due = new Prisma.Decimal(row.closing_balance);
      const alloc = remainingWork.lt(due) ? remainingWork : due;
      if (alloc.gt(new Prisma.Decimal(0))) {
        plan.push({ billingCycleId: Number(row.billing_cycle_id), amount: alloc });
        remainingWork = remainingWork.sub(alloc);
      }
    }

    return { allocations: plan, leftover: remainingWork };
  }

  /** Cycle that would receive overpayment advance (same rules as applyAdvanceTx, read-only). */
  private async resolveAdvanceBillingCycleId(
    db: Pick<PrismaClient, 'billingCycle'>,
    preferredBillingCycleId: bigint | null,
  ): Promise<bigint | null> {
    let targetCycleId = preferredBillingCycleId;
    if (!targetCycleId) {
      const cycle = await db.billingCycle.findFirst({
        where: { status: { in: ['draft', 'open'] } },
        orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
        select: { id: true },
      });
      if (cycle) targetCycleId = cycle.id;
    }
    return targetCycleId;
  }

  private async applyAdvanceTx(
    tx: Prisma.TransactionClient,
    employeeId: bigint,
    preferredBillingCycleId: bigint | null,
    amount: Prisma.Decimal,
  ): Promise<number | null> {
    if (amount.lte(new Prisma.Decimal(0))) return null;

    const targetCycleId = await this.resolveAdvanceBillingCycleId(
      tx,
      preferredBillingCycleId,
    );

    if (!targetCycleId) {
      return null;
    }

    await tx.$executeRaw`
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
        ${employeeId},
        ${targetCycleId},
        0, 0, 0, 0, 0, ${amount}, false, NOW()
      )
      ON CONFLICT (employee_id, billing_cycle_id)
      DO UPDATE
      SET
        advance_balance = employee_cycle_balances.advance_balance + EXCLUDED.advance_balance,
        calculated_at = NOW()
    `;

    return Number(targetCycleId);
  }

  async allocationPreview(id: number): Promise<{
    paymentId: number;
    canAllocate: boolean;
    allocations: Array<{ billingCycleId: number; amount: string }>;
    leftover: string;
    advanceBillingCycleId: number | null;
  }> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: BigInt(id) },
      select: {
        id: true,
        employeeId: true,
        billingCycleId: true,
        amount: true,
        allocatedAmount: true,
        status: true,
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === 'reversed') {
      return {
        paymentId: id,
        canAllocate: false,
        allocations: [],
        leftover: '0',
        advanceBillingCycleId: null,
      };
    }

    const { allocations, leftover } = await this.prisma.$transaction(async (tx) =>
      this.buildAllocationPlanTx(tx, payment),
    );

    let advanceBillingCycleId: number | null = null;
    if (leftover.gt(new Prisma.Decimal(0))) {
      const advId = await this.resolveAdvanceBillingCycleId(
        this.prisma,
        payment.billingCycleId,
      );
      advanceBillingCycleId = advId === null ? null : Number(advId);
    }

    return {
      paymentId: id,
      canAllocate: true,
      allocations: allocations.map((a) => ({
        billingCycleId: a.billingCycleId,
        amount: a.amount.toString(),
      })),
      leftover: leftover.toString(),
      advanceBillingCycleId,
    };
  }

  async allocate(
    id: number,
    actorUserId: number,
    dryRun?: boolean,
  ): Promise<{
    payment: PaymentListItem;
    allocations: PaymentAllocationItem[];
    leftoverAppliedAsAdvance: string;
    advanceBillingCycleId: number | null;
    dryRun: boolean;
  }> {
    if (dryRun) {
      const preview = await this.allocationPreview(id);
      const payment = await this.get(id);
      return {
        payment,
        allocations: preview.allocations.map((a, idx) => ({
          id: -1 * (idx + 1),
          paymentId: id,
          employeeId: payment.employeeId,
          billingCycleId: a.billingCycleId,
          allocatedAmount: a.amount,
          createdAt: new Date().toISOString(),
          billingCycle: {
            id: a.billingCycleId,
            cycleCode: 'preview',
            status: 'preview',
          },
        })),
        leftoverAppliedAsAdvance: preview.leftover,
        advanceBillingCycleId: preview.advanceBillingCycleId,
        dryRun: true,
      };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id
        FROM payments
        WHERE id = ${BigInt(id)}
        FOR UPDATE
      `;

      const payment = await tx.payment.findUnique({
        where: { id: BigInt(id) },
        include: paymentInclude,
      });
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.status === 'reversed') {
        throw new BadRequestException('Cannot allocate a reversed payment');
      }

      await this.assertEmployeeActive(Number(payment.employeeId));
      await this.assertBillingCycleWritable(
        payment.billingCycleId === null ? undefined : Number(payment.billingCycleId),
      );

      const { allocations, leftover } = await this.buildAllocationPlanTx(tx, {
        id: payment.id,
        employeeId: payment.employeeId,
        billingCycleId: payment.billingCycleId,
        amount: payment.amount,
        allocatedAmount: payment.allocatedAmount,
        status: payment.status,
      });

      for (const alloc of allocations) {
        await tx.paymentAllocation.upsert({
          where: {
            paymentId_billingCycleId: {
              paymentId: payment.id,
              billingCycleId: BigInt(alloc.billingCycleId),
            },
          },
          create: {
            paymentId: payment.id,
            employeeId: payment.employeeId,
            billingCycleId: BigInt(alloc.billingCycleId),
            allocatedAmount: alloc.amount,
          },
          update: {
            allocatedAmount: {
              increment: alloc.amount,
            },
          },
        });

        await tx.$executeRaw`
          UPDATE employee_cycle_balances
          SET
            total_paid = total_paid + ${alloc.amount},
            closing_balance = GREATEST(closing_balance - ${alloc.amount}, 0),
            carried_forward_balance = GREATEST(carried_forward_balance - ${alloc.amount}, 0),
            calculated_at = NOW()
          WHERE employee_id = ${payment.employeeId}
            AND billing_cycle_id = ${BigInt(alloc.billingCycleId)}
        `;
      }

      const allocatedNow = allocations.reduce(
        (acc, a) => acc.add(a.amount),
        new Prisma.Decimal(0),
      );

      const advanceCycleId = await this.applyAdvanceTx(
        tx,
        payment.employeeId,
        payment.billingCycleId,
        leftover,
      );

      const consumedTotal = allocatedNow.add(leftover);
      const nextAllocatedAmount = payment.allocatedAmount.add(consumedTotal);
      const isFullyAllocated = nextAllocatedAmount.gte(payment.amount);

      const advanceAppliedPatch =
        advanceCycleId != null && leftover.gt(new Prisma.Decimal(0))
          ? { advanceAppliedBillingCycleId: BigInt(advanceCycleId) }
          : {};

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          allocatedAmount: nextAllocatedAmount,
          allocatedAt: new Date(),
          status: isFullyAllocated ? 'allocated' : 'partially_allocated',
          ...advanceAppliedPatch,
        },
        include: paymentInclude,
      });

      const allocationRows = await tx.paymentAllocation.findMany({
        where: { paymentId: payment.id },
        include: {
          billingCycle: { select: { id: true, cycleCode: true, status: true } },
        },
        orderBy: { id: 'asc' },
      });

      return {
        before: this.toPaymentItem(payment),
        payment: this.toPaymentItem(updatedPayment),
        allocations: allocationRows.map((a) => this.toAllocationItem(a)),
        leftover,
        advanceCycleId,
      };
    });

    await this.auditService.log({
      actorUserId,
      entityName: 'payments',
      entityId: id,
      action: 'allocate',
      oldData: result.before,
      newData: {
        payment: result.payment,
        allocations: result.allocations,
        leftoverAppliedAsAdvance: result.leftover.toString(),
        advanceBillingCycleId: result.advanceCycleId,
      },
    });
    await this.balancesService.recalculateEmployeeAllCycles(result.payment.employeeId);

    return {
      payment: result.payment,
      allocations: result.allocations,
      leftoverAppliedAsAdvance: result.leftover.toString(),
      advanceBillingCycleId: result.advanceCycleId,
      dryRun: false,
    };
  }

  async reverse(
    id: number,
    actorUserId: number,
    reason?: string,
  ): Promise<{ success: boolean; payment: PaymentListItem }> {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id
        FROM payments
        WHERE id = ${BigInt(id)}
        FOR UPDATE
      `;

      const payment = await tx.payment.findUnique({
        where: { id: BigInt(id) },
        include: paymentInclude,
      });
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.status === 'reversed') {
        throw new ConflictException('Payment is already reversed');
      }

      const allocations = await tx.paymentAllocation.findMany({
        where: { paymentId: payment.id },
      });

      let allocatedSum = new Prisma.Decimal(0);
      for (const alloc of allocations) {
        allocatedSum = allocatedSum.add(alloc.allocatedAmount);
        await tx.$executeRaw`
          UPDATE employee_cycle_balances
          SET
            total_paid = GREATEST(total_paid - ${alloc.allocatedAmount}, 0),
            closing_balance = closing_balance + ${alloc.allocatedAmount},
            carried_forward_balance = carried_forward_balance + ${alloc.allocatedAmount},
            calculated_at = NOW()
          WHERE employee_id = ${alloc.employeeId}
            AND billing_cycle_id = ${alloc.billingCycleId}
        `;
      }

      if (allocations.length > 0) {
        await tx.paymentAllocation.deleteMany({ where: { paymentId: payment.id } });
      }

      const leftoverAdvance = payment.amount.sub(allocatedSum);
      if (leftoverAdvance.gt(new Prisma.Decimal(0))) {
        const cycleId =
          payment.advanceAppliedBillingCycleId ?? payment.billingCycleId;
        if (cycleId) {
          await tx.$executeRaw`
            UPDATE employee_cycle_balances
            SET
              advance_balance = GREATEST(advance_balance - ${leftoverAdvance}, 0),
              calculated_at = NOW()
            WHERE employee_id = ${payment.employeeId}
              AND billing_cycle_id = ${cycleId}
          `;
        }
      }

      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'reversed',
          reversedAt: new Date(),
          reversalReason: reason?.trim() || null,
          allocatedAmount: new Prisma.Decimal(0),
          allocatedAt: null,
          advanceAppliedBillingCycleId: null,
        },
        include: paymentInclude,
      });

      return {
        before: this.toPaymentItem(payment),
        payment: this.toPaymentItem(updated),
      };
    });

    await this.auditService.log({
      actorUserId,
      entityName: 'payments',
      entityId: id,
      action: 'reverse',
      oldData: result.before,
      newData: result.payment,
    });
    await this.balancesService.recalculateEmployeeAllCycles(result.payment.employeeId);

    return { success: true, payment: result.payment };
  }
}
