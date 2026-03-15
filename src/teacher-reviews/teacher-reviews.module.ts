import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TeacherReviewsController } from './teacher-reviews.controller';
import { TeacherReviewsService } from './teacher-reviews.service';

@Module({
  imports: [PrismaModule],
  controllers: [TeacherReviewsController],
  providers: [TeacherReviewsService],
  exports: [TeacherReviewsService],
})
export class TeacherReviewsModule {}
