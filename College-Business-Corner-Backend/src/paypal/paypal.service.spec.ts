import { BadRequestException } from '@nestjs/common';
import { PaypalService } from './paypal.service.js';

// Offline unit tests: only validation logic that runs BEFORE any PayPal request is made.
const fakeConfig = {
  getOrThrow: (key: string) => `test-${key}`,
} as any;

describe('PaypalService.createOrder validation', () => {
  const service = new PaypalService(fakeConfig);

  it('rejects an empty order', async () => {
    await expect(service.createOrder([])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a fee that is >= the amount', async () => {
    await expect(
      service.createOrder([
        { sellerMerchantId: 'SELLER1', amount: '5.00', platformFee: '5.00', description: 'x' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a missing seller id', async () => {
    await expect(
      service.createOrder([
        { sellerMerchantId: '', amount: '5.00', platformFee: '0.50', description: 'x' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a non-numeric amount', async () => {
    await expect(
      service.createOrder([
        { sellerMerchantId: 'SELLER1', amount: 'abc', platformFee: '0.50', description: 'x' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
