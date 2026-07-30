import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    actorUserId?: number;
    entityName: string;
    entityId: number;
    action: string;
    oldData?: unknown;
    newData?: unknown;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: typeof params.actorUserId === 'number' ? BigInt(params.actorUserId) : null,
        entityName: params.entityName,
        entityId: BigInt(params.entityId),
        action: params.action,
        oldData: params.oldData as any,
        newData: params.newData as any,
      },
    });
  }

  async listAuditLogs(params?: {
    entityName?: string;
    skip?: number;
    take?: number;
  }): Promise<{
    items: Array<{
      id: number;
      userId: number | null;
      entityName: string;
      entityId: number;
      action: string;
      oldData: unknown;
      newData: unknown;
      createdAt: string;
    }>;
    total: number;
  }> {
    const take = Math.min(Math.max(params?.take ?? 50, 1), 100);
    const skip = Math.max(params?.skip ?? 0, 0);
    const name = params?.entityName?.trim();
    const where = name ? { entityName: name } : {};

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        id: Number(r.id),
        userId: r.userId !== null ? Number(r.userId) : null,
        entityName: r.entityName,
        entityId: Number(r.entityId),
        action: r.action,
        oldData: r.oldData,
        newData: r.newData,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
    };
  }
}

