import { useState } from 'react';
import { ApiError, assetUrl, dollars, getBusiness, type BusinessProfile, type ListingView } from './api';

interface Props {
  listings: ListingView[];
  /** Listing ids that are in the current cart. */
  selectedIds?: string[];
  /** A reply is being written, so nothing can be asked right now. */
  busy: boolean;
  /** Sends a message to the assistant, as if the student had typed it. */
  onAsk: (text: string) => void;
}

/** Each business gets its own colour so cards from different sellers are easy to tell apart. */
const tone = (id: string) => `t${[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % 4}`;

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; profile: BusinessProfile };

/**
 * What the assistant found, as cards inside the chat. Tap a card to read about the business and see everything
 * it offers without leaving the conversation, or choose it straight away.
 */
export default function ListingCards({ listings, selectedIds = [], busy, onAsk }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [loads, setLoads] = useState<Record<string, Load>>({});

  const open = listings.find((l) => l.id === openId) ?? null;
  const load = open ? loads[open.business.id] : undefined;

  function toggle(l: ListingView) {
    if (openId === l.id) { setOpenId(null); return; }
    setOpenId(l.id);
    const id = l.business.id;
    if (loads[id]?.state === 'ready' || loads[id]?.state === 'loading') return;
    setLoads((m) => ({ ...m, [id]: { state: 'loading' } }));
    getBusiness(id)
      .then((profile) => setLoads((m) => ({ ...m, [id]: { state: 'ready', profile } })))
      .catch((e) => setLoads((m) => ({ ...m, [id]: { state: 'error', message: e instanceof ApiError ? e.message : 'Could not load this business.' } })));
  }

  const choose = (title: string, biz: string) => onAsk(`I'll take the ${title} from ${biz}.`);

  return (
    <div className="lcards-wrap">
      <p className="lcards-label"><strong>Found for you</strong><span>Tap a card for details, or choose one</span></p>
      <ul className="lcards" aria-label="Listings the assistant found">
        {listings.map((l) => {
          const isOpen = openId === l.id;
          const inCart = selectedIds.includes(l.id);
          const payable = l.business.canReceivePayments;
          return (
            <li key={l.id} className={`lcard${isOpen ? ' open' : ''}${inCart ? ' in-cart' : ''}`}>
              {inCart && <span className="lcard-ribbon">In your cart</span>}
              <button type="button" className="lcard-main" aria-expanded={isOpen} aria-label={`${l.title} from ${l.business.name}, ${dollars(l.priceCents)}. Show details`} onClick={() => toggle(l)}>
                {l.imageUrl
                  ? <img src={assetUrl(l.imageUrl)} alt="" loading="lazy" />
                  : <span className={`lcard-ph ${tone(l.business.id)}`} aria-hidden="true">{l.business.name.slice(0, 1).toUpperCase()}</span>}
                <span className="lcard-title">{l.title}</span>
                <span className="lcard-biz">{l.business.name}</span>
                <span className="lcard-price">{dollars(l.priceCents)}{l.unit ? ` · ${l.unit}` : ''}</span>
              </button>
              <div className="lcard-foot">
                {!payable && <span className="badge off">No PayPal yet</span>}
                {!inCart && payable && (
                  <button type="button" className="chip" disabled={busy} onClick={() => choose(l.title, l.business.name)}>Choose this</button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {open && (
        <section className="ldetail card" aria-label={`About ${open.business.name}`}>
          <div className="ldetail-head">
            <div>
              <h3>{open.business.name}</h3>
              <small className="cap">{open.business.category}</small>
            </div>
            <button type="button" className="chip" onClick={() => setOpenId(null)}>Close</button>
          </div>
          {load?.state === 'loading' && <p className="fine">Loading details…</p>}
          {load?.state === 'error' && <p className="error" role="alert">{load.message}</p>}
          {load?.state === 'ready' && (
            <>
              <p>{load.profile.description || 'This student has not added a description yet.'}</p>
              <p className="fine">
                On the corner since {load.profile.memberSince} · {load.profile.canReceivePayments ? 'Takes PayPal' : 'Not set up for payments yet'}
              </p>
              <h4>Everything they offer</h4>
              <ul className="ldetail-list">
                {load.profile.listings.map((x) => (
                  <li key={x.id} className={x.id === open.id ? 'is-this' : undefined}>
                    {x.imageUrl && <img src={assetUrl(x.imageUrl)} alt="" loading="lazy" />}
                    <span className="grow">
                      <strong>{x.title}</strong>
                      <small>{x.description || (x.kind === 'SERVICE' ? 'Service' : 'Product')}{x.unit ? ` · ${x.unit}` : ''}</small>
                    </span>
                    <span className="ldetail-price">{dollars(x.priceCents)}</span>
                    {load.profile.canReceivePayments && !selectedIds.includes(x.id) && (
                      <button type="button" className="chip" disabled={busy} onClick={() => choose(x.title, load.profile.name)}>Choose this</button>
                    )}
                  </li>
                ))}
              </ul>
              <a className="biz-more" href={`#/business/${open.business.id}`}>Open the full business page →</a>
            </>
          )}
        </section>
      )}
    </div>
  );
}
