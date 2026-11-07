/**
 * A short, checked list of beginner resources for new student entrepreneurs.
 *
 * It is DATA, not something the AI writes: the business assistant can only point at what is listed here, so it can never
 * invent a book, an author or a link. Every website was checked to exist (see the test), and the books are real titles
 * with the right authors. Books link to an Open Library search so the student can look for a free or library copy.
 */
export interface StarterTip { title: string; text: string }
export interface StarterBook { title: string; author: string; why: string; findUrl: string }
export interface StarterSite { name: string; url: string; why: string }
export interface StarterPack { tips: StarterTip[]; books: StarterBook[]; websites: StarterSite[]; note: string }

const find = (title: string, author: string) => `https://openlibrary.org/search?q=${encodeURIComponent(`${title} ${author}`)}`;

export const STARTER_PACK: StarterPack = {
  tips: [
    { title: 'Start with one simple offer', text: 'Do one thing well before adding more. A clear, single service is easier to describe, price and deliver than a long menu.' },
    { title: 'Talk to students before you spend', text: 'Ask a few people what they do today, what it costs them and what annoys them. Listen for real problems, not compliments.' },
    { title: 'Price to make a profit', text: 'Add up your costs and your time, then price above that. Say what the price covers (per page, per haircut) so there are no surprises.' },
    { title: 'Delight your first customers', text: 'Be quick, friendly and reliable. Ask what they liked and whether they would tell a friend. Early word of mouth is your best marketing.' },
    { title: 'Add a photo and be clear', text: 'A photo, a plain title and what is included make a listing easier to trust. Say how long a job takes so nobody is kept waiting.' },
    { title: 'Keep your money tidy', text: 'Keep business money separate from personal money and note every sale. The Sales panel on the My business page shows what customers paid and what you received.' },
  ],
  books: [
    { title: 'The $100 Startup', author: 'Chris Guillebeau', why: 'Real stories of people who started small businesses with very little money. A good first read.', findUrl: find('The $100 Startup', 'Chris Guillebeau') },
    { title: 'The Mom Test', author: 'Rob Fitzpatrick', why: 'How to talk to customers and get honest answers, so you learn what people really want before you build.', findUrl: find('The Mom Test', 'Rob Fitzpatrick') },
    { title: 'Profit First', author: 'Mike Michalowicz', why: 'A simple way to manage money in a small business so that you actually keep some profit.', findUrl: find('Profit First', 'Mike Michalowicz') },
    { title: 'The E-Myth Revisited', author: 'Michael E. Gerber', why: 'Why many small businesses struggle, and how to run yours with simple repeatable routines.', findUrl: find('The E-Myth Revisited', 'Michael E. Gerber') },
  ],
  websites: [
    { name: 'Startup School (Y Combinator)', url: 'https://www.startupschool.org', why: 'A free online course on starting a company, taught by people who have done it. Self-paced.' },
    { name: 'Do Things That Don\u2019t Scale (Paul Graham)', url: 'https://paulgraham.com/ds.html', why: 'A short, famous essay on winning your first customers by hand. Written for startups but works for any small business.' },
    { name: 'ILO: Start and Improve Your Business', url: 'https://www.ilo.org/resource/training-packages', why: 'The International Labour Organization\u2019s training for small-business owners, covering finding an idea, starting and improving. It is usually delivered through local training partners, so ask around.' },
    { name: 'Open Library', url: 'https://openlibrary.org', why: 'Free to join. Search for the books above and see whether you can borrow a copy.' },
  ],
  note: 'These are optional starting points, not requirements. Start with the free ones.',
};

/** What the AI is told: titles and reasons only, never links, so it has nothing to copy wrongly. */
export function starterPackForModel(pack: StarterPack = STARTER_PACK) {
  return {
    tips: pack.tips.map((t) => ({ title: t.title, text: t.text })),
    books: pack.books.map((b) => ({ title: b.title, author: b.author, why: b.why })),
    websites: pack.websites.map((w) => ({ name: w.name, why: w.why })),
    instruction: 'The app shows the full list with links in a card. Mention one or two highlights only. Do not write links or recommend anything that is not in this list.',
  };
}
