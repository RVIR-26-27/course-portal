import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError, maxPts, pts, reads, toPoints } from '../lib/api';
import type { Lab, LabSlug, LabState, QuizItem, QuizResult, QuizStatus, Submission } from '../lib/types';
import { liveActions, type LabActions, type PreviewAnswer, type Resolved } from '../lib/labActions';
import { fmtDate, fmtDateTime, fmtLeft, scheduleOf, type Schedule } from '../lib/schedule';
import { describeVariant } from '../lib/variantText';
import { RUBRICS, TOPIC_LABELS } from '../lib/rubric';
import { Alert, Badge, Banner, Bar, CopyButton, EmptyState, Icon, InlineMd, ScoreRing, Skeleton, Spinner, shortSha, useNow, type IconName } from '../components/ui';
import { learningContent } from '../content';
import { resources } from '../content/resources';
import { LearnModule } from '../components/learn';

type Tab = 'learn' | 'quiz' | 'workshop' | 'submit';
const TABS: { id: Tab; short: string; long: string; icon: IconName }[] = [
  { id: 'learn', short: 'Learn', long: 'Learning module', icon: 'book' },
  { id: 'quiz', short: 'Quiz', long: 'Readiness quiz', icon: 'quiz' },
  { id: 'workshop', short: 'Workshop', long: 'Programming workshop', icon: 'code' },
  { id: 'submit', short: 'Submit', long: 'Submit & result', icon: 'upload' },
];

const unlocked = (s: LabState) => !!(s.quiz_passed_at || s.manual_override?.unlock);

/** Student portal route: loads the student's own data and uses the real server actions. */
export function LabPage() {
  const { lab: slug } = useParams();
  const [lab, setLab] = useState<Lab | null>(null);
  const [state, setState] = useState<LabState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const actions = useMemo(() => liveActions(slug as LabSlug), [slug]);

  const load = useCallback(async () => {
    try {
      const [labs, states] = await Promise.all([reads.labs(), reads.myStates()]);
      const l = labs.find((x) => x.slug === slug) ?? null;
      setLab(l);
      setState(states.find((s) => s.lab_id === l?.id) ?? null);
      if (!l) setError('This lab does not exist.');
    } catch {
      setError('Could not load the lab.');
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <Alert kind="error">{error} <Link to="/">Back to the labs</Link></Alert>;
  if (!lab || !state) return <><Skeleton kind="lines" count={2} /></>;
  return <LabView lab={lab} state={state} actions={actions} reload={load} />;
}

/** The complete student lab screen. Also rendered by the admin "student view" with simulated actions. */
export function LabView({ lab, state, actions, reload, backTo = '/' }: { lab: Lab; state: LabState; actions: LabActions; reload: () => Promise<void>; backTo?: string | null }) {
  const now = useNow(30_000);
  const sched = scheduleOf(lab, state, now);
  const initial: Tab = unlocked(state) ? (state.github_access_status === 'ready' ? 'submit' : 'workshop') : state.learning_completed_at ? 'quiz' : 'learn';
  const [tab, setTab] = useState<Tab>(initial);
  const lastId = useRef(state.id);
  useEffect(() => {
    if (lastId.current !== state.id) {
      lastId.current = state.id;
      setTab(initial);
    }
  }, [state.id, initial]);

  const done: Record<Tab, boolean> = {
    learn: !!state.learning_completed_at,
    quiz: !!state.quiz_passed_at,
    workshop: state.github_access_status === 'ready',
    submit: state.latest_grade_units !== null,
  };
  const s = lab.slug;
  return (
    <section className="page">
      {backTo && <Link to={backTo} className="back"><Icon name="arrowLeft" size={16} /> All labs</Link>}
      <div className="lab-head">
        <div>
          <div className="eyebrow">Optional lab · {lab.slug.replace('lab0', 'Lab ')}</div>
          <h1>{lab.title}</h1>
          <ScheduleLine sched={sched} />
        </div>
        <ScoreRing value={state.latest_grade_units === null ? null : toPoints(state.latest_grade_units, lab)} max={Number(lab.max_points ?? 3)} size={84} />
      </div>
      <ScheduleBanner sched={sched} state={state} lab={lab} />
      {state.manual_override &&
        Object.values(state.manual_override).map((o) => (
          <p key={o.label}><Badge tone="warn" icon="shield">{o.label}</Badge></p>
        ))}
      <div role="tablist" aria-label="Lab stages" className="tabs">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            aria-label={`${i + 1}. ${t.long}${done[t.id] ? ' (done)' : ''}`}
            className={`tab${tab === t.id ? ' active' : ''}${done[t.id] ? ' done' : ''}`}
            onClick={() => setTab(t.id)}
            type="button"
          >
            <span className="tab-n" aria-hidden>{done[t.id] ? <Icon name="check" size={13} /> : i + 1}</span>
            <span className="tab-text" aria-hidden>{t.short}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="card panel" key={tab}>
        {tab === 'learn' && <LearnTab lab={s} state={state} actions={actions} onChange={reload} goQuiz={() => setTab('quiz')} sched={sched} />}
        {tab === 'quiz' && <QuizTab lab={s} labInfo={lab} actions={actions} sched={sched} onPassed={async () => { await reload(); }} goWorkshop={() => setTab('workshop')} />}
        {tab === 'workshop' && <WorkshopTab lab={s} labInfo={lab} state={state} actions={actions} reload={reload} goSubmit={() => setTab('submit')} />}
        {tab === 'submit' && <SubmitTab labInfo={lab} state={state} actions={actions} reload={reload} sched={sched} />}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ schedule display
export function ScheduleLine({ sched }: { sched: Schedule }) {
  if (sched.phase === 'unscheduled') return null;
  return (
    <div className="schedule">
      {sched.opensAt && <span><Icon name="calendar" size={15} /> Opens {fmtDate(sched.opensAt)}</span>}
      {sched.deadline && <span><Icon name="clock" size={15} /> Due {fmtDate(sched.deadline)}{sched.extended && ' (your extension)'}</span>}
      {sched.closesAt && <span><Icon name="lock" size={15} /> Closes {fmtDate(sched.closesAt)}</span>}
    </div>
  );
}

function ScheduleBanner({ sched, state, lab }: { sched: Schedule; state: LabState; lab: Lab }) {
  const now = useNow(1000);
  const cap = pts(sched.lateCapUnits, lab);
  const max = maxPts(lab);
  if (sched.phase === 'upcoming' && sched.opensAt) {
    return <Banner tone="info" icon="calendar">This lab opens on <strong>{fmtDateTime(sched.opensAt)}</strong> — in <span className="countdown">{fmtLeft(sched.opensAt.getTime() - now)}</span>. You can read about it already; the learning module, quiz and assignment start then.</Banner>;
  }
  if (sched.phase === 'open' && sched.deadline) {
    const left = sched.deadline.getTime() - now;
    const soon = left < 48 * 3600_000;
    if (state.latest_grade_units !== null && !soon) return null;
    return (
      <Banner tone={soon ? 'warn' : 'good'} icon="clock">
        Deadline <strong>{fmtDateTime(sched.deadline)}</strong> — <span className="countdown">{fmtLeft(left)}</span> left.
        {' '}Later submissions still count, but at most <strong>{cap}</strong> of {max}.
      </Banner>
    );
  }
  if (sched.phase === 'late') {
    return (
      <Banner tone="warn" icon="alert">
        The deadline ({fmtDateTime(sched.deadline)}) has passed. New submissions count <strong>at most {cap} / {max}</strong>; your best result counts, so a late attempt never lowers your grade.
        {sched.closesAt && <> Submissions close {fmtDateTime(sched.closesAt)} (in <span className="countdown">{fmtLeft(sched.closesAt.getTime() - now)}</span>).</>}
      </Banner>
    );
  }
  if (sched.phase === 'closed') {
    return <Banner tone="bad" icon="lock">This lab closed on <strong>{fmtDateTime(sched.closesAt)}</strong>. New submissions are no longer accepted; your result below is final.</Banner>;
  }
  return null;
}

// ------------------------------------------------------------------ Learn
function LearnTab({ lab, state, actions, onChange, goQuiz, sched }: { lab: LabSlug; state: LabState; actions: LabActions; onChange: () => Promise<void>; goQuiz: () => void; sched: Schedule }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closedForNow = sched.phase === 'upcoming';
  const footer = (
    <>
      <hr />
      {state.learning_completed_at ? (
        <div className="finish-box">
          <span><Icon name="success" /> Learning module completed.</span>
          <button type="button" className="btn btn-primary" onClick={goQuiz}>Go to the readiness quiz <Icon name="arrowRight" size={16} /></button>
        </div>
      ) : (
        <div className="finish-box">
          <span>Done reading? The quiz checks that you are ready for the assignment.</span>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || closedForNow}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await actions.completeLearning();
                await onChange();
                goQuiz();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            I have worked through the module — continue to the quiz
          </button>
        </div>
      )}
      {closedForNow && <p className="small muted">You can complete the module once the lab opens.</p>}
      {error && <Alert kind="error">{error}</Alert>}
    </>
  );
  return <LearnModule lab={lab} markdown={learningContent[lab]} resources={resources[lab]} footer={footer} />;
}

// ------------------------------------------------------------------ Quiz
export function remainingSeconds(expiresAt: string, serverNow: string, clientNowAtFetch: number, clientNow = Date.now()): number {
  const offset = new Date(serverNow).getTime() - clientNowAtFetch;
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - (clientNow + offset)) / 1000));
}

function fmt(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export function QuizTab({ lab, labInfo, actions, onPassed, sched, goWorkshop }: { lab: LabSlug; labInfo: Lab; actions: LabActions; onPassed: () => Promise<void>; sched?: Schedule; goWorkshop?: () => void }) {
  const [status, setStatus] = useState<QuizStatus | null>(null);
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  const [result, setResult] = useState<QuizResult | null>(null);
  const [review, setReview] = useState<{ items: QuizItem[]; answers: Record<number, string[] | null>; answerKey: Record<number, PreviewAnswer> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const st = await actions.quizStatus();
      setFetchedAt(Date.now());
      setStatus(st);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the quiz.');
    }
  }, [actions]);

  useEffect(() => {
    void refresh();
  }, [refresh, lab]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!status) return <Spinner />;

  if (status.state === 'active') {
    return (
      <QuizRunner
        status={status}
        fetchedAt={fetchedAt}
        actions={actions}
        onDone={async (r, answers) => {
          const key = actions.previewAnswers?.();
          if (key) setReview({ items: status.items, answers, answerKey: key });
          setResult(r);
          await refresh();
          if (r.passed) await onPassed();
        }}
      />
    );
  }

  const last = result ?? status.last_result;
  const notOpen = sched?.phase === 'upcoming';
  return (
    <div>
      <div className="spread">
        <h2>Readiness quiz</h2>
        {actions.mode === 'preview' && <Badge tone="info" icon="eye">Simulation — nothing is stored</Badge>}
      </div>
      <div className="quiz-intro">
        <div className="stat"><div className="stat-label">Questions</div><div className="stat-value">{labInfo.quiz_question_count}</div></div>
        <div className="stat"><div className="stat-label">Time limit</div><div className="stat-value">{Math.round(labInfo.quiz_time_limit_seconds / 60)} min</div></div>
        <div className="stat"><div className="stat-label">Pass mark</div><div className="stat-value">{Number(labInfo.quiz_pass_percent)}%</div></div>
      </div>
      <p className="small muted">
        The timer is enforced by the server. You can retry; after two failed attempts in a row there is a 10-minute pause. The quiz only unlocks the
        assignment — it does not count towards your grade.
      </p>
      {last && <ResultPanel result={last} />}
      {review && <QuizReview {...review} />}
      {status.state === 'passed' && (
        <Alert kind="success">
          You passed the readiness quiz. The programming workshop is unlocked.
          {goWorkshop && <> <button type="button" className="link" onClick={goWorkshop}>Open the workshop →</button></>}
        </Alert>
      )}
      {status.state === 'learning_incomplete' && <Alert kind="info">Finish the learning module first (step 1).</Alert>}
      {status.state === 'cooldown' && status.cooldown_until && <Cooldown until={status.cooldown_until} serverNow={status.server_now} fetchedAt={fetchedAt} onOver={refresh} />}
      {status.state === 'ready' && (
        notOpen ? <Alert kind="info">The quiz opens together with the lab.</Alert> : (
          <button
            type="button"
            className="btn btn-primary btn-large"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await actions.quizStart();
                setResult(null);
                setReview(null);
                await refresh();
              } catch (e) {
                setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Could not start the quiz.');
              } finally {
                setBusy(false);
              }
            }}
          >
            {last ? 'Start a new attempt' : 'Start the quiz'}
          </button>
        )
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
  return <Alert kind="warning">Two attempts in a row did not pass. Review the topics above; you can try again in <span className="countdown">{fmt(left)}</span>.</Alert>;
}

function ResultPanel({ result }: { result: QuizResult }) {
  return (
    <div className={result.passed ? 'alert alert-success' : 'alert alert-warning'} role="status">
      <ScoreRing value={result.score_raw} max={result.question_count} decimals={0} size={64} label={`${result.score_raw} of ${result.question_count} correct`} />
      <div className="alert-body">
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
    </div>
  );
}

function QuizRunner({ status, fetchedAt, actions, onDone }: { status: Extract<QuizStatus, { state: 'active' }>; fetchedAt: number; actions: LabActions; onDone: (r: QuizResult, answers: Record<number, string[] | null>) => Promise<void> }) {
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
      const r = await actions.quizSubmit(status.attempt_id, answers);
      await onDone(r, answers);
    } catch (e) {
      submitted.current = false;
      setError(e instanceof Error ? e.message : 'Could not submit.');
    } finally {
      setSubmitting(false);
    }
  }, [answers, onDone, status.attempt_id, actions]);

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
    actions.quizAnswer(status.attempt_id, ordinal, value).then(
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
        <div className="quiz-bar-top">
          <span className="small"><strong>Attempt {status.attempt_number}</strong> · {answered}/{status.items.length} answered</span>
          <span className={left < 60 ? 'timer urgent' : 'timer'} role="timer" aria-label={`Time left ${fmt(left)}`}>
            <Icon name="clock" size={15} /> {fmt(left)}
          </span>
        </div>
        <Bar value={answered} max={status.items.length} tone={answered === status.items.length ? 'good' : undefined} label={`${answered} of ${status.items.length} answered`} />
        <nav className="qnav" aria-label="Questions">
          {status.items.map((it) => (
            <a key={it.ordinal} href={`#q${it.ordinal}`} className={answers[it.ordinal]?.length ? 'answered' : ''} aria-label={`Question ${it.ordinal}${answers[it.ordinal]?.length ? ', answered' : ''}`}
              onClick={(e) => { e.preventDefault(); document.getElementById(`q${it.ordinal}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>
              {it.ordinal}
            </a>
          ))}
        </nav>
      </div>
      {status.items.map((item) => (
        <QuestionView key={item.ordinal} item={item} value={answers[item.ordinal] ?? null} onChange={(v) => setAnswer(item.ordinal, v)} saving={saving[item.ordinal]} />
      ))}
      {error && <Alert kind="error">{error}</Alert>}
      <div className="spread">
        <p className="muted small">Answers are saved as you go; refreshing the page resumes this attempt.</p>
        <button type="submit" className="btn btn-primary btn-large" disabled={submitting || left <= 0}>
          {submitting ? 'Submitting…' : 'Submit answers'}
        </button>
      </div>
    </form>
  );
}

/** Staff simulation: each question with the given answer, the correct options and the explanation. */
function QuizReview({ items, answers, answerKey }: { items: QuizItem[]; answers: Record<number, string[] | null>; answerKey: Record<number, PreviewAnswer> }) {
  return (
    <div>
      <h3>Answer review <Badge tone="info" icon="eye">staff only</Badge></h3>
      {items.map((it) => {
        const k = answerKey[it.ordinal];
        return <QuestionView key={it.ordinal} item={it} value={answers[it.ordinal] ?? null} onChange={() => undefined} review={k} />;
      })}
    </div>
  );
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

export function QuestionView({ item, value, onChange, saving, review }: { item: QuizItem; value: string[] | null; onChange: (v: string[] | null) => void; saving?: string; review?: PreviewAnswer }) {
  const name = `q${item.ordinal}`;
  const order = item.type === 'sequence' ? (value && value.length === item.options.length ? value : item.options.map((o) => o.id)) : null;
  const byId = Object.fromEntries(item.options.map((o) => [o.id, o]));
  const correct = review ? (item.type === 'sequence' ? JSON.stringify(value) === JSON.stringify(review.correct) : !!value && sameSet(value, review.correct)) : null;
  const optClass = (id: string) => (review ? (review.correct.includes(id) ? ' correct' : value?.includes(id) ? ' incorrect' : '') : '');
  return (
    <fieldset className={`question${value?.length ? ' answered' : ''}`} id={review ? `review-${name}` : name} disabled={!!review}>
      <legend>
        <span className="qnum">Question {item.ordinal}</span> <InlineMd text={item.prompt} />
      </legend>
      {item.code && (
        <pre className="code" tabIndex={0} aria-label="Code">
          <code>{item.code}</code>
        </pre>
      )}
      {item.type === 'single' && (
        <div className="options">
          {item.options.map((o) => (
            <label key={o.id} className={`option${optClass(o.id)}`}>
              <input type="radio" name={review ? `r-${name}` : name} value={o.id} checked={value?.[0] === o.id} onChange={() => onChange([o.id])} /> <span><InlineMd text={o.text} /></span>
              {review?.correct.includes(o.id) && <span className="mark"><Icon name="check" size={16} label="correct option" /></span>}
            </label>
          ))}
        </div>
      )}
      {item.type === 'multi' && (
        <>
          <p className="muted small">Select all that apply.</p>
          <div className="options">
            {item.options.map((o) => (
              <label key={o.id} className={`option${optClass(o.id)}`}>
                <input
                  type="checkbox"
                  name={review ? `r-${name}` : name}
                  value={o.id}
                  checked={!!value?.includes(o.id)}
                  onChange={(e) => {
                    const set = new Set(value ?? []);
                    if (e.target.checked) set.add(o.id);
                    else set.delete(o.id);
                    onChange(set.size ? [...set] : null);
                  }}
                />{' '}
                <span><InlineMd text={o.text} /></span>
                {review?.correct.includes(o.id) && <span className="mark"><Icon name="check" size={16} label="correct option" /></span>}
              </label>
            ))}
          </div>
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
                {!review && (
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
                )}
              </li>
            ))}
          </ol>
          {review && <p className="small">Correct order: {review.correct.map((id, i) => `${i + 1}. ${byId[id]?.text ?? id}`).join('  ')}</p>}
          {!value && !review && (
            <button type="button" className="btn btn-small" onClick={() => onChange(order)}>
              Use this order
            </button>
          )}
        </>
      )}
      {saving && (
        <span className="muted small save-state">
          <Icon name={saving === 'saved' ? 'check' : saving === 'saving' ? 'loader' : 'alert'} size={14} />
          {saving === 'saving' ? 'Saving…' : saving === 'saved' ? 'Saved' : 'Not saved — it will be sent with Submit'}
        </span>
      )}
      {review && (
        <div className="explain">
          <Badge tone={correct ? 'good' : 'bad'} icon={correct ? 'check' : 'x'}>{correct ? 'Correct' : value?.length ? 'Incorrect' : 'Not answered'}</Badge>{' '}
          <span className="tiny muted">{review.question_key} · {review.category}</span>
          <p><InlineMd text={review.explanation} /></p>
        </div>
      )}
    </fieldset>
  );
}

// ------------------------------------------------------------------ Workshop
function WorkshopTab({ lab, labInfo, state, actions, reload, goSubmit }: { lab: LabSlug; labInfo: Lab; state: LabState; actions: LabActions; reload: () => Promise<void>; goSubmit: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const status = state.github_access_status;
  useEffect(() => {
    if (!['queued', 'provisioning', 'retryable_error', 'revocation_pending'].includes(status)) return;
    const t = setInterval(() => void reload(), 10_000);
    return () => clearInterval(t);
  }, [status, reload]);
  useEffect(() => {
    if (status === 'invitation_pending') void actions.checkAccess().then(async (r) => { if (r.status === 'ready') await reload(); }, () => undefined);
  }, [status, actions, reload]);

  const rubric = RUBRICS[lab]!;
  const clone = `git clone https://github.com/${state.github_repo_full_name}.git`;
  return (
    <div>
      <h2>Programming workshop</h2>
      {!unlocked(state) && <Alert kind="info">Pass the readiness quiz to unlock your personal assignment repository.</Alert>}
      {['queued', 'provisioning'].includes(status) && (
        <Banner tone="info" icon="loader">Your private repository is being prepared. This usually takes a minute or two — this page updates by itself.</Banner>
      )}
      {status === 'retryable_error' && <Alert kind="warning">{state.github_access_detail ?? 'Repository setup hit a temporary problem and will be retried automatically.'}</Alert>}
      {status === 'failed' && (
        <Alert kind="error">
          Repository setup needs attention from the course staff. You can also{' '}
          <button type="button" className="link" disabled={busy} onClick={async () => {
            setBusy(true);
            try { await actions.requestReconcile(); setMsg('Retry requested.'); await reload(); } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
          }}>try again</button>.
        </Alert>
      )}
      {status === 'revocation_pending' && <Alert kind="warning">Your repository access is being updated by the course staff.</Alert>}
      {status === 'invitation_pending' && (
        <div className="card repo-box">
          <div className="spread"><strong><Icon name="github" /> {state.github_repo_full_name}</strong><Badge tone="info">Invitation sent</Badge></div>
          <p className="small">Your repository is ready. Accept the GitHub invitation to get access, then come back here.</p>
          <div className="row">
            <a className="btn btn-primary" href={state.github_invitation_url ?? '#'} target="_blank" rel="noreferrer"><Icon name="external" size={16} />Open the invitation on GitHub</a>
            <button type="button" className="btn" disabled={busy} onClick={async () => {
              setBusy(true);
              setMsg(null);
              try {
                const r = await actions.checkAccess();
                setMsg(r.status === 'ready' ? 'Access confirmed.' : 'The invitation is not accepted yet.');
                await reload();
              } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
            }}>I have accepted it</button>
          </div>
        </div>
      )}
      {status === 'ready' && (
        <div className="card repo-box">
          <div className="spread">
            <a href={state.github_repo_url ?? '#'} target="_blank" rel="noreferrer"><strong><Icon name="github" /> {state.github_repo_full_name}</strong></a>
            <Badge tone="good" icon="check">Ready</Badge>
          </div>
          <div className="copy-row">
            <pre className="code"><code>{clone}</code></pre>
            <CopyButton text={clone} />
          </div>
          <p className="small">The repository README contains the tasks, the contract and the exact rubric. Commit and push to the default branch, then submit.</p>
          <div><button type="button" className="btn btn-primary" onClick={goSubmit}>Go to submission <Icon name="arrowRight" size={16} /></button></div>
        </div>
      )}
      {msg && <p role="status">{msg}</p>}
      {unlocked(state) && (
        <>
          <h3>Your variant {state.variant_public_id}</h3>
          <ul className="variant-list">
            {describeVariant(lab, state.variant_payload.params).map((l) => (
              <li key={l}><Icon name="sparkle" size={16} /><span>{l}</span></li>
            ))}
          </ul>
        </>
      )}
      <h3>How the assignment is graded ({maxPts(labInfo)} points)</h3>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th scope="col">Category</th><th scope="col">Points</th><th scope="col">What is checked</th></tr>
          </thead>
          <tbody>
            {rubric.rows.map((r) => (
              <tr key={r.category}><td><strong>{r.category}</strong></td><td>{((Number(r.points) * Number(labInfo.max_points ?? 3)) / 3).toFixed(2)}</td><td className="small">{r.checks}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">
        Your own tests must pass on a correct solution and detect: {rubric.studentTest.join('; ')}. Architecture and hygiene points count once at
        least 4 of 8 functional checks pass.
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ Submit
function SubmitTab({ labInfo, state, actions, reload, sched }: { labInfo: Lab; state: LabState; actions: LabActions; reload: () => Promise<void>; sched: Schedule }) {
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [subs, setSubs] = useState<Submission[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const loadSubs = useCallback(async () => setSubs(await actions.submissions(labInfo.id)), [labInfo.id, actions]);
  useEffect(() => {
    void loadSubs();
  }, [loadSubs]);
  useEffect(() => {
    if (!subs?.some((s) => s.status === 'queued' || s.status === 'running')) return;
    const t = setInterval(() => {
      void loadSubs();
      void reload();
    }, actions.mode === 'preview' ? 2_000 : 15_000);
    return () => clearInterval(t);
  }, [subs, loadSubs, reload, actions.mode]);

  if (state.github_access_status !== 'ready') return <Alert kind="info">Submitting becomes available once your repository is ready (step 3).</Alert>;
  const details = state.latest_grade_details;
  const closed = sched.phase === 'closed';
  const late = sched.phase === 'late';
  return (
    <div>
      <h2>Official grade</h2>
      {state.latest_grade_units !== null ? (
        <div className="card">
          <div className="grade-hero">
            <ScoreRing value={state.latest_grade_units === null ? null : toPoints(state.latest_grade_units, labInfo)} max={Number(labInfo.max_points ?? 3)} size={112} />
            <div className="grade-meta">
              <p className="small">
                Graded commit <code>{shortSha(state.official_sha)}</code>
                {state.latest_submitted_sha && state.latest_submitted_sha !== state.official_sha && ' — your best result so far; newer submissions count only if they score higher.'}
              </p>
              {details?.late && (
                <Badge tone="warn" icon="clock">Late: capped at {pts(details.late_cap_units ?? sched.lateCapUnits, labInfo)} (raw {pts(details.raw_units ?? null, labInfo)})</Badge>
              )}
            </div>
          </div>
          {details?.staff_review && <Alert kind="warning">Some checks of this result need a staff review. The course staff will contact you if anything changes.</Alert>}
          {details?.categories && <CategoryTable categories={details.categories} lab={labInfo} />}
        </div>
      ) : (
        <EmptyState icon="upload">No official grade yet — submit your solution below.</EmptyState>
      )}
      <h2>Submit for grading</h2>
      {late && <Alert kind="warning">The deadline has passed: this submission counts at most <strong>{pts(sched.lateCapUnits, labInfo)} / {maxPts(labInfo)}</strong>. Your best result counts.</Alert>}
      {closed ? (
        <Alert kind="error">This lab is closed — new submissions are not accepted.</Alert>
      ) : (
        <>
          <p className="small muted">
            The grader tests the exact commit you confirm here, with hidden tests and your stored variant. Up to {labInfo.daily_submission_limit} requests per
            day (Europe/Ljubljana). Run <code>flutter analyze</code> and <code>flutter test</code> locally first.
          </p>
          {!resolved ? (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={async () => {
              setBusy(true);
              setError(null);
              try { setResolved(await actions.resolveSubmission()); } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
            }}>
              <Icon name="refresh" size={16} />Show my current version
            </button>
          ) : (
            <div className="card">
              <dl className="kv">
                <dt>Repository</dt><dd><strong>{resolved.repo_full_name}</strong></dd>
                <dt>Branch</dt><dd><code>{resolved.branch}</code></dd>
                <dt>Commit</dt><dd><code className="sha">{resolved.commit_sha}</code></dd>
                <dt>Requests today</dt><dd>{resolved.quota_used}/{resolved.quota_limit}</dd>
              </dl>
              <div className="row">
                <button type="button" className="btn btn-primary" disabled={busy} onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    const r = await actions.submit(resolved.commit_sha);
                    setNotice(r.duplicate ? 'This commit was already submitted; no new request was used.' : r.held ? 'Submitted. Grading is paused by the course staff; your request stays in the queue.' : 'Submitted. Grading usually takes a few minutes.');
                    setResolved(null);
                    await loadSubs();
                    await reload();
                  } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
                }}>
                  <Icon name="upload" size={16} />Submit current version for grading
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setResolved(null)}>Cancel</button>
              </div>
            </div>
          )}
        </>
      )}
      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}
      <h3>Your submissions</h3>
      {!subs ? (
        <Spinner />
      ) : subs.length === 0 ? (
        <EmptyState>None yet.</EmptyState>
      ) : (
        <ol className="timeline">
          {subs.map((s) => {
            const tone = s.status === 'graded' ? 'good' : s.status === 'error' ? 'bad' : 'info';
            const counted = s.effective_units ?? s.grade_units;
            return (
              <li key={s.id}>
                <span className={`tl-icon ${tone}`}><Icon name={s.status === 'graded' ? 'check' : s.status === 'error' ? 'alert' : 'loader'} size={17} /></span>
                <div>
                  <div><code>{shortSha(s.commit_sha)}</code> · <span className="small muted">{fmtDateTime(s.requested_at)}</span></div>
                  <div className="row">
                    <Badge tone={tone}>{s.status === 'graded' ? 'Graded' : s.status === 'error' ? 'Error' : s.status === 'running' ? 'Grading' : 'Queued'}</Badge>
                    {s.late && <Badge tone="warn" icon="clock">Late</Badge>}
                    {s.commit_sha === state.official_sha && s.status === 'graded' && <Badge tone="good" icon="sparkle">Counts</Badge>}
                  </div>
                  {s.status_detail && <div className="small muted">{s.status_detail}</div>}
                </div>
                <div className="tl-points">
                  {pts(counted, labInfo)}
                  {s.late && s.grade_units !== null && s.effective_units !== null && s.grade_units !== s.effective_units && <div className="tiny muted">raw {pts(s.grade_units, labInfo)}</div>}
                </div>
              </li>
            );
          })}
        </ol>
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

export function CategoryTable({ categories, lab }: { categories: { key: string; earned: number; max: number; summary: string }[]; lab?: Lab }) {
  return (
    <div className="cat-list" role="list" aria-label="Points per category">
      {categories.map((c) => (
        <div key={c.key} className="cat" role="listitem">
          <span className="cat-name">{CATEGORY_LABELS[c.key] ?? c.key}</span>
          <span className="cat-points">{pts(c.earned, lab)} / {pts(c.max, lab)}</span>
          <Bar value={c.earned} max={c.max} tone={c.earned === c.max ? 'good' : undefined} />
          {c.summary && <span className="cat-summary">{c.summary}</span>}
        </div>
      ))}
    </div>
  );
}
