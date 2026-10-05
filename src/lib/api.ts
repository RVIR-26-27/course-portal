import { supabase } from './supabase';
import type { Context, Lab, LabSlug, LabState, QuizResult, QuizStatus, Student, Submission } from './types';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

/** Calls an Edge Function with the user's session; maps safe server errors. */
export async function call<T>(fn: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  const { data, error, response } = await supabase.functions.invoke(fn, {
    body,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (error) {
    let payload: Record<string, unknown> = {};
    try {
      payload = (await (response ?? (error as { context?: Response }).context)?.json()) ?? {};
    } catch {
      /* ignore */
    }
    throw new ApiError(response?.status ?? 0, String(payload.error ?? 'network'), String(payload.message ?? 'The server could not be reached. Try again.'), payload);
  }
  return data as T;
}

export const api = {
  me: () => call<Context>('me'),
  claim: (student_number: string, activation_code: string) => call<{ ok: boolean }>('claim-student-identity', { student_number, activation_code }),
  completeLearning: (lab: LabSlug) => call('lab-action', { lab, action: 'complete-learning' }),
  checkAccess: (lab: LabSlug) => call<{ status: string }>('lab-action', { lab, action: 'check-access' }),
  requestReconcile: (lab: LabSlug) => call('lab-action', { lab, action: 'request-reconcile' }),
  quizStart: (lab: LabSlug) => call<{ attempt_id: string; resumed: boolean }>('quiz-start', { lab }),
  quizStatus: (lab: LabSlug) => call<QuizStatus>('quiz-status', { lab }),
  quizAnswer: (attempt_id: string, ordinal: number, answer: string[] | null) => call('quiz-answer', { attempt_id, ordinal, answer }),
  quizSubmit: (attempt_id: string, answers: Record<number, string[] | null>) => call<QuizResult & { duplicate: boolean }>('quiz-submit', { attempt_id, answers }),
  resolveSubmission: (lab: LabSlug) => call<{ repo_full_name: string; branch: string; commit_sha: string; quota_used: number; quota_limit: number }>('submission', { lab, action: 'resolve' }),
  submit: (lab: LabSlug, commit_sha: string) => call<{ submission_id: string; duplicate: boolean; held?: boolean }>('submission', { lab, action: 'submit', commit_sha }),
  admin: <T = unknown>(action: string, params: Record<string, unknown> = {}) => call<T>('admin', { action, ...params }),
};

/** Direct reads — RLS limits them to the caller's own rows. */
export const reads = {
  labs: async (): Promise<Lab[]> => {
    const { data, error } = await supabase.from('labs').select('id, slug, title, sort_order, enabled, quiz_pass_percent, quiz_time_limit_seconds, quiz_question_count, daily_submission_limit, max_units, opens_at, deadline_at, closes_at, late_cap_percent').order('sort_order');
    if (error) throw error;
    return data as Lab[];
  },
  myStudent: async (): Promise<Student | null> => {
    const { data, error } = await supabase.from('students').select('id, student_number, first_name, last_name, github_login, status').maybeSingle();
    if (error) throw error;
    return data as Student | null;
  },
  myStates: async (): Promise<LabState[]> => {
    const { data, error } = await supabase.from('student_lab_state').select('*');
    if (error) throw error;
    return data as LabState[];
  },
  mySubmissions: async (labId: string): Promise<Submission[]> => {
    const { data, error } = await supabase.from('submission_requests').select('id, seq, lab_id, commit_sha, status, status_detail, requested_at, completed_at, grade_units, effective_units, late, details').eq('lab_id', labId).order('seq', { ascending: false }).limit(20);
    if (error) throw error;
    return data as Submission[];
  },
};

export const points = (units: number | null | undefined) => (units === null || units === undefined ? '—' : (units / 100).toFixed(2));
