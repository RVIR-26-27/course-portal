import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api, points } from '../../lib/api';
import { Alert, Badge, ReasonAction, Spinner, shortSha } from '../../components/ui';
import { LAB_SLUGS } from './AdminLayout';

export function Submissions() {
  const [lab, setLab] = useState<string>('');
  const [rows, setRows] = useState<Record<string, any>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => api.admin<Record<string, any>[]>('submissions', lab ? { lab } : {}).then(setRows, (e) => setError(e.message));
  useEffect(() => {
    setRows(null);
    void load();
  }, [lab]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <h2>Submissions</h2>
      <label className="inline">Lab <select value={lab} onChange={(e) => setLab(e.target.value)}><option value="">all</option>{LAB_SLUGS.map((l) => <option key={l}>{l}</option>)}</select></label>
      {error && <Alert kind="error">{error}</Alert>}
      {!rows ? <Spinner /> : (
        <table className="table">
          <thead><tr><th>#</th><th>Student</th><th>Lab</th><th>Commit</th><th>Status</th><th>Points</th><th>Runs</th><th /></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{s.seq}</td>
                <td><Link to={`/admin/students/${s.student_id}`}>{s.student_name}</Link></td>
                <td>{s.lab}</td><td><code>{shortSha(s.commit_sha)}</code></td>
                <td>{s.status}</td><td>{points(s.grade_units)}</td>
                <td className="small">{(s.runs as any[]).map((r) => <span key={r.id}>g{r.generation} {r.kind} {r.status} {r.total_units !== null ? points(r.total_units) : ''}{r.staff_review ? <Badge tone="warn">review</Badge> : null} </span>)}</td>
                <td><ReasonAction label="Regrade" onConfirm={async (reason) => { await api.admin('request-regrade', { submission_id: s.id, reason }); await load(); }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
