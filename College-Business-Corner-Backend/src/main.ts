import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { corsOrigin } from './cors.js';
import { applyHostedDefaults, storageWarnings } from './deploy-env.js';
import { UPLOADS_DIR } from './paths.js';

async function bootstrap() {
  // On a host such as Railway, learn our public address from the environment before the app reads its settings.
  applyHostedDefaults(process.env);
  console.log(`[start] public address (APP_BASE_URL): ${process.env.APP_BASE_URL ?? 'NOT SET'}`);
  console.log(`[start] website address (FRONTEND_URL): ${process.env.FRONTEND_URL ?? 'NOT SET'}`);
  for (const warning of storageWarnings(process.env)) console.warn(`[storage] WARNING: ${warning}`);

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Listing photos are sent as base64 (kept under 1 MB), so allow a slightly larger JSON body.
  app.useBodyParser('json', { limit: '2mb' });
  // Serve uploaded listing photos at /uploads/listings/<id>.<ext>.
  app.useStaticAssets(UPLOADS_DIR, { prefix: '/uploads/' });

  // When the built website is next to the API (see the Dockerfile), serve it too, so one address does everything.
  const website = process.env.PUBLIC_DIR ?? join(process.cwd(), 'public');
  if (existsSync(join(website, 'index.html'))) app.useStaticAssets(website);

  // Let the frontend call this API from the browser: FRONTEND_URL, plus any localhost port while developing
  // (Vite picks the next free port when 5173 is taken).
  app.enableCors({ origin: corsOrigin(process.env.FRONTEND_URL, process.env.NODE_ENV) });

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
