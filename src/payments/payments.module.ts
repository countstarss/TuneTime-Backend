import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BookingPaymentProjector } from './booking-payment-projector.service';
import {
  AdminFundsController,
  TeacherFundsController,
  WechatFundsNotifyController,
} from './funds.controller';
import { FundsService } from './funds.service';
import { PaymentLifecycleService } from './payment-lifecycle.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { WechatPayClient } from './wechat-pay.client';

@Module({
  imports: [PrismaModule],
  controllers: [
    PaymentsController,
    AdminFundsController,
    TeacherFundsController,
    WechatFundsNotifyController,
  ],
  providers: [
    BookingPaymentProjector,
    FundsService,
    PaymentLifecycleService,
    PaymentsService,
    WechatPayClient,
  ],
  exports: [BookingPaymentProjector, FundsService, PaymentsService],
})
export class PaymentsModule {}
