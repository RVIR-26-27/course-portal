import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Alert, Badge, InlineMd, ReasonAction, Spinner } from '../../components/ui';
import { LAB_SLUGS } from './AdminLayout';

interface Q {
  key: string;
  version: number;
  category: string;
  difficulty: number;
  type: string;
  topics: string[];
  active: boolean;
  template: { prompt: string; code?: string; options: { id: string; text: string }[]; params?: Record<string, unknown>[] };
  answer: string | string[] | null;
  explanation: string | null;
  times_used: number;
  times_correct: number;
}

export function QuizBank() {
  const [lab, setLab] = useState<string>('lab01');
  const [qs, setQs] = useState<Q[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => api.admin<Q[]>('question-bank', { lab }).then(setQs, (e) => setError(e.message));
  useEffect(() => {
    setQs(null);
    void load();
  }, [lab]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <h2>Quiz bank</h2>
      <label className="inline">
        Lab{' '}
        <select value={lab} onChange={(e) => setLab(e.target.value)}>
          {LAB_SLUGS.map((l) => <option key={l}>{l}</option>)}
        </select>
      </label>
      <p className="small muted">
        Questions are authored in the private <code>quiz-bank/*.yaml</code> files (docs/QUIZ_AUTHORING.md). Disabling a question never changes
        existing attempt snapshots.
      </p>
      {error && <Alert kind="error">{error}</Alert>}
      {!qs ? <Spinner /> : qs.map((q) => (
        <details key={`${q.key}-${q.version}`} className="card">
          <summary>
            <code>{q.key}</code> v{q.version} · {q.category} · {q.type} · d{q.difficulty} {q.active ? <Badge tone="good">active</Badge> : <Badge tone="warn">disabled</Badge>} ·
            used {q.times_used}× · {q.times_used ? Math.round((q.times_correct / q.times_used) * 100) : 0}% correct
          </summary>
          <p><InlineMd text={q.template.prompt} /></p>
          {q.template.code && <pre className="code"><code>{q.template.code}</code></pre>}
          <ul>
            {q.template.options.map((o) => {
              const ok = q.answer !== null && (Array.isArray(q.answer) ? q.answer.includes(o.id) : q.answer === o.id);
              return <li key={o.id}>{ok ? '✅ ' : ''}<code>{o.id}</code> <InlineMd text={o.text} /></li>;
            })}
          </ul>
          {Array.isArray(q.answer) && q.type === 'sequence' && <p className="small">Order: {q.answer.join(' → ')}</p>}
          {q.template.params && <p className="small muted">{q.template.params.length} reviewed parameter sets</p>}
          {q.explanation && <p className="small"><strong>Why:</strong> {q.explanation}</p>}
          <ReasonAction label={q.active ? 'Disable question' : 'Enable question'} danger={q.active} onConfirm={async (reason) => {
            await api.admin('set-question-active', { question_key: q.key, version: q.version, active: !q.active, reason });
            await load();
          }} />
        </details>
      ))}
    </div>
  );
}
