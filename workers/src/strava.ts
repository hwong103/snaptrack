import type { Env } from './index';
import { corsHeaders } from './index';
import type { Auth } from './auth';
import { encrypt, decrypt } from './crypto';

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_API_URL = 'https://www.strava.com/api/v3';

export interface StravaTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  athleteId: number;
  athleteName: string;
  athleteProfile: string;
}

interface StoredStravaKeys {
  clientId: string;
  clientSecret: string;
}

function generateState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function resolveStoredStravaKeys(
  env: Env,
  userId: string,
): Promise<StoredStravaKeys | null> {
  const row = await env.DB.prepare(
    'SELECT client_id, client_secret_enc FROM strava_keys WHERE user_id = ?',
  ).bind(userId).first<{ client_id: string; client_secret_enc: string }>();

  if (!row) return null;

  const clientSecret = await decrypt(row.client_secret_enc, env.BETTER_AUTH_SECRET);
  return {
    clientId: row.client_id,
    clientSecret,
  };
}

async function getStoredTokenData(
  env: Env,
  userId: string,
): Promise<StravaTokenData | null> {
  const stored = await env.TOKENS.get(`strava:${userId}`);
  if (!stored) return null;
  return JSON.parse(stored) as StravaTokenData;
}

async function refreshTokenIfNeeded(
  env: Env,
  userId: string,
  tokenData: StravaTokenData,
): Promise<StravaTokenData | null> {
  if (tokenData.expiresAt > Math.floor(Date.now() / 1000) + 60) {
    return tokenData;
  }

  const keys = await resolveStoredStravaKeys(env, userId);
  if (!keys) return null;

  const form = new URLSearchParams({
    client_id: keys.clientId,
    client_secret: keys.clientSecret,
    refresh_token: tokenData.refreshToken,
    grant_type: 'refresh_token',
  });

  const resp = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });

  if (!resp.ok) return null;

  const data = await resp.json() as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };

  const updated: StravaTokenData = {
    ...tokenData,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
  };

  await env.TOKENS.put(`strava:${userId}`, JSON.stringify(updated), {
    expirationTtl: 60 * 60 * 24 * 30,
  });

  return updated;
}

function json(data: unknown, origin: string, env: Env, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin, env), 'Content-Type': 'application/json' },
  });
}

export async function handleSaveStravaKey(
  request: Request,
  env: Env,
  origin: string,
  auth: Auth,
): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, origin, env, 401);

  const body = await request.json() as { clientId?: string; clientSecret?: string };
  if (!body.clientId || !body.clientSecret) {
    return json({ error: 'Missing clientId or clientSecret' }, origin, env, 400);
  }
  if (!/^\d+$/.test(body.clientId)) {
    return json({ error: 'Invalid Client ID - must be a number' }, origin, env, 400);
  }

  const encryptedSecret = await encrypt(body.clientSecret, env.BETTER_AUTH_SECRET);

  await env.DB.prepare(`
    INSERT INTO strava_keys (user_id, client_id, client_secret_enc, created_at, updated_at)
    VALUES (?, ?, ?, unixepoch(), unixepoch())
    ON CONFLICT(user_id) DO UPDATE SET
      client_id = excluded.client_id,
      client_secret_enc = excluded.client_secret_enc,
      updated_at = unixepoch()
  `).bind(session.user.id, body.clientId, encryptedSecret).run();

  return json({ ok: true }, origin, env);
}

export async function handleGetStravaKeyStatus(
  request: Request,
  env: Env,
  origin: string,
  auth: Auth,
): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, origin, env, 401);

  const row = await env.DB.prepare(
    'SELECT client_id, updated_at FROM strava_keys WHERE user_id = ?',
  ).bind(session.user.id).first<{ client_id: string; updated_at: number }>();

  return json({
    configured: !!row,
    clientId: row?.client_id ?? null,
    updatedAt: row?.updated_at ?? null,
  }, origin, env);
}

export async function handleStravaConnect(
  request: Request,
  env: Env,
  origin: string,
  auth: Auth,
): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, origin, env, 401);

  const keys = await resolveStoredStravaKeys(env, session.user.id);
  if (!keys) {
    return json(
      { error: 'Save your Strava Client ID and Client Secret before connecting.' },
      origin,
      env,
      400,
    );
  }

  const state = generateState();
  await env.TOKENS.put(
    `strava-oauth:${state}`,
    JSON.stringify({ userId: session.user.id }),
    { expirationTtl: 60 * 10 },
  );

  const url = new URL(request.url);
  const redirectUri = url.searchParams.get('redirect_uri') ?? `${env.FRONTEND_URL}/callback`;

  const authUrl = new URL(STRAVA_AUTH_URL);
  authUrl.searchParams.set('client_id', keys.clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'read,activity:read_all');
  authUrl.searchParams.set('state', state);

  return Response.redirect(authUrl.toString(), 302);
}

export async function handleStravaCallback(
  request: Request,
  env: Env,
  origin: string,
): Promise<Response> {
  const body = await request.json() as { code?: string; state?: string };
  if (!body.code) return json({ error: 'Missing code' }, origin, env, 400);

  const stateContext = body.state
    ? await env.TOKENS.get(`strava-oauth:${body.state}`)
      .then((value) => value ? JSON.parse(value) as { userId: string } : null)
    : null;

  if (!stateContext?.userId) {
    return json({ error: 'Invalid or expired state' }, origin, env, 400);
  }

  const keys = await resolveStoredStravaKeys(env, stateContext.userId);
  if (!keys) {
    return json({ error: 'Strava credentials not configured for this account.' }, origin, env, 400);
  }

  const form = new URLSearchParams({
    client_id: keys.clientId,
    client_secret: keys.clientSecret,
    code: body.code,
    grant_type: 'authorization_code',
  });

  const tokenResp = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });

  if (!tokenResp.ok) {
    const err = await tokenResp.text();
    console.error('Strava token exchange failed:', err);
    return json({ error: 'Token exchange failed' }, origin, env, 400);
  }

  const tokenData = await tokenResp.json() as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    athlete: {
      id: number;
      firstname: string;
      lastname: string;
      profile: string;
    };
  };

  const athleteName = `${tokenData.athlete.firstname} ${tokenData.athlete.lastname}`.trim();
  const stored: StravaTokenData = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: tokenData.expires_at,
    athleteId: tokenData.athlete.id,
    athleteName,
    athleteProfile: tokenData.athlete.profile,
  };

  await env.TOKENS.put(`strava:${stateContext.userId}`, JSON.stringify(stored), {
    expirationTtl: 60 * 60 * 24 * 30,
  });
  await env.TOKENS.delete(`strava-oauth:${body.state}`);

  return json({
    connected: true,
    athlete: {
      id: tokenData.athlete.id,
      firstname: tokenData.athlete.firstname,
      lastname: tokenData.athlete.lastname,
      profile: tokenData.athlete.profile,
    },
  }, origin, env);
}

export async function handleStravaStatus(
  request: Request,
  env: Env,
  origin: string,
  auth: Auth,
): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, origin, env, 401);

  const tokenData = await getStoredTokenData(env, session.user.id);
  if (!tokenData) return json({ connected: false }, origin, env);

  return json({
    connected: true,
    athlete: {
      id: tokenData.athleteId,
      name: tokenData.athleteName,
      profile: tokenData.athleteProfile,
    },
  }, origin, env);
}

export async function handleStravaDisconnect(
  request: Request,
  env: Env,
  origin: string,
  auth: Auth,
): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, origin, env, 401);

  await env.TOKENS.delete(`strava:${session.user.id}`);
  return json({ disconnected: true }, origin, env);
}

export async function handleStravaBurned(
  request: Request,
  env: Env,
  origin: string,
  auth: Auth,
): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, origin, env, 401);

  const date = new URL(request.url).searchParams.get('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ error: 'Missing or invalid date (YYYY-MM-DD)' }, origin, env, 400);
  }

  let tokenData = await getStoredTokenData(env, session.user.id);
  if (!tokenData) return json({ connected: false, burned_kcal: null }, origin, env);

  const refreshed = await refreshTokenIfNeeded(env, session.user.id, tokenData);
  if (!refreshed) {
    return json({ connected: false, burned_kcal: null }, origin, env);
  }

  tokenData = refreshed;
  const dayStart = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
  const dayEnd = dayStart + 86400;

  const stravaResp = await fetch(
    `${STRAVA_API_URL}/athlete/activities?after=${dayStart}&before=${dayEnd}&per_page=30`,
    { headers: { Authorization: `Bearer ${tokenData.accessToken}` } },
  );

  if (!stravaResp.ok) {
    console.error('Strava activities fetch failed:', stravaResp.status);
    return json({ connected: true, burned_kcal: null, error: 'strava_fetch_failed' }, origin, env);
  }

  const activities = await stravaResp.json() as { kilojoules?: number }[];
  const totalKj = activities.reduce((sum, activity) => sum + (activity.kilojoules ?? 0), 0);
  const burnedKcal = Math.round(totalKj / 4.184);

  return json({
    connected: true,
    burned_kcal: burnedKcal,
    activity_count: activities.length,
  }, origin, env);
}
