import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, login, setSession, type Role } from './api';

const SLIDES = [
  { src: '/images/photos/hero.jpg', alt: 'Graduates throwing their caps', tall: true },
  { src: '/images/photos/slide-2.jpg', alt: 'Students planning a project at a desk' },
  { src: '/images/photos/slide-3.jpg', alt: 'Students walking across campus' },
  { src: '/images/photos/slide-4.jpg', alt: 'A team working together on laptops' },
];

export default function Login() {
  const [slide, setSlide] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setInterval(() => setSlide((n) => (n + 1) % SLIDES.length), 9000);
    return () => window.clearInterval(t);
  }, [slide]);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('BUYER');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enter(e: string, r: Role) {
    setBusy(true); setError(null);
    try {
      const res = await login(e.trim().toLowerCase(), r);
      setSession({ token: res.token, email: res.user.email, role: res.user.role });
      window.location.hash = r === 'OWNER' ? '#/assistant' : '#/';
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally { setBusy(false); }
  }

  return (
    <div className="login">
      <section className="hero hero-grad hero-blend" aria-label="Welcome">
        <div className="hero-slides" aria-hidden="true">
          {SLIDES.map((sl, i) => (
            <div key={sl.src} className={`slide${sl.tall ? ' tall' : ''}${i === slide ? ' on' : ''}`}>
              {!sl.tall && <div className="slide-bg" style={{ backgroundImage: `url(${sl.src})` }} />}
              <img className="slide-img" src={sl.src} alt="" />
            </div>
          ))}
        </div>
        <div className="slide-dots" role="group" aria-label="Photo slideshow">
          {SLIDES.map((sl, i) => (
            <button key={sl.src} type="button" className={i === slide ? 'dot on' : 'dot'} aria-label={`Show photo ${i + 1}: ${sl.alt}`} aria-current={i === slide} onClick={() => setSlide(i)} />
          ))}
        </div>
        <div className="hero-inner">
          <span className="eyebrow">Campus marketplace</span>
          <h1>Students sell. Students shop. <em>Everyone stays on budget.</em></h1>
          <p>Tell the assistant what you need and it builds a cart from student-run businesses, checks it against your budget, and pays each seller directly through PayPal.</p>
          <div className="trust">
            <span>Safety checks on every payment</span>
            <span>Sellers paid directly</span>
            <span>Sandbox: no real money</span>
          </div>
        </div>
      </section>

      <div className="login-side">
        <form className="form card" onSubmit={(e: FormEvent) => { e.preventDefault(); enter(email, role); }}>
          <h2>Sign in</h2>
          <div className="chips" role="group" aria-label="I want to">
            <button type="button" className={role === 'BUYER' ? 'chip on' : 'chip'} aria-pressed={role === 'BUYER'} onClick={() => setRole('BUYER')}>I want to buy</button>
            <button type="button" className={role === 'OWNER' ? 'chip on' : 'chip'} aria-pressed={role === 'OWNER'} onClick={() => setRole('OWNER')}>I want to sell</button>
          </div>
          <label>Your email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          {error && <div className="error" role="alert">{error}</div>}
          <button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Continue'}</button>
          <p className="fine">Sign-in: no password in this Web version.</p>
        </form>
        <div className="demo card" aria-label="Quick start">
          <h3>Just looking? Jump straight in</h3>
          <p className="fine">No sign-up needed. Explore the Web version as either side of the marketplace.</p>
          <div className="demo-actions">
            <button className="primary" disabled={busy} onClick={() => enter('demo-buyer@campus.test', 'BUYER')}>Explore as a buyer</button>
            <button className="ghost-dark" disabled={busy} onClick={() => enter('demo-owner@campus.test', 'OWNER')}>Explore as a seller</button>
          </div>
        </div>
      </div>
    </div>
  );
}
