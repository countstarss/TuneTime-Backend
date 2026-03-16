import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CrmAccessGuard } from './crm-access.guard';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CrmController],
  providers: [CrmService, CrmAccessGuard],
})
export class CrmModule {}
