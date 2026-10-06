// PUBLIC rubric (the private grader rubric awards exactly these points at the
// lab's native maximum: Labs 1-2 3.00, Lab 3 4.00; 1 grader unit = 0.01 point).
import type { CategoryResult } from './types';

export interface RubricRow {
  key: CategoryResult['key'];
  category: string;
  points: string;
  checks: string;
}

const common: RubricRow[] = [
  { key: 'hygiene', category: 'Code hygiene', points: '0.20', checks: 'Analyzer reports no warnings (infos allowed) · protected files unchanged' },
];

export const RUBRICS: Record<string, { rows: RubricRow[]; studentTest: string[] }> = {
  lab01: {
    rows: [
      { key: 'functional', category: 'Functional behaviour', points: '1.60', checks: '8 × 0.20: add through the form · several employees render · list order · navigation opens the tapped employee · detail e-mail and extra field · detail variant requirement · controller notifies listeners · stored values are trimmed' },
      { key: 'robustness', category: 'Edge cases & robustness', points: '0.50', checks: '5 × 0.10: blank names · minimum-length boundary · extra-field rule · invalid e-mail blocks saving · many employees render in order' },
      { key: 'architecture', category: 'Architecture', points: '0.40', checks: '4 × 0.10: controller uses the injected repository · list renders injected state · detail screen works standalone · analyzer reports no errors' },
      { key: 'student_test', category: 'Your test', points: '0.30', checks: '3 × 0.10: each published regression detected, and the tests pass on a correct solution' },
      ...common,
    ],
    studentTest: ['Whitespace-only names are accepted', 'Names of exactly the minimum length are rejected', 'validateExtra accepts a value that breaks your rule'],
  },
  lab02: {
    rows: [
      { key: 'functional', category: 'Functional behaviour', points: '1.60', checks: '8 × 0.20: create/update/delete persist · many records persist · extra field serialization · UI shows persisted data · list reloads after writes · "Employee saved" feedback' },
      { key: 'robustness', category: 'Edge cases & robustness', points: '0.50', checks: '5 × 0.10: old records get the default · corrupt records skipped · duplicate-id policy · unknown ids · sort order after reload' },
      { key: 'architecture', category: 'Architecture', points: '0.40', checks: '4 × 0.10: injected repository · storage-free codec round trip · box isolation · analyzer reports no errors' },
      { key: 'student_test', category: 'Your test', points: '0.30', checks: '3 × 0.10: each published regression detected, and the tests pass on a correct solution' },
      ...common,
    ],
    studentTest: ['The extra field is lost after reopening', 'Deleted employees reappear after reopening', 'Updates are not persisted after reopening'],
  },
  lab03: {
    rows: [
      { key: 'functional', category: 'Functional behaviour', points: '2.00', checks: '8 × 0.25: login required · login shows weather · sign out · current weather · forecast count and order · extra metric · Dio adapter requests and parsing · Firebase adapter mapping' },
      { key: 'robustness', category: 'Edge cases & robustness', points: '0.75', checks: '5 × 0.15: failed login · timeout recovery · unknown city · server and malformed responses · your UI behaviour' },
      { key: 'architecture', category: 'Architecture', points: '0.60', checks: '4 × 0.15: injected AuthService · injected WeatherService · injected Dio and base URLs · analyzer reports no errors' },
      { key: 'student_test', category: 'Your test', points: '0.45', checks: '3 × 0.15: each published regression detected, and the tests pass on a correct solution' },
      ...common,
    ],
    studentTest: ['Timeouts are reported as network errors', 'The extra metric is not parsed', 'An empty geocoding result is not reported as cityNotFound'],
  },
};

/** Points of a full solution as published (the lab's native maximum). */
export const nativePoints = (lab: string) => RUBRICS[lab]!.rows.reduce((a, r) => a + Number(r.points), 0);

/** Grader units per category (1 unit = 0.01 native point). */
export const rubricUnits = (lab: string) =>
  Object.fromEntries(RUBRICS[lab]!.rows.map((r) => [r.key, Math.round(Number(r.points) * 100)])) as Record<CategoryResult['key'], number>;

/** Rewrites every point value (x.yy) of a rubric text by factor k (same rule as the README). */
export const scalePoints = (text: string, k: number) =>
  Math.abs(k - 1) < 1e-9 ? text : text.replace(/(?<![\d.])(\d+\.\d{2})(?![\d.])/g, (m) => (Number(m) * k).toFixed(2));

export const TOPIC_LABELS: Record<string, string> = {
  'widget-tree': 'Widget tree and rebuilds', 'stateful-widgets': 'StatefulWidget lifecycle', 'set-state': 'setState', 'change-notifier': 'ChangeNotifier controllers',
  'form-validation': 'Form validation', 'text-controllers': 'TextEditingController lifecycle', 'list-rendering': 'Rendering lists', navigation: 'Navigation',
  nullability: 'Null safety', immutability: 'Immutable models', layering: 'Layered architecture', 'widget-tests': 'Widget tests',
  persistence: 'Persistence vs memory', 'async-await': 'async / await', repository: 'Repository abstraction', crud: 'CRUD semantics',
  serialization: 'Serialization', 'stable-ids': 'Stable ids', 'storage-init': 'Opening storage', 'error-handling': 'Error handling',
  'state-refresh': 'Refreshing state after writes', 'what-to-store': 'What to store', 'test-isolation': 'Test isolation',
  http: 'HTTP methods and status codes', 'async-errors': 'Async exceptions', dio: 'Dio responses and errors', json: 'JSON parsing',
  'auth-state': 'Authentication state', 'firebase-config': 'Firebase configuration vs credentials', 'ui-states': 'Loading/error/success states',
  fakes: 'Fakes and dependency injection', secrets: 'Secrets in source code',
};
