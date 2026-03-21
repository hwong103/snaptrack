import { useRef, useState } from 'react';
import type { LogEntry } from '../services/api';
import { useModalDialog } from '../hooks/useModalDialog';

interface Props {
  onConfirm: (entry: Omit<LogEntry, 'id'>) => Promise<void>;
  onCancel: () => void;
}

export default function ManualEntry({ onConfirm, onCancel }: Props) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; calories?: string }>({});
  const dialogRef = useModalDialog(true, onCancel, nameInputRef);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: typeof errors = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!calories.trim() || isNaN(Number(calories)) || Number(calories) <= 0) {
      newErrors.calories = 'Valid calorie amount required';
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onConfirm({
        logged_at: Math.floor(Date.now() / 1000),
        name: name.trim(),
        calories: Number(calories),
        protein_g: protein ? Number(protein) : null,
        carbs_g: carbs ? Number(carbs) : null,
        fat_g: fat ? Number(fat) : null,
        confidence: null,
        notes: null,
        source: 'manual',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close add food manually"
        className="absolute inset-0 bg-black/60"
        onClick={onCancel}
      />

      {/* Sheet */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-entry-title"
        className="relative w-full max-w-md rounded-t-2xl bg-zinc-900 border-t border-zinc-800 px-6 pt-6 pb-8 safe-bottom space-y-5 animate-[slideUp_0.3s_ease-out]"
        tabIndex={-1}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-zinc-700 mx-auto -mt-1" />

        <h3 id="manual-entry-title" className="text-lg font-bold text-zinc-50">Add food manually</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="manual-name" className="block text-xs text-zinc-400 mb-1.5 uppercase tracking-wider">Food name *</label>
            <input
              ref={nameInputRef}
              id="manual-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Chicken salad"
              className={`w-full h-11 rounded-xl bg-zinc-800 border px-4 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all ${
                errors.name ? 'border-red-500' : 'border-zinc-700'
              }`}
            />
            {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
          </div>

          {/* Calories */}
          <div>
            <label htmlFor="manual-calories" className="block text-xs text-zinc-400 mb-1.5 uppercase tracking-wider">Calories *</label>
            <input
              id="manual-calories"
              type="number"
              value={calories}
              onChange={e => setCalories(e.target.value)}
              placeholder="350"
              className={`w-full h-11 rounded-xl bg-zinc-800 border px-4 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all ${
                errors.calories ? 'border-red-500' : 'border-zinc-700'
              }`}
            />
            {errors.calories && <p className="text-xs text-red-400 mt-1">{errors.calories}</p>}
          </div>

          {/* Macros */}
          <div>
            <p className="block text-xs text-zinc-400 mb-1.5 uppercase tracking-wider">Macros (optional)</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="manual-protein" className="sr-only">Protein grams</label>
                <input
                  id="manual-protein"
                  type="number"
                  value={protein}
                  onChange={e => setProtein(e.target.value)}
                  placeholder="Protein g"
                  className="w-full h-11 rounded-xl bg-zinc-800 border border-zinc-700 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
                />
              </div>
              <div>
                <label htmlFor="manual-carbs" className="sr-only">Carbohydrate grams</label>
                <input
                  id="manual-carbs"
                  type="number"
                  value={carbs}
                  onChange={e => setCarbs(e.target.value)}
                  placeholder="Carbs g"
                  className="w-full h-11 rounded-xl bg-zinc-800 border border-zinc-700 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
                />
              </div>
              <div>
                <label htmlFor="manual-fat" className="sr-only">Fat grams</label>
                <input
                  id="manual-fat"
                  type="number"
                  value={fat}
                  onChange={e => setFat(e.target.value)}
                  placeholder="Fat g"
                  className="w-full h-11 rounded-xl bg-zinc-800 border border-zinc-700 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              id="manual-cancel"
              onClick={onCancel}
              className="flex-1 h-12 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] transition-all text-zinc-300 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="manual-submit"
              disabled={saving}
              className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-40 transition-all text-white font-medium"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </span>
              ) : (
                'Log'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
