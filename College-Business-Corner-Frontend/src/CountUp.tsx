import { useEffect, useState } from 'react';

/** Counts from 0 to `to` once on mount (about 0.7s). Shows the final value straight away if motion is reduced. */
export function CountUp({ to }: { to: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(to); return; }
    const start = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      const p = Math.min((now - start) / 700, 1);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{n}</>;
}
