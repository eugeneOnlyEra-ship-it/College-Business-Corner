import { describe, expect, it } from 'vitest';
import { corsOrigin } from './cors.js';

const allows = (fn: ReturnType<typeof corsOrigin>, origin: string | undefined) => {
  let result: boolean | undefined;
  fn(origin, (_e, ok) => { result = ok; });
  return result;
};

describe('corsOrigin', () => {
  it('lets any localhost port in during development (Vite hops ports)', () => {
    const dev = corsOrigin('http://localhost:5173', undefined);
    for (const o of ['http://localhost:5173', 'http://localhost:5177', 'http://127.0.0.1:5180']) expect(allows(dev, o)).toBe(true);
  });
  it('still refuses other websites in development', () => {
    const dev = corsOrigin(undefined, 'development');
    for (const o of ['https://evil.example', 'http://localhost.evil.example', 'http://192.168.1.5:5173']) expect(allows(dev, o)).toBe(false);
  });
  it('allows requests with no Origin (curl, Swagger)', () => {
    expect(allows(corsOrigin(undefined, 'production'), undefined)).toBe(true);
  });
  it('in production only the configured address(es) are allowed, not localhost', () => {
    const prod = corsOrigin('https://corner.example/, https://www.corner.example', 'production');
    expect(allows(prod, 'https://corner.example')).toBe(true);
    expect(allows(prod, 'https://www.corner.example')).toBe(true);
    expect(allows(prod, 'http://localhost:5173')).toBe(false);
    expect(allows(prod, 'https://other.example')).toBe(false);
  });
});
