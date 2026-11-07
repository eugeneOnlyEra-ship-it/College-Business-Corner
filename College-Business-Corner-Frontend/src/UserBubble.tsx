import { useEffect, useRef, useState } from 'react';

/** Copies text, with a fallback for pages that are not served over https (where navigator.clipboard is unavailable). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the older method */
  }
  try {
    const box = document.createElement('textarea');
    box.value = text;
    box.setAttribute('readonly', '');
    box.style.position = 'fixed';
    box.style.opacity = '0';
    document.body.appendChild(box);
    box.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(box);
    return ok;
  } catch {
    return false;
  }
}

interface Props {
  text: string;
  /** A reply is being written, so nothing can be resent right now. */
  busy: boolean;
  /** When set, the message cannot be edited and this says why. */
  lockedReason?: string;
  /** Messages the app wrote itself (not the person) get no buttons. */
  plain?: boolean;
  /** Called with the edited text. The parent drops everything after this message and asks again. */
  onResend: (text: string) => void;
}

/** One of the person's own messages, with Copy and an in-place Edit that resends from here. */
export default function UserBubble({ text, busy, lockedReason, plain, onResend }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      box.current?.focus();
      box.current?.setSelectionRange(draft.length, draft.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    setCopied((await copyText(text)) ? 'ok' : 'fail');
  }

  function startEdit() {
    setDraft(text);
    setEditing(true);
  }

  function save() {
    const next = draft.trim();
    if (!next || busy) return;
    setEditing(false);
    onResend(next);
  }

  if (editing) {
    return (
      <div className="bubble user editing">
        <textarea
          ref={box}
          value={draft}
          rows={Math.min(8, Math.max(2, draft.split('\n').length))}
          aria-label="Edit your message"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false);
            else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
          }}
        />
        <p className="edit-note">Saving resends this message and replaces the replies after it.</p>
        <div className="bubble-actions show">
          <button type="button" onClick={() => setEditing(false)}>Cancel</button>
          <button type="button" className="save" onClick={save} disabled={busy || !draft.trim()}>Save &amp; resend</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bubble user">
      <p>{text}</p>
      {!plain && (
        <div className={`bubble-actions${copied ? ' show' : ''}`}>
          <button type="button" onClick={copy} aria-label="Copy this message">
            {copied === 'ok' ? 'Copied ✓' : copied === 'fail' ? 'Copy failed' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={startEdit}
            disabled={busy || Boolean(lockedReason)}
            title={lockedReason}
            aria-label={lockedReason ? `Edit unavailable: ${lockedReason}` : 'Edit this message'}
          >
            Edit
          </button>
          <span className="sr-only" role="status" aria-live="polite">{copied === 'ok' ? 'Message copied' : ''}</span>
        </div>
      )}
    </div>
  );
}
