/**
 * Turns what someone searched for into plain keywords ("cheap haircut near the hostel" -> "haircut", "hostel").
 * Only these keywords are ever stored. The full sentence, the person and the time of day are not.
 */
export const MAX_TERMS_PER_SEARCH = 4;

const STOP = new Set([
  'the', 'and', 'for', 'with', 'near', 'nearby', 'around', 'from', 'that', 'this', 'under', 'below', 'over', 'about',
  'some', 'any', 'can', 'could', 'would', 'should', 'please', 'need', 'needs', 'want', 'wants', 'looking', 'look',
  'find', 'get', 'buy', 'order', 'book', 'show', 'give', 'any', 'cheap', 'cheapest', 'best', 'good', 'nice', 'affordable',
  'price', 'prices', 'cost', 'how', 'much', 'who', 'where', 'what', 'are', 'there', 'you', 'your', 'our', 'campus',
  'student', 'students', 'service', 'services', 'item', 'items', 'thing', 'things', 'today', 'tomorrow', 'now', 'dollar', 'dollars',
]);

const singular = (w: string) => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);

export function extractTerms(...inputs: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const raw of inputs) {
    if (typeof raw !== 'string') continue;
    const text = raw.trim().toLowerCase();
    if (!text || text.length > 120) continue;
    // Never keep anything that looks like contact details or a link.
    if (text.includes('@') || /https?:|www\./.test(text) || /\d{5,}/.test(text.replace(/[\s-]/g, ''))) continue;
    for (const part of text.split(/[^\p{L}\p{N}']+/u)) {
      const word = singular(part.replace(/'/g, ''));
      if (word.length < 3 || word.length > 24) continue;
      if (/^\d+$/.test(word) || STOP.has(word) || out.includes(word)) continue;
      out.push(word);
      if (out.length >= MAX_TERMS_PER_SEARCH) return out;
    }
  }
  return out;
}
