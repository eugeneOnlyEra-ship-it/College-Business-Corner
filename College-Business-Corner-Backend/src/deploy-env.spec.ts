import { describe, expect, it } from 'vitest';
import { applyHostedDefaults, storageWarnings } from './deploy-env.js';

describe('applyHostedDefaults', () => {
  it('uses the public domain for the PayPal return and frontend addresses', () => {
    const env: NodeJS.ProcessEnv = { RAILWAY_PUBLIC_DOMAIN: 'corner.up.railway.app' };
    expect(applyHostedDefaults(env)).toEqual(['APP_BASE_URL', 'FRONTEND_URL']);
    expect(env.APP_BASE_URL).toBe('https://corner.up.railway.app');
    expect(env.FRONTEND_URL).toBe('https://corner.up.railway.app');
  });
  it('never overrides what was set explicitly', () => {
    const env: NodeJS.ProcessEnv = { RAILWAY_PUBLIC_DOMAIN: 'corner.up.railway.app', APP_BASE_URL: 'https://mine.example' };
    applyHostedDefaults(env);
    expect(env.APP_BASE_URL).toBe('https://mine.example');
    expect(env.FRONTEND_URL).toBe('https://corner.up.railway.app');
  });
  it('does nothing off Railway', () => {
    const env: NodeJS.ProcessEnv = {};
    expect(applyHostedDefaults(env)).toEqual([]);
    expect(env.APP_BASE_URL).toBeUndefined();
  });
});

describe('storageWarnings', () => {
  it('is quiet locally (no volume)', () => {
    expect(storageWarnings({ DATABASE_URL: 'file:./dev.db' })).toEqual([]);
  });
  it('is quiet when the database and photos are on the volume', () => {
    expect(storageWarnings({ RAILWAY_VOLUME_MOUNT_PATH: '/data', DATABASE_URL: 'file:/data/app.db', UPLOADS_DIR: '/data/uploads' })).toEqual([]);
  });
  it('warns when the database is not on the volume (the classic mistake)', () => {
    const w = storageWarnings({ RAILWAY_VOLUME_MOUNT_PATH: '/data', DATABASE_URL: 'file:./dev.db', UPLOADS_DIR: '/data/uploads' });
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/DATABASE_URL.*not on the volume/);
  });
  it('warns when photos are not on the volume, and for a lookalike folder name', () => {
    const w = storageWarnings({ RAILWAY_VOLUME_MOUNT_PATH: '/data', DATABASE_URL: 'file:/data/app.db', UPLOADS_DIR: '/database/uploads' });
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/UPLOADS_DIR/);
  });
});
