import { useState, type ReactNode } from 'react';

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <p className="muted" role="status" aria-live="polite">
      {label}
    </p>
  );
}

export function Alert({ kind = 'info', children }: { kind?: 'info' | 'error' | 'success' | 'warning'; children: ReactNode }) {
  return (
    <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

/** Escapes text and renders `inline code` and **bold** only (quiz prompts/options). */
export function InlineMd({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    parts.push(tok.startsWith('`') ? <code key={i++}>{tok.slice(1, -1)}</code> : <strong key={i++}>{tok.slice(2, -2)}</strong>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/** Button that asks for a reason (and optional confirmation text) before running an audited action. */
export function ReasonAction({
  label,
  onConfirm,
  confirmText,
  danger = false,
  disabled = false,
  children,
}: {
  label: string;
  onConfirm: (reason: string, confirm: string) => Promise<void>;
  confirmText?: string;
  danger?: boolean;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return (
      <button type="button" className={danger ? 'btn btn-danger' : 'btn'} disabled={disabled} onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  }
  const ok = reason.trim().length >= 5 && (!confirmText || confirm.trim().toUpperCase() === confirmText.toUpperCase());
  return (
    <form
      className="reason-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await onConfirm(reason.trim(), confirm.trim());
          setOpen(false);
          setReason('');
          setConfirm('');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed');
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset>
        <legend>{label}</legend>
        {children}
        <label>
          Reason (recorded in the audit log)
          <input value={reason} onChange={(e) => setReason(e.target.value)} minLength={5} maxLength={500} required autoFocus />
        </label>
        {confirmText && (
          <label>
            Type <code>{confirmText}</code> to confirm
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </label>
        )}
        {error && <Alert kind="error">{error}</Alert>}
        <div className="row">
          <button type="submit" className={danger ? 'btn btn-danger' : 'btn btn-primary'} disabled={!ok || busy}>
            {busy ? 'Working…' : 'Confirm'}
          </button>
          <button type="button" className="btn" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}

export function downloadText(filename: string, text: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function shortSha(sha: string | null | undefined) {
  return sha ? sha.slice(0, 8) : '—';
}
