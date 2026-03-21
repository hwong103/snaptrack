import { useRef, useState, useEffect } from 'react';
import { compressImage } from '../services/compressImage';
import { snap } from '../services/api';
import type { SnapResult } from '../../workers/src/snap';
import { useModalDialog } from '../hooks/useModalDialog';

interface Props {
  onResult: (result: SnapResult) => void;
  onError: (msg: string) => void;
  onCancel: () => void;
}

export default function CameraCapture({ onResult, onError, onCancel }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const [analysing, setAnalysing] = useState(false);
  const [errorState, setErrorState] = useState<'no_food' | 'failed' | null>(null);
  const dialogRef = useModalDialog(true, onCancel, cancelButtonRef);

  useEffect(() => {
    inputRef.current?.click();
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      onCancel();
      return;
    }
    setAnalysing(true);
    setErrorState(null);
    try {
      const { base64, mimeType } = await compressImage(file);
      const result = await snap(base64, mimeType);
      onResult(result);
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error;
      if (msg === 'no_food_detected') {
        setErrorState('no_food');
      } else {
        setErrorState('failed');
        onError(msg ?? 'Analysis failed');
      }
    } finally {
      setAnalysing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function retry() {
    setErrorState(null);
    inputRef.current?.click();
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-capture-title"
      className="fixed inset-0 z-50 bg-zinc-950/95 flex items-center justify-center px-6"
      tabIndex={-1}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />

      {analysing && (
        <div className="text-center space-y-4">
          <h2 id="camera-capture-title" className="sr-only">Camera capture</h2>
          <div className="w-16 h-16 mx-auto border-4 border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-zinc-300 font-medium">Analysing your meal…</p>
          <p className="text-sm text-zinc-400">This usually takes a few seconds</p>
        </div>
      )}

      {errorState === 'no_food' && (
        <div className="text-center space-y-5 max-w-xs">
          <h2 id="camera-capture-title" className="sr-only">Camera capture</h2>
          <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <p className="text-zinc-100 font-medium">No food detected</p>
            <p className="text-sm text-zinc-400 mt-1">Try taking a clearer photo of your meal</p>
          </div>
          <div className="space-y-2">
            <button
              id="camera-retry"
              onClick={retry}
              className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition-all text-white font-medium"
            >
              Try again
            </button>
            <button
              id="camera-manual"
              ref={cancelButtonRef}
              onClick={onCancel}
              className="w-full h-11 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Enter manually instead
            </button>
          </div>
        </div>
      )}

      {errorState === 'failed' && (
        <div className="text-center space-y-5 max-w-xs">
          <h2 id="camera-capture-title" className="sr-only">Camera capture</h2>
          <div className="mx-auto w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <p className="text-zinc-100 font-medium">Something went wrong</p>
            <p className="text-sm text-zinc-400 mt-1">The vision analysis couldn't complete</p>
          </div>
          <button
            id="camera-retry-failed"
            onClick={retry}
            className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition-all text-white font-medium"
          >
            Try again
          </button>
        </div>
      )}

      {!analysing && !errorState && (
        <div className="text-center space-y-4">
          <h2 id="camera-capture-title" className="sr-only">Camera capture</h2>
          <p className="text-zinc-400 text-sm">Waiting for photo…</p>
          <button
            ref={cancelButtonRef}
            id="camera-cancel"
            onClick={onCancel}
            className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
