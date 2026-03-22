import { useEffect, useState } from 'react';
import { stravaApi } from '../services/api';
import type { StravaConnectionStatus, StravaKeyStatus } from '../services/api';

interface Props {
  onConnected: () => void;
}

export function StravaConnect({ onConnected }: Props) {
  const [keyStatus, setKeyStatus] = useState<StravaKeyStatus | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<StravaConnectionStatus | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadStatus();
  }, []);

  async function loadStatus() {
    setLoading(true);
    try {
      const [keys, conn] = await Promise.all([
        stravaApi.getKeyStatus(),
        stravaApi.getStatus(),
      ]);
      setKeyStatus(keys);
      setConnectionStatus(conn);
      if (keys.clientId) setClientId(keys.clientId);
    } catch {
      setStatus('Failed to load Strava status.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!clientId.trim() || !clientSecret.trim()) {
      setStatus('Enter both your Client ID and Client Secret.');
      return;
    }

    setSaving(true);
    setStatus(null);
    try {
      await stravaApi.saveKeys(clientId.trim(), clientSecret.trim());
      const updated = await stravaApi.getKeyStatus();
      setKeyStatus(updated);
      setClientId(updated.clientId ?? clientId.trim());
      setClientSecret('');
      setStatus('Strava app saved. You can now connect your account.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  function handleConnect() {
    window.location.href = stravaApi.getConnectUrl();
  }

  async function handleDisconnect() {
    setSaving(true);
    setStatus(null);
    try {
      await stravaApi.disconnect();
      setConnectionStatus({ connected: false });
      setStatus('Disconnected from Strava.');
      onConnected();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to disconnect.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
        Loading Strava status...
      </div>
    );
  }

  if (connectionStatus?.connected && connectionStatus.athlete) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-xl bg-zinc-900 px-4 py-3">
          {connectionStatus.athlete.profile && (
            <img
              src={connectionStatus.athlete.profile}
              alt=""
              className="h-9 w-9 rounded-full object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-100">
              {connectionStatus.athlete.name}
            </p>
            <p className="text-xs text-emerald-500">Connected to Strava</p>
          </div>
        </div>
        <button
          onClick={handleDisconnect}
          disabled={saving}
          className="w-full rounded-xl border border-zinc-700 bg-transparent px-4 py-2.5 text-sm text-zinc-400 transition hover:border-red-500/50 hover:text-red-400 disabled:cursor-wait disabled:opacity-50"
        >
          {saving ? 'Disconnecting...' : 'Disconnect Strava'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl bg-zinc-900 px-4 py-4 text-sm leading-6 text-zinc-400">
        <p className="font-medium text-zinc-200">How to get your Strava API keys</p>
        <ol className="list-inside list-decimal space-y-2">
          <li>
            Go to{' '}
            <a
              href="https://www.strava.com/settings/api"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 underline underline-offset-2"
            >
              strava.com/settings/api
            </a>
          </li>
          <li>
            Create an app and set{' '}
            <strong className="text-zinc-300">Authorization Callback Domain</strong> to{' '}
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200">hwong103.work</code>
          </li>
          <li>
            Copy the <strong className="text-zinc-300">Client ID</strong> and{' '}
            <strong className="text-zinc-300">Client Secret</strong>
          </li>
          <li>Paste them below and save the app</li>
        </ol>
        <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-xs text-zinc-400">
          Do not copy the access token or refresh token. SnapTrack only needs the Client ID and Client Secret.
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-widest text-zinc-500">
            Client ID
          </label>
          <input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="e.g. 123456"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-emerald-500"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-widest text-zinc-500">
            Client Secret
          </label>
          <input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder={keyStatus?.configured ? 'Enter new value to rotate' : 'Paste your Client Secret'}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-emerald-500"
          />
        </div>

        {keyStatus?.configured && (
          <p className="text-xs text-zinc-500">
            Keys saved
            {keyStatus.updatedAt
              ? ` on ${new Date(keyStatus.updatedAt * 1000).toLocaleDateString()}`
              : ''}
            . Enter a new secret to rotate.
          </p>
        )}
      </div>

      {status && (
        <p className={`text-sm ${status.includes('saved') || status.includes('Connected') ? 'text-emerald-400' : 'text-red-400'}`}>
          {status}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-xl border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Strava app'}
        </button>
        <button
          onClick={handleConnect}
          disabled={!keyStatus?.configured}
          className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Connect Strava
        </button>
      </div>

      <p className="text-xs leading-5 text-zinc-600">
        Your Client Secret is encrypted before storage and is never readable by SnapTrack.
      </p>
    </div>
  );
}
