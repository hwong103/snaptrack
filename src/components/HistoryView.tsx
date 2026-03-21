import { useNavigate } from 'react-router-dom';
import { useHistory } from '../hooks/useHistory';

function fmtDay(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

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

  return (
    <main className="min-h-dvh max-w-md mx-auto px-4 py-4 safe-top">
      {/* Header */}
      <header className="flex items-center gap-3 mb-6">
        <button
          id="history-back"
          onClick={() => navigate('/')}
          aria-label="Back to today"
          className="w-11 h-11 rounded-xl bg-zinc-900 flex items-center justify-center hover:bg-zinc-800 active:scale-95 transition-all"
        >
          <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-zinc-50">History</h1>
      </header>

      {/* Week / Month toggle */}
      <div className="flex gap-1 bg-zinc-900 rounded-xl p-1 mb-6">
        {(['week', 'month'] as const).map(r => (
          <button
            key={r}
            id={`range-${r}`}
            onClick={() => setRange(r)}
            aria-pressed={range === r}
            className={`flex-1 h-11 rounded-lg text-sm font-medium transition-all ${
              range === r
                ? 'bg-zinc-800 text-emerald-400'
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
              {/* Bar chart */}
              <div className="relative bg-zinc-900/60 rounded-2xl border border-zinc-800/50 p-4 mb-6">
                {/* Goal line */}
                <div className="relative h-32 flex items-end gap-1">
                  <div className="absolute inset-x-0 bottom-[100%] h-px" />
                  <div className="absolute inset-x-0 top-0 border-t border-dashed border-zinc-600/40" />

                  {days.map((day, i) => {
                    const pct = goalKcal > 0 ? Math.min((day.total_kcal / goalKcal) * 100, 120) : 0;
                    const overGoal = day.total_kcal > goalKcal;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                        <div
                          className={`w-full rounded-t-md transition-all duration-500 ${
                            overGoal ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{
                            height: `${Math.max(pct * 0.83, 2)}%`,
                            minHeight: day.total_kcal > 0 ? '4px' : '0px',
                            opacity: day.total_kcal > 0 ? 1 : 0.15,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* X labels */}
                <div className="flex gap-1 mt-2">
                  {days.map((day, i) => (
                    <div key={i} className="flex-1 text-center">
                      <span className="text-[10px] text-zinc-500">{fmtDay(day.day)}</span>
                    </div>
                  ))}
                </div>

                {/* Goal label */}
                <div className="absolute top-3 right-4 text-[10px] text-zinc-400">
                  Goal: {fmtKcal(goalKcal)} kcal
                </div>
              </div>

              {/* Day list */}
              <div className="space-y-2">
                {[...days].reverse().map((day, i) => {
                  const overGoal = day.total_kcal > goalKcal;
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-xl bg-zinc-900/60 border border-zinc-800/50 px-4 py-3"
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${overGoal ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-200">{fmtDayFull(day.day)}</p>
                        <p className="text-xs text-zinc-400">{day.entry_count} {day.entry_count === 1 ? 'entry' : 'entries'}</p>
                      </div>
                      <span className="text-sm text-zinc-400 tabular-nums shrink-0">
                        {fmtKcal(day.total_kcal)} <span className="text-zinc-500">/ {fmtKcal(goalKcal)}</span> kcal
                      </span>
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
