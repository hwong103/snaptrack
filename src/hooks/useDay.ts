import { useState, useEffect, useCallback } from 'react';
import { logDay } from '../services/api';
import type { DayResponse } from '../services/api';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function useDay(date?: string) {
  const [data, setData] = useState<DayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetDate = date ?? todayISO();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await logDay(targetDate);
      setData(result);
    } catch {
      setError('Failed to load food log');
    } finally {
      setLoading(false);
    }
  }, [targetDate]);

  useEffect(() => { void load(); }, [load]);

  return { data, loading, error, refresh: load, todayISO };
}
