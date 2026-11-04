import { dollars, type Checkout } from './api';

const STAMP: Record<Checkout['decision'], { label: string; cls: string }> = {
  ALLOW: { label: 'Ready to pay', cls: 'allow' },
  ASK: { label: 'Needs your OK', cls: 'ask' },
  BLOCK: { label: 'Not allowed', cls: 'block' },
};

interface Props {
  checkout: Checkout | null;
  confirming: boolean;
  onConfirm: () => void;
}

export function Receipt({ checkout, confirming, onConfirm }: Props) {
  if (!checkout) {
    return (
      <aside className="receipt empty" aria-label="Your cart">
        <h2>Your cart</h2>
        <p>Ask for what you need and the assistant will fill this in with real listings and prices.</p>
      </aside>
    );
  }

  const stamp = STAMP[checkout.decision];
  const hasCart = checkout.lines && checkout.lines.length > 0;

  return (
    <aside className="receipt" aria-label="Your cart" aria-live="polite">
      <div className="receipt-head">
        <h2>Your cart</h2>
        <span className={`stamp ${stamp.cls}`}>{stamp.label}</span>
      </div>

      {hasCart && (
        <ul className="lines">
          {checkout.lines!.map((l, i) => (
            <li key={i}>
              <span>
                {l.title}
                {l.quantity > 1 ? ` x${l.quantity}` : ''}
                <small>{l.business}</small>
              </span>
              <span>{dollars(l.totalCents)}</span>
            </li>
          ))}
        </ul>
      )}

      {checkout.totalCents !== undefined && (
        <div className="total">
          <span>Total</span>
          <strong>{dollars(checkout.totalCents)}</strong>
        </div>
      )}
      {checkout.platformFeeCents !== undefined && (
        <p className="fine">
          {dollars(checkout.platformFeeCents)} of this goes to College Business Corner, taken from the sellers' share.
        </p>
      )}

      {checkout.reasons.length > 0 && (
        <ul className="reasons">
          {checkout.reasons.map((r) => (
            <li key={r.code}>{r.message}</li>
          ))}
        </ul>
      )}

      {checkout.decision === 'ASK' && (
        <button className="primary" onClick={onConfirm} disabled={confirming}>
          {confirming ? 'Confirming…' : 'Confirm this order'}
        </button>
      )}
      {checkout.decision === 'ALLOW' && checkout.approveUrl && (
        <a className="primary" href={checkout.approveUrl}>
          Pay with PayPal
        </a>
      )}
      {checkout.decision === 'BLOCK' && <p className="fine">No payment was created. Nothing has been charged.</p>}
      {checkout.decision === 'ALLOW' && <p className="fine">Nothing is charged until you approve it in PayPal.</p>}
    </aside>
  );
}
