import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TestSupportController } from './test-support.controller';
import { TestSupportLogStore } from './test-support-log.store';
import { TestSupportService } from './test-support.service';

@Module({
  imports: [PrismaModule, BookingsModule],
  controllers: [TestSupportController],
  providers: [TestSupportLogStore, TestSupportService],
})
export class TestSupportModule {}
