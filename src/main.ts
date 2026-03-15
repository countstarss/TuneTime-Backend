import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.ADMIN_CORS_ORIGIN?.split(',').map((v) => v.trim()) ?? [
      'http://localhost:3000',
    ],
    credentials: true,
  });
  await app.listen(5678);
}
bootstrap();
