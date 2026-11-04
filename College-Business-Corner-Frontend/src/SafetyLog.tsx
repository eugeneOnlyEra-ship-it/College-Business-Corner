import { useCallback, useEffect, useState } from 'react';
import { ApiError, getAudit, type AuditEntry } from './api';

const DECISION: Record<AuditEntry['decision'], { label: string; cls: string }> = {
  ALLOW: { label: 'Allowed', cls: 'allow' },
  ASK: { label: 'Asked', cls: 'ask' },
  BLOCK: { label: 'Blocked', cls: 'block' },
};

const ACTION: Record<string, string> = {
  'checkout.request': 'Checkout request',
  'checkout.check': 'Cart check',
};

export default function SafetyLog() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | AuditEntry['decision']>('all');

  const load = useCallback(() => {
    setError(null);
    getAudit()
      .then(setEntries)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the log.'));
  }, []);
  useEffect(load, [load]);

  if (error) return <div className="page wide-page"><div className="error" role="alert">{error}</div></div>;
  if (!entries) return <div className="page wide-page"><p>Loading the log…</p></div>;

  const shown = entries.filter((e) => filter === 'all' || e.decision === filter);

  return (
    <div className="page wide-page">
      <h1 className="page-title">Safety log</h1>
      <p className="fine log-intro">
        Every payment request, from you or from the assistant, is checked against fixed rules before PayPal is contacted.
        Each decision is recorded here.
      </p>
      <div className="filters">
        <div className="chips" role="group" aria-label="Decision">
          {(['all', 'ALLOW', 'ASK', 'BLOCK'] as const).map((d) => (
            <button key={d} className={d === filter ? 'chip on' : 'chip'} aria-pressed={d === filter} onClick={() => setFilter(d)}>
              {d === 'all' ? 'All' : DECISION[d].label}
            </button>
          ))}
        </div>
        <button className="chip" onClick={load}>Refresh</button>
      </div>

      {shown.length === 0 ? (
        <p className="fine">No decisions to show yet. Ask the assistant for something and come back.</p>
      ) : (
        <table className="log">
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Who</th>
              <th scope="col">What</th>
              <th scope="col">Decision</th>
              <th scope="col">Why</th>
              <th scope="col">Order</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                <td>{e.actor === 'agent' ? 'Assistant' : 'You'}</td>
                <td>{ACTION[e.action] ?? e.action}</td>
                <td><span className={`stamp small ${DECISION[e.decision].cls}`}>{DECISION[e.decision].label}</span></td>
                <td className="why">{e.reason}</td>
                <td>{e.orderId ? <a href={`#/orders/${e.orderId}`}>Receipt</a> : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
