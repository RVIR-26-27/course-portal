import { useEffect, useState } from 'react';
import { api, points } from '../../lib/api';
import { Alert, ReasonAction, Spinner } from '../../components/ui';
import type { OverviewRow } from './Students';
import { LAB_SLUGS } from './AdminLayout';

export function Labs() {
  const [rows, setRows] = useState<OverviewRow[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    api.admin<OverviewRow[]>('overview').then(setRows, (e) => setMsg(e.message));
  }, []);
  if (!rows) return msg ? <Alert kind="error">{msg}</Alert> : <Spinner />;
  const active = rows.filter((r) => r.status === 'active');
  return (
    <div>
      <h2>Labs</h2>
      <table className="table">
        <thead><tr><th>Lab</th><th>Learning done</th><th>Quiz passed</th><th>Repository ready</th><th>Graded</th><th>Average</th><th /></tr></thead>
        <tbody>
          {LAB_SLUGS.map((l) => {
            const s = active.map((r) => r.labs[l]).filter(Boolean);
            const graded = s.filter((x) => x!.grade_units !== null);
            const avg = graded.length ? Math.round(graded.reduce((a, x) => a + (x!.grade_units ?? 0), 0) / graded.length) : null;
            return (
              <tr key={l}>
                <td>{l}</td>
                <td>{s.filter((x) => x!.learning).length}</td>
                <td>{s.filter((x) => x!.quiz_passed).length}</td>
                <td>{s.filter((x) => x!.access === 'ready').length}</td>
                <td>{graded.length}</td>
                <td>{points(avg)}</td>
                <td>
                  <ReasonAction label="Regrade all latest submissions" onConfirm={async (reason) => {
                    const r = await api.admin<{ queued: number }>('regrade-lab', { lab: l, reason });
                    setMsg(`${l}: ${r.queued} regrade(s) queued with the current grader version.`);
                  }} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {msg && <Alert kind="info">{msg}</Alert>}
      <p className="small muted">Labs are enabled/disabled and configured in the database (docs/ADMIN_GUIDE.md) so that changes are versioned and reviewed.</p>
    </div>
  );
}
