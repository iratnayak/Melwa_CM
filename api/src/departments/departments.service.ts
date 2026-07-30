import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { DepartmentListItem } from './department.types';

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    input: { code: string; name: string; description?: string },
    actorUserId?: number,
  ): Promise<DepartmentListItem> {
    const code = normalizeCode(input.code);
    const name = input.name.trim();
    const descTrim =
      typeof input.description === 'string' ? input.description.trim() : '';
    const descriptionPayload =
      descTrim !== '' ? { description: descTrim } : {};

    try {
      const created = await this.prisma.department.create({
        data: {
          code,
          name,
          ...descriptionPayload,
        },
      });
      const item = this.toListItem(created);
      await this.auditService.log({
        actorUserId,
        entityName: 'departments',
        entityId: Number(created.id),
        action: 'create',
        newData: item,
      });
      return item;
    } catch (err: unknown) {
      const codeErr = err as { code?: string };
      if (codeErr?.code === 'P2002') {
        throw new BadRequestException('Department code already exists');
      }
      throw err;
    }
  }

  async list(params?: {
    q?: string;
    isActive?: boolean;
    skip?: number;
    take?: number;
  }): Promise<{ items: DepartmentListItem[]; total: number }> {
    const q = params?.q?.trim();
    const where: {
      isActive?: boolean;
      OR?: Array<{ code: object } | { name: object } | { description: object }>;
    } = {
      ...(typeof params?.isActive === 'boolean' ? { isActive: params.isActive } : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: 'insensitive' as const } },
              { name: { contains: q, mode: 'insensitive' as const } },
              { description: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const take = Math.min(Math.max(params?.take ?? 50, 1), 100);
    const skip = Math.max(params?.skip ?? 0, 0);

    const [rows, total] = await Promise.all([
      this.prisma.department.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take,
      }),
      this.prisma.department.count({ where }),
    ]);

    return { items: rows.map((r) => this.toListItem(r)), total };
  }

  async get(id: number): Promise<DepartmentListItem> {
    const row = await this.prisma.department.findUnique({
      where: { id: BigInt(id) },
    });
    if (!row) {
      throw new NotFoundException('Department not found');
    }
    return this.toListItem(row);
  }

  async update(
    id: number,
    input: { code?: string; name?: string; description?: string },
    actorUserId?: number,
  ): Promise<DepartmentListItem> {
    const before = await this.prisma.department.findUnique({
      where: { id: BigInt(id) },
    });
    if (!before) {
      throw new NotFoundException('Department not found');
    }

    const data: {
      code?: string;
      name?: string;
      description?: string | null;
    } = {};
    if (typeof input.code === 'string') data.code = normalizeCode(input.code);
    if (typeof input.name === 'string') data.name = input.name.trim();
    if (typeof input.description === 'string') {
      const d = input.description.trim();
      data.description = d === '' ? null : d;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    try {
      const updated = await this.prisma.department.update({
        where: { id: BigInt(id) },
        data,
      });
      const item = this.toListItem(updated);
      await this.auditService.log({
        actorUserId,
        entityName: 'departments',
        entityId: id,
        action: 'update',
        oldData: this.toListItem(before),
        newData: item,
      });
      return item;
    } catch (err: unknown) {
      const codeErr = err as { code?: string };
      if (codeErr?.code === 'P2025') {
        throw new NotFoundException('Department not found');
      }
      if (codeErr?.code === 'P2002') {
        throw new BadRequestException('Department code already exists');
      }
      throw err;
    }
  }

  async setActive(
    id: number,
    isActive: boolean,
    actorUserId?: number,
  ): Promise<DepartmentListItem> {
    const before = await this.prisma.department.findUnique({
      where: { id: BigInt(id) },
    });
    if (!before) {
      throw new NotFoundException('Department not found');
    }

    if (!isActive) {
      const assigned = await this.prisma.employee.count({
        where: { departmentId: BigInt(id) },
      });
      if (assigned > 0) {
        throw new BadRequestException(
          'Cannot deactivate department while employees are assigned to it',
        );
      }
    }

    try {
      const updated = await this.prisma.department.update({
        where: { id: BigInt(id) },
        data: { isActive },
      });
      const item = this.toListItem(updated);
      await this.auditService.log({
        actorUserId,
        entityName: 'departments',
        entityId: id,
        action: isActive ? 'activate' : 'deactivate',
        oldData: this.toListItem(before),
        newData: item,
      });
      return item;
    } catch (err: unknown) {
      const codeErr = err as { code?: string };
      if (codeErr?.code === 'P2025') {
        throw new NotFoundException('Department not found');
      }
      throw err;
    }
  }

  private toListItem(row: {
    id: bigint;
    code: string;
    name: string;
    description: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): DepartmentListItem {
    return {
      id: Number(row.id),
      code: row.code,
      name: row.name,
      description: row.description,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
