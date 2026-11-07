import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  addListing, ApiError, connectPaypal, createBusiness, dollars, getMyBusinesses, getPaypalStatus, getSales, updateBusiness, updateListing,
  type BusinessSales, type OwnedBusiness, type PaypalStatus,
} from './api';
import PhotoButton from './PhotoButton';
import StarterPackCard from './StarterPackCard';

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
      <StarterPackCard />
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
      <BusinessEdit business={business} onSaved={onChanged} />
      <SalesPanel businessId={business.id} />

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
          {business.listings.map((l) => <ListingRow key={l.id} businessId={business.id} listing={l} onChanged={onChanged} />)}
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


type OwnedListing = OwnedBusiness['listings'][number];

/** One listing: shows it, and lets the owner fix it, change the price, or hide it without deleting it. */
function ListingRow({ businessId, listing: l, onChanged }: { businessId: string; listing: OwnedListing; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(l.title);
  const [price, setPrice] = useState((l.priceCents / 100).toFixed(2));
  const [unit, setUnit] = useState(l.unit ?? '');
  const [description, setDescription] = useState(l.description ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    const priceCents = Math.round(parseFloat(price) * 100);
    if (!Number.isFinite(priceCents)) { setError('Enter the price in dollars, for example 12.50.'); return; }
    setBusy(true); setError(null);
    try {
      await updateListing(businessId, l.id, { title, priceCents, unit, description });
      setEditing(false); onChanged();
    } catch (err) { setError(msg(err)); } finally { setBusy(false); }
  }

  async function toggle() {
    setBusy(true); setError(null);
    try { await updateListing(businessId, l.id, { active: !l.active }); onChanged(); }
    catch (err) { setError(msg(err)); } finally { setBusy(false); }
  }

  if (editing) {
    return (
      <li className="edit-row">
        <form className="form inline" onSubmit={save}>
          <label>What you sell
            <input required minLength={2} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>Price in dollars
            <input required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          <label>Per what (optional)
            <input maxLength={30} value={unit} onChange={(e) => setUnit(e.target.value)} />
          </label>
          <label className="wide-field">Details (optional)
            <input maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          {error && <div className="error wide-field" role="alert">{error}</div>}
          <div className="row-actions wide-field">
            <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
            <button type="button" className="chip" onClick={() => { setEditing(false); setError(null); }}>Cancel</button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className={l.active ? undefined : 'is-hidden'}>
      <span className="grow">
        {l.title}{!l.active && <span className="badge off hidden-badge">Hidden</span>}
        <small>{l.unit ?? l.kind.toLowerCase()}</small>
        {error && <small className="row-error" role="alert">{error}</small>}
      </span>
      <PhotoButton businessId={businessId} listingId={l.id} imageUrl={l.imageUrl} onUploaded={onChanged} />
      <span className="row-actions">
        <button className="chip" onClick={() => setEditing(true)} disabled={busy}>Edit</button>
        <button className="chip" onClick={toggle} disabled={busy}>{l.active ? 'Hide' : 'Show'}</button>
      </span>
      <span>{dollars(l.priceCents)}</span>
    </li>
  );
}

/** Fix the business name, category or description (the description is what shoppers read on the business page). */
function BusinessEdit({ business, onSaved }: { business: OwnedBusiness; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(business.name);
  const [category, setCategory] = useState(business.category);
  const [description, setDescription] = useState(business.description);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await updateBusiness(business.id, { name, category, description }); setOpen(false); onSaved(); }
    catch (err) { setError(msg(err)); } finally { setBusy(false); }
  }

  if (!open) {
    return (
      <>
        {business.description && <p className="biz-about">{business.description}</p>}
        <button className="chip" onClick={() => setOpen(true)}>Edit business details</button>
      </>
    );
  }
  return (
    <form className="form inline" onSubmit={save}>
      <label>Business name
        <input required minLength={2} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>Category
        <input required minLength={2} maxLength={30} value={category} onChange={(e) => setCategory(e.target.value)} />
      </label>
      <label className="wide-field">What shoppers will read about you
        <input maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Where you are, when you are open, what makes you different" />
      </label>
      {error && <div className="error wide-field" role="alert">{error}</div>}
      <div className="row-actions wide-field">
        <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" className="chip" onClick={() => { setOpen(false); setError(null); }}>Cancel</button>
      </div>
    </form>
  );
}


/** What this business has sold. Only paid orders count. The buyer is shown by name only, never by email. */
function SalesPanel({ businessId }: { businessId: string }) {
  const [sales, setSales] = useState<BusinessSales | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true); setError(null);
    getSales(businessId)
      .then(setSales)
      .catch((e) => setError(msg(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, [businessId]);

  const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="sales">
      <div className="sales-head">
        <h3>Sales</h3>
        <button className="chip" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      {sales && (
        <>
          <dl className="sales-stats">
            <div><dt>Paid orders</dt><dd>{sales.summary.orders}</dd></div>
            <div><dt>Customers paid</dt><dd>{dollars(sales.summary.grossCents)}</dd></div>
            <div><dt>Platform fee</dt><dd>−{dollars(sales.summary.platformFeeCents)}</dd></div>
            <div><dt>You received</dt><dd className="sales-net">{dollars(sales.summary.netCents)}</dd></div>
          </dl>
          {sales.recent.length === 0 ? (
            <p className="fine">No paid orders yet. When a student pays through PayPal, the sale shows up here.</p>
          ) : (
            <ul className="lines sales-list">
              {sales.recent.map((r) => (
                <li key={r.orderId}>
                  <span className="grow">
                    {r.items.map((i) => `${i.quantity} × ${i.title}`).join(', ')}
                    <small>{r.buyerName} · {when(r.date)}</small>
                  </span>
                  <span>{r.netCents !== null ? dollars(r.netCents) : dollars(r.grossCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
