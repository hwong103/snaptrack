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
    <main className="min-h-dvh">
      <div className="app-shell screen-stack py-4 safe-top">
        <header className="screen-header">
          <button
            id="history-back"
            onClick={() => navigate('/')}
            aria-label="Back to today"
            className="surface-button-secondary h-11 w-11 rounded-xl flex items-center justify-center active:scale-95 transition-all"
          >
            <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="section-heading-copy">
            <p className="text-ui-label">Review</p>
            <h1 className="text-screen-title text-zinc-50">History</h1>
          </div>
        </header>

        <section className="section-stack">
          <div className="section-heading">
            <div className="section-heading-copy">
              <p className="text-ui-label">Range</p>
              <p className="text-body-secondary text-zinc-400">Check your recent intake trends.</p>
            </div>
          </div>

          <div className="surface-panel flex gap-1 rounded-[1.25rem] p-1">
            {(['week', 'month'] as const).map(r => (
              <button
                key={r}
                id={`range-${r}`}
                onClick={() => setRange(r)}
                aria-pressed={range === r}
                className={`flex-1 h-11 rounded-xl text-data-small transition-all ${
                  range === r
                    ? 'bg-[color:color-mix(in_oklch,var(--accent-fresh)_16%,var(--bg-soft)_84%)] text-[var(--accent-fresh)]'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {r === 'week' ? '7 days' : '30 days'}
              </button>
            ))}
          </div>
        </section>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-4 border-zinc-800 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="surface-panel rounded-[1.5rem] px-5 py-8 text-center">
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={refresh} className="mt-3 text-sm text-emerald-400 hover:underline">Retry</button>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {days.length === 0 ? (
              <section className="surface-panel rounded-[2rem] px-5 py-8 text-left">
                <div className="section-stack">
                  <div className="section-heading-copy">
                    <p className="text-ui-label">No history yet</p>
                    <p className="text-screen-title text-zinc-100">No food logged in this period</p>
                    <p className="max-w-[30ch] text-body-secondary text-zinc-400">
                      Start by snapping a meal so this screen can show your recent intake pattern.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="bg-accent-primary pressable h-12 rounded-xl px-4 text-slate-950 font-medium transition-all hover:brightness-110"
                  >
                    Back to today
                  </button>
                </div>
              </section>
            ) : (
              <>
                <section className="section-stack">
                  <div className="section-heading">
                    <div className="section-heading-copy">
                      <p className="text-ui-label">Highlights</p>
                      <p className="text-body-secondary text-zinc-400">A quick read on the current range.</p>
                    </div>
                  </div>

                  <div className="summary-grid">
                    <div className="surface-panel rounded-[1.75rem] px-5 py-5">
                      <p className="text-ui-label">Average</p>
                      <p className="mt-3 text-screen-title text-zinc-100">{fmtKcal(averageKcal)} kcal</p>
                      <p className="mt-1 text-body-secondary text-zinc-400">Per logged day</p>
                    </div>
                    <div className="surface-panel rounded-[1.75rem] px-5 py-5">
                      <p className="text-ui-label">Over goal</p>
                      <p className="mt-3 text-screen-title text-zinc-100">{overGoalDays} {overGoalDays === 1 ? 'day' : 'days'}</p>
                      <p className="mt-1 text-body-secondary text-zinc-400">Compared with {fmtKcal(goalKcal)} kcal</p>
                    </div>
                  </div>
                </section>

                <section className="section-stack">
                  <div className="section-heading">
                    <div className="section-heading-copy">
                      <p className="text-ui-label">Day by day</p>
                      <p className="text-body-secondary text-zinc-400">{days.length} {days.length === 1 ? 'day' : 'days'} in view</p>
                    </div>
                  </div>

                  <div className="surface-panel surface-list rounded-[2rem] px-4 py-2 sm:px-5">
                    {[...days].reverse().map((day, i) => {
                      const overGoal = day.total_kcal > goalKcal;
                      return (
                        <div
                          key={i}
                          className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-3"
                        >
                          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${overGoal ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                          <div className="min-w-0">
                            <p className="text-data-small text-zinc-200">{fmtDayFull(day.day)}</p>
                            <p className="text-body-secondary text-zinc-400">{day.entry_count} {day.entry_count === 1 ? 'entry' : 'entries'}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-data-small tabular-nums text-zinc-200">{fmtKcal(day.total_kcal)} kcal</p>
                            <p className="text-body-secondary text-zinc-500">{overGoal ? 'Over goal' : 'On track'}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
