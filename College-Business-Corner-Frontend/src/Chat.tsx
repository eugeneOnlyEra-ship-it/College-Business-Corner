import { useEffect, useRef, useState } from 'react';
import { ApiError, chat, confirmCheckout, getListings, type ChatTurn, type Checkout, type ListingView } from './api';
import { Receipt } from './Receipt';
import { RichText } from './RichText';
import ListingCards from './ListingCards';
import UserBubble from './UserBubble';

interface Msg {
  role: 'user' | 'assistant';
  text: string;
  /** Listings the assistant found for this reply, shown as cards. */
  listings?: ListingView[];
  selectedIds?: string[];
}

// Used only when there are not enough real listings to build examples from.
const FALLBACK_EXAMPLES = ['What can I get on campus right now?'];

const roundUp5 = (n: number) => Math.ceil(n / 5) * 5;

/** Example requests built from what is really for sale, so they work on any database (not just the demo one). */
function makeExamples(listings: ListingView[]): string[] {
  const ready = listings.filter((l) => l.business.canReceivePayments);
  const pool = ready.length >= 2 ? ready : listings;
  const cheapest = new Map<string, ListingView>(); // one listing per business, so a cart spans several sellers
  for (const l of pool) {
    const cur = cheapest.get(l.business.id);
    if (!cur || l.priceCents < cur.priceCents) cheapest.set(l.business.id, l);
  }
  const picks = [...cheapest.values()].sort((a, b) => a.priceCents - b.priceCents).slice(0, 3);
  if (picks.length === 0) return FALLBACK_EXAMPLES;
  const name = (l: ListingView) => l.title.toLowerCase();
  const list = (xs: ListingView[]) => (xs.length === 1 ? name(xs[0]) : `${xs.slice(0, -1).map(name).join(', ')} and ${name(xs[xs.length - 1])}`);
  const total = (xs: ListingView[]) => xs.reduce((n, l) => n + l.priceCents, 0);

  const two = picks.slice(0, 2);
  const examples = [`I need ${list(two)}. My budget is $${roundUp5((total(two) * 1.3) / 100)}.`];
  if (two.length === 2) {
    const tight = Math.max(1, Math.floor((total(two) * 0.7) / 100));
    examples.push(`I need ${list(two)}. My budget is $${tight}.`); // too tight on purpose: shows the budget check
  }
  if (picks.length === 3) examples.push(`I need ${list(picks)}. My budget is $${roundUp5((total(picks) * 1.3) / 100)}.`);
  return examples;
}

const errorText = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');

export default function Chat({ active = true }: { active?: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [examples, setExamples] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  // Which message the current cart came from, so editing an earlier message can drop a cart that no longer applies.
  const [checkoutAt, setCheckoutAt] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getListings().then((l) => setExamples(makeExamples(l))).catch(() => setExamples(FALLBACK_EXAMPLES));
  }, []);

  // The business page can drop a ready-to-send request into the box.
  useEffect(() => {
    const on = (e: Event) => setInput(String((e as CustomEvent<string>).detail ?? ''));
    window.addEventListener('cbc-prefill', on);
    return () => window.removeEventListener('cbc-prefill', on);
  }, []);

  useEffect(() => {
    if (active) endRef.current?.scrollIntoView({ block: 'end' });
  }, [msgs, busy, active]);

  async function send(text: string, base: Msg[] = msgs) {
    const message = text.trim();
    if (!message || busy) return;
    const history: ChatTurn[] = base.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text }));
    setMsgs([...base, { role: 'user', text: message }]);
    setInput('');
    setBusy(true);
    setError(null);
    try {
      const res = await chat(message, history);
      setMsgs((m) => [...m, { role: 'assistant', text: res.reply, listings: res.listings, selectedIds: res.selectedIds }]);
      if (res.checkout) { setCheckout(res.checkout); setCheckoutAt(base.length + 1); }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  // Edit-and-resend: keep everything before message i, ask again with the new text.
  function resend(i: number, text: string) {
    if (busy) return;
    if (checkoutAt !== null && checkoutAt >= i) { setCheckout(null); setCheckoutAt(null); } // that cart came from a reply we are discarding
    void send(text, msgs.slice(0, i));
  }

  async function confirm() {
    if (!checkout?.request) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await confirmCheckout(checkout.request);
      setCheckout({ ...res, request: checkout.request });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="split">
      <section className="chat" aria-label="Shopping assistant">
        <div className="thread">
          {msgs.length === 0 && (
            <div className="welcome">
              <div className="hero hero-grad hero-blend short">
                <div className="hero-inner">
                  <span className="eyebrow">Shopping assistant</span>
                  <h1>What do you need <em>today?</em></h1>
                  <p>Tell the assistant in your own words. It finds student businesses on campus and builds your cart.</p>
                </div>
              </div>
              <p className="examples-label">Try one</p>
              <div className="examples">
                {(examples ?? []).map((ex) => (
                  <button key={ex} onClick={() => send(ex)} disabled={busy}>
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) =>
            m.role === 'user' ? (
              <UserBubble key={`${i}:${m.text}`} text={m.text} busy={busy} onResend={(t) => resend(i, t)} />
            ) : (
              <div key={i} className="assistant-turn">
                <div className="bubble assistant"><RichText text={m.text} /></div>
                {m.listings && m.listings.length > 0 && (
                  <ListingCards listings={m.listings} selectedIds={m.selectedIds} busy={busy} onAsk={(t) => void send(t)} />
                )}
              </div>
            ),
          )}
          {busy && <div className="bubble assistant working">Looking through campus listings…</div>}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="composer">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="For example: 40 pages printed and a haircut, budget $25"
            rows={2}
            aria-label="Your request"
          />
          <button className="primary" onClick={() => send(input)} disabled={busy || !input.trim()}>
            Send
          </button>
        </div>
      </section>

      <Receipt checkout={checkout} confirming={confirming} onConfirm={confirm} />
    </div>
  );
}
