// The problems inside one merged ticket, counted the way the desk counts (causes.ts, as in
// CauseTable): every report under the cause its tenant gives it (locale + booking form), never
// under intake's tag. The reports the desk read as a one-day move (desk-notes.json) are their own
// problem: the date shifts by a day, the month does not flip. As the desk does, they stay counted
// where they are filed, and the one-day row lists them again.
import { causeOf, uniqueById, type Report, type Tenant } from '#lib/kb/causes';

export type Problem = 'parser' | 'hint' | 'one-day' | 'unplaced';

// Where each problem stands, from engineering's update on #4471 (closed 5 Oct 2026).
export const PROBLEMS: Record<Problem, { title: string; ticket: number | null; state: string }> = {
  parser: { title: 'Shared parser reads day-first dates month first', ticket: 1, state: 'fixed 5 Oct · fix(dates): parse dd/mm for eu locales' },
  hint: { title: 'booking-v3 form hints MM/DD/YYYY, then reads the date day first', ticket: 2, state: "won't fix · booking-v3 form retired" },
  'one-day': { title: 'Booking moves by one day (not a month flip)', ticket: 3, state: 'open · no fix yet' },
  unplaced: { title: 'No tenant on file: cause unknown', ticket: null, state: 'open' },
};

export const TICKET_REPO = 'https://github.com/SimplifyAll/support-kb-4471/issues';


export type ProblemGroup = {
  problem: Problem;
  reports: Report[];
  tenants: number;
  firstSeen: string;
  lastSeen: string;
  // How many of these intake tagged as something else.
  mistagged: number;
  // Of these, how many are also listed under another problem (one-day reports, by their filing).
  alsoIn: { problem: Problem; count: number } | null;
};

export function splitTicket(
  all: Report[],
  ticket: number,
  tenantOf: (r: Report) => Tenant | undefined,
  oneDayMove: readonly string[],
): { exportRows: number; reports: Report[]; groups: ProblemGroup[] } {
  const reports = uniqueById(all).filter((r) => r.mergedInto === ticket);
  const by = new Map<Problem, Report[]>();
  for (const r of reports) {
    const p: Problem = causeOf(r, tenantOf(r)) ?? 'unplaced';
    by.set(p, [...(by.get(p) ?? []), r]);
  }
  const moved = reports.filter((r) => oneDayMove.includes(r.id));
  if (moved.length) by.set('one-day', moved);
  const groups = [...by.entries()]
    .map(([problem, rs]) => {
      const inOneDay = problem === 'one-day' ? 0 : rs.filter((r) => oneDayMove.includes(r.id)).length;
      const days = rs.map((r) => r.receivedAt.slice(0, 10)).sort();
      return {
        problem,
        reports: rs,
        tenants: new Set(rs.map((r) => r.tenant)).size,
        firstSeen: days[0],
        lastSeen: days[days.length - 1],
        mistagged: rs.filter((r) => r.meta.intakeTag !== problem).length,
        alsoIn: inOneDay ? { problem: 'one-day' as Problem, count: inOneDay } : null,
      };
    })
    .sort((a, b) => b.reports.length - a.reports.length);
  return { exportRows: all.filter((r) => r.mergedInto === ticket).length, reports, groups };
}
