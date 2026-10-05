import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { maxPts, pts, reads, toPoints } from '../lib/api';
import type { Lab, LabState } from '../lib/types';
import { fmtDate, fmtLeft, scheduleOf } from '../lib/schedule';
import { Alert, Badge, Icon, ScoreRing, Skeleton, Steps, useNow, type StepState, type Tone } from '../components/ui';

export function accessLabel(s: LabState): { text: string; tone: Tone } {
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

function stepStates(st: LabState | undefined): StepState[] {
  if (!st) return ['current', 'todo', 'todo', 'todo'];
  const learn = !!st.learning_completed_at;
  const quiz = !!st.quiz_passed_at || !!st.manual_override?.unlock;
  const repoReady = st.github_access_status === 'ready';
  const repoWaiting = ['queued', 'provisioning', 'invitation_pending', 'retryable_error'].includes(st.github_access_status);
  const graded = st.latest_grade_units !== null;
  return [
    learn ? 'done' : 'current',
    quiz ? 'done' : learn ? 'current' : 'todo',
    repoReady ? 'done' : repoWaiting ? 'waiting' : quiz ? 'current' : 'todo',
    graded ? 'done' : repoReady ? 'current' : 'todo',
  ];
}

function nextAction(st: LabState | undefined, upcoming: boolean): string {
  if (upcoming) return 'Look inside';
  if (!st || !st.learning_completed_at) return 'Start learning';
  if (!st.quiz_passed_at && !st.manual_override?.unlock) return 'Take the quiz';
  if (st.github_access_status === 'invitation_pending') return 'Accept the invitation';
  if (st.github_access_status !== 'ready') return 'View repository status';
  if (st.latest_grade_units === null) return 'Submit your solution';
  return 'View result';
}

/** One lab on the dashboard (also used by the admin student view). */
export function LabCard({ lab, state, to }: { lab: Lab; state?: LabState; to: string | null }) {
  const now = useNow(30_000);
  const sched = scheduleOf(lab, state, now);
  const acc = state ? accessLabel(state) : { text: 'Locked', tone: 'neutral' as const };
  const steps = stepStates(state);
  const locked = !lab.enabled || sched.phase === 'upcoming';
  const labels = ['Learn', 'Quiz', 'Repository', 'Submit'];
  const icons = ['book', 'quiz', 'code', 'upload'] as const;
  return (
    <article className={`card card-hover lab-card${locked ? ' locked' : ''}`} aria-labelledby={`lab-${lab.slug}`}>
      <div className="card-head">
        <div>
          <div className="lab-num">{lab.slug.replace('lab0', 'Lab ')}</div>
          <h2 id={`lab-${lab.slug}`}>{lab.title}</h2>
        </div>
        <ScoreRing value={state?.latest_grade_units == null ? null : toPoints(state.latest_grade_units, lab)} max={Number(lab.max_points ?? 3)} size={64} />
      </div>
      <div className="row">
        {!lab.enabled && <Badge tone="warn" icon="lock">Not open yet</Badge>}
        {lab.enabled && sched.phase === 'upcoming' && sched.opensAt && <Badge tone="info" icon="calendar">Opens {fmtDate(sched.opensAt)}</Badge>}
        {lab.enabled && sched.phase === 'open' && sched.deadline && (
          <Badge tone={sched.deadline.getTime() - now < 48 * 3600_000 ? 'warn' : 'neutral'} icon="clock">Due in {fmtLeft(sched.deadline.getTime() - now)}</Badge>
        )}
        {lab.enabled && sched.phase === 'late' && <Badge tone="warn" icon="alert">Late — max {pts(sched.lateCapUnits, lab)}</Badge>}
        {lab.enabled && sched.phase === 'closed' && <Badge tone="bad" icon="lock">Closed</Badge>}
        {sched.extended && <Badge tone="info">Extension</Badge>}
      </div>
      <Steps label={`Progress in ${lab.title}`} steps={labels.map((l, i) => ({ label: l, icon: icons[i]!, state: steps[i]! }))} />
      <dl className="kv small">
        <dt>Readiness quiz</dt>
        <dd>{state?.quiz_passed_at ? <Badge tone="good">Passed</Badge> : state?.learning_completed_at ? <Badge tone="info">Start</Badge> : <Badge>Locked</Badge>}</dd>
        <dt>Assignment</dt>
        <dd><Badge tone={acc.tone}>{acc.text}</Badge></dd>
        <dt>Grade</dt>
        <dd><strong>{state?.latest_grade_units !== null && state?.latest_grade_units !== undefined ? `${pts(state.latest_grade_units, lab)} / ${maxPts(lab)}` : '—'}</strong>{state?.latest_grade_details?.late && <> <Badge tone="warn">late</Badge></>}</dd>
      </dl>
      <div className="grow-space" />
      {lab.enabled && to && (
        <Link className="btn btn-primary btn-block" to={to} aria-label={`Open ${lab.title.split('—')[0]?.trim()}`}>
          {nextAction(state, sched.phase === 'upcoming')} <Icon name="arrowRight" size={16} />
        </Link>
      )}
    </article>
  );
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
  const s = context?.student;
  return <DashboardView labs={labs} states={states} student={s ? { first_name: s.first_name, last_name: s.last_name, github_login: s.github_login, status: s.status } : null} linkFor={(slug) => `/labs/${slug}`} />;
}

export function DashboardView({ labs, states, student, linkFor }: { labs: Lab[] | null; states: LabState[]; student: { first_name: string; last_name: string; github_login: string; status: string } | null; linkFor: (slug: string) => string | null }) {
  const graded = states.filter((x) => x.latest_grade_units !== null);
  const labOf = (st: LabState) => labs?.find((l) => l.id === st.lab_id);
  const total = graded.reduce((a, x) => a + toPoints(x.latest_grade_units ?? 0, labOf(x)), 0);
  const possible = (labs ?? []).reduce((a, l) => a + Number(l.max_points ?? 3), 0);
  return (
    <section className="page">
      <div className="hero">
        <div>
          <div className="eyebrow">Hello{student ? `, ${student.first_name}` : ''}</div>
          <h1>Flutter Mobile Development — Intro Labs</h1>
          <p className="muted">
            {student?.first_name} {student?.last_name} · GitHub @{student?.github_login}
          </p>
        </div>
      </div>
      {student?.status === 'inactive' && <Alert kind="warning">Your course access is inactive. Contact the course staff.</Alert>}
      {labs && (
        <div className="stats">
          <div className="stat"><div className="stat-label">Labs graded</div><div className="stat-value">{graded.length} / {labs.length}</div></div>
          <div className="stat"><div className="stat-label">Points so far</div><div className="stat-value">{total.toFixed(2)} <span className="muted small">/ {possible.toFixed(2)}</span></div></div>
          <div className="stat"><div className="stat-label">Quizzes passed</div><div className="stat-value">{states.filter((x) => x.quiz_passed_at).length}</div></div>
        </div>
      )}
      {!labs ? <Skeleton count={3} /> : (
        <div className="lab-grid">
          {labs.map((lab) => (
            <LabCard key={lab.id} lab={lab} state={states.find((x) => x.lab_id === lab.id)} to={linkFor(lab.slug)} />
          ))}
        </div>
      )}
      <p className="muted small">The labs are optional and independent: you can do any of them in any order. Times are shown in Europe/Ljubljana time.</p>
    </section>
  );
}
