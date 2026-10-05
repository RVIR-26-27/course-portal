import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { points, reads } from '../lib/api';
import type { Lab, LabState } from '../lib/types';
import { Alert, Badge, Spinner } from '../components/ui';

export function accessLabel(s: LabState): { text: string; tone: 'neutral' | 'good' | 'warn' | 'bad' | 'info' } {
  switch (s.github_access_status) {
    case 'ready':
      return { text: 'Open repository', tone: 'good' };
    case 'locked':
      return { text: 'Locked', tone: 'neutral' };
    case 'invitation_pending':
      return { text: 'Accept invitation', tone: 'info' };
    case 'failed':
      return { text: 'Needs staff attention', tone: 'bad' };
    case 'revocation_pending':
      return { text: 'Being updated', tone: 'warn' };
    default:
      return { text: 'Preparing…', tone: 'info' };
  }
}

export function Dashboard() {
  const { context } = useAuth();
  const [labs, setLabs] = useState<Lab[] | null>(null);
  const [states, setStates] = useState<LabState[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([reads.labs(), reads.myStates()])
      .then(([l, s]) => {
        setLabs(l);
        setStates(s);
      })
      .catch(() => setError('Could not load your labs.'));
  }, []);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!labs) return <Spinner />;
  const s = context?.student;
  return (
    <section>
      <h1>Flutter Mobile Development — Intro Labs</h1>
      <p className="muted">
        {s?.first_name} {s?.last_name} · GitHub @{s?.github_login}
      </p>
      {s?.status === 'inactive' && <Alert kind="warning">Your course access is inactive. Contact the course staff.</Alert>}
      <div className="lab-grid">
        {labs.map((lab) => {
          const st = states.find((x) => x.lab_id === lab.id);
          const acc = st ? accessLabel(st) : { text: 'Locked', tone: 'neutral' as const };
          return (
            <article key={lab.id} className="card lab-card" aria-labelledby={`lab-${lab.slug}`}>
              <h2 id={`lab-${lab.slug}`}>{lab.title}</h2>
              {!lab.enabled && <Badge tone="warn">Not open yet</Badge>}
              <dl className="status-list">
                <dt>Learning</dt>
                <dd>{st?.learning_completed_at ? <Badge tone="good">✓ Done</Badge> : <Badge>Continue</Badge>}</dd>
                <dt>Readiness quiz</dt>
                <dd>
                  {st?.quiz_passed_at ? <Badge tone="good">Passed</Badge> : st?.learning_completed_at ? <Badge tone="info">Start</Badge> : <Badge>Locked</Badge>}
                </dd>
                <dt>Assignment</dt>
                <dd>
                  <Badge tone={acc.tone}>{acc.text}</Badge>
                </dd>
                <dt>Grade</dt>
                <dd>{st?.latest_grade_units !== null && st?.latest_grade_units !== undefined ? `${points(st.latest_grade_units)} / 3.00` : '—'}</dd>
              </dl>
              {lab.enabled && (
                <Link className="btn btn-primary" to={`/labs/${lab.slug}`}>
                  Open {lab.title.split('—')[0]?.trim()}
                </Link>
              )}
            </article>
          );
        })}
      </div>
      <p className="muted small">The labs are optional and independent: you can do any of them in any order.</p>
    </section>
  );
}
