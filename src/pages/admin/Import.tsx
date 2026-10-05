import { useState } from 'react';
import { api } from '../../lib/api';
import { Alert, downloadText } from '../../components/ui';

interface DryRun {
  format: string;
  rows: number;
  errors: { line: number; student_number?: string; message: string }[];
  warnings: { line: number; student_number?: string; message: string }[];
  diff: { insert: string[]; update: { student_number: string; changes: Record<string, unknown> }[]; unchanged: number; reactivate: string[]; deactivate: string[] };
  applied: boolean;
}

export function Import() {
  const [csv, setCsv] = useState('');
  const [mode, setMode] = useState<'merge' | 'sync'>('merge');
  const [confirmSync, setConfirmSync] = useState(false);
  const [dry, setDry] = useState<DryRun | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div>
      <h2>Import roster</h2>
      <p className="small">
        UTF-8 CSV with <code>student_number,first_name,last_name,email[,section]</code>, or the University of Maribor study-records export
        (semicolon-separated, <code>Vpisna številka; Priimek Ime; e-Pošta …</code>). GitHub usernames are not needed. Re-importing never rotates
        existing codes and never touches GitHub bindings.
      </p>
      <label>
        CSV file
        <input type="file" accept=".csv,text/csv" onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > 2 * 1024 * 1024) { setError('File larger than 2 MB.'); return; }
          setCsv(await f.text());
          setDry(null);
        }} />
      </label>
      <label>
        …or paste
        <textarea rows={6} value={csv} onChange={(e) => { setCsv(e.target.value); setDry(null); }} spellCheck={false} />
      </label>
      <fieldset>
        <legend>Mode</legend>
        <label className="inline"><input type="radio" checked={mode === 'merge'} onChange={() => setMode('merge')} /> Merge — add new, update names/e-mail/section</label>
        <label className="inline"><input type="radio" checked={mode === 'sync'} onChange={() => setMode('sync')} /> Sync — also deactivate students missing from the file</label>
      </fieldset>
      <button type="button" className="btn" disabled={!csv || busy} onClick={async () => {
        setBusy(true); setError(null); setDone(null);
        try { setDry(await api.admin<DryRun>('roster-dry-run', { csv, mode })); } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
      }}>Dry run</button>
      {error && <Alert kind="error">{error}</Alert>}
      {dry && (
        <div className="card">
          <p>Format <strong>{dry.format}</strong>, {dry.rows} valid rows.</p>
          {dry.errors.length > 0 && (
            <Alert kind="error">
              {dry.errors.length} error(s) — fix the file first:
              <ul>{dry.errors.map((e, i) => <li key={i}>line {e.line}{e.student_number ? ` (${e.student_number})` : ''}: {e.message}</li>)}</ul>
            </Alert>
          )}
          {dry.warnings.length > 0 && (
            <Alert kind="warning">
              <ul>{dry.warnings.map((w, i) => <li key={i}>line {w.line}{w.student_number ? ` (${w.student_number})` : ''}: {w.message}</li>)}</ul>
            </Alert>
          )}
          <ul>
            <li>New students: {dry.diff.insert.length}</li>
            <li>Updated: {dry.diff.update.length}</li>
            <li>Unchanged: {dry.diff.unchanged}</li>
            {mode === 'sync' && <li>Reactivated: {dry.diff.reactivate.length} · <strong>Deactivated: {dry.diff.deactivate.length}</strong></li>}
          </ul>
          {mode === 'sync' && dry.diff.deactivate.length > 0 && (
            <label className="inline"><input type="checkbox" checked={confirmSync} onChange={(e) => setConfirmSync(e.target.checked)} /> I confirm deactivating {dry.diff.deactivate.length} student(s) and revoking their access</label>
          )}
          {dry.errors.length === 0 && (
            <button type="button" className="btn btn-primary" disabled={busy || (mode === 'sync' && dry.diff.deactivate.length > 0 && !confirmSync)} onClick={async () => {
              setBusy(true); setError(null);
              try {
                const r = await api.admin<{ inserted: number; updated: number; deactivated: number; new_codes: number; activation_export: { filename: string; csv: string } | null }>('roster-apply', { csv, mode, confirm_sync: confirmSync });
                if (r.activation_export) downloadText(r.activation_export.filename, r.activation_export.csv);
                setDone(`Imported: ${r.inserted} new, ${r.updated} updated, ${r.deactivated} deactivated. ${r.new_codes} new activation code(s)${r.new_codes ? ' downloaded as a one-time CSV — store it securely and delete it after distribution' : ''}.`);
                setDry(null);
                setCsv('');
              } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
            }}>Apply import</button>
          )}
        </div>
      )}
      {done && <Alert kind="success">{done}</Alert>}
      <AddOne />
    </div>
  );
}

function AddOne() {
  const [f, setF] = useState({ student_number: '', first_name: '', last_name: '', email: '', section: '' });
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form className="card" onSubmit={async (e) => {
      e.preventDefault();
      setMsg(null);
      try {
        const r = await api.admin<{ inserted: number; activation_export: { filename: string; csv: string } | null; errors?: { message: string }[] }>('student-add', { student: f });
        if (r.activation_export) downloadText(r.activation_export.filename, r.activation_export.csv);
        setMsg(r.inserted ? 'Student added; the activation code was downloaded once.' : 'No change (student already exists).');
      } catch (err) { setMsg(err instanceof Error ? err.message : 'Failed'); }
    }}>
      <h3>Add one student</h3>
      {(Object.keys(f) as (keyof typeof f)[]).map((k) => (
        <label key={k}>{k.replace('_', ' ')}<input value={f[k]} required={k !== 'section'} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
      ))}
      <button type="submit" className="btn">Add student</button>
      {msg && <p role="status">{msg}</p>}
    </form>
  );
}
