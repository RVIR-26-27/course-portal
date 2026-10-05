// PUBLIC rubric (the private grader rubric awards exactly these points).
export interface RubricRow {
  category: string;
  points: string;
  checks: string;
}

const common = [
  { category: 'Code hygiene', points: '0.20', checks: 'Analyzer reports no warnings (infos allowed) · protected files unchanged' },
];

export const RUBRICS: Record<string, { rows: RubricRow[]; studentTest: string[] }> = {
  lab01: {
    rows: [
      { category: 'Functional behaviour', points: '1.60', checks: '8 × 0.20: add through the form · several employees render · list order · navigation opens the tapped employee · detail e-mail and extra field · detail variant requirement · controller notifies listeners · stored values are trimmed' },
      { category: 'Edge cases & robustness', points: '0.50', checks: '5 × 0.10: blank names · minimum-length boundary · extra-field rule · invalid e-mail blocks saving · many employees render in order' },
      { category: 'Architecture', points: '0.40', checks: '4 × 0.10: controller uses the injected repository · list renders injected state · detail screen works standalone · analyzer reports no errors' },
      { category: 'Your test', points: '0.30', checks: '3 × 0.10: each published regression detected, and the tests pass on a correct solution' },
      ...common,
    ],
    studentTest: ['Whitespace-only names are accepted', 'Names of exactly the minimum length are rejected', 'validateExtra accepts a value that breaks your rule'],
  },
  lab02: {
    rows: [
      { category: 'Functional behaviour', points: '1.60', checks: '8 × 0.20: create/update/delete persist · many records persist · extra field serialization · UI shows persisted data · list reloads after writes · "Employee saved" feedback' },
      { category: 'Edge cases & robustness', points: '0.50', checks: '5 × 0.10: old records get the default · corrupt records skipped · duplicate-id policy · unknown ids · sort order after reload' },
      { category: 'Architecture', points: '0.40', checks: '4 × 0.10: injected repository · storage-free codec round trip · box isolation · analyzer reports no errors' },
      { category: 'Your test', points: '0.30', checks: '3 × 0.10: each published regression detected, and the tests pass on a correct solution' },
      ...common,
    ],
    studentTest: ['The extra field is lost after reopening', 'Deleted employees reappear after reopening', 'Updates are not persisted after reopening'],
  },
  lab03: {
    rows: [
      { category: 'Functional behaviour', points: '1.60', checks: '8 × 0.20: login required · login shows weather · sign out · current weather · forecast count and order · extra metric · Dio adapter requests and parsing · Firebase adapter mapping' },
      { category: 'Edge cases & robustness', points: '0.50', checks: '5 × 0.10: failed login · timeout recovery · unknown city · server and malformed responses · your UI behaviour' },
      { category: 'Architecture', points: '0.40', checks: '4 × 0.10: injected AuthService · injected WeatherService · injected Dio and base URLs · analyzer reports no errors' },
      { category: 'Your test', points: '0.30', checks: '3 × 0.10: each published regression detected, and the tests pass on a correct solution' },
      ...common,
    ],
    studentTest: ['Timeouts are reported as network errors', 'The extra metric is not parsed', 'An empty geocoding result is not reported as cityNotFound'],
  },
};

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
