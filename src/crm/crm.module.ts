import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CrmAccessGuard } from './crm-access.guard';
import { CrmAiService } from './crm-ai.service';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CrmController],
  providers: [CrmService, CrmAiService, CrmAccessGuard],
})
export class CrmModule {}
