import { useEffect, useRef, useState } from 'react';
import { ApiError, chat, confirmCheckout, type ChatTurn, type Checkout } from './api';
import { Receipt } from './Receipt';
import { RichText } from './RichText';

interface Msg {
  role: 'user' | 'assistant';
  text: string;
}

const EXAMPLES = [
  'I need 40 pages printed and a haircut. My budget is $30.',
  'I need 40 pages printed and a haircut. My budget is $20.',
  'I need 40 pages printed, a haircut and a ride to town, budget $40.',
];

const errorText = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');

export default function Chat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [confirming, setConfirming] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [msgs, busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    const history: ChatTurn[] = msgs.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text }));
    setMsgs((m) => [...m, { role: 'user', text: message }]);
    setInput('');
    setBusy(true);
    setError(null);
    try {
      const res = await chat(message, history);
      setMsgs((m) => [...m, { role: 'assistant', text: res.reply }]);
      if (res.checkout) setCheckout(res.checkout);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
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
                {EXAMPLES.map((ex) => (
                  <button key={ex} onClick={() => send(ex)} disabled={busy}>
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>
              {m.role === 'assistant' ? <RichText text={m.text} /> : <p>{m.text}</p>}
            </div>
          ))}
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
