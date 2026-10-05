# Lab 3 — Networking & authentication

*About 20 minutes.*

## 1. HTTP in one minute

| | Meaning | Typical reaction |
|---|---|---|
| `GET` | read data, no side effects | fetch weather |
| `200` | OK | show data |
| `401` / `403` | not authenticated / not allowed | sign in / explain |
| `404` | not found | show "not found" |
| `5xx` | server failed | "try again later" |

## 2. Dio

```dart
final dio = Dio(BaseOptions(connectTimeout: const Duration(seconds: 8), receiveTimeout: const Duration(seconds: 8)));
final res = await dio.get<Object?>('https://api.open-meteo.com/v1/forecast', queryParameters: {
  'latitude': 46.55, 'longitude': 15.65, 'current': 'temperature_2m,weather_code', 'timezone': 'auto',
});
final data = res.data;     // JSON is already decoded into Map<String, dynamic>
```

By default Dio **throws** `DioException` for non-2xx statuses and for timeouts:

```dart
try {
  await dio.get(url);
} on DioException catch (e) {
  switch (e.type) {
    case DioExceptionType.connectionTimeout || DioExceptionType.receiveTimeout: /* timeout */
    case DioExceptionType.badResponse: /* e.response?.statusCode */
    default: /* network problem */
  }
}
```

Translate these into **your own** failure type (`WeatherFailure`) inside the
service, so widgets never see Dio.

## 3. Parsing JSON defensively

```dart
final current = data['current'];
if (current is! Map) throw const WeatherFailure(WeatherFailureKind.invalidResponse);
final temp = (current['temperature_2m'] as num).toDouble();   // 12 or 12.5
```

Daily values arrive as parallel arrays (`time[i]`, `temperature_2m_max[i]`, …);
check that they have the same length.

<details><summary>Self-check 1 — the geocoding API answers <code>{"generationtime_ms": 0.2}</code>. What should the service do?</summary>

There is no `results` list: the city was not found. Throw
`WeatherFailure(cityNotFound)` — not a crash, not a generic error.
</details>

## 4. UI states

A request is **loading**, then **success** or **error**. Every path must end in
a defined state — an exception that skips `status = …` leaves a spinner forever.

```dart
status = loading; notifyListeners();
try {
  current = await service.currentForCity(city);
  status = success;
} on WeatherFailure catch (f) {
  failure = f.kind;
  status = error;
}
notifyListeners();
```

`Future.wait([a(), b()])` runs both requests concurrently.

## 5. Authentication state

Firebase Authentication tells you who is signed in via a **stream**:

```dart
StreamBuilder<AppUser?>(
  stream: _authChanges,                    // created ONCE, not in every build
  builder: (context, snap) => snap.data == null ? LoginScreen(auth: auth) : WeatherScreen(...),
)
```

The weather screen must be unreachable while signed out. After a successful
sign-in the login screen disappears — check `mounted` before `setState` after `await`.

## 6. Configuration vs secrets

`lib/firebase_options.dart` (from `flutterfire configure`) is **client
configuration** that ships in every app build. A **service-account JSON** file
contains a private key with admin rights: never download it into the app
project, never commit it; if it leaks, **revoke** it. The same holds for any
paid API key: an app cannot keep secrets.

## 7. Testing without the network

- Widget tests inject **fake services** (`FakeAuthService`, `FakeWeatherService`).
- Adapter tests keep your **real** `OpenMeteoWeatherService` and fake only the
  HTTP layer (`FakeHttpAdapter` for Dio) — this is how parsing and error mapping
  get tested.
- `MockFirebaseAuth` (firebase_auth_mocks) tests your Firebase adapter.

<details><summary>Self-check 2 — which test detects "timeouts are reported as network errors"?</summary>

A Dio adapter test whose fake adapter throws `DioException.connectionTimeout`
and expects `WeatherFailure` with kind `timeout`. A fake *service* test cannot,
because it bypasses your mapping code.
</details>

## Connection to the workshop

You will implement the login and auth routing, the Firebase adapter, Dio
requests and parsing (with your extra metric and number of forecast days),
loading/error handling, sign-out, your UI behaviour, and adapter tests with the
fake HTTP layer.
