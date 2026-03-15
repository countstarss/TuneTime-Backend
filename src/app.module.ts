import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { SubjectsModule } from './subjects/subjects.module';

@Module({
  imports: [PrismaModule, AuthModule, SubjectsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
