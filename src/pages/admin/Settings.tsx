import { useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../auth/AuthProvider';
import { Alert, Icon, ReasonAction, downloadText } from '../../components/ui';

export function Settings() {
  const [paused, setPaused] = useState(false);
  const [limit, setLimit] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const { context } = useAuth();
  const owner = context?.admin_role === 'owner';
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
        <p className="small muted">Official result per lab = the best result after the late cap (newest grading run per submission), in each lab's points. Cells are formula-injection safe.</p>
      </section>
      <section className="card">
        <h3>Backup</h3>
        <p className="small">
          Downloads all course data as one JSON file: students, activation code hashes, quiz attempts <strong>and answer keys</strong>,
          submissions, grades, jobs, the audit log and the GitHub sign-in identities. The database structure lives in the migrations and is not
          needed in the file.
        </p>
        <Alert kind="warning">The file contains personal data and the quiz answer keys. Store it only in your approved private location — never in git, a shared drive or e-mail.</Alert>
        <button type="button" className="btn btn-primary" disabled={!owner || backupBusy} onClick={async () => {
          setBackupBusy(true);
          setBackupError(null);
          try {
            const r = await api.admin<{ filename: string; backup: { counts: Record<string, number> } }>('backup');
            downloadText(r.filename, JSON.stringify(r.backup), 'application/json');
            const rows = Object.values(r.backup.counts).reduce((a, b) => a + b, 0);
            setMsg(`Backup downloaded: ${Object.keys(r.backup.counts).length} tables, ${rows} rows.`);
          } catch (e) {
            setBackupError(e instanceof Error ? e.message : 'Backup failed');
          } finally {
            setBackupBusy(false);
          }
        }}>
          <Icon name="file" size={16} />{backupBusy ? 'Preparing…' : 'Download backup'}
        </button>
        {!owner && <p className="small muted">Only the owner can download backups.</p>}
        {backupError && <Alert kind="error">{backupError}</Alert>}
        <p className="small muted">Prove a backup restores (on your computer, into the local database): <code>npx tsx scripts/restore-json.ts &lt;file&gt;</code>. The export is recorded in the audit log.</p>
      </section>
      {msg && <Alert kind="success">{msg}</Alert>}
    </div>
  );
}
