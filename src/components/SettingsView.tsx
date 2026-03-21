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
    <main className="min-h-dvh max-w-md mx-auto px-4 py-4 safe-top">
      {/* Header */}
      <header className="flex items-center gap-3 mb-8">
        <button
          id="settings-back"
          onClick={() => navigate('/')}
          aria-label="Back to today"
          className="w-11 h-11 rounded-xl bg-zinc-900 flex items-center justify-center hover:bg-zinc-800 active:scale-95 transition-all"
        >
          <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-zinc-50">Settings</h1>
      </header>

      {/* Goal & profile section */}
      <section className="space-y-4 mb-8">
        <h2 className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Profile & Goal</h2>

        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/50 p-5 space-y-5">
          {/* Display name */}
          <div>
            <label htmlFor="settings-name" className="block text-xs text-zinc-400 mb-1.5 uppercase tracking-wider">Display name</label>
            <input
              id="settings-name"
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full h-11 rounded-xl bg-zinc-800 border border-zinc-700 px-4 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
            />
          </div>

          {/* Daily calorie goal */}
          <div>
            <label htmlFor="settings-goal" className="block text-xs text-zinc-400 mb-1.5 uppercase tracking-wider">Daily calorie goal</label>
            <div className="flex items-center gap-3">
              <input
                id="settings-goal"
                type="range"
                min={1200}
                max={4000}
                step={50}
                value={goalKcal}
                onChange={e => setGoalKcal(Number(e.target.value))}
                className="flex-1 accent-emerald-500 h-2 rounded-full bg-zinc-800 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500"
              />
              <span className="text-sm text-zinc-200 tabular-nums min-w-20 text-right font-medium">{fmtKcal(goalKcal)} kcal</span>
            </div>
          </div>

          {/* Activity level */}
          <div>
            <label htmlFor="settings-activity" className="block text-xs text-zinc-400 mb-1.5 uppercase tracking-wider">Activity level</label>
            <select
              id="settings-activity"
              value={activity}
              onChange={e => setActivity(e.target.value as ActivityLevel)}
              className="w-full h-11 rounded-xl bg-zinc-800 border border-zinc-700 px-4 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all appearance-none cursor-pointer"
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
            className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-40 transition-all text-white font-medium"
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
      <section className="space-y-4 mb-8">
        <h2 className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Account</h2>

        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/50 p-5 space-y-4">
          {/* Email */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5 uppercase tracking-wider">Email</label>
            <p className="text-sm text-zinc-300">{user?.email ?? '—'}</p>
          </div>

          {/* Sign out */}
          <button
            id="settings-signout"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full h-12 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] disabled:opacity-40 transition-all text-red-400 font-medium"
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

      {/* Coming soon */}
      <section className="space-y-4 pointer-events-none opacity-40">
        <h2 className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Coming Soon</h2>

        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/50 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
              <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-300">Connect RunViz</p>
              <p className="text-xs text-zinc-500">Sync activity calories — Phase 2</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
