import { useState } from 'react';
import { api } from '../../lib/api';
import { Alert, ReasonAction, downloadText } from '../../components/ui';

export function Settings() {
  const [paused, setPaused] = useState(false);
  const [limit, setLimit] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div>
      <h2>Settings &amp; exports</h2>
      <section className="card">
        <h3>Grading budget (GitHub Actions minutes)</h3>
        <label className="inline"><input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} /> Pause official grading (submissions stay queued, never dropped)</label>
        <label>Monthly grading-run limit (empty = unlimited)<input value={limit} inputMode="numeric" onChange={(e) => setLimit(e.target.value.replace(/\D/g, ''))} /></label>
        <ReasonAction label="Save grading settings (owner)" onConfirm={async (reason) => {
          const r = await api.admin<{ released: number }>('grading-settings', { paused, monthly_run_limit: limit ? Number(limit) : null, reason });
          setMsg(`Saved. ${r.released} held job(s) released.`);
        }} />
      </section>
      <section className="card">
        <h3>Final results</h3>
        <button type="button" className="btn btn-primary" onClick={async () => {
          const r = await api.admin<{ filename: string; csv: string }>('export-results');
          downloadText(r.filename, r.csv);
        }}>Download results CSV</button>
        <p className="small muted">Official result per lab = latest completed grading run of the latest submitted revision (docs/GRADING.md). Cells are formula-injection safe.</p>
      </section>
      {msg && <Alert kind="success">{msg}</Alert>}
    </div>
  );
}
