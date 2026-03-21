import type { Env } from './index';
import { corsHeaders } from './index';
import type { Auth } from './auth';

const NUTRITION_PROMPT = `You are a nutrition analysis assistant. Analyse this food or drink image.
Respond ONLY with a valid JSON object — no markdown, no backticks, no explanation outside the JSON:
{
  "name": "short descriptive name of the food or drink",
  "description": "what you see including estimated portion size",
  "calories": <integer kcal>,
  "protein_g": <number, grams>,
  "carbs_g": <number, grams>,
  "fat_g": <number, grams>,
  "confidence": <integer 0-100>,
  "notes": "any caveats or assumptions about the estimate"
}
If the image contains no food or drink, return exactly: { "error": "no_food_detected" }`;

export interface SnapResult {
  name: string;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: number;
  notes: string;
}

export async function handleSnap(
  request: Request,
  env: Env,
  origin: string,
  auth: Auth,
): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders(origin, env), 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as { imageBase64: string; mimeType: string };

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
  if (!body.imageBase64 || !allowedTypes.includes(body.mimeType)) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { ...corsHeaders(origin, env), 'Content-Type': 'application/json' },
    });
  }

  try {
    const result = await env.AI.run('@cf/llama-3.2-11b-vision-instruct' as any, {
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${body.mimeType};base64,${body.imageBase64}` },
            },
            { type: 'text', text: NUTRITION_PROMPT },
          ],
        },
      ],
    } as Parameters<typeof env.AI.run>[1]);

    const raw = ((result as { response: string }).response ?? '')
      .replace(/```json|```/g, '')
      .trim();

    const parsed = JSON.parse(raw) as Record<string, unknown>;

    if (parsed['error'] === 'no_food_detected') {
      return new Response(JSON.stringify({ error: 'no_food_detected' }), {
        status: 422,
        headers: { ...corsHeaders(origin, env), 'Content-Type': 'application/json' },
      });
    }

    const snap: SnapResult = {
      name:        String(parsed['name'] ?? 'Unknown food'),
      description: String(parsed['description'] ?? ''),
      calories:    Math.round(Number(parsed['calories']) || 0),
      protein_g:   Math.round(Number(parsed['protein_g']) || 0),
      carbs_g:     Math.round(Number(parsed['carbs_g']) || 0),
      fat_g:       Math.round(Number(parsed['fat_g']) || 0),
      confidence:  Math.min(100, Math.max(0, Math.round(Number(parsed['confidence']) || 50))),
      notes:       String(parsed['notes'] ?? ''),
    };

    return new Response(JSON.stringify(snap), {
      headers: { ...corsHeaders(origin, env), 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Workers AI snap error:', err);
    return new Response(JSON.stringify({ error: 'vision_failed' }), {
      status: 500,
      headers: { ...corsHeaders(origin, env), 'Content-Type': 'application/json' },
    });
  }
}
