import { describe, expect, it } from 'vitest';
import { STARTER_PACK, starterPackForModel } from './starter-pack.js';

// Only these sites have been checked. Adding a link means checking it first, then adding its host here.
const CHECKED_HOSTS = ['www.startupschool.org', 'paulgraham.com', 'www.ilo.org', 'openlibrary.org'];

describe('starter pack', () => {
  const links = [...STARTER_PACK.websites.map((w) => w.url), ...STARTER_PACK.books.map((b) => b.findUrl)];

  it('only links to sites that were checked, over https', () => {
    for (const url of links) {
      const u = new URL(url);
      expect(u.protocol).toBe('https:');
      expect(CHECKED_HOSTS).toContain(u.host);
    }
  });
  it('has no duplicates and no empty fields', () => {
    expect(new Set(links).size).toBe(links.length);
    for (const item of [...STARTER_PACK.tips, ...STARTER_PACK.books, ...STARTER_PACK.websites]) {
      for (const value of Object.values(item)) expect(String(value).trim().length).toBeGreaterThan(2);
    }
  });
  it('book links search Open Library for the title and author', () => {
    for (const b of STARTER_PACK.books) {
      const q = new URL(b.findUrl).searchParams.get('q') ?? '';
      expect(q).toContain(b.title);
      expect(q).toContain(b.author);
    }
  });
  it('the AI is given no links at all', () => {
    expect(JSON.stringify(starterPackForModel())).not.toMatch(/https?:\/\//);
  });
});
