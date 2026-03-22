import type { SnapResult } from '../../workers/src/snap';

// ---------------------------------------------------------------------------
// Typed fetch helper
// ---------------------------------------------------------------------------

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });

  if (!resp.ok) {
    let errorMsg = 'Request failed';
    try {
      const data = await resp.json() as { error?: string };
      errorMsg = data?.error ?? errorMsg;
      throw Object.assign(new Error(errorMsg), { status: resp.status, data });
    } catch (e) {
      if (e instanceof Error && 'status' in (e as any)) throw e;
      const text = await resp.text().catch(() => 'No error detail');
      throw Object.assign(new Error(text || errorMsg), { status: resp.status, data: { error: text } });
    }
  }

  return await resp.json() as T;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface SessionResponse {
  authenticated: boolean;
  user?: { id: string; email: string; name: string; image?: string };
}

export const getSession = () => req<SessionResponse>('/api/session');

// ---------------------------------------------------------------------------
// Vision
// ---------------------------------------------------------------------------

export const snap = (imageBase64: string, mimeType: string) =>
  req<SnapResult>('/api/snap', {
    method: 'POST',
    body: JSON.stringify({ imageBase64, mimeType }),
  });

// ---------------------------------------------------------------------------
// Food log
// ---------------------------------------------------------------------------

export interface LogEntry {
  id: string;
  logged_at: number;
  name: string;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  confidence: number | null;
  notes: string | null;
  source: 'vision' | 'manual';
}

export interface DayResponse {
  date: string;
  logs: LogEntry[];
  total_kcal: number;
  goal_kcal: number;
  remaining_kcal: number;
}

export interface HistoryDay {
  day: string;
  total_kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  entry_count: number;
}

export interface HistoryResponse {
  from: string;
  to: string;
  goal_kcal: number;
  days: HistoryDay[];
}

export const logCreate = (body: Omit<LogEntry, 'id'>) =>
  req<{ id: string; ok: boolean }>('/api/log', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const logDay = (params: {
  date: string;
  start: number;
  end: number;
  timeZone: string;
}) =>
  req<DayResponse>(
    `/api/day?date=${encodeURIComponent(params.date)}&start=${params.start}&end=${params.end}&timeZone=${encodeURIComponent(params.timeZone)}`,
  );

export const logHistory = (params: {
  from: string;
  to: string;
  start: number;
  end: number;
  timeZone: string;
}) =>
  req<HistoryResponse>(
    `/api/history?from=${encodeURIComponent(params.from)}&to=${encodeURIComponent(params.to)}&start=${params.start}&end=${params.end}&timeZone=${encodeURIComponent(params.timeZone)}`,
  );

export const logDelete = (id: string) =>
  req<{ ok: boolean }>(`/api/log/${id}`, { method: 'DELETE' });

export const logPatch = (
  id: string,
  body: Partial<Pick<LogEntry, 'name' | 'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'notes'>>,
) =>
  req<{ ok: boolean }>(`/api/log/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export interface UserProfile {
  user_id: string;
  display_name: string | null;
  age: number | null;
  sex: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: string;
  daily_goal_kcal: number;
  goal_suggested: number;
}

export const profileGet = () => req<UserProfile | null>('/api/profile');

export const profileUpsert = (
  body: Partial<Omit<UserProfile, 'user_id' | 'goal_suggested'>> & { daily_goal_kcal?: number },
) =>
  req<{ daily_goal_kcal: number; goal_suggested: boolean }>('/api/profile', {
    method: 'POST',
    body: JSON.stringify(body),
  });

// ---------------------------------------------------------------------------
// Strava
// ---------------------------------------------------------------------------

export interface StravaKeyStatus {
  configured: boolean;
  clientId: string | null;
  updatedAt: number | null;
}

export interface StravaConnectionStatus {
  connected: boolean;
  athlete?: {
    id: number;
    name: string;
    profile: string;
  };
}

export interface StravaBurnedResponse {
  connected: boolean;
  burned_kcal: number | null;
  activity_count?: number;
  error?: string;
}

export const stravaApi = {
  getKeyStatus: () =>
    req<StravaKeyStatus>('/api/strava/keys/status'),

  saveKeys: (clientId: string, clientSecret: string) =>
    req<{ ok: boolean }>('/api/strava/keys', {
      method: 'POST',
      body: JSON.stringify({ clientId, clientSecret }),
    }),

  getConnectUrl: (): string => {
    const callbackUrl = `${window.location.origin}/callback`;
    return `/api/strava/connect?redirect_uri=${encodeURIComponent(callbackUrl)}`;
  },

  handleCallback: (code: string, state?: string) =>
    req<{ connected: boolean; athlete: { id: number; firstname: string; lastname: string; profile: string } }>(
      '/api/strava/callback',
      { method: 'POST', body: JSON.stringify({ code, state }) },
    ),

  getStatus: () =>
    req<StravaConnectionStatus>('/api/strava/status'),

  disconnect: () =>
    req<{ disconnected: boolean }>('/api/strava/disconnect', { method: 'DELETE' }),

  getBurned: (date: string) =>
    req<StravaBurnedResponse>(`/api/strava/burned?date=${date}`),
};
