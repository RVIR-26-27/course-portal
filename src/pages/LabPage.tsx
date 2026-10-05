import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { api, ApiError, points, reads } from '../lib/api';
import type { Lab, LabSlug, LabState, QuizItem, QuizResult, QuizStatus, Submission } from '../lib/types';
import { describeVariant } from '../lib/variantText';
import { RUBRICS, TOPIC_LABELS } from '../lib/rubric';
import { Alert, Badge, InlineMd, Spinner, shortSha } from '../components/ui';
import { learningContent } from '../content';

type Tab = 'learn' | 'quiz' | 'workshop' | 'submit';
const TABS: { id: Tab; label: string }[] = [
  { id: 'learn', label: '1. Learn' },
  { id: 'quiz', label: '2. Readiness quiz' },
  { id: 'workshop', label: '3. Programming workshop' },
  { id: 'submit', label: '4. Submit / result' },
];

export function LabPage() {
  const { lab: slug } = useParams();
  const [lab, setLab] = useState<Lab | null>(null);
  const [state, setState] = useState<LabState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('learn');

  const load = useCallback(async () => {
    try {
      const [labs, states] = await Promise.all([reads.labs(), reads.myStates()]);
      const l = labs.find((x) => x.slug === slug) ?? null;
      setLab(l);
      setState(states.find((s) => s.lab_id === l?.id) ?? null);
    } catch {
      setError('Could not load the lab.');
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!state) return;
    if (state.quiz_passed_at) setTab((t) => (t === 'learn' ? 'workshop' : t));
    else if (state.learning_completed_at) setTab((t) => (t === 'learn' ? 'quiz' : t));
  }, [state?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!lab || !state) return <Spinner />;
  const s = slug as LabSlug;
  return (
    <section>
      <p>
        <Link to="/">← All labs</Link>
      </p>
      <h1>{lab.title}</h1>
      {state.manual_override &&
        Object.values(state.manual_override).map((o) => (
          <p key={o.label}>
            <Badge tone="warn">{o.label}</Badge>
          </p>
        ))}
      <div role="tablist" aria-label="Lab stages" className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className={tab === t.id ? 'tab active' : 'tab'}
            onClick={() => setTab(t.id)}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="card">
        {tab === 'learn' && <LearnTab lab={s} state={state} onChange={load} goQuiz={() => setTab('quiz')} />}
        {tab === 'quiz' && <QuizTab lab={s} labInfo={lab} onPassed={load} />}
        {tab === 'workshop' && <WorkshopTab lab={s} state={state} reload={load} />}
        {tab === 'submit' && <SubmitTab lab={s} labInfo={lab} state={state} reload={load} />}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ Learn
function LearnTab({ lab, state, onChange, goQuiz }: { lab: LabSlug; state: LabState; onChange: () => Promise<void>; goQuiz: () => void }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(learningContent[lab], { async: false }) as string), [lab]);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <article className="prose" dangerouslySetInnerHTML={{ __html: html }} />
      <hr />
      {state.learning_completed_at ? (
        <Alert kind="success">
          Learning module completed. <button type="button" className="link" onClick={goQuiz}>Go to the readiness quiz →</button>
        </Alert>
      ) : (
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api.completeLearning(lab);
              await onChange();
              goQuiz();
            } finally {
              setBusy(false);
            }
          }}
        >
          I have worked through the module — continue to the quiz
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Quiz
export function remainingSeconds(expiresAt: string, serverNow: string, clientNowAtFetch: number, clientNow = Date.now()): number {
  const offset = new Date(serverNow).getTime() - clientNowAtFetch;
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - (clientNow + offset)) / 1000));
}

function fmt(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export function QuizTab({ lab, labInfo, onPassed }: { lab: LabSlug; labInfo: Lab; onPassed: () => Promise<void> }) {
  const [status, setStatus] = useState<QuizStatus | null>(null);
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const st = await api.quizStatus(lab);
      setFetchedAt(Date.now());
      setStatus(st);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the quiz.');
    }
  }, [lab]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!status) return <Spinner />;

  if (status.state === 'active') {
    return (
      <QuizRunner
        status={status}
        fetchedAt={fetchedAt}
        onDone={async (r) => {
          setResult(r);
          await refresh();
          if (r.passed) await onPassed();
        }}
      />
    );
  }

  const last = result ?? status.last_result;
  return (
    <div>
      <h2>Readiness quiz</h2>
      <p>
        {labInfo.quiz_question_count} questions · {Math.round(labInfo.quiz_time_limit_seconds / 60)} minutes (server-enforced) · pass mark{' '}
        {Number(labInfo.quiz_pass_percent)}%. You can retry; after two failed attempts in a row there is a 10-minute pause. The quiz only unlocks
        the assignment — it does not count towards your grade.
      </p>
      {last && <ResultPanel result={last} />}
      {status.state === 'passed' && <Alert kind="success">You passed the readiness quiz. The programming workshop is unlocked.</Alert>}
      {status.state === 'learning_incomplete' && <Alert kind="info">Finish the learning module first (tab 1).</Alert>}
      {status.state === 'cooldown' && status.cooldown_until && <Cooldown until={status.cooldown_until} serverNow={status.server_now} fetchedAt={fetchedAt} onOver={refresh} />}
      {status.state === 'ready' && (
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await api.quizStart(lab);
              setResult(null);
              await refresh();
            } catch (e) {
              setError(e instanceof ApiError ? e.message : 'Could not start the quiz.');
            } finally {
              setBusy(false);
            }
          }}
        >
          {last ? 'Start a new attempt' : 'Start the quiz'}
        </button>
      )}
    </div>
  );
}

function Cooldown({ until, serverNow, fetchedAt, onOver }: { until: string; serverNow: string; fetchedAt: number; onOver: () => Promise<void> }) {
  const [left, setLeft] = useState(() => remainingSeconds(until, serverNow, fetchedAt));
  useEffect(() => {
    const t = setInterval(() => {
      const l = remainingSeconds(until, serverNow, fetchedAt);
      setLeft(l);
      if (l <= 0) {
        clearInterval(t);
        void onOver();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [until, serverNow, fetchedAt, onOver]);
  return <Alert kind="warning">Two attempts in a row did not pass. Review the topics above; you can try again in {fmt(left)}.</Alert>;
}

function ResultPanel({ result }: { result: QuizResult }) {
  return (
    <div className={result.passed ? 'alert alert-success' : 'alert alert-warning'} role="status">
      <p>
        <strong>{result.status === 'expired' ? 'Time ran out.' : result.passed ? 'Passed.' : 'Not passed yet.'}</strong> Score {result.score_raw}/
        {result.question_count} ({Number(result.score_percent)}%), pass mark {Number(result.pass_percent)}%.
      </p>
      {!result.passed && result.remediation_topics.length > 0 && (
        <>
          <p>Review these topics in the learning module:</p>
          <ul>
            {result.remediation_topics.map((t) => (
              <li key={t}>{TOPIC_LABELS[t] ?? t}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function QuizRunner({ status, fetchedAt, onDone }: { status: Extract<QuizStatus, { state: 'active' }>; fetchedAt: number; onDone: (r: QuizResult) => Promise<void> }) {
  const [answers, setAnswers] = useState<Record<number, string[] | null>>(() => Object.fromEntries(status.items.map((i) => [i.ordinal, i.answer])));
  const [left, setLeft] = useState(() => remainingSeconds(status.expires_at, status.server_now, fetchedAt));
  const [saving, setSaving] = useState<Record<number, 'saving' | 'saved' | 'error'>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitted = useRef(false);

  const submit = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true;
    setSubmitting(true);
    try {
      const r = await api.quizSubmit(status.attempt_id, answers);
      await onDone(r);
    } catch (e) {
      submitted.current = false;
      setError(e instanceof Error ? e.message : 'Could not submit.');
    } finally {
      setSubmitting(false);
    }
  }, [answers, onDone, status.attempt_id]);

  useEffect(() => {
    const t = setInterval(() => setLeft(remainingSeconds(status.expires_at, status.server_now, fetchedAt)), 1000);
    return () => clearInterval(t);
  }, [status.expires_at, status.server_now, fetchedAt]);

  useEffect(() => {
    if (left <= 0) void submit(); // the server finalizes as expired regardless of this call
  }, [left, submit]);

  const setAnswer = (ordinal: number, value: string[] | null) => {
    setAnswers((a) => ({ ...a, [ordinal]: value }));
    setSaving((s) => ({ ...s, [ordinal]: 'saving' }));
    api.quizAnswer(status.attempt_id, ordinal, value).then(
      () => setSaving((s) => ({ ...s, [ordinal]: 'saved' })),
      () => setSaving((s) => ({ ...s, [ordinal]: 'error' })),
    );
  };

  const answered = Object.values(answers).filter((a) => a && a.length).length;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="quiz-bar" aria-live="polite">
        <span>
          Attempt {status.attempt_number} · {answered}/{status.items.length} answered
        </span>
        <span className={left < 60 ? 'timer urgent' : 'timer'} role="timer" aria-label={`Time left ${fmt(left)}`}>
          ⏱ {fmt(left)}
        </span>
      </div>
      {status.items.map((item) => (
        <QuestionView key={item.ordinal} item={item} value={answers[item.ordinal] ?? null} onChange={(v) => setAnswer(item.ordinal, v)} saving={saving[item.ordinal]} />
      ))}
      {error && <Alert kind="error">{error}</Alert>}
      <button type="submit" className="btn btn-primary" disabled={submitting || left <= 0}>
        {submitting ? 'Submitting…' : 'Submit answers'}
      </button>
      <p className="muted small">Answers are saved as you go; refreshing the page resumes this attempt. The timer is enforced by the server.</p>
    </form>
  );
}

export function QuestionView({ item, value, onChange, saving }: { item: QuizItem; value: string[] | null; onChange: (v: string[] | null) => void; saving?: string }) {
  const name = `q${item.ordinal}`;
  const order = item.type === 'sequence' ? (value && value.length === item.options.length ? value : item.options.map((o) => o.id)) : null;
  const byId = Object.fromEntries(item.options.map((o) => [o.id, o]));
  return (
    <fieldset className="question">
      <legend>
        <span className="qnum">Question {item.ordinal}</span> <InlineMd text={item.prompt} />
      </legend>
      {item.code && (
        <pre className="code" tabIndex={0} aria-label="Code">
          <code>{item.code}</code>
        </pre>
      )}
      {item.type === 'single' &&
        item.options.map((o) => (
          <label key={o.id} className="option">
            <input type="radio" name={name} value={o.id} checked={value?.[0] === o.id} onChange={() => onChange([o.id])} /> <InlineMd text={o.text} />
          </label>
        ))}
      {item.type === 'multi' && (
        <>
          <p className="muted small">Select all that apply.</p>
          {item.options.map((o) => (
            <label key={o.id} className="option">
              <input
                type="checkbox"
                name={name}
                value={o.id}
                checked={!!value?.includes(o.id)}
                onChange={(e) => {
                  const set = new Set(value ?? []);
                  if (e.target.checked) set.add(o.id);
                  else set.delete(o.id);
                  onChange(set.size ? [...set] : null);
                }}
              />{' '}
              <InlineMd text={o.text} />
            </label>
          ))}
        </>
      )}
      {item.type === 'sequence' && order && (
        <>
          <p className="muted small">Put the items in the correct order with the buttons (first at the top).</p>
          <ol className="sequence">
            {order.map((id, i) => (
              <li key={id}>
                <span>
                  <span className="seq-n">{i + 1}.</span> <InlineMd text={byId[id]?.text ?? id} />
                </span>
                <span className="seq-buttons">
                  <button type="button" className="btn btn-small" aria-label={`Move up: ${byId[id]?.text}`} disabled={i === 0} onClick={() => {
                    const n = [...order];
                    [n[i - 1], n[i]] = [n[i]!, n[i - 1]!];
                    onChange(n);
                  }}>
                    ↑
                  </button>
                  <button type="button" className="btn btn-small" aria-label={`Move down: ${byId[id]?.text}`} disabled={i === order.length - 1} onClick={() => {
                    const n = [...order];
                    [n[i + 1], n[i]] = [n[i]!, n[i + 1]!];
                    onChange(n);
                  }}>
                    ↓
                  </button>
                </span>
              </li>
            ))}
          </ol>
          {!value && (
            <button type="button" className="btn btn-small" onClick={() => onChange(order)}>
              Use this order
            </button>
          )}
        </>
      )}
      {saving && <span className="muted small save-state">{saving === 'saving' ? 'Saving…' : saving === 'saved' ? 'Saved' : 'Not saved — it will be sent with Submit'}</span>}
    </fieldset>
  );
}

// ------------------------------------------------------------------ Workshop
function WorkshopTab({ lab, state, reload }: { lab: LabSlug; state: LabState; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const status = state.github_access_status;
  useEffect(() => {
    if (!['queued', 'provisioning', 'retryable_error', 'revocation_pending'].includes(status)) return;
    const t = setInterval(() => void reload(), 10_000);
    return () => clearInterval(t);
  }, [status, reload]);
  useEffect(() => {
    if (status === 'invitation_pending') void api.checkAccess(lab).then(async (r) => { if (r.status === 'ready') await reload(); }, () => undefined);
  }, [status, lab, reload]);

  const rubric = RUBRICS[lab]!;
  return (
    <div>
      <h2>Programming workshop</h2>
      {!state.quiz_passed_at && !state.manual_override?.unlock && <Alert kind="info">Pass the readiness quiz to unlock your personal assignment repository.</Alert>}
      {['queued', 'provisioning'].includes(status) && <Alert kind="info">Your private repository is being prepared. This usually takes a minute or two.</Alert>}
      {status === 'retryable_error' && <Alert kind="warning">{state.github_access_detail ?? 'Repository setup hit a temporary problem and will be retried automatically.'}</Alert>}
      {status === 'failed' && (
        <Alert kind="error">
          Repository setup needs attention from the course staff. You can also{' '}
          <button type="button" className="link" disabled={busy} onClick={async () => {
            setBusy(true);
            try { await api.requestReconcile(lab); setMsg('Retry requested.'); await reload(); } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
          }}>try again</button>.
        </Alert>
      )}
      {status === 'revocation_pending' && <Alert kind="warning">Your repository access is being updated by the course staff.</Alert>}
      {status === 'invitation_pending' && (
        <div className="alert alert-info">
          <p>
            Your repository <strong>{state.github_repo_full_name}</strong> is ready. Accept the GitHub invitation to get access:
          </p>
          <p>
            <a className="btn btn-primary" href={state.github_invitation_url ?? '#'} target="_blank" rel="noreferrer">Open the invitation on GitHub</a>{' '}
            <button type="button" className="btn" disabled={busy} onClick={async () => {
              setBusy(true);
              setMsg(null);
              try {
                const r = await api.checkAccess(lab);
                setMsg(r.status === 'ready' ? 'Access confirmed.' : 'The invitation is not accepted yet.');
                await reload();
              } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
            }}>I have accepted it</button>
          </p>
        </div>
      )}
      {status === 'ready' && (
        <div className="alert alert-success">
          <p>
            Repository: <a href={state.github_repo_url ?? '#'} target="_blank" rel="noreferrer">{state.github_repo_full_name}</a>
          </p>
          <pre className="code"><code>{`git clone https://github.com/${state.github_repo_full_name}.git`}</code></pre>
          <p className="small">Read the repository README: it contains the tasks, the contract and the exact rubric.</p>
        </div>
      )}
      {msg && <p role="status">{msg}</p>}
      {(state.quiz_passed_at || state.manual_override?.unlock) && (
        <>
          <h3>Your variant {state.variant_public_id}</h3>
          <ul>
            {describeVariant(lab, state.variant_payload.params).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </>
      )}
      <h3>How the assignment is graded (3.00 points)</h3>
      <table className="table">
        <thead>
          <tr><th scope="col">Category</th><th scope="col">Points</th><th scope="col">What is checked</th></tr>
        </thead>
        <tbody>
          {rubric.rows.map((r) => (
            <tr key={r.category}><td>{r.category}</td><td>{r.points}</td><td>{r.checks}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="small">
        Your own tests must pass on a correct solution and detect: {rubric.studentTest.join('; ')}. Architecture and hygiene points count once at
        least 4 of 8 functional checks pass.
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ Submit
function SubmitTab({ lab, labInfo, state, reload }: { lab: LabSlug; labInfo: Lab; state: LabState; reload: () => Promise<void> }) {
  const [resolved, setResolved] = useState<{ repo_full_name: string; branch: string; commit_sha: string; quota_used: number; quota_limit: number } | null>(null);
  const [subs, setSubs] = useState<Submission[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const loadSubs = useCallback(async () => setSubs(await reads.mySubmissions(labInfo.id)), [labInfo.id]);
  useEffect(() => {
    void loadSubs();
  }, [loadSubs]);
  useEffect(() => {
    if (!subs?.some((s) => s.status === 'queued' || s.status === 'running')) return;
    const t = setInterval(() => {
      void loadSubs();
      void reload();
    }, 15_000);
    return () => clearInterval(t);
  }, [subs, loadSubs, reload]);

  if (state.github_access_status !== 'ready') return <Alert kind="info">Submitting becomes available once your repository is ready (tab 3).</Alert>;
  const details = state.latest_grade_details;
  return (
    <div>
      <h2>Official grade</h2>
      {state.latest_grade_units !== null ? (
        <div className="grade">
          <p className="grade-value">
            {points(state.latest_grade_units)} <span className="muted">/ 3.00</span>
          </p>
          <p className="small">
            Graded commit <code>{shortSha(state.official_sha)}</code>
            {state.latest_submitted_sha && state.latest_submitted_sha !== state.official_sha && ' — your latest submission is not graded yet; this result still applies.'}
          </p>
          {details?.staff_review && <Alert kind="warning">Some checks of this result need a staff review. The course staff will contact you if anything changes.</Alert>}
          {details?.categories && <CategoryTable categories={details.categories} />}
        </div>
      ) : (
        <p className="muted">No official grade yet.</p>
      )}
      <h2>Submit for grading</h2>
      <p className="small">
        The grader tests the exact commit you confirm here, with hidden tests and your stored variant. Up to {labInfo.daily_submission_limit} requests per day
        (Europe/Ljubljana). Run <code>flutter analyze</code> and <code>flutter test</code> locally first.
      </p>
      {!resolved ? (
        <button type="button" className="btn" disabled={busy} onClick={async () => {
          setBusy(true);
          setError(null);
          try { setResolved(await api.resolveSubmission(lab)); } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
        }}>
          Show my current version
        </button>
      ) : (
        <div className="alert alert-info">
          <p>
            <strong>{resolved.repo_full_name}</strong>, branch <code>{resolved.branch}</code>
            <br />
            Commit <code className="sha">{resolved.commit_sha}</code>
            <br />
            Requests used today: {resolved.quota_used}/{resolved.quota_limit}
          </p>
          <div className="row">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const r = await api.submit(lab, resolved.commit_sha);
                setNotice(r.duplicate ? 'This commit was already submitted; no new request was used.' : r.held ? 'Submitted. Grading is paused by the course staff; your request stays in the queue.' : 'Submitted. Grading usually takes a few minutes.');
                setResolved(null);
                await loadSubs();
                await reload();
              } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
            }}>
              Submit current version for grading
            </button>
            <button type="button" className="btn" onClick={() => setResolved(null)}>Cancel</button>
          </div>
        </div>
      )}
      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}
      <h3>Your submissions</h3>
      {!subs ? (
        <Spinner />
      ) : subs.length === 0 ? (
        <p className="muted">None yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr><th scope="col">Commit</th><th scope="col">Requested</th><th scope="col">Status</th><th scope="col">Points</th></tr>
          </thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.id}>
                <td><code>{shortSha(s.commit_sha)}</code></td>
                <td>{new Date(s.requested_at).toLocaleString()}</td>
                <td>
                  <Badge tone={s.status === 'graded' ? 'good' : s.status === 'error' ? 'bad' : 'info'}>
                    {s.status === 'graded' ? 'Graded' : s.status === 'error' ? 'Error' : s.status === 'running' ? 'Grading' : 'Queued'}
                  </Badge>
                  {s.status_detail && <div className="small muted">{s.status_detail}</div>}
                </td>
                <td>{points(s.grade_units)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  functional: 'Functional behaviour',
  robustness: 'Edge cases & robustness',
  architecture: 'Architecture',
  student_test: 'Your test',
  hygiene: 'Code hygiene',
};

export function CategoryTable({ categories }: { categories: { key: string; earned: number; max: number; summary: string }[] }) {
  return (
    <table className="table">
      <thead>
        <tr><th scope="col">Category</th><th scope="col">Points</th><th scope="col">Feedback</th></tr>
      </thead>
      <tbody>
        {categories.map((c) => (
          <tr key={c.key}>
            <td>{CATEGORY_LABELS[c.key] ?? c.key}</td>
            <td>
              {points(c.earned)} / {points(c.max)}
            </td>
            <td>{c.summary}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
