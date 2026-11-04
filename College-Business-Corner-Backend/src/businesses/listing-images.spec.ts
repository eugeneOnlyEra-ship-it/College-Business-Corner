import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeBase64Image, detectImage, imageUrlFor, saveListingImage } from './listing-images.js';

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 1)]);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);

describe('listing images', () => {
  it('recognises images by their first bytes, not by claims', () => {
    expect(detectImage(jpeg)).toBe('jpg');
    expect(detectImage(png)).toBe('png');
    expect(detectImage(Buffer.from('<script>alert(1)</script> not an image at all'))).toBeNull();
  });

  it('decodes data URLs and rejects junk', () => {
    expect(decodeBase64Image(`data:image/jpeg;base64,${jpeg.toString('base64')}`)?.equals(jpeg)).toBe(true);
    expect(decodeBase64Image('not base64 !!! ******')).toBeNull();
    expect(decodeBase64Image(undefined)).toBeNull();
  });

  it('saves a photo, serves a url, and replaces it when the type changes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cbc-img-'));
    try {
      expect(imageUrlFor('abc123', dir)).toBeUndefined();
      expect(await saveListingImage('abc123', jpeg, dir)).toBe('jpg');
      expect(imageUrlFor('abc123', dir)).toMatch(/^\/uploads\/listings\/abc123\.jpg\?v=\d+$/);
      expect(await saveListingImage('abc123', png, dir)).toBe('png');
      expect(imageUrlFor('abc123', dir)).toMatch(/abc123\.png/);
      await expect(saveListingImage('abc123', Buffer.from('nope nope nope nope'), dir)).rejects.toThrow();
      await expect(saveListingImage('../evil', jpeg, dir)).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
