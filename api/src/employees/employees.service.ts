import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BalancesService } from '../balances/balances.service';
import type { EmployeeListItem } from './employee.types';

const departmentSelect = {
  id: true,
  code: true,
  name: true,
} as const;

function normalizeEmployeeCode(code: string): string {
  return code.trim();
}

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly balancesService: BalancesService,
  ) {}

  private async assertDepartmentActiveForAssign(departmentId: number): Promise<void> {
    const dept = await this.prisma.department.findUnique({
      where: { id: BigInt(departmentId) },
    });
    if (!dept) {
      throw new NotFoundException('Department not found');
    }
    if (!dept.isActive) {
      throw new BadRequestException('Cannot assign employee to an inactive department');
    }
  }

  async create(
    input: {
      employeeCode: string;
      fullName: string;
      departmentId: number;
      phone?: string;
    },
    actorUserId?: number,
  ): Promise<EmployeeListItem> {
    const employeeCode = normalizeEmployeeCode(input.employeeCode);
    const fullName = input.fullName.trim();
    const phoneTrim =
      typeof input.phone === 'string' ? input.phone.trim() : '';
    const phonePayload =
      phoneTrim !== '' ? { phone: phoneTrim } : { phone: null as string | null };

    await this.assertDepartmentActiveForAssign(input.departmentId);

    try {
      const created = await this.prisma.employee.create({
        data: {
          employeeCode,
          fullName,
          departmentId: BigInt(input.departmentId),
          ...phonePayload,
        },
        include: { department: { select: departmentSelect } },
      });
      const item = this.toListItem(created);
      await this.auditService.log({
        actorUserId,
        entityName: 'employees',
        entityId: Number(created.id),
        action: 'create',
        newData: item,
      });
      await this.balancesService.recalculateEmployeeAllCycles(Number(created.id));
      return item;
    } catch (err: unknown) {
      const codeErr = err as { code?: string };
      if (codeErr?.code === 'P2002') {
        throw new BadRequestException('Employee code already exists');
      }
      throw err;
    }
  }

  async list(params?: {
    q?: string;
    departmentId?: number;
    isActive?: boolean;
    skip?: number;
    take?: number;
  }): Promise<{ items: EmployeeListItem[]; total: number }> {
    const q = params?.q?.trim();
    const where: {
      departmentId?: bigint;
      isActive?: boolean;
      OR?: Array<
        | { fullName: { contains: string; mode: 'insensitive' } }
        | { employeeCode: { contains: string; mode: 'insensitive' } }
        | { phone: { contains: string; mode: 'insensitive' } }
      >;
    } = {
      ...(typeof params?.departmentId === 'number'
        ? { departmentId: BigInt(params.departmentId) }
        : {}),
      ...(typeof params?.isActive === 'boolean' ? { isActive: params.isActive } : {}),
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: 'insensitive' as const } },
              { employeeCode: { contains: q, mode: 'insensitive' as const } },
              { phone: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const take = Math.min(Math.max(params?.take ?? 50, 1), 100);
    const skip = Math.max(params?.skip ?? 0, 0);

    const [rows, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take,
        include: { department: { select: departmentSelect } },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return { items: rows.map((r) => this.toListItem(r)), total };
  }

  async get(id: number): Promise<EmployeeListItem> {
    const row = await this.prisma.employee.findUnique({
      where: { id: BigInt(id) },
      include: { department: { select: departmentSelect } },
    });
    if (!row) {
      throw new NotFoundException('Employee not found');
    }
    return this.toListItem(row);
  }

  async update(
    id: number,
    input: {
      employeeCode?: string;
      fullName?: string;
      departmentId?: number;
      phone?: string;
    },
    actorUserId?: number,
  ): Promise<EmployeeListItem> {
    const before = await this.prisma.employee.findUnique({
      where: { id: BigInt(id) },
      include: { department: { select: departmentSelect } },
    });
    if (!before) {
      throw new NotFoundException('Employee not found');
    }

    const nextDeptId =
      typeof input.departmentId === 'number'
        ? input.departmentId
        : Number(before.departmentId);

    if (typeof input.departmentId === 'number') {
      await this.assertDepartmentActiveForAssign(input.departmentId);
    }

    const data: {
      employeeCode?: string;
      fullName?: string;
      departmentId?: bigint;
      phone?: string | null;
    } = {};

    if (typeof input.employeeCode === 'string') {
      data.employeeCode = normalizeEmployeeCode(input.employeeCode);
    }
    if (typeof input.fullName === 'string') {
      data.fullName = input.fullName.trim();
    }
    if (typeof input.departmentId === 'number') {
      data.departmentId = BigInt(input.departmentId);
    }
    if (typeof input.phone === 'string') {
      const p = input.phone.trim();
      data.phone = p === '' ? null : p;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    try {
      const updated = await this.prisma.employee.update({
        where: { id: BigInt(id) },
        data,
        include: { department: { select: departmentSelect } },
      });
      const item = this.toListItem(updated);
      await this.auditService.log({
        actorUserId,
        entityName: 'employees',
        entityId: id,
        action: 'update',
        oldData: this.toListItem(before),
        newData: item,
      });
      await this.balancesService.recalculateEmployeeAllCycles(id);
      return item;
    } catch (err: unknown) {
      const codeErr = err as { code?: string };
      if (codeErr?.code === 'P2025') {
        throw new NotFoundException('Employee not found');
      }
      if (codeErr?.code === 'P2002') {
        throw new BadRequestException('Employee code already exists');
      }
      throw err;
    }
  }

  async setActive(
    id: number,
    isActive: boolean,
    actorUserId?: number,
  ): Promise<EmployeeListItem> {
    const before = await this.prisma.employee.findUnique({
      where: { id: BigInt(id) },
      include: { department: { select: departmentSelect } },
    });
    if (!before) {
      throw new NotFoundException('Employee not found');
    }
    try {
      const updated = await this.prisma.employee.update({
        where: { id: BigInt(id) },
        data: { isActive },
        include: { department: { select: departmentSelect } },
      });
      const item = this.toListItem(updated);
      await this.auditService.log({
        actorUserId,
        entityName: 'employees',
        entityId: id,
        action: isActive ? 'activate' : 'deactivate',
        oldData: this.toListItem(before),
        newData: item,
      });
      return item;
    } catch (err: unknown) {
      const codeErr = err as { code?: string };
      if (codeErr?.code === 'P2025') {
        throw new NotFoundException('Employee not found');
      }
      throw err;
    }
  }

  private toListItem(row: {
    id: bigint;
    employeeCode: string;
    fullName: string;
    departmentId: bigint;
    phone: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    department: { id: bigint; code: string; name: string };
  }): EmployeeListItem {
    return {
      id: Number(row.id),
      employeeCode: row.employeeCode,
      fullName: row.fullName,
      departmentId: Number(row.departmentId),
      department: {
        id: Number(row.department.id),
        code: row.department.code,
        name: row.department.name,
      },
      phone: row.phone,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
