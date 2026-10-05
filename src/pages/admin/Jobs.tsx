import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../lib/api';
import { Alert, ReasonAction, Spinner } from '../../components/ui';

export function Jobs() {
  const [jobs, setJobs] = useState<Record<string, any>[] | null>(null);
  const [all, setAll] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const load = () => api.admin<Record<string, any>[]>('jobs', { all }).then(setJobs, (e) => setMsg(e.message));
  useEffect(() => {
    void load();
  }, [all]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <h2>GitHub jobs</h2>
      <div className="row">
        <label className="inline"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Show finished jobs too</label>
        <button type="button" className="btn" onClick={async () => { const r = await api.admin<{ dispatched: number; skipped?: string }>('dispatch-now'); setMsg(r.skipped ? `Dispatch skipped: ${r.skipped}` : `Dispatched ${r.dispatched} job(s).`); await load(); }}>Dispatch due jobs now</button>
      </div>
      {msg && <Alert kind="info">{msg}</Alert>}
      {!jobs ? <Spinner /> : (
        <table className="table">
          <thead><tr><th>Created</th><th>Student</th><th>Lab</th><th>Type</th><th>Status</th><th>Attempts</th><th>Next / error</th><th /></tr></thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td>{new Date(j.created_at).toLocaleString()}</td>
                <td><Link to={`/admin/students/${j.student_id}`}>{j.student_name}</Link> <span className="small muted">{j.student_number}</span></td>
                <td>{j.lab}</td><td>{j.type}</td>
                <td>{j.status}{j.status_reason ? <div className="small muted">{j.status_reason}</div> : null}</td>
                <td>{j.attempts}/{j.max_attempts}</td>
                <td className="small">{j.last_error ?? new Date(j.next_attempt_at).toLocaleString()}</td>
                <td>{['failed', 'held', 'retryable_error', 'cancelled'].includes(j.status) && <ReasonAction label="Retry" onConfirm={async (reason) => { await api.admin('retry-job', { job_id: j.id, reason }); await load(); }} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
