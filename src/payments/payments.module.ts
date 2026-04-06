import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BookingPaymentProjector } from './booking-payment-projector.service';
import { PaymentLifecycleService } from './payment-lifecycle.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { WechatPayClient } from './wechat-pay.client';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentsController],
  providers: [
    BookingPaymentProjector,
    PaymentLifecycleService,
    PaymentsService,
    WechatPayClient,
  ],
  exports: [BookingPaymentProjector, PaymentsService],
})
export class PaymentsModule {}
