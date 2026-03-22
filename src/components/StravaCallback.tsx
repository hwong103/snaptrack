import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { stravaApi } from '../services/api';

export function StravaCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state') ?? undefined;
    const error = searchParams.get('error');

    if (error) {
      console.error('Strava OAuth error:', error);
      navigate('/settings', { replace: true });
      return;
    }

    if (!code) {
      navigate('/settings', { replace: true });
      return;
    }

    stravaApi.handleCallback(code, state)
      .then(() => navigate('/settings', { replace: true }))
      .catch((err) => {
        console.error('Strava callback error:', err);
        navigate('/settings', { replace: true });
      });
  }, [searchParams, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-3 text-zinc-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
        <p className="text-sm">Connecting to Strava...</p>
      </div>
    </div>
  );
}
