import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Swagger UI at http://localhost:3000/docs : lets you test endpoints in the browser.
  const config = new DocumentBuilder()
    .setTitle('College Business Corner API')
    .setDescription('Campus marketplace backend: PayPal multi-seller payments + AI shopping agent')
    .setVersion('0.1')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
