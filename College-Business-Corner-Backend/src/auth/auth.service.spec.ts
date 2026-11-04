import { describe, expect, it } from 'vitest';
import { AuthService } from './auth.service.js';

const make = () => new AuthService({ get: () => undefined } as never, {} as never);

describe('AuthService tokens', () => {
  it('round-trips a session', () => {
    const a = make();
    const s = a.verify(a.issue({ uid: 'u1', email: 'a@b.co', role: 'OWNER' }));
    expect(s.email).toBe('a@b.co');
    expect(s.role).toBe('OWNER');
  });

  it('rejects a token whose body was edited', () => {
    const a = make();
    const [, sig] = a.issue({ uid: 'u1', email: 'a@b.co', role: 'BUYER' }).split('.');
    const forged = Buffer.from(JSON.stringify({ uid: 'u1', email: 'a@b.co', role: 'OWNER', exp: Date.now() + 1e6 })).toString('base64url');
    expect(() => a.verify(`${forged}.${sig}`)).toThrow();
  });

  it('rejects missing and garbage tokens', () => {
    const a = make();
    expect(() => a.verify(undefined)).toThrow();
    expect(() => a.verify('nope')).toThrow();
  });

  it('rejects an expired token', () => {
    const a = make();
    const body = Buffer.from(JSON.stringify({ uid: 'u', email: 'a@b.co', role: 'BUYER', exp: Date.now() - 1 })).toString('base64url');
    const sig = (a as unknown as { sign: (b: string) => string }).sign(body);
    expect(() => a.verify(`${body}.${sig}`)).toThrow(/expired/i);
  });
});
