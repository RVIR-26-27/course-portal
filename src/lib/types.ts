// Browser-side types mirroring docs/API_CONTRACTS.md. Nothing here is
// authoritative: the server re-validates every request.
export type LabSlug = 'lab01' | 'lab02' | 'lab03';
export type AccessStatus = 'locked' | 'queued' | 'invitation_pending' | 'provisioning' | 'ready' | 'retryable_error' | 'failed' | 'revocation_pending';

export interface Lab {
  id: string;
  slug: LabSlug;
  title: string;
  sort_order: number;
  enabled: boolean;
  quiz_pass_percent: number;
  quiz_time_limit_seconds: number;
  quiz_question_count: number;
  daily_submission_limit: number;
  max_units: number;
  max_points: number;
  opens_at: string | null;
  deadline_at: string | null;
  closes_at: string | null;
  late_cap_percent: number;
}

export interface CategoryResult {
  key: 'functional' | 'robustness' | 'architecture' | 'student_test' | 'hygiene';
  earned: number;
  max: number;
  summary: string;
}

export interface LabState {
  id: string;
  lab_id: string;
  variant_public_id: string;
  variant_payload: { params: Record<string, string | number>; publicId: string };
  learning_completed_at: string | null;
  quiz_passed_at: string | null;
  github_access_status: AccessStatus;
  github_access_detail: string | null;
  github_repo_full_name: string | null;
  github_repo_url: string | null;
  github_invitation_url: string | null;
  latest_submitted_sha: string | null;
  official_sha: string | null;
  latest_grade_units: number | null;
  latest_grade_details: { categories: CategoryResult[] | null; staff_review: boolean; raw_units?: number; late?: boolean | null; late_cap_units?: number | null } | null;
  deadline_extension_at: string | null;
  graded_at: string | null;
  manual_override: Record<string, { label: string; at: string }> | null;
}

export interface Student {
  id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  github_login: string | null;
  status: 'active' | 'inactive';
}

export interface Submission {
  id: string;
  seq: number;
  lab_id: string;
  commit_sha: string;
  status: 'queued' | 'running' | 'graded' | 'error';
  status_detail: string | null;
  requested_at: string;
  completed_at: string | null;
  grade_units: number | null;
  effective_units: number | null;
  late: boolean | null;
  details: CategoryResult[] | null;
}

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizItem {
  ordinal: number;
  type: 'single' | 'multi' | 'sequence';
  prompt: string;
  code: string | null;
  codeLanguage: string | null;
  options: QuizOption[];
  answer: string[] | null;
}

export interface QuizResult {
  attempt_id: string;
  status: 'submitted' | 'expired';
  score_raw: number;
  question_count: number;
  score_percent: number;
  passed: boolean;
  pass_percent: number;
  remediation_topics: string[];
  finalized_at: string;
}

export type QuizStatus =
  | { state: 'active'; attempt_id: string; attempt_number: number; started_at: string; expires_at: string; server_now: string; items: QuizItem[] }
  | { state: 'ready' | 'passed' | 'learning_incomplete' | 'cooldown'; cooldown_until: string | null; server_now: string; last_result: QuizResult | null };

export interface Context {
  github_id: string | null;
  github_login: string | null;
  admin_role: 'owner' | 'admin' | 'ta_readonly' | null;
  student: { id: string; status: string; first_name: string; last_name: string; github_login: string; identity_ok: boolean } | null;
}
