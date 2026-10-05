import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { api, points } from '../../lib/api';
import { Alert, Badge, ReasonAction, Spinner, shortSha } from '../../components/ui';

interface Detail {
  student: Record<string, any>;
  credentials: { version: number; created_at: string; used_at: string | null; revoked_at: string | null }[];
  bindings: { binding_version: number; github_login: string; github_id: number; bound_at: string; unbound_at: string | null; unbound_reason: string | null }[];
  labs: (Record<string, any> & { slug: string })[];
  attempts: (Record<string, any> & { lab: string })[];
  submissions: (Record<string, any> & { lab: string; runs: Record<string, any>[] })[];
  jobs: Record<string, any>[];
  audit: Record<string, any>[];
}

export function StudentDetail() {
  const { id } = useParams();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const load = useCallback(() => api.admin<Detail>('student-detail', { student_id: id }).then(setD, (e) => setError(e.message)), [id]);
  useEffect(() => {
    void load();
  }, [load]);
  if (error) return <Alert kind="error">{error}</Alert>;
  if (!d) return <Spinner />;
  const s = d.student;
  const act = async (action: string, params: Record<string, unknown>) => {
    await api.admin(action, { student_id: id, ...params });
    await load();
  };
  return (
    <div>
      <h2>
        {s.first_name} {s.last_name} <span className="muted">({s.student_number})</span> {s.status === 'inactive' && <Badge tone="warn">inactive</Badge>}
      </h2>
      <p>
        {s.email} · section {s.section ?? '—'} · GitHub {s.github_login ? `@${s.github_login} (id ${s.github_id})` : 'not linked'}
      </p>
      {secret && (
        <Alert kind="success">
          New one-time activation code: <code className="big-code">{secret}</code> — give it to the student through a trusted university channel. It
          is shown only now.
        </Alert>
      )}
      <div className="actions">
        {!s.auth_user_id && (
          <ReasonAction label="Regenerate activation code" onConfirm={async (reason) => {
            const r = await api.admin<{ activation_code: string }>('regenerate-code', { student_id: id, reason });
            setSecret(r.activation_code);
            await load();
          }} />
        )}
        {s.auth_user_id && (
          <ResetLink studentNumber={s.student_number} onDone={async (code) => { setSecret(code); await load(); }} studentId={id!} />
        )}
        <ReasonAction label={s.status === 'active' ? 'Deactivate' : 'Reactivate'} danger={s.status === 'active'} onConfirm={(reason) => act('set-status', { status: s.status === 'active' ? 'inactive' : 'active', reason })} />
        <EditStudent student={s} onSave={(changes, reason, confirm) => act('update-student', { changes, reason, confirm })} />
      </div>
      <p className="small muted">Downloaded code cannot be recalled: revoking repository access only prevents further access.</p>

      <h3>Labs</h3>
      {d.labs.map((l) => (
        <details key={l.slug} className="card" open>
          <summary>
            <strong>{l.slug}</strong> · variant {l.variant_public_id} · access <Badge>{l.github_access_status}</Badge> · grade {points(l.latest_grade_units)}
            {l.manual_override && <Badge tone="warn">override</Badge>}
          </summary>
          <p className="small">
            Learning {l.learning_completed_at ? `✓ (${l.learning_completed_by})` : '—'} · quiz {l.quiz_passed_at ? `passed ${new Date(l.quiz_passed_at).toLocaleString()}` : 'not passed'} · repo{' '}
            {l.github_repo_full_name ? <a href={l.github_repo_url} target="_blank" rel="noreferrer">{l.github_repo_full_name}</a> : '—'} · official {shortSha(l.official_sha)}
          </p>
          {l.github_access_detail && <p className="small muted">{l.github_access_detail}</p>}
          <div className="actions">
            <ReasonAction label="Mark learning complete" onConfirm={(reason) => act('mark-learning', { lab: l.slug, reason })} />
            <ReasonAction label="Reset quiz cooldown" onConfirm={(reason) => act('reset-cooldown', { lab: l.slug, reason })} />
            <ReasonAction label="Unlock (keep quiz requirement)" onConfirm={(reason) => act('unlock', { lab: l.slug, reason })} />
            <ReasonAction label="Force pass quiz + unlock" onConfirm={(reason) => act('force-pass', { lab: l.slug, reason })} />
            <ReasonAction label="Reconcile repository access" onConfirm={(reason) => act('reconcile-access', { lab: l.slug, reason })} />
            <ReasonAction label="Relock (revoke access)" danger onConfirm={(reason) => act('relock', { lab: l.slug, reason })} />
            {l.manual_override?.relock && <ReasonAction label="Clear relock" onConfirm={(reason) => act('clear-relock', { lab: l.slug, reason })} />}
            <AttachRepo onSave={(repo_id, repo_full_name, baseline_sha, reason) => act('attach-repo', { lab: l.slug, repo_id, repo_full_name, baseline_sha, reason })} />
          </div>
        </details>
      ))}

      <h3>Quiz attempts</h3>
      <table className="table">
        <thead><tr><th>Lab</th><th>#</th><th>Started</th><th>Status</th><th>Score</th><th /></tr></thead>
        <tbody>
          {d.attempts.map((a) => (
            <tr key={a.id}>
              <td>{a.lab}</td><td>{a.attempt_number}</td><td>{new Date(a.started_at).toLocaleString()}</td>
              <td>{a.status}{a.passed ? ' ✓' : ''}</td><td>{a.score_raw ?? '—'}/{a.question_count}</td>
              <td>
                {a.status !== 'invalidated' && (
                  <ReasonAction label="Invalidate" danger onConfirm={async (reason) => {
                    const passing = d.labs.find((x) => x.quiz_pass_attempt_id === a.id);
                    const revoke = passing ? window.confirm('This is the PASSING attempt. Also revoke repository access? (OK = revoke, Cancel = keep access)') : undefined;
                    await api.admin('invalidate-attempt', { attempt_id: a.id, reason, revoke_access: revoke });
                    await load();
                  }} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Submissions</h3>
      <table className="table">
        <thead><tr><th>Lab</th><th>Commit</th><th>Requested</th><th>Status</th><th>Points</th><th>Runs</th><th /></tr></thead>
        <tbody>
          {d.submissions.map((s2) => (
            <tr key={s2.id}>
              <td>{s2.lab}</td><td><code>{shortSha(s2.commit_sha)}</code></td><td>{new Date(s2.requested_at).toLocaleString()}</td>
              <td>{s2.status}{s2.status_detail ? <div className="small muted">{s2.status_detail}</div> : null}</td><td>{points(s2.grade_units)}</td>
              <td className="small">{s2.runs.map((r) => `g${r.run_generation}:${r.status}${r.staff_review ? ' ⚑ ' + (r.staff_review_reasons ?? []).join(',') : ''}`).join(' · ')}</td>
              <td><ReasonAction label="Regrade exact SHA" onConfirm={async (reason) => { await api.admin('request-regrade', { submission_id: s2.id, reason }); await load(); }} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Jobs</h3>
      <table className="table">
        <thead><tr><th>Type</th><th>Lab</th><th>Status</th><th>Attempts</th><th>Last error</th><th /></tr></thead>
        <tbody>
          {d.jobs.map((j) => (
            <tr key={j.id}>
              <td>{j.type}</td><td>{j.lab}</td><td>{j.status}{j.status_reason ? <div className="small muted">{j.status_reason}</div> : null}</td>
              <td>{j.attempts}/{j.max_attempts}</td><td className="small">{j.last_error ?? ''}</td>
              <td>{['failed', 'held', 'retryable_error', 'cancelled'].includes(j.status) && <ReasonAction label="Retry" onConfirm={async (reason) => { await api.admin('retry-job', { job_id: j.id, reason }); await load(); }} />}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Identity history</h3>
      <ul className="small">
        {d.bindings.map((b) => (
          <li key={b.binding_version}>v{b.binding_version}: @{b.github_login} (id {b.github_id}) bound {new Date(b.bound_at).toLocaleString()}{b.unbound_at ? `, unbound ${new Date(b.unbound_at).toLocaleString()} — ${b.unbound_reason}` : ''}</li>
        ))}
        {d.credentials.map((c) => (
          <li key={`c${c.version}`}>code v{c.version}: created {new Date(c.created_at).toLocaleString()}{c.used_at ? ', used' : c.revoked_at ? ', revoked' : ', current'}</li>
        ))}
      </ul>

      <h3>Audit (latest 300)</h3>
      <AuditTable rows={d.audit} />
    </div>
  );
}

export function AuditTable({ rows }: { rows: Record<string, any>[] }) {
  return (
    <div className="table-wrap">
      <table className="table small">
        <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td>{new Date(a.created_at).toLocaleString()}</td><td>{a.actor_type}</td><td>{a.action}</td>
              <td>{a.target_type}</td><td><code className="wrap">{JSON.stringify(a.metadata)}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResetLink({ studentId, studentNumber, onDone }: { studentId: string; studentNumber: string; onDone: (code: string) => Promise<void> }) {
  const [policy, setPolicy] = useState<'replace' | 'reassign'>('replace');
  return (
    <ReasonAction label="Reset GitHub link" danger confirmText={studentNumber} onConfirm={async (reason, confirm) => {
      const r = await api.admin<{ activation_code: string }>('reset-link', { student_id: studentId, reason, confirm, repo_policy: policy });
      await onDone(r.activation_code);
    }}>
      <p className="small">
        Removes the current GitHub binding, revokes that account's repository access (verified before new access is granted) and issues a new
        activation code.
      </p>
      <label>
        Existing repositories
        <select value={policy} onChange={(e) => setPolicy(e.target.value as 'replace' | 'reassign')}>
          <option value="replace">Provision a new repository for the new account (history kept)</option>
          <option value="reassign">Re-invite the new account to the existing repository</option>
        </select>
      </label>
    </ReasonAction>
  );
}

function EditStudent({ student, onSave }: { student: Record<string, any>; onSave: (changes: Record<string, string>, reason: string, confirm?: string) => Promise<void> }) {
  const [f, setF] = useState({ first_name: student.first_name, last_name: student.last_name, email: student.email, section: student.section ?? '', student_number: student.student_number });
  const numberChanged = f.student_number !== student.student_number;
  return (
    <ReasonAction label="Edit details" confirmText={numberChanged ? student.student_number : undefined} onConfirm={(reason, confirm) => {
      const changes = Object.fromEntries(Object.entries(f).filter(([k, v]) => (student[k] ?? '') !== v));
      return onSave(changes, reason, numberChanged ? confirm : undefined);
    }}>
      {(['first_name', 'last_name', 'email', 'section', 'student_number'] as const).map((k) => (
        <label key={k}>
          {k.replace('_', ' ')}
          <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
        </label>
      ))}
      {numberChanged && <p className="small">Changing the student number invalidates an unused activation code (regenerate afterwards).</p>}
    </ReasonAction>
  );
}

function AttachRepo({ onSave }: { onSave: (repoId: string, fullName: string, baseline: string | null, reason: string) => Promise<void> }) {
  const [repoId, setRepoId] = useState('');
  const [name, setName] = useState('');
  const [baseline, setBaseline] = useState('');
  return (
    <ReasonAction label="Attach / correct repository" onConfirm={(reason) => onSave(repoId, name, baseline || null, reason)}>
      <label>Numeric repository id<input value={repoId} onChange={(e) => setRepoId(e.target.value)} inputMode="numeric" /></label>
      <label>Full name (org/repo)<input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label>Personalized baseline SHA (optional)<input value={baseline} onChange={(e) => setBaseline(e.target.value)} /></label>
    </ReasonAction>
  );
}
