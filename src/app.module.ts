import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module'; // 导入 PrismaModule
import { AuthModule } from './auth/auth.module'; // 导入 AuthModule

@Module({
  imports: [PrismaModule, AuthModule], // 将 AuthModule 添加到 imports 数组
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
