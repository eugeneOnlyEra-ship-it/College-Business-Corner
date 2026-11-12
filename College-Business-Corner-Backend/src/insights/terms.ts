/**
 * Turns what someone searched for into plain keywords ("cheap haircut near the hostel" -> "haircut", "hostel").
 * Words that sit next to each other stay together as ONE keyword ("hot dogs" -> "hot dog", "phone chargers" ->
 * "phone charger"); filler words, commas and other punctuation start a new keyword.
 * Only these keywords are ever stored. The full sentence, the person and the time of day are not.
 */
export const MAX_TERMS_PER_SEARCH = 4;
/** A keyword is at most this many words; a longer run of words is cut into several keywords. */
export const MAX_WORDS_PER_TERM = 3;

const STOP = new Set([
  'the', 'and', 'for', 'with', 'near', 'nearby', 'around', 'from', 'that', 'this', 'under', 'below', 'over', 'about',
  'some', 'any', 'can', 'could', 'would', 'should', 'please', 'need', 'needs', 'want', 'wants', 'looking', 'look',
  'find', 'get', 'buy', 'order', 'book', 'show', 'give', 'any', 'cheap', 'cheapest', 'best', 'good', 'nice', 'affordable',
  'price', 'prices', 'cost', 'how', 'much', 'who', 'where', 'what', 'are', 'there', 'you', 'your', 'our', 'campus',
  'student', 'students', 'service', 'services', 'sell', 'sells', 'selling', 'have', 'has', 'offer', 'offers', 'does', 'there', 'item', 'items', 'thing', 'things', 'today', 'tomorrow', 'now', 'dollar', 'dollars',
]);

// "dogs" -> "dog", but leave "glass", "bus", "plus" and "gas" alone.
const singular = (w: string) => (w.length > 3 && w.endsWith('s') && !/(ss|us|is)$/.test(w) ? w.slice(0, -1) : w);

export function extractTerms(...inputs: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const raw of inputs) {
    if (typeof raw !== 'string') continue;
    const text = raw.trim().toLowerCase();
    if (!text || text.length > 120) continue;
    // Never keep anything that looks like contact details or a link.
    if (text.includes('@') || /https?:|www\./.test(text) || /\d{5,}/.test(text.replace(/[\s-]/g, ''))) continue;

    // Each input is a list of runs of neighbouring words. Punctuation and filler words end a run.
    let run: string[] = [];
    const flush = () => {
      for (let i = 0; i < run.length; i += MAX_WORDS_PER_TERM) {
        const term = run.slice(i, i + MAX_WORDS_PER_TERM).join(' ');
        if (!out.includes(term)) out.push(term);
      }
      run = [];
    };

    for (const chunk of text.split(/[,;:.!?()/\\|]+/)) {
      for (const part of chunk.split(/[^\p{L}\p{N}']+/u)) {
        const word = singular(part.replace(/'/g, ''));
        if (word.length < 3 || word.length > 24 || /^\d+$/.test(word) || STOP.has(word)) {
          flush(); // a filler word, number or short word separates two keywords
          continue;
        }
        run.push(word);
      }
      flush(); // punctuation separates two keywords
    }
    if (out.length >= MAX_TERMS_PER_SEARCH) return out.slice(0, MAX_TERMS_PER_SEARCH);
  }
  return out.slice(0, MAX_TERMS_PER_SEARCH);
}
