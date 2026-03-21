import { useNavigate } from 'react-router-dom';
import { useHistory } from '../hooks/useHistory';

function fmtDayFull(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function fmtKcal(value: number): string {
  return new Intl.NumberFormat().format(value);
}

export default function HistoryView() {
  const navigate = useNavigate();
  const { data, loading, error, range, setRange, refresh } = useHistory();

  const goalKcal = data?.goal_kcal ?? 2000;
  const days = data?.days ?? [];
  const daysWithEntries = days.filter(day => day.entry_count > 0);
  const averageKcal = daysWithEntries.length > 0
    ? Math.round(daysWithEntries.reduce((sum, day) => sum + day.total_kcal, 0) / daysWithEntries.length)
    : 0;
  const overGoalDays = daysWithEntries.filter(day => day.total_kcal > goalKcal).length;

  return (
    <main className="min-h-dvh max-w-md mx-auto px-4 py-4 safe-top">
      {/* Header */}
      <header className="flex items-center gap-3 mb-8">
        <button
          id="history-back"
          onClick={() => navigate('/')}
          aria-label="Back to today"
          className="surface-button-secondary w-11 h-11 rounded-xl flex items-center justify-center active:scale-95 transition-all"
        >
          <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-screen-title text-zinc-50">History</h1>
      </header>

      {/* Week / Month toggle */}
      <div className="surface-panel flex gap-1 rounded-xl p-1 mb-8">
        {(['week', 'month'] as const).map(r => (
          <button
            key={r}
            id={`range-${r}`}
            onClick={() => setRange(r)}
            aria-pressed={range === r}
            className={`flex-1 h-11 rounded-lg text-data-small transition-all ${
              range === r
                ? 'bg-[color:color-mix(in_oklch,var(--accent-fresh)_16%,var(--bg-soft)_84%)] text-[var(--accent-fresh)]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {r === 'week' ? '7 days' : '30 days'}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="w-10 h-10 border-4 border-zinc-800 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="text-center py-24">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={refresh} className="text-sm text-emerald-400 mt-2 hover:underline">Retry</button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {days.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <p className="text-zinc-400">No food logged in this period</p>
              <p className="text-zinc-600 text-sm">Start by snapping a photo</p>
            </div>
          ) : (
            <>
              <div className="surface-panel rounded-[1.75rem] px-4 py-4 mb-8 flex items-center justify-between gap-6">
                <div>
                  <p className="text-ui-label">Average</p>
                  <p className="text-data-small text-zinc-100">{fmtKcal(averageKcal)} kcal/day</p>
                </div>
                <div className="text-right">
                  <p className="text-ui-label">Over goal</p>
                  <p className="text-data-small text-zinc-100">{overGoalDays} {overGoalDays === 1 ? 'day' : 'days'}</p>
                </div>
              </div>

              {/* Day list */}
              <div className="space-y-3">
                {[...days].reverse().map((day, i) => {
                  const overGoal = day.total_kcal > goalKcal;
                  return (
                    <div
                      key={i}
                      className="surface-panel flex items-center gap-4 rounded-[1.5rem] px-4 py-3.5"
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${overGoal ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-data-small text-zinc-200">{fmtDayFull(day.day)}</p>
                        <p className="text-body-secondary text-zinc-400">{day.entry_count} {day.entry_count === 1 ? 'entry' : 'entries'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-data-small text-zinc-200 tabular-nums">{fmtKcal(day.total_kcal)} kcal</p>
                        <p className="text-body-secondary text-zinc-500">Goal {fmtKcal(goalKcal)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
