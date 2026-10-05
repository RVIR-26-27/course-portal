// Everything the lab screens can do, behind one interface. The student portal
// uses the real server calls (liveActions); the admin "student view" uses a
// local simulation (pages/admin/preview.ts) so staff see exactly the screens
// students see, without touching any student data.
import { api, reads } from './api';
import type { LabSlug, QuizResult, QuizStatus, Submission } from './types';

export interface Resolved {
  repo_full_name: string;
  branch: string;
  commit_sha: string;
  quota_used: number;
  quota_limit: number;
}

/** Staff-only extras of a simulated quiz item: correct options and explanation. */
export interface PreviewAnswer {
  correct: string[];
  explanation: string;
  category: string;
  question_key: string;
}

export interface LabActions {
  mode: 'live' | 'preview';
  completeLearning(): Promise<void>;
  quizStatus(): Promise<QuizStatus>;
  quizStart(): Promise<void>;
  quizAnswer(attemptId: string, ordinal: number, answer: string[] | null): Promise<void>;
  quizSubmit(attemptId: string, answers: Record<number, string[] | null>): Promise<QuizResult>;
  checkAccess(): Promise<{ status: string }>;
  requestReconcile(): Promise<void>;
  resolveSubmission(): Promise<Resolved>;
  submit(commitSha: string): Promise<{ duplicate: boolean; held?: boolean }>;
  submissions(labId: string): Promise<Submission[]>;
  /** preview only: answer key per ordinal of the current simulated attempt */
  previewAnswers?: () => Record<number, PreviewAnswer> | null;
}

export function liveActions(lab: LabSlug): LabActions {
  return {
    mode: 'live',
    completeLearning: async () => { await api.completeLearning(lab); },
    quizStatus: () => api.quizStatus(lab),
    quizStart: async () => { await api.quizStart(lab); },
    quizAnswer: async (attemptId, ordinal, answer) => { await api.quizAnswer(attemptId, ordinal, answer); },
    quizSubmit: (attemptId, answers) => api.quizSubmit(attemptId, answers),
    checkAccess: () => api.checkAccess(lab),
    requestReconcile: async () => { await api.requestReconcile(lab); },
    resolveSubmission: () => api.resolveSubmission(lab),
    submit: (sha) => api.submit(lab, sha),
    submissions: (labId) => reads.mySubmissions(labId),
  };
}
