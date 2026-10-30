import { BadGatewayException, BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { OrderItemDto } from './dto/paypal.dto.js';

/**
 * ALL PayPal calls live here. No other module knows how money moves.
 * Uses plain REST (fetch), no PayPal SDK.
 *
 * Verified working in the sandbox with a Platform app:
 *  - seller onboarding via Partner Referrals
 *  - split payment: seller paid, platform fee collected (platform_fees)
 */
@Injectable()
export class PaypalService {
  private readonly logger = new Logger(PaypalService.name);
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly bnCode: string;
  private readonly partnerMerchantId: string;
  private readonly appBaseUrl: string;
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(config: ConfigService) {
    this.baseUrl = config.getOrThrow<string>('PAYPAL_BASE_URL');
    this.clientId = config.getOrThrow<string>('PAYPAL_CLIENT_ID');
    this.clientSecret = config.getOrThrow<string>('PAYPAL_CLIENT_SECRET');
    this.bnCode = config.getOrThrow<string>('PAYPAL_BN_CODE');
    this.partnerMerchantId = config.getOrThrow<string>('PAYPAL_PARTNER_MERCHANT_ID');
    this.appBaseUrl = config.getOrThrow<string>('APP_BASE_URL');
  }

  // ---- low-level helpers -------------------------------------------------

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return this.cachedToken.value;
    }
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const data = (await res.json()) as { access_token: string; expires_in: number };
    if (!res.ok) {
      this.logger.error(`PayPal token request failed: ${res.status}`);
      throw new BadGatewayException('Could not authenticate with PayPal');
    }
    this.cachedToken = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };
    return data.access_token;
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Partner-Attribution-Id': this.bnCode,
        'PayPal-Request-Id': randomUUID(),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
      this.logger.error(`PayPal ${method} ${path} -> ${res.status}: ${text}`);
      throw new BadGatewayException({ paypalStatus: res.status, paypal: data });
    }
    return data as T;
  }

  // ---- seller onboarding -------------------------------------------------

  async createOnboardingLink(trackingId: string) {
    if (!trackingId) throw new BadRequestException('trackingId is required');
    const data = await this.request<{ links: { rel: string; href: string }[] }>(
      'POST',
      '/v2/customer/partner-referrals',
      {
        tracking_id: trackingId,
        partner_config_override: {
          return_url: `${this.appBaseUrl}/paypal/onboarding-return`,
        },
        operations: [
          {
            operation: 'API_INTEGRATION',
            api_integration_preference: {
              rest_api_integration: {
                integration_method: 'PAYPAL',
                integration_type: 'THIRD_PARTY',
                third_party_details: { features: ['PAYMENT', 'REFUND', 'PARTNER_FEE'] },
              },
            },
          },
        ],
        products: ['EXPRESS_CHECKOUT'],
        legal_consents: [{ type: 'SHARE_DATA_CONSENT', granted: true }],
      },
    );
    const link = data.links.find((l) => l.rel === 'action_url');
    return { trackingId, onboardingUrl: link?.href };
  }

  /** Looks up a seller's PayPal merchant ID from YOUR tracking id. */
  async findMerchantIdByTrackingId(trackingId: string) {
    const d = await this.request<{ merchant_id?: string }>(
      'GET',
      `/v1/customer/partners/${this.partnerMerchantId}/merchant-integrations?tracking_id=${encodeURIComponent(trackingId)}`,
    );
    return { trackingId, merchantId: d.merchant_id };
  }

  async getSellerStatus(sellerMerchantId: string) {
    const d = await this.request<any>(
      'GET',
      `/v1/customer/partners/${this.partnerMerchantId}/merchant-integrations/${sellerMerchantId}`,
    );
    const permissionsGranted = Boolean(d.oauth_integrations?.length);
    return {
      merchantId: sellerMerchantId,
      paymentsReceivable: d.payments_receivable,
      emailConfirmed: d.primary_email_confirmed,
      permissionsGranted,
      ready: Boolean(d.payments_receivable && d.primary_email_confirmed && permissionsGranted),
    };
  }

  // ---- payments ----------------------------------------------------------

  /** One purchase unit per seller, so one order can pay several businesses. */
  async createOrder(
    items: OrderItemDto[],
    paths: { returnPath?: string; cancelPath?: string } = {},
  ) {
    if (!items?.length) throw new BadRequestException('Order needs at least one item');

    const purchase_units = items.map((item, i) => {
      const amount = Number(item.amount);
      const fee = Number(item.platformFee);
      if (!item.sellerMerchantId) {
        throw new BadRequestException(`Item ${i + 1}: sellerMerchantId is required`);
      }
      if (!(amount > 0) || !(fee >= 0) || fee >= amount) {
        throw new BadRequestException(`Item ${i + 1}: invalid amount/fee`);
      }
      return {
        reference_id: `unit-${i + 1}`,
        description: item.description,
        payee: { merchant_id: item.sellerMerchantId },
        amount: { currency_code: 'USD', value: item.amount },
        ...(fee > 0 && {
          payment_instruction: {
            disbursement_mode: 'INSTANT',
            platform_fees: [{ amount: { currency_code: 'USD', value: item.platformFee } }],
          },
        }),
      };
    });

    const data = await this.request<{
      id: string;
      status: string;
      links: { rel: string; href: string }[];
    }>('POST', '/v2/checkout/orders', {
      intent: 'CAPTURE',
      purchase_units,
      payment_source: {
        paypal: {
          experience_context: {
            user_action: 'PAY_NOW',
            return_url: `${this.appBaseUrl}${paths.returnPath ?? '/paypal/return'}`,
            cancel_url: `${this.appBaseUrl}${paths.cancelPath ?? '/paypal/cancel'}`,
          },
        },
      },
    });
    const approve = data.links.find((l) => l.rel === 'payer-action' || l.rel === 'approve');
    return { orderId: data.id, status: data.status, approveUrl: approve?.href };
  }

  async captureOrder(orderId: string) {
    if (!orderId) throw new BadRequestException('orderId (token) is required');
    const data = await this.request<any>('POST', `/v2/checkout/orders/${orderId}/capture`, {});
    return {
      orderId: data.id,
      status: data.status,
      captures: (data.purchase_units ?? []).map((u: any) => {
        const c = u.payments?.captures?.[0];
        const b = c?.seller_receivable_breakdown;
        return {
          seller: u.payee?.merchant_id,
          captureId: c?.id,
          status: c?.status,
          gross: b?.gross_amount?.value,
          paypalFee: b?.paypal_fee?.value,
          platformFee: b?.platform_fees?.[0]?.amount?.value,
          net: b?.net_amount?.value,
        };
      }),
    };
  }
}
