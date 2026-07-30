import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { compare, hash } from 'bcryptjs';
import { SafeUser, UserListItem, UserRecord, UserRole } from './user.types';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit(): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@melwa.local';
    const adminPassword = process.env.ADMIN_PASSWORD ?? 'Admin@123';

    const adminHash = await hash(adminPassword, 10);

    const email = adminEmail.toLowerCase();

    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return;
    }

    await this.prisma.user.create({
      data: {
        name: 'System Admin',
        email,
        role: 'admin',
        isActive: true,
        passwordHash: adminHash,
      },
    });
  }

  async validateCredentials(
    identifier: string,
    plainPassword: string,
  ): Promise<UserRecord | null> {
    const key = identifier.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: key },
    });

    if (!user || !user.isActive) {
      return null;
    }

    const isValid = await compare(plainPassword, user.passwordHash);
    if (!isValid) {
      return null;
    }

    return this.toUserRecord(user);
  }

  async findById(id: number): Promise<UserRecord | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(id) },
    });
    return user ? this.toUserRecord(user) : undefined;
  }

  toSafeUser(user: UserRecord): SafeUser {
    const { passwordHash, currentRefreshTokenHash, ...safe } = user;
    return safe;
  }

  async createUser(input: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
  }, actorUserId?: number): Promise<UserListItem> {
    const email = input.email.trim().toLowerCase();
    const passwordHash = await hash(input.password, 10);

    try {
      const created = await this.prisma.user.create({
        data: {
          name: input.name,
          email,
          passwordHash,
          role: input.role,
          isActive: true,
        },
      });
      const createdItem = this.toUserListItem(created);
      await this.auditService.log({
        actorUserId,
        entityName: 'users',
        entityId: Number(created.id),
        action: 'create',
        newData: createdItem,
      });
      return createdItem;
    } catch (err: any) {
      // Prisma unique constraint: email
      if (err?.code === 'P2002') {
        throw new BadRequestException('Email already exists');
      }
      throw err;
    }
  }

  async listUsers(params?: {
    q?: string;
    role?: UserRole;
    isActive?: boolean;
    skip?: number;
    take?: number;
  }): Promise<{ items: UserListItem[]; total: number }> {
    const q = params?.q?.trim();
    const where: any = {
      ...(params?.role ? { role: params.role } : {}),
      ...(typeof params?.isActive === 'boolean' ? { isActive: params.isActive } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const take = Math.min(Math.max(params?.take ?? 50, 1), 100);
    const skip = Math.max(params?.skip ?? 0, 0);

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items: items.map((u) => this.toUserListItem(u)), total };
  }

  async getUser(id: number): Promise<UserListItem> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(id) },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toUserListItem(user);
  }

  async updateUser(
    id: number,
    input: { name?: string; email?: string; role?: UserRole },
    actorUserId?: number,
  ): Promise<UserListItem> {
    const before = await this.prisma.user.findUnique({
      where: { id: BigInt(id) },
    });
    if (!before) {
      throw new NotFoundException('User not found');
    }
    const data: any = {};
    if (typeof input.name === 'string') data.name = input.name;
    if (typeof input.email === 'string') data.email = input.email.trim().toLowerCase();
    if (typeof input.role === 'string') data.role = input.role;

    try {
      const updated = await this.prisma.user.update({
        where: { id: BigInt(id) },
        data,
      });
      const updatedItem = this.toUserListItem(updated);
      await this.auditService.log({
        actorUserId,
        entityName: 'users',
        entityId: id,
        action: 'update',
        oldData: this.toUserListItem(before),
        newData: updatedItem,
      });
      return updatedItem;
    } catch (err: any) {
      if (err?.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      if (err?.code === 'P2002') {
        throw new BadRequestException('Email already exists');
      }
      throw err;
    }
  }

  async setActive(
    id: number,
    isActive: boolean,
    actorUserId?: number,
  ): Promise<UserListItem> {
    const before = await this.prisma.user.findUnique({
      where: { id: BigInt(id) },
    });
    if (!before) {
      throw new NotFoundException('User not found');
    }
    try {
      const updated = await this.prisma.user.update({
        where: { id: BigInt(id) },
        data: { isActive },
      });
      const updatedItem = this.toUserListItem(updated);
      await this.auditService.log({
        actorUserId,
        entityName: 'users',
        entityId: id,
        action: isActive ? 'activate' : 'deactivate',
        oldData: this.toUserListItem(before),
        newData: updatedItem,
      });
      return updatedItem;
    } catch (err: any) {
      if (err?.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      throw err;
    }
  }

  async resetPassword(
    id: number,
    newPassword: string,
    actorUserId?: number,
  ): Promise<{ success: boolean }> {
    const passwordHash = await hash(newPassword, 10);
    try {
      await this.prisma.user.update({
        where: { id: BigInt(id) },
        data: {
          passwordHash,
          currentRefreshTokenHash: null,
        },
      });
      await this.auditService.log({
        actorUserId,
        entityName: 'users',
        entityId: id,
        action: 'reset_password',
      });
      return { success: true };
    } catch (err: any) {
      if (err?.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      throw err;
    }
  }

  async changeOwnPassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
    actorUserId?: number,
  ): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { passwordHash: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isValid = await compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: {
        passwordHash,
        currentRefreshTokenHash: null,
      },
    });

    await this.auditService.log({
      actorUserId,
      entityName: 'users',
      entityId: userId,
      action: 'change_password',
    });

    return { success: true };
  }

  async setRefreshToken(userId: number, refreshToken: string): Promise<void> {
    const hashed = await hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: { currentRefreshTokenHash: hashed },
    });
  }

  async isRefreshTokenValid(userId: number, refreshToken: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { currentRefreshTokenHash: true },
    });

    if (!user?.currentRefreshTokenHash) {
      return false;
    }

    return compare(refreshToken, user.currentRefreshTokenHash);
  }

  async clearRefreshToken(userId: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: { currentRefreshTokenHash: null },
    });
  }

  private toUserRecord(user: {
    id: bigint;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    passwordHash: string;
    currentRefreshTokenHash: string | null;
  }): UserRecord {
    return {
      id: Number(user.id),
      name: user.name,
      email: user.email,
      role: user.role as UserRecord['role'],
      isActive: user.isActive,
      passwordHash: user.passwordHash,
      currentRefreshTokenHash: user.currentRefreshTokenHash ?? undefined,
    };
  }

  private toUserListItem(user: {
    id: bigint;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): UserListItem {
    return {
      id: Number(user.id),
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
