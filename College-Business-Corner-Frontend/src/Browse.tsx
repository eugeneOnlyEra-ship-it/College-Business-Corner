import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CountUp } from './CountUp';
import { ApiError, assetUrl, dollars, getListings, type ListingView } from './api';

export default function Browse() {
  const [listings, setListings] = useState<ListingView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [category, setCategory] = useState('all');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    getListings()
      .then(setListings)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load listings.'));
  }, []);

  // Press Enter or Search: ask the server (it also counts the keyword, never who searched).
  function runSearch(e: FormEvent) {
    e.preventDefault();
    const q = text.trim();
    setSearching(true); setError(null);
    getListings(q || undefined)
      .then((r) => { setListings(r); setCategory('all'); })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Search failed. Please try again.'))
      .finally(() => setSearching(false));
  }

  const categories = useMemo(
    () => ['all', ...new Set((listings ?? []).map((l) => l.business.category))],
    [listings],
  );

  const businesses = useMemo(() => {
    const q = text.trim().toLowerCase();
    const map = new Map<string, { info: ListingView['business']; items: ListingView[] }>();
    for (const l of listings ?? []) {
      if (category !== 'all' && l.business.category !== category) continue;
      if (q && !`${l.title} ${l.description} ${l.business.name}`.toLowerCase().includes(q)) continue;
      const entry = map.get(l.business.id) ?? { info: l.business, items: [] };
      entry.items.push(l);
      map.set(l.business.id, entry);
    }
    return [...map.values()];
  }, [listings, text, category]);

  if (error) return <div className="page wide-page"><div className="error" role="alert">{error}</div></div>;
  if (!listings) return <div className="page wide-page"><p>Loading listings…</p></div>;

  return (
    <div className="page wide-page">
      <h1 className="page-title">Student businesses on campus</h1>
      <p className="fine log-intro">Everything here is run by a student on your campus. Ask the assistant to build a cart from any of it.</p>
      <div className="stats">
        <div className="stat"><span className="stat-label">Businesses</span><strong><CountUp to={new Set(listings.map((l) => l.business.id)).size} /></strong></div>
        <div className="stat"><span className="stat-label">Listings</span><strong><CountUp to={listings.length} /></strong></div>
        <div className="stat"><span className="stat-label">Take PayPal</span><strong><CountUp to={new Set(listings.filter((l) => l.business.canReceivePayments).map((l) => l.business.id)).size} /></strong></div>
      </div>
      <div className="filters">
        <form className="search-row" role="search" onSubmit={runSearch}>
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search printing, haircut, ride…"
            aria-label="Search listings"
          />
          <button className="primary" disabled={searching}>{searching ? 'Searching…' : 'Search'}</button>
        </form>
        <p className="fine">We count what people search for to help new student businesses. We never record who searched.</p>
        <div className="chips" role="group" aria-label="Category">
          {categories.map((c) => (
            <button key={c} className={c === category ? 'chip on' : 'chip'} aria-pressed={c === category} onClick={() => setCategory(c)}>
              {c === 'all' ? 'All' : c}
            </button>
          ))}
        </div>
      </div>

      {businesses.length === 0 && <p className="fine">Nothing matches that. Try a different word or category.</p>}

      <div className="biz-grid">
        {businesses.map(({ info, items }, n) => (
          <section key={info.id} className="biz">
            <div className={`biz-cover t${n % 4}`}>
              <div className="biz-head">
                <span className="biz-tag">{info.category}</span>
                <span className={info.canReceivePayments ? 'badge ok' : 'badge off'}>
                  {info.canReceivePayments ? 'Takes PayPal' : 'Not set up for payments'}
                </span>
              </div>
              <h2>{info.name}</h2>
            </div>
            <div className="biz-body">
              <ul className="lines">
                {items.map((l) => (
                  <li key={l.id}>
                    {l.imageUrl && <img className="thumb" src={assetUrl(l.imageUrl)} alt="" />}
                    <span className="grow">
                      {l.title}
                      <small>{l.unit ?? l.description}</small>
                    </span>
                    <span>{dollars(l.priceCents)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
