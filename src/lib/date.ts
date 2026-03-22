export function todayISO(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function getLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function localDayRange(dateISO: string): { start: number; end: number } {
  const start = new Date(`${dateISO}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
  };
}

export function localRangeForHistory(range: 'week' | 'month', now = new Date()): {
  from: string;
  to: string;
  start: number;
  end: number;
} {
  const toDate = new Date(now);
  const fromDate = new Date(now);

  fromDate.setDate(now.getDate() - (range === 'week' ? 6 : 29));

  const from = todayISO(fromDate);
  const to = todayISO(toDate);
  const start = localDayRange(from).start;
  const end = localDayRange(to).end;

  return { from, to, start, end };
}
