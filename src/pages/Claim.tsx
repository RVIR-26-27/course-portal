import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { api, ApiError } from '../lib/api';
import { Alert } from '../components/ui';

export function Claim() {
  const { context, refresh } = useAuth();
  const [number, setNumber] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="card narrow">
      <h1>Link your student record</h1>
      <p>
        You are signed in as GitHub <strong>@{context?.github_login ?? '…'}</strong>. Enter your student number and the one-time activation
        code you received from the course staff. This links this GitHub account to your record <strong>permanently</strong>.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api.claim(number, code);
            await refresh();
          } catch (err) {
            if (err instanceof ApiError && err.code === 'rate_limited') {
              const s = Number(err.extra.retry_after_seconds ?? 0);
              setError(`${err.message} (${Math.ceil(s / 60)} min)`);
            } else setError(err instanceof Error ? err.message : 'Failed');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Student number
          <input value={number} onChange={(e) => setNumber(e.target.value)} autoComplete="off" required maxLength={20} inputMode="text" />
        </label>
        <label>
          Activation code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="one-time-code"
            required
            maxLength={40}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            spellCheck={false}
          />
        </label>
        {error && <Alert kind="error">{error}</Alert>}
        <button type="submit" className="btn btn-primary" disabled={busy || !number || !code}>
          {busy ? 'Linking…' : 'Link my record'}
        </button>
      </form>
      <p className="muted small">Wrong GitHub account? Sign out and sign in with the right one before linking. After linking, only staff can change it.</p>
    </section>
  );
}
