import type { Env } from './index';
import { corsHeaders } from './index';
import type { Auth } from './auth';

interface ProfileRow {
  user_id: string;
  display_name: string | null;
  age: number | null;
  sex: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: string;
  daily_goal_kcal: number;
  goal_suggested: number;
  created_at: number;
  updated_at: number;
}

function json(data: unknown, origin: string, env: Env, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin, env), 'Content-Type': 'application/json' },
  });
}

// Mifflin-St Jeor BMR -> TDEE, rounded to nearest 50 kcal
function suggestDailyGoal(p: {
  age: number;
  sex: string;
  weight_kg: number;
  height_cm: number;
  activity_level: string;
}): number {
  const bmr =
    p.sex === 'male'
      ? 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age + 5
      : 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age - 161;

  const multipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };

  return Math.round((bmr * (multipliers[p.activity_level] ?? 1.55)) / 50) * 50;
}

// GET /api/profile
export async function handleProfileGet(
  request: Request,
  env: Env,
  origin: string,
  auth: Auth,
): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, origin, env, 401);

  const profile = await env.DB.prepare(
    'SELECT * FROM user_profile WHERE user_id = ?',
  ).bind(session.user.id).first<ProfileRow>();

  return json(profile ?? null, origin, env);
}

// POST /api/profile
export async function handleProfileUpsert(
  request: Request,
  env: Env,
  origin: string,
  auth: Auth,
): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, origin, env, 401);

  const body = await request.json() as {
    display_name?: string;
    age?: number;
    sex?: string;
    height_cm?: number;
    weight_kg?: number;
    activity_level?: string;
    daily_goal_kcal?: number;
  };

  let goalKcal = body.daily_goal_kcal;
  let goalSuggested = 0;

  if (!goalKcal && body.age && body.sex && body.weight_kg && body.height_cm) {
    goalKcal = suggestDailyGoal({
      age: body.age,
      sex: body.sex,
      weight_kg: body.weight_kg,
      height_cm: body.height_cm,
      activity_level: body.activity_level ?? 'moderate',
    });
    goalSuggested = 1;
  }

  goalKcal = goalKcal ?? 2000;

  await env.DB.prepare(`
    INSERT INTO user_profile
      (user_id, display_name, age, sex, height_cm, weight_kg, activity_level, daily_goal_kcal, goal_suggested, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(user_id) DO UPDATE SET
      display_name    = COALESCE(excluded.display_name, display_name),
      age             = COALESCE(excluded.age, age),
      sex             = COALESCE(excluded.sex, sex),
      height_cm       = COALESCE(excluded.height_cm, height_cm),
      weight_kg       = COALESCE(excluded.weight_kg, weight_kg),
      activity_level  = COALESCE(excluded.activity_level, activity_level),
      daily_goal_kcal = excluded.daily_goal_kcal,
      goal_suggested  = excluded.goal_suggested,
      updated_at      = unixepoch()
  `).bind(
    session.user.id,
    body.display_name ?? null,
    body.age ?? null,
    body.sex ?? null,
    body.height_cm ?? null,
    body.weight_kg ?? null,
    body.activity_level ?? 'moderate',
    goalKcal,
    goalSuggested,
  ).run();

  return json({ daily_goal_kcal: goalKcal, goal_suggested: goalSuggested === 1 }, origin, env);
}
