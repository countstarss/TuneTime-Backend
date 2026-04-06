import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { getMvpCapabilities } from './common/mvp-capabilities';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('system/capabilities')
  getSystemCapabilities() {
    return getMvpCapabilities();
  }
}
