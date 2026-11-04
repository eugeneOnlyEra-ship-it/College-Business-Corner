import { describe, expect, it } from 'vitest';
import { extractTerms } from './terms.js';

describe('extractTerms', () => {
  it('keeps the interest and drops filler', () => {
    expect(extractTerms('cheap haircut near the hostel')).toEqual(['haircut', 'hostel']);
    expect(extractTerms('I need braids and wash under $10')).toEqual(['braid', 'wash']);
  });
  it('treats plurals as one interest', () => {
    expect(extractTerms('Snacks')).toEqual(extractTerms('snack'));
  });
  it('drops anything that looks like contact details or links', () => {
    expect(extractTerms('amina@example.com')).toEqual([]);
    expect(extractTerms('call 0881234567 for printing')).toEqual([]);
    expect(extractTerms('https://x.co/haircut')).toEqual([]);
  });
  it('ignores empty, huge and non-text input and caps the number of terms', () => {
    expect(extractTerms('', undefined, null)).toEqual([]);
    expect(extractTerms('x'.repeat(500))).toEqual([]);
    expect(extractTerms('alpha bravo charlie delta echo foxtrot')).toHaveLength(4);
  });
  it('can also take a category', () => {
    expect(extractTerms('haircut', 'salon')).toEqual(['haircut', 'salon']);
  });
});
