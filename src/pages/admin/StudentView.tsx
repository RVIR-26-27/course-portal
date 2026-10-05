import { useEffect, useMemo, useState } from 'react';
import { reads } from '../../lib/api';
import type { Lab, LabSlug } from '../../lib/types';
import { describeVariant } from '../../lib/variantText';
import { Alert, Badge, Icon, Spinner } from '../../components/ui';
import { DashboardView } from '../Dashboard';
import { LabView } from '../LabPage';
import { PreviewEngine, SCENARIOS, randomVariant, type ScenarioId } from './preview';

/** Staff preview of the student portal with simulated progress. Nothing is stored anywhere. */
export function StudentView() {
  const [labs, setLabs] = useState<Lab[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState<LabSlug>('lab01');
  const [scenario, setScenario] = useState<ScenarioId>('new');
  const [view, setView] = useState<'lab' | 'dashboard'>('lab');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [variant, setVariant] = useState(() => randomVariant('lab01'));
  const [, setVersion] = useState(0);

  useEffect(() => {
    reads.labs().then(setLabs, () => setError('Could not load the labs.'));
  }, []);
  useEffect(() => setVariant(randomVariant(slug)), [slug]);

  const base = labs?.find((l) => l.slug === slug) ?? null;
  const engine = useMemo(() => (base ? new PreviewEngine(base, scenario, variant, () => setVersion((v) => v + 1)) : null), [base, scenario, variant]);
  useEffect(() => () => engine?.dispose(), [engine]);
  const actions = useMemo(() => engine?.actions() ?? null, [engine]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!labs || !engine || !actions) return <Spinner />;
  return (
    <div className="page">
      <div className="spread">
        <div>
          <h2>Student view</h2>
          <p className="small muted">Exactly the screens students see, with simulated progress. The quiz is a real draw from the question bank (with the answer key for you); nothing is stored, no repository is created and no grading runs.</p>
        </div>
      </div>
      <div className="preview-bar">
        <label>Lab
          <select value={slug} onChange={(e) => setSlug(e.target.value as LabSlug)}>
            {labs.map((l) => <option key={l.slug} value={l.slug}>{l.title}</option>)}
          </select>
        </label>
        <label>Situation
          <select value={scenario} onChange={(e) => setScenario(e.target.value as ScenarioId)}>
            {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <div className="seg" role="group" aria-label="Screen">
          <button type="button" className={view === 'lab' ? 'on' : ''} aria-pressed={view === 'lab'} onClick={() => setView('lab')}>Lab page</button>
          <button type="button" className={view === 'dashboard' ? 'on' : ''} aria-pressed={view === 'dashboard'} onClick={() => setView('dashboard')}>Dashboard</button>
        </div>
        <div className="seg" role="group" aria-label="Device width">
          <button type="button" className={device === 'desktop' ? 'on' : ''} aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}><Icon name="monitor" size={15} /> Desktop</button>
          <button type="button" className={device === 'mobile' ? 'on' : ''} aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}><Icon name="smartphone" size={15} /> Phone</button>
        </div>
        <button type="button" className="btn" onClick={() => setVariant(randomVariant(slug))}><Icon name="refresh" size={15} /> Shuffle variant</button>
      </div>
      <p className="small muted">
        Variant {variant.publicId}: {describeVariant(slug, variant.params).join(' ')}
      </p>
      <div className={`device ${device}`}>
        <div className="device-chrome">
          <span className="lights" aria-hidden><i /><i /><i /></span>
          <span className="grow">rvir-26-27.github.io/course-portal/#/{view === 'lab' ? `labs/${slug}` : ''}</span>
          <Badge tone="info" icon="eye">Preview</Badge>
        </div>
        <div className="device-body">
          {view === 'lab' ? (
            <LabView key={engine.state.id} lab={engine.lab} state={engine.state} actions={actions} reload={async () => undefined} backTo={null} />
          ) : (
            <DashboardView
              labs={labs.map((l) => (l.slug === slug ? engine.lab : { ...l, enabled: true }))}
              states={[engine.state]}
              student={{ first_name: 'Ana', last_name: 'Novak', github_login: 'ana-novak', status: 'active' }}
              linkFor={() => null}
            />
          )}
        </div>
      </div>
    </div>
  );
}
