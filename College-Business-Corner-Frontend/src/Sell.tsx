import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  addListing, ApiError, connectPaypal, createBusiness, dollars, getMyBusinesses, getPaypalStatus,
  type OwnedBusiness, type PaypalStatus,
} from './api';
import PhotoButton from './PhotoButton';

const msg = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');

export default function Sell({ email }: { email: string }) {
  const [businesses, setBusinesses] = useState<OwnedBusiness[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getMyBusinesses().then((b) => { setBusinesses(b); setError(null); }).catch((e) => setError(msg(e)));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="page">
      <section className="hero hero-coin hero-blend short sell-hero" aria-label="Seller dashboard">
        <div className="hero-inner">
          <span className="eyebrow">Seller dashboard</span>
          <h1>Your <em>businesses</em></h1>
          <p>Signed in as {email}. Register what you sell, then connect PayPal to get paid directly for every order. The <a href="#/assistant">business assistant</a> can fill in the details for you.</p>
        </div>
      </section>
      {error && <div className="error" role="alert">{error}</div>}
      {businesses === null ? <p>Loading…</p> : businesses.map((b) => <BusinessPanel key={b.id} business={b} onChanged={load} />)}
      {businesses !== null && businesses.length === 0 && (
        <div className="card">
          <h2>No business yet</h2>
          <p>Tell the assistant what you offer, for example “I offer salon services at $15”. It sets everything up and you approve each step. Or register one by hand below.</p>
          <a className="primary" href="#/assistant">Open the assistant</a>
        </div>
      )}
      <NewBusiness onCreated={load} />
    </div>
  );
}

function NewBusiness({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await createBusiness({ name, category, description });
      setName(''); setCategory(''); setDescription('');
      onCreated();
    } catch (err) { setError(msg(err)); } finally { setBusy(false); }
  }

  return (
    <form className="form card" onSubmit={submit}>
      <h2>Register a business</h2>
      <label>Business name
        <input required minLength={2} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Laptop Fix Corner" />
      </label>
      <label>What kind of business
        <input required list="cats" minLength={2} maxLength={30} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="repairs" />
        <datalist id="cats">{['printing', 'salon', 'groceries', 'transport', 'tutoring', 'repairs'].map((c) => <option key={c} value={c} />)}</datalist>
      </label>
      <label>Short description (optional)
        <input maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      {error && <div className="error" role="alert">{error}</div>}
      <button className="primary" disabled={busy}>{busy ? 'Registering…' : 'Register business'}</button>
    </form>
  );
}

function BusinessPanel({ business, onChanged }: { business: OwnedBusiness; onChanged: () => void }) {
  const [status, setStatus] = useState<PaypalStatus | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state = status?.onboarding ?? business.onboarding;

  const check = useCallback(async () => {
    try {
      const s = await getPaypalStatus(business.id);
      setStatus(s); setError(null);
      if (s.onboarding !== business.onboarding) onChanged();
    } catch (e) { setError(msg(e)); }
  }, [business.id, business.onboarding, onChanged]);

  // While setup is unfinished, look again every few seconds so the page updates by itself.
  useEffect(() => {
    if (state !== 'PENDING') return;
    check();
    const t = setInterval(check, 5000);
    return () => clearInterval(t);
  }, [state, check]);

  async function connect() {
    setBusy(true); setError(null);
    try {
      const r = await connectPaypal(business.id);
      setLink(r.onboardingUrl);
      onChanged();
    } catch (e) { setError(msg(e)); } finally { setBusy(false); }
  }

  return (
    <section className="card biz-panel">
      <div className="biz-head">
        <h2>{business.name}</h2>
        <span className={state === 'READY' ? 'badge ok' : 'badge off'}>{state === 'READY' ? 'Ready for orders' : 'Not taking payments yet'}</span>
      </div>
      <p className="fine cap">{business.category}</p>

      <ol className="steps">
        <li className="done">Business registered</li>
        <li className={state === 'READY' ? 'done' : 'now'}>Connect your PayPal account</li>
        <li className={state === 'READY' ? 'done' : ''}>Receive orders from the assistant</li>
      </ol>

      {state !== 'READY' && (
        <div className="connect">
          {!link && state !== 'PENDING' && (
            <>
              <p>PayPal pays you directly for each order. You need a PayPal business account to connect.</p>
              <button className="primary" onClick={connect} disabled={busy}>{busy ? 'Preparing…' : 'Connect PayPal'}</button>
            </>
          )}
          {(link || state === 'PENDING') && (
            <>
              {link && <a className="primary" href={link} target="_blank" rel="noopener noreferrer">Open PayPal setup</a>}
              <p className="fine">Log in to the PayPal account that should receive this business's money and approve the connection. This page updates by itself when you finish.</p>
              <button className="chip" onClick={check}>Check now</button>
              {link === null && <button className="chip" onClick={connect} disabled={busy}>Get a new setup link</button>}
            </>
          )}
          {status && status.fixes.length > 0 && (
            <ul className="reasons">{status.fixes.map((f) => <li key={f}>{f}</li>)}</ul>
          )}
        </div>
      )}
      {error && <div className="error" role="alert">{error}</div>}

      <h3>Listings</h3>
      {business.listings.length === 0 ? <p className="fine">Nothing listed yet. Add what you sell below, or <a href="#/assistant">tell the assistant</a>.</p> : (
        <ul className="lines">
          {business.listings.map((l) => (
            <li key={l.id}>
              <span className="grow">{l.title}<small>{l.unit ?? l.kind.toLowerCase()}</small></span>
              <PhotoButton businessId={business.id} listingId={l.id} imageUrl={l.imageUrl} onUploaded={onChanged} />
              <span>{dollars(l.priceCents)}</span>
            </li>
          ))}
        </ul>
      )}
      <NewListing businessId={business.id} onAdded={onChanged} />
    </section>
  );
}

function NewListing({ businessId, onAdded }: { businessId: string; onAdded: () => void }) {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState('SERVICE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const priceCents = Math.round(parseFloat(price) * 100);
    if (!Number.isFinite(priceCents)) { setError('Enter the price in dollars, for example 12.50.'); return; }
    setBusy(true); setError(null);
    try {
      await addListing(businessId, { title, description, kind, priceCents, unit });
      setTitle(''); setPrice(''); setUnit(''); setDescription('');
      onAdded();
    } catch (err) { setError(msg(err)); } finally { setBusy(false); }
  }

  return (
    <form className="form inline" onSubmit={submit}>
      <label>What you sell
        <input required minLength={2} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Screen repair" />
      </label>
      <label>Price in dollars
        <input required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="45.00" />
      </label>
      <label>Per what (optional)
        <input maxLength={30} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="per repair" />
      </label>
      <label>Type
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="SERVICE">Service</option>
          <option value="PRODUCT">Product</option>
        </select>
      </label>
      <label className="wide-field">Details (optional)
        <input maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      {error && <div className="error wide-field" role="alert">{error}</div>}
      <button className="primary" disabled={busy}>{busy ? 'Adding…' : 'Add listing'}</button>
    </form>
  );
}
