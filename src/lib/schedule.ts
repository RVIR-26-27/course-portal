// Display-only schedule logic. The server enforces every rule (opening gate,
// late cap, closing); this mirrors it so students see what will happen.
import type { Lab, LabState } from './types';

export const TZ = 'Europe/Ljubljana';

export type Phase = 'unscheduled' | 'upcoming' | 'open' | 'late' | 'closed';

export interface Schedule {
  phase: Phase;
  opensAt: Date | null;
  deadline: Date | null; // effective (includes a personal extension)
  closesAt: Date | null; // effective
  extended: boolean;
  lateCapUnits: number;
}

const d = (v: string | null | undefined) => (v ? new Date(v) : null);

export function scheduleOf(lab: Pick<Lab, 'opens_at' | 'deadline_at' | 'closes_at' | 'late_cap_percent' | 'max_units'>, state?: Pick<LabState, 'deadline_extension_at'> | null, now = Date.now()): Schedule {
  const ext = d(state?.deadline_extension_at);
  const baseDeadline = d(lab.deadline_at);
  const baseClose = d(lab.closes_at);
  const deadline = baseDeadline && ext && ext > baseDeadline ? ext : baseDeadline;
  const closesAt = baseClose && ext && ext > baseClose ? ext : baseClose;
  const opensAt = d(lab.opens_at);
  let phase: Phase = 'unscheduled';
  if (opensAt && now < opensAt.getTime()) phase = 'upcoming';
  else if (closesAt && now > closesAt.getTime()) phase = 'closed';
  else if (deadline && now > deadline.getTime()) phase = 'late';
  else if (opensAt || deadline || closesAt) phase = 'open';
  return {
    phase, opensAt, deadline, closesAt,
    extended: !!(ext && baseDeadline && ext > baseDeadline),
    lateCapUnits: Math.floor(((lab.max_units ?? 300) * Number(lab.late_cap_percent ?? 50)) / 100),
  };
}

const dateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const fmtDate = (x: Date | string | null | undefined) => (x ? dateFmt.format(typeof x === 'string' ? new Date(x) : x) : '—');
export const fmtDateTime = (x: Date | string | null | undefined) => (x ? dayFmt.format(typeof x === 'string' ? new Date(x) : x) : '—');

/** "3 d 4 h", "5 h 12 min", "12 min", "45 s" */
export function fmtLeft(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}

// ---------------------------------------------------------------- <input type="datetime-local"> (Europe/Ljubljana wall time)
function tzOffsetMinutes(at: Date): number {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(at).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!);
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** ISO instant -> "YYYY-MM-DDTHH:mm" in Ljubljana time (for datetime-local inputs). */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const at = new Date(iso);
  const local = new Date(at.getTime() + tzOffsetMinutes(at) * 60000);
  return local.toISOString().slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" in Ljubljana time -> ISO instant (DST-correct). */
export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const [date, time] = v.split('T');
  const [y, mo, da] = date!.split('-').map(Number);
  const [h, mi] = (time ?? '00:00').split(':').map(Number);
  const guess = Date.UTC(y!, mo! - 1, da!, h!, mi!);
  let at = new Date(guess - tzOffsetMinutes(new Date(guess)) * 60000);
  at = new Date(guess - tzOffsetMinutes(at) * 60000); // second pass around DST switches
  return at.toISOString();
}
