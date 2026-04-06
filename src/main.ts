import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: process.env.ADMIN_CORS_ORIGIN?.split(',').map((v) => v.trim()) ?? [
      'http://localhost:3000',
    ],
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('TuneTime Backend API')
    .setDescription(
      'TuneTime 后端接口文档，包含鉴权、基础资料、预约与履约相关接口。',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: '请输入登录后获取的 Bearer Token',
      },
      'bearer',
    )
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(
    process.env.SWAGGER_PATH || 'docs',
    app,
    swaggerDocument,
    {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
      },
    },
  );

  await app.listen(5678);
}
bootstrap();
