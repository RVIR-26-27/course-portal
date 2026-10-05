# Lab 1 — UI, state & navigation

*About 15 minutes. Read the code, predict the result, then check yourself.*

## 1. Widgets describe the UI; State remembers

A Flutter screen is a tree of **widgets**. Widgets are cheap, immutable
descriptions that are rebuilt often. Data that must survive rebuilds lives in a
`State` object (for `StatefulWidget`) or in a separate **controller**.

```dart
class Counter extends StatefulWidget {
  const Counter({super.key});
  @override
  State<Counter> createState() => _CounterState();
}

class _CounterState extends State<Counter> {
  int taps = 0;                       // survives rebuilds
  @override
  Widget build(BuildContext context) => TextButton(
        onPressed: () => setState(() => taps++),   // mark dirty -> build() runs again
        child: Text('Tapped $taps times'),
      );
}
```

`setState` runs its callback immediately and schedules `build()` for the next
frame. It does **not** save anything and it does not rebuild the whole app.

```check
? A user taps the button three times. Which statements are true?
- [x] `build()` runs again after each tap.
- [x] The text shows `Tapped 3 times`, because `taps` lives in the `State` object.
- [ ] The counter resets to 0 on every rebuild, because widgets are recreated.
- [ ] `setState` writes `taps` to the device storage.
> The widget object is rebuilt, but the `State` object survives rebuilds — that is exactly why `taps` lives there. Nothing is saved to disk.
```


## 2. Keep state outside widgets: `ChangeNotifier`

When several screens share data (the employee list), put it into a controller:

```dart
class EmployeeController extends ChangeNotifier {
  final EmployeeRepository _repository;
  EmployeeController(this._repository);

  List<Employee> get employees => _repository.getAll();

  void add(Employee e) {
    _repository.add(e);
    notifyListeners();            // without this, nobody rebuilds
  }
}

// in a screen
ListenableBuilder(
  listenable: controller,
  builder: (context, _) => Text('${controller.employees.length} employees'),
)
```

```reveal
**Trace it:** the list has 2 employees and `add` is called once. What does the
`Text` show, and *why* — and what would it show if `notifyListeners()` were missing?
---
`3 employees`: `add` changes the data and `notifyListeners()` tells the
`ListenableBuilder` to rebuild. Without it the data is still 3, but the `Text`
keeps showing `2 employees` until something else happens to rebuild it.
```

## 3. Forms and validation

```dart
final _formKey = GlobalKey<FormState>();

Form(
  key: _formKey,
  child: TextFormField(
    controller: _name,                          // created once in the State
    validator: (value) {
      final v = value?.trim() ?? '';
      if (v.isEmpty) return 'Required';         // non-null = error text
      if (v.length < 3) return 'Too short';
      return null;                              // null = valid
    },
  ),
);

void _save() {
  if (!_formKey.currentState!.validate()) return;   // shows all errors
  // ... only valid data gets here
}
```

- A validator returns **`null` for valid** input and a message otherwise (an empty string is also an error!).
- `trim()` first, otherwise `'   '` passes a non-empty check.
- `TextEditingController`s belong to the `State`: create them once, `dispose()` them in `dispose()`.
  Creating them in `build()` loses the text on every rebuild.

```reveal
which inputs are valid for the validator above?
---
`' Eva '` (trimmed to `Eva`, 3 characters) is valid. `'Jo'` is too short,
`'    '` is `Required`, `null` is `Required`.
```

## 4. Lists

```dart
ListView.builder(
  itemCount: employees.length,
  itemBuilder: (context, index) {
    final e = employees[index];
    return ListTile(
      key: Key('employeeList.item.${e.id}'),   // stable key per item
      title: Text(e.fullName),
      onTap: () => openDetail(e),               // pass THIS employee
    );
  },
)
```

`ListView.builder` builds rows lazily. Off-by-one mistakes (`length - 1`,
`employees[index + 1]`) hide an item or crash with a `RangeError`.

```check
? The list holds 5 employees, but the builder uses `itemCount: employees.length - 1`. What does the user see?
- [x] Four rows — the last employee is never shown.
- [ ] A `RangeError` as soon as the list is built.
- [ ] All five rows; `itemCount` is only a hint.
> `itemCount` decides how many rows exist; with `length - 1` the last index is never requested. Using `employees[index + 1]` instead would crash on the last row.
```


## 5. Navigation with data

```dart
Navigator.of(context).push(MaterialPageRoute<void>(
  builder: (_) => EmployeeDetailScreen(employee: e, variant: variant),
));
// on the detail screen: Navigator.of(context).pop();
```

`push` returns a `Future` that completes when the route is popped (with an
optional result). In a `for (var i = …)` loop each closure captures its own `i`.

```check
? When does the `Future` returned by `Navigator.push` complete?
- [x] When the pushed route is popped (optionally with a result).
- [ ] Immediately, once the new route is on the stack.
- [ ] After the new screen has built its first frame.
> That is how a form screen can "return" the saved employee: `final e = await Navigator.of(context).push(...)`.
```


## 6. Immutable models and layers

`Employee` has only `final` fields and a `copyWith`. Changes create new objects
and go through the controller, so nothing changes "behind its back".

```text
Screens  ->  EmployeeController  ->  EmployeeRepository (interface)  <-  MemoryEmployeeRepository
(UI)         (state, rules: sort,     (storage contract)                 (implementation)
              create, notify)
```

Rules such as "sort by surname" or "trim and create the id" live in **one**
place (the controller), not in each widget.

```check
? Your variant sorts the list by surname. Where does that rule belong?
- [x] In `EmployeeController`, so every screen gets the same order.
- [ ] In the list screen's `build()`, right before `ListView.builder`.
- [ ] In `main.dart`, before `runApp`.
> One rule, one place: if each widget sorted on its own, two screens could disagree and tests of the controller would miss the rule.
```


## 7. Reading a widget test

```dart
testWidgets('empty form shows errors', (tester) async {
  final c = EmployeeController(repository: MemoryEmployeeRepository(), variant: assignmentVariant);
  await tester.pumpWidget(MaterialApp(home: EmployeeFormScreen(controller: c)));
  await tester.tap(find.byKey(const Key('employeeForm.submit')));
  await tester.pump();                           // rebuild to show errors
  expect(find.text('Required'), findsWidgets);
  expect(c.employees, isEmpty);
});
```

`pump()` advances one frame; `pumpAndSettle()` waits for animations such as
page transitions. Find widgets by **keys** from the contract, not by layout.

```reveal
a test adds two employees and taps the first row. Can it detect a bug where every row opens the first employee?
---
No. Tapping the first row gives the same result with and without the bug. A
good test taps a row that is **not** first and checks that row's data.
```

## Common mistakes

- Forgetting `notifyListeners()` after changing controller state.
- Validators returning `''` for valid input, or not trimming.
- Controllers created in `build()`; missing `dispose()`.
- `itemCount` off by one; passing the wrong list element to navigation.
- Putting all code in `main.dart` instead of the provided layers.

## Connection to the workshop

Your repository contains this architecture with **TODOs**: validation (including
your variant's extra field), two bugs to find (state notification and the
list), sorting by your variant, form → controller → list, navigation to the
detail screen, and **your own validator tests**. The readiness quiz checks
exactly these skills.
