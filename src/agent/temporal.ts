import { TemporalAnchor } from './types.js';

export interface CalendarInterval {
  startISO: string;
  endISO: string;
  label: string;
  daysAgo: number;
}

export class TemporalEngine {
  private referenceDate: Date;

  constructor(referenceDate?: Date) {
    if (referenceDate) {
      this.referenceDate = referenceDate;
    } else if (process.env.CURRENT_TIME_OVERRIDE) {
      this.referenceDate = new Date(process.env.CURRENT_TIME_OVERRIDE);
    } else {
      this.referenceDate = new Date();
    }
  }

  public getNow(): Date {
    return new Date(this.referenceDate.getTime());
  }

  public setReferenceDate(date: Date) {
    this.referenceDate = date;
  }

  public formatDateISO(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  public formatHuman(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  public getDayOfWeekName(date: Date): string {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }

  /**
   * Generates a fully calibrated relative calendar reference frame.
   * This is passed into the system prompt to anchor the LLM's temporal reasoning.
   */
  public getTemporalFrame(): {
    now: string;
    todayISO: string;
    todayHuman: string;
    calendarAnchors: Record<string, { iso: string; human: string; daysAgo: number }>;
  } {
    const now = this.getNow();
    const todayISO = this.formatDateISO(now);
    const todayHuman = this.formatHuman(now);

    const getRelative = (daysDiff: number) => {
      const d = new Date(now.getTime());
      d.setDate(d.getDate() + daysDiff);
      return {
        iso: this.formatDateISO(d),
        human: this.formatHuman(d),
        daysAgo: -daysDiff,
      };
    };

    const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday, 2 is Tuesday...

    // Exact days back to each day of week
    const daysSinceMonday = (currentDay + 6) % 7 || 7;
    const daysSinceTuesday = (currentDay + 5) % 7 || 7;
    const daysSinceWednesday = (currentDay + 4) % 7 || 7;
    const daysSinceThursday = (currentDay + 3) % 7 || 7;
    const daysSinceFriday = (currentDay + 2) % 7 || 7;

    return {
      now: now.toISOString(),
      todayISO,
      todayHuman,
      calendarAnchors: {
        today: { iso: todayISO, human: todayHuman, daysAgo: 0 },
        yesterday: getRelative(-1),
        'this monday': getRelative(-daysSinceMonday),
        'last monday': getRelative(-(daysSinceMonday === 7 ? 14 : daysSinceMonday + 7)),
        'last tuesday': getRelative(-daysSinceTuesday),
        'last wednesday': getRelative(-daysSinceWednesday),
        'last thursday': getRelative(-daysSinceThursday),
        'last friday': getRelative(-daysSinceFriday),
        '1 week ago': getRelative(-7),
        '2 weeks ago': getRelative(-14),
        '1 month ago': getRelative(-30),
      },
    };
  }

  /**
   * Parses natural language queries for temporal expressions and grounds them to exact calendar dates.
   * Handles:
   * - "Monday" / "on Monday" / "last Monday"
   * - "3 November" / "November 3" / "Nov 3"
   * - "Last Tuesday" / "Tuesday"
   * - "yesterday", "last week", "since then"
   */
  public parseTemporalExpression(text: string): TemporalAnchor | null {
    const lower = text.toLowerCase();
    const now = this.getNow();
    const currentYear = now.getFullYear();

    // 1. Explicit calendar date: e.g. "3 November", "November 3", "Nov 3", "3rd of November"
    const monthRegex = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{4}))?\b/i;
    const monthFirstRegex = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/i;

    let match = lower.match(monthRegex);
    if (match) {
      const day = parseInt(match[1], 10);
      const monthStr = match[2];
      const year = match[3] ? parseInt(match[3], 10) : currentYear;
      const monthIndex = this.monthStringToNumber(monthStr);

      const target = new Date(year, monthIndex, day, 12, 0, 0);
      const daysDiff = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        expression: match[0],
        anchorDate: this.formatDateISO(target),
        dayOfWeek: this.getDayOfWeekName(target),
        relativeDays: daysDiff,
        isPastReference: daysDiff <= 0,
        searchFilterAfter: this.formatDateISO(target),
      };
    }

    match = lower.match(monthFirstRegex);
    if (match) {
      const monthStr = match[1];
      const day = parseInt(match[2], 10);
      const year = match[3] ? parseInt(match[3], 10) : currentYear;
      const monthIndex = this.monthStringToNumber(monthStr);

      const target = new Date(year, monthIndex, day, 12, 0, 0);
      const daysDiff = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        expression: match[0],
        anchorDate: this.formatDateISO(target),
        dayOfWeek: this.getDayOfWeekName(target),
        relativeDays: daysDiff,
        isPastReference: daysDiff <= 0,
        searchFilterAfter: this.formatDateISO(target),
      };
    }

    // 2. Relative day of week: "last Tuesday", "on Monday", "this Monday"
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dowRegex = /\b(last|this|past|on)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
    const dowMatch = lower.match(dowRegex);

    if (dowMatch) {
      const modifier = (dowMatch[1] || '').trim().toLowerCase();
      const dayName = dowMatch[2].toLowerCase();
      const targetDayIndex = daysOfWeek.indexOf(dayName);
      const currentDayIndex = now.getDay();

      let daysBack = (currentDayIndex - targetDayIndex + 7) % 7;
      if (daysBack === 0) {
        if (modifier === 'last' || modifier === 'past') {
          daysBack = 7;
        }
      } else if (modifier === 'last' && daysBack < 7) {
        if (currentDayIndex <= targetDayIndex) {
          // already previous week
        } else if (modifier === 'last') {
          // targeted previous occurrence
        }
      }

      const target = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

      return {
        expression: dowMatch[0].trim(),
        anchorDate: this.formatDateISO(target),
        dayOfWeek: this.getDayOfWeekName(target),
        relativeDays: -daysBack,
        isPastReference: true,
        searchFilterAfter: this.formatDateISO(target),
      };
    }

    // 3. Yesterday
    if (/\byesterday\b/i.test(lower)) {
      const target = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return {
        expression: 'yesterday',
        anchorDate: this.formatDateISO(target),
        dayOfWeek: this.getDayOfWeekName(target),
        relativeDays: -1,
        isPastReference: true,
        searchFilterAfter: this.formatDateISO(target),
      };
    }

    // 4. Last week
    if (/\blast week\b/i.test(lower)) {
      const target = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return {
        expression: 'last week',
        anchorDate: this.formatDateISO(target),
        dayOfWeek: this.getDayOfWeekName(target),
        relativeDays: -7,
        isPastReference: true,
        searchFilterAfter: this.formatDateISO(target),
      };
    }

    // 5. "Since then" / "since"
    if (/\bsince then\b|\bsince\b/i.test(lower)) {
      const target = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return {
        expression: 'since then',
        anchorDate: this.formatDateISO(target),
        dayOfWeek: 'Past',
        relativeDays: -7,
        isPastReference: true,
        searchFilterAfter: this.formatDateISO(target),
      };
    }

    return null;
  }

  private monthStringToNumber(m: string): number {
    const months: Record<string, number> = {
      jan: 0, january: 0,
      feb: 1, february: 1,
      mar: 2, march: 2,
      apr: 3, april: 3,
      may: 4,
      jun: 5, june: 5,
      jul: 6, july: 6,
      aug: 7, august: 7,
      sep: 8, september: 8,
      oct: 9, october: 9,
      nov: 10, november: 10,
      dec: 11, december: 11,
    };
    return months[m.toLowerCase().slice(0, 3)] ?? 0;
  }
}

export const defaultTemporalEngine = new TemporalEngine();
