import { useState, useEffect, useCallback } from 'react';
import { logDay } from '../services/api';
import type { DayResponse } from '../services/api';
import { getLocalTimeZone, localDayRange, todayISO } from '../lib/date';

export function useDay(date?: string) {
  const [data, setData] = useState<DayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetDate = date ?? todayISO();
  const { start, end } = localDayRange(targetDate);
  const timeZone = getLocalTimeZone();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await logDay({ date: targetDate, start, end, timeZone });
      setData(result);
    } catch {
      setError('Failed to load food log');
    } finally {
      setLoading(false);
    }
  }, [targetDate, start, end, timeZone]);

  useEffect(() => { void load(); }, [load]);

  return { data, loading, error, refresh: load, todayISO };
}
