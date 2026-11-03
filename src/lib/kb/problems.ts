// The problems inside one merged ticket. Built on causes.ts: the cause comes from the tenant
// (locale + booking form), never from intake's tag. On top of that, the reports the desk itself
// read as a one-day move (desk-notes.json) are their own problem: the date shifts by a day, the
// month does not flip, so neither the parser fix nor the hint fix touches them.
import { causeOf, uniqueById, type Report, type Tenant } from '#lib/kb/causes';

export type Problem = 'parser' | 'hint' | 'one-day' | 'unplaced';

export const PROBLEMS: Record<Problem, { title: string; ticket: number | null }> = {
  parser: { title: 'Shared parser reads day-first dates month first', ticket: 1 },
  hint: { title: 'booking-v3 form hints MM/DD/YYYY, then reads the date day first', ticket: 2 },
  'one-day': { title: 'Booking moves by one day (not a month flip)', ticket: 3 },
  unplaced: { title: 'No tenant on file: cause unknown', ticket: null },
};

export const TICKET_REPO = 'https://github.com/SimplifyAll/support-kb-4471/issues';

export function problemOf(r: Report, t: Tenant | undefined, oneDayMove: readonly string[]): Problem {
  if (oneDayMove.includes(r.id)) return 'one-day';
  return causeOf(r, t) ?? 'unplaced';
}

export type ProblemGroup = {
  problem: Problem;
  reports: Report[];
  tenants: number;
  firstSeen: string;
  lastSeen: string;
  // How many of these intake tagged as something else.
  mistagged: number;
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
    const p = problemOf(r, tenantOf(r), oneDayMove);
    by.set(p, [...(by.get(p) ?? []), r]);
  }
  const groups = [...by.entries()]
    .map(([problem, rs]) => {
      const days = rs.map((r) => r.receivedAt.slice(0, 10)).sort();
      return {
        problem,
        reports: rs,
        tenants: new Set(rs.map((r) => r.tenant)).size,
        firstSeen: days[0],
        lastSeen: days[days.length - 1],
        mistagged: rs.filter((r) => r.meta.intakeTag !== problem).length,
      };
    })
    .sort((a, b) => b.reports.length - a.reports.length);
  return { exportRows: all.filter((r) => r.mergedInto === ticket).length, reports, groups };
}
