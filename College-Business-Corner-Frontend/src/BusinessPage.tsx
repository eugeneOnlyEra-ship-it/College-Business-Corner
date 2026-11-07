import { useEffect, useState } from 'react';
import { ApiError, assetUrl, dollars, getBusiness, type BusinessProfile } from './api';

const tone = (id: string) => `t${[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % 4}`;

export default function BusinessPage({ id, canOrder }: { id: string; canOrder: boolean }) {
  const [biz, setBiz] = useState<BusinessProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBiz(null); setError(null);
    getBusiness(id)
      .then(setBiz)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load this business.'));
  }, [id]);

  // Hand a ready-made request to the shopping assistant (it stays mounted, so the box is filled when we get there).
  function order(title?: string) {
    if (!biz) return;
    const text = title ? `I'd like ${title} from ${biz.name}.` : `I'd like to order from ${biz.name}.`;
    window.dispatchEvent(new CustomEvent('cbc-prefill', { detail: text }));
    window.location.hash = '#/';
  }

  const back = <a className="back-link" href="#/browse">← All businesses</a>;
  if (error) return <div className="page wide-page">{back}<div className="error" role="alert">{error}</div></div>;
  if (!biz) return <div className="page wide-page">{back}<p>Loading…</p></div>;

  return (
    <div className="page wide-page bizpage">
      {back}
      <section className="biz">
        <div className={`biz-cover ${tone(biz.id)}`}>
          <div className="biz-head">
            <span className="biz-tag">{biz.category}</span>
            <span className={biz.canReceivePayments ? 'badge ok' : 'badge off'}>
              {biz.canReceivePayments ? 'Takes PayPal' : 'Not set up for payments'}
            </span>
          </div>
          <h1>{biz.name}</h1>
        </div>
        <div className="biz-body bizpage-body">
          <p className="bizpage-desc">{biz.description || 'This student has not added a description yet.'}</p>
          <dl className="bizpage-meta">
            <div><dt>Category</dt><dd>{biz.category}</dd></div>
            <div><dt>On the corner since</dt><dd>{biz.memberSince}</dd></div>
            <div><dt>Listings</dt><dd>{biz.listings.length}</dd></div>
            <div><dt>Payment</dt><dd>{biz.canReceivePayments ? 'PayPal (sandbox)' : 'Not available yet'}</dd></div>
          </dl>
          {canOrder && (
            biz.canReceivePayments
              ? <button className="primary" onClick={() => order()}>Order with the assistant</button>
              : <p className="fine">This business has not connected PayPal yet, so the assistant can't check out with it. Check back soon.</p>
          )}
        </div>
      </section>

      <h2 className="bizpage-h">What they offer</h2>
      {biz.listings.length === 0 && <p className="fine">Nothing is listed right now.</p>}
      <ul className="bizpage-listings">
        {biz.listings.map((l) => (
          <li key={l.id} className="card">
            {l.imageUrl && <img src={assetUrl(l.imageUrl)} alt={l.title} loading="lazy" />}
            <div className="bizpage-listing-text">
              <h3>{l.title}</h3>
              <p className="fine">{l.description || (l.kind === 'SERVICE' ? 'Service' : 'Product')}</p>
              {l.unit && <small>{l.unit}</small>}
            </div>
            <div className="bizpage-price">
              <strong>{dollars(l.priceCents)}</strong>
              {canOrder && biz.canReceivePayments && <button className="chip" onClick={() => order(l.title)}>Ask for this</button>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
