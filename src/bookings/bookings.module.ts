import { Module } from '@nestjs/common';
import { BookingLifecycleAutomationService } from './booking-lifecycle-automation.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TeacherAvailabilityModule } from '../teacher-availability/teacher-availability.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [PrismaModule, TeacherAvailabilityModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingLifecycleAutomationService],
  exports: [BookingsService],
})
export class BookingsModule {}
