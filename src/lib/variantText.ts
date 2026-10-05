// Student-facing descriptions of variant parameters (same text as
// .assignment/VARIANT.md in the student repository).
const T: Record<string, Record<string, Record<string, string>>> = {
  lab01: {
    extraField: {
      department: 'Extra field Department: required, 1–40 characters after trimming.',
      office: 'Extra field Office: one capital letter, a dash and three digits (e.g. B-204).',
      phoneExtension: 'Extra field Phone extension: 3–5 digits.',
      jobTitle: 'Extra field Job title: required, 1–60 characters after trimming.',
    },
    nameMinLength: { '2': 'Names: at least 2 characters.', '3': 'Names: at least 3 characters.', '4': 'Names: at least 4 characters.' },
    listOrder: {
      surnameAscending: 'List order: last name A→Z (then first name, creation time, id).',
      createdNewestFirst: 'List order: newest first (then last name, id).',
    },
    detailRequirement: {
      createdAt: 'Detail screen: creation time as yyyy-MM-dd HH:mm.',
      initials: 'Detail screen: upper-case initials.',
      fullNameTitle: 'Detail screen: full name in UPPER CASE, also as the app bar title.',
    },
  },
  lab02: {
    extraField: {
      startYear: 'Extra persisted field startYear (int, default 2020).',
      isRemote: 'Extra persisted field isRemote (bool, default false).',
      hourlyRate: 'Extra persisted field hourlyRate (double, default 0.0).',
      nickname: 'Extra persisted field nickname (String?, default null).',
    },
    sortOrder: {
      lastNameAscending: 'After reload: last name A→Z.',
      createdAtAscending: 'After reload: oldest first.',
      createdAtDescending: 'After reload: newest first.',
    },
    duplicateIdPolicy: {
      reject: 'Duplicate id: throw DuplicateEmployeeException.',
      keepExisting: 'Duplicate id: keep the stored record.',
    },
  },
  lab03: {
    extraMetric: {
      humidity: 'Extra metric: relative humidity (%).',
      windSpeed: 'Extra metric: wind speed (km/h).',
      pressure: 'Extra metric: surface pressure (hPa).',
      apparentTemperature: 'Extra metric: feels-like temperature (°C).',
    },
    forecastDays: { '3': 'Forecast: 3 days.', '5': 'Forecast: 5 days.', '7': 'Forecast: 7 days.' },
    uiBehavior: {
      retryButton: 'Error states show a Retry button.',
      lastSuccessfulCity: 'After a failed search the last successful city stays visible.',
      refreshAction: 'App bar refresh action reloads the current city.',
      emptyForecastState: 'An empty forecast shows an explicit empty state.',
    },
  },
};

export function describeVariant(lab: string, params: Record<string, string | number>): string[] {
  return Object.entries(params).map(([k, v]) => T[lab]?.[k]?.[String(v)] ?? `${k}: ${v}`);
}
