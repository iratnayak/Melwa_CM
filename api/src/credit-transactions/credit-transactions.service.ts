import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BalancesService } from '../balances/balances.service';
import type {
  CreditTransactionListItem,
  CreditTransactionType,
} from './credit-transaction.types';

const includeShape = {
  employee: { select: { id: true, employeeCode: true, fullName: true, isActive: true } },
  billingCycle: { select: { id: true, cycleCode: true, status: true } },
  enteredByUser: { select: { id: true, name: true, email: true } },
} as const;

function parseDateOnly(iso: string): Date {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException('Invalid txnDate');
  }
  return d;
}

function dateOnlyToIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class CreditTransactionsService {
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
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    if (!employee.isActive) {
      throw new BadRequestException('Cannot add transaction for an inactive employee');
    }
  }

  private async assertBillingCycleWritable(billingCycleId: number): Promise<void> {
    const cycle = await this.prisma.billingCycle.findUnique({
      where: { id: BigInt(billingCycleId) },
      select: { id: true, status: true },
    });
    if (!cycle) {
      throw new NotFoundException('Billing cycle not found');
    }
    if (cycle.status === 'closed') {
      throw new BadRequestException('Cannot modify transactions in a closed billing cycle');
    }
  }

  private async assertNotDuplicate(input: {
    employeeId: number;
    billingCycleId: number;
    txnDate: Date;
    amount: Prisma.Decimal;
    transactionType: CreditTransactionType;
    description: string | null;
    excludeId?: number;
  }): Promise<void> {
    const dup = await this.prisma.creditTransaction.findFirst({
      where: {
        employeeId: BigInt(input.employeeId),
        billingCycleId: BigInt(input.billingCycleId),
        txnDate: input.txnDate,
        amount: input.amount,
        transactionType: input.transactionType,
        description: input.description,
        ...(typeof input.excludeId === 'number'
          ? { id: { not: BigInt(input.excludeId) } }
          : {}),
      },
      select: { id: true },
    });

    if (dup) {
      throw new BadRequestException(
        'Similar credit transaction already exists. Please verify before saving duplicate entries.',
      );
    }
  }

  private async recalculateCycleBalance(
    employeeId: number,
    billingCycleId: number,
  ): Promise<void> {
    await this.balancesService.recalculateCycleBalance(employeeId, billingCycleId);
  }

  async create(
    input: {
      employeeId: number;
      billingCycleId: number;
      txnDate: string;
      description?: string;
      amount: number;
      transactionType?: CreditTransactionType;
      sourceReference?: string;
    },
    actorUserId: number,
  ): Promise<CreditTransactionListItem> {
    const txnDate = parseDateOnly(input.txnDate);
    const description =
      typeof input.description === 'string' ? input.description.trim() : '';
    const descriptionFinal = description ? description : null;
    const reference =
      typeof input.sourceReference === 'string' ? input.sourceReference.trim() : '';

    const transactionType = input.transactionType ?? 'purchase';
    if (input.amount < 0) {
      throw new BadRequestException('Amount must be >= 0');
    }

    await this.assertEmployeeActive(input.employeeId);
    await this.assertBillingCycleWritable(input.billingCycleId);

    if (transactionType === 'reversal' && !reference) {
      throw new BadRequestException(
        'sourceReference is required for reversal transactions',
      );
    }

    const fullDescription = reference
      ? `${descriptionFinal ?? ''}${descriptionFinal ? ' | ' : ''}ref:${reference}`
      : descriptionFinal;

    const amountDecimal = new Prisma.Decimal(input.amount);
    await this.assertNotDuplicate({
      employeeId: input.employeeId,
      billingCycleId: input.billingCycleId,
      txnDate,
      amount: amountDecimal,
      transactionType,
      description: fullDescription,
    });

    const created = await this.prisma.creditTransaction.create({
      data: {
        employeeId: BigInt(input.employeeId),
        billingCycleId: BigInt(input.billingCycleId),
        enteredByUserId: BigInt(actorUserId),
        txnDate,
        description: fullDescription,
        amount: amountDecimal,
        transactionType,
      },
      include: includeShape,
    });

    const item = this.toListItem(created);
    await this.auditService.log({
      actorUserId,
      entityName: 'credit_transactions',
      entityId: Number(created.id),
      action: 'create',
      newData: item,
    });

    await this.recalculateCycleBalance(input.employeeId, input.billingCycleId);

    return item;
  }

  async list(params?: {
    q?: string;
    employeeId?: number;
    billingCycleId?: number;
    transactionType?: CreditTransactionType;
    fromDate?: string;
    toDate?: string;
    skip?: number;
    take?: number;
  }): Promise<{ items: CreditTransactionListItem[]; total: number }> {
    const q = params?.q?.trim();
    const dateFilter: Prisma.DateTimeFilter | undefined =
      params?.fromDate || params?.toDate
        ? {
            ...(params.fromDate ? { gte: parseDateOnly(params.fromDate) } : {}),
            ...(params.toDate ? { lte: parseDateOnly(params.toDate) } : {}),
          }
        : undefined;

    const where: Prisma.CreditTransactionWhereInput = {
      ...(typeof params?.employeeId === 'number'
        ? { employeeId: BigInt(params.employeeId) }
        : {}),
      ...(typeof params?.billingCycleId === 'number'
        ? { billingCycleId: BigInt(params.billingCycleId) }
        : {}),
      ...(params?.transactionType ? { transactionType: params.transactionType } : {}),
      ...(dateFilter ? { txnDate: dateFilter } : {}),
      ...(q
        ? {
            OR: [
              { description: { contains: q, mode: 'insensitive' } },
              { employee: { fullName: { contains: q, mode: 'insensitive' } } },
              { employee: { employeeCode: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const take = Math.min(Math.max(params?.take ?? 50, 1), 100);
    const skip = Math.max(params?.skip ?? 0, 0);

    const [rows, total] = await Promise.all([
      this.prisma.creditTransaction.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take,
        include: includeShape,
      }),
      this.prisma.creditTransaction.count({ where }),
    ]);

    return { items: rows.map((r) => this.toListItem(r)), total };
  }

  async get(id: number): Promise<CreditTransactionListItem> {
    const row = await this.prisma.creditTransaction.findUnique({
      where: { id: BigInt(id) },
      include: includeShape,
    });
    if (!row) {
      throw new NotFoundException('Credit transaction not found');
    }
    return this.toListItem(row);
  }

  async update(
    id: number,
    input: {
      employeeId?: number;
      billingCycleId?: number;
      txnDate?: string;
      description?: string;
      amount?: number;
      transactionType?: CreditTransactionType;
      sourceReference?: string;
    },
    actorUserId: number,
  ): Promise<CreditTransactionListItem> {
    const before = await this.prisma.creditTransaction.findUnique({
      where: { id: BigInt(id) },
      include: includeShape,
    });
    if (!before) {
      throw new NotFoundException('Credit transaction not found');
    }

    const employeeId = input.employeeId ?? Number(before.employeeId);
    const billingCycleId = input.billingCycleId ?? Number(before.billingCycleId);
    const txnDate = input.txnDate ? parseDateOnly(input.txnDate) : before.txnDate;
    const transactionType = input.transactionType ?? (before.transactionType as CreditTransactionType);

    if (input.amount !== undefined && input.amount < 0) {
      throw new BadRequestException('Amount must be >= 0');
    }
    const amountDecimal =
      input.amount !== undefined ? new Prisma.Decimal(input.amount) : before.amount;

    await this.assertEmployeeActive(employeeId);
    await this.assertBillingCycleWritable(billingCycleId);

    const descriptionRaw =
      input.description !== undefined
        ? input.description.trim()
        : (before.description ?? '').trim();
    const reference =
      typeof input.sourceReference === 'string' ? input.sourceReference.trim() : '';

    if (transactionType === 'reversal' && !reference && !descriptionRaw.includes('ref:')) {
      throw new BadRequestException(
        'sourceReference is required for reversal transactions',
      );
    }

    const descriptionBase = descriptionRaw || null;
    const finalDescription = reference
      ? `${descriptionBase ?? ''}${descriptionBase ? ' | ' : ''}ref:${reference}`
      : descriptionBase;

    await this.assertNotDuplicate({
      employeeId,
      billingCycleId,
      txnDate,
      amount: amountDecimal,
      transactionType,
      description: finalDescription,
      excludeId: id,
    });

    const data: Prisma.CreditTransactionUncheckedUpdateInput = {};
    if (input.employeeId !== undefined) data.employeeId = BigInt(input.employeeId);
    if (input.billingCycleId !== undefined)
      data.billingCycleId = BigInt(input.billingCycleId);
    if (input.txnDate !== undefined) data.txnDate = txnDate;
    if (input.description !== undefined || input.sourceReference !== undefined)
      data.description = finalDescription;
    if (input.amount !== undefined) data.amount = amountDecimal;
    if (input.transactionType !== undefined) data.transactionType = transactionType;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    const updated = await this.prisma.creditTransaction.update({
      where: { id: BigInt(id) },
      data,
      include: includeShape,
    });

    const item = this.toListItem(updated);
    await this.auditService.log({
      actorUserId,
      entityName: 'credit_transactions',
      entityId: id,
      action: 'update',
      oldData: this.toListItem(before),
      newData: item,
    });

    await this.recalculateCycleBalance(employeeId, billingCycleId);

    return item;
  }

  async remove(id: number, actorUserId: number): Promise<{ success: boolean }> {
    const before = await this.prisma.creditTransaction.findUnique({
      where: { id: BigInt(id) },
      include: includeShape,
    });
    if (!before) {
      throw new NotFoundException('Credit transaction not found');
    }

    await this.assertBillingCycleWritable(Number(before.billingCycleId));

    await this.prisma.creditTransaction.delete({ where: { id: BigInt(id) } });

    await this.auditService.log({
      actorUserId,
      entityName: 'credit_transactions',
      entityId: id,
      action: 'delete',
      oldData: this.toListItem(before),
    });

    await this.recalculateCycleBalance(
      Number(before.employeeId),
      Number(before.billingCycleId),
    );

    return { success: true };
  }

  private toListItem(row: {
    id: bigint;
    employeeId: bigint;
    billingCycleId: bigint;
    enteredByUserId: bigint;
    txnDate: Date;
    description: string | null;
    amount: Prisma.Decimal;
    transactionType: string;
    createdAt: Date;
    employee: { id: bigint; employeeCode: string; fullName: string };
    billingCycle: { id: bigint; cycleCode: string; status: string };
    enteredByUser: { id: bigint; name: string; email: string };
  }): CreditTransactionListItem {
    return {
      id: Number(row.id),
      employeeId: Number(row.employeeId),
      billingCycleId: Number(row.billingCycleId),
      enteredByUserId: Number(row.enteredByUserId),
      txnDate: dateOnlyToIso(row.txnDate),
      description: row.description,
      amount: row.amount.toString(),
      transactionType: row.transactionType as CreditTransactionType,
      createdAt: row.createdAt.toISOString(),
      employee: {
        id: Number(row.employee.id),
        employeeCode: row.employee.employeeCode,
        fullName: row.employee.fullName,
      },
      billingCycle: {
        id: Number(row.billingCycle.id),
        cycleCode: row.billingCycle.cycleCode,
        status: row.billingCycle.status,
      },
      enteredByUser: {
        id: Number(row.enteredByUser.id),
        name: row.enteredByUser.name,
        email: row.enteredByUser.email,
      },
    };
  }
}
