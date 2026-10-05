import { useEffect, useId, useState, type ReactNode } from 'react';

// ------------------------------------------------------------------ icons
const PATHS: Record<string, ReactNode> = {
  check: <path d="M5 12.5l4.2 4.2L19 7" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 016.5 3H20v16H6.5A2.5 2.5 0 004 21.5z" /><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /></>,
  quiz: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 17h.01" /></>,
  code: <path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" />,
  upload: <path d="M12 16V4m0 0l-4.5 4.5M12 4l4.5 4.5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  alert: <><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5M12 17.5h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.5h.01" /></>,
  success: <><circle cx="12" cy="12" r="9" /><path d="M8 12.3l2.7 2.7L16.2 9.5" /></>,
  error: <><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></>,
  arrowLeft: <path d="M19 12H5m0 0l6-6m-6 6l6 6" />,
  arrowRight: <path d="M5 12h14m0 0l-6-6m6 6l-6 6" />,
  github: <path d="M12 3a9 9 0 00-2.85 17.54c.45.08.62-.2.62-.44v-1.55c-2.5.54-3.03-1.2-3.03-1.2-.41-1.04-1-1.32-1-1.32-.82-.56.06-.55.06-.55.9.06 1.38.93 1.38.93.8 1.38 2.11.98 2.62.75.08-.58.31-.98.57-1.2-2-.23-4.1-1-4.1-4.45 0-.98.35-1.79.93-2.42-.1-.23-.4-1.15.08-2.39 0 0 .76-.24 2.48.92a8.6 8.6 0 014.5 0c1.72-1.16 2.48-.92 2.48-.92.49 1.24.18 2.16.09 2.39.58.63.92 1.44.92 2.42 0 3.46-2.1 4.22-4.1 4.44.32.28.61.83.61 1.67v2.48c0 .24.16.53.62.44A9 9 0 0012 3z" />,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" /></>,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />,
  refresh: <path d="M20 11a8 8 0 00-14.7-4.4L4 8m0-4v4h4M4 13a8 8 0 0014.7 4.4L20 16m0 4v-4h-4" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.6a3.5 3.5 0 010 6.8M21.5 20a6.5 6.5 0 00-4-6" /></>,
  file: <><path d="M14 3H6a1 1 0 00-1 1v16a1 1 0 001 1h12a1 1 0 001-1V8z" /><path d="M14 3v5h5" /></>,
  layers: <path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  shield: <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></>,
  eye: <><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" /><circle cx="12" cy="12" r="3" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  logout: <path d="M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4M10 16l4-4-4-4M14 12H4" />,
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />,
  loader: <path d="M12 3a9 9 0 109 9" />,
  smartphone: <><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18.5h2" /></>,
  monitor: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
};
export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
      {PATHS[name]}
    </svg>
  );
}

// ------------------------------------------------------------------ feedback
export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <p className="spinner-wrap" role="status" aria-live="polite">
      <svg className="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
        <path d="M12 3a9 9 0 109 9" />
      </svg>
      {label}
    </p>
  );
}

export function Skeleton({ kind = 'card', count = 1 }: { kind?: 'card' | 'lines'; count?: number }) {
  return (
    <div aria-hidden className={kind === 'card' ? 'lab-grid' : undefined}>
      {Array.from({ length: count }, (_, i) =>
        kind === 'card' ? <div key={i} className="skeleton skeleton-card" /> : (
          <div key={i}><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line w60" /><div className="skeleton skeleton-line w40" /></div>
        ))}
    </div>
  );
}

const ALERT_ICON = { info: 'info', error: 'error', success: 'success', warning: 'alert' } as const;
export function Alert({ kind = 'info', children }: { kind?: 'info' | 'error' | 'success' | 'warning'; children: ReactNode }) {
  return (
    <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon name={ALERT_ICON[kind]} />
      <div className="alert-body">{children}</div>
    </div>
  );
}

export type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'info';
export function Badge({ tone = 'neutral', children, icon }: { tone?: Tone; children: ReactNode; icon?: IconName }) {
  return <span className={`badge badge-${tone}`}>{icon && <Icon name={icon} size={13} />}{children}</span>;
}

export function Banner({ tone, icon, children }: { tone: 'good' | 'warn' | 'bad' | 'info'; icon: IconName; children: ReactNode }) {
  return (
    <div className={`banner banner-${tone}`} role="status">
      <Icon name={icon} size={20} />
      <div className="grow">{children}</div>
    </div>
  );
}

export function EmptyState({ icon = 'list', children }: { icon?: IconName; children: ReactNode }) {
  return <div className="empty"><Icon name={icon} size={34} /><div>{children}</div></div>;
}

// ------------------------------------------------------------------ data viz (SVG attributes: CSP forbids inline styles)
/** Circular score. `value`/`max` are what is shown (points or a count); the label scales with the ring. */
export function ScoreRing({ value, max, size = 96, decimals = 2, label }: { value: number | null; max: number; size?: number; decimals?: number; label?: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const frac = value === null || max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(frac));
    return () => cancelAnimationFrame(t);
  }, [frac]);
  const tone = value === null ? '' : frac >= 0.8 ? 'good' : frac < 0.5 ? 'warn' : '';
  const main = value === null ? '—' : value.toFixed(decimals);
  const sub = `/ ${max.toFixed(decimals)}`;
  // keep the number inside the inner circle (diameter ~ 72 of the 100-unit viewBox)
  const mainSize = Math.min(24, 62 / Math.max(2.4, main.length * 0.62));
  const subSize = Math.min(12, 54 / Math.max(3, sub.length * 0.6));
  return (
    <div className={`ring ${tone}`} role="img" aria-label={label ?? (value === null ? 'Not graded yet' : `${main} of ${max.toFixed(decimals)}`)}>
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
        <g transform="rotate(-90 50 50)">
          <circle className="ring-track" cx="50" cy="50" r={r} fill="none" strokeWidth={9} />
          <circle className="ring-value" cx="50" cy="50" r={r} fill="none" strokeWidth={9} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - shown)} />
        </g>
        <text className="ring-main" x="50" y={value === null ? 53 : 51} textAnchor="middle" dominantBaseline="middle" fontSize={mainSize}>{main}</text>
        <text className="ring-sub" x="50" y="68" textAnchor="middle" dominantBaseline="middle" fontSize={subSize}>{sub}</text>
      </svg>
    </div>
  );
}

/** Rounded progress bar (native <progress>, so value/max stay attributes under the strict CSP). */
export function Bar({ value, max, tone, label }: { value: number; max: number; tone?: 'good'; label?: string }) {
  return <progress className={`bar${tone ? ` ${tone}` : ''}`} value={Math.max(0, Math.min(value, max))} max={max || 1} aria-label={label} aria-hidden={label ? undefined : true} />;
}

export type StepState = 'done' | 'current' | 'waiting' | 'todo';
export function Steps({ steps, label }: { steps: { label: string; icon: IconName; state: StepState }[]; label: string }) {
  return (
    <ol className="steps" aria-label={label}>
      {steps.map((s) => (
        <li key={s.label} className={`step ${s.state}`}>
          <span className="step-dot">{s.state === 'done' ? <Icon name="check" size={15} /> : s.state === 'waiting' ? <Icon name="loader" size={15} /> : <Icon name={s.icon} size={14} />}</span>
          <span>{s.label}<span className="sr-only"> — {s.state === 'done' ? 'done' : s.state === 'current' ? 'next step' : s.state === 'waiting' ? 'in progress' : 'not started'}</span></span>
        </li>
      ))}
    </ol>
  );
}

/** Re-renders every second while mounted (for countdowns). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn btn-small" aria-label={`${label}: ${text}`} onClick={async () => {
      try {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      } catch { /* clipboard unavailable */ }
    }}>
      <Icon name={done ? 'check' : 'copy'} size={14} />{done ? 'Copied' : label}
    </button>
  );
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
  small = false,
  children,
}: {
  label: string;
  onConfirm: (reason: string, confirm: string) => Promise<void>;
  confirmText?: string;
  danger?: boolean;
  disabled?: boolean;
  small?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  if (!open) {
    return (
      <button type="button" className={`btn${danger ? ' btn-danger' : ''}${small ? ' btn-small' : ''}`} disabled={disabled} onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  }
  const ok = reason.trim().length >= 5 && (!confirmText || confirm.trim().toUpperCase() === confirmText.toUpperCase());
  return (
    <form
      className="reason-form"
      aria-labelledby={`${id}-legend`}
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
        <legend id={`${id}-legend`}>{label}</legend>
        {children}
        <label>
          Reason (recorded in the audit log)
          <input value={reason} onChange={(e) => setReason(e.target.value)} minLength={5} maxLength={500} required autoFocus aria-describedby={`${id}-hint`} />
        </label>
        <p id={`${id}-hint`} className="hint">At least 5 characters.</p>
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
          <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
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
