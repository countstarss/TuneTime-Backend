import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AddressesModule } from './addresses/addresses.module';
import { GuardiansModule } from './guardians/guardians.module';
import { StudentsModule } from './students/students.module';
import { TeachersModule } from './teachers/teachers.module';
import { SubjectsModule } from './subjects/subjects.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AddressesModule,
    SubjectsModule,
    GuardiansModule,
    StudentsModule,
    TeachersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
