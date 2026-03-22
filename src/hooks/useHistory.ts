import { useState, useEffect, useCallback } from 'react';
import { logHistory } from '../services/api';
import type { HistoryResponse } from '../services/api';
import { getLocalTimeZone, localRangeForHistory } from '../lib/date';

export function useHistory() {
  const [range, setRange] = useState<'week' | 'month'>('week');
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { from, to, start, end } = localRangeForHistory(range);
  const timeZone = getLocalTimeZone();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await logHistory({ from, to, start, end, timeZone }));
    } catch {
      setError('Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [from, to, start, end, timeZone]);

  useEffect(() => { void load(); }, [load]);

  return { data, loading, error, range, setRange, refresh: load };
}
