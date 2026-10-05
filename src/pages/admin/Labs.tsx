import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../auth/AuthProvider';
import { api, maxPts, pts, reads } from '../../lib/api';
import type { Lab } from '../../lib/types';
import { fmtDateTime, fromLocalInput, scheduleOf, toLocalInput, type Phase } from '../../lib/schedule';
import { Alert, Badge, Icon, ReasonAction, Spinner, type Tone } from '../../components/ui';
import type { OverviewRow } from './Students';

const PHASE: Record<Phase, [string, Tone]> = {
  unscheduled: ['No dates set', 'neutral'],
  upcoming: ['Opens later', 'info'],
  open: ['Open', 'good'],
  late: ['Past deadline (late)', 'warn'],
  closed: ['Closed', 'bad'],
};

export function Labs() {
  const [labs, setLabs] = useState<Lab[] | null>(null);
  const [rows, setRows] = useState<OverviewRow[]>([]);
  const [locks, setLocks] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [l, r, k] = await Promise.all([reads.labs(), api.admin<OverviewRow[]>('overview'), api.admin<Record<string, boolean>>('lab-points-lock')]);
      setLabs(l);
      setRows(r);
      setLocks(k);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (!labs) return msg ? <Alert kind="error">{msg}</Alert> : <Spinner />;
  const active = rows.filter((r) => r.status === 'active');
  return (
    <div>
      <h2>Labs &amp; deadlines</h2>
      <p className="small muted">All times are Europe/Ljubljana. After the deadline a submission counts at most the late cap; the best result counts, so a late attempt never lowers a grade. After the closing date no new submissions are accepted. Changing a deadline or the cap re-scores existing results immediately (audited).</p>
      {msg && <Alert kind="info">{msg}</Alert>}
      <div className="lab-admin">
        {labs.map((lab) => {
          const s = active.map((r) => r.labs[lab.slug]).filter(Boolean);
          const graded = s.filter((x) => x!.grade_units !== null);
          const avg = graded.length ? Math.round(graded.reduce((a, x) => a + (x!.grade_units ?? 0), 0) / graded.length) : null;
          return (
            <LabScheduleCard key={lab.id} lab={lab} pointsLocked={!!locks[lab.slug]} onSaved={async (m) => { setMsg(m); await load(); }}
              stats={{ learning: s.filter((x) => x!.learning).length, quiz: s.filter((x) => x!.quiz_passed).length, ready: s.filter((x) => x!.access === 'ready').length, graded: graded.length, avg }} />
          );
        })}
      </div>
    </div>
  );
}

function LabScheduleCard({ lab, stats, onSaved, pointsLocked }: { lab: Lab; pointsLocked: boolean; stats: { learning: number; quiz: number; ready: number; graded: number; avg: number | null }; onSaved: (msg: string) => Promise<void> }) {
  const { context } = useAuth();
  const owner = context?.admin_role === 'owner';
  const initial = () => ({ opens: toLocalInput(lab.opens_at), deadline: toLocalInput(lab.deadline_at), closes: toLocalInput(lab.closes_at), cap: String(Number(lab.late_cap_percent)), enabled: lab.enabled, maxp: Number(lab.max_points ?? 3).toFixed(2) });
  const [f, setF] = useState(initial);
  const sched = scheduleOf(lab);
  const [label, tone] = PHASE[sched.phase];
  const scheduleDirty = f.opens !== toLocalInput(lab.opens_at) || f.deadline !== toLocalInput(lab.deadline_at) || f.closes !== toLocalInput(lab.closes_at) || Number(f.cap) !== Number(lab.late_cap_percent) || f.enabled !== lab.enabled;
  const pointsDirty = Number(f.maxp) !== Number(lab.max_points ?? 3);
  const dirty = scheduleDirty || pointsDirty;
  const order = (() => {
    const o = fromLocalInput(f.opens), d = fromLocalInput(f.deadline), c = fromLocalInput(f.closes);
    if (o && d && o >= d) return 'The opening date must be before the deadline.';
    if (d && c && d > c) return 'The closing date must not be before the deadline.';
    if (o && c && o >= c) return 'The opening date must be before the closing date.';
    const cap = Number(f.cap);
    if (!Number.isFinite(cap) || cap < 0 || cap > 100) return 'The late cap must be between 0 and 100 %.';
    const mp = Number(f.maxp);
    if (!Number.isFinite(mp) || mp <= 0 || mp > 100) return 'Maximum points must be between 0.01 and 100.';
    return null;
  })();
  return (
    <section className="card" aria-labelledby={`sched-${lab.slug}`}>
      <div className="card-head">
        <div>
          <div className="lab-num">{lab.slug.replace('lab0', 'Lab ')}</div>
          <h3 id={`sched-${lab.slug}`}>{lab.title}</h3>
        </div>
        <div className="row">
          <Badge tone={lab.enabled ? 'good' : 'neutral'} icon={lab.enabled ? 'check' : 'lock'}>{lab.enabled ? 'Enabled' : 'Disabled'}</Badge>
          <Badge tone={tone} icon="calendar">{label}</Badge>
          <Link className="btn btn-small" to="/admin/student-view"><Icon name="eye" size={14} />Student view</Link>
        </div>
      </div>
      <div className="stats">
        <div className="stat"><div className="stat-label">Learning done</div><div className="stat-value">{stats.learning}</div></div>
        <div className="stat"><div className="stat-label">Quiz passed</div><div className="stat-value">{stats.quiz}</div></div>
        <div className="stat"><div className="stat-label">Repo ready</div><div className="stat-value">{stats.ready}</div></div>
        <div className="stat"><div className="stat-label">Graded</div><div className="stat-value">{stats.graded}</div></div>
        <div className="stat"><div className="stat-label">Average</div><div className="stat-value">{pts(stats.avg, lab)}</div></div>
      </div>
      <div className="schedule-grid">
        <div>
          <label>Opens
            <input type="datetime-local" value={f.opens} onChange={(e) => setF({ ...f, opens: e.target.value })} aria-describedby={`${lab.slug}-opens-hint`} />
          </label>
          <p id={`${lab.slug}-opens-hint`} className="hint">{lab.opens_at ? `Now: ${fmtDateTime(lab.opens_at)}` : 'Empty: open as soon as enabled'}</p>
        </div>
        <div>
          <label>Deadline
            <input type="datetime-local" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} aria-describedby={`${lab.slug}-deadline-hint`} />
          </label>
          <p id={`${lab.slug}-deadline-hint`} className="hint">{lab.deadline_at ? `Now: ${fmtDateTime(lab.deadline_at)}` : 'Empty: no deadline'}</p>
        </div>
        <div>
          <label>Closes (optional)
            <input type="datetime-local" value={f.closes} onChange={(e) => setF({ ...f, closes: e.target.value })} aria-describedby={`${lab.slug}-closes-hint`} />
          </label>
          <p id={`${lab.slug}-closes-hint`} className="hint">{lab.closes_at ? `Now: ${fmtDateTime(lab.closes_at)}` : 'Empty: late submissions accepted until the end'}</p>
        </div>
        <div>
          <label>Late cap (% of {Number(f.maxp) > 0 ? Number(f.maxp).toFixed(2) : maxPts(lab)})
            <input type="number" min={0} max={100} step={5} value={f.cap} onChange={(e) => setF({ ...f, cap: e.target.value })} aria-describedby={`${lab.slug}-cap-hint`} />
          </label>
          <p id={`${lab.slug}-cap-hint`} className="hint">{Number(f.cap) >= 0 ? `Late work earns at most ${pts(Math.floor((lab.max_units * Number(f.cap)) / 100), { ...lab, max_points: Number(f.maxp) || lab.max_points })}` : ''}</p>
        </div>
        <div>
          <label>Maximum points
            <input type="number" min={0.5} max={100} step={0.5} value={f.maxp} disabled={pointsLocked} onChange={(e) => setF({ ...f, maxp: e.target.value })} aria-describedby={`${lab.slug}-max-hint`} />
          </label>
          <p id={`${lab.slug}-max-hint`} className="hint">
            {pointsLocked
              ? 'Fixed: student repositories exist, and their README states these points.'
              : 'Set before the semester. Every student README is written with this value; it is fixed once the first repository is created.'}
          </p>
        </div>
      </div>
      <label className="toggle">
        <input type="checkbox" checked={f.enabled} disabled={!owner} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />
        Lab enabled{!owner && ' (owner only)'}
      </label>
      {order && <Alert kind="warning">{order}</Alert>}
      <div className="actions">
        <ReasonAction label="Save schedule" disabled={!dirty || !!order} onConfirm={async (reason) => {
          const parts: string[] = [];
          if (pointsDirty) {
            await api.admin('set-lab-points', { lab: lab.slug, max_points: Number(f.maxp), reason });
            parts.push(`maximum ${Number(f.maxp).toFixed(2)} points`);
          }
          if (scheduleDirty) {
            const r = await api.admin<{ rescored_students: number }>('set-lab-schedule', {
              lab: lab.slug, opens_at: fromLocalInput(f.opens), deadline_at: fromLocalInput(f.deadline), closes_at: fromLocalInput(f.closes),
              late_cap_percent: Number(f.cap), enabled: owner ? f.enabled : undefined, reason,
            });
            parts.push(`schedule saved${r.rescored_students ? ` (${r.rescored_students} student(s) re-scored)` : ''}`);
          }
          await onSaved(`${lab.title}: ${parts.join('; ')}.`);
        }} />
        {dirty && <button type="button" className="btn btn-ghost" onClick={() => setF(initial())}>Discard changes</button>}
        <ReasonAction label="Regrade all latest submissions" onConfirm={async (reason) => {
          const r = await api.admin<{ queued: number }>('regrade-lab', { lab: lab.slug, reason });
          await onSaved(`${lab.title}: ${r.queued} regrade(s) queued with the current grader version.`);
        }} />
      </div>
    </section>
  );
}
