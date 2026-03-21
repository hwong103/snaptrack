import { useRef, useState } from 'react';
import { profileUpsert } from '../services/api';
import { useGsapReveal } from '../hooks/useGsapReveal';

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
  const rootRef = useRef<HTMLElement>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);

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

  useGsapReveal(rootRef, [step, showMoreDetails]);

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
        <main ref={rootRef} className="w-full max-w-sm space-y-8">
          <div data-reveal className="text-center space-y-2">
            <h2 className="text-hero-title text-zinc-50">Set your daily goal</h2>
            <p className="text-ui-label">About 30 seconds</p>
            <p className="text-body-secondary text-zinc-400 max-w-[34ch] mx-auto">Start with the basics, get a calorie target, then log your first meal.</p>
          </div>

          <div data-reveal className="surface-panel rounded-[1.5rem] p-4 space-y-2">
            <p className="text-ui-label">Your starting point</p>
            <p className="text-body-secondary text-zinc-200">A suggested daily target based on your routine.</p>
            <p className="text-body-secondary text-zinc-400">You can change it anytime in Settings.</p>
          </div>

          <div data-reveal className="space-y-5">
            {/* Display name */}
            <div>
              <label htmlFor="onboard-name" className="text-ui-label block text-zinc-400 mb-1.5">Display name</label>
              <input
                id="onboard-name"
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="surface-field w-full h-11 rounded-xl border px-4 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
              />
            </div>

            {/* Activity level */}
            <fieldset>
              <legend className="text-ui-label block text-zinc-400 mb-1.5">Activity level</legend>
              <div className="grid grid-cols-2 gap-2">
                {ACTIVITY_OPTIONS.map((opt, index) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setActivity(opt.value)}
                    aria-pressed={activity === opt.value}
                    className={`h-11 rounded-xl text-data-small text-left px-4 transition-all ${index === ACTIVITY_OPTIONS.length - 1 ? 'col-span-2' : ''} ${
                      activity === opt.value
                        ? 'bg-accent-primary text-slate-950'
                        : 'surface-button-secondary text-zinc-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setShowMoreDetails(value => !value)}
                aria-expanded={showMoreDetails}
                className="text-body-secondary text-zinc-300 hover:text-zinc-100 transition-colors"
              >
                {showMoreDetails ? 'Hide extra details' : 'Add more details for a better estimate'}
              </button>

              {showMoreDetails && (
                <div data-reveal className="surface-panel rounded-[1.5rem] p-4 space-y-4">
                  <div>
                    <label htmlFor="onboard-age" className="text-ui-label block text-zinc-400 mb-1.5">Age</label>
                    <input
                      id="onboard-age"
                      type="number"
                      min={10}
                      max={100}
                      value={age}
                      onChange={e => setAge(e.target.value)}
                      placeholder="25"
                      className="surface-field w-full h-11 rounded-xl border px-4 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
                    />
                  </div>

                  <fieldset>
                    <legend className="text-ui-label block text-zinc-400 mb-1.5">Sex</legend>
                    <div className="grid grid-cols-3 gap-2">
                      {(['male', 'female', 'other'] as const).map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSex(s)}
                          aria-pressed={sex === s}
                          className={`h-11 rounded-xl text-data-small transition-all ${
                            sex === s
                              ? 'bg-accent-primary text-slate-950'
                              : 'surface-button-secondary text-zinc-300'
                          }`}
                        >
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="onboard-height" className="text-ui-label block text-zinc-400 mb-1.5">Height (cm)</label>
                      <input
                        id="onboard-height"
                        type="number"
                        value={heightCm}
                        onChange={e => setHeightCm(e.target.value)}
                        placeholder="175"
                        className="surface-field w-full h-11 rounded-xl border px-4 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
                      />
                    </div>
                    <div>
                      <label htmlFor="onboard-weight" className="text-ui-label block text-zinc-400 mb-1.5">Weight (kg)</label>
                      <input
                        id="onboard-weight"
                        type="number"
                        value={weightKg}
                        onChange={e => setWeightKg(e.target.value)}
                        placeholder="70"
                        className="surface-field w-full h-11 rounded-xl border px-4 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div data-reveal className="space-y-3 pt-1">
            <button
              id="onboard-next"
              onClick={handleNext}
              disabled={saving}
              className="bg-accent-primary pressable w-full h-12 rounded-xl hover:brightness-110 disabled:opacity-40 transition-all text-slate-950 font-medium"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving…
                </span>
              ) : (
                'See my goal'
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
              className="text-body-secondary w-full h-11 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Use the default for now
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Step 2 — Goal
  return (
    <div className="min-h-dvh flex items-center justify-center px-6 py-12">
      <main ref={rootRef} className="w-full max-w-sm space-y-8">
        <div data-reveal className="text-center space-y-2">
          <h2 className="text-hero-title text-zinc-50">Daily calorie goal</h2>
          {goalSuggested ? (
            <p className="text-body-secondary text-zinc-300 max-w-[34ch] mx-auto">
              Based on your details, we suggest <span className="text-accent-fresh font-medium">{fmtKcal(goalKcal)} kcal/day</span>
            </p>
          ) : (
            <p className="text-body-secondary text-zinc-400">Choose a starting target. You can change this anytime.</p>
          )}
        </div>

        <div data-reveal className="surface-panel rounded-[1.75rem] px-5 py-6 space-y-6">
          <div className="text-center">
            <span className="text-data-large text-zinc-50 tabular-nums">{fmtKcal(goalKcal)}</span>
            <span className="text-body-secondary block text-zinc-400 mt-1">kcal / day</span>
          </div>

          <div className="px-1">
            <label htmlFor="goal-slider" className="sr-only">Daily calorie goal</label>
            <input
              id="goal-slider"
              type="range"
              min={1200}
              max={4000}
              step={50}
              value={goalKcal}
              onChange={e => setGoalKcal(Number(e.target.value))}
              className="w-full accent-emerald-500 h-2 rounded-full bg-[color:color-mix(in_oklch,var(--bg-soft)_92%,white_8%)] appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--accent-fresh)] [&::-webkit-slider-thumb]:shadow-lg"
            />
            <div className="text-body-secondary flex justify-between text-zinc-400 mt-2">
              <span>1,200</span>
              <span>4,000</span>
            </div>
          </div>
        </div>

        <div data-reveal className="space-y-3">
          <p className="text-body-secondary text-zinc-400 text-center max-w-[32ch] mx-auto">
            Next up: log your first meal and watch today&apos;s calories update instantly.
          </p>
          <button
            id="confirm-goal"
            onClick={() => handleConfirmGoal(goalKcal)}
            disabled={saving}
            className="bg-accent-primary pressable w-full h-12 rounded-xl hover:brightness-110 disabled:opacity-40 transition-all text-slate-950 font-medium"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </span>
            ) : (
              'Start logging'
            )}
          </button>
          <button
            id="goal-back"
            onClick={() => setStep(1)}
            disabled={saving}
            className="w-full h-11 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Back
          </button>
        </div>
      </main>
    </div>
  );
}
