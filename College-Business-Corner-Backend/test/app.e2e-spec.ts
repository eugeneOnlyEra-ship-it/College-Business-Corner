import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

// PaypalService reads these in its constructor; dummy values are fine for wiring tests.
process.env.PAYPAL_BASE_URL = 'https://api-m.sandbox.paypal.com';
process.env.PAYPAL_CLIENT_ID = 'test';
process.env.PAYPAL_CLIENT_SECRET = 'test';
process.env.PAYPAL_BN_CODE = 'test';
process.env.PAYPAL_PARTNER_MERCHANT_ID = 'test';
process.env.APP_BASE_URL = 'http://localhost:3000';
// PrismaService opens a SQLite file (needs `npx prisma generate` to have been run once).
process.env.DATABASE_URL = 'file:./dev.db';

describe('App wiring (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /paypal/cancel responds', async () => {
    const res = await request(app.getHttpServer()).get('/paypal/cancel').expect(200);
    expect(res.body.message).toContain('cancelled');
  });
});
