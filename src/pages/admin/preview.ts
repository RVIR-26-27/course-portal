// "Student view" simulation for staff. Implements LabActions entirely in the
// browser: nothing is written to the database, no repository is created and
// no grading runs. The only server call is the admin `quiz-preview` action,
// which selects and renders a fresh quiz exactly like quiz-start does (same
// engine, same bank) and returns the answer key for staff review.
import { api } from '../../lib/api';
import type { LabActions, PreviewAnswer, Resolved } from '../../lib/labActions';
import { rubricUnits } from '../../lib/rubric';
import type { Lab, LabSlug, LabState, QuizItem, QuizResult, QuizStatus, Submission } from '../../lib/types';

export const SCENARIOS = [
  { id: 'new', label: 'New student (nothing done)' },
  { id: 'learning_done', label: 'Learning done — quiz next' },
  { id: 'cooldown', label: 'Quiz failed twice — cooldown' },
  { id: 'preparing', label: 'Quiz passed — repository being prepared' },
  { id: 'invitation', label: 'Invitation waiting' },
  { id: 'ready', label: 'Repository ready — not submitted' },
  { id: 'graded', label: 'Graded on time (2.45)' },
  { id: 'graded_late', label: 'Graded late (capped)' },
  { id: 'upcoming', label: 'Lab not open yet' },
  { id: 'deadline_soon', label: 'Deadline in 20 hours' },
  { id: 'closed', label: 'Lab closed' },
] as const;
export type ScenarioId = (typeof SCENARIOS)[number]['id'];

type PreviewItem = QuizItem & PreviewAnswer & { topics: string[] };

const VARIANT_OPTIONS: Record<LabSlug, Record<string, (string | number)[]>> = {
  lab01: { extraField: ['department', 'office', 'phoneExtension', 'jobTitle'], nameMinLength: [2, 3, 4], listOrder: ['surnameAscending', 'createdNewestFirst'], detailRequirement: ['createdAt', 'initials', 'fullNameTitle'] },
  lab02: { extraField: ['startYear', 'isRemote', 'hourlyRate', 'nickname'], sortOrder: ['lastNameAscending', 'createdAtAscending', 'createdAtDescending'], duplicateIdPolicy: ['reject', 'keepExisting'] },
  lab03: { extraMetric: ['humidity', 'windSpeed', 'pressure', 'apparentTemperature'], forecastDays: [3, 5, 7], uiBehavior: ['retryButton', 'lastSuccessfulCity', 'refreshAction', 'emptyForecastState'] },
};

export function randomVariant(lab: LabSlug): { params: Record<string, string | number>; publicId: string } {
  const params = Object.fromEntries(Object.entries(VARIANT_OPTIONS[lab]).map(([k, opts]) => [k, opts[Math.floor(Math.random() * opts.length)]!]));
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const publicId = 'V1-' + Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * 32)]).join('');
  return { params, publicId };
}

// A plausible partial result, built from the lab's own published rubric.
const SAMPLE_PASSED = [
  ['functional', 7, 8, '7/8 functional checks passed'],
  ['robustness', 4, 5, '4/5 edge cases handled'],
  ['architecture', 3, 4, '3/4 architecture checks passed'],
  ['student_test', 1, 3, '1/3 regressions detected'],
  ['hygiene', 2, 2, 'analyzer clean'],
] as const;
const sampleCategories = (lab: LabSlug) => {
  const units = rubricUnits(lab);
  return SAMPLE_PASSED.map(([key, n, of, summary]) => ({ key, earned: (units[key] * n) / of, max: units[key], summary }));
};

const hours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
const sha = (c: string) => c.repeat(40).slice(0, 40);

export class PreviewEngine {
  lab: Lab;
  state: LabState;
  subs: Submission[] = [];
  private quiz: { items: PreviewItem[]; attemptId: string; expiresAt: string; number: number } | null = null;
  private lastResult: QuizResult | null = null;
  private cooldownUntil: string | null = null;
  private failStreak = 0;
  private lastKey: Record<number, PreviewAnswer> | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(base: Lab, scenario: ScenarioId, variant: { params: Record<string, string | number>; publicId: string }, private notify: () => void) {
    this.lab = { ...base, enabled: true, opens_at: base.opens_at, deadline_at: base.deadline_at, closes_at: base.closes_at };
    this.state = {
      id: `preview-${base.slug}-${scenario}-${variant.publicId}`, lab_id: base.id, variant_public_id: variant.publicId,
      variant_payload: { params: variant.params, publicId: variant.publicId },
      learning_completed_at: null, quiz_passed_at: null, github_access_status: 'locked', github_access_detail: null,
      github_repo_full_name: null, github_repo_url: null, github_invitation_url: null, latest_submitted_sha: null, official_sha: null,
      latest_grade_units: null, latest_grade_details: null, graded_at: null, manual_override: null, deadline_extension_at: null,
    };
    this.apply(scenario);
  }

  dispose() {
    this.timers.forEach(clearTimeout);
  }

  private repo() {
    const name = `RVIR-26-27/flutter-lab-${this.lab.slug.slice(-2)}-preview`;
    this.state.github_repo_full_name = name;
    this.state.github_repo_url = `https://github.com/${name}`;
    this.state.github_invitation_url = `https://github.com/${name}/invitations`;
  }

  private graded(late: boolean) {
    const categories = sampleCategories(this.lab.slug);
    const units = categories.reduce((n, c) => n + c.earned, 0);
    const cap = Math.floor((this.lab.max_units * Number(this.lab.late_cap_percent)) / 100);
    const eff = late ? Math.min(units, cap) : units;
    this.state.latest_grade_units = eff;
    this.state.official_sha = sha('a');
    this.state.latest_submitted_sha = sha('a');
    this.state.latest_grade_details = { categories, staff_review: false, raw_units: units, late, late_cap_units: late ? cap : null };
    this.subs = [{ id: 's1', seq: 1, lab_id: this.lab.id, commit_sha: sha('a'), status: 'graded', status_detail: null, requested_at: hours(late ? -2 : -30), completed_at: hours(late ? -1.9 : -29.9), grade_units: units, effective_units: eff, late, details: null }];
  }

  private apply(s: ScenarioId) {
    const st = this.state;
    const passed = ['preparing', 'invitation', 'ready', 'graded', 'graded_late', 'deadline_soon', 'closed'];
    if (s !== 'new' && s !== 'upcoming') st.learning_completed_at = hours(-48);
    if (passed.includes(s)) { st.quiz_passed_at = hours(-47); }
    if (s === 'cooldown') {
      this.failStreak = 2;
      this.cooldownUntil = hours(10 / 60);
      this.lastResult = { attempt_id: 'p0', status: 'submitted', score_raw: 4, question_count: this.lab.quiz_question_count, score_percent: 50, passed: false, pass_percent: Number(this.lab.quiz_pass_percent), remediation_topics: ['form-validation', 'navigation'], finalized_at: hours(-0.05) };
    }
    if (s === 'preparing') st.github_access_status = 'provisioning';
    if (s === 'invitation') { this.repo(); st.github_access_status = 'invitation_pending'; }
    if (['ready', 'graded', 'graded_late', 'deadline_soon', 'closed'].includes(s)) { this.repo(); st.github_access_status = 'ready'; }
    if (s === 'graded' || s === 'closed') this.graded(false);
    if (s === 'graded_late') { this.lab.opens_at = hours(-24 * 14); this.lab.deadline_at = hours(-24); this.lab.closes_at = hours(24 * 6); this.graded(true); }
    if (s === 'upcoming') { this.lab.opens_at = hours(24 * 3); this.lab.deadline_at = hours(24 * 17); this.lab.closes_at = null; }
    if (s === 'deadline_soon') { this.lab.opens_at = hours(-24 * 13); this.lab.deadline_at = hours(20); this.lab.closes_at = hours(24 * 7); }
    if (s === 'closed') { this.lab.opens_at = hours(-24 * 30); this.lab.deadline_at = hours(-24 * 9); this.lab.closes_at = hours(-24 * 2); }
  }

  private changed() {
    this.state = { ...this.state };
    this.lab = { ...this.lab };
    this.subs = [...this.subs];
    this.notify();
  }

  private later(ms: number, fn: () => void) {
    this.timers.push(setTimeout(() => { fn(); this.changed(); }, ms));
  }

  private quizStatusNow(): QuizStatus {
    const now = new Date().toISOString();
    if (this.quiz) {
      return { state: 'active', attempt_id: this.quiz.attemptId, attempt_number: this.quiz.number, started_at: now, expires_at: this.quiz.expiresAt, server_now: now,
        items: this.quiz.items.map(({ correct: _c, explanation: _e, category: _g, question_key: _k, topics: _t, ...pub }) => pub) };
    }
    if (this.state.quiz_passed_at) return { state: 'passed', cooldown_until: null, server_now: now, last_result: this.lastResult };
    if (!this.state.learning_completed_at) return { state: 'learning_incomplete', cooldown_until: null, server_now: now, last_result: this.lastResult };
    if (this.cooldownUntil && Date.parse(this.cooldownUntil) > Date.now()) return { state: 'cooldown', cooldown_until: this.cooldownUntil, server_now: now, last_result: this.lastResult };
    return { state: 'ready', cooldown_until: null, server_now: now, last_result: this.lastResult };
  }

  actions(): LabActions {
    return {
      mode: 'preview',
      completeLearning: async () => { this.state.learning_completed_at = new Date().toISOString(); this.changed(); },
      quizStatus: async () => this.quizStatusNow(),
      quizStart: async () => {
        const r = await api.admin<{ items: PreviewItem[] }>('quiz-preview', { lab: this.lab.slug });
        this.quiz = { items: r.items, attemptId: `preview-${Date.now()}`, expiresAt: new Date(Date.now() + this.lab.quiz_time_limit_seconds * 1000).toISOString(), number: (this.lastResult ? 2 : 1) };
        this.lastKey = null;
      },
      quizAnswer: async () => { await new Promise((r) => setTimeout(r, 150)); },
      quizSubmit: async (_id, answers) => {
        const q = this.quiz!;
        const right = (it: PreviewItem) => {
          const a = answers[it.ordinal];
          if (!a) return false;
          return it.type === 'sequence' ? JSON.stringify(a) === JSON.stringify(it.correct) : a.length === it.correct.length && a.every((x) => it.correct.includes(x));
        };
        const score = q.items.filter(right).length;
        const pct = Math.round((score / q.items.length) * 10000) / 100;
        const passed = pct >= Number(this.lab.quiz_pass_percent);
        const topics = [...new Set(q.items.filter((it) => !right(it)).flatMap((it) => it.topics))].slice(0, 4);
        this.lastKey = Object.fromEntries(q.items.map((it) => [it.ordinal, { correct: it.correct, explanation: it.explanation, category: it.category, question_key: it.question_key }]));
        this.lastResult = { attempt_id: q.attemptId, status: 'submitted', score_raw: score, question_count: q.items.length, score_percent: pct, passed, pass_percent: Number(this.lab.quiz_pass_percent), remediation_topics: passed ? [] : topics, finalized_at: new Date().toISOString() };
        this.quiz = null;
        if (passed) {
          this.state.quiz_passed_at = new Date().toISOString();
          this.state.github_access_status = 'provisioning';
          this.later(2500, () => { this.repo(); this.state.github_access_status = 'invitation_pending'; });
        } else if (++this.failStreak >= 2) this.cooldownUntil = new Date(Date.now() + 600_000).toISOString();
        this.changed();
        return this.lastResult;
      },
      checkAccess: async () => {
        if (this.state.github_access_status === 'invitation_pending') { this.state.github_access_status = 'ready'; this.changed(); }
        return { status: this.state.github_access_status };
      },
      requestReconcile: async () => undefined,
      resolveSubmission: async (): Promise<Resolved> => ({ repo_full_name: this.state.github_repo_full_name ?? '', branch: 'main', commit_sha: sha('b'), quota_used: this.subs.length, quota_limit: this.lab.daily_submission_limit }),
      submit: async (commit) => {
        if (this.subs.some((s) => s.commit_sha === commit)) return { duplicate: true };
        const late = !!(this.lab.deadline_at && Date.now() > Date.parse(this.lab.deadline_at));
        const sub: Submission = { id: `s${Date.now()}`, seq: this.subs.length + 1, lab_id: this.lab.id, commit_sha: commit, status: 'queued', status_detail: null, requested_at: new Date().toISOString(), completed_at: null, grade_units: null, effective_units: null, late, details: null };
        this.subs = [sub, ...this.subs];
        this.state.latest_submitted_sha = commit;
        this.later(1500, () => { this.subs = this.subs.map((s) => (s.id === sub.id ? { ...s, status: 'running' } : s)); });
        this.later(4500, () => {
          const raw = this.lab.max_units;
          const cap = Math.floor((this.lab.max_units * Number(this.lab.late_cap_percent)) / 100);
          const eff = late ? Math.min(raw, cap) : raw;
          this.subs = this.subs.map((s) => (s.id === sub.id ? { ...s, status: 'graded', grade_units: raw, effective_units: eff, completed_at: new Date().toISOString() } : s));
          if ((this.state.latest_grade_units ?? -1) < eff) {
            this.state.latest_grade_units = eff;
            this.state.official_sha = commit;
            this.state.latest_grade_details = { categories: sampleCategories(this.lab.slug).map((c) => ({ ...c, earned: c.max })), staff_review: false, raw_units: raw, late, late_cap_units: late ? cap : null };
          }
        });
        this.changed();
        return { duplicate: false };
      },
      submissions: async () => this.subs,
      previewAnswers: () => this.lastKey,
    };
  }
}
