import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Listing photos are sent as base64 (kept under 1 MB), so allow a slightly larger JSON body.
  app.useBodyParser('json', { limit: '2mb' });
  // Serve uploaded listing photos at /uploads/listings/<id>.<ext>.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  // Let the Vite frontend (default http://localhost:5173) call this API from the browser.
  app.enableCors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' });

  // Swagger UI at http://localhost:3000/docs : lets you test endpoints in the browser.
  const config = new DocumentBuilder()
    .setTitle('College Business Corner API')
    .setDescription('Campus marketplace backend: PayPal multi-seller payments + AI shopping agent')
    .setVersion('0.1')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
