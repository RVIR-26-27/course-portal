import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../src/lib/supabase', () => ({ configured: true, supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
const { apiMock, readsMock } = vi.hoisted(() => ({
  apiMock: {
    claim: vi.fn(),
    quizStatus: vi.fn(),
    quizStart: vi.fn(),
    quizAnswer: vi.fn(async () => ({ ok: true })),
    quizSubmit: vi.fn(),
    admin: vi.fn(),
  },
  readsMock: { labs: vi.fn(), myStates: vi.fn(), mySubmissions: vi.fn(async () => []) },
}));
vi.mock('../src/lib/api', async (orig) => {
  const actual = await orig<typeof import('../src/lib/api')>();
  return { ...actual, api: apiMock, reads: readsMock };
});

import { RequireStudent } from '../src/App';
import { Dashboard } from '../src/pages/Dashboard';
import { LabView, QuizTab, QuestionView, remainingSeconds } from '../src/pages/LabPage';
import { liveActions } from '../src/lib/labActions';
import { fromLocalInput, scheduleOf, toLocalInput } from '../src/lib/schedule';
import { PreviewEngine } from '../src/pages/admin/preview';
import { MemoryRouter } from 'react-router';
import type { LabState } from '../src/lib/types';
import { AdminLayout } from '../src/pages/admin/AdminLayout';
import { ApiError } from '../src/lib/api';
import { fakeSession, withAuth } from './helpers';

const LAB = { id: 'lab-1', slug: 'lab01' as const, title: 'Lab 1 — UI, State & Navigation', sort_order: 1, enabled: true, quiz_pass_percent: 75, quiz_time_limit_seconds: 720, quiz_question_count: 8, daily_submission_limit: 5, max_units: 300, max_points: 3, opens_at: null as string | null, deadline_at: null as string | null, closes_at: null as string | null, late_cap_percent: 50 };
const student = { id: 's1', status: 'active', first_name: 'Ana', last_name: 'Test', github_login: 'ana-gh', identity_ok: true };

beforeEach(() => vi.clearAllMocks());

describe('access states', () => {
  it('shows only the GitHub sign-in when unauthenticated', () => {
    render(withAuth(<RequireStudent><p>secret dashboard</p></RequireStudent>, { session: null }));
    expect(screen.getByRole('button', { name: 'Sign in with GitHub' })).toBeInTheDocument();
    expect(screen.queryByText('secret dashboard')).not.toBeInTheDocument();
  });

  it('asks an unlinked user to claim their record and shows safe errors', async () => {
    apiMock.claim.mockRejectedValueOnce(new ApiError(400, 'invalid_credentials', 'The student number or activation code is not valid.'));
    render(withAuth(<RequireStudent><p>secret dashboard</p></RequireStudent>, { session: fakeSession, context: { github_id: '1', github_login: 'ana-gh', admin_role: null, student: null } }));
    expect(screen.getByRole('heading', { name: 'Link your student record' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Student number'), 'X9990001');
    await userEvent.type(screen.getByLabelText('Activation code'), 'AAAA-BBBB-CCCC-DDDD');
    await userEvent.click(screen.getByRole('button', { name: 'Link my record' }));
    expect(apiMock.claim).toHaveBeenCalledWith('X9990001', 'AAAA-BBBB-CCCC-DDDD');
    expect(await screen.findByRole('alert')).toHaveTextContent('not valid');
  });

  it('shows linked students their content', () => {
    render(withAuth(<RequireStudent><p>secret dashboard</p></RequireStudent>, { session: fakeSession, context: { github_id: '1', github_login: 'ana-gh', admin_role: null, student } }));
    expect(screen.getByText('secret dashboard')).toBeInTheDocument();
  });

  it('blocks a mismatched identity', () => {
    render(withAuth(<RequireStudent><p>secret dashboard</p></RequireStudent>, { session: fakeSession, context: { github_id: '1', github_login: 'x', admin_role: null, student: { ...student, identity_ok: false } } }));
    expect(screen.getByRole('alert')).toHaveTextContent('does not match');
  });

  it('guards the admin area in the UI (the server re-checks every call)', () => {
    render(withAuth(<AdminLayout />, { session: fakeSession, context: { github_id: '1', github_login: 'ana', admin_role: null, student } }));
    expect(screen.getByRole('alert')).toHaveTextContent('You do not have access');
  });
});

describe('dashboard', () => {
  it('shows locked and passed lab states', async () => {
    readsMock.labs.mockResolvedValue([LAB, { ...LAB, id: 'lab-2', slug: 'lab02', title: 'Lab 2 — Local Persistence', sort_order: 2 }]);
    readsMock.myStates.mockResolvedValue([
      { id: 'st1', lab_id: 'lab-1', learning_completed_at: 'x', quiz_passed_at: 'x', github_access_status: 'ready', latest_grade_units: 262 },
      { id: 'st2', lab_id: 'lab-2', learning_completed_at: null, quiz_passed_at: null, github_access_status: 'locked', latest_grade_units: null },
    ]);
    render(withAuth(<Dashboard />, { session: fakeSession, context: { github_id: '1', github_login: 'ana-gh', admin_role: null, student } }));
    const lab1 = await screen.findByRole('article', { name: /Lab 1/ });
    expect(lab1).toHaveTextContent('Passed');
    expect(lab1).toHaveTextContent('Open repository');
    expect(lab1).toHaveTextContent('2.62 / 3.00');
    const lab2 = screen.getByRole('article', { name: /Lab 2/ });
    expect(lab2).toHaveTextContent('Locked');
  });
});

describe('quiz', () => {
  it('computes remaining time from the server clock, not the client clock', () => {
    const fetchedAt = Date.parse('2026-10-01T10:00:00Z');
    // client clock is 2 minutes ahead of the server
    expect(remainingSeconds('2026-10-01T09:58:12Z', '2026-09-30T09:58:00Z'.replace('09-30', '10-01'), fetchedAt, fetchedAt)).toBe(12);
    expect(remainingSeconds('2026-10-01T09:58:12Z', '2026-10-01T09:58:00Z', fetchedAt, fetchedAt + 20_000)).toBe(0);
  });

  it('shows the cooldown and last result with remediation topics', async () => {
    apiMock.quizStatus.mockResolvedValue({
      state: 'cooldown', cooldown_until: new Date(Date.now() + 5 * 60_000).toISOString(), server_now: new Date().toISOString(),
      last_result: { attempt_id: 'a', status: 'submitted', score_raw: 4, question_count: 8, score_percent: 50, passed: false, pass_percent: 75, remediation_topics: ['form-validation'], finalized_at: '' },
    });
    render(withAuth(<QuizTab lab="lab01" labInfo={LAB} actions={liveActions('lab01')} onPassed={async () => undefined} />, { session: fakeSession }));
    expect(await screen.findByText(/you can try again in/)).toBeInTheDocument();
    expect(screen.getByText('Form validation')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start/ })).not.toBeInTheDocument();
  });

  it('runs an active attempt with a timer and autosaves answers', async () => {
    const now = new Date();
    apiMock.quizStatus.mockResolvedValue({
      state: 'active', attempt_id: 'att-1', attempt_number: 1, started_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 720_000).toISOString(), server_now: now.toISOString(),
      items: [{ ordinal: 1, type: 'single', prompt: 'What does `setState` do?', code: null, codeLanguage: null, options: [{ id: 'o1', text: 'Rebuilds' }, { id: 'o2', text: 'Saves' }], answer: null }],
    });
    render(withAuth(<QuizTab lab="lab01" labInfo={LAB} actions={liveActions('lab01')} onPassed={async () => undefined} />, { session: fakeSession }));
    const timer = await screen.findByRole('timer');
    expect(timer).toHaveTextContent(/1[12]:\d\d/);
    await userEvent.click(screen.getByRole('radio', { name: 'Rebuilds' }));
    await waitFor(() => expect(apiMock.quizAnswer).toHaveBeenCalledWith('att-1', 1, ['o1']));
  });

  it('renders multi-select and keyboard-operable ordering questions', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<QuestionView item={{ ordinal: 2, type: 'multi', prompt: 'Pick', code: 'x', codeLanguage: 'dart', options: [{ id: 'o1', text: 'A' }, { id: 'o2', text: 'B' }], answer: null }} value={['o2']} onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'A' }));
    expect(onChange).toHaveBeenCalledWith(['o2', 'o1']);
    rerender(<QuestionView item={{ ordinal: 3, type: 'sequence', prompt: 'Order', code: null, codeLanguage: null, options: [{ id: 'o1', text: 'first' }, { id: 'o2', text: 'second' }], answer: null }} value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Move down: first' }));
    expect(onChange).toHaveBeenLastCalledWith(['o2', 'o1']);
  });
});

const STATE: LabState = {
  id: 'st1', lab_id: 'lab-1', variant_public_id: 'V1-ABCDEF', variant_payload: { params: { extraField: 'office' }, publicId: 'V1-ABCDEF' },
  learning_completed_at: 'x', quiz_passed_at: 'x', github_access_status: 'ready', github_access_detail: null,
  github_repo_full_name: 'org/flutter-lab-01-1', github_repo_url: 'https://github.com/org/flutter-lab-01-1', github_invitation_url: null,
  latest_submitted_sha: null, official_sha: null, latest_grade_units: null, latest_grade_details: null, graded_at: null, manual_override: null,
  deadline_extension_at: null,
};
const H = 3600_000;
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();

describe('lab schedule', () => {
  it('derives the phase, the late cap and personal extensions', () => {
    expect(scheduleOf({ ...LAB }).phase).toBe('unscheduled');
    expect(scheduleOf({ ...LAB, opens_at: iso(H) }).phase).toBe('upcoming');
    expect(scheduleOf({ ...LAB, opens_at: iso(-H), deadline_at: iso(H) }).phase).toBe('open');
    const late = scheduleOf({ ...LAB, deadline_at: iso(-H), closes_at: iso(H) });
    expect(late.phase).toBe('late');
    expect(late.lateCapUnits).toBe(150);
    expect(scheduleOf({ ...LAB, deadline_at: iso(-2 * H), closes_at: iso(-H) }).phase).toBe('closed');
    const ext = scheduleOf({ ...LAB, deadline_at: iso(-H), closes_at: iso(-0.5 * H) }, { deadline_extension_at: iso(2 * H) });
    expect(ext).toMatchObject({ phase: 'open', extended: true });
  });

  it('converts Europe/Ljubljana wall time correctly across the DST switch', () => {
    expect(fromLocalInput('2026-10-24T23:59')).toBe('2026-10-24T21:59:00.000Z'); // CEST, UTC+2
    expect(fromLocalInput('2026-10-26T23:59')).toBe('2026-10-26T22:59:00.000Z'); // CET, UTC+1
    expect(toLocalInput('2026-10-26T22:59:00.000Z')).toBe('2026-10-26T23:59');
    expect(toLocalInput(fromLocalInput('2027-01-15T12:00'))).toBe('2027-01-15T12:00');
    expect(fromLocalInput('')).toBeNull();
  });

  it('tells students when a submission is late and refuses submissions after closing', async () => {
    const view = (lab: typeof LAB) => render(<MemoryRouter><LabView lab={lab} state={STATE} actions={liveActions('lab01')} reload={async () => undefined} /></MemoryRouter>);
    const { unmount } = view({ ...LAB, deadline_at: iso(-H), closes_at: iso(24 * H) });
    expect((await screen.findAllByText(/at most/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1\.50/).length).toBeGreaterThan(0);
    unmount();
    view({ ...LAB, deadline_at: iso(-2 * H), closes_at: iso(-H) });
    expect(await screen.findByText(/This lab is closed/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show my current version/ })).not.toBeInTheDocument();
  });
});

describe('admin student view (simulation)', () => {
  it('runs a quiz drawn by the server and scores it locally without storing anything', async () => {
    apiMock.admin.mockResolvedValue({ items: [
      { ordinal: 1, type: 'single', prompt: 'p1', code: null, codeLanguage: null, options: [{ id: 'o1', text: 'a' }, { id: 'o2', text: 'b' }], answer: null, correct: ['o2'], explanation: 'because', category: 'foundation', question_key: 'L1-F01', topics: ['state'] },
      { ordinal: 2, type: 'multi', prompt: 'p2', code: null, codeLanguage: null, options: [{ id: 'o1', text: 'a' }, { id: 'o2', text: 'b' }], answer: null, correct: ['o1', 'o2'], explanation: 'both', category: 'testing', question_key: 'L1-T01', topics: ['tests'] },
    ] });
    let changes = 0;
    const engine = new PreviewEngine({ ...LAB }, 'learning_done', { params: { extraField: 'office' }, publicId: 'V1-ABCDEF' }, () => { changes++; });
    const a = engine.actions();
    expect((await a.quizStatus()).state).toBe('ready');
    await a.quizStart();
    expect(apiMock.admin).toHaveBeenCalledWith('quiz-preview', { lab: 'lab01' });
    const st = await a.quizStatus();
    expect(st.state).toBe('active');
    expect(JSON.stringify(st)).not.toContain('because'); // the simulated attempt looks exactly like a student's
    const r = await a.quizSubmit('x', { 1: ['o2'], 2: ['o2'] });
    expect(r).toMatchObject({ score_raw: 1, question_count: 2, passed: false });
    expect(a.previewAnswers!()![2]).toMatchObject({ correct: ['o1', 'o2'], explanation: 'both' });
    expect(changes).toBeGreaterThan(0);
    expect(apiMock.admin).toHaveBeenCalledTimes(1);
    engine.dispose();
  });

  it('caps a simulated late submission like the server', async () => {
    const engine = new PreviewEngine({ ...LAB }, 'graded_late', { params: {}, publicId: 'V1-ABCDEF' }, () => undefined);
    expect(engine.state.latest_grade_units).toBe(150);
    expect(engine.state.latest_grade_details).toMatchObject({ late: true, raw_units: 280, late_cap_units: 150 });
    engine.dispose();
  });
});

describe('maximum points', () => {
  it('scales grades to the lab maximum on the dashboard', async () => {
    readsMock.labs.mockResolvedValue([{ ...LAB, max_points: 5 }]);
    readsMock.myStates.mockResolvedValue([{ ...STATE, latest_grade_units: 240 }]);
    render(withAuth(<Dashboard />, { session: fakeSession, context: { github_id: '1', github_login: 'ana-gh', admin_role: null, student } }));
    const card = await screen.findByRole('article', { name: /Lab 1/ });
    expect(card).toHaveTextContent('4.00 / 5.00');
    expect(screen.getByRole('img', { name: '4.00 of 5.00' })).toBeInTheDocument();
  });
});


describe('interactive learning module', () => {
  it('every practice question in the content parses (author check)', async () => {
    const { learningContent } = await import('../src/content');
    for (const [lab, md] of Object.entries(learningContent)) {
      const blocks = [...md.matchAll(/```check\n([\s\S]*?)```/g)].map((m) => m[1]!);
      expect(blocks.length, lab).toBeGreaterThan(1);
      for (const b of blocks) {
        expect(b, `${lab}: question line`).toMatch(/^\? /m);
        expect((b.match(/^- \[x\] /gm) ?? []).length, `${lab}: a correct option`).toBeGreaterThan(0);
        expect((b.match(/^- \[[ x]\] /gm) ?? []).length, `${lab}: options`).toBeGreaterThan(1);
      }
    }
  });

  it('checks a practice answer, reveals a prediction and tracks section progress', async () => {
    const { LearnModule } = await import('../src/components/learn');
    const md = ['## 1. First', 'Intro text.', '```check', '? Which is right?', '- [ ] wrong', '- [x] right', '> because', '```', '## 2. Second', '```reveal', 'Predict it', '---', 'The answer', '```'].join('\n');
    render(<LearnModule lab="t1" markdown={md} resources={[]} footer={null} />);
    expect(screen.getByText('Section progress: 0 of 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'wrong' }));
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByRole('status')).toHaveTextContent('Not quite');
    await userEvent.click(screen.getByRole('radio', { name: 'right' }));
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText('because')).toBeInTheDocument();
    expect(screen.queryByText('The answer')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /reveal/ }));
    expect(screen.getByText('The answer')).toBeInTheDocument();
    for (const b of screen.getAllByRole('button', { name: /Mark as understood/ })) await userEvent.click(b);
    expect(screen.getByText('All sections done')).toBeInTheDocument();
  });
});
