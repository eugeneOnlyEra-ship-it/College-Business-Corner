import { useRef, useState } from 'react';
import { ApiError, assetUrl, uploadListingImage } from './api';
import { shrinkImage } from './image';

/** One button to add or change a listing photo. The photo is shrunk in the browser, then uploaded. */
export default function PhotoButton({ businessId, listingId, imageUrl, onUploaded }: {
  businessId: string; listingId: string; imageUrl?: string; onUploaded?: (url: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(imageUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const r = await uploadListingImage(businessId, listingId, await shrinkImage(file));
      setUrl(r.imageUrl);
      if (r.imageUrl) onUploaded?.(r.imageUrl);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Could not add the photo.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <span className="photo">
      {url && <img className="thumb" src={assetUrl(url)} alt="" />}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      <button type="button" className="chip" onClick={() => input.current?.click()} disabled={busy}>
        {busy ? 'Uploading…' : url ? 'Change photo' : 'Add photo'}
      </button>
      {error && <span className="error" role="alert">{error}</span>}
    </span>
  );
}
