// Curated further reading per lab. All links were checked (HTTP 200) on
// 2026-10-05; prefer official documentation that is maintained.
export interface Resource {
  title: string;
  url: string;
  kind: 'docs' | 'tutorial' | 'package' | 'tool' | 'video';
  note?: string;
}

const common: Resource[] = [
  { title: 'DartPad', url: 'https://dartpad.dev', kind: 'tool', note: 'Run Dart and Flutter snippets in the browser' },
  { title: 'Flutter DevTools', url: 'https://docs.flutter.dev/tools/devtools', kind: 'tool', note: 'Inspect widgets, rebuilds and network calls' },
];

export const resources: Record<'lab01' | 'lab02' | 'lab03', Resource[]> = {
  lab01: [
    { title: 'Write your first Flutter app (codelab)', url: 'https://docs.flutter.dev/get-started/codelab', kind: 'tutorial', note: 'Official step-by-step tutorial' },
    { title: 'Introduction to widgets', url: 'https://docs.flutter.dev/ui/widgets-intro', kind: 'docs' },
    { title: 'Adding interactivity (StatefulWidget, setState)', url: 'https://docs.flutter.dev/ui/interactivity', kind: 'docs' },
    { title: 'Simple app state management', url: 'https://docs.flutter.dev/data-and-backend/state-mgmt/simple', kind: 'docs', note: 'ChangeNotifier and listening widgets' },
    { title: 'ChangeNotifier API reference', url: 'https://api.flutter.dev/flutter/foundation/ChangeNotifier-class.html', kind: 'docs' },
    { title: 'Build a form with validation', url: 'https://docs.flutter.dev/cookbook/forms/validation', kind: 'tutorial' },
    { title: 'Work with long lists', url: 'https://docs.flutter.dev/cookbook/lists/long-lists', kind: 'tutorial', note: 'ListView.builder' },
    { title: 'Send data to a new screen', url: 'https://docs.flutter.dev/cookbook/navigation/passing-data', kind: 'tutorial' },
    { title: 'An introduction to widget testing', url: 'https://docs.flutter.dev/cookbook/testing/widget/introduction', kind: 'tutorial' },
    { title: 'Dart language tour', url: 'https://dart.dev/language', kind: 'docs' },
    ...common,
  ],
  lab02: [
    { title: 'Asynchronous programming: futures, async, await', url: 'https://dart.dev/libraries/async/async-await', kind: 'tutorial' },
    { title: 'Asynchronous programming in Dart', url: 'https://dart.dev/libraries/dart-async', kind: 'docs' },
    { title: 'JSON and serialization', url: 'https://docs.flutter.dev/data-and-backend/serialization/json', kind: 'docs', note: 'Encoding classes to maps and back' },
    { title: 'hive_ce package', url: 'https://pub.dev/packages/hive_ce', kind: 'package', note: 'The storage library used in this lab' },
    { title: 'Persistence cookbook', url: 'https://docs.flutter.dev/cookbook/persistence', kind: 'tutorial' },
    { title: 'Sound null safety', url: 'https://dart.dev/null-safety', kind: 'docs' },
    { title: 'Testing Flutter apps', url: 'https://docs.flutter.dev/testing/overview', kind: 'docs' },
    ...common,
  ],
  lab03: [
    { title: 'Fetch data from the internet', url: 'https://docs.flutter.dev/cookbook/networking/fetch-data', kind: 'tutorial' },
    { title: 'dio package', url: 'https://pub.dev/packages/dio', kind: 'package', note: 'The HTTP client used in this lab' },
    { title: 'Open-Meteo forecast API', url: 'https://open-meteo.com/en/docs', kind: 'docs' },
    { title: 'Open-Meteo geocoding API', url: 'https://open-meteo.com/en/docs/geocoding-api', kind: 'docs' },
    { title: 'HTTP response status codes (MDN)', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status', kind: 'docs' },
    { title: 'Parse JSON in the background', url: 'https://docs.flutter.dev/cookbook/networking/background-parsing', kind: 'tutorial' },
    { title: 'Firebase Authentication for Flutter', url: 'https://firebase.google.com/docs/auth/flutter/start', kind: 'docs' },
    { title: 'Add Firebase to your Flutter app', url: 'https://firebase.google.com/docs/flutter/setup', kind: 'tutorial' },
    { title: 'firebase_auth_mocks package', url: 'https://pub.dev/packages/firebase_auth_mocks', kind: 'package', note: 'Testing auth without a real backend' },
    ...common,
  ],
};
