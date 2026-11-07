import { useEffect, useState } from 'react';
import { ApiError, getStarterPack, type StarterPack } from './api';

interface Props {
  /** The list, when the assistant already sent it. Without it the card fetches the list the first time it is opened. */
  pack?: StarterPack;
  defaultOpen?: boolean;
}

const NEW_TAB = ' (opens in a new tab)';

/** Optional beginner tips, books and websites for new entrepreneurs. Collapsed unless the owner asked for it. */
export default function StarterPackCard({ pack: given, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [pack, setPack] = useState<StarterPack | null>(given ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || pack || error) return;
    getStarterPack()
      .then(setPack)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the starter pack.'));
  }, [open, pack, error]);

  return (
    <section className={`spack${open ? ' is-open' : ''}`} aria-label="Starter pack for new entrepreneurs">
      <button type="button" className="spack-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>
          <strong>Starter pack for new entrepreneurs</strong>
          <small>Optional tips, books and websites to look into</small>
        </span>
        <span className="spack-toggle">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="spack-body">
          {!pack && !error && <p className="fine">Loading…</p>}
          {error && <p className="error" role="alert">{error}</p>}
          {pack && (
            <>
              <h4>Tips to start with</h4>
              <ul className="spack-tips">
                {pack.tips.map((t) => (<li key={t.title}><strong>{t.title}.</strong> {t.text}</li>))}
              </ul>

              <h4>Books worth reading</h4>
              <ul className="spack-list">
                {pack.books.map((b) => (
                  <li key={b.title}>
                    <span className="grow">
                      <strong>{b.title}</strong> <small>by {b.author}</small>
                      <span className="why">{b.why}</span>
                    </span>
                    <a className="chip" href={b.findUrl} target="_blank" rel="noopener noreferrer" aria-label={`Find ${b.title} at Open Library${NEW_TAB}`}>Find a copy</a>
                  </li>
                ))}
              </ul>

              <h4>Websites and courses</h4>
              <ul className="spack-list">
                {pack.websites.map((w) => (
                  <li key={w.url}>
                    <span className="grow">
                      <a href={w.url} target="_blank" rel="noopener noreferrer" aria-label={`${w.name}${NEW_TAB}`}><strong>{w.name}</strong></a>
                      <span className="why">{w.why}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="fine">{pack.note}</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
