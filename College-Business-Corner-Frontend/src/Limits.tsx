import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, dollars, getLimits, setLimits, type Limits } from './api';

const toDollars = (cents: number | null) => (cents === null ? '' : (cents / 100).toFixed(2));
const toCents = (text: string): number | null => (text.trim() === '' ? null : Math.round(parseFloat(text) * 100));

export default function LimitsPage() {
  const [limits, setL] = useState<Limits | null>(null);
  const [max, setMax] = useState('');
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const apply = (l: Limits) => { setL(l); setMax(toDollars(l.maxOrderCents)); setAsk(toDollars(l.confirmAboveCents)); };

  useEffect(() => {
    getLimits().then(apply).catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load your limits.'));
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    const maxOrderCents = toCents(max);
    const confirmAboveCents = toCents(ask);
    if ((maxOrderCents !== null && !Number.isFinite(maxOrderCents)) || (confirmAboveCents !== null && !Number.isFinite(confirmAboveCents))) {
      setError('Enter amounts in dollars, for example 25.00. Leave a box empty to use the default.'); return;
    }
    setBusy(true); setError(null); setSaved(false);
    try { apply(await setLimits({ maxOrderCents, confirmAboveCents })); setSaved(true); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Could not save. Please try again.'); }
    finally { setBusy(false); }
  }

  function useDefaults() { setMax(''); setAsk(''); setSaved(false); }

  return (
    <div className="page wide-page limits">
      <h1>My spending limits</h1>
      <p>These are your own safety rules for the shopping assistant. You can only make them <strong>stricter</strong> than the campus defaults, never looser.</p>

      {limits && (
        <div className="card limits-now">
          <h2>In force right now</h2>
          <ul className="lines">
            <li><span className="grow">Orders above this are always blocked<small>Campus default {dollars(limits.system.maxOrderCents)}</small></span><strong>{dollars(limits.effective.maxOrderCents)}</strong></li>
            <li><span className="grow">The assistant must ask you first above<small>Campus default {dollars(limits.system.confirmAboveCents)}</small></span><strong>{dollars(limits.effective.confirmAboveCents)}</strong></li>
          </ul>
        </div>
      )}

      <form className="card form" onSubmit={save}>
        <h2>Change them</h2>
        <label>Never let an order go above (dollars)
          <input inputMode="decimal" value={max} onChange={(e) => { setMax(e.target.value); setSaved(false); }}
            placeholder={limits ? `Default ${(limits.system.maxOrderCents / 100).toFixed(2)}` : ''} />
        </label>
        <label>Ask me before spending more than (dollars)
          <input inputMode="decimal" value={ask} onChange={(e) => { setAsk(e.target.value); setSaved(false); }}
            placeholder={limits ? `Default ${(limits.system.confirmAboveCents / 100).toFixed(2)}` : ''} />
        </label>
        <p className="fine">Leave a box empty to use the default. Orders under your "ask me" amount can go straight to PayPal, where you still approve the payment yourself.</p>
        {error && <div className="error" role="alert">{error}</div>}
        {saved && <div className="notice-ok" role="status">Saved. The assistant will follow these from your next order.</div>}
        <div className="row-actions">
          <button className="primary" disabled={busy || !limits}>{busy ? 'Saving…' : 'Save my limits'}</button>
          <button type="button" className="chip" onClick={useDefaults}>Use the defaults</button>
        </div>
      </form>
    </div>
  );
}
