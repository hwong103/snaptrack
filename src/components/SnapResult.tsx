import { useRef, useState } from 'react';
import type { SnapResult } from '../../workers/src/snap';
import type { LogEntry } from '../services/api';
import { useModalDialog } from '../hooks/useModalDialog';

interface Props {
  result: SnapResult;
  onConfirm: (entry: Omit<LogEntry, 'id'>) => Promise<void>;
  onRetry: () => void;
  onCancel: () => void;
}

export default function SnapResultSheet({ result, onConfirm, onRetry, onCancel }: Props) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(result.name);
  const [calories, setCalories] = useState(String(result.calories));
  const [protein, setProtein] = useState(String(result.protein_g));
  const [carbs, setCarbs] = useState(String(result.carbs_g));
  const [fat, setFat] = useState(String(result.fat_g));
  const [saving, setSaving] = useState(false);
  const dialogRef = useModalDialog(true, onCancel, nameInputRef);

  async function handleLog() {
    setSaving(true);
    try {
      await onConfirm({
        logged_at: Math.floor(Date.now() / 1000),
        name,
        calories: Number(calories),
        protein_g: Number(protein),
        carbs_g: Number(carbs),
        fat_g: Number(fat),
        confidence: result.confidence,
        notes: result.notes,
        source: 'vision',
      });
    } finally {
      setSaving(false);
    }
  }

  const confidenceBadge = () => {
    if (result.confidence >= 85) return null;
    if (result.confidence >= 60) {
      return (
        <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-xs text-amber-400">Low confidence — please review</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        <span className="text-xs text-red-400">Very uncertain — edit before logging</span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close scan result"
        className="absolute inset-0 bg-black/60"
        onClick={onCancel}
      />

      {/* Sheet */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="snap-result-title"
        aria-describedby="snap-result-description"
        className="relative w-full max-w-md rounded-t-2xl bg-zinc-900 border-t border-zinc-800 px-6 pt-6 pb-8 safe-bottom space-y-5 animate-[slideUp_0.3s_ease-out]"
        tabIndex={-1}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-zinc-700 mx-auto -mt-1" />

        {/* Food name (editable) */}
        <label htmlFor="snap-name" id="snap-result-title" className="sr-only">Food name</label>
        <input
          ref={nameInputRef}
          id="snap-name"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full text-xl font-bold text-zinc-50 bg-transparent border-b border-zinc-800 pb-2 focus:outline-none focus:border-emerald-500 transition-colors"
        />

        {/* Description */}
        <p id="snap-result-description" className="text-sm text-zinc-400">{result.description}</p>

        {/* Confidence badge */}
        {confidenceBadge()}

        {/* Calories */}
        <div className="flex items-baseline gap-2">
          <label htmlFor="snap-calories" className="sr-only">Calories</label>
          <input
            id="snap-calories"
            type="number"
            value={calories}
            onChange={e => setCalories(e.target.value)}
            className="w-24 text-3xl font-bold text-zinc-50 bg-transparent border-b border-zinc-800 text-center focus:outline-none focus:border-emerald-500 transition-colors"
          />
          <span className="text-zinc-500">kcal</span>
        </div>

        {/* Macros row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label htmlFor="snap-protein" className="text-[10px] text-zinc-400 uppercase tracking-wider">Protein</label>
            <div className="flex items-baseline gap-1">
              <input
                id="snap-protein"
                type="number"
                value={protein}
                onChange={e => setProtein(e.target.value)}
                className="w-full h-9 rounded-lg bg-zinc-800 text-center text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
              />
              <span className="text-xs text-zinc-400">g</span>
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="snap-carbs" className="text-[10px] text-zinc-400 uppercase tracking-wider">Carbs</label>
            <div className="flex items-baseline gap-1">
              <input
                id="snap-carbs"
                type="number"
                value={carbs}
                onChange={e => setCarbs(e.target.value)}
                className="w-full h-9 rounded-lg bg-zinc-800 text-center text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
              />
              <span className="text-xs text-zinc-400">g</span>
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="snap-fat" className="text-[10px] text-zinc-400 uppercase tracking-wider">Fat</label>
            <div className="flex items-baseline gap-1">
              <input
                id="snap-fat"
                type="number"
                value={fat}
                onChange={e => setFat(e.target.value)}
                className="w-full h-9 rounded-lg bg-zinc-800 text-center text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
              />
              <span className="text-xs text-zinc-400">g</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {result.notes && (
          <p className="text-xs text-zinc-400 italic">{result.notes}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            id="snap-retry"
            onClick={onRetry}
            className="flex-1 h-12 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] transition-all text-zinc-300 font-medium"
          >
            Retake
          </button>
          <button
            id="snap-confirm"
            onClick={handleLog}
            disabled={saving || !name.trim() || !calories}
            className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-40 transition-all text-white font-medium"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </span>
            ) : (
              'Log it'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
