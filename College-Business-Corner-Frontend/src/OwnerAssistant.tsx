import { useEffect, useRef, useState } from 'react';
import { addListing, ApiError, connectPaypal, createBusiness, dollars, getDemandInsights, getPaypalStatus, ownerChat, type ChatTurn, type DemandTerm, type Proposal, type StarterPack } from './api';
import PhotoButton from './PhotoButton';
import StarterPackCard from './StarterPackCard';
import { RichText } from './RichText';
import UserBubble from './UserBubble';

interface Msg { role: 'user' | 'assistant'; text: string; proposals?: Proposal[]; resources?: StarterPack; /** Written by the app after a confirmation, not by the owner. */ auto?: boolean }
type CardState = { status: 'idle' | 'working' | 'done' | 'failed'; note?: string; dismissed?: boolean; url?: string; created?: { id: string; title: string }[] };

const EXAMPLES = [
  "I have no idea what to sell. What do students want?",
  'I offer salon services at $15. Set it up for me.',
  'Braids 15, wash 5, snack box 3. I sell near the hostels.',
  'What do I still need to do before I can get paid with PayPal?',
  'Give me beginner tips, books and websites for new entrepreneurs.',
];

/** Open the starter pack straight away when the owner asked for it; otherwise it stays collapsed as an optional extra. */
const askedForResources = (text?: string) => /\b(tips?|books?|websites?|resources?|courses?|learn|reading|advice)\b/i.test(text ?? '');

const errorText = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');

export default function OwnerAssistant({ active = true }: { active?: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<Record<string, CardState>>({});
  const [demand, setDemand] = useState<DemandTerm[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  // Re-read the demand chips each time the owner comes back, so searches made in Browse show up.
  useEffect(() => { if (active) getDemandInsights().then((d) => setDemand(d.topSearches.slice(0, 6))).catch(() => { /* optional extra */ }); }, [active]);
  useEffect(() => { if (active) endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs, busy, active]);

  async function send(text: string, base: Msg[] = msgs, auto = false) {
    const message = text.trim();
    if (!message || busy) return;
    const history: ChatTurn[] = base.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text }));
    setMsgs([...base, { role: 'user', text: message, ...(auto ? { auto: true } : {}) }]);
    setInput(''); setBusy(true); setError(null);
    try {
      const res = await ownerChat(message, history);
      setMsgs((m) => [...m, { role: 'assistant', text: res.reply, proposals: res.proposals, resources: res.resources }]);
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }

  // Editing an earlier message resends from there and drops what came after. That is only safe while nothing after it
  // has been SAVED (a confirmed business, listings or PayPal step), so those messages stay as they are.
  const lastSavedAt = msgs.reduce((hi, m, i) => {
    const saved = (m.proposals ?? []).some((p) => {
      const c = cards[p.id];
      return p.type !== 'tip' && !c?.dismissed && (c?.status === 'working' || c?.status === 'done');
    });
    return saved ? i : hi;
  }, -1);

  function resend(i: number, text: string) {
    if (busy) return;
    void send(text, msgs.slice(0, i));
  }

  const setCard = (id: string, s: CardState) => setCards((c) => ({ ...c, [id]: s }));

  // The owner pressed Confirm: only now does anything get saved or sent, through the normal guarded endpoints.
  async function confirm(p: Proposal) {
    if (p.type === 'tip') {
      // Nothing is saved here. The owner is interested, so the assistant takes over and prepares the listing.
      setCard(p.id, { status: 'done', note: 'Great. The assistant is preparing it for you.' });
      void send(`I'm interested in adding ${p.data.term} to ${p.businessName}. Please set it up.`, msgs, true);
      return;
    }
    setCard(p.id, { status: 'working' });
    let saved = 0;
    try {
      if (p.type === 'business') {
        await createBusiness(p.data);
        setCard(p.id, { status: 'done', note: 'Business created.' });
        // Let the assistant carry on (it will read the new business itself).
        const after = msgs;
        void send('I confirmed the business. Please continue with my listings.', after, true);
        return;
      }
      if (p.type === 'listings') {
        const created: { id: string; title: string }[] = [];
        for (const l of p.data.listings) { const r = await addListing(p.businessId, l); created.push({ id: r.id, title: l.title }); saved += 1; }
        setCard(p.id, { status: 'done', note: `${saved} listing${saved === 1 ? '' : 's'} added. You can add a photo to each one below.`, created });
        // Next stage: let the assistant check PayPal and offer to connect it.
        void send('I confirmed the listings. Please check my PayPal setup.', msgs, true);
        return;
      }
      const r = await connectPaypal(p.businessId);
      setCard(p.id, { status: 'done', note: 'Your PayPal link is ready. Open it in a private window, log in with your PayPal Business account and approve. Then ask me to check your PayPal.', url: r.onboardingUrl });
    } catch (e) {
      const partial = p.type === 'listings' && saved > 0 ? ` ${saved} of ${p.data.listings.length} were saved; ask the assistant to add the rest.` : '';
      setCard(p.id, { status: 'failed', note: errorText(e) + partial });
    }
  }

  return (
    <div className="page">
      <section className="chat" aria-label="Business assistant">
        <div className="thread">
          {msgs.length === 0 && (
            <div className="welcome">
              <div className="hero hero-grad hero-blend short">
                <div className="hero-inner">
                  <span className="eyebrow">Business assistant</span>
                  <h1>Let's run your <em>business</em></h1>
                  <p>Tell the assistant what you offer and it sets up your business and listings so shoppers can find them, then guides you through connecting PayPal. It prepares everything as a card, and nothing is saved until you confirm.</p>
                </div>
              </div>
              <p className="examples-label">Try one</p>
              <div className="examples">
                {EXAMPLES.map((ex) => <button key={ex} onClick={() => send(ex)} disabled={busy}>{ex}</button>)}
              </div>
              {demand.length > 0 && (
                <>
                  <p className="fine">Students are searching for (anonymous counts). Tap one for a business idea:</p>
                  <div className="chips">
                    {demand.map((d) => (
                      <button key={d.term} className="chip" disabled={busy} onClick={() => send(`Help me start a business around ${d.term}.`)}>
                        {d.term} · {d.searches}{d.listingsAvailable === 0 ? ' · nobody sells this yet' : ''}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {msgs.map((m, i) => m.role === 'user' ? (
            <UserBubble key={`${i}:${m.text}`} text={m.text} busy={busy} plain={m.auto}
              lockedReason={i < lastSavedAt ? 'Something you confirmed after this message was already saved, so it can’t be changed.' : undefined}
              onResend={(t) => resend(i, t)} />
          ) : (
            <div key={i} className="bubble assistant">
              <RichText text={m.text} />
              {[...(m.proposals ?? [])].sort((a, b) => Number(a.type === 'tip') - Number(b.type === 'tip')).map((p) => (
                <ProposalCard key={p.id} p={p} state={cards[p.id] ?? { status: 'idle' }}
                  onConfirm={() => confirm(p)} onDismiss={() => setCard(p.id, { status: 'done', note: 'Dismissed.', dismissed: true })} />
              ))}
              {m.resources && <StarterPackCard pack={m.resources} defaultOpen={askedForResources(msgs[i - 1]?.role === 'user' ? msgs[i - 1].text : '')} />}
            </div>
          ))}
          {busy && <div className="bubble assistant working">Working on it…</div>}
          {error && <div className="error" role="alert">{error}</div>}
          <div ref={endRef} />
        </div>
        <div className="composer">
          <textarea value={input} rows={2} aria-label="Your message" placeholder="For example: braids 15, wash 5, snack box 3"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }} />
          <button className="primary" onClick={() => send(input)} disabled={busy || !input.trim()}>Send</button>
        </div>
      </section>
    </div>
  );
}

function ProposalCard({ p, state, onConfirm, onDismiss }: { p: Proposal; state: CardState; onConfirm: () => void; onDismiss: () => void }) {
  const finished = state.status === 'done';
  return (
    <div className="card" style={{ marginTop: 10, marginBottom: 0 }}>
      <h2>{p.type === 'business' ? 'New business' : p.type === 'listings' ? 'New listings' : p.type === 'tip' ? `Tip for ${p.businessName}` : 'Connect PayPal'}</h2>
      <p className="fine">{p.summary}</p>
      {p.type === 'tip' && (
        <>
          <p>
            Students searched for <strong>“{p.data.term}”</strong> {p.data.searches} times in the last {p.data.periodDays} days.{' '}
            {p.data.listingsAvailable === 0 ? 'Nobody on campus sells it yet.' : `Only ${p.data.listingsAvailable} listing${p.data.listingsAvailable === 1 ? '' : 's'} match${p.data.listingsAvailable === 1 ? 'es' : ''}.`}
          </p>
          <p className="fine">{p.data.fit}{p.data.costLevel !== 'unknown' && ` Rough start-up cost: ${p.data.costLevel} (an estimate).`}</p>
        </>
      )}
      {p.type === 'business' && <p>{p.data.name} · {p.data.category}{p.data.description ? ` · ${p.data.description}` : ''}</p>}
      {p.type === 'listings' && (
        <ul className="lines">{p.data.listings.map((l) => (
          <li key={l.title}><span>{l.title}<small>{l.unit || l.kind.toLowerCase()}</small></span><span>{dollars(l.priceCents)}</span></li>
        ))}</ul>
      )}
      {state.status === 'failed' && <div className="error" role="alert">{state.note}</div>}
      {finished ? (
        <>
          <p className="fine" role="status">{state.note}</p>
          {state.url && <a className="primary" href={state.url} target="_blank" rel="noopener noreferrer">Open PayPal setup</a>}
          {state.url && p.type === 'paypal' && <PaypalWatch businessId={p.businessId} />}
          {state.created && p.type === 'listings' && (
            <ul className="lines">{state.created.map((c) => (
              <li key={c.id}><span className="grow">{c.title}</span><PhotoButton businessId={p.businessId} listingId={c.id} /></li>
            ))}</ul>
          )}
        </>
      ) : (
        <div className="chips">
          <button className="primary" onClick={onConfirm} disabled={state.status === 'working'}>
            {state.status === 'working' ? 'Working…' : p.type === 'paypal' ? 'Connect PayPal' : p.type === 'tip' ? 'Add this to my business' : 'Confirm'}
          </button>
          <button className="chip" onClick={onDismiss} disabled={state.status === 'working'}>{p.type === 'tip' ? 'Not now' : 'Dismiss'}</button>
        </div>
      )}
    </div>
  );
}

/** After the owner opens the PayPal link, watch for the approval so the card can say when it worked. */
function PaypalWatch({ businessId }: { businessId: string }) {
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    let tries = 0;
    const t = setInterval(async () => {
      tries += 1;
      try {
        const s = await getPaypalStatus(businessId);
        if (s.onboarding === 'READY') { setReady(true); clearInterval(t); }
      } catch (e) {
        if (e instanceof ApiError) { setProblem(e.message); clearInterval(t); } // e.g. that PayPal account is already used
      }
      if (tries >= 60) clearInterval(t);
    }, 5000);
    return () => clearInterval(t);
  }, [businessId]);
  if (problem) return <div className="error" role="alert">{problem}</div>;
  return ready
    ? <p role="status"><strong>PayPal connected.</strong> Your business can now get paid, and shoppers can find your listings.</p>
    : <p className="fine" role="status">Waiting for you to approve in PayPal. This updates by itself.</p>;
}
