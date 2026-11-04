import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';

export type Role = 'OWNER' | 'BUYER';
export interface Session {
  uid: string;
  email: string;
  role: Role;
  exp: number;
}

const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEV_SECRET = 'dev-only-secret-set-AUTH_SECRET-in-env';

/**
 * DEMO SIGN-IN: no password. The user picks a role (owner or buyer) and gets a signed session token.
 * The signature stops anyone from claiming another owner's account by editing a request, but anyone who
 * knows an email can still sign in as it. Real sign-in (Google, magic link) is the production step.
 */
@Injectable()
export class AuthService {
  private readonly secret: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = config.get<string>('AUTH_SECRET');
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET must be set in production.');
    }
    this.secret = secret || DEV_SECRET;
  }

  private sign(body: string): string {
    return createHmac('sha256', this.secret).update(body).digest('base64url');
  }

  issue(s: Omit<Session, 'exp'>): string {
    const body = Buffer.from(JSON.stringify({ ...s, exp: Date.now() + TTL_MS })).toString('base64url');
    return `${body}.${this.sign(body)}`;
  }

  verify(token: string | undefined): Session {
    const [body, sig] = (token ?? '').split('.');
    if (!body || !sig) throw new UnauthorizedException('Please sign in.');
    const expected = Buffer.from(this.sign(body));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      throw new UnauthorizedException('Please sign in again.');
    }
    let session: Session;
    try {
      session = JSON.parse(Buffer.from(body, 'base64url').toString());
    } catch {
      throw new UnauthorizedException('Please sign in again.');
    }
    if (!session.exp || session.exp < Date.now()) {
      throw new UnauthorizedException('Your session expired. Please sign in again.');
    }
    return session;
  }

  async login(rawEmail: unknown, role: unknown, rawName?: unknown) {
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Enter a valid email address.');
    }
    if (role !== 'OWNER' && role !== 'BUYER') {
      throw new BadRequestException('Choose whether you want to buy or sell.');
    }
    const name = typeof rawName === 'string' && rawName.trim() ? rawName.trim().slice(0, 60) : email.split('@')[0];
    const user = await this.prisma.user.upsert({ where: { email }, update: {}, create: { email, name } });
    return {
      token: this.issue({ uid: user.id, email: user.email, role }),
      user: { id: user.id, email: user.email, name: user.name, role },
    };
  }
}
