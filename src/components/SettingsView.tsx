import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { profileUpsert } from '../services/api';
import { createAuthClient } from 'better-auth/react';

const authClient = createAuthClient();

interface Props {
  onSignOut: () => Promise<void>;
}

type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Lightly active' },
  { value: 'moderate', label: 'Moderately active' },
  { value: 'active', label: 'Active' },
  { value: 'very_active', label: 'Very active' },
];

function fmtKcal(value: number): string {
  return new Intl.NumberFormat().format(value);
}

export default function SettingsView({ onSignOut }: Props) {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [goalKcal, setGoalKcal] = useState(profile?.daily_goal_kcal ?? 2000);
  const [activity, setActivity] = useState<ActivityLevel>(
    (profile?.activity_level as ActivityLevel) ?? 'moderate',
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? '');
    setGoalKcal(profile.daily_goal_kcal ?? 2000);
    setActivity((profile.activity_level as ActivityLevel) ?? 'moderate');
  }, [profile]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await profileUpsert({
        display_name: displayName || null,
        daily_goal_kcal: goalKcal,
        activity_level: activity,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
      await onSignOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <main className="min-h-dvh max-w-md mx-auto px-4 py-4 safe-top space-y-10">
      {/* Header */}
      <header className="flex items-center gap-3">
        <button
          id="settings-back"
          onClick={() => navigate('/')}
          aria-label="Back to today"
          className="surface-button-secondary w-11 h-11 rounded-xl flex items-center justify-center active:scale-95 transition-all"
        >
          <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-screen-title text-zinc-50">Settings</h1>
      </header>

      {/* Goal & profile section */}
      <section className="space-y-4">
        <h2 className="text-ui-label text-zinc-400">Profile & Goal</h2>

        <div className="surface-panel rounded-[1.75rem] p-5 space-y-6">
          {/* Display name */}
          <div>
            <label htmlFor="settings-name" className="text-ui-label block text-zinc-400 mb-1.5">Display name</label>
            <input
              id="settings-name"
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="surface-field w-full h-11 rounded-xl border px-4 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
            />
          </div>

          {/* Daily calorie goal */}
          <div>
            <label htmlFor="settings-goal" className="text-ui-label block text-zinc-400 mb-1.5">Daily calorie goal</label>
            <div className="flex items-center gap-3">
              <input
                id="settings-goal"
                type="range"
                min={1200}
                max={4000}
                step={50}
                value={goalKcal}
                onChange={e => setGoalKcal(Number(e.target.value))}
                className="flex-1 accent-emerald-500 h-2 rounded-full bg-[color:color-mix(in_oklch,var(--bg-soft)_92%,white_8%)] appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--accent-fresh)]"
              />
              <span className="text-data-small text-zinc-200 tabular-nums min-w-20 text-right">{fmtKcal(goalKcal)} kcal</span>
            </div>
          </div>

          {/* Activity level */}
          <div>
            <label htmlFor="settings-activity" className="text-ui-label block text-zinc-400 mb-1.5">Activity level</label>
            <select
              id="settings-activity"
              value={activity}
              onChange={e => setActivity(e.target.value as ActivityLevel)}
              className="surface-field w-full h-11 rounded-xl border px-4 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all appearance-none cursor-pointer"
            >
              {ACTIVITY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Save button */}
          <button
            id="settings-save"
            onClick={handleSave}
            disabled={saving || loading}
            className="bg-accent-primary w-full h-12 rounded-xl hover:brightness-110 active:scale-[0.98] disabled:opacity-40 transition-all text-slate-950 font-medium"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </span>
            ) : saved ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Saved
              </span>
            ) : (
              'Save changes'
            )}
          </button>
        </div>
      </section>

      {/* Account section */}
      <section className="space-y-4">
        <h2 className="text-ui-label text-zinc-400">Account</h2>

        <div className="surface-panel rounded-[1.75rem] p-5 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <label className="text-ui-label block text-zinc-400 mb-1.5">Email</label>
              <p className="text-data-small text-zinc-300">{user?.email ?? '—'}</p>
            </div>
            <p className="text-body-secondary text-zinc-500 text-right max-w-[14ch]">
              Signed in on this device
            </p>
          </div>

          <button
            id="settings-signout"
            onClick={handleSignOut}
            disabled={signingOut}
            className="surface-button-secondary w-full h-12 rounded-xl hover:bg-[color:color-mix(in_oklch,var(--accent-danger)_14%,var(--bg-soft)_86%)] active:scale-[0.98] disabled:opacity-40 transition-all text-[var(--accent-danger)] font-medium"
          >
            {signingOut ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-zinc-600 border-t-red-400 rounded-full animate-spin" />
                Signing out…
              </span>
            ) : (
              'Sign out'
            )}
          </button>
        </div>
      </section>
    </main>
  );
}
