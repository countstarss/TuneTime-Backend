import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GuardiansController } from './guardians.controller';
import { GuardiansService } from './guardians.service';

@Module({
  imports: [PrismaModule],
  controllers: [GuardiansController],
  providers: [GuardiansService],
  exports: [GuardiansService],
})
export class GuardiansModule {}
