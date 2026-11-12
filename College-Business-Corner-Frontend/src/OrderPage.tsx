import { useEffect, useState } from 'react';
import { ApiError, dollars, getOrder, type OrderView } from './api';

const STATUS_TEXT: Record<string, string> = {
  COMPLETED: 'Payment complete',
  AWAITING_APPROVAL: 'Waiting for your approval in PayPal',
  CANCELLED: 'Payment cancelled',
  FAILED: 'Payment failed',
  CREATED: 'Order created',
};

export default function OrderPage({ id }: { id: string }) {
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOrder(id)
      .then(setOrder)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load this order.'));
  }, [id]);

  if (error) return <div className="page"><div className="error" role="alert">{error}</div></div>;
  if (!order) return <div className="page"><p>Loading your receipt…</p></div>;

  return (
    <div className="page">
      <article className="receipt wide">
        <div className="receipt-head">
          <h1>{STATUS_TEXT[order.status] ?? order.status}</h1>
          <span className={`stamp ${order.status === 'COMPLETED' ? 'allow' : 'ask'}`}>{order.status.toLowerCase().replace('_', ' ')}</span>
        </div>

        {order.status === 'FAILED' && order.failureReason && (
          <div className="error" role="alert">Details from PayPal: {order.failureReason}</div>
        )}

        <ul className="lines">
          {order.items.map((it, i) => (
            <li key={i}>
              <span>
                {it.listing.title}
                {it.quantity > 1 ? ` x${it.quantity}` : ''}
                <small>{it.business.name}</small>
              </span>
              <span>{dollars(it.unitPriceCents * it.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="total">
          <span>Total paid</span>
          <strong>{dollars(order.totalCents)}</strong>
        </div>

        <h2>Where the money went</h2>
        <table className="payouts">
          <thead>
            <tr>
              <th scope="col">Business</th>
              <th scope="col">Sale</th>
              <th scope="col">Platform fee</th>
              <th scope="col">PayPal fee</th>
              <th scope="col">Business receives</th>
            </tr>
          </thead>
          <tbody>
            {order.payouts.map((p, i) => (
              <tr key={i}>
                <th scope="row">{p.business.name}</th>
                <td>{dollars(p.grossCents)}</td>
                <td>{dollars(p.platformFeeCents)}</td>
                <td>{p.paypalFeeCents === null ? '–' : dollars(p.paypalFeeCents)}</td>
                <td>{p.netCents === null ? '–' : dollars(p.netCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="fine">Each business is paid directly by PayPal. The platform fee is split out at the moment of payment.</p>

        <a className="primary" href="#/">Start another order</a>
        <a className="chip" href="#/orders">My orders</a>
      </article>
    </div>
  );
}
