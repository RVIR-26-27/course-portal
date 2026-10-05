import { useState } from 'react';
import { api } from '../../lib/api';
import { Alert, downloadText } from '../../components/ui';
import { AuditTable } from './StudentDetail';

export function Audit() {
  const [f, setF] = useState({ action_prefix: '', from: '', to: '', student_id: '' });
  const [rows, setRows] = useState<Record<string, any>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const search = async () => {
    setError(null);
    try {
      setRows(await api.admin('audit', {
        action_prefix: f.action_prefix || null,
        from: f.from ? new Date(f.from).toISOString() : null,
        to: f.to ? new Date(f.to).toISOString() : null,
        student_id: f.student_id || null,
        limit: 2000,
      }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
  };
  return (
    <div>
      <h2>Audit log</h2>
      <p className="small muted">Append-only for application roles; database owners are documented privileged operators (docs/DATA_RETENTION.md).</p>
      <form className="row" onSubmit={(e) => { e.preventDefault(); void search(); }}>
        <label>Action prefix<input value={f.action_prefix} onChange={(e) => setF({ ...f, action_prefix: e.target.value })} placeholder="e.g. identity." /></label>
        <label>From<input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
        <label>To<input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
        <label>Student id<input value={f.student_id} onChange={(e) => setF({ ...f, student_id: e.target.value })} /></label>
        <button type="submit" className="btn btn-primary">Search</button>
      </form>
      {error && <Alert kind="error">{error}</Alert>}
      {rows && (
        <>
          <button type="button" className="btn" onClick={() => downloadText('audit.json', JSON.stringify(rows, null, 2), 'application/json')}>Export JSON</button>
          <AuditTable rows={rows} />
        </>
      )}
    </div>
  );
}
