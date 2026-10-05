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
import { QuizTab, QuestionView, remainingSeconds } from '../src/pages/LabPage';
import { AdminLayout } from '../src/pages/admin/AdminLayout';
import { ApiError } from '../src/lib/api';
import { fakeSession, withAuth } from './helpers';

const LAB = { id: 'lab-1', slug: 'lab01' as const, title: 'Lab 1 — UI, State & Navigation', sort_order: 1, enabled: true, quiz_pass_percent: 75, quiz_time_limit_seconds: 720, quiz_question_count: 8, daily_submission_limit: 5 };
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
    render(withAuth(<QuizTab lab="lab01" labInfo={LAB} onPassed={async () => undefined} />, { session: fakeSession }));
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
    render(withAuth(<QuizTab lab="lab01" labInfo={LAB} onPassed={async () => undefined} />, { session: fakeSession }));
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
