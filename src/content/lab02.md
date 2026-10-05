# Lab 2 — Local persistence (Hive CE)

*About 15 minutes.*

## 1. Memory vs storage

Everything in variables disappears when the app process ends. To keep data
across restarts, write it to **persistent storage**. This lab uses **Hive CE**
(`hive_ce`), a fast key-value store — the maintained community edition of Hive.

```dart
final box = await Hive.openBox<dynamic>('employees', path: directory);
await box.put('e1', {'id': 'e1', 'firstName': 'Ana'});   // key -> value
final Object? raw = box.get('e1');
await box.delete('e1');
await box.close();                                      // data stays on disk
```

`put` with an existing key **replaces** the value. The box must be **opened
before** anything reads it — in Lab 2, `main()` awaits it before `runApp`.

## 2. async / await

```dart
Future<void> save(Employee e) async {
  await repository.add(e);      // waits until stored (or throws here)
  print('saved');               // only after success
}
```

- Without `await`, errors are not caught by the surrounding `try`.
- `list.forEach((x) async { await ... })` does **not** wait; use `for (final x in list) { await ...; }`.
- `try / catch / finally`: `finally` always runs.

**Trace it:** what is printed?

```dart
print('A');
final f = Future(() => print('B'));
print('C');
await f;
print('D');
```

<details><summary>Answer</summary>

`A C B D` — `Future(() => ...)` runs later; synchronous code first.
</details>

## 3. Serialization

Storage understands maps, lists, strings, numbers and booleans — not your
classes. Convert both ways with one **codec**:

```dart
Map<String, Object?> encode(Employee e) => {
      'id': e.id,
      'lastName': e.lastName,
      'createdAt': e.createdAt.toIso8601String(),   // DateTime -> String
    };

Employee? decode(Object? raw) {
  if (raw is! Map) return null;                     // Hive gives Map<dynamic, dynamic>
  final created = raw['createdAt'];
  if (created is! String) return null;
  final date = DateTime.tryParse(created);
  if (date == null) return null;                    // corrupt -> skip, don't crash
  return Employee(id: raw['id'] as String, lastName: raw['lastName'] as String, createdAt: date /* ... */);
}
```

- Use the **same keys** in both directions (`lastName` ≠ `lastname`).
- `raw as Map<String, Object?>` fails at runtime for a `Map<dynamic, dynamic>` — check and read values instead.
- Numbers: read `num` and convert (`(v as num).toDouble()`); an `int` is not a `double` on mobile.
- Old records may miss a new field → use a documented **default**.

## 4. CRUD and stable ids

| Operation | Hive | Contract |
|---|---|---|
| Create | `put(e.id, encode(e))` | duplicate id → your variant's policy |
| Read | `values` → decode, skip `null` | any order |
| Update | `put(e.id, …)` | same id; unknown → `EmployeeNotFoundException` |
| Delete | `delete(id)` | unknown ids ignored |

The id is created **once**. An edit uses `copyWith` and keeps the id — using
`add` for edits (or `box.add`, which invents a new key) duplicates records.

## 5. Refresh the UI from the source of truth

After every successful write, the controller **reloads from the repository**
and notifies listeners. Updating only a local list shows stale or wrong data
(e.g. when the repository keeps the existing record for a duplicate id).

## 6. Testing storage in isolation

```dart
test('delete persists', () async {
  final dir = await tempStorageDir();                 // fresh per test, deleted after
  final r1 = await HiveEmployeeRepository.open(directory: dir, variant: v, boxName: 't');
  await r1.add(ana);
  await r1.delete(ana.id);
  await r1.close();
  final r2 = await HiveEmployeeRepository.open(directory: dir, variant: v, boxName: 't');
  expect(await r2.getAll(), isEmpty);                 // proves it is gone from DISK
  await r2.close();
});
```

Reopening simulates an app restart. In `testWidgets`, real file I/O must run
inside `tester.runAsync(...)`; UI tests usually use the in-memory repository.

<details><summary>Self-check — why is "add, delete, expect getAll() empty" on the same instance not enough?</summary>

An implementation that only removes the record from an in-memory cache passes
it, although the record is still on disk and comes back after a restart.
</details>

## Common mistakes

Not awaiting `openBox`; storing `DateTime` in two different formats; casting
Hive maps blindly; one corrupt record crashing the list; forgetting to reload
after writes; tests sharing one directory.

## Connection to the workshop

You will open storage in `main`, write the codec (including your variant's
extra field and its default), implement CRUD with your duplicate-id policy,
reload the list after writes, show `Employee saved`, sort after reload, and
write persistence tests that reopen the repository.
