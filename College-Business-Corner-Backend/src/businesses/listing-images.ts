import { existsSync, statSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Listing photos live on disk as uploads/listings/<listingId>.<ext>. No database change needed. */
export const MAX_IMAGE_BYTES = 1_000_000;
export const IMAGE_DIR = join(process.cwd(), 'uploads', 'listings');
const EXTENSIONS = ['jpg', 'png', 'webp'] as const;
export type ImageExt = (typeof EXTENSIONS)[number];

/** Trust the file's first bytes, not what the client says it is. */
export function detectImage(buf: Buffer): ImageExt | null {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

/** Accepts raw base64 or a data URL ("data:image/jpeg;base64,..."). */
export function decodeBase64Image(input: unknown): Buffer | null {
  if (typeof input !== 'string' || input.length < 16) return null;
  const raw = input.includes(',') ? input.slice(input.indexOf(',') + 1) : input;
  if (!/^[A-Za-z0-9+/=\s]+$/.test(raw)) return null;
  return Buffer.from(raw, 'base64');
}

const safeId = (id: string) => /^[\w-]+$/.test(id);

export async function saveListingImage(listingId: string, buf: Buffer, dir = IMAGE_DIR): Promise<ImageExt> {
  if (!safeId(listingId)) throw new Error('bad listing id');
  const ext = detectImage(buf);
  if (!ext) throw new Error('not a JPEG, PNG or WebP image');
  await mkdir(dir, { recursive: true });
  await Promise.all(EXTENSIONS.filter((e) => e !== ext).map((e) => rm(join(dir, `${listingId}.${e}`), { force: true })));
  await writeFile(join(dir, `${listingId}.${ext}`), buf);
  return ext;
}

/** Path the browser can load (served from /uploads), or undefined when the listing has no photo. */
export function imageUrlFor(listingId: string, dir = IMAGE_DIR): string | undefined {
  if (!safeId(listingId)) return undefined;
  for (const ext of EXTENSIONS) {
    const file = join(dir, `${listingId}.${ext}`);
    if (existsSync(file)) return `/uploads/listings/${listingId}.${ext}?v=${Math.round(statSync(file).mtimeMs)}`;
  }
  return undefined;
}
