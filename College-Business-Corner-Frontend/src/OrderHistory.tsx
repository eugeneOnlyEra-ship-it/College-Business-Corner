import { useEffect, useState } from 'react';
import { ApiError, dollars, getMyOrders, type MyOrder } from './api';

const LABEL: Record<MyOrder['status'], { text: string; cls: string }> = {
  COMPLETED: { text: 'Paid', cls: 'ok' },
  AWAITING_APPROVAL: { text: 'Not finished', cls: 'warn' },
  CREATED: { text: 'Started', cls: 'warn' },
  CANCELLED: { text: 'Cancelled', cls: 'off' },
  FAILED: { text: 'Did not go through', cls: 'off' },
};

export default function OrderHistory() {
  const [orders, setOrders] = useState<MyOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyOrders()
      .then(setOrders)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load your orders.'));
  }, []);

  const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="page wide-page">
      <h1>My orders</h1>
      <p className="fine">Everything you have ordered through the assistant. Only you can see this list.</p>
      {error && <div className="error" role="alert">{error}</div>}
      {!orders && !error && <p>Loading…</p>}
      {orders && orders.length === 0 && (
        <div className="card">
          <h2>No orders yet</h2>
          <p>Ask the shopping assistant for what you need and your orders will show up here.</p>
          <a className="primary" href="#/">Start an order</a>
        </div>
      )}
      <ul className="order-list">
        {orders?.map((o) => {
          const st = LABEL[o.status];
          return (
            <li key={o.id} className="card order-row">
              <div className="order-main">
                <div className="order-top">
                  <span className={`badge ${st.cls}`}>{st.text}</span>
                  <small>{when(o.createdAt)}</small>
                </div>
                <p className="order-items">{o.items.map((i) => `${i.quantity} × ${i.title}`).join(', ')}</p>
                <small>{[...new Set(o.items.map((i) => i.business))].join(' · ')}</small>
              </div>
              <div className="order-side">
                <strong>{dollars(o.totalCents)}</strong>
                {o.status === 'COMPLETED' && <a className="chip" href={`#/orders/${o.id}`}>Receipt</a>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
