import 'dotenv/config';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('Missing DATABASE_URL for Prisma adapter');
    }
    super({
      adapter: new PrismaPg({ connectionString: databaseUrl }),
    });
  }

  async onModuleInit() {
    await this.$connect(); // 连接到数据库
  }

  async onModuleDestroy() {
    await this.$disconnect(); // 在应用关闭前断开数据库连接
  }
}
