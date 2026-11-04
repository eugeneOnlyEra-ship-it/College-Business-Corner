import { useEffect, useState } from 'react';
import Browse from './Browse';
import Chat from './Chat';
import SafetyLog from './SafetyLog';
import Sell from './Sell';
import OrderPage from './OrderPage';
import Login from './Login';
import OwnerAssistant from './OwnerAssistant';
import { getSession, SESSION_EVENT, setSession, type Session } from './api';

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

function useSession() {
  const [session, setS] = useState<Session | null>(getSession);
  useEffect(() => {
    const on = () => setS(getSession());
    window.addEventListener(SESSION_EVENT, on);
    return () => window.removeEventListener(SESSION_EVENT, on);
  }, []);
  return session;
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="page">
      <article className="receipt wide">
        <h1>{title}</h1>
        <p>{text}</p>
        <a className="primary" href="#/">Back to the assistant</a>
      </article>
    </div>
  );
}

export default function App() {
  const hash = useHash();
  const session = useSession();
  const order = hash.match(/^#\/orders\/([\w-]+)/);
  const owner = session?.role === 'OWNER';
  // Owners land on their dashboard, buyers on the assistant.
  const route = hash === '' || hash === '#/' ? (owner ? '#/assistant' : '#/') : hash;
  // PayPal return pages work without a session (the buyer may come back in a private window).
  const open = Boolean(order) || hash === '#/cancelled' || hash === '#/problem';

  return (
    <div className="shell">
      <header className="top">
        <a href={owner ? '#/assistant' : '#/'} className="brand"><span className="brand-mark" aria-hidden="true"><img src="/logo.png" alt="" width="48" height="48" /></span>College Business Corner</a>
        {session && (
          <nav aria-label="Main">
            {!owner && <a href="#/" aria-current={route === '#/' ? 'page' : undefined}>Assistant</a>}
            {owner && <a href="#/assistant" aria-current={route === '#/assistant' ? 'page' : undefined}>Assistant</a>}
            {owner && <a href="#/sell" aria-current={route === '#/sell' ? 'page' : undefined}>My business</a>}
            <a href="#/browse" aria-current={route === '#/browse' ? 'page' : undefined}>Browse</a>
            <a href="#/log" aria-current={route === '#/log' ? 'page' : undefined}>Safety log</a>
          </nav>
        )}
        <span className="note sandbox">PayPal sandbox · no real money moves</span>
        {session && (
          <span className="note">
            {session.email} ({owner ? 'seller' : 'buyer'}){' '}
            <button className="link" onClick={() => { setSession(null); window.location.hash = '#/'; }}>Sign out</button>
          </span>
        )}
      </header>
      <main key={hash} className="enter">
        {order ? (
          <OrderPage id={order[1]} />
        ) : hash === '#/cancelled' ? (
          <Notice title="Payment cancelled" text="You left PayPal without paying, so nothing was charged. Your cart is gone, but you can ask again any time." />
        ) : hash === '#/problem' ? (
          <Notice title="The payment didn't go through" text="PayPal could not complete this payment. Nothing was charged. You can try the order again." />
        ) : !session && !open ? (
          <Login />
        ) : route === '#/browse' ? (
          <Browse />
        ) : route === '#/assistant' ? (
          owner ? <OwnerAssistant /> : <Notice title="The business assistant is for owners" text="Sign out and choose “I want to sell” to use it." />
        ) : route === '#/sell' ? (
          owner ? <Sell email={session!.email} /> : <Notice title="Selling is for business owners" text="Sign out and choose “I want to sell” to register a business." />
        ) : route === '#/log' ? (
          <SafetyLog />
        ) : (
          <Chat />
        )}
      </main>
      <footer className="foot">Built by students, for students · Payments by PayPal (sandbox) · Photos from Pexels</footer>
    </div>
  );
}
