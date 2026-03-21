import type { Fetcher, D1Database, KVNamespace, Ai } from '@cloudflare/workers-types';
import { createAuth } from './auth';
import { handleSnap } from './snap';
import {
  handleLogCreate,
  handleLogDay,
  handleLogHistory,
  handleLogDelete,
  handleLogPatch,
} from './log';
import { handleProfileGet, handleProfileUpsert } from './profile';

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  TOKENS: KVNamespace;
  AI: Ai;
  BETTER_AUTH_SECRET: string;
  RESEND_API_KEY: string;
  FRONTEND_URL: string;
  FRONTEND_PREVIEW_HOST?: string;
  ADDITIONAL_FRONTEND_URLS?: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}

function getConfiguredOrigins(env: Env): string[] {
  const configured = [env.FRONTEND_URL, env.ADDITIONAL_FRONTEND_URLS]
    .flatMap((value) => value ? value.split(',') : [])
    .map((value) => value.trim())
    .filter(Boolean);

  return [
    ...configured,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];
}

function isAllowedOrigin(origin: string, env: Env): boolean {
  if (!origin) return false;
  const fixed = getConfiguredOrigins(env);
  if (fixed.includes(origin)) return true;
  if (!env.FRONTEND_PREVIEW_HOST) return false;
  try {
    const h = new URL(origin).hostname;
    return h === env.FRONTEND_PREVIEW_HOST || h.endsWith(`.${env.FRONTEND_PREVIEW_HOST}`);
  } catch {
    return false;
  }
}

export function corsHeaders(origin: string, env: Env): HeadersInit {
  const allowedOrigin = isAllowedOrigin(origin, env) ? origin : env.FRONTEND_URL;
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  };
}

function withCors(response: Response, origin: string, env: Env): Response {
  const headers = new Headers(response.headers);
  const cors = corsHeaders(origin, env);
  Object.entries(cors).forEach(([k, v]) => headers.set(k, String(v)));
  const rewritten = new Response(response.body, { status: response.status, headers });
  const getSetCookie = (response.headers as Headers & {
    getSetCookie?: () => string[];
  }).getSetCookie;

  if (typeof getSetCookie === 'function') {
    for (const cookie of getSetCookie.call(response.headers)) {
      rewritten.headers.append('Set-Cookie', cookie);
    }
  } else {
    const cookie = response.headers.get('Set-Cookie');
    if (cookie) rewritten.headers.append('Set-Cookie', cookie);
  }

  return rewritten;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || env.FRONTEND_URL;
    const method = request.method;
    let authInstance: ReturnType<typeof createAuth> | null = null;

    function getAuth() {
      if (!authInstance) authInstance = createAuth(env, url.origin);
      return authInstance;
    }

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin, env) });
    }

    try {
      // better-auth
      if (url.pathname.startsWith('/api/auth/')) {
        return withCors(await getAuth().handler(request), origin, env);
      }

      // Session check
      if (url.pathname === '/api/session' && method === 'GET') {
        const session = await getAuth().api.getSession({ headers: request.headers }).catch(() => null);
        return new Response(
          JSON.stringify(
            session
              ? { authenticated: true, user: session.user }
              : { authenticated: false },
          ),
          { headers: { ...corsHeaders(origin, env), 'Content-Type': 'application/json' } },
        );
      }

      // Vision — ephemeral, no storage
      if (url.pathname === '/api/snap' && method === 'POST') {
        return handleSnap(request, env, origin, getAuth());
      }

      // Food log
      if (url.pathname === '/api/log' && method === 'POST') {
        return handleLogCreate(request, env, origin, getAuth());
      }
      if (url.pathname === '/api/day' && method === 'GET') {
        return handleLogDay(request, env, origin, getAuth());
      }
      if (url.pathname === '/api/history' && method === 'GET') {
        return handleLogHistory(request, env, origin, getAuth());
      }

      const logMatch = url.pathname.match(/^\/api\/log\/([^/]+)$/);
      if (logMatch) {
        const id = logMatch[1]!;
        if (method === 'DELETE') return handleLogDelete(request, env, origin, getAuth(), id);
        if (method === 'PATCH') return handleLogPatch(request, env, origin, getAuth(), id);
      }

      // Profile
      if (url.pathname === '/api/profile') {
        if (method === 'GET') return handleProfileGet(request, env, origin, getAuth());
        if (method === 'POST') return handleProfileUpsert(request, env, origin, getAuth());
      }

      // SPA fallback
      return (env.ASSETS.fetch(request as any) as any) as Response;
    } catch (err) {
      console.error('Worker error:', err);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        {
          status: 500,
          headers: { ...corsHeaders(origin, env), 'Content-Type': 'application/json' },
        },
      );
    }
  },
};
