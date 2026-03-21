import { useRef, useState, useEffect } from 'react';
import { compressImage } from '../services/compressImage';
import { snap } from '../services/api';
import type { SnapResult } from '../../workers/src/snap';
import { useModalDialog } from '../hooks/useModalDialog';
import { useGsapOverlay } from '../hooks/useGsapOverlay';
import { useGsapReveal } from '../hooks/useGsapReveal';

interface Props {
  onResult: (result: SnapResult) => void;
  onError: (msg: string) => void;
  onCancel: () => void;
}

export default function CameraCapture({ onResult, onError, onCancel }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [analysing, setAnalysing] = useState(false);
  const [errorState, setErrorState] = useState<'no_food' | 'failed' | null>(null);
  const dialogRef = useModalDialog(true, onCancel, cancelButtonRef);

  useGsapOverlay(true, backdropRef, dialogRef);
  useGsapReveal(dialogRef, [analysing, errorState]);

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
      console.log('CameraCapture: Compressing image...');
      const { base64, mimeType } = await compressImage(file, 800);
      console.log('CameraCapture: Image compressed, size:', base64.length);
      console.log('CameraCapture: Sending to /api/snap...');
      const result = await snap(base64, mimeType);
      console.log('CameraCapture: Received result:', result);
      onResult(result);
    } catch (err: unknown) {
      console.error('CameraCapture error:', err);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div ref={backdropRef} className="absolute inset-0 bg-zinc-950/95" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="camera-capture-title"
        className="relative max-w-sm w-full text-center"
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
          <div data-reveal className="space-y-4">
            <h2 id="camera-capture-title" className="sr-only">Camera capture</h2>
            <div className="w-16 h-16 mx-auto border-4 border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
            <p className="text-zinc-300 font-medium">Checking your meal…</p>
            <p className="text-sm text-zinc-400">This usually takes a few seconds.</p>
          </div>
        )}

        {errorState === 'no_food' && (
          <div data-reveal className="space-y-5">
            <h2 id="camera-capture-title" className="sr-only">Camera capture</h2>
            <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <p className="text-zinc-100 font-medium">We couldn&apos;t find food in that photo</p>
              <p className="text-sm text-zinc-400 mt-1">Try again with the meal centered and clearly visible.</p>
            </div>
            <div className="space-y-2">
              <button
                id="camera-retry"
                onClick={retry}
                className="bg-accent-primary pressable w-full h-12 rounded-xl hover:brightness-110 transition-all text-slate-950 font-medium"
              >
                Take another photo
              </button>
              <button
                id="camera-manual"
                ref={cancelButtonRef}
                onClick={onCancel}
                className="w-full h-11 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Add it manually
              </button>
            </div>
          </div>
        )}

        {errorState === 'failed' && (
          <div data-reveal className="space-y-5">
            <h2 id="camera-capture-title" className="sr-only">Camera capture</h2>
            <div className="mx-auto w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <p className="text-zinc-100 font-medium">We couldn&apos;t check that photo</p>
              <p className="text-sm text-zinc-400 mt-1">Try again, or add the meal manually instead.</p>
            </div>
            <button
              id="camera-retry-failed"
              onClick={retry}
              className="bg-accent-primary pressable w-full h-12 rounded-xl hover:brightness-110 transition-all text-slate-950 font-medium"
            >
              Try again
            </button>
          </div>
        )}

        {!analysing && !errorState && (
          <div data-reveal className="space-y-4">
            <h2 id="camera-capture-title" className="sr-only">Camera capture</h2>
            <p className="text-zinc-400 text-sm">Choose a meal photo to get started.</p>
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
    </div>
  );
}
