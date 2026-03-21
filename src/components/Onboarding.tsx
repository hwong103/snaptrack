import { useState } from 'react';
import { profileUpsert } from '../services/api';

interface Props {
  onComplete: () => Promise<void>;
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

export default function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);

  // Step 1 fields
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | 'other' | ''>('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [activity, setActivity] = useState<ActivityLevel>('moderate');

  // Step 2
  const [goalKcal, setGoalKcal] = useState(2000);
  const [goalSuggested, setGoalSuggested] = useState(false);

  async function handleNext() {
    setSaving(true);
    try {
      const resp = await profileUpsert({
        display_name: displayName || null,
        age: age ? Number(age) : null,
        sex: sex || null,
        height_cm: heightCm ? Number(heightCm) : null,
        weight_kg: weightKg ? Number(weightKg) : null,
        activity_level: activity,
      });
      setGoalKcal(resp.daily_goal_kcal);
      setGoalSuggested(resp.goal_suggested);
      setStep(2);
    } catch {
      // If profile fails, still allow them to continue with defaults
      setStep(2);
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmGoal(value: number) {
    setSaving(true);
    try {
      await profileUpsert({ daily_goal_kcal: value });
      await onComplete();
    } catch {
      await onComplete();
    } finally {
      setSaving(false);
    }
  }

  if (step === 1) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-6 py-12">
        <main className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-bold text-zinc-50">Let's set you up</h2>
            <p className="text-sm text-zinc-400">All fields are optional — skip if you like</p>
          </div>

          <div className="space-y-4">
            {/* Display name */}
            <div>
              <label htmlFor="onboard-name" className="block text-xs text-zinc-400 mb-1.5 uppercase tracking-wider">Display name</label>
              <input
                id="onboard-name"
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full h-11 rounded-xl bg-zinc-900 border border-zinc-800 px-4 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
              />
            </div>

            {/* Age */}
            <div>
              <label htmlFor="onboard-age" className="block text-xs text-zinc-400 mb-1.5 uppercase tracking-wider">Age</label>
              <input
                id="onboard-age"
                type="number"
                min={10}
                max={100}
                value={age}
                onChange={e => setAge(e.target.value)}
                placeholder="25"
                className="w-full h-11 rounded-xl bg-zinc-900 border border-zinc-800 px-4 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
              />
            </div>

            {/* Sex */}
            <fieldset>
              <legend className="block text-xs text-zinc-400 mb-1.5 uppercase tracking-wider">Sex</legend>
              <div className="grid grid-cols-3 gap-2">
                {(['male', 'female', 'other'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSex(s)}
                    aria-pressed={sex === s}
                    className={`h-11 rounded-xl text-sm font-medium transition-all ${
                      sex === s
                        ? 'bg-emerald-600 text-white'
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Height & Weight row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="onboard-height" className="block text-xs text-zinc-400 mb-1.5 uppercase tracking-wider">Height (cm)</label>
                <input
                  id="onboard-height"
                  type="number"
                  value={heightCm}
                  onChange={e => setHeightCm(e.target.value)}
                  placeholder="175"
                  className="w-full h-11 rounded-xl bg-zinc-900 border border-zinc-800 px-4 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
                />
              </div>
              <div>
                <label htmlFor="onboard-weight" className="block text-xs text-zinc-400 mb-1.5 uppercase tracking-wider">Weight (kg)</label>
                <input
                  id="onboard-weight"
                  type="number"
                  value={weightKg}
                  onChange={e => setWeightKg(e.target.value)}
                  placeholder="70"
                  className="w-full h-11 rounded-xl bg-zinc-900 border border-zinc-800 px-4 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
                />
              </div>
            </div>

            {/* Activity level */}
            <fieldset>
              <legend className="block text-xs text-zinc-400 mb-1.5 uppercase tracking-wider">Activity level</legend>
              <div className="space-y-1.5">
                {ACTIVITY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setActivity(opt.value)}
                    aria-pressed={activity === opt.value}
                    className={`w-full h-11 rounded-xl text-sm font-medium text-left px-4 transition-all ${
                      activity === opt.value
                        ? 'bg-emerald-600 text-white'
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="space-y-3 pt-2">
            <button
              id="onboard-next"
              onClick={handleNext}
              disabled={saving}
              className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-40 transition-all text-white font-medium"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving…
                </span>
              ) : (
                'Next →'
              )}
            </button>
            <button
              id="onboard-skip"
              type="button"
              onClick={() => {
                setGoalKcal(2000);
                setGoalSuggested(false);
                setStep(2);
              }}
              className="w-full h-11 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Skip
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Step 2 — Goal
  return (
    <div className="min-h-dvh flex items-center justify-center px-6 py-12">
      <main className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-zinc-50">Daily calorie goal</h2>
          {goalSuggested ? (
            <p className="text-sm text-zinc-400">
              Based on your details, we suggest <span className="text-emerald-400 font-medium">{fmtKcal(goalKcal)} kcal/day</span>
            </p>
          ) : (
            <p className="text-sm text-zinc-400">Choose your daily target</p>
          )}
        </div>

        {/* Big number */}
        <div className="text-center">
          <span className="text-6xl font-bold text-zinc-50 tabular-nums">{fmtKcal(goalKcal)}</span>
          <span className="block text-zinc-400 text-sm mt-1">kcal / day</span>
        </div>

        {/* Slider */}
        <div className="px-2">
          <label htmlFor="goal-slider" className="sr-only">Daily calorie goal</label>
          <input
            id="goal-slider"
            type="range"
            min={1200}
            max={4000}
            step={50}
            value={goalKcal}
            onChange={e => setGoalKcal(Number(e.target.value))}
            className="w-full accent-emerald-500 h-2 rounded-full bg-zinc-800 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:shadow-lg"
          />
          <div className="flex justify-between text-xs text-zinc-400 mt-1">
            <span>1,200</span>
            <span>4,000</span>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <button
            id="confirm-goal"
            onClick={() => handleConfirmGoal(goalKcal)}
            disabled={saving}
            className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-40 transition-all text-white font-medium"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </span>
            ) : (
              `Confirm ${fmtKcal(goalKcal)} kcal`
            )}
          </button>
          <button
            id="use-default-goal"
            onClick={() => handleConfirmGoal(2000)}
            disabled={saving}
            className="w-full h-11 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Use 2,000 kcal
          </button>
        </div>
      </main>
    </div>
  );
}
