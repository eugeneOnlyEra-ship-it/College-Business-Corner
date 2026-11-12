import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { websiteUrl } from './frontend-url.js';

describe('websiteUrl', () => {
  it('uses FRONTEND_URL when the website is not bundled', () => {
    const env = { PUBLIC_DIR: join(tmpdir(), 'does-not-exist-here') };
    expect(websiteUrl('/orders/1', 'https://app.example/', env)).toBe('https://app.example/#/orders/1');
    expect(websiteUrl('cancelled', 'https://app.example', env)).toBe('https://app.example/#/cancelled');
  });
  it('returns null with nothing to go on', () => {
    expect(websiteUrl('/sell', undefined, { PUBLIC_DIR: join(tmpdir(), 'does-not-exist-here') })).toBeNull();
  });
  it('is relative when the website is bundled, whatever FRONTEND_URL says', () => {
    const dir = mkdtempSync(join(tmpdir(), 'site-'));
    writeFileSync(join(dir, 'index.html'), '<html></html>');
    expect(websiteUrl('/sell', 'https://wrong.example', { PUBLIC_DIR: dir })).toBe('/#/sell');
  });
});
