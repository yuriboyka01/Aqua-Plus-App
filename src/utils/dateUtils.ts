/**
 * Date utilities with strict Asia/Kolkata timezone calculations.
 * Consistent business date format: DD MMM YYYY (e.g., 14 Oct 2026).
 */

const TIMEZONE = 'Asia/Kolkata';

/**
 * Returns current date in Asia/Kolkata as YYYY-MM-DD string
 */
export function getTodayKolkata(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Formats a date string (YYYY-MM-DD or ISO) into DD MMM YYYY display format
 * e.g., "2026-10-15" -> "15 Oct 2026"
 */
export function formatDisplayDate(dateInput?: string | null): string {
  if (!dateInput) return '—';
  try {
    const parts = dateInput.split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(Date.UTC(year, month, day, 12, 0, 0));
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'UTC',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(d);
    }
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return dateInput;
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: TIMEZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateInput;
  }
}

/**
 * Formats full timestamp into DD MMM YYYY, hh:mm A in Asia/Kolkata
 */
export function formatDisplayDateTime(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: TIMEZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return isoString;
  }
}

/**
 * Calculates next reminder date by adding intervalDays to serviceDate (YYYY-MM-DD)
 */
export function calculateNextReminderDate(serviceDateStr: string, intervalDays: number): string {
  if (!serviceDateStr) return '';
  const parts = serviceDateStr.split('T')[0].split('-');
  if (parts.length !== 3) return serviceDateStr;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const date = new Date(Date.UTC(year, month, day, 12, 0, 0));
  date.setUTCDate(date.getUTCDate() + (Number(intervalDays) || 90));

  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Parses YYYY-MM-DD to UTC timestamp for midnight day calculations
 */
function parseDateToUtcMidnight(dateStr: string): number {
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return 0;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return Date.UTC(year, month, day);
}

/**
 * Calculates days elapsed since service date relative to today in Asia/Kolkata
 */
export function getDaysSinceDate(dateStr?: string | null): number {
  if (!dateStr) return 0;
  const targetUtc = parseDateToUtcMidnight(dateStr);
  const todayUtc = parseDateToUtcMidnight(getTodayKolkata());
  const diffMs = todayUtc - targetUtc;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculates days remaining until reminder date relative to today in Asia/Kolkata
 * Positive = upcoming, 0 = today, Negative = overdue
 */
export function getDaysUntilDate(dateStr?: string | null): number {
  if (!dateStr) return 0;
  const targetUtc = parseDateToUtcMidnight(dateStr);
  const todayUtc = parseDateToUtcMidnight(getTodayKolkata());
  const diffMs = targetUtc - todayUtc;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Categorizes a reminder status based on dates, pause flag, and dispatch history
 */
export function determineReminderStatus(
  reminderDateStr: string,
  remindersPaused = false,
  messageStatus: string = 'not_sent',
  hasManualContact = false
): 'upcoming' | 'due_today' | 'overdue' | 'paused' | 'sent' | 'failed' | 'contacted_manually' {
  if (remindersPaused) return 'paused';
  if (hasManualContact) return 'contacted_manually';
  if (messageStatus === 'sent') return 'sent';
  if (messageStatus === 'failed') return 'failed';

  const daysRemaining = getDaysUntilDate(reminderDateStr);
  if (daysRemaining > 0) return 'upcoming';
  if (daysRemaining === 0) return 'due_today';
  return 'overdue';
}
