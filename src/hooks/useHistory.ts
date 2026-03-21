import { useState, useEffect, useCallback } from 'react';
import { logHistory } from '../services/api';
import type { HistoryResponse } from '../services/api';

export function useHistory() {
  const [range, setRange] = useState<'week' | 'month'>('week');
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function getRangeDates(r: 'week' | 'month'): { from: string; to: string } {
    const today = new Date();
    const to = today.toISOString().split('T')[0]!;
    const from = new Date(today);
    if (r === 'week') from.setDate(today.getDate() - 6);
    else from.setDate(today.getDate() - 29);
    return { from: from.toISOString().split('T')[0]!, to };
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = getRangeDates(range);
      setData(await logHistory(from, to));
    } catch {
      setError('Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { void load(); }, [load]);

  return { data, loading, error, range, setRange, refresh: load };
}
