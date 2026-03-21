import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AddressesModule } from './addresses/addresses.module';
import { BookingsModule } from './bookings/bookings.module';
import { GuardiansModule } from './guardians/guardians.module';
import { LessonsModule } from './lessons/lessons.module';
import { StudentsModule } from './students/students.module';
import { TeacherReviewsModule } from './teacher-reviews/teacher-reviews.module';
import { TeachersModule } from './teachers/teachers.module';
import { SubjectsModule } from './subjects/subjects.module';
import { CrmModule } from './crm/crm.module';
import { TestSupportModule } from './test-support/test-support.module';
import { TeacherWorkbenchModule } from './teacher-workbench/teacher-workbench.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AddressesModule,
    BookingsModule,
    LessonsModule,
    TeacherReviewsModule,
    SubjectsModule,
    GuardiansModule,
    StudentsModule,
    TeachersModule,
    CrmModule,
    TestSupportModule,
    TeacherWorkbenchModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
