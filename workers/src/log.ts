import type { Env } from './index';
import { corsHeaders } from './index';
import type { Auth } from './auth';

interface LogRow {
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

interface ProfileRow {
  daily_goal_kcal: number;
}

function json(data: unknown, origin: string, env: Env, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin, env), 'Content-Type': 'application/json' },
  });
}

async function getSession(auth: Auth, request: Request) {
  return auth.api.getSession({ headers: request.headers }).catch(() => null);
}

// POST /api/log
export async function handleLogCreate(
  request: Request,
  env: Env,
  origin: string,
  auth: Auth,
): Promise<Response> {
  const session = await getSession(auth, request);
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, origin, env, 401);

  const body = await request.json() as {
    logged_at: number;
    name: string;
    calories: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    confidence?: number;
    notes?: string;
    source?: 'vision' | 'manual';
  };

  if (!body.name || !body.calories || !body.logged_at) {
    return json({ error: 'Missing required fields: logged_at, name, calories' }, origin, env, 400);
  }

  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO food_logs
      (id, user_id, logged_at, name, calories, protein_g, carbs_g, fat_g, confidence, notes, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    session.user.id,
    body.logged_at,
    body.name,
    body.calories,
    body.protein_g ?? null,
    body.carbs_g ?? null,
    body.fat_g ?? null,
    body.confidence ?? null,
    body.notes ?? null,
    body.source ?? 'vision',
  ).run();

  return json({ id, ok: true }, origin, env);
}

// GET /api/day?date=YYYY-MM-DD
export async function handleLogDay(
  request: Request,
  env: Env,
  origin: string,
  auth: Auth,
): Promise<Response> {
  const session = await getSession(auth, request);
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, origin, env, 401);

  const date = new URL(request.url).searchParams.get('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ error: 'Missing or invalid date (expect YYYY-MM-DD)' }, origin, env, 400);
  }

  const dayStart = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
  const dayEnd = dayStart + 86400;

  const [logsResult, profile] = await Promise.all([
    env.DB.prepare(`
      SELECT id, logged_at, name, calories, protein_g, carbs_g, fat_g, confidence, notes, source
      FROM food_logs
      WHERE user_id = ? AND logged_at >= ? AND logged_at < ?
      ORDER BY logged_at ASC
    `).bind(session.user.id, dayStart, dayEnd).all<LogRow>(),

    env.DB.prepare(`SELECT daily_goal_kcal FROM user_profile WHERE user_id = ?`)
      .bind(session.user.id)
      .first<ProfileRow>(),
  ]);

  const entries = logsResult.results ?? [];
  const totalIn = entries.reduce((s: number, r: LogRow) => s + (r.calories || 0), 0);
  const goalKcal = profile?.daily_goal_kcal ?? 2000;

  return json({
    date,
    logs: entries,
    total_kcal: totalIn,
    goal_kcal: goalKcal,
    remaining_kcal: Math.max(0, goalKcal - totalIn),
    // burned_kcal and net_kcal: Phase 2 (RunViz integration)
  }, origin, env);
}

// GET /api/history?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function handleLogHistory(
  request: Request,
  env: Env,
  origin: string,
  auth: Auth,
): Promise<Response> {
  const session = await getSession(auth, request);
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, origin, env, 401);

  const params = new URL(request.url).searchParams;
  const from = params.get('from');
  const to = params.get('to');
  if (!from || !to) return json({ error: 'Missing from/to' }, origin, env, 400);

  const fromTs = Math.floor(new Date(`${from}T00:00:00Z`).getTime() / 1000);
  const toTs = Math.floor(new Date(`${to}T00:00:00Z`).getTime() / 1000) + 86400;

  const [rowsResult, profile] = await Promise.all([
    env.DB.prepare(`
      SELECT
        date(logged_at, 'unixepoch') AS day,
        SUM(calories)  AS total_kcal,
        SUM(protein_g) AS protein_g,
        SUM(carbs_g)   AS carbs_g,
        SUM(fat_g)     AS fat_g,
        COUNT(*)       AS entry_count
      FROM food_logs
      WHERE user_id = ? AND logged_at >= ? AND logged_at < ?
      GROUP BY day
      ORDER BY day ASC
    `).bind(session.user.id, fromTs, toTs).all<Record<string, unknown>>(),

    env.DB.prepare(`SELECT daily_goal_kcal FROM user_profile WHERE user_id = ?`)
      .bind(session.user.id)
      .first<ProfileRow>(),
  ]);

  return json({
    from,
    to,
    goal_kcal: profile?.daily_goal_kcal ?? 2000,
    days: rowsResult.results ?? [],
  }, origin, env);
}

// DELETE /api/log/:id
export async function handleLogDelete(
  request: Request,
  env: Env,
  origin: string,
  auth: Auth,
  id: string,
): Promise<Response> {
  const session = await getSession(auth, request);
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, origin, env, 401);

  const result = await env.DB.prepare(
    'DELETE FROM food_logs WHERE id = ? AND user_id = ?',
  ).bind(id, session.user.id).run();

  if (result.meta.changes === 0) {
    return json({ error: 'Not found' }, origin, env, 404);
  }

  return json({ ok: true }, origin, env);
}

// PATCH /api/log/:id
export async function handleLogPatch(
  request: Request,
  env: Env,
  origin: string,
  auth: Auth,
  id: string,
): Promise<Response> {
  const session = await getSession(auth, request);
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, origin, env, 401);

  const body = await request.json() as {
    name?: string;
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    notes?: string;
  };

  await env.DB.prepare(`
    UPDATE food_logs SET
      name      = COALESCE(?, name),
      calories  = COALESCE(?, calories),
      protein_g = COALESCE(?, protein_g),
      carbs_g   = COALESCE(?, carbs_g),
      fat_g     = COALESCE(?, fat_g),
      notes     = COALESCE(?, notes)
    WHERE id = ? AND user_id = ?
  `).bind(
    body.name ?? null,
    body.calories ?? null,
    body.protein_g ?? null,
    body.carbs_g ?? null,
    body.fat_g ?? null,
    body.notes ?? null,
    id,
    session.user.id,
  ).run();

  return json({ ok: true }, origin, env);
}
