import 'dotenv/config';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      // Prisma v7 requires a non-empty options object; throw a clear error.
      super({
        adapter: new PrismaPg({
          connectionString: 'postgresql://localhost:5432/postgres',
        }),
      });
      throw new Error(
        'DATABASE_URL is missing. Create `api/.env` and set DATABASE_URL before starting the API.',
      );
    }

    const adapter = new PrismaPg({ connectionString });
    super({
      adapter,
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  // enableShutdownHooks intentionally omitted (adapter client types differ).
}
