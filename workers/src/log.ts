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

interface HistoryLogRow {
  logged_at: number;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

interface HistoryDayRow {
  day: string;
  total_kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  entry_count: number;
}

function json(data: unknown, origin: string, env: Env, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin, env), 'Content-Type': 'application/json' },
  });
}

function getDateFormatter(timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatDayKey(epochSeconds: number, timeZone: string): string {
  const parts = getDateFormatter(timeZone).formatToParts(new Date(epochSeconds * 1000));
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function groupHistoryRows(rows: HistoryLogRow[], timeZone: string): HistoryDayRow[] {
  const grouped = new Map<string, HistoryDayRow>();

  for (const row of rows) {
    const day = formatDayKey(row.logged_at, timeZone);
    const existing = grouped.get(day);

    if (existing) {
      existing.total_kcal += row.calories || 0;
      existing.protein_g = (existing.protein_g ?? 0) + (row.protein_g ?? 0);
      existing.carbs_g = (existing.carbs_g ?? 0) + (row.carbs_g ?? 0);
      existing.fat_g = (existing.fat_g ?? 0) + (row.fat_g ?? 0);
      existing.entry_count += 1;
      continue;
    }

    grouped.set(day, {
      day,
      total_kcal: row.calories || 0,
      protein_g: row.protein_g ?? 0,
      carbs_g: row.carbs_g ?? 0,
      fat_g: row.fat_g ?? 0,
      entry_count: 1,
    });
  }

  return [...grouped.values()].sort((a, b) => a.day.localeCompare(b.day));
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

  const params = new URL(request.url).searchParams;
  const date = params.get('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ error: 'Missing or invalid date (expect YYYY-MM-DD)' }, origin, env, 400);
  }

  const dayStart = Number(params.get('start'));
  const dayEnd = Number(params.get('end'));
  if (!Number.isFinite(dayStart) || !Number.isFinite(dayEnd) || dayEnd <= dayStart) {
    return json({ error: 'Missing or invalid start/end range' }, origin, env, 400);
  }

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

  const fromTs = Number(params.get('start'));
  const toTs = Number(params.get('end'));
  if (!Number.isFinite(fromTs) || !Number.isFinite(toTs) || toTs <= fromTs) {
    return json({ error: 'Missing or invalid start/end range' }, origin, env, 400);
  }
  const timeZone = params.get('timeZone') || 'UTC';

  const [rowsResult, profile] = await Promise.all([
    env.DB.prepare(`
      SELECT
        logged_at,
        calories,
        protein_g,
        carbs_g,
        fat_g
      FROM food_logs
      WHERE user_id = ? AND logged_at >= ? AND logged_at < ?
      ORDER BY logged_at ASC
    `).bind(session.user.id, fromTs, toTs).all<HistoryLogRow>(),

    env.DB.prepare(`SELECT daily_goal_kcal FROM user_profile WHERE user_id = ?`)
      .bind(session.user.id)
      .first<ProfileRow>(),
  ]);

  const days = groupHistoryRows(rowsResult.results ?? [], timeZone);

  return json({
    from,
    to,
    goal_kcal: profile?.daily_goal_kcal ?? 2000,
    days,
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
