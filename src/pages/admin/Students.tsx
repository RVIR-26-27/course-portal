import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { api, pts } from '../../lib/api';
import { useLabsBySlug } from '../../lib/useLabs';
import { Alert, Badge, Spinner } from '../../components/ui';
import { LAB_SLUGS } from './AdminLayout';

export interface OverviewRow {
  id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  email: string;
  section: string | null;
  status: string;
  github_login: string | null;
  linked_at: string | null;
  has_current_code: boolean;
  labs: Record<string, { learning: boolean; quiz_passed: boolean; quiz_attempts: number; access: string; repo: string | null; latest_sha: string | null; official_sha: string | null; grade_units: number | null; last_submission_status: string | null; job_problem: string | null; override: boolean }>;
}

export function Students() {
  const [rows, setRows] = useState<OverviewRow[] | null>(null);
  const labs = useLabsBySlug();
  const [q, setQ] = useState('');
  const [problems, setProblems] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.admin<OverviewRow[]>('overview').then(setRows, (e) => setError(e.message));
  }, []);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      const hay = `${r.student_number} ${r.first_name} ${r.last_name} ${r.email} ${r.github_login ?? ''}`.toLowerCase();
      const problem = Object.values(r.labs).some((l) => l.job_problem || l.access === 'failed' || l.last_submission_status === 'error');
      return (!needle || hay.includes(needle)) && (!problems || problem);
    });
  }, [rows, q, problems]);
  if (error) return <Alert kind="error">{error}</Alert>;
  if (!rows) return <Spinner />;
  return (
    <div>
      <div className="row">
        <label className="grow">
          Search (number, name, e-mail, GitHub login)
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="inline">
          <input type="checkbox" checked={problems} onChange={(e) => setProblems(e.target.checked)} /> Only problems
        </label>
      </div>
      <p className="muted small">
        {shown.length} of {rows.length} students · linked {rows.filter((r) => r.linked_at).length}
      </p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Student</th>
              <th scope="col">GitHub</th>
              {LAB_SLUGS.map((l) => (
                <th scope="col" key={l}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className={r.status === 'inactive' ? 'inactive' : ''}>
                <td>
                  <Link to={`/admin/students/${r.id}`}>
                    {r.last_name}, {r.first_name}
                  </Link>
                  <div className="small muted">{r.student_number}{r.status === 'inactive' ? ' · inactive' : ''}</div>
                </td>
                <td>{r.github_login ? `@${r.github_login}` : r.has_current_code ? <Badge>code issued</Badge> : <Badge tone="warn">no code</Badge>}</td>
                {LAB_SLUGS.map((l) => {
                  const s = r.labs[l];
                  if (!s) return <td key={l}>—</td>;
                  return (
                    <td key={l} className="small">
                      {s.quiz_passed ? '✓ quiz' : `${s.quiz_attempts} att.`} · {s.access}
                      {s.grade_units !== null && <> · <strong>{pts(s.grade_units, labs[l])}</strong></>}
                      {s.job_problem && <> · <Badge tone="bad">{s.job_problem}</Badge></>}
                      {s.last_submission_status === 'error' && <> · <Badge tone="bad">grading error</Badge></>}
                      {s.override && <> · <Badge tone="warn">override</Badge></>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
