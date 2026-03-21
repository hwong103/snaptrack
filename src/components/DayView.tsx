import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDay } from '../hooks/useDay';
import { logCreate, logDelete, logPatch } from '../services/api';
import type { LogEntry } from '../services/api';
import type { SnapResult } from '../../workers/src/snap';
import CameraCapture from './CameraCapture';
import SnapResultSheet from './SnapResult';
import ManualEntry from './ManualEntry';
import { useModalDialog } from '../hooks/useModalDialog';
import { useGsapOverlay } from '../hooks/useGsapOverlay';
import { useGsapReveal } from '../hooks/useGsapReveal';

// Helpers
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtKcal(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function stepDate(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Sheet types
type Sheet =
  | null
  | 'camera'
  | 'gallery'
  | { type: 'snap'; result: SnapResult }
  | 'manual'
  | { type: 'edit'; entry: LogEntry };

export default function DayView() {
  const rootRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const { data, loading, error, refresh } = useDay(selectedDate);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Edit state
  const [editName, setEditName] = useState('');
  const [editCalories, setEditCalories] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const editNameInputRef = useRef<HTMLInputElement>(null);
  const editBackdropRef = useRef<HTMLButtonElement>(null);

  // Computed
  const logs = data?.logs ?? [];
  const totalKcal = data?.total_kcal ?? 0;
  const goalKcal = data?.goal_kcal ?? 2000;
  const remainingKcal = data?.remaining_kcal ?? goalKcal;
  const isOver = remainingKcal < 0;
  const pct = goalKcal > 0 ? totalKcal / goalKcal : 0;
  const entryLabel = `${logs.length} ${logs.length === 1 ? 'meal' : 'meals'}`;
  const isToday = selectedDate === todayISO();

  const protein = logs.reduce((s, l) => s + (l.protein_g ?? 0), 0);
  const carbs = logs.reduce((s, l) => s + (l.carbs_g ?? 0), 0);
  const fat = logs.reduce((s, l) => s + (l.fat_g ?? 0), 0);

  // Ring math
  const circumference = 2 * Math.PI * 50;
  const strokePct = Math.min(pct, 1);
  const dashOffset = circumference * (1 - strokePct);
  const ringColor = isOver ? '#ef4444' : pct > 0.9 ? '#f59e0b' : '#10b981';

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await logDelete(id);
      await refresh();
    } finally {
      setDeletingId(null);
    }
  }

  function openEdit(entry: LogEntry) {
    setEditName(entry.name);
    setEditCalories(String(entry.calories));
    setSheet({ type: 'edit', entry });
  }

  async function handleEditSave(id: string) {
    setEditSaving(true);
    try {
      await logPatch(id, {
        name: editName,
        calories: Number(editCalories),
      });
      await refresh();
      setSheet(null);
    } finally {
      setEditSaving(false);
    }
  }

  const closeEditSheet = useCallback(() => setSheet(null), []);
  const editDialogRef = useModalDialog(
    sheet !== null && typeof sheet === 'object' && sheet.type === 'edit',
    closeEditSheet,
    editNameInputRef,
  );

  useGsapReveal(rootRef, [selectedDate, loading, logs.length]);
  useGsapOverlay(
    sheet !== null && typeof sheet === 'object' && sheet.type === 'edit',
    editBackdropRef,
    editDialogRef,
  );

  return (
    <main ref={rootRef} className="min-h-dvh pb-[calc(env(safe-area-inset-bottom)+9rem)]">
      <div className="app-shell screen-stack pt-3 safe-top">
        <header className="screen-header justify-between">
          <button
            id="day-prev"
            onClick={() => setSelectedDate(d => stepDate(d, -1))}
            aria-label="Previous day"
            className="surface-button-secondary h-11 w-11 rounded-xl flex items-center justify-center active:scale-95 transition-all"
          >
            <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>

          <button
            id="day-today"
            onClick={() => setSelectedDate(todayISO())}
            className="min-w-0 flex-1 px-3 text-center transition-colors hover:text-[var(--accent-fresh)]"
          >
            <span className="text-ui-label block">{isToday ? 'Today' : 'Daily view'}</span>
            <span className="text-data-small block truncate text-zinc-100">{fmtDate(selectedDate)}</span>
          </button>

          <button
            id="day-next"
            onClick={() => setSelectedDate(d => stepDate(d, 1))}
            aria-label="Next day"
            className="surface-button-secondary h-11 w-11 rounded-xl flex items-center justify-center active:scale-95 transition-all"
          >
            <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </header>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-4 border-zinc-800 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="surface-panel rounded-[1.5rem] px-5 py-8 text-center">
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={refresh} className="mt-3 text-sm text-emerald-500 hover:underline">Retry</button>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-[1.25rem] bg-[color:color-mix(in_oklch,var(--accent-danger)_16%,transparent)] px-4 py-3 text-sm text-[color:color-mix(in_oklch,var(--accent-danger)_75%,white_25%)]">
            <div className="flex items-start justify-between gap-3">
              <p>{errorMsg}</p>
              <button
                onClick={() => setErrorMsg(null)}
                aria-label="Dismiss error message"
                className="shrink-0 text-red-300 hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {!loading && !error && data && (
          <>
            <section data-reveal className="surface-panel rounded-[2rem] px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-ui-label">Daily balance</p>
                  <p className="text-data-small text-zinc-200">{entryLabel}</p>
                </div>
                <span className="inline-chip bg-[color:color-mix(in_oklch,var(--bg-soft)_76%,black_24%)] text-zinc-300">
                  {Math.round(Math.min(pct, 1) * 100)}% of goal
                </span>
              </div>

              <div className="mt-5 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
                <div className="mx-auto sm:mx-0">
                  <svg viewBox="0 0 120 120" className="h-32 w-32">
                    <circle cx={60} cy={60} r={50} fill="none" stroke="color-mix(in oklch, var(--bg-soft) 86%, white 14%)" strokeWidth={10} />
                    <circle
                      cx={60}
                      cy={60}
                      r={50}
                      fill="none"
                      stroke={ringColor}
                      strokeWidth={10}
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={dashOffset}
                      transform="rotate(-90 60 60)"
                      className="transition-all duration-700 ease-out"
                    />
                    <text x={60} y={55} textAnchor="middle" className="fill-zinc-50 text-2xl font-bold" style={{ fontSize: '24px', fontWeight: 700 }}>
                      {fmtKcal(totalKcal)}
                    </text>
                    <text x={60} y={72} textAnchor="middle" className="fill-[var(--text-secondary-color)]" style={{ fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      kcal
                    </text>
                  </svg>
                </div>

                <div className="space-y-4 text-center sm:text-left">
                  <div className="space-y-1">
                    <p className={`text-screen-title ${isOver ? 'text-[var(--accent-danger)]' : 'text-zinc-50'}`}>
                      {isOver
                        ? `${fmtKcal(Math.abs(remainingKcal))} over`
                        : `${fmtKcal(remainingKcal)} left`}
                    </p>
                    <p className="text-body-secondary text-zinc-400">
                      Goal {fmtKcal(goalKcal)} kcal for the day
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                    <span className="inline-chip macro-protein">{Math.round(protein)}g protein</span>
                    <span className="inline-chip macro-carbs">{Math.round(carbs)}g carbs</span>
                    <span className="inline-chip macro-fat">{Math.round(fat)}g fat</span>
                  </div>
                </div>
              </div>
            </section>

            {logs.length === 0 ? (
              <section data-reveal className="surface-panel rounded-[2rem] px-5 py-6 text-left sm:px-6">
                <div className="section-stack">
                  <div className="section-heading-copy">
                    <div data-reveal-float className="surface-button-secondary flex h-14 w-14 items-center justify-center rounded-2xl">
                      <svg className="w-7 h-7 text-accent-warm" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                      </svg>
                    </div>
                    <div className="space-y-2">
                      <p className="text-ui-label">First log</p>
                      <p className="text-screen-title text-zinc-100">Nothing logged yet</p>
                      <p className="max-w-[32ch] text-body-secondary text-zinc-400">
                        Snap a meal to estimate calories in seconds, or start with a quick manual entry.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[1.2fr_0.8fr_0.8fr]">
                    <button
                      type="button"
                      onClick={() => setSheet('camera')}
                      className="bg-accent-primary pressable h-12 rounded-xl px-4 text-slate-950 font-medium transition-all hover:brightness-110"
                    >
                      Snap a meal
                    </button>
                    <button
                      type="button"
                      onClick={() => setSheet('gallery')}
                      className="surface-button-secondary pressable h-11 rounded-xl px-4 text-zinc-100 font-medium transition-all"
                    >
                      Upload photo
                    </button>
                    <button
                      type="button"
                      onClick={() => setSheet('manual')}
                      className="surface-button-secondary pressable h-11 rounded-xl px-4 text-zinc-100 font-medium transition-all"
                    >
                      Add manually
                    </button>
                  </div>
                </div>
              </section>
            ) : (
              <section className="section-stack">
                <div data-reveal className="section-heading px-1">
                  <div className="section-heading-copy">
                    <p className="text-ui-label">Meals</p>
                    <p className="text-data-small text-zinc-100">{entryLabel}</p>
                  </div>
                  <p className="max-w-[16ch] text-right text-body-secondary text-zinc-500">Tap a meal to edit</p>
                </div>

                <div data-reveal-stagger className="surface-panel surface-list rounded-[2rem] px-4 py-2 sm:px-5">
                  {logs.map((entry) => (
                    <div
                      key={entry.id}
                      data-reveal-item
                      className="grid grid-cols-[1fr_auto] items-center gap-3 py-3"
                    >
                      <button
                        id={`edit-${entry.id}`}
                        onClick={() => openEdit(entry)}
                        className="min-w-0 rounded-xl px-1 py-2 text-left transition-colors hover:bg-[color:color-mix(in_oklch,var(--bg-elevated)_84%,var(--accent-fresh)_16%)]"
                      >
                        <p className="truncate text-data-small text-zinc-100">{entry.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <p className="text-body-secondary text-zinc-400">{fmtTime(entry.logged_at)}</p>
                          {entry.source === 'vision' && (
                            <span className="text-ui-label text-accent-fresh bg-[color:color-mix(in_oklch,var(--accent-fresh)_14%,transparent)] rounded px-1.5 py-0.5">
                              Scan
                            </span>
                          )}
                        </div>
                      </button>

                      <div className="flex items-center gap-2">
                        <span className="text-data-small tabular-nums text-zinc-300">{fmtKcal(entry.calories)} kcal</span>
                        <button
                          id={`delete-${entry.id}`}
                          onClick={() => handleDelete(entry.id)}
                          aria-label={`Delete ${entry.name}`}
                          disabled={deletingId === entry.id}
                          className="flex h-11 w-11 items-center justify-center rounded-xl text-zinc-500 transition-all hover:bg-red-500/10 hover:text-red-300"
                        >
                          {deletingId === entry.id ? (
                            <span className="w-3 h-3 border-2 border-zinc-600 border-t-red-400 rounded-full animate-spin" />
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Bottom action bar */}
      <nav data-reveal className="fixed bottom-0 left-0 right-0 px-3 pb-3 safe-bottom">
        <div className="app-shell">
          <div className="surface-nav grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-[2rem] px-3 py-3">
            <div className="flex items-center gap-2">
              <button
                id="nav-history"
                onClick={() => navigate('/history')}
                aria-label="View history"
                className="surface-button-secondary pressable h-11 w-11 rounded-xl flex items-center justify-center text-zinc-400 transition-all hover:text-zinc-100"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </button>
              <button
                id="nav-gallery"
                onClick={() => setSheet('gallery')}
                aria-label="Upload photo from gallery"
                className="surface-button-secondary pressable h-11 w-11 rounded-xl flex items-center justify-center text-zinc-400 transition-all hover:text-zinc-100"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6.75a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6.75v12.75a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </button>
            </div>

            <button
              id="nav-camera"
              onClick={() => setSheet('camera')}
              aria-label="Capture food photo"
              className="bg-accent-primary pressable flex h-16 w-16 items-center justify-center rounded-full shadow-lg shadow-emerald-950/40 transition-all hover:brightness-110"
            >
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            </button>

            <div className="flex items-center justify-end gap-2">
              <button
                id="nav-manual"
                onClick={() => setSheet('manual')}
                aria-label="Add food manually"
                className="surface-button-secondary pressable h-11 w-11 rounded-xl flex items-center justify-center text-zinc-400 transition-all hover:text-zinc-100"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
              <button
                id="nav-settings"
                onClick={() => navigate('/settings')}
                aria-label="Open settings"
                className="surface-button-secondary pressable h-11 w-11 rounded-xl flex items-center justify-center text-zinc-400 transition-all hover:text-zinc-100"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Sheets */}
      {sheet === 'camera' && (
        <CameraCapture
          onResult={(r) => setSheet({ type: 'snap', result: r })}
          onError={setErrorMsg}
          onCancel={() => setSheet(null)}
        />
      )}

      {sheet === 'gallery' && (
        <CameraCapture
          useGallery
          onResult={(r) => setSheet({ type: 'snap', result: r })}
          onError={setErrorMsg}
          onCancel={() => setSheet(null)}
        />
      )}

      {sheet && typeof sheet === 'object' && sheet.type === 'snap' && (
        <SnapResultSheet
          result={sheet.result}
          onConfirm={async (entry) => {
            await logCreate(entry);
            await refresh();
            setSheet(null);
          }}
          onRetry={() => setSheet('camera')}
          onCancel={() => setSheet(null)}
        />
      )}

      {sheet === 'manual' && (
        <ManualEntry
          onConfirm={async (entry) => {
            await logCreate(entry);
            await refresh();
            setSheet(null);
          }}
          onCancel={() => setSheet(null)}
        />
      )}

      {sheet && typeof sheet === 'object' && sheet.type === 'edit' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            ref={editBackdropRef}
            type="button"
            aria-label="Close edit entry"
            className="absolute inset-0 bg-black/60"
            onClick={() => setSheet(null)}
          />
          <div
            ref={editDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-entry-title"
            className="surface-panel relative w-full max-w-md rounded-t-2xl px-6 pt-6 pb-8 safe-bottom space-y-4"
            tabIndex={-1}
          >
            <div className="w-10 h-1 rounded-full bg-zinc-700 mx-auto -mt-1" />
            <h3 id="edit-entry-title" className="text-screen-title text-zinc-50">Edit entry</h3>
            <div>
              <label htmlFor="edit-name" className="text-ui-label block text-zinc-400 mb-1.5">Name</label>
              <input
                ref={editNameInputRef}
                id="edit-name"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="surface-field w-full h-11 rounded-xl border px-4 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
              />
            </div>
            <div>
              <label htmlFor="edit-calories" className="text-ui-label block text-zinc-400 mb-1.5">Calories</label>
              <input
                id="edit-calories"
                type="number"
                value={editCalories}
                onChange={e => setEditCalories(e.target.value)}
                className="surface-field w-full h-11 rounded-xl border px-4 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                id="edit-cancel"
                onClick={() => setSheet(null)}
                className="surface-button-secondary pressable flex-1 h-12 rounded-xl transition-all text-zinc-100 font-medium"
              >
                Cancel
              </button>
              <button
                id="edit-save"
                onClick={() => handleEditSave(sheet.entry.id)}
                disabled={editSaving}
                className="bg-accent-primary pressable flex-1 h-12 rounded-xl hover:brightness-110 disabled:opacity-40 transition-all text-slate-950 font-medium"
              >
                {editSaving ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </span>
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
