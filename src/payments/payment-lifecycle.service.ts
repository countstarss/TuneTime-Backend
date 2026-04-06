import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { isMvpCapabilityEnabled } from '../common/mvp-capabilities';
import { DEFAULT_PAYMENT_SWEEP_INTERVAL_MS } from './payments.constants';
import { PaymentsService } from './payments.service';

@Injectable()
export class PaymentLifecycleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentLifecycleService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly paymentsService: PaymentsService) {}

  onModuleInit() {
    if (
      process.env.NODE_ENV === 'test' ||
      !isMvpCapabilityEnabled('payment') ||
      process.env.PAYMENT_SWEEP_ENABLED === 'false'
    ) {
      return;
    }

    const intervalMs = Number(
      process.env.PAYMENT_SWEEP_INTERVAL_MS ?? DEFAULT_PAYMENT_SWEEP_INTERVAL_MS,
    );

    this.timer = setInterval(() => {
      this.paymentsService.expirePendingPayments().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`支付状态巡检失败: ${message}`);
      });
    }, intervalMs);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
