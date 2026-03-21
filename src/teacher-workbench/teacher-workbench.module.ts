import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TeacherWorkbenchController } from './teacher-workbench.controller';
import { TeacherWorkbenchService } from './teacher-workbench.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TeacherWorkbenchController],
  providers: [TeacherWorkbenchService],
  exports: [TeacherWorkbenchService],
})
export class TeacherWorkbenchModule {}
